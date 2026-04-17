'use strict';
/**
 * Generates a PDF for a TerminSchedule using pdfkit.
 * Usage: generateSchedulePdf(schedule) → Promise<Buffer>
 */

const PDFDocument = require('pdfkit');

// ── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '');
}

function normalizeContent(html) {
  if (!html) return [];
  let s = html
    .replace(/<div><br\s*\/?><\/div>/gi, '\n')
    .replace(/<p><br\s*\/?><\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div>/gi, '')
    .replace(/<p>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
  const lines = s.split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/**
 * Parse a line into segments: [{text, bold}]
 * Handles <b>, <strong>, <i>, <em> tags (i/em rendered normal – pdfkit needs TTF for italic).
 */
function parseSegments(html) {
  const segments = [];
  const re = /<(\/?)(?:b|strong|i|em)\b[^>]*>/gi;
  let bold = false;
  let last = 0;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match.index > last) {
      segments.push({ text: stripHtml(html.slice(last, match.index)), bold });
    }
    const closing = match[1] === '/';
    const tag = match[0].replace(/<\/?/, '').replace(/>.*/, '').toLowerCase();
    if (tag === 'b' || tag === 'strong') bold = !closing;
    last = re.lastIndex;
  }
  if (last < html.length) {
    segments.push({ text: stripHtml(html.slice(last)), bold });
  }
  return segments.filter(s => s.text);
}

// ── Core renderer ─────────────────────────────────────────────────────────────

const MARGIN_H = 56;   // ~20mm
const MARGIN_V = 51;   // ~18mm
const PAGE_W   = 595;
const CONTENT_W = PAGE_W - MARGIN_H * 2;

const FONT_REG  = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const SIZE_BODY = 10;
const SIZE_TITLE = 18;
const SIZE_LABEL = 7;
const LINE_H = 15;

function drawSegments(doc, segments, x, y, rightAligned = false) {
  if (rightAligned) {
    // measure total width, then draw right-to-left
    const total = segments.reduce((acc, seg) => {
      doc.font(seg.bold ? FONT_BOLD : FONT_REG).fontSize(SIZE_BODY);
      return acc + doc.widthOfString(seg.text);
    }, 0);
    let cx = x - total;
    for (const seg of segments) {
      doc.font(seg.bold ? FONT_BOLD : FONT_REG).fontSize(SIZE_BODY);
      doc.text(seg.text, cx, y, { continued: false, lineBreak: false });
      cx += doc.widthOfString(seg.text);
    }
  } else {
    let cx = x;
    for (const seg of segments) {
      doc.font(seg.bold ? FONT_BOLD : FONT_REG).fontSize(SIZE_BODY);
      doc.text(seg.text, cx, y, { continued: false, lineBreak: false });
      cx += doc.widthOfString(seg.text);
    }
  }
}

function generateSchedulePdf(schedule) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN_V, bottom: MARGIN_V, left: MARGIN_H, right: MARGIN_H },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = MARGIN_V;
    const bottom = 842 - MARGIN_V;

    function ensureSpace(needed) {
      if (y + needed > bottom) {
        doc.addPage();
        y = MARGIN_V;
      }
    }

    // ── Header ──
    doc.font(FONT_REG).fontSize(SIZE_LABEL).fillColor('#6b7280')
      .text('ZEITPLAN', MARGIN_H, y, { lineBreak: false });
    y += 11;

    doc.font(FONT_BOLD).fontSize(SIZE_TITLE).fillColor('#111827')
      .text(schedule.title || 'Ohne Titel', MARGIN_H, y, { width: CONTENT_W, lineBreak: false });
    y += 24;

    if (schedule.notFinal) {
      doc.rect(MARGIN_H, y, 90, 14).fill('#f97316');
      doc.font(FONT_BOLD).fontSize(7).fillColor('#ffffff')
        .text('NOCH NICHT FINAL', MARGIN_H + 5, y + 3, { lineBreak: false });
      y += 18;
    }

    // Title rule
    y += 4;
    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
      .lineWidth(1.5).strokeColor('#111827').stroke();
    y += 10;

    // ── Content ──
    const lines = normalizeContent(schedule.content);

    // Erster Pass: breiteste linke UND rechte Seite messen
    let maxLeftW = 0;
    let maxRightW = 0;
    doc.font(FONT_BOLD).fontSize(SIZE_BODY);
    for (const line of lines) {
      if (line.includes('-//-')) {
        const sep = line.indexOf('-//-');
        const lw = doc.widthOfString(stripHtml(line.slice(0, sep)).trim());
        if (lw > maxLeftW) maxLeftW = lw;
      }
    }
    doc.font(FONT_REG).fontSize(SIZE_BODY);
    for (const line of lines) {
      if (line.includes('-//-')) {
        const sep = line.indexOf('-//-');
        const rw = doc.widthOfString(stripHtml(line.slice(sep + 4)).trim());
        if (rw > maxRightW) maxRightW = rw;
      }
    }
    // Tab hinter längstem linken Text + Abstand; rechte Spalte endet bei tabX + maxRightW
    const tabX      = MARGIN_H + (maxLeftW > 0 ? maxLeftW + 22 : 50);
    const rightColEnd = tabX + (maxRightW > 0 ? maxRightW : 150);

    for (const line of lines) {
      ensureSpace(LINE_H + 4);

      const plain = stripHtml(line).trim();

      // Horizontal rule
      if (plain === '---' || /^<hr\s*\/?>$/i.test(line.trim())) {
        y += 3;
        doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
          .lineWidth(0.5).strokeColor('#9ca3af').stroke();
        y += 6;
        continue;
      }

      // Zwei-Spalten-Zeile mit -//-
      // Linke Spalte RECHTSBÜNDIG zu tabX, rechte Spalte linksbündig ab tabX+4
      if (line.includes('-//-')) {
        const idx = line.indexOf('-//-');
        const leftText  = stripHtml(line.slice(0, idx)).trim();
        const rightText = stripHtml(line.slice(idx + 4)).trim();
        const lineY = y;
        doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor('#6b7280')
          .text(leftText, MARGIN_H, lineY, { lineBreak: false });
        doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor('#111827');
        const rw = doc.widthOfString(rightText);
        doc.text(rightText, rightColEnd - rw, lineY, { lineBreak: false });
        y = lineY + LINE_H + 4;
        continue;
      }

      // Empty line
      if (!plain) {
        y += 4;
        continue;
      }

      // Normal line
      const segs = parseSegments(line);
      doc.fillColor('#111827');
      drawSegments(doc, segs, MARGIN_H, y);
      y += LINE_H;
    }

    doc.end();
  });
}

module.exports = { generateSchedulePdf };
