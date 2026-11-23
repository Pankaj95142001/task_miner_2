import base64
from datetime import datetime, timezone
from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.schemas import CleanStep


@pytest.fixture
def client(tmp_path):
    settings = Settings(tmp_path, 'a-test-session-token')
    with TestClient(create_app(settings), headers={'Authorization': f'Bearer {settings.token}'}) as client:
        yield client


def step(sequence=1, **kwargs):
    image = BytesIO()
    Image.new('RGB', (640, 400), '#dcebd2').save(image, 'PNG')
    shot = {'data_url': 'data:image/png;base64,' + base64.b64encode(image.getvalue()).decode(),
            'captured_at': datetime.now(timezone.utc).isoformat(), 'url': 'https://example.org'}
    return {'id': str(uuid4()), 'sequence': sequence, 'action': 'click',
            'occurred_at': datetime.now(timezone.utc).isoformat(), 'tab_id': sequence,
            'url': 'https://example.org/task?secret=123', 'page_title': 'Example',
            'label': 'Save', 'selector': '#save', 'before': shot, 'after': shot, **kwargs}


def recording(client, count=1, **kwargs):
    workflow = client.post('/api/workflows', json={'title': 'Create a workspace'}).json()
    for i in range(1, count + 1):
        assert client.post(f'/api/workflows/{workflow["id"]}/steps', json=step(i, **kwargs)).status_code == 201
    return client.get(f'/api/workflows/{workflow["id"]}').json()


def verify(client, workflow):
    for item in workflow['steps']:
        response = client.patch(f'/api/workflows/{workflow["id"]}/steps/{item["id"]}', json={
            'description': item['description'], 'reviewed': True, 'version': workflow['version']})
        assert response.status_code == 200, response.text
        workflow = response.json()
    return workflow


def test_auth_protects_data_and_images(client):
    assert client.get('/health', headers={'Authorization': ''}).status_code == 200
    assert client.get('/api/workflows', headers={'Authorization': ''}).status_code == 401
    w = recording(client)
    path = f'/api/workflows/{w["id"]}/steps/{w["steps"][0]["id"]}/screenshots/before'
    assert client.get(path, headers={'Authorization': ''}).status_code == 401
    assert client.get(path).headers['content-type'] == 'image/jpeg'


def test_end_to_end_review_and_exports(client):
    point = {'x': 12.5, 'y': 20, 'page_x': 12.5, 'page_y': 420, 'scroll_x': 0, 'scroll_y': 400,
             'viewport_width': 1280, 'viewport_height': 900, 'device_pixel_ratio': 2}
    w = recording(client, 2, coordinates=point)
    path = f'/api/workflows/{w["id"]}'
    assert w['steps'][0]['url'] == 'https://example.org/task'
    assert [s['tab_id'] for s in w['steps']] == [1, 2]
    assert w['steps'][0]['coordinates'] == point
    assert client.get(path + '/export/pdf').status_code == 409
    w = client.post(path + '/stop').json()
    assert client.get(path + '/export/pdf').status_code == 409
    w = verify(client, w)
    pdf = client.get(path + '/export/pdf')
    assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF')
    assert 'filename="Create a workspace.pdf"' in pdf.headers['content-disposition']
    docx = client.get(path + '/export/docx')
    assert docx.status_code == 200
    assert 'filename="Create a workspace.docx"' in docx.headers['content-disposition']
    with ZipFile(BytesIO(docx.content)) as archive:
        xml = archive.read('word/document.xml').decode()
        assert 'Click Save.' in xml and 'Before' in xml and 'After' in xml
        assert 'Click position:' not in xml
        assert 'Page: X=' not in xml and 'device pixel ratio:' not in xml
        assert any(name.startswith('word/media/') for name in archive.namelist())
    # Editing a verified instruction returns it to review by default.
    edited = client.patch(path + f'/steps/{w["steps"][0]["id"]}', json={'description': 'Choose Save.', 'version': w['version']})
    assert edited.status_code == 200
    assert edited.json()['steps'][0]['coordinates'] == point
    assert client.get(path + '/export/pdf').status_code == 409


@pytest.mark.parametrize('invalid', [{'x': -1}, {'y': 'NaN'}, {'viewport_width': 0}, {'device_pixel_ratio': 'Infinity'}])
def test_reject_invalid_coordinates_without_saving_a_step(client, invalid):
    w = client.post('/api/workflows', json={'title': 'Validate coordinates'}).json()
    point = {'x': 0, 'y': 0, 'page_x': 0, 'page_y': 0, 'scroll_x': 0, 'scroll_y': 0,
             'viewport_width': 1280, 'viewport_height': 900, 'device_pixel_ratio': 1, **invalid}
    path = f'/api/workflows/{w["id"]}'
    assert client.post(path + '/steps', json=step(coordinates=point)).status_code == 422
    assert client.get(path).json()['steps'] == []


def test_old_recordings_without_coordinates_still_export(client):
    w = recording(client)
    path = f'/api/workflows/{w["id"]}'
    # A pre-upgrade payload has no coordinates key at all.
    import json
    with client.app.state.database.connect(write=True) as db:
        row = db.execute('SELECT payload FROM steps WHERE id=?', (w['steps'][0]['id'],)).fetchone()
        payload = json.loads(row['payload'])
        payload.pop('coordinates', None)
        db.execute('UPDATE steps SET payload=? WHERE id=?', (json.dumps(payload), w['steps'][0]['id']))
    w = verify(client, client.post(path + '/stop').json())
    assert 'coordinates' not in w['steps'][0]
    assert client.get(path + '/export/pdf').status_code == 200
    with ZipFile(BytesIO(client.get(path + '/export/docx').content)) as archive:
        assert 'Click position:' not in archive.read('word/document.xml').decode()


def test_idempotent_retry_and_sequence_conflict(client):
    w = client.post('/api/workflows', json={'title': 'Retry'}).json()
    path = f'/api/workflows/{w["id"]}'
    event = step()
    assert client.post(path + '/steps', json=event).json()['duplicate'] is False
    assert client.post(path + '/steps', json=event).json()['duplicate'] is True
    assert client.post(path + '/steps', json=step()).status_code == 409
    client.post(path + '/stop')
    assert client.post(path + '/steps', json=event).json()['duplicate'] is True
    assert client.post(path + '/steps', json=step(2)).status_code == 409
    assert len(client.get(path).json()['steps']) == 1


def test_conflict_reorder_and_delete(client):
    w = recording(client, 3)
    path = f'/api/workflows/{w["id"]}'
    w = client.post(path + '/stop').json()
    w = verify(client, w)
    ids = [s['id'] for s in w['steps']][::-1]
    stale = client.post(path + '/reorder', json={'step_ids': ids, 'version': 1})
    assert stale.status_code == 409
    result = client.post(path + '/reorder', json={'step_ids': ids, 'version': w['version']})
    assert result.status_code == 200
    w = result.json()
    assert [s['id'] for s in w['steps']] == ids
    assert not any(s['reviewed'] for s in w['steps'])
    result = client.delete(path + f'/steps/{ids[0]}?version={w["version"]}')
    assert result.status_code == 200 and len(result.json()['steps']) == 2
    assert client.get(path + f'/steps/{ids[0]}/screenshots/before').status_code == 404


def test_sensitive_values_never_persist(client):
    w = client.post('/api/workflows', json={'title': 'Private field'}).json()
    path = f'/api/workflows/{w["id"]}'
    event = step(action='input', sensitive=True, value='never-save-this', label='secret')
    assert client.post(path + '/steps', json=event).status_code == 201
    item = client.get(path).json()['steps'][0]
    assert item['value'] == '' and 'never-save-this' not in str(item)


def test_cleanup_missing_key_and_provider_error_preserve_steps(client, monkeypatch):
    w = recording(client)
    path = f'/api/workflows/{w["id"]}'
    w = client.post(path + '/stop').json()
    result = client.post(path + '/clean', json={'version': w['version']}).json()
    assert result['mode'] == 'fallback' and result['workflow'] == w
    client.app.state.settings.api_key = 'test-key'
    def fail(*_):
        raise RuntimeError('provider unavailable')
    monkeypatch.setattr('backend.app.cleaner.clean_steps', fail)
    result = client.post(path + '/clean', json={'version': w['version']}).json()
    assert result['mode'] == 'fallback' and client.get(path).json() == w


def test_cleanup_preserves_manual_and_verified_text(client, monkeypatch):
    w = recording(client, 3)
    path = f'/api/workflows/{w["id"]}'
    w = client.post(path + '/stop').json()
    w = client.patch(path + f'/steps/{w["steps"][0]["id"]}', json={'description': 'My own wording', 'version': w['version']}).json()
    w = client.patch(path + f'/steps/{w["steps"][1]["id"]}', json={'description': w['steps'][1]['description'], 'reviewed': True, 'version': w['version']}).json()
    client.app.state.settings.api_key = 'test-key'
    def clean(_settings, steps, recording_context):
        assert len(steps) == 1
        return [CleanStep(id=steps[0]['id'], description='Select Save to continue.')]
    monkeypatch.setattr('backend.app.cleaner.clean_steps', clean)
    result = client.post(path + '/clean', json={'version': w['version']}).json()
    assert result['mode'] == 'openai'
    assert [s['description'] for s in result['workflow']['steps']] == ['My own wording', 'Click Save.', 'Select Save to continue.']


def test_invalid_image_leaves_no_partial_step(client):
    w = client.post('/api/workflows', json={'title': 'Invalid image'}).json()
    event = step(after={'data_url': 'data:image/png;base64,not-valid'})
    assert client.post(f'/api/workflows/{w["id"]}/steps', json=event).status_code == 422
    assert not list((client.app.state.settings.data_dir / 'screenshots').iterdir())
    assert client.get(f'/api/workflows/{w["id"]}').json()['steps'] == []


def test_empty_and_blank_workflows(client):
    assert client.post('/api/workflows', json={'title': '  '}).status_code == 422
    w = client.post('/api/workflows', json={'title': 'Empty'}).json()
    client.post(f'/api/workflows/{w["id"]}/stop')
    assert client.get(f'/api/workflows/{w["id"]}/export/pdf').status_code == 409


def test_stop_orders_delayed_events_by_occurrence_time(client):
    w = client.post('/api/workflows', json={'title': 'Across tabs'}).json()
    path = f'/api/workflows/{w["id"]}'
    second = step(1, occurred_at='2026-10-05T10:00:02Z', tab_id=2)
    first = step(2, occurred_at='2026-10-05T10:00:01Z', action='input', tab_id=1)
    client.post(path + '/steps', json=second)
    client.post(path + '/steps', json=first)
    stopped = client.post(path + '/stop').json()
    assert [s['id'] for s in stopped['steps']] == [first['id'], second['id']]
    assert [s['sequence'] for s in stopped['steps']] == [1, 2]


def test_default_paths_stay_in_project():
    from backend.app.config import PROJECT
    assert (PROJECT / 'backend' / 'app' / 'config.py').is_file()
    assert (PROJECT / 'frontend' / 'package.json').is_file()


def test_cleanup_reports_certificate_error_without_changing_steps(client, monkeypatch, caplog):
    import httpx
    from openai import APIConnectionError
    w = recording(client)
    path = f'/api/workflows/{w["id"]}'
    w = client.post(path + '/stop').json()
    client.app.state.settings.api_key = 'test-key'
    def fail(*_):
        error = APIConnectionError(request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
        error.__cause__ = httpx.ConnectError('CERTIFICATE_VERIFY_FAILED private-key-must-not-escape')
        raise error
    monkeypatch.setattr('backend.app.cleaner.clean_steps', fail)
    response = client.post(path + '/clean', json={'version': w['version']})
    result = response.json()
    assert result['reason'] == 'certificate_error' and 'SSL_CERT_FILE' in result['message']
    assert result['workflow'] == w and client.get(path).json() == w
    assert 'private-key-must-not-escape' not in response.text + caplog.text
    assert 'certificate_error' in caplog.text


def test_library_preview_uses_first_non_sensitive_screenshot(client):
    w = recording(client, sensitive=True)
    path = f'/api/workflows/{w["id"]}'
    assert client.get('/api/workflows').json()[0]['preview'] is None
    no_image = step(2, before={}, after={})
    assert client.post(path+'/steps', json=no_image).status_code == 201
    visible = step(3, after={})
    assert client.post(path+'/steps', json=visible).status_code == 201
    preview = client.get('/api/workflows').json()[0]['preview']
    assert preview == {'step_id': visible['id'], 'phase': 'before'}
    assert client.get(path+f'/steps/{preview["step_id"]}/screenshots/{preview["phase"]}').status_code == 200
    normal = recording(client)
    listed = {w['id']: w for w in client.get('/api/workflows').json()}
    assert listed[normal['id']]['preview'] == {'step_id': normal['steps'][0]['id'], 'phase': 'after'}


def test_improve_one_step_preserves_other_steps_and_recorded_evidence(client, monkeypatch):
    w = recording(client, 3)
    path = '/api/workflows/' + w['id']
    w = verify(client, client.post(path + '/stop').json())
    w = client.patch(path, json={'title': w['title'], 'version': w['version'], 'recording_context': 'Create a workspace.'}).json()
    original = w['steps'][1]
    client.app.state.settings.api_key = 'test-key'
    def improve(_settings, steps, recording_context):
        assert recording_context == 'Create a workspace.'
        assert [s['id'] for s in steps] == [original['id']]
        return [CleanStep(id=original['id'], description='Select Save.')]
    monkeypatch.setattr('backend.app.cleaner.clean_steps', improve)
    route = path + '/steps/' + original['id'] + '/clean'
    response = client.post(route, json={'version': w['version']})
    assert response.status_code == 200
    result = response.json()['workflow']
    assert result['steps'][0] == w['steps'][0] and result['steps'][2] == w['steps'][2]
    updated = result['steps'][1]
    assert updated['description'] == 'Select Save.' and not updated['reviewed']
    for field in ('selector', 'value', 'before', 'after', 'sequence'):
        assert updated[field] == original[field]
    assert client.post(route, json={'version': w['version']}).status_code == 409
    assert client.post(path+'/steps/'+str(uuid4())+'/clean', json={'version': result['version']}).status_code == 404


def test_improve_all_can_explicitly_include_edited_and_verified_steps(client, monkeypatch):
    w = recording(client, 2)
    path = '/api/workflows/' + w['id']
    w = verify(client, client.post(path+'/stop').json())
    client.app.state.settings.api_key = 'test-key'
    def improve(_settings, steps, recording_context):
        assert recording_context == ''
        assert len(steps) == 2
        return [CleanStep(id=s['id'], description='Improved instruction.') for s in steps]
    monkeypatch.setattr('backend.app.cleaner.clean_steps', improve)
    response = client.post(path+'/clean', json={'version': w['version'], 'include_edited_and_verified': True})
    assert response.status_code == 200
    assert all(s['description'] == 'Improved instruction.' and not s['reviewed'] for s in response.json()['workflow']['steps'])


def test_improve_one_failure_and_concurrent_edit_preserve_user_work(client, monkeypatch):
    w = recording(client)
    path = '/api/workflows/' + w['id']
    step_id = w['steps'][0]['id']
    route = path + '/steps/' + step_id + '/clean'
    assert client.post(route, json={'version': w['version']}).status_code == 409
    w = client.post(path+'/stop').json()
    assert client.post(route, json={'version': w['version']}).json()['mode'] == 'fallback'
    client.app.state.settings.api_key = 'test-key'
    def fail(*_):
        raise RuntimeError('provider down')
    monkeypatch.setattr('backend.app.cleaner.clean_steps', fail)
    assert client.post(route, json={'version': w['version']}).json()['mode'] == 'fallback'
    assert client.get(path).json() == w
    def concurrent(_settings, steps, recording_context):
        response = client.patch(path+'/steps/'+step_id, json={'version': w['version'], 'description': 'User edit during request.'})
        assert response.status_code == 200
        return [CleanStep(id=step_id, description='Outdated suggestion.')]
    monkeypatch.setattr('backend.app.cleaner.clean_steps', concurrent)
    assert client.post(route, json={'version': w['version']}).status_code == 409
    assert client.get(path).json()['steps'][0]['description'] == 'User edit during request.'
