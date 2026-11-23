import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from pydantic import Field

from . import cleaner, vision
from .schemas import Revision


class ApplyVision(Revision):
    suggestion_id: str = Field(max_length=50)
    use_description: bool = True
    use_selector: bool = True
    confirmed_value: str | None = Field(default=None, max_length=2000)


def register_vision_routes(api, settings, database, detail, require_stopped, check_version, touch):
    def find_step(workflow, step_id):
        step = next((s for s in workflow['steps'] if s['id'] == step_id), None)
        if not step:
            raise HTTPException(404, 'Step not found.')
        return step

    @api.post('/workflows/{workflow_id}/steps/{step_id}/vision')
    def analyze(workflow_id: str, step_id: str, body: Revision):
        with database.connect() as db:
            current = detail(db, workflow_id)
        require_stopped(current); check_version(current, body.version)
        step = find_step(current, step_id)
        if step.get('sensitive') or step.get('text_capture') == 'protected':
            raise HTTPException(422, 'Vision review supports non-private steps only.')
        if not settings.api_key:
            raise HTTPException(503, 'Configure OPENAI_API_KEY to use visual review. Manual editing remains available.')
        try:
            result = vision.review_step(settings, step, current)
        except vision.NoVisionImages as error:
            raise HTTPException(422, str(error)) from None
        except Exception as error:
            failure = cleaner.cleanup_failure(error)
            logging.getLogger(__name__).warning('OpenAI vision failed: %s', failure['reason'])
            message = failure['message'].replace('OPENAI_MODEL', 'OPENAI_VISION_MODEL (or OPENAI_MODEL)').replace('cleanup', 'visual review')
            raise HTTPException(503, message) from None
        suggestion = {**result, 'id': str(uuid4()), 'created_at': datetime.now(timezone.utc).isoformat(),
                      'basis_description': step['description'], 'basis_selector': step.get('selector', ''),
                      'basis_value': step.get('value', ''), 'context_version': current['version'] + 1, 'applied': False}
        with database.connect(write=True) as db:
            current = detail(db, workflow_id)
            require_stopped(current); check_version(current, body.version)
            row = db.execute('SELECT payload FROM steps WHERE id=? AND workflow_id=?', (step_id, workflow_id)).fetchone()
            payload = json.loads(row['payload']); payload['vision'] = suggestion
            db.execute('UPDATE steps SET payload=? WHERE id=?', (json.dumps(payload), step_id))
            touch(db, workflow_id)
            return detail(db, workflow_id)

    @api.patch('/workflows/{workflow_id}/steps/{step_id}/vision')
    def apply(workflow_id: str, step_id: str, body: ApplyVision):
        with database.connect(write=True) as db:
            current = detail(db, workflow_id)
            require_stopped(current); check_version(current, body.version)
            step = find_step(current, step_id)
            suggestion = step.get('vision') or {}
            if step.get('sensitive') or not suggestion or suggestion.get('id') != body.suggestion_id or suggestion.get('applied'):
                raise HTTPException(409, 'Analyze this step again before applying its suggestion.')
            if suggestion.get('context_version', current['version']) != current['version']:
                raise HTTPException(409, 'The workflow context changed. Analyze this step again.')
            if suggestion['basis_description'] != step['description'] or suggestion['basis_selector'] != step.get('selector', ''):
                raise HTTPException(409, 'The instruction or selector changed. Analyze this step again.')
            selector = suggestion.get('selector', '') if body.use_selector else ''
            candidates = (step.get('browser_target') or {}).get('candidates', [])
            if selector and (suggestion.get('confidence') != 'high' or selector not in {c['selector'] for c in candidates}):
                raise HTTPException(422, 'The suggested selector is not supported by captured target evidence.')
            if body.confirmed_value is not None:
                if (step['action'] != 'input' or step.get('text_capture') == 'protected'
                        or (step.get('value') and step.get('text_capture') != 'truncated')):
                    raise HTTPException(422, 'Only missing or truncated non-private input can be recovered.')
            if not body.use_description and not selector and body.confirmed_value is None:
                raise HTTPException(422, 'Choose an instruction or supported selector to apply.')
            row = db.execute('SELECT payload FROM steps WHERE id=?', (step_id,)).fetchone()
            payload = json.loads(row['payload'])
            if selector: payload['selector'] = selector
            if body.confirmed_value is not None:
                payload['value_recovery'] = {'original_value': step.get('value', ''),
                    'original_text_capture': step.get('text_capture'), 'suggestion_id': suggestion['id'],
                    'confirmed_value': body.confirmed_value}
                payload['value'] = body.confirmed_value
                payload['text_capture'] = 'captured'
            payload['vision']['applied'] = True
            description = suggestion['description'].strip() if body.use_description else step['description']
            if body.confirmed_value is not None:
                label = step.get('label') or 'the text field'
                description = f'Enter {json.dumps(body.confirmed_value, ensure_ascii=False)} in {label}.' if body.confirmed_value else f'Clear {label}.'
            db.execute('UPDATE steps SET payload=?,description=?,reviewed=0,edited=1 WHERE id=?', (json.dumps(payload), description, step_id))
            touch(db, workflow_id)
            return detail(db, workflow_id)
