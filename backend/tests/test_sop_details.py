from io import BytesIO
import sqlite3
from zipfile import ZipFile
from xml.etree import ElementTree

from backend.app.db import Database
from backend.tests.test_workflows import client, recording, verify


def test_existing_database_migrates_without_changing_recordings(tmp_path):
    with sqlite3.connect(tmp_path/'sop.sqlite3') as db:
        db.execute("CREATE TABLE workflows(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'recording',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1)")
        db.execute("INSERT INTO workflows VALUES('old','Existing','Keep overview','draft','2026-10-01','2026-10-01',8)")
    Database(tmp_path);database=Database(tmp_path)
    with database.connect() as db:
        row=dict(db.execute("SELECT * FROM workflows WHERE id='old'").fetchone())
    assert row['purpose']==row['scope']==row['prerequisites']==row['recording_context']==''
    assert row['description']=='Keep overview' and row['version']==8


def test_purpose_scope_persist_export_and_older_clients_do_not_clear_them(client):
    w=recording(client)
    path='/api/workflows/'+w['id']
    w=client.post(path+'/stop').json();w=verify(client,w)
    fields={'purpose':'Create folders for R&D <planning>.\nKeep tasks repeatable.',
            'scope':'Applies to the Windows Downloads folder.\nExcludes deletion.',
            'prerequisites':'Windows access & write permission.\nPrepare <source> files.'}
    r=client.patch(path,json={'title':w['title'],'description':'Overview','version':w['version'],**fields})
    assert r.status_code==200,r.text
    w=r.json()
    assert w['purpose']==fields['purpose'] and w['scope']==fields['scope']
    assert client.get(path).json()['scope']==fields['scope']
    assert client.get(path).json()['prerequisites']==fields['prerequisites']
    assert client.patch(path,json={'title':'Old client edit','version':w['version']}).json()['purpose']==fields['purpose']
    current=client.get(path).json()
    assert current['prerequisites']==fields['prerequisites']
    assert client.patch(path,json={'title':'Stale','version':w['version'],'scope':'Overwrite'}).status_code==409
    assert client.patch(path,json={'title':'Too long','version':current['version'],'purpose':'x'*5001}).status_code==422
    assert client.patch(path,json={'title':'Too long','version':current['version'],'prerequisites':'x'*5001}).status_code==422
    word=client.get(path+'/export/docx');assert word.status_code==200
    with ZipFile(BytesIO(word.content)) as archive:
        tree=ElementTree.fromstring(archive.read('word/document.xml'))
        ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text=' '.join(n.text or '' for n in tree.findall('.//w:t',ns))
        assert text.index('Purpose')<text.index('Scope')<text.index('Prerequisites')<text.index('Step 1')
        assert 'Create folders for R&D <planning>.' in text and 'Excludes deletion.' in text
        assert 'Windows access & write permission.' in text and 'Prepare <source> files.' in text
    pdf=client.get(path+'/export/pdf');assert pdf.status_code==200 and pdf.content.startswith(b'%PDF')
    cleared=client.patch(path,json={'title':current['title'],'version':current['version'],'purpose':'','scope':'','prerequisites':''})
    assert cleared.status_code==200 and cleared.json()['purpose']==cleared.json()['scope']==cleared.json()['prerequisites']==''


def test_recording_context_is_optional_persistent_editable_and_not_the_overview(client):
    assert client.post('/api/workflows', json={'title': 'Blank context'}).json()['recording_context'] == ''
    w = client.post('/api/workflows', json={'title': 'Access ticket', 'recording_context': '  Request Claude access in One Connect.  '}).json()
    path = '/api/workflows/' + w['id']
    context = 'Request Claude access in One Connect.'
    assert w['recording_context'] == context and w['description'] == ''
    assert client.get(path).json()['recording_context'] == context
    assert client.patch(path, json={'title': w['title'], 'version': w['version'], 'recording_context': 'Change while recording'}).status_code == 409
    w = client.post(path + '/stop').json()
    w = client.patch(path, json={'title': w['title'], 'version': w['version'], 'description': 'Observed task overview.'}).json()
    assert w['recording_context'] == context and w['description'] == 'Observed task overview.'
    assert client.patch(path, json={'title': w['title'], 'version': w['version'] - 1, 'recording_context': 'Stale'}).status_code == 409
    assert client.post('/api/workflows', json={'title': 'Too long', 'recording_context': 'x' * 2001}).status_code == 422
    assert client.patch(path, json={'title': w['title'], 'version': w['version'], 'recording_context': 'x' * 2001}).status_code == 422
    updated = client.patch(path, json={'title': w['title'], 'version': w['version'], 'description': w['description'], 'recording_context': 'Only record searching the portal.'}).json()
    assert updated['recording_context'] == 'Only record searching the portal.'
    assert updated['description'] == w['description']
    cleared = client.patch(path, json={'title': w['title'], 'version': updated['version'], 'recording_context': '  '}).json()
    assert cleared['recording_context'] == ''
