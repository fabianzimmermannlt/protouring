#!/usr/bin/env python3
"""
Generates a PDF for a Zeitplan (schedule) from ProTouring.
Input:  JSON via stdin  { title, content, notFinal }
Output: PDF bytes via stdout
"""
import sys
import json
import re
import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Styles ──────────────────────────────────────────────────────────────────

GRAY    = HexColor('#6b7280')
ORANGE  = HexColor('#f97316')
DARK    = HexColor('#111827')

style_base = ParagraphStyle(
    'base',
    fontName='Helvetica',
    fontSize=10,
    leading=15,
    textColor=DARK,
    spaceAfter=0,
)
style_right = ParagraphStyle(
    'right',
    parent=style_base,
    alignment=TA_RIGHT,
)
style_title = ParagraphStyle(
    'title',
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=DARK,
    spaceAfter=4,
)
style_label = ParagraphStyle(
    'label',
    fontName='Helvetica',
    fontSize=7,
    leading=10,
    textColor=GRAY,
    spaceAfter=2,
    wordWrap='CJK',
)
style_badge = ParagraphStyle(
    'badge',
    fontName='Helvetica-Bold',
    fontSize=7,
    leading=10,
    textColor=white,
    spaceAfter=6,
    backColor=ORANGE,
    borderPadding=(2, 5, 2, 5),
)

# ── HTML cleanup ─────────────────────────────────────────────────────────────

def strip_unsupported(html: str) -> str:
    """Keep only the tags reportlab Paragraph can handle."""
    # Convert <strong> → <b>, <em> → <i>
    html = re.sub(r'<strong>', '<b>', html, flags=re.IGNORECASE)
    html = re.sub(r'</strong>', '</b>', html, flags=re.IGNORECASE)
    html = re.sub(r'<em>', '<i>', html, flags=re.IGNORECASE)
    html = re.sub(r'</em>', '</i>', html, flags=re.IGNORECASE)
    # Remove unsupported tags but keep content
    html = re.sub(r'<(?!/?(?:b|i|u|br|font|a)\b)[^>]+>', '', html)
    return html.strip()

def normalize_content(html: str) -> list[str]:
    """Split content HTML into a list of lines."""
    html = re.sub(r'<div><br\s*/?></div>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<p><br\s*/?></p>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</div>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</p>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<div>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<p>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'\n{3,}', '\n\n', html)
    lines = html.split('\n')
    # Trim trailing empty lines
    while lines and not lines[-1].strip():
        lines.pop()
    return lines

# ── Build flowables ───────────────────────────────────────────────────────────

def build_story(title: str, content: str, not_final: bool) -> list:
    story = []

    # Label
    story.append(Paragraph('ZEITPLAN', style_label))

    # Title
    story.append(Paragraph(title or 'Ohne Titel', style_title))

    # "Noch nicht final" badge
    if not_final:
        story.append(Paragraph('NOCH NICHT FINAL', style_badge))

    story.append(HRFlowable(width='100%', thickness=1.5, color=DARK, spaceAfter=8, spaceBefore=4))

    if not content:
        return story

    lines = normalize_content(content)

    for line in lines:
        plain = re.sub(r'<[^>]+>', '', line).strip()

        # Horizontal rule
        if plain == '---' or re.match(r'^<hr\s*/?>$', line.strip(), re.IGNORECASE):
            story.append(HRFlowable(width='100%', thickness=0.5, color=GRAY, spaceBefore=3, spaceAfter=3))
            continue

        # Left-right separator (-//-)
        if '-//-' in line:
            sep_idx = line.index('-//-')
            left_html  = strip_unsupported(line[:sep_idx])
            right_html = strip_unsupported(line[sep_idx + 4:])
            row = [[
                Paragraph(left_html  or ' ', style_base),
                Paragraph(right_html or ' ', style_right),
            ]]
            t = Table(row, colWidths=['60%', '40%'])
            t.setStyle(TableStyle([
                ('VALIGN',       (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING',  (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING',   (0,0), (-1,-1), 1),
                ('BOTTOMPADDING',(0,0), (-1,-1), 1),
            ]))
            story.append(t)
            continue

        # Empty line → small vertical gap
        if not plain:
            story.append(Spacer(1, 4))
            continue

        # Normal line
        story.append(Paragraph(strip_unsupported(line), style_base))

    return story

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    raw = sys.stdin.read()
    data = json.loads(raw)

    title    = data.get('title', '')
    content  = data.get('content', '')
    not_final = bool(data.get('notFinal', False))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=18*mm,
        bottomMargin=18*mm,
    )

    story = build_story(title, content, not_final)
    doc.build(story)

    sys.stdout.buffer.write(buf.getvalue())

if __name__ == '__main__':
    main()
