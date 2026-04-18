'use strict';

const PDFDocument = require('pdfkit');

const MARGIN_H = 56;
const MARGIN_V = 51;
const PAGE_W   = 595;
const CONTENT_W = PAGE_W - MARGIN_H * 2;
const FONT_REG  = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const C_DARK    = '#111827';
const C_MID     = '#6b7280';
const C_LIGHT   = '#f3f4f6';
const C_ORANGE  = '#f97316';
const C_GREEN   = '#16a34a';
const C_RED     = '#dc2626';
const C_YELLOW  = '#d97706';

const STATUS_COLORS = { approved: C_GREEN, pending: C_YELLOW, rejected: C_RED }

function formatPassType(t) {
  const map = { guestlist: 'GL', backstage: 'BS', aftershow: 'AS', photo: 'Photo' };
  return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
}

function generateGuestListPdf({ list, entries, passTypes, termin }) {
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
      if (y + needed > bottom) { doc.addPage(); y = MARGIN_V; }
    }

    // ── Header ──
    doc.font(FONT_REG).fontSize(7).fillColor(C_MID)
      .text('GÄSTELISTE', MARGIN_H, y, { lineBreak: false });
    y += 11;

    // Termin-Info
    if (termin) {
      const dateStr = termin.date ? new Date(termin.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const loc = [termin.city, termin.venue_name].filter(Boolean).join(' · ');
      doc.font(FONT_REG).fontSize(11).fillColor(C_MID).text(dateStr, MARGIN_H, y, { lineBreak: false });
      y += 14;
      doc.font(FONT_BOLD).fontSize(18).fillColor(C_DARK).text(termin.title || '', MARGIN_H, y, { lineBreak: false });
      if (loc) {
        const tw = doc.widthOfString(termin.title || '');
        doc.font(FONT_REG).fontSize(11).fillColor(C_MID).text(` · ${loc}`, MARGIN_H + tw, y, { lineBreak: false });
      }
      y += 24;
    }

    doc.font(FONT_BOLD).fontSize(14).fillColor(C_DARK).text(list.name, MARGIN_H, y, { lineBreak: false });
    if (list.status === 'locked') {
      const lw = doc.widthOfString(list.name);
      doc.font(FONT_REG).fontSize(8).fillColor(C_RED).text('  GESPERRT', MARGIN_H + lw, y + 3, { lineBreak: false });
    }
    y += 20;

    // Stats
    const approvedEntries = entries.filter(e => e.status !== 'rejected');
    const pendingEntries = entries.filter(e => e.status === 'pending');
    const totalTickets = approvedEntries.reduce((s, e) => s + passTypes.reduce((ss, t) => ss + (parseInt(e.passes[t]) || 0), 0), 0);
    doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
      .text(`${approvedEntries.length} Einträge · ${totalTickets} Tickets gesamt${pendingEntries.length > 0 ? ` · ${pendingEntries.length} ausstehend` : ''}`, MARGIN_H, y, { lineBreak: false });
    y += 14;

    // Rule
    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(1.5).strokeColor(C_DARK).stroke();
    y += 8;

    // ── Tabellen-Header ──
    const COL_NAME_W = 160;
    const COL_INV_W  = 110;
    const COL_EMAIL_W = 100;
    const passColW = passTypes.length > 0 ? Math.min(35, Math.floor((CONTENT_W - COL_NAME_W - COL_INV_W - COL_EMAIL_W - 30) / passTypes.length)) : 0;
    const COL_TOTAL_W = 30;

    const COL = {
      name:  MARGIN_H,
      inv:   MARGIN_H + COL_NAME_W + 8,
      email: MARGIN_H + COL_NAME_W + COL_INV_W + 16,
      passes: MARGIN_H + COL_NAME_W + COL_INV_W + COL_EMAIL_W + 24,
      total: MARGIN_H + COL_NAME_W + COL_INV_W + COL_EMAIL_W + 24 + passTypes.length * passColW + 4,
    }

    const HEAD_H = 16;
    doc.font(FONT_BOLD).fontSize(7).fillColor(C_MID);
    doc.text('NAME', COL.name, y, { lineBreak: false });
    doc.text('EINGELADEN VON', COL.inv, y, { lineBreak: false });
    doc.text('E-MAIL', COL.email, y, { lineBreak: false });
    passTypes.forEach((t, i) => {
      doc.text(formatPassType(t).toUpperCase(), COL.passes + i * passColW, y, { width: passColW, align: 'center', lineBreak: false });
    });
    doc.text('∑', COL.total, y, { lineBreak: false });
    y += HEAD_H;

    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.5).strokeColor('#9ca3af').stroke();
    y += 6;

    // ── Einträge ──
    const ROW_H = 20;
    const PAD_T = 6;

    for (const entry of entries) {
      ensureSpace(ROW_H + 2);
      const rowY = y;

      // Wunsch-Indikator + Status-Farbe
      const statusColor = entry.is_wish ? STATUS_COLORS[entry.status] || C_MID : C_DARK;
      const nameText = `${entry.first_name} ${entry.last_name}${entry.company ? ` (${entry.company})` : ''}`;

      // Status-Dot für Wünsche
      if (entry.is_wish) {
        doc.circle(COL.name - 7, rowY + PAD_T + 3, 2.5).fill(statusColor);
      }

      doc.font(entry.is_wish ? FONT_REG : FONT_BOLD).fontSize(8.5).fillColor(entry.status === 'rejected' ? C_MID : C_DARK)
        .text(nameText, COL.name, rowY + PAD_T, { width: COL_NAME_W, lineBreak: false });

      doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
        .text(entry.invited_by_text || '', COL.inv, rowY + PAD_T, { width: COL_INV_W, lineBreak: false });

      doc.font(FONT_REG).fontSize(7.5).fillColor(C_MID)
        .text(entry.email || '', COL.email, rowY + PAD_T + 1, { width: COL_EMAIL_W, lineBreak: false });

      // Passes
      const total = passTypes.reduce((s, t) => s + (parseInt(entry.passes[t]) || 0), 0);
      passTypes.forEach((t, i) => {
        const v = parseInt(entry.passes[t]) || 0;
        doc.font(FONT_REG).fontSize(8.5).fillColor(v > 0 ? C_DARK : C_LIGHT)
          .text(v > 0 ? String(v) : '–', COL.passes + i * passColW, rowY + PAD_T, { width: passColW, align: 'center', lineBreak: false });
      });

      doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK)
        .text(String(total), COL.total, rowY + PAD_T, { lineBreak: false });

      y = rowY + ROW_H;
      doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.3).strokeColor('#f3f4f6').stroke();
    }

    // ── Footer ──
    y += 12;
    ensureSpace(20);
    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.5).strokeColor('#9ca3af').stroke();
    y += 8;
    doc.font(FONT_REG).fontSize(7).fillColor(C_MID)
      .text(`Erstellt: ${new Date().toLocaleString('de-DE')} · ProTouring`, MARGIN_H, y, { lineBreak: false });

    doc.end();
  });
}

module.exports = { generateGuestListPdf };
