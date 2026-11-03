'use strict';
/**
 * Erzeugt die Konzertabrechnung (KA) als PDF – Layout nach der echten FKP-Scorpio-KA:
 * Briefkopf (Empfänger/Meta), Seite 1 „Eintrittskartenabrechnung" (Ticketeinnahme je
 * Vertriebskanal×Kategorie mit Rabattstufen-Unterzeilen + Refundierung), Seite 2
 * „Veranstaltungsabrechnung" (Deal/Anteil, Nebenkosten, Rechnungsbetrag, Restbetrag).
 * generateSettlementPdf({ contract, issuer, data, logoPath }) → Promise<Buffer>
 *
 * Alle Zahlen kommen fertig berechnet aus dem getesteten Client-Rechenkern (computeSettlement),
 * hier wird nur formatiert (de-DE) und layoutet. Interne Aufstellung – keine Rechnung.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');

const M = 56, PAGE_W = 595, PAGE_H = 842, CONTENT_W = PAGE_W - M * 2;
const REG = 'Helvetica', BOLD = 'Helvetica-Bold';
const INK = '#111827', MUTED = '#6b7280', BAND = '#e5e7eb';
// Spalten (absolute x) der Ticket-Tabelle. *_R = rechte Kante rechtsbündiger Spalten.
const C_VEND = M, C_CAT = 145, C_RAB = 200, C_PREIS_R = 366, C_ANZ_R = 432, C_EINN_R = 539;
const PREIS_W = 58, ANZ_W = 54, EINN_W = 100;
const STEP = 14.5;

function drawLogo(doc, logoPath, x, y) {
  if (!logoPath || !fs.existsSync(logoPath) || !/\.(png|jpe?g)$/i.test(logoPath)) return false;
  try { doc.image(logoPath, x, y, { fit: [130, 46], align: 'right' }); return true; } catch { return false; }
}
function dateDE(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return (y && m && d) ? `${d}.${m}.${y}` : iso; }

function generateSettlementPdf({ contract: c = {}, issuer = {}, data = {}, logoPath = null }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cur = data.currency || c.currency || 'EUR';
    const sane = s => String(s ?? '').replace(/−/g, '-');
    const money = v => (Number(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
    const pct = v => (Number(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    const artist = issuer.name || [issuer.firstName, issuer.lastName].filter(Boolean).join(' ') || 'Artist';

    // ── Hilfsfunktionen ───────────────────────────────────────────────────
    let y = M;
    const ensure = (need) => { if (y + need > PAGE_H - M) { doc.addPage(); y = M; } };
    const tcell = (t, x, w, align, bold) => { doc.font(bold ? BOLD : REG).fontSize(8.5).fillColor(INK).text(sane(t), x, y, { width: w, align, lineBreak: false }); };
    const trow = (r, bold) => {
      if (r.vendor) tcell(r.vendor, C_VEND, C_CAT - C_VEND - 4, 'left', bold);
      if (r.cat) tcell(r.cat, C_CAT, C_RAB - C_CAT - 4, 'left', bold);
      if (r.rab) tcell(r.rab, C_RAB, (C_PREIS_R - PREIS_W) - C_RAB - 4, 'left', bold);
      if (r.preis != null) tcell(r.preis, C_PREIS_R - PREIS_W, PREIS_W, 'right', bold);
      if (r.anz != null) tcell(r.anz, C_ANZ_R - ANZ_W, ANZ_W, 'right', bold);
      if (r.einn != null) tcell(r.einn, C_EINN_R - EINN_W, EINN_W, 'right', bold);
      y += STEP;
    };
    const band = (title) => { ensure(26); doc.save().rect(M, y, CONTENT_W, 16).fill(BAND).restore(); doc.font(BOLD).fontSize(9).fillColor(INK).text(sane(title), M + 4, y + 4, { lineBreak: false }); y += 20; };
    // Summenzeile rechts: Label (rechtsbündig bis Preis-Spalte) · optional % · Wert · optional Doppelstrich
    const sumRow = (label, valueStr, opts = {}) => {
      ensure(opts.under ? 22 : 16);
      doc.font(opts.bold ? BOLD : REG).fontSize(9).fillColor(opts.muted ? MUTED : INK);
      doc.text(sane(label), C_VEND, y, { width: C_PREIS_R - C_VEND, align: 'right', lineBreak: false });
      if (opts.pctStr) { doc.font(REG).fontSize(9).fillColor(opts.muted ? MUTED : INK).text(sane(opts.pctStr), C_ANZ_R - ANZ_W, y, { width: ANZ_W, align: 'right', lineBreak: false }); }
      doc.font(opts.bold ? BOLD : REG).fillColor(opts.muted ? MUTED : INK).text(valueStr == null ? '' : sane(valueStr), C_EINN_R - EINN_W, y, { width: EINN_W, align: 'right', lineBreak: false });
      if (opts.under) { doc.lineWidth(0.7).strokeColor(INK); doc.moveTo(C_EINN_R - EINN_W, y + 12.5).lineTo(C_EINN_R, y + 12.5).stroke(); doc.moveTo(C_EINN_R - EINN_W, y + 14.3).lineTo(C_EINN_R, y + 14.3).stroke(); y += 20; } else { y += STEP; }
    };

    // ── Briefkopf ─────────────────────────────────────────────────────────
    drawLogo(doc, logoPath, M + CONTENT_W - 130, y);
    doc.font(BOLD).fontSize(7).fillColor(MUTED).text([artist, issuer.address, [issuer.postalCode, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), M, y, { width: CONTENT_W });
    y += 22;
    // Empfänger links
    const recY = y;
    doc.font(REG).fontSize(9.5).fillColor(INK).text([c.partner_name, c.partner_address].filter(Boolean).join('\n') || '—', M, y, { width: 280 });
    // Meta rechts
    const meta = [['Artist:', artist], ['Stadt:', c.event_city || ''], ['Veranstaltungsort:', c.event_venue || ''], ['Datum der Veranstaltung:', dateDE(c.event_date)]];
    let my = recY;
    for (const [k, v] of meta) { doc.font(REG).fontSize(9.5).fillColor(INK).text(k, 300, my, { width: 130, align: 'right', lineBreak: false }); doc.font(BOLD).fontSize(9.5).fillColor(INK).text(sane(v || '—'), 435, my, { width: 104, align: 'right', lineBreak: false }); my += 16; }
    y = Math.max(doc.y, my) + 16;

    // ── Seite 1: Eintrittskartenabrechnung ────────────────────────────────
    doc.font(BOLD).fontSize(13).fillColor(INK).text('Eintrittskartenabrechnung', M, y); y = doc.y + 8;

    band('Ticketeinnahme');
    trow({ vendor: 'Vertriebskanal', cat: 'Kategorie', rab: 'Rabattstufe', preis: 'Preis', anz: 'Anzahl', einn: 'Einnahme' }, true);
    for (const g of (data.ticketGroups || [])) {
      const subs = g.subs || [];
      if (subs.length <= 1) {
        // Eine Zeile (z.B. Box Office, Bandshop): Rabattstufe inline.
        const s = subs[0] || {};
        trow({ vendor: g.vendor, cat: g.category, rab: s.label || '', preis: money(g.price), anz: g.tickets > 0 ? String(g.tickets) : '-', einn: g.tickets > 0 ? money(g.einnahme) : '-' }, true);
      } else {
        // Summenzeile (fett) + eingerückte Unterzeilen je Rabattstufe.
        trow({ vendor: g.vendor, cat: g.category, preis: money(g.price), anz: String(g.tickets), einn: money(g.einnahme) }, true);
        for (const s of subs) trow({ rab: s.label || '—', preis: money(s.price), anz: s.tickets > 0 ? String(s.tickets) : '-', einn: s.tickets > 0 ? money(s.einnahme) : '-' }, false);
      }
    }
    y += 4;
    doc.font(BOLD).fontSize(8.5).fillColor(INK).text('Ticketverkauf gesamt', C_VEND, y, { width: (C_ANZ_R - ANZ_W) - C_VEND - 6, align: 'right', lineBreak: false });
    doc.text(String(data.totalTickets ?? 0), C_ANZ_R - ANZ_W, y, { width: ANZ_W, align: 'right', lineBreak: false });
    y += STEP + 8;
    sumRow('Ticketeinnahme gesamt (brutto)', money(data.ticketGross), { bold: true });
    sumRow('abzgl. MwSt.', money(data.ticketVatAmt), { muted: true, pctStr: pct(data.ticketVatPct) });
    sumRow('Ticketeinnahme gesamt (netto)', money(data.ticketNet), { bold: true, under: true });

    if ((data.refundRows || []).length) {
      y += 14;
      band('Refundierung');
      trow({ vendor: 'Refundierung', cat: 'Kategorie', preis: 'Preis', anz: 'Anzahl' }, true);
      for (const r of data.refundRows) trow({ vendor: 'Ticket Rebate', cat: r.category, preis: money(r.fee), anz: String(r.tickets), einn: money(r.betrag) }, false);
      y += 4;
      sumRow('Refundierung gesamt (brutto)', money(data.feeGross), { bold: true });
      sumRow('abzgl. MwSt.', money(data.feeVatAmt), { muted: true, pctStr: pct(data.feeVatPct) });
      sumRow('Refundierung gesamt (netto)', money(data.feeNet), { bold: true, under: true });
    }

    // ── Seite 2: Veranstaltungsabrechnung ─────────────────────────────────
    doc.addPage(); y = M;
    doc.moveTo(M, y).lineTo(M + CONTENT_W, y).lineWidth(1).strokeColor(INK).stroke(); y += 16;
    doc.font(BOLD).fontSize(13).fillColor(INK).text('Veranstaltungsabrechnung', M, y); y = doc.y + 8;

    if (data.dealLabel) { doc.font(BOLD).fontSize(9.5).fillColor(INK).text(sane(data.dealLabel), M, y); y = doc.y + 2; }
    if (data.dealDescription) { doc.font(REG).fontSize(9).fillColor(INK).text(sane(data.dealDescription), M, y, { width: CONTENT_W }); y = doc.y + 6; }
    for (const ln of (data.dealLines || [])) {
      ensure(16); doc.font(REG).fontSize(9).fillColor(INK).text(sane(ln.label), C_VEND, y, { width: C_EINN_R - 120 - C_VEND });
      doc.text(sane(ln.valueStr), C_EINN_R - 108, y, { width: 108, align: 'right', lineBreak: false });
      y = Math.max(doc.y, y + STEP);
    }
    y += 10;

    band('Anteil ' + artist);
    sumRow('Anteil ' + artist + ' an Ticketumsatz (netto)', money(data.anteilTicketNet), {});
    if ((data.anteilRefundNet || 0) !== 0) sumRow('Anteil ' + artist + ' an Refundierung (netto)', money(data.anteilRefundNet), { pctStr: pct(data.bandSplitPct) });
    sumRow('Anteil ' + artist + ' gesamt (netto)', money(data.anteilNet), { bold: true });
    sumRow('zzgl. MwSt.', money(data.anteilVatAmt), { muted: true, pctStr: pct(data.anteilVatPct) });
    sumRow('Anteil ' + artist + ' gesamt (brutto)', money(data.anteilGross), { bold: true, under: true });

    if ((data.costRows || []).length) {
      y += 14;
      band('Nebenkosten');
      doc.font(REG).fontSize(8).fillColor(MUTED).text('zzgl. MwSt.', C_ANZ_R - ANZ_W, y - 16, { width: ANZ_W, align: 'right', lineBreak: false });
      for (const co of data.costRows) sumRow(co.label, money(co.net), { pctStr: pct(co.vatPct) });
      y += 2;
      sumRow('Gesamtbetrag Nebenkosten (netto)', money(data.costsNet), { bold: true });
      sumRow('zzgl. MwSt.', money(data.costsVatAmt), { muted: true });
      sumRow('Nebenkosten gesamt (brutto)', money(data.costsGross), { bold: true, under: true });
    }

    y += 14;
    band('Rechnungsbetrag');
    sumRow('Veranstaltungsabrechnung ' + artist + ' gesamt (netto)', money(data.rechnungNet), { bold: true });
    sumRow('zzgl. MwSt.', money(data.rechnungVatAmt), { muted: true });
    sumRow('Veranstaltungsabrechnung ' + artist + ' gesamt (brutto)', money(data.rechnungGross), { bold: true, under: true });
    for (const d of (data.deductions || [])) sumRow(d.label, '- ' + money(d.amount), { muted: true });
    y += 4;
    ensure(24);
    doc.save().rect(M, y, CONTENT_W, 18).fill(BAND).restore();
    doc.font(BOLD).fontSize(10.5).fillColor(INK).text('Restbetrag zur Überweisung an ' + artist, C_VEND + 4, y + 4, { width: C_EINN_R - 120 - C_VEND, lineBreak: false });
    doc.text(money(data.payableGross), C_EINN_R - 120, y + 4, { width: 116, align: 'right', lineBreak: false });
    doc.lineWidth(0.8).strokeColor(INK); doc.moveTo(C_EINN_R - 120, y + 18.5).lineTo(C_EINN_R, y + 18.5).stroke(); doc.moveTo(C_EINN_R - 120, y + 20.3).lineTo(C_EINN_R, y + 20.3).stroke();

    // ── Fußzeile je Seite ─────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const foot = `Konzertabrechnung ${artist} – ${dateDE(c.event_date)} – ${c.event_city || ''}`;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      doc.font(REG).fontSize(8).fillColor(MUTED).text(`${foot} * Seite ${i + 1} von ${range.count} Seiten`, M, PAGE_H - 40, { width: CONTENT_W, align: 'center', lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateSettlementPdf };
