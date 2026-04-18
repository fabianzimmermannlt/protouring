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
const C_LIGHT   = '#d1d5db';
const C_ORANGE  = '#f97316';
const C_GREEN   = '#16a34a';
const C_RED     = '#dc2626';
const C_YELLOW  = '#d97706';

const STATUS_COLORS = { approved: C_GREEN, pending: C_YELLOW, rejected: C_RED }

function formatPassType(t) {
  const map = { guestlist: 'GL', backstage: 'BS', aftershow: 'AS', photo: 'Photo' };
  return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
}

function generateGuestListPdf({ list, entries, passTypes, termin, showInviter = true, showEmail = true }) {
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

    // Stats (nur nicht-abgelehnte)
    const visibleEntries = entries.filter(e => e.status !== 'rejected');
    const pendingEntries = entries.filter(e => e.status === 'pending');
    const totalTickets = visibleEntries.reduce((s, e) => s + passTypes.reduce((ss, t) => ss + (parseInt(e.passes[t]) || 0), 0), 0);
    doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
      .text(`${visibleEntries.length} Einträge · ${totalTickets} Tickets gesamt${pendingEntries.length > 0 ? ` · ${pendingEntries.length} ausstehend` : ''}`, MARGIN_H, y, { lineBreak: false });
    y += 14;

    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(1.5).strokeColor(C_DARK).stroke();
    y += 8;

    // ── Spaltenbreiten ──
    // Feste Spalten: Nachname, Vorname
    // Optionale: Eingeladen von, E-Mail
    // Pass-Spalten, Gesamt
    const COL_LAST_W  = 100;
    const COL_FIRST_W = 80;
    const COL_INV_W   = showInviter ? 90 : 0;
    const COL_EMAIL_W = showEmail   ? 90 : 0;
    const COL_TOTAL_W = 22;
    const passAreaW = CONTENT_W - COL_LAST_W - COL_FIRST_W - COL_INV_W - COL_EMAIL_W - COL_TOTAL_W - (showInviter ? 8 : 0) - (showEmail ? 8 : 0) - 8;
    const passColW = passTypes.length > 0 ? Math.floor(passAreaW / passTypes.length) : 0;

    let cx = MARGIN_H;
    const COL = {};
    COL.last  = cx; cx += COL_LAST_W + 8;
    COL.first = cx; cx += COL_FIRST_W + 8;
    if (showInviter) { COL.inv = cx; cx += COL_INV_W + 8; }
    if (showEmail)   { COL.email = cx; cx += COL_EMAIL_W + 8; }
    COL.passes = cx;
    COL.total  = cx + passTypes.length * passColW + 4;

    // ── Header-Zeile ──
    doc.font(FONT_BOLD).fontSize(7).fillColor(C_MID);
    doc.text('NACHNAME', COL.last, y, { lineBreak: false });
    doc.text('VORNAME',  COL.first, y, { lineBreak: false });
    if (showInviter) doc.text('EINGELADEN VON', COL.inv,   y, { lineBreak: false });
    if (showEmail)   doc.text('E-MAIL',         COL.email, y, { lineBreak: false });
    passTypes.forEach((t, i) => {
      doc.text(formatPassType(t).toUpperCase(), COL.passes + i * passColW, y, { width: passColW, align: 'center', lineBreak: false });
    });
    doc.text('∑', COL.total, y, { lineBreak: false });
    y += 16;

    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.5).strokeColor('#9ca3af').stroke();
    y += 6;

    // ── Einträge (abgelehnte überspringen wenn locked) ──
    const ROW_H = 20;
    const PAD_T = 6;

    for (const entry of entries) {
      // Abgelehnte bei gesperrter Liste nicht drucken
      if (list.status === 'locked' && entry.status === 'rejected') continue;

      ensureSpace(ROW_H + 2);
      const rowY = y;

      const isWish    = entry.is_wish === 1 || entry.is_wish === true;
      const isPending = isWish && entry.status === 'pending';
      const isRejected = entry.status === 'rejected';

      // Status-Dot für Wünsche
      if (isWish) {
        const dotColor = STATUS_COLORS[entry.status] || C_MID;
        doc.circle(COL.last - 7, rowY + PAD_T + 3, 2.5).fill(dotColor);
      }

      const textColor = isRejected ? C_MID : C_DARK;
      const nameFont  = isPending ? FONT_REG : FONT_BOLD;

      // Nachname
      doc.font(nameFont).fontSize(8.5).fillColor(textColor)
        .text(entry.last_name + (entry.company ? ` (${entry.company})` : ''), COL.last, rowY + PAD_T, { width: COL_LAST_W, lineBreak: false });
      // Vorname
      doc.font(nameFont).fontSize(8.5).fillColor(textColor)
        .text(entry.first_name, COL.first, rowY + PAD_T, { width: COL_FIRST_W, lineBreak: false });

      // Eingeladen von
      if (showInviter) {
        const inviterName = entry.invited_by_text
          || [entry.inviter_first_name, entry.inviter_last_name].filter(Boolean).join(' ')
          || '';
        doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
          .text(inviterName, COL.inv, rowY + PAD_T, { width: COL_INV_W, lineBreak: false });
      }

      // E-Mail
      if (showEmail) {
        doc.font(FONT_REG).fontSize(7.5).fillColor(C_MID)
          .text(entry.email || '', COL.email, rowY + PAD_T + 1, { width: COL_EMAIL_W, lineBreak: false });
      }

      // Passes – immer 0 anzeigen
      const total = passTypes.reduce((s, t) => s + (parseInt(entry.passes[t]) || 0), 0);
      passTypes.forEach((t, i) => {
        const v = parseInt(entry.passes[t]) || 0;
        doc.font(FONT_REG).fontSize(8.5).fillColor(v > 0 ? C_DARK : C_LIGHT)
          .text(String(v), COL.passes + i * passColW, rowY + PAD_T, { width: passColW, align: 'center', lineBreak: false });
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
