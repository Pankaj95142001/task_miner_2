from io import BytesIO
import json
import queue
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import Settings
from backend.app.main import create_app
from backend.desktop.engine import DesktopRecorder
from backend.desktop.native import key_activity


class DesktopFixture:
    def __init__(self):
        self.events = queue.Queue(); self.enabled = False; self.overflow = False
        self.unlocked = True; self.captures = 0; self.current = 11; self.field = None
    def focused_field(self, hwnd): return self.field if self.enabled else None
    def start(self): pass
    def stop(self): self.enabled = False
    def bounds(self): return {'left': -1280, 'top': -200, 'width': 3200, 'height': 1280}
    def foreground(self): return self.current
    def window(self, handle): return {'title': 'Sample window', 'app': 'sample.exe'}
    def interactive(self): return self.unlocked
    def capture(self):
        self.captures += 1
        return Image.new('RGB', (320, 180), (20, min(255, self.captures * 20), 90))


@pytest.fixture
def desktop(tmp_path):
    with TestClient(create_app(Settings(tmp_path / 'backend', 'desktop-test-session-token')),
                    headers={'Authorization': 'Bearer desktop-test-session-token'}) as client:
        now = [1000.0]; native = DesktopFixture()
        def api(route, data):
            response = client.post('/api' + route, json=data)
            assert response.is_success, response.text
            return response.json()
        engine = DesktopRecorder({'directory': str(tmp_path / 'recording'), 'title': 'Desktop task', 'recording_context': 'Create a project folder.'}, native, api=api, clock=lambda: now[0])
        engine.start(); now[0] += 3.1; engine.tick()
        yield engine, native, now, client, api


def test_desktop_capture_review_and_both_exports(desktop):
    engine, native, now, client, _ = desktop
    assert native.enabled and engine.phase == 'recording'
    now[0] += .2
    engine.handle({'kind': 'click', 'time': now[0], 'hwnd': 11, 'x': -100, 'y': 50, 'button': 'right'})
    for _ in range(4):
        now[0] += .1
        engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    now[0] += 1.6; engine.tick(); engine.pump()
    engine.stop(); engine.pump()
    assert engine.phase == 'done' and not native.enabled and not engine.manifest_path.exists()
    path = '/api/workflows/' + engine.manifest['id']
    workflow = client.get(path).json()
    assert workflow['recording_context'] == 'Create a project folder.'
    click = next(s for s in workflow['steps'] if s['action'] == 'click')
    assert click['source'] == 'desktop' and click['coordinates']['x'] == 1180
    assert click['coordinates']['y'] == 250 and click['coordinates']['screen_x'] == -100
    assert click['before']['filename'] and click['after']['filename']
    assert click['description'].startswith('Right-click at X=1180, Y=250')
    inputs = [s for s in workflow['steps'] if s['action'] == 'input']
    assert len(inputs) == 1 and inputs[0]['value'] == ''
    assert 'Typed text was not recorded' in inputs[0]['description']
    for step in workflow['steps']:
        result = client.patch(path + '/steps/' + step['id'], json={'description': step['description'], 'reviewed': True, 'version': workflow['version']})
        assert result.status_code == 200
        workflow = result.json()
    assert client.get(path + '/export/pdf').content.startswith(b'%PDF')
    with ZipFile(BytesIO(client.get(path + '/export/docx').content)) as archive:
        text = archive.read('word/document.xml').decode()
        assert 'Desktop click:' not in text
        assert 'Desktop: sample.exe - Sample window' not in text


def test_pause_does_not_capture_and_resume_discards_old_events(desktop):
    engine, native, now, _, _ = desktop
    engine.pause()
    count = engine.report()['count']; captures = native.captures
    now[0] += .2
    native.events.put({'kind': 'click', 'time': now[0], 'hwnd': 11, 'x': 10, 'y': 20})
    engine.tick()
    assert native.captures == captures and not native.enabled
    now[0] += 2; native.current = 0
    engine.resume(); engine.tick()
    assert native.enabled and engine.report()['count'] == count
    assert engine.snapshot['data_url']


def test_locked_desktop_pauses_before_screenshot(desktop):
    engine, native, now, _, _ = desktop
    captures = native.captures; native.unlocked = False; now[0] += 2
    engine.tick()
    assert engine.phase == 'paused' and not native.enabled
    assert native.captures == captures and 'locked' in engine.error
    engine.resume()
    assert engine.phase == 'paused'


def test_stop_flushes_delivered_events_without_capturing_later_screens(desktop):
    engine, native, now, client, _ = desktop
    now[0] += .1
    native.events.put({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    captures = native.captures
    engine.stop(); engine.pump()
    assert native.captures == captures
    w = client.get('/api/workflows/' + engine.manifest['id']).json()
    assert any(s['action'] == 'input' and not s['after']['filename'] for s in w['steps'])


def test_interrupted_desktop_queue_recovers_with_stable_ids(desktop):
    engine, native, now, client, api = desktop
    now[0] += .1
    engine.handle({'kind': 'click', 'time': now[0], 'hwnd': 11, 'x': 0, 'y': 0})
    now[0] += 2; engine.tick()
    def lost_ack(route, data):
        api(route, data)
        raise RuntimeError('Response lost after commit')
    engine.api_override = lost_ack; engine.pump()
    engine.stop()
    engine.api_override = lambda *_: (_ for _ in ()).throw(RuntimeError('Offline'))
    engine.pump()
    assert engine.phase == 'error' and engine.manifest_path.exists()
    recovery = DesktopRecorder(engine.config, api=api)
    recovery.recover(); recovery.pump()
    assert recovery.phase == 'done' and not recovery.manifest_path.exists()
    workflow = client.get('/api/workflows/' + engine.manifest['id']).json()
    assert len(workflow['steps']) == 2
    assert len({s['id'] for s in workflow['steps']}) == 2
    assert workflow['status'] == 'draft'


def test_keyboard_activity_never_contains_typed_characters():
    assert key_activity(65) == key_activity(90) == {'kind': 'typing'}
    assert key_activity(65, shortcut=True) == {'kind': 'key', 'value': 'keyboard shortcut'}
    assert key_activity(13) == {'kind': 'key', 'value': 'Enter'}
    assert key_activity(16) is None


def test_sync_warning_clears_after_backend_recovers(desktop):
    engine, _, now, _, api = desktop
    now[0] += 2; engine.tick()
    engine.api_override = lambda *_: (_ for _ in ()).throw(RuntimeError('Offline'))
    engine.pump()
    assert engine.error.startswith('Sync pending.') and engine.jobs
    engine.api_override = api; engine.pump()
    assert engine.error == '' and not engine.jobs and engine.phase == 'recording'


class FieldFixture:
    def __init__(self, identity=1, value=''):
        self.identity = (identity,)
        self.value = value
        self.focused = True
        self.protected = False
        self.reads = 0

    def is_focused(self): return self.focused

    def read(self):
        self.reads += 1
        if self.protected:
            return {'text_capture': 'protected', 'value': '', 'label': 'the private field', 'sensitive': True}
        if not self.focused:
            return None
        return {'text_capture': 'captured', 'value': self.value, 'label': 'Name', 'sensitive': False}


def test_typed_text_groups_edits_and_appears_in_sop(desktop):
    engine, native, now, client, _ = desktop
    native.field = FieldFixture()
    for text in ('P', 'Pan', 'Pankaj <Sales> & team', 'Pankaj <Sales> & tea', 'Pankaj <Sales> & team\nApproved'):
        now[0] += .1
        native.field.value = text
        engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    now[0] += 1.6; engine.tick(); engine.pump(); engine.stop(); engine.pump()
    path = '/api/workflows/' + engine.manifest['id']
    workflow = client.get(path).json()
    inputs = [s for s in workflow['steps'] if s['action'] == 'input']
    assert len(inputs) == 1
    assert inputs[0]['value'] == native.field.value
    assert native.field.value in inputs[0]['description']
    assert inputs[0]['text_capture'] == 'captured' and not inputs[0]['sensitive']
    for step in workflow['steps']:
        workflow = client.patch(path + '/steps/' + step['id'], json={'description': step['description'], 'reviewed': True, 'version': workflow['version']}).json()
    from docx import Document
    doc = Document(BytesIO(client.get(path + '/export/docx').content))
    assert native.field.value in '\n'.join(p.text for p in doc.paragraphs)
    pdf = client.get(path + '/export/pdf')
    assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF')
    # Decode ReportLab content streams to verify text was rendered, not only a valid header.
    import base64, re, zlib
    streams = re.findall(rb'stream\r?\n(.*?)endstream', pdf.content, re.S)
    decoded = []
    for stream in streams:
        try:
            decoded.append(zlib.decompress(base64.a85decode(stream.strip(), adobe=True)))
        except (ValueError, zlib.error):
            pass
    rendered = b''.join(re.findall(rb'\((.*?)\) Tj', b'\n'.join(decoded), re.S))
    assert b'Pankaj <Sales> & team' in rendered
    assert b'Approved' in rendered


def test_different_fields_and_focus_loss_do_not_mix_values(desktop):
    engine, native, now, _, _ = desktop
    first = native.field = FieldFixture(1, 'First field')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    first.focused = False
    native.field = FieldFixture(2, 'Second field')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    inputs = [j['step'] for j in engine.jobs.values() if j['step']['action'] == 'input']
    assert [s['value'] for s in inputs] == ['First field', 'Second field']
    native.field.focused = False; native.field.value = 'Unrelated later change'
    engine.tick()
    assert inputs[1]['value'] == 'Second field'


def test_password_never_saved_and_pausing_stops_field_reads(desktop):
    engine, native, now, _, _ = desktop
    native.field = FieldFixture(value='do-not-record-this-password'); native.field.protected = True
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    step = next(j['step'] for j in engine.jobs.values() if j['step']['action'] == 'input')
    assert step['sensitive'] and step['value'] == '' and step['text_capture'] == 'protected'
    assert all('do-not-record-this-password' not in p.read_text(encoding='utf-8') for p in engine.queue_path.glob('*.json'))
    reads = native.field.reads; engine.pause(); engine.tick(); engine.stop()
    assert native.field.reads == reads


def test_deletion_clears_field_and_keyboard_paste_is_typing(desktop):
    engine, native, now, _, _ = desktop
    native.field = FieldFixture(value='Remove this')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    native.field.value = ''
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    step = next(j['step'] for j in engine.jobs.values() if j['step']['action'] == 'input')
    from backend.app.cleaner import fallback_text
    assert fallback_text(step) == 'Clear Name in Sample window.'
    assert key_activity(86, shortcut=True, editing=True) == {'kind': 'typing'}
    assert key_activity(46) == {'kind': 'typing'}


@pytest.mark.parametrize('status', ['protected', 'unavailable'])
def test_api_never_persists_values_flagged_as_uncapturable(desktop, status):
    engine, _, now, client, _ = desktop
    from uuid import uuid4
    from backend.desktop.engine import timestamp
    path = '/api/workflows/' + engine.manifest['id']
    response = client.post(path + '/steps', json={
        'id': str(uuid4()), 'sequence': 2, 'action': 'input', 'source': 'desktop',
        'occurred_at': timestamp(now[0]), 'tab_id': 11, 'url': '',
        'page_title': 'Sample window', 'label': 'confidential label',
        'text_capture': status, 'sensitive': False, 'value': 'must-never-be-stored',
    })
    assert response.status_code == 201
    step = client.get(path).json()['steps'][0]
    assert step['value'] == '' and step['sensitive'] and step['label'] == 'the private field'
    assert 'must-never-be-stored' not in step['description']


def test_background_field_is_not_sampled_even_if_provider_reports_focus(desktop):
    engine, native, now, _, _ = desktop
    native.field = FieldFixture(value='Foreground text')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    reads = native.field.reads; native.current = 22
    native.field.value = 'Unrelated background update'
    engine.tick()
    assert native.field.reads == reads
    step = next(j['step'] for j in engine.jobs.values() if j['step']['action'] == 'input')
    assert step['value'] == 'Foreground text'


@pytest.mark.parametrize('pause_seconds', [1.0, 3.0, 15.0])
def test_slow_typing_combines_after_stop_with_originals_for_undo(desktop, pause_seconds):
    engine, native, now, client, _ = desktop
    native.field = FieldFixture(value='one')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    now[0] += pause_seconds; engine.tick(); engine.pump()
    native.field.value = 'one connect'
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    now[0] += 1.6; engine.tick(); engine.pump()
    path = '/api/workflows/' + engine.manifest['id']
    before = client.get(path).json()
    originals = [s for s in before['steps'] if s['action'] == 'input']
    assert len(originals) == 2
    assert originals[0]['input_group_id'] == originals[1]['input_group_id']
    engine.stop(); engine.pump()
    w = client.get(path).json()
    inputs = [s for s in w['steps'] if s['action'] == 'input']
    assert len(inputs) == 1 and inputs[0]['value'] == 'one connect'
    assert inputs[0]['merge'] == {'count': 2, 'automatic': True}
    restored = client.post(path + '/steps/' + inputs[0]['id'] + '/unmerge', json={'version': w['version']})
    assert restored.status_code == 200, restored.text
    assert [s['value'] for s in restored.json()['steps'] if s['action'] == 'input'] == ['one', 'one connect']


def test_focus_loss_and_resume_start_new_typing_sessions(desktop):
    engine, native, now, client, _ = desktop
    native.field = FieldFixture(value='first')
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    native.field.focused = False; now[0] += .1; engine.tick()
    native.field.focused = True; native.field.value = 'second'
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    engine.pause(); now[0] += 3; engine.resume(); engine.tick()
    native.field.value = 'third'
    now[0] += .1; engine.handle({'kind': 'typing', 'time': now[0], 'hwnd': 11})
    now[0] += 2; engine.tick(); engine.pump(); engine.stop(); engine.pump()
    w = client.get('/api/workflows/' + engine.manifest['id']).json()
    inputs = [s for s in w['steps'] if s['action'] == 'input']
    assert len(inputs) == 3 and len({s['input_group_id'] for s in inputs}) == 3
