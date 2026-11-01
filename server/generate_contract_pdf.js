'use strict';
/**
 * Erzeugt ein Vertrags-PDF (Add-on „Booking") mit pdfkit – Layout nach dem echten
 * FKP-Konzertvertrag: zentrierter Titel, Parteienkopf („zwischen … vertreten durch … und …"),
 * §§-Bausteine (live aus der Baustein-Bibliothek) und die variablen Deal-Tabellen (§4/§5).
 * generateContractPdf({ contract, clauses, artist, ticketSales, costLines, settings }) → Promise<Buffer>
 * Kein Rechts-/Steuer-Anspruch – reine Dokumentenerzeugung aus den erfassten Werten.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');

const MARGIN = 56;
const PAGE_W = 595, PAGE_H = 842;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT_REG = 'Helvetica', FONT_BOLD = 'Helvetica-Bold', FONT_ITALIC = 'Helvetica-Oblique';

function drawLogo(doc, logoPath) {
  if (!logoPath || !fs.existsSync(logoPath) || !/\.(png|jpe?g)$/i.test(logoPath)) return;
  try { doc.image(logoPath, PAGE_W - MARGIN - 120, MARGIN, { fit: [120, 48], align: 'right' }); } catch { /* ignorieren */ }
}

function money(v, cur = 'EUR') {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return String(v);
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
}
function num(v) { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; }
function intDE(v) { const n = num(v); return n ? n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) : (v == null || v === '' ? '—' : String(v)); }
function pct(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return String(v);
  const p = n <= 1 ? n * 100 : n;
  return p.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';
}
function dateDE(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return (y && m && d) ? `${d}.${m}.${y}` : iso;
}
function fillPlaceholders(text, map) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const v = map[key.toLowerCase()];
    return v == null || v === '' ? m : String(v);
  });
}
const norm = (t) => String(t || '').toLowerCase().trim();
const ART_LABEL = { vvk: 'Vorverkauf', boxoffice: 'Abendkasse', ownshop: 'Eigener Shop' };

function generateContractPdf({ contract: c, clauses = [], artist = {}, ticketSales = [], costLines = [], settings = {} }) {
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
      deal: pct(c.deal_share) || (c.deal_type === 'vs' ? 'vs. % of net' : '—'),
      ticketpreis: money(c.ticket_price, cur) || '—',
      anzahlung: money(c.deposit, cur) || '—',
      venue: c.event_venue || '—',
      stadt: c.event_city || '—',
      datum: dateDE(c.event_date) || '—',
      partner: c.partner_name || '—',
      artist: artistName,
    };

    const ensureSpace = (need) => { if (doc.y > PAGE_H - MARGIN - need) doc.addPage(); };

    // ── Kopf: Logo + zentrierter Titel ──
    drawLogo(doc, c.logoPath || null);
    doc.font(FONT_BOLD).fontSize(20).fillColor('#111827').text(c.title || 'Konzertvertrag', MARGIN, MARGIN + 6, { width: CONTENT_W, align: 'center' });
    if (c.contract_no) doc.font(FONT_REG).fontSize(8).fillColor('#9ca3af').text(`Nr. ${c.contract_no}`, MARGIN, doc.y + 1, { width: CONTENT_W, align: 'center' });
    doc.moveDown(1);

    // ── Parteienkopf (zwischen … vertreten durch … und …) ──
    const addrLine = (parts) => parts.filter(Boolean).join(', ');
    const partyBlock = (intro, name, addr, extra, tag) => {
      if (intro) doc.font(FONT_REG).fontSize(10).fillColor('#111827').text(intro, MARGIN, doc.y, { width: CONTENT_W });
      doc.font(FONT_BOLD).fontSize(10).fillColor('#111827').text(name || '—', MARGIN, doc.y, { width: CONTENT_W, continued: !!addr });
      if (addr) doc.font(FONT_REG).fontSize(10).fillColor('#111827').text(`, ${addr}`, { width: CONTENT_W });
      if (extra) doc.font(FONT_REG).fontSize(10).fillColor('#111827').text(extra, MARGIN, doc.y, { width: CONTENT_W });
      doc.font(FONT_BOLD).fontSize(9.5).fillColor('#374151').text(`– „${tag}" –`, MARGIN, doc.y + 2, { width: CONTENT_W, align: 'right' });
      doc.moveDown(0.6);
    };

    const artistAddr = addrLine([artist.address, [artist.postalCode, artist.city].filter(Boolean).join(' '), artist.country]);
    const artistExtra = artist.taxId ? `VAT ID / USt-IdNr.: ${artist.taxId}` : null;
    partyBlock('zwischen', artistName, artistAddr, artistExtra, 'Artist');
    if (c.rep_name) partyBlock('vertreten durch', c.rep_name, c.rep_address || '', null, 'Agentur');
    partyBlock('und', c.partner_name, c.partner_address || '', c.partner_email || null, 'ÖV');

    doc.font(FONT_REG).fontSize(9.5).fillColor('#374151')
      .text('– Artist und ÖV gemeinsam auch als „Parteien" und einzeln als „Partei" –', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
    doc.moveDown(0.6);

    // ── Weitere Beteiligte (mehrstufige Parteienkette, außer Venue/bereits gezeigte) ──
    let parties = [];
    try { parties = c.parties ? JSON.parse(c.parties) : []; } catch { parties = []; }
    const shown = new Set([c.partner_name, c.rep_name, artistName].filter(Boolean));
    const composeP = (p) => [p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country, p.address].filter(Boolean).join(', ');
    const extras = (Array.isArray(parties) ? parties : []).filter(p => p && p.name && p.role !== 'Venue' && !shown.has(p.name));
    if (extras.length) {
      doc.font(FONT_BOLD).fontSize(9).fillColor('#374151').text('Weitere Beteiligte', MARGIN);
      doc.font(FONT_REG).fontSize(9.5).fillColor('#111827');
      for (const p of extras) {
        const addr = composeP(p);
        doc.text(`${p.role || 'Beteiligte/r'}: ${p.name}${addr ? ' — ' + addr : ''}`, MARGIN, doc.y, { width: CONTENT_W });
      }
      doc.moveDown(0.4);
    }

    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).lineWidth(1).strokeColor('#111827').stroke();
    doc.moveDown(0.6);

    // ── Tabellen-Helfer (einfache Linien-Tabelle) ──
    const drawTable = (title, headers, rows, widths) => {
      if (!rows.length) return;
      ensureSpace(60 + rows.length * 16);
      if (title) { doc.font(FONT_ITALIC).fontSize(9).fillColor('#374151').text(title, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.15); }
      const x0 = MARGIN, totalW = widths.reduce((a, b) => a + b, 0);
      const rowH = 16;
      const drawRow = (cells, bold, bg) => {
        const y = doc.y;
        if (bg) { doc.save().rect(x0, y, totalW, rowH).fill(bg).restore(); }
        let x = x0;
        doc.font(bold ? FONT_BOLD : FONT_REG).fontSize(8.5).fillColor('#111827');
        cells.forEach((cell, i) => {
          const alignRight = i > 0; // erste Spalte links, Rest rechts
          doc.text(String(cell ?? ''), x + 4, y + 4, { width: widths[i] - 8, align: alignRight ? 'right' : 'left', lineBreak: false });
          x += widths[i];
        });
        doc.lineWidth(0.4).strokeColor('#d1d5db').rect(x0, y, totalW, rowH).stroke();
        doc.y = y + rowH;
      };
      drawRow(headers, true, '#f3f4f6');
      rows.forEach(r => { ensureSpace(rowH + 20); drawRow(r, r._bold, r._bg); });
      doc.moveDown(0.5);
    };

    // Tabellen-Daten vorbereiten
    const ticketTableRows = (ticketSales || []).map(s => [
      s.vendor || '—', ART_LABEL[s.art] || s.art || '—', intDE(s.tickets), money(s.price, cur) || '—', money(s.revenue, cur) || '—',
    ]);
    if (ticketTableRows.length) {
      const totTickets = (ticketSales || []).reduce((a, s) => a + num(s.tickets), 0);
      const totRevenue = (ticketSales || []).reduce((a, s) => a + num(s.revenue), 0);
      const totalRow = ['Gesamt', '', intDE(totTickets), '', money(totRevenue, cur)]; totalRow._bold = true; totalRow._bg = '#f9fafb';
      ticketTableRows.push(totalRow);
    }

    const feePer = money(c.fee_per_ticket, cur);
    // Refundierung = Ticketsystem-Gebühr; nur Vorverkaufskanäle (Abendkasse/Eigener Shop haben keine).
    const refundRows = feePer ? (ticketSales || []).filter(s => (s.art || 'vvk') === 'vvk').map(s => [s.vendor || 'Ticketsystem', feePer]) : [];

    // Key-Value-Block (Label links, Wert rechts fett).
    const drawKV = (title, pairs) => {
      const rows = pairs.filter(p => p && p[1] != null && p[1] !== '');
      if (!rows.length) return;
      ensureSpace(30 + rows.length * 14);
      if (title) { doc.font(FONT_ITALIC).fontSize(9).fillColor('#374151').text(title, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.15); }
      const labelW = 210;
      for (const [k, v] of rows) {
        const y = doc.y;
        doc.font(FONT_REG).fontSize(9.5).fillColor('#6b7280').text(k, MARGIN + 6, y, { width: labelW });
        doc.font(FONT_BOLD).fontSize(9.5).fillColor('#111827').text(String(v), MARGIN + 6 + labelW, y, { width: CONTENT_W - labelW - 6 });
        doc.y = Math.max(doc.y, y + 13);
      }
      doc.moveDown(0.4);
    };

    // Event-Details (§1) – variabel aus Booking.
    const eventRows = [
      ['Datum', dateDE(c.event_date)],
      ['Veranstaltungsstätte', c.event_venue],
      ['Adresse', c.venue_address],
      ['Ort', c.event_city],
      ['Kapazität', c.capacity ? `${intDE(c.capacity)} Personen` : null],
      ['Einlass', c.doors_time ? `${c.doors_time} Uhr` : null],
      ['Beginn', c.show_time ? `${c.show_time} Uhr` : null],
    ];

    // Deal-Details (§4) – Basis net/gross + Stufen.
    let tiers = [];
    try { tiers = c.deal_tiers ? JSON.parse(c.deal_tiers) : []; } catch { tiers = []; }
    tiers = (Array.isArray(tiers) ? tiers : []).map(t => ({ from: num(t.from), pct: num(t.pct) })).filter(t => t.pct > 0).sort((a, b) => a.from - b.from);
    const dealTypeLabel = { guarantee: 'Festgage', vs: 'Garantie vs. Beteiligung', plus: 'Garantie plus Beteiligung', door: 'Door Deal' }[c.deal_type] || c.deal_type || '—';
    const basisLabel = c.deal_base === 'netprofit' ? 'Nettogewinn (nach örtlichen Kosten)' : 'Nettoeinnahmen aus Ticketverkäufen';
    const dealRows = [
      ['Deal-Art', dealTypeLabel],
      ['Produktionskostengarantie (netto)', money(c.guarantee, cur)],
      ['Berechnungsbasis Beteiligung', basisLabel],
    ];
    if (tiers.length > 1) {
      tiers.forEach((t, i) => dealRows.push([i === 0 ? 'Beteiligung Artist' : `… ab ${money(t.from, cur)}`, pct(t.pct)]));
    } else {
      dealRows.push(['Beteiligung Artist', pct(c.deal_share)]);
    }

    const payRows = [
      ['Abschlagszahlung (zzgl. USt.)', money(c.deposit, cur), c.deposit_due ? `bis ${dateDE(c.deposit_due)}` : 'nach Anforderung'],
      ['Restzahlung', 'gemäß Abrechnung', c.balance_due ? `bis ${dateDE(c.balance_due)}` : 'nach dem Konzert'],
    ];

    // ── §§-Bausteine (live) + interleaved Deal-Tabellen ──
    clauses.forEach((cl, i) => {
      ensureSpace(90);
      doc.font(FONT_BOLD).fontSize(10.5).fillColor('#111827')
        .text(`§ ${i + 1}  ${cl.title}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.2);
      doc.font(FONT_REG).fontSize(9.5).fillColor('#1f2937')
        .text(fillPlaceholders(cl.body, placeholders) || ' ', MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.5);

      const t = norm(cl.title);
      // §1 Vertragsgegenstand → Veranstaltungsdetails (variabel)
      if (t.startsWith('vertragsgegenstand') || t.includes('gegenstand des vertrags')) {
        drawKV('Veranstaltungsdetails', eventRows);
      }
      // §4 Deal, Entgelt und Zahlungsmodalitäten → Deal, Zahlungen, Refundierung, Bank (variabel)
      if (t.startsWith('deal') || t.includes('entgelt')) {
        drawKV('Deal', dealRows);
        drawTable('Zahlungen (zzgl. gesetzlicher USt.)', ['Position', 'Betrag', 'Fällig'], payRows, [CONTENT_W - 150 - 150, 150, 150]);
        if (refundRows.length) {
          const bandPct = pct(c.fee_band_split_pct);
          drawTable(`Refundierung je Ticket${bandPct ? ` – Artist-Anteil ${bandPct}` : ''}`, ['Ticketsystem', 'Betrag (brutto)'], refundRows, [CONTENT_W - 150, 150]);
        }
        if (c.bank_details) drawKV(null, [['Bankverbindung', String(c.bank_details).replace(/\s*\n\s*/g, ', ')]]);
      }
      // §5 Eintrittspreise, Vorverkauf … → Ticketpreis-/Verkaufstabelle + Support Acts (variabel)
      if (t.startsWith('eintrittspreise') || t.includes('vorverkauf')) {
        drawTable('Vorverkauf / Abendkasse', ['Händler', 'Art', 'Stück', 'Preis', 'Einnahme'], ticketTableRows,
          [CONTENT_W - 100 - 70 - 90 - 95, 100, 70, 90, 95]);
        if (c.support_acts) drawKV(null, [['Support Act(s)', String(c.support_acts).replace(/\s*\n\s*/g, ', ')]]);
      }
    });

    // ── Nebenkosten (falls erfasst) ──
    const costRows = (costLines || []).filter(l => l && (l.label || l.net)).map(l => [l.label || '—', money(l.net, cur) || '—', l.vat ? `${num(l.vat)} %` : '—']);
    if (costRows.length) {
      ensureSpace(80);
      doc.font(FONT_BOLD).fontSize(10.5).fillColor('#111827').text('Nebenkosten / Buyouts', MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.2);
      drawTable(null, ['Position', 'Netto', 'USt'], costRows, [CONTENT_W - 130 - 70, 130, 70]);
    }

    // ── Individualvereinbarungen (haben Vorrang) ──
    if (c.individual_terms) {
      ensureSpace(100);
      doc.font(FONT_BOLD).fontSize(10.5).fillColor('#111827').text('Individualvereinbarungen', MARGIN, doc.y, { width: CONTENT_W });
      doc.font(FONT_REG).fontSize(8).fillColor('#6b7280').text('(haben gemäß Schlussbestimmungen Vorrang vor den vorstehenden Bausteinen)', MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.2);
      doc.font(FONT_REG).fontSize(9.5).fillColor('#1f2937').text(String(c.individual_terms), MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.6);
    }

    // ── Notizen ──
    if (c.notes) {
      ensureSpace(80);
      doc.font(FONT_BOLD).fontSize(9).fillColor('#374151').text('Weitere Vereinbarungen', MARGIN);
      doc.font(FONT_REG).fontSize(9.5).fillColor('#111827').text(String(c.notes), { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.6);
    }

    // ── Unterschriften ──
    ensureSpace(120);
    doc.moveDown(2);
    const sigY = doc.y + 24;
    const sigW = (CONTENT_W - 30) / 2;
    doc.lineWidth(0.7).strokeColor('#111827');
    doc.moveTo(MARGIN, sigY).lineTo(MARGIN + sigW, sigY).stroke();
    doc.moveTo(MARGIN + sigW + 30, sigY).lineTo(MARGIN + CONTENT_W, sigY).stroke();
    doc.font(FONT_REG).fontSize(8).fillColor('#6b7280');
    doc.text(c.rep_name ? 'Ort, Datum – Artist (vertreten durch Agentur)' : 'Ort, Datum – Unterschrift Artist', MARGIN, sigY + 4, { width: sigW });
    doc.text('Ort, Datum – Unterschrift ÖV / Veranstalter', MARGIN + sigW + 30, sigY + 4, { width: sigW });

    doc.end();
  });
}

module.exports = { generateContractPdf };
