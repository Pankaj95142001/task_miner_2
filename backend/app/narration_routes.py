import hashlib
import json
from datetime import datetime
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import AwareDatetime, Field

from . import cleaner, narration
from .schemas import Revision
from .workflow_delete import owned_path, uuid_name

MAX_AUDIO = 24_000_000


class ProcessNarration(Revision):
    segment_id: str | None = None


class EditSegment(Revision):
    transcript: str = Field(max_length=12000)
    step_ids: list[UUID] = Field(max_length=1000)


class AcceptSegment(Revision):
    apply_suggestions: bool = True


def register_narration_routes(api, settings, database, detail, require_stopped, check_version, touch):
    def read(db, workflow_id):
        value = narration.load_narration(db, workflow_id)
        if not value: raise HTTPException(404, 'No narration is saved for this workflow.')
        return value

    def editable(db, workflow_id, version):
        workflow = detail(db, workflow_id)
        require_stopped(workflow); check_version(workflow, version)
        value = read(db, workflow_id)
        if value['status'] == 'processing': raise HTTPException(409, 'Wait for narration processing to finish.')
        return workflow, value

    def group(value, segment_id):
        found = next((s for s in value.get('segments', []) if s['id'] == segment_id), None)
        if found is None: raise HTTPException(404, 'Narration segment not found.')
        return found

    @api.post('/workflows/{workflow_id}/narration/audio')
    async def upload(workflow_id: str, request: Request, started_at: AwareDatetime, duration: float = Query(gt=0, le=14400)):
        workflow_id = uuid_name(workflow_id)
        with database.connect() as db: require_stopped(detail(db, workflow_id))
        if request.headers.get('content-type', '').split(';')[0] != 'audio/webm':
            raise HTTPException(422, 'Record narration in an Edge or Chrome dashboard using WebM audio.')
        content = bytearray()
        async for chunk in request.stream():
            content.extend(chunk)
            if len(content) > MAX_AUDIO: raise HTTPException(413, 'Narration exceeds the 24 MB upload limit.')
        if len(content) < 8 or content[:4] != b'\x1aE\xdf\xa3':
            raise HTTPException(422, 'The narration is not a valid WebM recording.')
        digest = hashlib.sha256(content).hexdigest()
        path = owned_path(settings.data_dir, 'narration', workflow_id+'.webm')
        with database.connect(write=True) as db:
            require_stopped(detail(db, workflow_id))
            existing = narration.load_narration(db, workflow_id)
            if existing:
                if existing.get('audio_hash') == digest: return detail(db, workflow_id)
                raise HTTPException(409, 'Audio is already saved for this workflow; it was not overwritten.')
            path.parent.mkdir(exist_ok=True)
            try:
                path.write_bytes(content)
                narration.save_narration(db, workflow_id, {'status':'uploaded', 'error':'', 'started_at':started_at.isoformat(),
                    'duration':duration, 'audio_hash':digest, 'segments':[], 'transcribed':False, 'progress':0, 'total':0})
                touch(db, workflow_id)
            except Exception:
                path.unlink(missing_ok=True)
                raise
            return detail(db, workflow_id)

    @api.get('/workflows/{workflow_id}/narration/audio')
    def audio(workflow_id: str):
        with database.connect() as db: read(db, workflow_id)
        path = owned_path(settings.data_dir, 'narration', uuid_name(workflow_id)+'.webm')
        if not path.is_file(): raise HTTPException(404, 'Saved audio is missing.')
        return FileResponse(path, media_type='audio/webm', headers={'Cache-Control':'no-store'})

    def process_job(workflow_id, expected_version, segment_id):
        with database.connect() as db:
            workflow = detail(db, workflow_id); value = read(db, workflow_id)
        def persist(final=False):
            with database.connect(write=True) as db:
                current = detail(db, workflow_id)
                require_stopped(current); check_version(current, expected_version)
                narration.save_narration(db, workflow_id, value)
                if final: touch(db, workflow_id)
        try:
            if not value.get('transcribed'):
                path = owned_path(settings.data_dir, 'narration', uuid_name(workflow_id)+'.webm')
                words = narration.transcribe(settings, path)
                value['segments'] = narration.split_segments(words, value['started_at'], value['duration'], workflow['steps'])
                value['transcribed'] = True
                persist()
            selected = [s for s in value['segments'] if s['id'] == segment_id] if segment_id else [s for s in value['segments'] if not s.get('confirmed')]
            by_id = {s['id']:s for s in workflow['steps']}
            value['total'] = len(selected); value['progress'] = 0
            for segment in selected:
                steps = [by_id[i] for i in segment['step_ids'] if i in by_id]
                segment['comparison'] = narration.compare_segment(settings, segment, steps)
                segment['basis'] = narration.evidence_hash(steps)
                segment['confirmed'] = False
                value['progress'] += 1
                persist()
            value.update(status='ready', error='')
            persist(final=True)
        except Exception as exc:
            # Persist completed transcript/comparisons for retry; never expose provider response bodies.
            failure = cleaner.cleanup_failure(exc)
            message = 'Workflow changed during narration processing. Refresh and compare again.' if isinstance(exc, HTTPException) else failure['message']
            with database.connect(write=True) as db:
                if narration.load_narration(db, workflow_id):
                    value.update(status='error', error=message)
                    narration.save_narration(db, workflow_id, value)
                    touch(db, workflow_id)

    @api.post('/workflows/{workflow_id}/narration/process')
    def process(workflow_id: str, body: ProcessNarration, tasks: BackgroundTasks):
        if not settings.api_key: raise HTTPException(503, 'Configure OPENAI_API_KEY to transcribe and compare narration. Your audio remains saved locally.')
        with database.connect(write=True) as db:
            workflow, value = editable(db, workflow_id, body.version)
            if body.segment_id: group(value, body.segment_id)
            value.update(status='processing', error='', progress=0, total=0)
            narration.save_narration(db, workflow_id, value); touch(db, workflow_id)
            result = detail(db, workflow_id)
            tasks.add_task(process_job, workflow_id, result['version'], body.segment_id)
            return result

    @api.patch('/workflows/{workflow_id}/narration/segments/{segment_id}')
    def edit(workflow_id: str, segment_id: str, body: EditSegment):
        with database.connect(write=True) as db:
            workflow, value = editable(db, workflow_id, body.version)
            segment = group(value, segment_id)
            ids = [str(i) for i in body.step_ids]
            assigned = {i for s in value['segments'] if s['id'] != segment_id for i in s['step_ids']}
            if len(set(ids)) != len(ids) or not set(ids) <= {s['id'] for s in workflow['steps']} or set(ids) & assigned:
                raise HTTPException(422, 'Choose unique workflow actions not assigned to another narration segment.')
            ids = [s['id'] for s in workflow['steps'] if s['id'] in ids]
            segment.update(transcript=body.transcript.strip(), step_ids=ids, comparison=None, confirmed=False)
            value.update(status='ready', error='')
            narration.save_narration(db, workflow_id, value); touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.post('/workflows/{workflow_id}/narration/segments/{segment_id}/accept')
    def accept(workflow_id: str, segment_id: str, body: AcceptSegment):
        with database.connect(write=True) as db:
            workflow, value = editable(db, workflow_id, body.version)
            segment = group(value, segment_id)
            by_id = {s['id']:s for s in workflow['steps']}
            steps = [by_id[i] for i in segment['step_ids'] if i in by_id]
            if not segment.get('comparison') or segment.get('basis') != narration.evidence_hash(steps):
                raise HTTPException(409, 'Captured evidence changed or comparison is missing. Compare this segment again.')
            if any(s.get('sensitive') or s.get('text_capture') == 'protected' for s in steps):
                raise HTTPException(422, 'Private actions cannot use narration enrichment. Edit them manually.')
            if not steps: raise HTTPException(422, 'Assign captured actions before accepting narration.')
            suggestions = segment['comparison']['suggestions']
            if body.apply_suggestions and not suggestions:
                raise HTTPException(422, 'There are no instruction suggestions. Correct the transcript and compare again.')
            if body.apply_suggestions:
                if [s['step_id'] for s in suggestions] != [s['id'] for s in steps]:
                    raise HTTPException(409, 'The action assignment changed. Compare again.')
                for suggestion in suggestions:
                    row = db.execute('SELECT payload FROM steps WHERE id=? AND workflow_id=?', (suggestion['step_id'], workflow_id)).fetchone()
                    payload = json.loads(row['payload'])
                    payload.pop('sop_details', None)
                    payload['narration_details'] = {k:suggestion[k] for k in ('purpose','expected_result','validation','notes')}
                    db.execute('UPDATE steps SET payload=?,description=?,reviewed=0,edited=1 WHERE id=? AND workflow_id=?',
                        (json.dumps(payload), suggestion['description'].strip(), suggestion['step_id'], workflow_id))
            segment['confirmed'] = True
            narration.save_narration(db, workflow_id, value); touch(db, workflow_id)
            return detail(db, workflow_id)
