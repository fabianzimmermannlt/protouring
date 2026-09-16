'use strict';
/**
 * Generates a PDF for a TerminSchedule using pdfkit.
 * Usage: generateSchedulePdf(schedule) → Promise<Buffer>
 */

const PDFDocument = require('pdfkit');

// ── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Inline-Formatierungs-Tags, die beim Zeilen-Split über Balancing erhalten bleiben müssen.
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'span', 'mark', 'sub', 'sup', 'small']);

// Tags, die über einen Zeilenumbruch (<br>) gehen, zerreißen beim Split in Zeilen.
// balanceLines schließt am Zeilenende alle noch offenen Inline-Tags und öffnet sie
// am Anfang der nächsten Zeile erneut – so bleibt Fett/Unterstrichen je Zeile intakt.
function balanceLines(lines) {
  const open = []; // { tag, full } der aktuell offenen Inline-Tags
  return lines.map(line => {
    let out = open.map(t => t.full).join('') + line;
    const re = /<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const selfClosing = m[3] === '/';
      if (!INLINE_TAGS.has(tag) || selfClosing) continue;
      if (closing) {
        for (let i = open.length - 1; i >= 0; i--) { if (open[i].tag === tag) { open.splice(i, 1); break; } }
      } else {
        open.push({ tag, full: m[0] });
      }
    }
    out += open.map(t => `</${t.tag}>`).reverse().join('');
    return out;
  });
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
  const lines = balanceLines(s.split('\n'));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

// Inline-Text säubern: Tags weg, Entities dekodieren – aber NICHT trimmen
// (sonst gingen Leerzeichen zwischen formatierten Segmenten verloren).
function cleanInline(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parse a line into segments: [{text, bold, underline, strike}]
 * Behandelt <b>/<strong>, <u>/<ins>, <s>/<strike>/<del>. i/em wird normal
 * gerendert (pdfkit bräuchte für Kursiv eine TTF).
 */
function parseSegments(html) {
  const segments = [];
  const re = /<(\/?)([a-z0-9]+)\b[^>]*>/gi;
  let bold = 0, underline = 0, strike = 0; // Tiefenzähler (robust gegen Re-Open aus balanceLines)
  let last = 0, match;
  const push = (raw) => {
    const text = cleanInline(raw);
    if (text) segments.push({ text, bold: bold > 0, underline: underline > 0, strike: strike > 0 });
  };
  while ((match = re.exec(html)) !== null) {
    if (match.index > last) push(html.slice(last, match.index));
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    const d = closing ? -1 : 1;
    if (tag === 'b' || tag === 'strong') bold = Math.max(0, bold + d);
    else if (tag === 'u' || tag === 'ins') underline = Math.max(0, underline + d);
    else if (tag === 's' || tag === 'strike' || tag === 'del') strike = Math.max(0, strike + d);
    last = re.lastIndex;
  }
  if (last < html.length) push(html.slice(last));
  return trimSegs(segments.filter(s => s.text));
}

// Führende/abschließende Leerzeichen an den Segment-Rändern entfernen (Ausrichtung),
// die inneren Segment-Grenzen aber unangetastet lassen.
function trimSegs(segs) {
  if (!segs.length) return segs;
  segs[0] = { ...segs[0], text: segs[0].text.replace(/^\s+/, '') };
  const li = segs.length - 1;
  segs[li] = { ...segs[li], text: segs[li].text.replace(/\s+$/, '') };
  return segs.filter(s => s.text);
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

// Zeichnet formatierte Segmente ab (x,y). opts.baseBold macht die ganze Zeile fett
// (z.B. linke Zeitspalte), inline <b> erzwingt zusätzlich Fett; <u>/<s> als Optionen.
// endX (rechtsbündig): Segmente enden bündig bei endX.
function drawSegments(doc, segments, x, y, opts = {}) {
  const { baseBold = false, color = '#111827', endX = null } = opts;
  const fontFor = (seg) => (baseBold || seg.bold) ? FONT_BOLD : FONT_REG;
  const widths = segments.map(seg => {
    doc.font(fontFor(seg)).fontSize(SIZE_BODY);
    return doc.widthOfString(seg.text);
  });
  let cx = endX != null ? endX - widths.reduce((a, b) => a + b, 0) : x;
  segments.forEach((seg, i) => {
    const w = widths[i];
    doc.font(fontFor(seg)).fontSize(SIZE_BODY).fillColor(color);
    // Unterstreichen/Durchstreichen zeichnen wir selbst als Linie – die pdfkit-Optionen
    // werfen bei manueller Positionierung (lineBreak:false) einen NaN-Fehler.
    doc.text(seg.text, cx, y, { continued: false, lineBreak: false });
    if (seg.underline || seg.strike) {
      const ly = seg.underline ? y + SIZE_BODY + 1.5 : y + SIZE_BODY * 0.62;
      doc.save().moveTo(cx, ly).lineTo(cx + w, ly).lineWidth(0.6).strokeColor(color).stroke().restore();
    }
    cx += w;
  });
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

    // Erster Pass: breiteste linke UND rechte Seite messen (beide in normaler Schrift,
    // da die Spalten nicht mehr automatisch fett sind).
    let maxLeftW = 0;
    let maxRightW = 0;
    doc.font(FONT_REG).fontSize(SIZE_BODY);
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
      // Linke Spalte links ab MARGIN_H, rechte Spalte rechtsbündig bis rightColEnd.
      // Einheitlich Schwarz + normale Schrift; fett nur dort, wo per <b> markiert.
      if (line.includes('-//-')) {
        const idx = line.indexOf('-//-');
        const leftSegs  = parseSegments(line.slice(0, idx));
        const rightSegs = parseSegments(line.slice(idx + 4));
        const lineY = y;
        drawSegments(doc, leftSegs, MARGIN_H, lineY, { color: '#111827' });
        drawSegments(doc, rightSegs, MARGIN_H, lineY, { color: '#111827', endX: rightColEnd });
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
      drawSegments(doc, segs, MARGIN_H, y, { color: '#111827' });
      y += LINE_H;
    }

    doc.end();
  });
}

module.exports = { generateSchedulePdf, _internal: { balanceLines, parseSegments, normalizeContent } };
