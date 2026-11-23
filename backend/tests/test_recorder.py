import json

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.recorder import RecorderService


@pytest.fixture
def recorder_client(tmp_path):
    with TestClient(create_app(Settings(tmp_path, 'a-test-session-token')), base_url='http://127.0.0.1:8000',
                    headers={'Authorization': 'Bearer a-test-session-token'}) as client:
        yield client


def test_recorder_endpoints_require_auth(recorder_client):
    assert recorder_client.get('/api/recorder/status', headers={'Authorization': ''}).status_code == 401
    assert recorder_client.post('/api/recorder/start', headers={'Authorization': ''}, json={'title': 'Task', 'url': 'https://example.com'}).status_code == 401
    assert recorder_client.get('/api/recorder/status').json()['phase'] == 'idle'
    assert recorder_client.post('/api/recorder/stop').status_code == 409


@pytest.mark.parametrize('url', ['javascript:alert(1)', 'file:///C:/Users', 'https://user:password@example.com', 'not-a-url'])
def test_only_regular_browser_urls_can_start_recording(recorder_client, url):
    assert recorder_client.post('/api/recorder/start', json={'title': 'Task', 'url': url}).status_code == 422


@pytest.mark.parametrize('context', ['', '  Raise an access ticket in One Connect.  '])
@pytest.mark.parametrize('fields, expected_url', [({}, ''), ({'url': ''}, ''), ({'url': 'https://example.com'}, 'https://example.com')])
def test_launch_uses_socket_origin_and_keeps_token_out_of_response(recorder_client, monkeypatch, fields, expected_url, context):
    def start(origin, title, url, recording_context):
        assert recording_context == context.strip()
        assert origin == 'http://127.0.0.1:8000'
        assert title == 'Task' and url == expected_url
        return {'phase': 'starting', 'title': title}
    monkeypatch.setattr(recorder_client.app.state.recorder, 'start', start)
    result = recorder_client.post('/api/recorder/start', headers={'Host': 'unexpected.example'}, json={'title': 'Task', 'recording_context': context, **fields})
    assert result.status_code == 200
    assert 'a-test-session-token' not in result.text


def test_interrupted_session_is_discovered_after_backend_restart(tmp_path):
    service = RecorderService(Settings(tmp_path, 'a-test-session-token'))
    queue = tmp_path / 'recorder' / 'queue'
    queue.mkdir(parents=True)
    (queue.parent / 'session.json').write_text(json.dumps({'id': 'saved-workflow', 'title': 'Saved task', 'nextSequence': 4}))
    (queue / 'step.json').write_text('{}')
    state = service.status()
    assert state['phase'] == 'interrupted' and state['recoverable']
    assert state['workflow_id'] == 'saved-workflow' and state['count'] == 3 and state['pending'] == 1
    assert 'token' not in state


def test_desktop_start_is_explicit_and_uses_local_origin(recorder_client, monkeypatch):
    def start(origin, title, mode, recording_context):
        assert recording_context == "Create a project folder."
        assert origin == 'http://127.0.0.1:8000' and mode == 'desktop' and title == 'Across apps'
        return {'phase': 'starting', 'mode': mode}
    monkeypatch.setattr(recorder_client.app.state.recorder, 'start', start)
    result = recorder_client.post('/api/recorder/start', json={'title': 'Across apps', 'mode': 'desktop', 'recording_context': 'Create a project folder.'})
    assert result.status_code == 200 and result.json()['mode'] == 'desktop'
    assert recorder_client.post('/api/recorder/start', json={'title': 'Task', 'mode': 'unknown'}).status_code == 422


def test_desktop_manifest_selects_the_correct_recovery_mode(tmp_path):
    service = RecorderService(Settings(tmp_path, 'a-test-session-token'))
    service.directory.mkdir()
    (service.directory / 'session.json').write_text(json.dumps({'id': 'saved-desktop', 'mode': 'desktop', 'title': 'Desktop task', 'nextSequence': 2}))
    assert service.status()['mode'] == 'desktop' and service.status()['recoverable']


def test_desktop_helper_uses_python_and_prevents_overlapping_browser_recording(tmp_path, monkeypatch):
    import io
    import os
    import sys
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    if os.name != 'nt':
        pytest.skip('Desktop process launch is Windows-specific')
    process = MagicMock(); process.poll.return_value = None; process.stdin = io.StringIO()
    spawn = MagicMock(return_value=process)
    monkeypatch.setattr('backend.app.recorder.subprocess.Popen', spawn)
    monkeypatch.setattr('backend.app.recorder.threading.Thread', MagicMock())
    service = RecorderService(Settings(tmp_path, 'desktop-fixture-session-token'))
    state = service.start('http://127.0.0.1:8000', title='Whole desktop task', mode='desktop', recording_context='Create a project folder.')
    assert state['mode'] == 'desktop' and state['phase'] == 'starting'
    assert spawn.call_args.args[0] == [sys.executable, '-m', 'backend.desktop.runner']
    config = json.loads(process.stdin.getvalue())
    assert config['mode'] == 'desktop' and config['title'] == 'Whole desktop task'
    assert config['recording_context'] == 'Create a project folder.'
    with pytest.raises(HTTPException) as exc:
        service.start('http://127.0.0.1:8000', title='Browser task')
    assert exc.value.status_code == 409 and spawn.call_count == 1


def test_edge_setting_reaches_recorder_helper(tmp_path, monkeypatch):
    import io
    from unittest.mock import MagicMock
    process = MagicMock(); process.poll.return_value = None; process.stdin = io.StringIO()
    monkeypatch.setattr('backend.app.recorder.subprocess.Popen', MagicMock(return_value=process))
    monkeypatch.setattr('backend.app.recorder.threading.Thread', MagicMock())
    service = RecorderService(Settings(tmp_path, 'edge-fixture-session-token', browser_channel='msedge'))
    state = service.start('http://127.0.0.1:8000', title='Edge task', recording_context='Raise an access ticket.')
    assert state['browser_channel'] == 'msedge'
    config = json.loads(process.stdin.getvalue())
    assert config['browser_channel'] == 'msedge' and config['url'] == ''
    assert config['recording_context'] == 'Raise an access ticket.'


def test_browser_setting_from_environment_is_validated(tmp_path, monkeypatch):
    monkeypatch.setenv('SOP_DATA_DIR', str(tmp_path))
    monkeypatch.setenv('SOP_TOKEN', 'edge-fixture-session-token')
    monkeypatch.setenv('SOP_BROWSER_CHANNEL', 'msedge')
    assert Settings.from_env().browser_channel == 'msedge'
    monkeypatch.setenv('SOP_BROWSER_CHANNEL', 'arbitrary-executable')
    with pytest.raises(RuntimeError, match='SOP_BROWSER_CHANNEL'):
        Settings.from_env()
