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
// Einheitliche Typografie: wenige feste Größen (Titel / Überschrift / Fließtext / Tabelle / klein),
// nur Regular + Bold. Hängende Einrückung: IND1 hinter Ziffern, IND1+IND2 hinter Bullets.
const SIZE_TITLE = 18, SIZE_H = 11, SIZE_BODY = 9.5, SIZE_TABLE = 8.5, SIZE_SMALL = 8;
const INK = '#111827', BODY_INK = '#1f2937', MUTED = '#6b7280', LINE = '#d1d5db';
const LINEGAP = 2.5, IND1 = 15, IND2 = 14;

function drawLogo(doc, logoPath) {
  // Logo oben mittig; gibt die untere Y-Kante zurück, damit der Titel darunter sitzt.
  const boxW = 170, boxH = 56;
  if (!logoPath || !fs.existsSync(logoPath) || !/\.(png|jpe?g)$/i.test(logoPath)) return MARGIN;
  try {
    doc.image(logoPath, (PAGE_W - boxW) / 2, MARGIN, { fit: [boxW, boxH], align: 'center', valign: 'center' });
    return MARGIN + boxH;
  } catch { return MARGIN; }
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
      agentur: c.rep_name || 'die den Artist vertretende Gesellschaft',
    };

    const ensureSpace = (need) => { if (doc.y > PAGE_H - MARGIN - need) doc.addPage(); };

    // ── Kopf: Logo oben mittig, darunter zentrierter Titel ──
    const afterLogo = drawLogo(doc, c.logoPath || null);
    const titleY = afterLogo > MARGIN ? afterLogo + 10 : MARGIN + 6;
    doc.font(FONT_BOLD).fontSize(SIZE_TITLE).fillColor(INK).text(c.title || 'Konzertvertrag', MARGIN, titleY, { width: CONTENT_W, align: 'center' });
    if (c.contract_no) doc.font(FONT_REG).fontSize(SIZE_SMALL).fillColor('#9ca3af').text(`Nr. ${c.contract_no}`, MARGIN, doc.y + 1, { width: CONTENT_W, align: 'center' });
    doc.moveDown(1);

    // ── Parteienkopf (zwischen … vertreten durch … und …) ──
    const addrLine = (parts) => parts.filter(Boolean).join(', ');
    const partyBlock = (intro, name, addr, extra, tag) => {
      if (intro) { doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(MUTED).text(intro, MARGIN, doc.y, { width: CONTENT_W, align: 'center' }); doc.moveDown(0.1); }
      doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor(INK).text(`${name || '—'}${addr ? ', ' + addr : ''}`, MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
      if (extra) doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(MUTED).text(extra, MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
      doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor(MUTED).text(`– „${tag}" –`, MARGIN, doc.y + 1, { width: CONTENT_W, align: 'center' });
      doc.moveDown(0.5);
    };

    const artistAddr = addrLine([artist.address, [artist.postalCode, artist.city].filter(Boolean).join(' '), artist.country]);
    const artistExtra = artist.taxId ? `VAT ID / USt-IdNr.: ${artist.taxId}` : null;
    partyBlock('zwischen', artistName, artistAddr, artistExtra, 'Artist');
    if (c.rep_name) partyBlock('vertreten durch', c.rep_name, c.rep_address || '', null, 'Agentur');
    partyBlock('und', c.partner_name, c.partner_address || '', c.partner_email || null, 'ÖV');

    doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(MUTED)
      .text('– Artist und ÖV gemeinsam auch als „Parteien" und einzeln als „Partei" –', MARGIN, doc.y, { width: CONTENT_W, align: 'center' });
    doc.moveDown(0.6);

    // ── Weitere Beteiligte (mehrstufige Parteienkette, außer Venue/bereits gezeigte) ──
    let parties = [];
    try { parties = c.parties ? JSON.parse(c.parties) : []; } catch { parties = []; }
    const shown = new Set([c.partner_name, c.rep_name, artistName].filter(Boolean));
    const composeP = (p) => [p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country, p.address].filter(Boolean).join(', ');
    const extras = (Array.isArray(parties) ? parties : []).filter(p => p && p.name && p.role !== 'Venue' && !shown.has(p.name));
    if (extras.length) {
      doc.font(FONT_BOLD).fontSize(SIZE_H).fillColor(INK).text('Weitere Beteiligte', MARGIN);
      doc.moveDown(0.2);
      doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK);
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
      if (title) { doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor(MUTED).text(title, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.2); }
      const x0 = MARGIN, totalW = widths.reduce((a, b) => a + b, 0);
      const rowH = 16;
      const drawRow = (cells, bold, bg) => {
        const y = doc.y;
        if (bg) { doc.save().rect(x0, y, totalW, rowH).fill(bg).restore(); }
        let x = x0;
        doc.font(bold ? FONT_BOLD : FONT_REG).fontSize(SIZE_TABLE).fillColor(INK);
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
      if (title) { doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor(MUTED).text(title, MARGIN, doc.y, { width: CONTENT_W }); doc.moveDown(0.2); }
      const labelW = 210;
      for (const [k, v] of rows) {
        const y = doc.y;
        doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(MUTED).text(k, MARGIN + 6, y, { width: labelW });
        doc.font(FONT_BOLD).fontSize(SIZE_BODY).fillColor(INK).text(String(v), MARGIN + 6 + labelW, y, { width: CONTENT_W - labelW - 6 });
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

    // Hängende Einrückung: Marker (Ziffer/Bullet) links, Text in einer eingerückten Spalte,
    // sodass umbrochene Zeilen unter dem Text (nicht unter der Ziffer) stehen.
    const hang = (marker, mx, text, tx, tw) => {
      const y0 = doc.y;
      doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK).text(text, tx, y0, { width: tw, lineGap: LINEGAP });
      const y1 = doc.y;
      doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK).text(marker, mx, y0, { width: tx - mx });
      doc.y = Math.max(y1, doc.y);
    };
    // Baustein-Text zeilenweise: „1." / „2." → Ziffer-Einrückung, „•" → Bullet, sonst Fließzeile
    // (unter der Ziffernspalte, wenn der § nummeriert ist).
    const drawClauseBody = (text) => {
      const hasNum = /(^|\n)\s*\d+\.\s/.test(text);
      for (const raw of String(text || '').split('\n')) {
        const line = raw.trim();
        if (!line) { doc.moveDown(0.2); continue; }
        ensureSpace(26);
        let m;
        if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
          hang(`${m[1]}.`, MARGIN, m[2], MARGIN + IND1, CONTENT_W - IND1);
        } else if ((m = line.match(/^[•·]\s*(.*)$/))) {
          hang('•', MARGIN + IND1, m[1], MARGIN + IND1 + IND2, CONTENT_W - IND1 - IND2);
        } else {
          const x = hasNum ? MARGIN + IND1 : MARGIN;
          doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK).text(line, x, doc.y, { width: CONTENT_W - (x - MARGIN), lineGap: LINEGAP });
        }
        doc.moveDown(0.12);
      }
    };

    // ── §§-Bausteine (live) + interleaved Deal-Tabellen ──
    clauses.forEach((cl, i) => {
      ensureSpace(90);
      doc.font(FONT_BOLD).fontSize(SIZE_H).fillColor(INK)
        .text(`§ ${i + 1}  ${cl.title}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.3);
      drawClauseBody(fillPlaceholders(cl.body, placeholders) || ' ');
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
      doc.font(FONT_BOLD).fontSize(SIZE_H).fillColor(INK).text('Nebenkosten / Buyouts', MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.3);
      drawTable(null, ['Position', 'Netto', 'USt'], costRows, [CONTENT_W - 130 - 70, 130, 70]);
    }

    // ── Individualvereinbarungen (haben Vorrang) ──
    if (c.individual_terms) {
      ensureSpace(100);
      doc.font(FONT_BOLD).fontSize(SIZE_H).fillColor(INK).text('Individualvereinbarungen', MARGIN, doc.y, { width: CONTENT_W });
      doc.font(FONT_REG).fontSize(SIZE_SMALL).fillColor(MUTED).text('(haben gemäß Schlussbestimmungen Vorrang vor den vorstehenden Bausteinen)', MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.25);
      doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK).text(String(c.individual_terms), MARGIN, doc.y, { width: CONTENT_W, lineGap: LINEGAP });
      doc.moveDown(0.6);
    }

    // ── Notizen ──
    if (c.notes) {
      ensureSpace(80);
      doc.font(FONT_BOLD).fontSize(SIZE_H).fillColor(INK).text('Weitere Vereinbarungen', MARGIN);
      doc.moveDown(0.3);
      doc.font(FONT_REG).fontSize(SIZE_BODY).fillColor(BODY_INK).text(String(c.notes), MARGIN, doc.y, { width: CONTENT_W, lineGap: LINEGAP });
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
