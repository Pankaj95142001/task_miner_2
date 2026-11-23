from io import BytesIO
from zipfile import ZipFile

from PIL import Image
from fastapi.testclient import TestClient

from backend.app.annotations import GREEN, annotated_screenshot, highlight_box
from backend.app.config import Settings
from backend.app.main import create_app
from backend.desktop.text_capture import target_metadata
from backend.tests.test_workflows import recording, verify


def browser_step(**changes):
    return {'action':'input','source':'browser','url':'https://example.org/task', 'before':{},
        'browser_target':{'rect':{'x':100,'y':80,'width':200,'height':40},'viewport_width':640,'viewport_height':400},**changes}


def test_box_scales_css_pixels_and_keeps_original(tmp_path):
    path=tmp_path/'original.jpg';Image.new('RGB',(1280,800),'white').save(path)
    original=path.read_bytes();s=browser_step()
    result=annotated_screenshot(path,s,'before')
    image=Image.open(result)
    assert image.getpixel((200,160))==GREEN
    assert image.getpixel((400,200))==(255,255,255)
    assert path.read_bytes()==original
    assert annotated_screenshot(path,s,'after') is None
    assert annotated_screenshot(path,{**s,'sensitive':True},'before') is None
    assert highlight_box(s,'before',(1280,600)) is None


def test_desktop_bounds_support_negative_monitors_and_input():
    s={'action':'input','source':'desktop','before':{'desktop_bounds':{'left':-1280,'top':-200,'width':3200,'height':1280}},
       'desktop_target':{'rect':{'x':-1000,'y':0,'width':400,'height':100}}}
    assert highlight_box(s,'before',(1600,640))==(140,100,340,150)
    assert highlight_box({**s,'before':{}},'before',(1600,640)) is None


def test_legacy_click_gets_point_box_and_invalid_targets_are_skipped():
    s={'action':'click','source':'desktop','coordinates':{'space':'desktop','screen_x':-100,'screen_y':50,
       'desktop_left':-1280,'desktop_top':-200,'desktop_width':3200,'desktop_height':1280}}
    assert highlight_box(s,'before',(1600,640))==(584,119,596,131)
    assert highlight_box(browser_step(browser_target=None),'before',(640,400)) is None
    assert highlight_box(browser_step(before={'url':'https://example.org/elsewhere'}),'before',(640,400)) is None
    assert highlight_box(browser_step(action='navigate'),'before',(640,400)) is None
    s=browser_step();s['browser_target']['rect']['x']=900
    assert highlight_box(s,'before',(640,400)) is None


def test_desktop_uia_bounds_are_optional_and_private_stays_hidden():
    from types import SimpleNamespace as NS
    e=NS(CurrentIsPassword=False,CurrentAutomationId='name',CurrentName='Name',CurrentControlType=50004,
         CurrentBoundingRectangle=NS(left=-100,top=30,right=100,bottom=70))
    assert target_metadata(e)['rect']=={'x':-100,'y':30,'width':200,'height':40}
    e.CurrentIsPassword=True
    assert target_metadata(e) is None


def test_review_and_exports_use_highlights_but_raw_endpoint_stays_original(tmp_path):
    target={**browser_step()['browser_target'],'tag':'input','name':'Name','candidates':[]}
    with TestClient(create_app(Settings(tmp_path,'annotation-test-token')),
                    headers={'Authorization':'Bearer annotation-test-token'}) as api:
        w=recording(api,action='input',browser_target=target,value='Example',url='https://example.org')
        w=api.post('/api/workflows/'+w['id']+'/stop').json()
        w=verify(api,w)
        base='/api/workflows/'+w['id']
        step=w['steps'][0]
        route=base+'/steps/'+step['id']+'/screenshots/before'
        raw=api.get(route).content
        r=api.get(route+'?annotated=true');assert r.status_code==200
        assert r.headers['content-type']=='image/png'
        assert Image.open(BytesIO(r.content)).getpixel((100,80))==GREEN
        assert api.get(route).content==raw
        assert api.get(route+'?annotated=true',headers={'Authorization':''}).status_code==401
        word=api.get(base+'/export/docx');assert word.status_code==200
        with ZipFile(BytesIO(word.content)) as archive:
            images=[Image.open(BytesIO(archive.read(n))).convert('RGB') for n in archive.namelist() if n.startswith('word/media/')]
            assert any(im.getpixel((100,80))==GREEN for im in images)
        pdf=api.get(base+'/export/pdf');assert pdf.status_code==200 and pdf.content.startswith(b'%PDF')


def test_partly_visible_rect_is_clipped_and_subpixel_edge_is_skipped():
    s=browser_step();s['browser_target']['rect']={'x':-50,'y':30,'width':100,'height':40}
    assert highlight_box(s,'before',(640,400))==(0,30,50,70)
    s['browser_target']['rect']={'x':639.9,'y':30,'width':100,'height':40}
    assert highlight_box(s,'before',(640,400)) is None
