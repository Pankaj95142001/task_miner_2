import json
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, HTTPException
from pydantic import Field

from . import cleaner, workflow_vision as vision
from .schemas import Revision


class StartReview(Revision):
    retry: bool = False


class ApplyReview(Revision):
    review_id: str = Field(max_length=50)
    step_ids: list[UUID] = Field(default_factory=list, max_length=10000)
    fields: list[Literal['description', 'purpose', 'scope', 'prerequisites']] = Field(default_factory=list, max_length=4)


def register_workflow_vision_routes(api, settings, database, detail, require_stopped, check_version, touch):
    def process(workflow_id, job_id):
        with database.connect() as db:
            workflow = detail(db, workflow_id)
            review = vision.load_review(db, workflow_id)
        if not review or review['id'] != job_id:
            return

        def persist():
            with database.connect(write=True) as db:
                current = detail(db, workflow_id)
                saved = vision.load_review(db, workflow_id)
                if not saved or saved['id'] != job_id or saved['status'] != 'processing':
                    raise HTTPException(409, 'This review is no longer active.')
                require_stopped(current)
                check_version(current, review['basis_version'])
                vision.save_review(db, workflow_id, review)

        try:
            check_version(workflow, review['basis_version'])
            while review['progress'] < review['total']:
                # Check for external edits before another provider call, and again before saving it.
                persist()
                offset = review['progress']
                batch = workflow['steps'][offset:offset + vision.BATCH_SIZE]
                drafts, context = vision.review_batch(settings, workflow, batch, review['context_summary'])
                review['steps'].extend(drafts)
                review['context_summary'] = context
                review['progress'] += len(batch)
                persist()
            review['phase'] = 'overview'
            persist()
            review['overview'] = vision.review_overview(settings, workflow, review['context_summary'])
            review.update(status='ready', phase='complete')
            persist()
        except Exception as error:
            # Retain only the last committed batch. Never write any suggestions to the SOP here.
            with database.connect(write=True) as db:
                saved = vision.load_review(db, workflow_id)
                if not saved or saved['id'] != job_id or saved['status'] != 'processing':
                    return
                current = detail(db, workflow_id)
                stale = current['version'] != saved['basis_version'] or current['status'] == 'recording'
                message = ('The workflow changed during analysis. Start a new visual review.' if stale else
                    cleaner.cleanup_failure(error)['message'].replace('cleanup', 'visual review').replace(
                        'OPENAI_MODEL', 'OPENAI_VISION_MODEL (or OPENAI_MODEL)'))
                saved.update(status='stale' if stale else 'error', error=message)
                vision.save_review(db, workflow_id, saved)

    @api.post('/workflows/{workflow_id}/vision-review', status_code=202)
    def start(workflow_id: str, body: StartReview, tasks: BackgroundTasks):
        with database.connect(write=True) as db:
            workflow = detail(db, workflow_id)
            require_stopped(workflow); check_version(workflow, body.version)
            existing = vision.load_review(db, workflow_id)
            if existing and existing['status'] == 'processing':
                raise HTTPException(409, 'Visual review is already running.')
            if (workflow.get('narration') or {}).get('status') == 'processing':
                raise HTTPException(409, 'Wait for narration processing to finish before visual review.')
            if not settings.api_key:
                raise HTTPException(503, 'Configure OPENAI_API_KEY to use visual review. Your SOP is unchanged.')
            eligible = [s for s in workflow['steps'] if not vision.private(s)]
            if not eligible or not any((s.get(p) or {}).get('filename') for s in eligible for p in ('before', 'after')):
                raise HTTPException(422, 'At least one non-private step with saved screenshots is required.')
            model = settings.vision_model or settings.model
            if body.retry:
                if (not existing or existing['status'] != 'error' or existing['basis_version'] != workflow['version']
                        or existing['model'] != model):
                    raise HTTPException(409, 'The saved review cannot be resumed. Start a new visual review.')
                review = existing
                review.update(status='processing', error='')
            else:
                review = {'id': str(uuid4()), 'status': 'processing', 'phase': 'steps', 'error': '',
                    'created_at': datetime.now(timezone.utc).isoformat(), 'model': model,
                    'progress': 0, 'total': len(workflow['steps']), 'context_summary': '', 'steps': [],
                    'overview': None, 'applied_step_ids': [], 'applied_fields': [],
                    'skipped_step_ids': [s['id'] for s in workflow['steps'] if vision.private(s)]}
            touch(db, workflow_id)
            review['basis_version'] = workflow['version'] + 1
            vision.save_review(db, workflow_id, review)
            result = detail(db, workflow_id)
            tasks.add_task(process, workflow_id, review['id'])
            return result

    @api.patch('/workflows/{workflow_id}/vision-review')
    def apply(workflow_id: str, body: ApplyReview):
        with database.connect(write=True) as db:
            workflow = detail(db, workflow_id)
            require_stopped(workflow); check_version(workflow, body.version)
            review = vision.load_review(db, workflow_id)
            if not review or review['id'] != body.review_id or review['status'] != 'ready':
                raise HTTPException(409, 'Complete the visual review before applying suggestions.')
            check_version(workflow, review['basis_version'])
            if (workflow.get('narration') or {}).get('status') == 'processing':
                raise HTTPException(409, 'Wait for narration processing to finish.')
            ids = [str(i) for i in body.step_ids]
            drafts = {s['step_id']: s for s in review['steps']}
            available = {s['id'] for s in workflow['steps'] if not vision.private(s)} & set(drafts)
            if (not ids and not body.fields or len(ids) != len(set(ids)) or len(body.fields) != len(set(body.fields))
                    or not set(ids) <= available or set(ids) & set(review['applied_step_ids'])
                    or set(body.fields) & set(review['applied_fields'])):
                raise HTTPException(422, 'Choose unapplied suggestions belonging to this workflow.')
            for step_id in ids:
                draft = drafts[step_id]
                row = db.execute('SELECT payload FROM steps WHERE id=? AND workflow_id=?', (step_id, workflow_id)).fetchone()
                payload = json.loads(row['payload'])
                payload['sop_details'] = {k: draft[k] for k in vision.DETAIL_FIELDS}
                db.execute('UPDATE steps SET payload=?,description=?,reviewed=0,edited=1 WHERE id=? AND workflow_id=?',
                    (json.dumps(payload), draft['description'].strip(), step_id, workflow_id))
            for field in body.fields:
                # Field names are constrained by ApplyReview's Literal enum.
                db.execute(f'UPDATE workflows SET {field}=? WHERE id=?', (review['overview'][field].strip(), workflow_id))
            review['applied_step_ids'].extend(ids)
            review['applied_fields'].extend(body.fields)
            touch(db, workflow_id)
            review['basis_version'] = workflow['version'] + 1
            vision.save_review(db, workflow_id, review)
            return detail(db, workflow_id)
