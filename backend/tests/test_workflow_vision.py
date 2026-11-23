import json
from io import BytesIO
from types import SimpleNamespace
from zipfile import ZipFile
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import DefaultHttpxClient

from backend.app import workflow_vision as vision
from backend.app.config import Settings
from backend.app.main import create_app
from backend.tests.test_workflows import step, recording, verify


@pytest.fixture
def client(tmp_path):
    settings = Settings(tmp_path, 'whole-vision-test-token', 'fixture-key', vision_model='vision-fixture')
    with TestClient(create_app(settings), headers={'Authorization': 'Bearer ' + settings.token}) as api:
        yield api


@pytest.fixture
def provider(monkeypatch):
    state = SimpleNamespace(seen=[], fail_at=None, corrupt=False, hook=None)
    def respond(request):
        payload = json.loads(request.content)
        state.seen.append(payload)
        if state.hook:
            hook, state.hook = state.hook, None
            hook()
        if len(state.seen) == state.fail_at:
            return httpx.Response(429, json={'error': {'code': 'rate_limit_exceeded', 'message': 'fixture'}})
        if payload['text']['format']['name'] == 'BatchDraft':
            inputs = json.loads(payload['input'][1]['content'][0]['text'])
            output = {'context_summary': 'Employee lookup: input ID then search. A result is visible.', 'steps': [
                {'step_id': s['id'] if not state.corrupt else 'wrong-id', 'description': 'Select Search to find the employee.',
                 'purpose': 'Find the employee.', 'expected_result': 'Matching records should appear.',
                 'validation': 'Check the displayed employee ID.', 'notes': '',
                 'evidence': s['id'] + ' before screenshot shows the control.', 'warning': ''}
                for s in inputs['batch'] if not s.get('private')]}
        else:
            output = {'description': 'Look up an employee record.', 'purpose': 'Find an employee.',
                      'scope': 'From opening Search to viewing the result.',
                      'prerequisites': 'Have the employee ID ready.', 'warning': ''}
        return httpx.Response(200, json={'id': 'resp_fixture', 'object': 'response', 'created_at': 1,
            'model': 'vision-fixture', 'status': 'completed', 'output': [{'id': 'msg_fixture', 'type': 'message',
            'role': 'assistant', 'status': 'completed', 'content': [{'type': 'output_text', 'annotations': [],
            'text': json.dumps(output)}]}]})
    def http_client(**kwargs):
        assert kwargs['verify'].check_hostname
        return DefaultHttpxClient(**kwargs, transport=httpx.MockTransport(respond))
    monkeypatch.setattr(vision, 'DefaultHttpxClient', http_client)
    return state


def stopped(client, count=1, **kwargs):
    w = recording(client, count, **kwargs)
    return client.post('/api/workflows/' + w['id'] + '/stop').json()


def start(client, w, **body):
    path = '/api/workflows/' + w['id']
    response = client.post(path + '/vision-review', json={'version': w['version'], **body})
    assert response.status_code == 202, response.text
    return client.get(path).json()


def apply(client, w, **body):
    return client.patch('/api/workflows/' + w['id'] + '/vision-review', json={
        'version': w['version'], 'review_id': w['vision_review']['id'], **body})


def test_all_images_in_order_preview_partial_apply_exports_and_delete(client, provider):
    w = client.post('/api/workflows', json={'title': 'Employee lookup', 'recording_context': 'Look up an employee using their ID.'}).json()
    path = '/api/workflows/' + w['id']
    for i in range(1, 8):
        changes = {'action': 'input', 'value': '00123'} if i == 1 else {}
        if i == 2: changes.update(sensitive=True, page_title='DO-NOT-SEND-PRIVATE')
        if i == 7: changes.update(before={}, after={})
        assert client.post(path + '/steps', json=step(i, **changes)).status_code == 201
    original = client.post(path + '/stop').json()
    w = start(client, original)
    review = w['vision_review']
    assert review['status'] == 'ready' and review['progress'] == 7
    assert len(review['steps']) == 6 and len(review['skipped_step_ids']) == 1
    assert w['steps'] == original['steps'] and w['purpose'] == ''
    assert len(provider.seen) == 3  # Two image batches followed by overview synthesis.
    assert all(json.loads(p['input'][1]['content'][0]['text'])['recording_context'] == original['recording_context'] for p in provider.seen)
    assert all(original['recording_context'] not in p['input'][0]['content'] for p in provider.seen)
    assert all(p['model'] == 'vision-fixture' and p['store'] is False for p in provider.seen)
    assert all(p['text']['format']['strict'] is True for p in provider.seen)
    assert 'DO-NOT-SEND-PRIVATE' not in json.dumps(provider.seen)
    assert 'secret=123' not in json.dumps(provider.seen)
    images = [c for p in provider.seen for c in p['input'][1]['content'] if c['type'] == 'input_image']
    assert len(images) == 10
    labels = [json.loads(c['text']) for p in provider.seen[:2] for c in p['input'][1]['content']
              if c['type'] == 'input_text' and c['text'].startswith('{') and '"phase"' in c['text']]
    assert [(s['step_id'], s['phase']) for s in labels] == [
        (s['id'], phase) for s in original['steps'] if not s['sensitive'] and s['before']['filename']
        for phase in ('before', 'after')]
    assert '00123' in review['steps'][0]['description']  # Model omitted it; deterministic preservation.
    assert 'Missing before and after' in review['steps'][-1]['warning']
    first_id = review['steps'][0]['step_id']
    w = apply(client, w, step_ids=[first_id]).json()
    assert w['steps'][0]['value'] == '00123' and not w['steps'][0]['reviewed']
    assert apply(client, w, step_ids=[first_id]).status_code == 422
    assert apply(client, w, step_ids=[str(uuid4())]).status_code == 422
    remaining = [s['step_id'] for s in review['steps'] if s['step_id'] != first_id]
    result = apply(client, w, step_ids=remaining, fields=list(vision.OVERVIEW_FIELDS))
    assert result.status_code == 200, result.text
    w = result.json()
    assert w['purpose'] == 'Find an employee.'
    assert w['recording_context'] == original['recording_context']
    for old, new in zip(original['steps'], w['steps']):
        for key in ('id', 'sequence', 'action', 'value', 'selector', 'before', 'after'):
            assert old[key] == new[key]
    assert w['steps'][1] == original['steps'][1]
    w = verify(client, w)
    docx = client.get(path + '/export/docx')
    with ZipFile(BytesIO(docx.content)) as archive:
        xml = archive.read('word/document.xml').decode()
    assert 'Check the displayed employee ID.' not in xml
    assert 'Expected result:' not in xml
    assert client.get(path + '/export/pdf').content.startswith(b'%PDF')
    assert client.delete(path, params={'version': w['version']}).status_code == 200
    with client.app.state.database.connect() as db:
        assert vision.load_review(db, w['id']) is None


def test_failed_batch_resumes_without_repeating_completed_images(client, provider):
    original = stopped(client, count=6)
    provider.fail_at = 2
    w = start(client, original)
    review = w['vision_review']
    assert review['status'] == 'error' and review['progress'] == 5 and len(review['steps']) == 5
    assert w['steps'] == original['steps']
    assert apply(client, w, step_ids=[original['steps'][0]['id']]).status_code == 409
    w = start(client, w, retry=True)
    assert w['vision_review']['status'] == 'ready'
    assert len(w['vision_review']['steps']) == 6
    assert len(provider.seen) == 4
    assert json.loads(provider.seen[2]['input'][1]['content'][0]['text'])['batch'][0]['id'] == original['steps'][5]['id']


def test_external_edits_invalidate_analysis_and_ready_suggestions(client, provider):
    original = stopped(client)
    path = '/api/workflows/' + original['id']
    def edit_during_call():
        latest = client.get(path).json()
        result = client.patch(path, json={'version': latest['version'], 'title': 'Updated title'})
        assert result.status_code == 200
    provider.hook = edit_during_call
    w = start(client, original)
    assert w['vision_review']['status'] == 'stale'
    assert w['title'] == 'Updated title' and w['steps'] == original['steps']
    assert len(provider.seen) == 1
    w = start(client, w)
    w = client.patch(path, json={'version': w['version'], 'title': w['title'], 'recording_context': 'Changed intent after analysis'}).json()
    assert apply(client, w, fields=['purpose']).status_code == 409
    assert w['purpose'] == ''


def test_validation_auth_private_and_recording_guards(client, provider):
    w = recording(client)
    path = '/api/workflows/' + w['id'] + '/vision-review'
    assert client.post(path, json={'version': w['version']}).status_code == 409
    assert client.post(path, headers={'Authorization': ''}, json={'version': w['version']}).status_code == 401
    for kwargs in ({'sensitive': True}, {'before': {}, 'after': {}}):
        w = stopped(client, **kwargs)
        assert client.post('/api/workflows/' + w['id'] + '/vision-review', json={'version': w['version']}).status_code == 422
    w = stopped(client)
    client.app.state.settings.api_key = ''
    assert client.post('/api/workflows/' + w['id'] + '/vision-review', json={'version': w['version']}).status_code == 503
    assert not provider.seen


def test_invalid_model_result_preserves_sop_and_saved_progress(client, provider):
    provider.corrupt = True
    original = stopped(client)
    w = start(client, original)
    assert w['vision_review']['status'] == 'error' and w['vision_review']['progress'] == 0
    assert w['vision_review']['steps'] == [] and w['steps'] == original['steps']


def test_inflight_duplicate_delete_and_restart_recovery(client, provider, monkeypatch):
    from fastapi import BackgroundTasks
    monkeypatch.setattr(BackgroundTasks, 'add_task', lambda *_args, **_kwargs: None)
    w = start(client, stopped(client))
    path = '/api/workflows/' + w['id']
    assert w['vision_review']['status'] == 'processing'
    assert client.post(path + '/vision-review', json={'version': w['version']}).status_code == 409
    assert client.delete(path, params={'version': w['version']}).status_code == 409
    create_app(client.app.state.settings)
    w = client.get(path).json()
    assert w['vision_review']['status'] == 'error' and 'interrupted' in w['vision_review']['error']
    assert not provider.seen


def test_unknown_and_truncated_input_never_gets_invented_text(client, provider):
    original = stopped(client, action='input', value='partial', text_capture='truncated')
    w = start(client, original)
    assert w['vision_review']['steps'][0]['description'] == original['steps'][0]['description']
    assert 'incomplete' in w['vision_review']['steps'][0]['warning']


def test_missing_image_file_is_visible_in_review(client, provider):
    w = stopped(client)
    filename = w['steps'][0]['before']['filename']
    (client.app.state.settings.data_dir / 'screenshots' / filename).unlink()
    w = start(client, w)
    assert w['vision_review']['status'] == 'ready'
    assert w['vision_review']['steps'][0]['image_phases'] == ['after']
    assert 'Missing before screenshot' in w['vision_review']['steps'][0]['warning']
