from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..config import BACKEND_DIR, DOCUMENT_UPLOADS_DIR
from ..models import DealPayload, User
from ..observability import flush_langfuse, start_observation, update_observation
from ..services import DealDocumentIntakeService
from ..services.document_extraction_jobs import BufferedUpload, DocumentExtractionJobManager
from ..services.document_intake import (
    build_company_overview_snapshot,
    build_field_memory_summary,
    normalize_field_memory,
)
from ..services.document_intake_logic import build_logic_builder_snapshot
from ..storage import JsonDealStore, utc_now_iso
from ..services.document_knowledge import knowledge
from .dependencies import get_current_user, get_store

router = APIRouter(prefix='/deals', tags=['Deal Master Documents'])
service = DealDocumentIntakeService()
job_manager = DocumentExtractionJobManager()


def _trim_text(value: str | None, limit: int) -> str:
    text = str(value or '').strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + '...'


def _document_field_suggestion_count(document: dict) -> int:
    if not isinstance(document, dict):
        return 0
    raw_count = document.get('fieldSuggestionCount')
    if raw_count is not None:
        try:
            return max(0, int(raw_count))
        except (TypeError, ValueError):
            pass
    preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
    suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
    return len([item for item in suggestions if isinstance(item, dict)])


def _collect_document_section_keys(document: dict) -> set[str]:
    if not isinstance(document, dict):
        return set()
    preview = document.get('preview') if isinstance(document.get('preview'), dict) else {}
    suggestions = preview.get('fieldSuggestions') if isinstance(preview.get('fieldSuggestions'), list) else []
    section_keys: set[str] = set()
    for suggestion in suggestions:
        if not isinstance(suggestion, dict):
            continue
        tower = _trim_text(suggestion.get('tower') or '', 40)
        section = _trim_text(suggestion.get('section') or '', 80)
        if tower or section:
            section_keys.add(f'{tower}::{section}')
    if section_keys:
        return section_keys

    try:
        section_count = max(0, int(document.get('sectionCount') or 0))
    except (TypeError, ValueError):
        section_count = 0
    document_key = _trim_text(document.get('id') or document.get('fileName') or 'document', 80)
    return {f'{document_key}::section::{index}' for index in range(section_count)}


def _filter_company_research(company_research: dict | None, removed_file_name: str, updated_at: str) -> dict:
    if not isinstance(company_research, dict):
        return {}

    next_research = deepcopy(company_research)
    overview_fields = next_research.get('overviewFields') if isinstance(next_research.get('overviewFields'), list) else []
    next_research['overviewFields'] = [
        deepcopy(field)
        for field in overview_fields
        if isinstance(field, dict) and _trim_text(field.get('sourceFile') or '', 180) != removed_file_name
    ]
    sources = next_research.get('sources') if isinstance(next_research.get('sources'), list) else []
    next_research['sources'] = [deepcopy(source) for source in sources if isinstance(source, dict)]
    next_research['sourceCount'] = len(next_research['sources'])
    next_research['updatedAt'] = _trim_text(updated_at or next_research.get('updatedAt') or utc_now_iso(), 40)
    return next_research


def _rebuild_filtered_field_memory(
    existing_memory: dict | None,
    *,
    removed_document_id: str,
    removed_file_name: str,
    updated_at: str,
    run_id: str = '',
) -> dict:
    normalized = normalize_field_memory(existing_memory)
    next_entries: list[dict] = []

    for raw_entry in normalized.get('entries', []):
        if not isinstance(raw_entry, dict):
            continue

        raw_sources = raw_entry.get('sources') if isinstance(raw_entry.get('sources'), list) else []
        sources = [
            deepcopy(source)
            for source in raw_sources
            if isinstance(source, dict)
            and _trim_text(source.get('documentId') or '', 80) != removed_document_id
            and not (
                removed_file_name
                and not _trim_text(source.get('documentId') or '', 80)
                and _trim_text(source.get('fileName') or '', 180) == removed_file_name
            )
        ]
        if not sources:
            continue

        next_entry = deepcopy(raw_entry)
        primary_source = sources[0]
        proposed_values = [
            _trim_text(source.get('proposedValue') or '', 220)
            for source in sources
            if _trim_text(source.get('proposedValue') or '', 220)
        ]
        current_value = _trim_text(next_entry.get('currentValue') or '', 220)
        if not current_value or current_value not in proposed_values:
            next_entry['currentValue'] = _trim_text(primary_source.get('proposedValue') or '', 220)
            next_entry['currentConfidence'] = _trim_text(primary_source.get('confidence') or next_entry.get('currentConfidence') or 'Medium', 24)
            next_entry['currentRationale'] = _trim_text(
                primary_source.get('rationale') or 'Source removed; reset to the strongest remaining evidence.',
                220,
            )
            next_entry['status'] = 'suggested'

        if (
            _trim_text(next_entry.get('lastDocumentId') or '', 80) == removed_document_id
            or _trim_text(next_entry.get('lastSourceFile') or '', 180) == removed_file_name
        ):
            next_entry['lastDocumentId'] = _trim_text(primary_source.get('documentId') or '', 80)
            next_entry['lastSourceFile'] = _trim_text(primary_source.get('fileName') or '', 180)
            next_entry['lastSourceLocation'] = _trim_text(primary_source.get('sourceLocation') or '', 120)
            next_entry['lastEvidenceSnippet'] = _trim_text(primary_source.get('evidenceSnippet') or '', 260)

        next_entry['lastRunId'] = _trim_text(run_id or next_entry.get('lastRunId') or '', 80)
        next_entry['lastUpdatedAt'] = _trim_text(updated_at or next_entry.get('lastUpdatedAt') or '', 40)
        next_entry['sourceCount'] = len(sources)
        next_entry['suggestionCount'] = len(sources)
        next_entry['sources'] = sources[:8]
        next_entries.append(next_entry)

    next_entries.sort(
        key=lambda item: (
            str(item.get('tower') or ''),
            str(item.get('section') or ''),
            str(item.get('fieldLabel') or ''),
            str(item.get('memoryKey') or ''),
        )
    )

    return {
        'version': _trim_text(normalized.get('version') or 'v1', 24) or 'v1',
        'updatedAt': _trim_text(updated_at or normalized.get('updatedAt') or utc_now_iso(), 40),
        'lastRunId': _trim_text(run_id or normalized.get('lastRunId') or '', 80),
        'entries': next_entries,
        'summary': build_field_memory_summary(next_entries),
    }


def _remove_uploaded_file(relative_path: str) -> None:
    relative_value = _trim_text(relative_path or '', 320)
    if not relative_value:
        return

    candidate_path = Path(relative_value)
    resolved_path = candidate_path if candidate_path.is_absolute() else (BACKEND_DIR / candidate_path)
    try:
        resolved_path = resolved_path.resolve()
        uploads_root = DOCUMENT_UPLOADS_DIR.resolve()
    except OSError:
        return

    if uploads_root != resolved_path and uploads_root not in resolved_path.parents:
        return
    if not resolved_path.exists() or not resolved_path.is_file():
        return

    resolved_path.unlink(missing_ok=True)

    parent = resolved_path.parent
    while parent != uploads_root and uploads_root in parent.parents:
        try:
            parent.rmdir()
        except OSError:
            break
        parent = parent.parent


def _rebuild_latest_run(
    run: dict | None,
    *,
    run_documents: list[dict],
    logic_builder_summary: dict,
    memory_summary: dict,
    company_overview: dict | None = None,
    company_research: dict | None = None,
) -> dict | None:
    if not isinstance(run, dict):
        return None

    next_run = deepcopy(run)
    section_keys: set[str] = set()
    total_field_suggestions = 0
    for document in run_documents:
        total_field_suggestions += _document_field_suggestion_count(document)
        section_keys.update(_collect_document_section_keys(document))

    next_run['documents'] = deepcopy(run_documents)
    next_run['documentCount'] = len(run_documents)
    next_run['completedFiles'] = len(run_documents)
    next_run['fieldSuggestionCount'] = total_field_suggestions
    next_run['sectionCount'] = len(section_keys)
    next_run['memorySummary'] = deepcopy(memory_summary)
    next_run['logicBuilderSummary'] = deepcopy(logic_builder_summary)
    if company_overview:
        next_run['companyOverview'] = deepcopy(company_overview)
    else:
        next_run.pop('companyOverview', None)
    if company_research:
        next_run['companyResearch'] = deepcopy(company_research)
    else:
        next_run.pop('companyResearch', None)
    return next_run


@router.post('/{deal_id}/documents/extract', status_code=status.HTTP_202_ACCEPTED)
async def extract_deal_documents(
    deal_id: str,
    files: list[UploadFile] = File(...),
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    with start_observation(
        name='api.deals.documents.extract',
        as_type='span',
        input={
            'dealId': deal_id,
            'fileCount': len(files or []),
        },
        metadata={
            'userId': current_user.id,
            'userRole': current_user.role,
            'userEmail': current_user.email,
        },
    ) as api_span:
        try:
            deal = store.get_deal(current_user.id, deal_id)
            if str(deal.dealOwnerUserId or '') != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail='Only the deal owner can upload and extract Deal Master documents.',
                )

            payload = deepcopy(deal.model_dump())
            existing_intake = payload.get('documentIntake') if isinstance(payload.get('documentIntake'), dict) else {}
            buffered_uploads: list[BufferedUpload] = []
            for index, upload in enumerate(files or [], start=1):
                file_name = str(upload.filename or f'document-{index}').strip() or f'document-{index}'
                if not file_name:
                    continue
                file_bytes = await upload.read()
                buffered_uploads.append(
                    BufferedUpload(
                        filename=file_name,
                        content_type=str(upload.content_type or '').strip(),
                        file_bytes=file_bytes,
                    )
                )

            run = job_manager.start_job(
                deal_id=deal_id,
                current_user=current_user,
                uploads=buffered_uploads,
                existing_intake=existing_intake,
                store=store,
                service=service,
            )
            response = {'deal': deal.model_dump(), 'run': run}
            update_observation(
                api_span,
                output={
                    'runId': run['id'],
                    'status': run.get('status'),
                    'totalFiles': run.get('totalFiles'),
                    'usedOpenAi': run.get('usedOpenAi'),
                    'model': run.get('model'),
                },
            )
            return response
        except Exception as error:
            update_observation(api_span, level='ERROR', status_message=str(error))
            raise
        finally:
            flush_langfuse()


@router.get('/{deal_id}/documents/extract/{run_id}')
def get_deal_document_extraction_status(
    deal_id: str,
    run_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    deal = store.get_deal(current_user.id, deal_id)
    if str(deal.dealOwnerUserId or '') != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Only the deal owner can review live document extraction status.',
        )

    job = job_manager.get_job(deal_id, run_id)
    if job is not None:
        response = {'run': job.get('run') or {}}
        if isinstance(job.get('deal'), dict):
            response['deal'] = job['deal']
        if job.get('errorMessage'):
            response['errorMessage'] = job['errorMessage']
        return response

    deal_payload = deal.model_dump()
    document_intake = deal_payload.get('documentIntake') if isinstance(deal_payload.get('documentIntake'), dict) else {}
    latest_run = document_intake.get('latestRun') if isinstance(document_intake.get('latestRun'), dict) else {}
    if str(latest_run.get('id') or '') == str(run_id):
        return {'deal': deal_payload, 'run': latest_run}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Extraction run not found.')


@router.delete('/{deal_id}/documents/{document_id}')
def delete_deal_document(
    deal_id: str,
    document_id: str,
    store: JsonDealStore = Depends(get_store),
    current_user: User = Depends(get_current_user),
) -> dict:
    with start_observation(
        name='api.deals.documents.delete',
        as_type='span',
        input={
            'dealId': deal_id,
            'documentId': document_id,
        },
        metadata={
            'userId': current_user.id,
            'userRole': current_user.role,
            'userEmail': current_user.email,
        },
    ) as api_span:
        try:
            deal = store.get_deal(current_user.id, deal_id)
            if str(deal.dealOwnerUserId or '') != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail='Only the deal owner can delete extracted Deal Master documents.',
                )

            payload = deepcopy(deal.model_dump())
            document_intake = payload.get('documentIntake') if isinstance(payload.get('documentIntake'), dict) else {}
            stored_documents = document_intake.get('documents') if isinstance(document_intake.get('documents'), list) else []
            removed_document = next(
                (document for document in stored_documents if _trim_text(document.get('id') or '', 80) == document_id),
                None,
            )
            if not isinstance(removed_document, dict):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Document not found in extraction memory.')

            remaining_documents = [
                deepcopy(document)
                for document in stored_documents
                if _trim_text(document.get('id') or '', 80) != document_id
            ]
            latest_run = document_intake.get('latestRun') if isinstance(document_intake.get('latestRun'), dict) else {}
            latest_run_documents = latest_run.get('documents') if isinstance(latest_run.get('documents'), list) else []
            remaining_run_documents = [
                deepcopy(document)
                for document in latest_run_documents
                if _trim_text(document.get('id') or '', 80) != document_id
            ]

            updated_at = utc_now_iso()
            removed_file_name = _trim_text(removed_document.get('fileName') or '', 180)
            field_memory = _rebuild_filtered_field_memory(
                document_intake.get('fieldMemory') if isinstance(document_intake.get('fieldMemory'), dict) else {},
                removed_document_id=document_id,
                removed_file_name=removed_file_name,
                updated_at=updated_at,
                run_id=_trim_text(
                    latest_run.get('id')
                    or (document_intake.get('fieldMemory') or {}).get('lastRunId')
                    or (document_intake.get('logicBuilder') or {}).get('lastRunId')
                    or '',
                    80,
                ),
            )
            memory_summary = field_memory.get('summary') if isinstance(field_memory.get('summary'), dict) else build_field_memory_summary(field_memory.get('entries', []))
            company_research = _filter_company_research(
                document_intake.get('companyResearch') if isinstance(document_intake.get('companyResearch'), dict) else {},
                removed_file_name,
                updated_at,
            )
            company_overview = build_company_overview_snapshot(
                remaining_documents,
                company_research=company_research or None,
                updated_at=updated_at,
            )
            logic_builder = build_logic_builder_snapshot(
                remaining_documents,
                existing_logic_builder=None,
                normalized_field_memory=field_memory,
                run_id=_trim_text(latest_run.get('id') or '', 80),
                updated_at=updated_at,
            )
            logic_builder_summary = logic_builder.get('summary') if isinstance(logic_builder.get('summary'), dict) else {}
            next_run = _rebuild_latest_run(
                latest_run,
                run_documents=remaining_run_documents,
                logic_builder_summary=logic_builder_summary,
                memory_summary=memory_summary,
                company_overview=company_overview,
                company_research=company_research or None,
            )

            history = document_intake.get('history') if isinstance(document_intake.get('history'), list) else []
            if next_run and history:
                next_history = []
                for item in history:
                    if not isinstance(item, dict):
                        continue
                    if _trim_text(item.get('id') or '', 80) == _trim_text(next_run.get('id') or '', 80):
                        next_item = deepcopy(item)
                        next_item['documentCount'] = next_run.get('documentCount')
                        next_item['fieldSuggestionCount'] = next_run.get('fieldSuggestionCount')
                        next_item['sectionCount'] = next_run.get('sectionCount')
                        next_history.append(next_item)
                    else:
                        next_history.append(deepcopy(item))
                document_intake['history'] = next_history

            document_intake['documents'] = remaining_documents
            document_intake['fieldMemory'] = field_memory
            document_intake['logicBuilder'] = logic_builder
            if next_run is not None:
                document_intake['latestRun'] = next_run
            else:
                document_intake.pop('latestRun', None)
            if company_overview:
                document_intake['companyOverview'] = company_overview
            else:
                document_intake.pop('companyOverview', None)
            if company_research:
                document_intake['companyResearch'] = company_research
            else:
                document_intake.pop('companyResearch', None)

            payload['documentIntake'] = document_intake
            updated_deal = store.update_deal(current_user.id, deal_id, DealPayload(**payload))
            _remove_uploaded_file(removed_document.get('relativePath') or '')
            knowledge.delete(deal_id, document_id)

            response = {
                'deal': updated_deal.model_dump(),
                'deletedDocumentId': document_id,
            }
            if next_run is not None:
                response['run'] = next_run

            update_observation(
                api_span,
                output={
                    'deletedDocumentId': document_id,
                    'deletedFileName': removed_file_name,
                    'remainingDocumentCount': len(remaining_documents),
                    'latestRunDocumentCount': len(remaining_run_documents),
                    'fieldMemoryCount': int(memory_summary.get('fieldCount') or 0),
                    'logicBuilderFieldCount': int(logic_builder_summary.get('reviewFieldCount') or 0),
                },
            )
            return response
        except Exception as error:
            update_observation(api_span, level='ERROR', status_message=str(error))
            raise
        finally:
            flush_langfuse()
