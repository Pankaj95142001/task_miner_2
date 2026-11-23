import json
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile
from uuid import uuid4

import pytest

from backend.app import narration
from backend.tests.test_workflows import client, step

START = '2026-10-15T10:00:00+00:00'
AUDIO = b'\x1aE\xdf\xa3test-audio-fixture'
WORDS = [dict(word='Enter',start=1,end=2),dict(word='12345.',start=2,end=3),
         dict(word='Next',start=5,end=5.3),dict(word='step.',start=5.4,end=6),
         dict(word='Click',start=7,end=8),dict(word='Search.',start=8,end=9)]


def seed(client):
    w=client.post('/api/workflows',json={'title':'Narration test'}).json()
    path='/api/workflows/'+w['id']
    for i,action in enumerate(['input','click'],1):
        item=step(i,action=action,occurred_at=f'2026-10-15T10:00:0{4 if i==1 else 9}+00:00',
                  label='Employee ID' if i==1 else 'Search',value='12354' if i==1 else '')
        assert client.post(path+'/steps',json=item).status_code==201
    return client.post(path+'/stop').json(),path


def upload(client,path):
    return client.post(path+'/narration/audio',params={'started_at':START,'duration':12},content=AUDIO,headers={'Content-Type':'audio/webm'})


def fake_compare(_settings,segment,steps):
    return {'status':'mismatch' if steps[0]['action']=='input' else 'matched', 'reason':'Check the captured evidence.',
        'suggestions':[{'step_id':s['id'],'description':s['description'],'purpose':'Find the employee record.',
                        'expected_result':'Matching records should appear.','validation':'Check the displayed employee ID.',
                        'notes':'Review any differing value.','spoken_value':None} for s in steps]}


def process(client,path,w,monkeypatch):
    client.app.state.settings.api_key='test-key'
    monkeypatch.setattr(narration,'transcribe',lambda *_:WORDS)
    monkeypatch.setattr(narration,'compare_segment',fake_compare)
    r=client.post(path+'/narration/process',json={'version':w['version']})
    assert r.status_code==200,r.text
    return client.get(path).json()


def test_spoken_boundaries_and_silent_actions():
    steps=[{'id':'one','occurred_at':'2026-10-15T10:00:04Z'}, {'id':'two','occurred_at':'2026-10-15T10:00:09Z'}]
    segments=narration.split_segments(WORDS,START,12,steps)
    assert [s['step_ids'] for s in segments]==[['one'],['two']]
    assert [s['transcript'] for s in segments]==['Enter 12345.','Click Search.']
    assert narration.split_segments([],START,12,steps)[0]['step_ids']==['one','two']
    with pytest.raises(ValueError): narration.split_segments([dict(word='bad',start=float('nan'),end=1)],START,12,steps)


def test_audio_auth_retry_comparison_accept_and_exports(client,monkeypatch):
    w,path=seed(client)
    r=upload(client,path);assert r.status_code==200,r.text
    w=r.json();version=w['version']
    assert upload(client,path).json()['version']==version
    assert client.get(path+'/narration/audio',headers={'Authorization':''}).status_code==401
    assert client.get(path+'/narration/audio').content==AUDIO
    assert client.post(path+'/narration/process',json={'version':version}).status_code==503
    w=process(client,path,w,monkeypatch)
    assert w['narration']['status']=='ready'
    assert len(w['narration']['segments'])==2
    assert not w['steps'][0].get('narration_context')
    group=w['narration']['segments'][0]
    r=client.post(path+'/narration/segments/'+group['id']+'/accept',json={'version':w['version']})
    assert r.status_code==200,r.text
    w=r.json()
    assert w['steps'][0]['value']=='12354'
    assert w['steps'][0]['narration_context']['transcript']=='Enter 12345.'
    assert w['steps'][0]['narration_details']['purpose']=='Find the employee record.'
    assert not w['steps'][0]['reviewed']
    from backend.tests.test_workflows import verify
    w=verify(client,w)
    with ZipFile(BytesIO(client.get(path+'/export/docx').content)) as archive:
        xml=archive.read('word/document.xml').decode()
        assert 'Expected result:' not in xml and 'Find the employee record.' not in xml
    assert client.get(path+'/export/pdf').content.startswith(b'%PDF')
    audio_path=client.app.state.settings.data_dir/'narration'/f'{w["id"]}.webm'
    assert audio_path.exists()
    assert client.delete(path,params={'version':w['version']}).status_code==200
    assert not audio_path.exists()


def test_transcript_edits_clear_comparison_and_prevent_overlapping_assignments(client,monkeypatch):
    w,path=seed(client);w=process(client,path,upload(client,path).json(),monkeypatch)
    a,b=w['narration']['segments']
    url=path+'/narration/segments/'+a['id']
    assert client.patch(url,json={'version':w['version'],'transcript':'Corrected','step_ids':b['step_ids']}).status_code==422
    r=client.patch(url,json={'version':w['version'],'transcript':'Enter 12354.','step_ids':a['step_ids']})
    assert r.status_code==200
    updated=r.json();assert updated['narration']['segments'][0]['comparison'] is None
    assert client.post(url+'/accept',json={'version':updated['version']}).status_code==409
    assert client.patch(url,json={'version':w['version'],'transcript':'Old','step_ids':a['step_ids']}).status_code==409


def test_comparison_failure_retains_transcription_and_audio(client,monkeypatch):
    w,path=seed(client);w=upload(client,path).json()
    client.app.state.settings.api_key='test-key'
    monkeypatch.setattr(narration,'transcribe',lambda *_:WORDS)
    def fail(*_):raise RuntimeError('private provider response')
    monkeypatch.setattr(narration,'compare_segment',fail)
    client.post(path+'/narration/process',json={'version':w['version']})
    w=client.get(path).json()
    assert w['narration']['status']=='error' and w['narration']['transcribed']
    assert 'private provider' not in w['narration']['error']
    assert client.get(path+'/narration/audio').content==AUDIO
    monkeypatch.setattr(narration,'transcribe',fail)
    monkeypatch.setattr(narration,'compare_segment',fake_compare)
    client.post(path+'/narration/process',json={'version':w['version']})
    assert client.get(path).json()['narration']['status']=='ready'


def test_private_or_missing_evidence_never_calls_comparison_model():
    segment={'transcript':'Enter the password'}
    assert narration.compare_segment(None,segment,[{'sensitive':True}])['status']=='needs_review'
    assert narration.compare_segment(None,segment,[])['status']=='needs_review'
    assert narration.compare_segment(None,{'transcript':''},[{'id':'a'}])['status']=='needs_review'


def test_upload_rejects_recording_invalid_type_and_large_audio(client,monkeypatch):
    w=client.post('/api/workflows',json={'title':'Active'}).json();path='/api/workflows/'+w['id']
    assert upload(client,path).status_code==409
    client.post(path+'/stop')
    assert client.post(path+'/narration/audio',params={'started_at':START,'duration':12},content=AUDIO,headers={'Content-Type':'text/plain'}).status_code==422
    monkeypatch.setattr('backend.app.narration_routes.MAX_AUDIO',10)
    assert upload(client,path).status_code==413


def test_button_name_next_step_is_not_a_spoken_boundary():
    words=[dict(word='Click',start=1,end=1.3),dict(word='next',start=1.3,end=1.6),
           dict(word='step.',start=1.6,end=2),dict(word='Next',start=4,end=4.3),
           dict(word='step.',start=4.3,end=4.6),dict(word='Save.',start=6,end=7)]
    groups=narration.split_segments(words,START,10,[])
    assert [g['transcript'] for g in groups]==['Click next step.','Save.']


def test_changed_captured_value_invalidates_accepted_narration_context():
    captured={'id':'one','action':'input','value':'12354','label':'Employee ID'}
    group={'step_ids':['one'],'confirmed':True,'transcript':'Enter 12345.','comparison':{'status':'mismatch'},'basis':narration.evidence_hash([captured])}
    assert narration.attach_context([dict(captured)],{'segments':[group]})[0]['narration_context']['reviewed']
    changed={**captured,'value':'12345'}
    assert 'narration_context' not in narration.attach_context([changed],{'segments':[group]})[0]
