from __future__ import annotations

import asyncio
import threading
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from ..models import DealPayload, User
from ..observability import flush_langfuse
from ..storage import JsonDealStore
from .document_intake import DealDocumentIntakeService

RUNNING_STATUSES = {'queued', 'running'}
FINAL_STATUSES = {'completed', 'partial', 'failed'}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class BufferedUpload:
    def __init__(self, *, filename: str, content_type: str, file_bytes: bytes) -> None:
        self.filename = filename
        self.content_type = content_type
        self._file_bytes = file_bytes

    async def read(self) -> bytes:
        return self._file_bytes


class DocumentExtractionJobManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._active_run_by_deal: dict[str, str] = {}

    def start_job(
        self,
        *,
        deal_id: str,
        current_user: User,
        uploads: list[BufferedUpload],
        existing_intake: dict[str, Any] | None,
        store: JsonDealStore,
        service: DealDocumentIntakeService,
    ) -> dict[str, Any]:
        upload_count = len(uploads)
        if upload_count == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Select at least one file to extract.')

        with self._lock:
            active_run_id = self._active_run_by_deal.get(deal_id)
            if active_run_id:
                active_job = self._jobs.get(active_run_id)
                active_status = str((active_job or {}).get('run', {}).get('status') or '')
                if active_status in RUNNING_STATUSES:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail='An extraction run is already in progress for this deal. Please wait for it to finish.',
                    )

            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            run_id = f'run-{timestamp}'
            created_at = utc_now_iso()
            existing_company_overview = deepcopy(existing_intake.get('companyOverview')) if isinstance(existing_intake, dict) and isinstance(existing_intake.get('companyOverview'), dict) else None
            existing_company_research = deepcopy(existing_intake.get('companyResearch')) if isinstance(existing_intake, dict) and isinstance(existing_intake.get('companyResearch'), dict) else None
            run = {
                'id': run_id,
                'createdAt': created_at,
                'createdByUserId': current_user.id,
                'createdByName': current_user.name,
                'status': 'queued',
                'phase': 'queued',
                'dealId': deal_id,
                'totalFiles': upload_count,
                'processedFiles': 0,
                'completedFiles': 0,
                'documentCount': 0,
                'failureCount': 0,
                'fieldSuggestionCount': 0,
                'sectionCount': 0,
                'usedOpenAi': bool(service.client is not None),
                'model': service.model if service.client is not None else '',
                'documents': [],
                'failedDocuments': [],
                'companyOverview': existing_company_overview,
                'companyResearch': existing_company_research,
                'currentFileIndex': 0,
                'currentFileName': '',
                'currentChunkCount': 0,
                'progressPct': 0,
            }
            self._jobs[run_id] = {
                'dealId': deal_id,
                'userId': current_user.id,
                'run': run,
                'deal': None,
                'errorMessage': '',
            }
            self._active_run_by_deal[deal_id] = run_id

        thread = threading.Thread(
            target=self._run_job,
            kwargs={
                'run_id': run_id,
                'deal_id': deal_id,
                'current_user': current_user.model_copy(deep=True),
                'uploads': uploads,
                'existing_intake': deepcopy(existing_intake) if isinstance(existing_intake, dict) else {},
                'store': store,
                'service': service,
            },
            daemon=True,
            name=f'document-extraction-{run_id}',
        )
        thread.start()
        return deepcopy(run)

    def get_job(self, deal_id: str, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(run_id)
            if not job or str(job.get('dealId') or '') != str(deal_id):
                return None
            return deepcopy(job)

    def _set_job_run(self, run_id: str, run_update: dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(run_id)
            if not job:
                return
            merged = deepcopy(job.get('run') or {})
            merged.update(deepcopy(run_update))
            total_files = int(merged.get('totalFiles') or 0)
            processed_files = int(merged.get('processedFiles') or 0)
            if total_files > 0:
                merged['progressPct'] = max(0, min(100, round((processed_files / total_files) * 100)))
            else:
                merged['progressPct'] = 0
            job['run'] = merged

    def _complete_job(self, run_id: str, *, run: dict[str, Any], deal: dict[str, Any] | None = None, error_message: str = '') -> None:
        with self._lock:
            job = self._jobs.get(run_id)
            if not job:
                return
            final_run = deepcopy(job.get('run') or {})
            final_run.update(deepcopy(run))
            final_run['progressPct'] = 100 if str(final_run.get('status') or '') in FINAL_STATUSES else int(final_run.get('progressPct') or 0)
            job['run'] = final_run
            job['deal'] = deepcopy(deal) if isinstance(deal, dict) else None
            job['errorMessage'] = error_message
            self._active_run_by_deal.pop(str(job.get('dealId') or ''), None)

    def _run_job(
        self,
        *,
        run_id: str,
        deal_id: str,
        current_user: User,
        uploads: list[BufferedUpload],
        existing_intake: dict[str, Any],
        store: JsonDealStore,
        service: DealDocumentIntakeService,
    ) -> None:
        total_files = len(uploads)

        def progress_callback(snapshot: dict[str, Any]) -> None:
            self._set_job_run(run_id, snapshot)

        try:
            result = asyncio.run(
                service.process_uploads(
                    deal_id,
                    current_user,
                    uploads,
                    existing_intake=existing_intake,
                    run_id=run_id,
                    progress_callback=progress_callback,
                )
            )
            deal = store.get_deal(current_user.id, deal_id)
            payload = deepcopy(deal.model_dump())
            latest_intake = payload.get('documentIntake') if isinstance(payload.get('documentIntake'), dict) else {}
            next_intake = service.merge_document_intake(latest_intake, result)
            payload['documentIntake'] = next_intake
            updated_deal = store.update_deal(current_user.id, deal_id, DealPayload.model_validate(payload))
            from .document_knowledge import knowledge
            knowledge_warning = ''
            try:
                knowledge.sync_portal(updated_deal.model_dump())
            except Exception:
                knowledge_warning = 'Extraction saved, but document search needs rebuilding from the copilot panel.'
            final_run = next_intake.get('latestRun', result) if isinstance(next_intake, dict) else result
            final_run = {
                **deepcopy(final_run),
                'totalFiles': total_files,
                'processedFiles': total_files,
                'completedFiles': len(result.get('documents') or []),
                'currentFileIndex': total_files,
                'currentFileName': '',
                'currentChunkCount': 0,
                'phase': 'completed',
                'knowledgeWarning': knowledge_warning,
            }
            self._complete_job(run_id, run=final_run, deal=updated_deal.model_dump())
        except Exception as error:
            existing_job = self.get_job(deal_id, run_id) or {}
            existing_run = existing_job.get('run') if isinstance(existing_job, dict) else {}
            failed_run = {
                **deepcopy(existing_run if isinstance(existing_run, dict) else {}),
                'id': run_id,
                'status': 'failed',
                'phase': 'failed',
                'processedFiles': int((existing_run or {}).get('processedFiles') or 0),
                'completedFiles': int((existing_run or {}).get('completedFiles') or 0),
                'failureCount': max(1, int((existing_run or {}).get('failureCount') or 0)),
                'currentFileName': '',
                'currentChunkCount': 0,
                'totalFiles': total_files,
            }
            self._complete_job(run_id, run=failed_run, error_message=str(error))
        finally:
            flush_langfuse()
