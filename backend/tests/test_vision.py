import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import DefaultHttpxClient

from backend.app import vision
from backend.app.config import Settings
from backend.app.main import create_app
from backend.tests.test_workflows import recording

TARGET = {'tag': 'button', 'role': 'button', 'name': 'Save',
          'candidates': [{'selector': 'button[data-testid="save"]', 'strategy': 'testid'}, {'selector': '#save', 'strategy': 'id'}],
          'rect': {'x': 10, 'y': 20, 'width': 100, 'height': 40}, 'viewport_width': 640, 'viewport_height': 400}


@pytest.fixture
def client(tmp_path):
    settings = Settings(tmp_path, 'vision-test-session-token', 'fake-test-key', vision_model='vision-fixture')
    with TestClient(create_app(settings), headers={'Authorization': 'Bearer ' + settings.token}) as api:
        yield api


@pytest.fixture
def provider(monkeypatch):
    state = SimpleNamespace(seen=[], result={'description': 'Select Save to submit the form.', 'candidate_index': 1,
        'confidence': 'high', 'observation': 'A form and its Save button are visible.', 'warning': 'Verify the submission result.'})
    def respond(request):
        state.seen.append(json.loads(request.content))
        return httpx.Response(200, json={'id': 'resp_vision_test', 'object': 'response', 'created_at': 1,
            'model': 'vision-fixture', 'status': 'completed', 'output': [{'id': 'msg_test', 'type': 'message',
                'role': 'assistant', 'status': 'completed', 'content': [{'type': 'output_text', 'annotations': [],
                    'text': json.dumps(state.result)}]}]})
    def http_client(**kwargs):
        assert kwargs['verify'].check_hostname
        return DefaultHttpxClient(**kwargs, transport=httpx.MockTransport(respond))
    monkeypatch.setattr(vision, 'DefaultHttpxClient', http_client)
    return state


def workflow(client, **changes):
    w = recording(client, browser_target=TARGET, selector='button:nth-child(2)', **changes)
    return client.post('/api/workflows/' + w['id'] + '/stop').json()


def url(w):
    return f"/api/workflows/{w['id']}/steps/{w['steps'][0]['id']}/vision"


def test_images_and_dom_produce_reviewable_suggestion_then_explicit_apply(client, provider):
    w = workflow(client)
    w = client.patch('/api/workflows/' + w['id'], json={'title': w['title'], 'version': w['version'], 'recording_context': 'Save the application form.'}).json()
    step = w['steps'][0]
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 200, response.text
    suggested = response.json(); s = suggested['steps'][0]
    assert s['description'] == step['description'] and s['selector'] == step['selector']
    assert s['vision']['selector'] == '#save' and s['vision']['image_phases'] == ['before', 'after']
    payload = provider.seen[0]
    assert payload['model'] == 'vision-fixture' and payload['store'] is False
    assert payload['text']['format']['strict'] is True
    content = payload['input'][1]['content']
    assert len([c for c in content if c['type'] == 'input_image']) == 2
    assert all(c['image_url'].startswith('data:image/jpeg;base64,') for c in content if c['type'] == 'input_image')
    assert json.loads(content[0]['text'])['browser_target'] == TARGET
    assert json.loads(content[1]['text'])['recording_context'] == 'Save the application form.'
    assert 'Save the application form.' not in payload['input'][0]['content']
    assert 'secret=123' not in json.dumps(payload)
    assert client.patch(url(w), json={'version': w['version'], 'suggestion_id': s['vision']['id']}).status_code == 409
    result = client.patch(url(w), json={'version': suggested['version'], 'suggestion_id': s['vision']['id']})
    assert result.status_code == 200
    applied = result.json(); step = applied['steps'][0]
    assert applied['recording_context'] == w['recording_context']
    assert step['selector'] == '#save' and step['description'] == provider.result['description']
    assert step['edited'] and not step['reviewed'] and step['vision']['applied']
    assert client.patch(url(w), json={'version': applied['version'], 'suggestion_id': s['vision']['id']}).status_code == 409


@pytest.mark.parametrize('confidence,index,selector', [('low', 0, ''), ('medium', 1, ''), ('high', None, '')])
def test_uncertain_results_never_change_selectors(client, provider, confidence, index, selector):
    provider.result.update(confidence=confidence, candidate_index=index)
    w = workflow(client)
    result = client.post(url(w), json={'version': w['version']}).json()
    suggestion = result['steps'][0]['vision']
    assert suggestion['selector'] == selector
    applied = client.patch(url(w), json={'version': result['version'], 'suggestion_id': suggestion['id']}).json()
    assert applied['steps'][0]['selector'] == w['steps'][0]['selector']


def test_unrecorded_model_selector_is_rejected_without_mutation(client, provider):
    provider.result['candidate_index'] = 123
    w = workflow(client)
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 503 and 'No steps were changed' in response.text
    assert client.get('/api/workflows/' + w['id']).json() == w


def test_private_metadata_is_removed_and_vision_requires_auth_and_images(client, provider):
    w = workflow(client, sensitive=True, value='do-not-send')
    s = w['steps'][0]
    assert s['browser_target'] is None and s['selector'] == '[private]' and s['value'] == ''
    assert client.post(url(w), headers={'Authorization': ''}, json={'version': w['version']}).status_code == 401
    assert client.post(url(w), json={'version': w['version']}).status_code == 422
    no_images = workflow(client, before={}, after={})
    assert client.post(url(no_images), json={'version': no_images['version']}).status_code == 422
    assert not provider.seen


def test_edits_invalidate_old_suggestions_and_field_selection_is_honored(client, provider):
    w = workflow(client)
    suggested = client.post(url(w), json={'version': w['version']}).json()
    s = suggested['steps'][0]
    edited = client.patch(url(w).removesuffix('/vision'), json={'version': suggested['version'], 'description': 'My own wording.', 'reviewed': True}).json()
    assert client.patch(url(w), json={'version': edited['version'], 'suggestion_id': s['vision']['id']}).status_code == 409
    again = client.post(url(w), json={'version': edited['version']}).json()
    result = client.patch(url(w), json={'version': again['version'], 'suggestion_id': again['steps'][0]['vision']['id'], 'use_description': False, 'use_selector': True}).json()
    assert result['steps'][0]['description'] == 'My own wording.' and result['steps'][0]['selector'] == '#save'
    assert not result['steps'][0]['reviewed']


def test_concurrent_workflow_edit_discards_analysis(client, monkeypatch):
    w = workflow(client)
    def delayed(*_):
        with client.app.state.database.connect(write=True) as db:
            db.execute('UPDATE workflows SET version=version+1 WHERE id=?', (w['id'],))
        return {'description': 'Should not be saved.'}
    monkeypatch.setattr(vision, 'review_step', delayed)
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 409
    current = client.get('/api/workflows/' + w['id']).json()
    assert 'vision' not in current['steps'][0]
    assert current['steps'][0]['description'] == w['steps'][0]['description']


def test_old_steps_can_improve_wording_without_inventing_dom_evidence(client, provider):
    w = workflow(client)
    with client.app.state.database.connect(write=True) as db:
        row = db.execute('SELECT payload FROM steps WHERE id=?', (w['steps'][0]['id'],)).fetchone()
        payload = json.loads(row['payload']); payload.pop('browser_target')
        db.execute('UPDATE steps SET payload=? WHERE id=?', (json.dumps(payload), w['steps'][0]['id']))
    provider.result['candidate_index'] = None
    result = client.post(url(w), json={'version': w['version']})
    assert result.status_code == 200 and result.json()['steps'][0]['vision']['selector'] == ''


def test_desktop_recovery_requires_explicit_confirmation_and_updates_sop(client, provider):
    provider.result.update(candidate_index=None, recovered_value='ram', recovery_evidence='Target after screenshot shows ram.',
                          inferred_intent='Create a folder.', sop_note='Review the Explorer folder path.')
    w=workflow(client, source='desktop', action='input', value='', label='Folder name', text_capture='captured',
               desktop_target={'auto_id':'rename', 'name':'New folder', 'control_type':'Edit'}, app_name='explorer.exe')
    result=client.post(url(w),json={'version':w['version']})
    assert result.status_code==200, result.text
    suggested=result.json(); suggestion=suggested['steps'][0]['vision']
    assert suggested['steps'][0]['value']==''
    assert suggestion['recovered_value']=='ram'
    applied=client.patch(url(w),json={'version':suggested['version'],'suggestion_id':suggestion['id'],
                                    'use_description':False,'use_selector':False,'confirmed_value':'ram corrected'}).json()
    item=applied['steps'][0]
    assert item['value']=='ram corrected' and 'ram corrected' in item['description']
    assert not item['reviewed'] and item['value_recovery']['original_value']==''
    assert 'Explorer folder path' in suggestion['sop_note']


def test_recovery_is_optional_and_missing_evidence_is_not_a_value(client, provider):
    provider.result.update(recovered_value='guessed', recovery_evidence='', candidate_index=None)
    w=workflow(client,action='input',value='')
    suggested=client.post(url(w),json={'version':w['version']}).json()
    assert suggested['steps'][0]['vision']['recovered_value'] is None
    applied=client.patch(url(w),json={'version':suggested['version'],
        'suggestion_id':suggested['steps'][0]['vision']['id']}).json()
    assert applied['steps'][0]['value']=='' and 'value_recovery' not in applied['steps'][0]


def test_context_excludes_private_metadata_and_images(client, provider):
    from backend.tests.test_workflows import step
    w=recording(client, action='input',value='',browser_target=TARGET)
    secret=step(2,action='input',sensitive=True,value='NEVER_SEND_VALUE',label='NEVER_SEND_LABEL')
    assert client.post('/api/workflows/'+w['id']+'/steps',json=secret).status_code==201
    w=client.post('/api/workflows/'+w['id']+'/stop').json()
    assert client.post(url(w),json={'version':w['version']}).status_code==200
    payload=provider.seen[0]; content=payload['input'][1]['content']
    assert len([item for item in content if item['type']=='input_image'])==2
    assert 'NEVER_SEND' not in json.dumps(payload)
    context=json.loads(content[1]['text'])
    assert context['surrounding_steps'][1]=={'position':2,'private':True}


def test_surrounding_step_edit_invalidates_recovery(client, provider):
    w=workflow(client,count=2)
    suggested=client.post(url(w),json={'version':w['version']}).json()
    next_id=w['steps'][1]['id']
    edited=client.patch('/api/workflows/'+w['id']+'/steps/'+next_id,json={
        'version':suggested['version'],'description':'Changed surrounding intent'}).json()
    response=client.patch(url(w),json={'version':edited['version'],'suggestion_id':suggested['steps'][0]['vision']['id']})
    assert response.status_code==409 and 'context changed' in response.text


def test_existing_complete_input_cannot_be_replaced_by_recovery(client, provider):
    w=workflow(client,action='input',value='original')
    provider.result.update(recovered_value='replacement',recovery_evidence='image')
    suggested=client.post(url(w),json={'version':w['version']}).json()
    assert suggested['steps'][0]['vision']['recovered_value'] is None
    r=client.patch(url(w),json={'version':suggested['version'],'suggestion_id':suggested['steps'][0]['vision']['id'],
                              'confirmed_value':'replacement'})
    assert r.status_code==422


@pytest.mark.parametrize('original,capture,confirmed', [('partial','truncated','Complete text'),('','captured','')])
def test_recovery_handles_truncated_and_intentionally_empty_input(client, provider, original, capture, confirmed):
    w=workflow(client,action='input',value=original,text_capture=capture)
    suggested=client.post(url(w),json={'version':w['version']}).json()
    applied=client.patch(url(w),json={'version':suggested['version'],
        'suggestion_id':suggested['steps'][0]['vision']['id'],'confirmed_value':confirmed}).json()
    assert applied['steps'][0]['value']==confirmed
    assert applied['steps'][0]['value_recovery']['original_value']==original


def test_desktop_never_uses_browser_selector_and_context_images_are_labeled(client, provider):
    w=workflow(client,count=2,source='desktop',app_name='explorer.exe')
    provider.result['candidate_index']=100
    response=client.post(url(w),json={'version':w['version']})
    assert response.status_code==200 and response.json()['steps'][0]['vision']['selector']==''
    content=provider.seen[0]['input'][1]['content']
    assert len([c for c in content if c['type']=='input_image'])==3
    assert any(w['steps'][1]['id']+' after screenshot' in c.get('text','') for c in content)


@pytest.mark.parametrize('phase', ['before', 'after'])
def test_missing_target_screenshots_can_use_adjacent_context_only(client, provider, phase):
    from backend.tests.test_workflows import step
    w = recording(client, before={}, after={}, browser_target=TARGET, action='input', value='')
    neighbor = step(2, **{('before' if phase == 'after' else 'after'): {}})
    assert client.post('/api/workflows/' + w['id'] + '/steps', json=neighbor).status_code == 201
    w = client.post('/api/workflows/' + w['id'] + '/stop').json()
    provider.result.update(recovered_value='guessed input', recovery_evidence='adjacent screenshot')
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 200, response.text
    result = response.json(); suggestion = result['steps'][0]['vision']
    assert suggestion['image_phases'] == []
    assert suggestion['image_sources'] == [{'step_id': neighbor['id'], 'phase': phase, 'target': False}]
    assert suggestion['confidence'] == 'low' and suggestion['selector'] == ''
    assert suggestion['recovered_value'] is None and suggestion['recovery_evidence'] == ''
    assert 'context only' in suggestion['warning']
    assert result['steps'][0]['description'] == w['steps'][0]['description']
    assert result['steps'][0]['value'] == ''
    evidence = provider.seen[0]['input'][1]['content']
    assert len([c for c in evidence if c['type'] == 'input_image']) == 1
    assert json.loads(evidence[-1]['text'])['context_only'] is True


@pytest.mark.parametrize('damaged_index', [0, 1])
def test_unreadable_images_do_not_block_remaining_evidence(client, provider, damaged_index):
    w = workflow(client, count=2)
    shot = client.app.state.settings.data_dir / 'screenshots' / w['steps'][damaged_index]['after']['filename']
    shot.write_bytes(b'not an image')
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 200, response.text
    suggestion = response.json()['steps'][0]['vision']
    assert 'unreadable' in suggestion['warning']
    expected = ['before'] if damaged_index == 0 else ['before', 'after']
    assert suggestion['image_phases'] == expected
    if damaged_index == 1:
        assert suggestion['image_sources'][-1] == {'step_id': w['steps'][1]['id'], 'phase': 'before', 'target': False}


def test_missing_files_return_actionable_error_without_contacting_openai(client, provider):
    w = workflow(client)
    for phase in ('before', 'after'):
        (client.app.state.settings.data_dir / 'screenshots' / w['steps'][0][phase]['filename']).unlink()
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 422 and 'No readable screenshots' in response.text
    assert not provider.seen
    assert client.get('/api/workflows/' + w['id']).json() == w


def test_missing_target_images_do_not_use_private_neighbor(client, provider):
    from backend.tests.test_workflows import step
    w = recording(client, before={}, after={}, browser_target=TARGET)
    neighbor = step(2, sensitive=True, label='PRIVATE')
    assert client.post('/api/workflows/' + w['id'] + '/steps', json=neighbor).status_code == 201
    w = client.post('/api/workflows/' + w['id'] + '/stop').json()
    response = client.post(url(w), json={'version': w['version']})
    assert response.status_code == 422 and not provider.seen
