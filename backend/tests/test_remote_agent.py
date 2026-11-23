from io import BytesIO
import json
from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.remote_bundle import FILES
from backend.desktop.agent import backend_url, make_config, single_instance
from backend.desktop.engine import DesktopRecorder
from backend.tests.test_desktop import DesktopFixture

HOST = {'kind':'remote_agent','agent_id':str(uuid4()),'machine':'REMOTE-TEST'}


@pytest.mark.parametrize('value', ['http://remote-pc:8000','https://user:password@host','https://host/api',
    'https://host?token=secret','file:///C:/test','https://host#fragment','https://host:bad'])
def test_agent_rejects_unsafe_endpoints(value):
    with pytest.raises(ValueError): backend_url(value)


def test_agent_accepts_https_and_loopback_tunnel():
    assert backend_url('https://sop.example.org/')=='https://sop.example.org'
    assert backend_url('http://127.0.0.1:18000')=='http://127.0.0.1:18000'


def test_config_never_persists_token_and_requires_original_backend_for_recovery(tmp_path):
    config=make_config(tmp_path,'https://sop.example.org','secret-session-token','Remote task')
    assert config['capture_host']['agent_id']
    assert 'secret-session-token' not in ''.join(p.read_text() for p in tmp_path.glob('*') if p.is_file())
    folder=tmp_path/'recording';folder.mkdir()
    (folder/'session.json').write_text(json.dumps({'api':'https://sop.example.org'}))
    with pytest.raises(ValueError,match='unfinished'): make_config(tmp_path,config['api'],config['token'],'new')
    with pytest.raises(ValueError,match='another backend'): make_config(tmp_path,'https://other.example.org',config['token'],'new',True)
    assert make_config(tmp_path,config['api'],config['token'],'recover',True)['recover']


@pytest.mark.skipif(__import__('os').name!='nt',reason='Windows lock')
def test_agent_single_instance(tmp_path):
    with single_instance(tmp_path):
        with pytest.raises(ValueError,match='already running'):
            with single_instance(tmp_path): pass
    with single_instance(tmp_path): pass


def test_remote_engine_upload_recovery_targets_and_sop_export(tmp_path):
    with TestClient(create_app(Settings(tmp_path/'server','remote-test-session-token')),
                    headers={'Authorization':'Bearer remote-test-session-token'}) as api:
        assert api.get('/api/settings').json()['remote_agent_capture']
        archive=api.get('/api/remote-recorder/download')
        assert archive.status_code==200
        assert api.get('/api/remote-recorder/download',headers={'Authorization':''}).status_code==401
        with ZipFile(BytesIO(archive.content)) as z:
            assert set(z.namelist())=={'sop-remote-recorder/'+name for name in FILES}
            assert not any(name.endswith('.env') or 'session-token' in name for name in z.namelist())
        native=DesktopFixture();now=[1000.0];offline=[False]
        native.target_at=lambda *args: {'auto_id':'save','name':'Save','control_type':'Button'}
        def upload(route,data):
            if offline[0]: raise OSError('disconnected')
            r=api.post('/api'+route,json=data);assert r.is_success,r.text;return r.json()
        config={'directory':str(tmp_path/'agent'),'title':'Remote flow','api':'https://sop.example.org','capture_host':HOST}
        engine=DesktopRecorder(config,native,api=upload,clock=lambda:now[0]);engine.start()
        now[0]+=3.1;engine.tick()
        now[0]+=.1;engine.handle({'kind':'click','hwnd':11,'x':20,'y':50,'time':now[0]})
        class Field:
            identity=(1,)
            def read(self):return {'text_capture':'captured','value':'Sample text','sensitive':False,'label':'Name',
                'desktop_target':{'auto_id':'name','name':'Name','control_type':'Edit'}}
        native.field=Field()
        now[0]+=.1;engine.handle({'kind':'typing','hwnd':11,'time':now[0]})
        now[0]+=2;engine.tick()
        offline[0]=True;engine.stop();engine.pump()
        assert engine.phase=='error' and engine.manifest_path.exists()
        wrong=DesktopRecorder({**config,'api':'https://wrong.example.org'},api=upload)
        with pytest.raises(RuntimeError,match='same backend'):wrong.recover()
        offline[0]=False
        recovery=DesktopRecorder(config,api=upload);recovery.recover();recovery.pump()
        assert recovery.phase=='done'
        workflow=api.get('/api/workflows/'+engine.manifest['id']).json()
        assert all(s['capture_host']==HOST for s in workflow['steps'])
        click=next(s for s in workflow['steps'] if s['action']=='click')
        assert click['desktop_target']['auto_id']=='save' and click['after']['filename']
        typed=next(s for s in workflow['steps'] if s['action']=='input')
        assert typed['value']=='Sample text' and typed['desktop_target']['auto_id']=='name'
        from backend.tests.test_workflows import verify
        workflow=verify(api,workflow)
        assert api.get('/api/workflows/'+workflow['id']+'/export/pdf').content.startswith(b'%PDF')
