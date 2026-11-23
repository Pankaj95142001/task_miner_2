import json
from uuid import uuid4
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.tests.test_workflows import recording


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(Settings(tmp_path, 'delete-test-session-token')),
                    headers={'Authorization':'Bearer delete-test-session-token'}) as api:
        yield api


def stopped(client):
    w = recording(client)
    return client.post('/api/workflows/' + w['id'] + '/stop').json()


def endpoint(w): return f"/api/workflows/{w['id']}?version={w['version']}"


# Legacy storage fixture only; the application no longer creates these tables.
LEGACY_SCHEMA = """
CREATE TABLE IF NOT EXISTS automation_plans (
    id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL UNIQUE REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    reviewed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY, workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL, plan_version INTEGER NOT NULL, plan_json TEXT NOT NULL,
    status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', current_step INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL, finished_at TEXT, pid INTEGER
);
CREATE TABLE IF NOT EXISTS automation_run_steps (
    run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT, finished_at TEXT, message TEXT NOT NULL DEFAULT '', screenshot TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(run_id,position)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_automation_run ON automation_runs((1))
    WHERE status IN ('starting','running','pausing','paused','waiting','cancelling');
"""


def add_run(client, w, status='completed', run_id=None):
    rid = run_id or str(uuid4())
    with client.app.state.database.connect(write=True) as db:
        db.executescript(LEGACY_SCHEMA)
        plan_id = str(uuid4())
        db.execute('INSERT INTO automation_plans(id,workflow_id,workflow_version,payload,updated_at) VALUES(?,?,?,?,?)',
                   (plan_id,w['id'],w['version'],'{}','2026-10-08'))
        db.execute('INSERT INTO automation_runs(id,workflow_id,plan_id,plan_version,plan_json,status,created_at) VALUES(?,?,?,?,?,?,?)',
                   (rid,w['id'],plan_id,1,'{}',status,'2026-10-08T00:00:00+00:00'))
        db.execute('INSERT INTO automation_run_steps(run_id,position,status,screenshot) VALUES(?,?,?,?)',
                   (rid,0,'passed','0001.png'))
    return rid


def test_permanent_delete_removes_all_owned_data_and_preserves_other_workflows(client):
    w = stopped(client); other = stopped(client)
    root = client.app.state.settings.data_dir
    rid = add_run(client,w)
    folder = root/'runs'/rid; (folder/'nested').mkdir(parents=True)
    (folder/'0001.png').write_bytes(b'fixture screenshot')
    (folder/'nested'/'report.json').write_text('{}')
    keep = root/'runs'/'unrelated'; keep.mkdir(); (keep/'keep.txt').write_text('keep')
    before_files = list((root/'screenshots').glob(w['steps'][0]['id']+'-*'))
    other_files = list((root/'screenshots').glob(other['steps'][0]['id']+'-*'))
    assert len(before_files)==2 and len(other_files)==2
    recorder=client.app.state.recorder
    recorder.state.update(phase='done',workflow_id=w['id'],title=w['title'],count=1)
    result=client.delete(endpoint(w))
    assert result.status_code==200 and result.json()['deleted']
    assert client.get('/api/workflows/'+w['id']).status_code==404
    assert client.get('/api/runs/'+rid).status_code==404
    assert not any(p.exists() for p in before_files) and not folder.exists()
    assert all(p.exists() for p in other_files) and (keep/'keep.txt').read_text()=='keep'
    assert client.get('/api/workflows/'+other['id']).status_code==200
    assert recorder.status()['workflow_id'] is None and recorder.status()['phase']=='idle'
    with client.app.state.database.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM steps WHERE workflow_id=?',(w['id'],)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM automation_plans WHERE workflow_id=?',(w['id'],)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM automation_runs WHERE workflow_id=?',(w['id'],)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM automation_run_steps WHERE run_id=?',(rid,)).fetchone()[0]==0
    assert client.delete(endpoint(w)).status_code==404


def test_auth_version_recording_and_legacy_history_are_checked(client):
    w=recording(client)
    assert client.delete(endpoint(w),headers={'Authorization':''}).status_code==401
    assert client.delete(endpoint(w)).status_code==409
    current=client.post('/api/workflows/'+w['id']+'/stop').json()
    assert client.delete(endpoint(w)).status_code==409
    add_run(client,current,status='running')  # Historical status does not start or block a recorder.
    assert client.delete(endpoint(current)).status_code==200
    assert client.get('/api/workflows/'+w['id']).status_code==404


def test_pending_recovery_prevents_deletion(client):
    w=stopped(client)
    recorder=client.app.state.recorder
    recorder.directory.mkdir()
    (recorder.directory/'session.json').write_text(json.dumps({'id':w['id'],'title':w['title'],'nextSequence':2}))
    assert client.delete(endpoint(w)).status_code==409
    assert client.get('/api/workflows/'+w['id']).status_code==200


def test_locked_file_retains_records_and_can_be_retried(client,monkeypatch):
    w=stopped(client); original=Path.unlink
    blocked=client.app.state.settings.data_dir/'screenshots'/f"{w['steps'][0]['id']}-after.jpg"
    def unlink(path,*args,**kwargs):
        if path==blocked: raise PermissionError('locked fixture')
        return original(path,*args,**kwargs)
    with monkeypatch.context() as patch:
        patch.setattr(Path,'unlink',unlink)
        result=client.delete(endpoint(w))
    assert result.status_code==503 and 'retry' in result.text
    assert client.get('/api/workflows/'+w['id']).status_code==200 and blocked.exists()
    assert client.delete(endpoint(w)).status_code==200 and not blocked.exists()


def test_invalid_run_path_cannot_remove_outside_files(client):
    w=stopped(client)
    root=client.app.state.settings.data_dir
    outside=root/'keep.txt'; outside.write_text('keep')
    add_run(client,w,run_id='../keep.txt')
    assert client.delete(endpoint(w)).status_code==409
    assert outside.read_text()=='keep'
    assert all((root/'screenshots'/f"{w['steps'][0]['id']}-{phase}.jpg").exists() for phase in ('before','after'))


def test_linked_run_content_is_rejected_before_deletion(client,monkeypatch):
    w=stopped(client); rid=add_run(client,w)
    folder=client.app.state.settings.data_dir/'runs'/rid; folder.mkdir(parents=True)
    linked=folder/'linked'; linked.mkdir()
    original=Path.is_junction
    monkeypatch.setattr(Path,'is_junction',lambda p: p==linked or original(p))
    assert client.delete(endpoint(w)).status_code==409
    assert folder.exists() and client.get('/api/workflows/'+w['id']).status_code==200
