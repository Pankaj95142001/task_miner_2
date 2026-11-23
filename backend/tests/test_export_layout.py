from io import BytesIO

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt
from PIL import Image

from backend.app.exporter import generate_docx, generate_pdf, CONTENT_WIDTH, PORTRAIT_SCREENSHOT_HEIGHT


def test_tall_images_fit_page_and_captions_stay_with_their_step(tmp_path):
    screenshots = tmp_path / 'screenshots'
    screenshots.mkdir()
    Image.new('RGB', (400, 2400), '#dee9e1').save(screenshots / 'portrait.png')
    step = {'description': 'Fill the request form.', 'action': 'input', 'tab_id': 1,
            'url': 'https://example.org', 'before': {'filename': 'portrait.png'},
            'after': {'note': 'No after image was captured.'}}
    workflow = {'title': 'Request guide', 'description': 'A sample SOP.',
                'created_at': '2026-10-13', 'steps': [step, step]}
    document = Document(BytesIO(generate_docx(workflow, tmp_path)))
    assert len(document.inline_shapes) == 2
    for image in document.inline_shapes:
        assert image.width <= Pt(CONTENT_WIDTH) + 1
        assert image.height <= Pt(PORTRAIT_SCREENSHOT_HEIGHT) + 1
        assert abs(image.width / image.height - 400 / 2400) < .001
    for index, paragraph in enumerate(document.paragraphs):
        if paragraph.text in ('Step 1', 'Step 2'):
            assert paragraph.paragraph_format.page_break_before is True
        if '| Before action' in paragraph.text:
            assert paragraph.paragraph_format.keep_with_next is True
            assert document.paragraphs[index + 1]._p.findall('.//' + qn('w:drawing'))
        if '| After action' in paragraph.text:
            assert paragraph.paragraph_format.keep_with_next is True
            assert document.paragraphs[index + 1].text == 'Screenshot unavailable.'
    assert any(n.get(qn('w:instr')) == 'PAGE'
               for n in document.sections[0].footer._element.iter(qn('w:fldSimple')))
    # Long instructions must flow; capture notes are omitted from exports.
    step['description'] = 'Explain the process and verify each detail. ' * 110
    step['after']['note'] = 'Additional capture information. ' * 30
    assert generate_pdf(workflow, tmp_path).startswith(b'%PDF')
