from backend.tests.test_workflows import client, recording, verify


def test_fresh_install_has_sop_routes_and_no_replay_service_or_tables(client):
    paths = client.app.openapi()['paths']
    assert '/api/workflows/{workflow_id}/export/{kind}' in paths
    assert '/api/workflows/{workflow_id}/vision-review' in paths
    assert '/api/recorder/start' in paths
    assert not any('automation' in path or path.startswith('/api/runs') or path.endswith('/runs') for path in paths)
    assert not hasattr(client.app.state, 'replay')
    with client.app.state.database.connect() as db:
        tables = {row['name'] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert not tables & {'automation_plans', 'automation_runs', 'automation_run_steps'}
    for path in ('/api/automation/status', '/api/automation-plans/old', '/api/runs/old'):
        assert client.get(path).status_code == 404


def test_record_review_export_and_delete_work_without_legacy_run_tables(client):
    workflow = recording(client, count=2)
    path = '/api/workflows/' + workflow['id']
    workflow = client.post(path + '/stop').json()
    workflow = verify(client, workflow)
    assert client.get(path + '/export/pdf').content.startswith(b'%PDF')
    assert client.get(path + '/export/docx').status_code == 200
    assert client.delete(path, params={'version': workflow['version']}).status_code == 200
    assert client.get(path).status_code == 404
