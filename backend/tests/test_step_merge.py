import json
from uuid import uuid4
from io import BytesIO

import pytest
from docx import Document

from backend.tests.test_workflows import client, step, verify
from backend.app import step_merge, narration
from backend.tests.test_vision import provider


def recorded(client, values=('one', 'one con', 'one connect'), automatic=True, changes=None, stop=True):
    w = client.post('/api/workflows', json={'title': 'Search desktop'}).json()
    group = str(uuid4())
    originals = []
    for index, value in enumerate(values, 1):
        body = step(index, source='desktop', action='input', value=value, tab_id=11,
                    app_name='sample.exe', page_title='Search', label='Search field', text_capture='captured',
                    desktop_target={'auto_id': 'search', 'control_type': 'Edit'},
                    desktop_field_id=[42, 1] if automatic else None,
                    input_group_id=group if automatic else None)
        body.update((changes or {}).get(index, {}))
        response = client.post('/api/workflows/' + w['id'] + '/steps', json=body)
        assert response.status_code == 201, response.text
        originals.append(body)
    endpoint = '/api/workflows/' + w['id']
    return (client.post(endpoint + '/stop').json() if stop else client.get(endpoint).json()), originals


def merge(client, w, ids=None, confirmed=True, version=None):
    return client.post('/api/workflows/' + w['id'] + '/merge-inputs', json={
        'version': w['version'] if version is None else version,
        'step_ids': ids or [s['id'] for s in w['steps']], 'confirm_same_field': confirmed})


def test_auto_merge_preserves_originals_images_latest_text_and_exports(client):
    w, originals = recorded(client)
    assert len(w['steps']) == 1
    item = w['steps'][0]
    assert item['value'] == 'one connect' and 'one connect' in item['description']
    assert item['merge'] == {'count': 3, 'automatic': True}
    assert not item['reviewed']
    images = client.app.state.settings.data_dir / 'screenshots'
    assert len(list(images.glob('*.jpg'))) == 8
    assert (images / item['before']['filename']).read_bytes() == (images / f"{originals[0]['id']}-before.jpg").read_bytes()
    assert (images / item['after']['filename']).read_bytes() == (images / f"{originals[-1]['id']}-after.jpg").read_bytes()
    with client.app.state.database.connect() as db:
        saved = db.execute('SELECT * FROM step_merge_originals ORDER BY position').fetchall()
    assert [json.loads(r['payload'])['value'] for r in saved] == ['one', 'one con', 'one connect']
    # A retry after finalization must not add the archived input a second time.
    duplicate = client.post('/api/workflows/' + w['id'] + '/steps', json=originals[0])
    assert duplicate.status_code == 201 and duplicate.json()['duplicate']
    assert client.post('/api/workflows/' + w['id'] + '/stop').json() == w
    w = verify(client, w)
    result = client.get('/api/workflows/' + w['id'] + '/export/docx')
    doc = Document(BytesIO(result.content))
    text = '\n'.join(p.text for p in doc.paragraphs)
    assert 'one connect' in text and 'Enter "one"' not in text
    assert client.get('/api/workflows/' + w['id'] + '/export/pdf').content.startswith(b'%PDF')


@pytest.mark.parametrize('changes', [
    {2: {'action': 'click'}}, {2: {'action': 'key', 'value': 'Enter'}},
    {2: {'desktop_field_id': [42, 2]}}, {2: {'input_group_id': str(uuid4())}},
    {2: {'sensitive': True}}, {2: {'text_capture': 'truncated'}},
    {2: {'tab_id': 22}}, {2: {'source': 'browser'}},
    {2: {'input_group_id': None}}, {2: {'desktop_field_id': None}},
])
def test_auto_merge_keeps_barriers_private_and_uncertain_targets_separate(client, changes):
    w, _ = recorded(client, changes=changes)
    assert len(w['steps']) == 3 and not any(s.get('merge') for s in w['steps'])


@pytest.mark.parametrize('final', ['one connect', 'one correction', ''])
def test_manual_merge_uses_final_snapshot_and_undo_restores_exact_originals(client, final):
    w, _ = recorded(client, values=('one', final), automatic=False)
    original = w['steps']
    assert merge(client, w, confirmed=False).status_code == 422
    assert merge(client, w, version=w['version'] - 1).status_code == 409
    response = merge(client, w, ids=[s['id'] for s in reversed(original)])
    assert response.status_code == 200, response.text
    merged = response.json(); item = merged['steps'][0]
    assert item['value'] == final and item['merge']['count'] == 2
    assert item['description'].startswith('Enter' if final else 'Clear')
    assert not item['reviewed'] and item['edited']
    endpoint = f"/api/workflows/{w['id']}/steps/{item['id']}/unmerge"
    assert client.post(endpoint, json={'version': w['version']}).status_code == 409
    restored = client.post(endpoint, json={'version': merged['version']})
    assert restored.status_code == 200, restored.text
    assert restored.json()['steps'] == original
    with client.app.state.database.connect() as db:
        assert db.execute('SELECT count(*) FROM step_merge_originals').fetchone()[0] == 0
    assert len(list((client.app.state.settings.data_dir / 'screenshots').glob('*.jpg'))) == 4


def test_manual_merge_rejects_skipping_an_action_and_different_fields(client):
    w, _ = recorded(client, automatic=False, changes={2: {'action': 'click'}})
    assert merge(client, w, ids=[w['steps'][0]['id'], w['steps'][2]['id']]).status_code == 422
    w, _ = recorded(client, automatic=False, changes={3: {'desktop_target': {'auto_id': 'other'}}})
    assert merge(client, w).status_code == 422
    w, _ = recorded(client, automatic=False, changes={2: {'desktop_field_id': [1]}, 3: {'desktop_field_id': [2]}})
    assert merge(client, w).status_code == 422


def test_merge_requires_auth_and_stopped_recording(client):
    w, _ = recorded(client, automatic=False, stop=False)
    assert merge(client, w).status_code == 409
    assert client.post('/api/workflows/' + w['id'] + '/merge-inputs', headers={'Authorization': ''},
                       json={'version': w['version'], 'step_ids': [s['id'] for s in w['steps']]}).status_code == 401


@pytest.mark.parametrize('delete_workflow', [True, False])
def test_deleting_merged_step_or_workflow_removes_archived_images(client, delete_workflow):
    w, _ = recorded(client)
    endpoint = '/api/workflows/' + w['id']
    if not delete_workflow:
        endpoint += '/steps/' + w['steps'][0]['id']
    response = client.delete(endpoint + '?version=' + str(w['version']))
    assert response.status_code == 200, response.text
    assert not list((client.app.state.settings.data_dir / 'screenshots').glob('*.jpg'))
    with client.app.state.database.connect() as db:
        assert db.execute('SELECT count(*) FROM step_merge_originals').fetchone()[0] == 0


def test_multiple_groups_undo_after_reordering_preserves_unrelated_steps(client):
    w, _ = recorded(client, values=('a', 'ab', 'x', 'y', 'yz'), changes={
        3: {'action': 'click'}, 4: {'desktop_field_id': [42, 2]}, 5: {'desktop_field_id': [42, 2]}})
    assert len(w['steps']) == 3
    ids = [s['id'] for s in reversed(w['steps'])]
    w = client.post('/api/workflows/' + w['id'] + '/reorder', json={'version': w['version'], 'step_ids': ids}).json()
    merged = w['steps'][0]
    r = client.post(f"/api/workflows/{w['id']}/steps/{merged['id']}/unmerge", json={'version': w['version']})
    assert r.status_code == 200, r.text
    assert [s['value'] for s in r.json()['steps']] == ['y', 'yz', 'x', 'ab']
    assert [s['sequence'] for s in r.json()['steps']] == [1, 2, 3, 4]


def test_failed_image_copy_rolls_back_merge_and_cleans_generated_files(client, monkeypatch):
    w, originals = recorded(client, automatic=False)
    copy = step_merge.shutil.copyfile
    calls = []
    def broken(source, target):
        calls.append(target)
        if len(calls) == 2:
            raise OSError('Test failure')
        return copy(source, target)
    monkeypatch.setattr(step_merge.shutil, 'copyfile', broken)
    with pytest.raises(OSError):
        merge(client, w)
    assert client.get('/api/workflows/' + w['id']).json() == w
    assert len(list((client.app.state.settings.data_dir / 'screenshots').glob('*.jpg'))) == 2 * len(originals)


def test_merged_screenshots_remain_compatible_with_vision(client, provider):
    w, _ = recorded(client)
    client.app.state.settings.api_key = 'fixture-key'
    item = w['steps'][0]
    response = client.post(f"/api/workflows/{w['id']}/steps/{item['id']}/vision", json={'version': w['version']})
    assert response.status_code == 200, response.text
    assert response.json()['steps'][0]['vision']['image_phases'] == ['before', 'after']
    for phase in ('before', 'after'):
        assert client.get(f"/api/workflows/{w['id']}/steps/{item['id']}/screenshots/{phase}").status_code == 200


def test_merge_remaps_narration_and_undo_requires_comparison_again(client):
    w, _ = recorded(client, automatic=False)
    ids = [s['id'] for s in w['steps']]
    voice = {'status': 'ready', 'segments': [{'id': 'segment', 'step_ids': ids, 'comparison': {'status': 'matched'}, 'confirmed': True}]}
    with client.app.state.database.connect(write=True) as db:
        narration.save_narration(db, w['id'], voice)
    response = merge(client, w)
    assert response.status_code == 200, response.text
    merged = response.json(); item = merged['steps'][0]
    segment = merged['narration']['segments'][0]
    assert segment['step_ids'] == [item['id']]
    assert segment['comparison'] is None and not segment['confirmed']
    response = client.post(f"/api/workflows/{w['id']}/steps/{item['id']}/unmerge", json={'version': merged['version']})
    assert response.status_code == 200, response.text
    assert response.json()['narration']['segments'][0]['step_ids'] == ids


def test_different_narrated_steps_and_processing_block_manual_merge(client):
    w, _ = recorded(client, values=('one', 'one connect'), automatic=False)
    voice = {'status': 'ready', 'segments': [
        {'id': str(index), 'step_ids': [s['id']], 'comparison': None, 'confirmed': False}
        for index, s in enumerate(w['steps'])]}
    with client.app.state.database.connect(write=True) as db:
        narration.save_narration(db, w['id'], voice)
    response = merge(client, w)
    assert response.status_code == 422 and 'different narrated steps' in response.text
    voice['status'] = 'processing'
    with client.app.state.database.connect(write=True) as db:
        narration.save_narration(db, w['id'], voice)
    assert merge(client, w).status_code == 409


def test_undo_after_deletions_handles_gaps_in_step_positions(client):
    w, _ = recorded(client, values=('one', 'one connect', 'a', 'b', 'c', 'd', 'e'),
                    changes={index: {'action': 'click'} for index in range(3, 8)})
    merged = w['steps'][0]
    endpoint = '/api/workflows/' + w['id']
    for step_id in [s['id'] for s in w['steps'][1:4]]:
        response = client.delete(endpoint + '/steps/' + step_id + '?version=' + str(w['version']))
        assert response.status_code == 200
        w = response.json()
    response = client.post(endpoint + '/steps/' + merged['id'] + '/unmerge', json={'version': w['version']})
    assert response.status_code == 200, response.text
    assert [s['value'] for s in response.json()['steps']] == ['one', 'one connect', 'd', 'e']
    assert [s['sequence'] for s in response.json()['steps']] == [1, 2, 3, 4]


def test_before_screenshot_retains_its_original_target_geometry(client):
    early = {'auto_id': 'search', 'control_type': 'Edit', 'rect': {'x': 10, 'y': 20, 'width': 100, 'height': 25}}
    later = {**early, 'rect': {'x': 100, 'y': 50, 'width': 100, 'height': 25}}
    w, originals = recorded(client, values=('one', 'one connect'), changes={1: {'desktop_target': early}, 2: {'desktop_target': later}})
    item = w['steps'][0]
    assert item['desktop_target']['rect'] == early['rect']
    assert item['before']['source_step_id'] == originals[0]['id']
    assert item['after']['source_step_id'] == originals[-1]['id']
