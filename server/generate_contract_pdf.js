'use strict';
/**
 * Erzeugt ein Vertrags-PDF (Add-on „Booking") mit pdfkit.
 * generateContractPdf({ contract, clauses, artist }) → Promise<Buffer>
 * Kein Rechts-/Steuer-Anspruch – reine Dokumentenerzeugung aus den erfassten Werten.
 */
const PDFDocument = require('pdfkit');

const MARGIN = 56;
const PAGE_W = 595, PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT_REG = 'Helvetica', FONT_BOLD = 'Helvetica-Bold';

function money(v, cur = 'EUR') {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return String(v);
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
}
function pct(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return String(v);
  // deal_share kann als Ratio (0.7) ODER Prozent (70) vorliegen – beides abfangen
  const p = n <= 1 ? n * 100 : n;
  return p.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';
}
function dateDE(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return (y && m && d) ? `${d}.${m}.${y}` : iso;
}

// Platzhalter in Baustein-Texten ersetzen: {{gage}}, {{venue}}, {{datum}}, {{stadt}},
// {{partner}}, {{artist}}, {{deal}}, {{ticketpreis}}, {{anzahlung}}.
function fillPlaceholders(text, map) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const v = map[key.toLowerCase()];
    return v == null || v === '' ? m : String(v);
  });
}

function generateContractPdf({ contract: c, clauses = [], artist = {} }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cur = c.currency || 'EUR';
    const artistName = [artist.name, [artist.firstName, artist.lastName].filter(Boolean).join(' ')].filter(Boolean)[0] || artist.name || '—';

    const placeholders = {
      gage: money(c.guarantee, cur) || '—',
      deal: pct(c.deal_share) || '—',
      ticketpreis: money(c.ticket_price, cur) || '—',
      anzahlung: money(c.deposit, cur) || '—',
      venue: c.event_venue || '—',
      stadt: c.event_city || '—',
      datum: dateDE(c.event_date) || '—',
      partner: c.partner_name || '—',
      artist: artistName,
    };

    // ── Kopf ──
    doc.font(FONT_REG).fontSize(7).fillColor('#6b7280').text('VERTRAG', MARGIN, MARGIN, { characterSpacing: 1 });
    doc.font(FONT_BOLD).fontSize(18).fillColor('#111827').text(c.title || 'Vertrag', MARGIN, doc.y + 2, { width: CONTENT_W });
    if (c.contract_no) doc.font(FONT_REG).fontSize(8).fillColor('#9ca3af').text(`Nr. ${c.contract_no}`, { width: CONTENT_W });
    doc.moveDown(0.5);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(1.5).strokeColor('#111827').stroke();
    doc.moveDown(0.8);

    // ── Parteien (zwei Spalten) ──
    const colW = (CONTENT_W - 20) / 2;
    const partyTop = doc.y;
    const party = (x, label, lines) => {
      doc.font(FONT_BOLD).fontSize(8).fillColor('#6b7280').text(label, x, partyTop, { width: colW });
      doc.font(FONT_REG).fontSize(10).fillColor('#111827');
      doc.text(lines.filter(Boolean).join('\n'), x, doc.y + 2, { width: colW });
    };
    const artistLines = [
      artistName,
      artist.address,
      [artist.postalCode, artist.city].filter(Boolean).join(' '),
      artist.taxId ? `USt-IdNr./St.-Nr.: ${artist.taxId}` : null,
      artist.email,
    ];
    const leftEndY = (() => { party(MARGIN, 'KÜNSTLER / AUFTRAGNEHMER', artistLines); return doc.y; })();
    const partnerLines = [c.partner_name, c.partner_address, c.partner_email];
    party(MARGIN + colW + 20, 'VERANSTALTER / AUFTRAGGEBER', partnerLines);
    doc.y = Math.max(leftEndY, doc.y);
    doc.moveDown(1);

    // ── Event ──
    const eventBits = [
      c.event_title && `Veranstaltung: ${c.event_title}`,
      dateDE(c.event_date) && `Datum: ${dateDE(c.event_date)}`,
      c.event_city && `Ort: ${c.event_city}`,
      c.event_venue && `Venue: ${c.event_venue}`,
    ].filter(Boolean);
    if (eventBits.length) {
      doc.font(FONT_BOLD).fontSize(9).fillColor('#374151').text('Veranstaltung', MARGIN);
      doc.font(FONT_REG).fontSize(10).fillColor('#111827').text(eventBits.join('   ·   '), { width: CONTENT_W });
      doc.moveDown(0.8);
    }

    // ── Deal / Konditionen ──
    const dealType = { guarantee: 'Festgage', vs: 'Garantie vs. Deal', plus: 'Garantie plus Deal', door: 'Door Deal' }[c.deal_type] || c.deal_type;
    const dealRows = [
      ['Deal-Art', dealType],
      ['Garantie / Festgage', money(c.guarantee, cur)],
      ['Deal-Anteil', pct(c.deal_share)],
      ['Break-Even', money(c.break_even, cur)],
      ['Ticketpreis', money(c.ticket_price, cur)],
      ['VVK (Stück)', c.vvk],
      ['Anzahlung / Vorauszahlung', money(c.deposit, cur)],
      ['Zahlungsziel', c.payment_terms],
    ].filter(r => r[1] != null && r[1] !== '');
    if (dealRows.length) {
      doc.font(FONT_BOLD).fontSize(9).fillColor('#374151').text('Konditionen', MARGIN);
      doc.moveDown(0.2);
      const labelW = 170;
      for (const [k, v] of dealRows) {
        const rowY = doc.y;
        doc.font(FONT_REG).fontSize(10).fillColor('#6b7280').text(k, MARGIN, rowY, { width: labelW });
        doc.font(FONT_BOLD).fontSize(10).fillColor('#111827').text(String(v), MARGIN + labelW, rowY, { width: CONTENT_W - labelW });
        doc.y = Math.max(doc.y, rowY) ;
      }
      doc.moveDown(0.8);
    }

    // ── Vertragsbausteine ──
    if (clauses.length) {
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(0.5).strokeColor('#d1d5db').stroke();
      doc.moveDown(0.6);
      clauses.forEach((cl, i) => {
        if (doc.y > PAGE_H - MARGIN - 80) doc.addPage();
        doc.font(FONT_BOLD).fontSize(10.5).fillColor('#111827')
          .text(`§ ${i + 1}  ${cl.title}${cl.version ? `  (v${cl.version})` : ''}`, MARGIN, doc.y, { width: CONTENT_W });
        doc.moveDown(0.2);
        doc.font(FONT_REG).fontSize(10).fillColor('#1f2937')
          .text(fillPlaceholders(cl.body, placeholders) || ' ', MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
        doc.moveDown(0.8);
      });
    }

    // ── Notizen ──
    if (c.notes) {
      if (doc.y > PAGE_H - MARGIN - 80) doc.addPage();
      doc.font(FONT_BOLD).fontSize(9).fillColor('#374151').text('Weitere Vereinbarungen', MARGIN);
      doc.font(FONT_REG).fontSize(10).fillColor('#111827').text(String(c.notes), { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.8);
    }

    // ── Unterschriften ──
    if (doc.y > PAGE_H - MARGIN - 110) doc.addPage();
    else doc.moveDown(2);
    const sigY = doc.y + 24;
    const sigW = (CONTENT_W - 30) / 2;
    doc.lineWidth(0.7).strokeColor('#111827');
    doc.moveTo(MARGIN, sigY).lineTo(MARGIN + sigW, sigY).stroke();
    doc.moveTo(MARGIN + sigW + 30, sigY).lineTo(MARGIN + CONTENT_W, sigY).stroke();
    doc.font(FONT_REG).fontSize(8).fillColor('#6b7280');
    doc.text('Ort, Datum, Unterschrift Künstler', MARGIN, sigY + 4, { width: sigW });
    doc.text('Ort, Datum, Unterschrift Veranstalter', MARGIN + sigW + 30, sigY + 4, { width: sigW });

    doc.end();
  });
}

module.exports = { generateContractPdf };
