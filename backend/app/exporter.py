from io import BytesIO
from .annotations import annotated_screenshot
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote
from xml.sax.saxutils import escape

from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer


def export_disposition(title, kind):
    name = unicodedata.normalize("NFC", title)
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f]', '-', name).strip('. ')[:100].rstrip('. ') or 'SOP'
    if re.match(r'^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)', name, re.I):
        name = '_' + name
    filename = f'{name}.{kind}'
    fallback = name.encode('ascii', 'ignore').decode().strip('. ') or 'SOP'
    return f'attachment; filename="{fallback}.{kind}"; filename*=UTF-8\'\'{quote(filename, safe="")}'


def screenshot_path(directory, snapshot):
    filename = snapshot.get("filename")
    return directory / "screenshots" / filename if filename else None


PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_MARGIN = 50
TITLE_BLUE = '1D4ED8'
CONTENT_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN - 12
SCREENSHOT_HEIGHT = 250
PORTRAIT_SCREENSHOT_HEIGHT = 550


def screenshot_asset(directory, step, phase):
    path = screenshot_path(directory, step[phase])
    if not path or not path.is_file():
        return None
    rendered = annotated_screenshot(path, step, phase) or str(path)
    width, height = ImageReader(rendered).getSize()
    max_height = PORTRAIT_SCREENSHOT_HEIGHT if height > width else SCREENSHOT_HEIGHT
    ratio = min(CONTENT_WIDTH / width, max_height / height)
    if hasattr(rendered, 'seek'):
        rendered.seek(0)
    return rendered, width * ratio, height * ratio


def screenshot_heading(index, phase):
    return f"Step {index} | {phase.title()} action"


def generate_docx(workflow, directory):
    doc = Document()
    doc.core_properties.title = workflow["title"]
    section = doc.sections[0]
    section.page_width, section.page_height = Pt(PAGE_WIDTH), Pt(PAGE_HEIGHT)
    section.left_margin = section.right_margin = Pt(PAGE_MARGIN)
    section.top_margin = section.bottom_margin = Pt(45)
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(8)
    style.paragraph_format.widow_control = True
    for name in ('Title', 'Heading 1', 'Heading 2'):
        doc.styles[name].font.color.rgb = RGBColor.from_string('153E38')
    caption_style = doc.styles['Caption']
    caption_style.font.size = Pt(8)
    caption_style.font.color.rgb = RGBColor.from_string('617363')
    caption_style.paragraph_format.space_after = Pt(5)
    caption_style.paragraph_format.keep_with_next = False
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('SOP Studio | Page ').font.size = Pt(9)
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    footer._p.append(field)
    title = doc.add_heading(workflow["title"], 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.bold = True
        run.font.size = Pt(26)
        run.font.color.rgb = RGBColor.from_string(TITLE_BLUE)
    subtitle = doc.add_paragraph("STANDARD OPERATING PROCEDURE")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if workflow["description"]:
        doc.add_paragraph(workflow["description"])
    doc.add_paragraph(f'{len(workflow["steps"])} verified steps | Created {workflow["created_at"][:10]}')
    for field, heading in (('purpose', 'Purpose'), ('scope', 'Scope'), ('prerequisites', 'Prerequisites')):
        if workflow.get(field, '').strip():
            doc.add_heading(heading, 1)
            doc.add_paragraph(workflow[field])
    for index, step in enumerate(workflow["steps"], 1):
        heading = doc.add_heading(f"Step {index}", 1)
        heading.paragraph_format.page_break_before = True
        doc.add_paragraph(step["description"])
        for phase in ("before", "after"):
            caption_p = doc.add_paragraph(screenshot_heading(index, phase), style="Caption")
            caption_p.paragraph_format.keep_with_next = True
            caption_p.paragraph_format.space_before = Pt(10)
            asset = screenshot_asset(directory, step, phase)
            if asset:
                rendered, width, height = asset
                picture = doc.add_paragraph()
                picture.alignment = WD_ALIGN_PARAGRAPH.CENTER
                picture.paragraph_format.keep_together = True
                picture.paragraph_format.space_after = Pt(0)
                picture.add_run().add_picture(rendered, width=Pt(width), height=Pt(height))
            else:
                doc.add_paragraph("Screenshot unavailable.")
    output = BytesIO()
    doc.save(output)
    return output.getvalue()


def generate_pdf(workflow, directory):
    output = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Caption", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.HexColor("#617363")))
    # Use a local Unicode font when available. ReportLab's base fonts are fallback.
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    fonts = [(Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
             (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
              Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))]
    bold_font = "Helvetica-Bold"
    for regular, bold in fonts:
        if regular.exists():
            if "SOPUnicode" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("SOPUnicode", str(regular)))
            for style in styles.byName.values():
                style.fontName = "SOPUnicode"
            if bold.exists():
                if "SOPUnicodeBold" not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont("SOPUnicodeBold", str(bold)))
                bold_font = "SOPUnicodeBold"
            break
    styles["Title"].fontName = bold_font
    styles["Title"].fontSize = 26
    styles["Title"].leading = 32
    styles["Title"].alignment = TA_CENTER
    styles["Title"].textColor = colors.HexColor('#' + TITLE_BLUE)
    styles['Heading2'].textColor = colors.HexColor("#153e38")
    styles.add(ParagraphStyle("Subtitle", parent=styles["Caption"], alignment=TA_CENTER))
    styles["BodyText"].leading = 16
    story = [Paragraph(escape(workflow["title"]), styles["Title"]),
             Paragraph("STANDARD OPERATING PROCEDURE", styles["Subtitle"]), Spacer(1, 16)]
    if workflow["description"]:
        story.append(Paragraph(escape(workflow["description"]).replace("\n", "<br/>"), styles["BodyText"]))
    story.append(Paragraph(f'{len(workflow["steps"])} verified steps | {workflow["created_at"][:10]}', styles["Caption"]))
    for field, heading in (('purpose', 'Purpose'), ('scope', 'Scope'), ('prerequisites', 'Prerequisites')):
        if workflow.get(field, '').strip():
            story.extend([Spacer(1, 12), Paragraph(heading, styles['Heading2']),
                          Paragraph(escape(workflow[field]).replace('\n', '<br/>'), styles['BodyText'])])
    for index, step in enumerate(workflow["steps"], 1):
        story.extend([PageBreak(), Paragraph(f"Step {index}", styles["Heading2"]),
                      Paragraph(escape(step["description"]).replace("\n", "<br/>"), styles["BodyText"])])
        for phase in ("before", "after"):
            block = [Paragraph(escape(screenshot_heading(index, phase)), styles["Caption"]), Spacer(1, 5)]
            asset = screenshot_asset(directory, step, phase)
            if asset:
                rendered, width, height = asset
                block.append(Image(rendered, width, height, hAlign='CENTER'))
            else:
                block.append(Paragraph("Screenshot unavailable.", styles["BodyText"]))
            story.extend([Spacer(1, 10), KeepTogether(block)])

    def footer(canvas, _doc):
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(PAGE_WIDTH - PAGE_MARGIN, 25, f"SOP Studio | Page {canvas.getPageNumber()}")

    SimpleDocTemplate(output, title=workflow["title"], pagesize=A4,
                      leftMargin=PAGE_MARGIN, rightMargin=PAGE_MARGIN,
                      topMargin=45, bottomMargin=45).build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
