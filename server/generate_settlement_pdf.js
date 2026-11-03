'use strict';
/**
 * Erzeugt ein Abrechnungs-PDF (Add-on „Booking") mit pdfkit – die Kalkulations-Aufstellung
 * der Show-Abrechnung (Ticketumsatz → Gebühren → Deal → Abzüge → offener Betrag an die Band).
 * generateSettlementPdf({ contract, issuer, lines, dealLabel, logoPath }) → Promise<Buffer>
 *
 * Die Zeilen (lines) kommen fertig formatiert aus dem getesteten Client-Rechenkern
 * (computeSettlement) – so ist das PDF 1:1 identisch mit der Anzeige in der App.
 * Interne Aufstellung, keine Rechnung (dafür gibt es die Rechnungs-PDFs).
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');

const M = 56, PAGE_W = 595, CONTENT_W = PAGE_W - M * 2;
const REG = 'Helvetica', BOLD = 'Helvetica-Bold';

function drawLogo(doc, logoPath, x, y) {
  if (!logoPath || !fs.existsSync(logoPath) || !/\.(png|jpe?g)$/i.test(logoPath)) return false;
  try { doc.image(logoPath, x, y, { fit: [120, 40], align: 'right' }); return true; } catch { return false; }
}
function dateDE(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return (y && m && d) ? `${d}.${m}.${y}` : iso; }

function generateSettlementPdf({ contract: c = {}, issuer = {}, lines = [], dealLabel = '', logoPath = null }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M } });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const issuerName = issuer.name || [issuer.firstName, issuer.lastName].filter(Boolean).join(' ') || '—';

    // ── Logo (oben rechts) ──
    const hasLogo = drawLogo(doc, logoPath, M + CONTENT_W - 120, M);

    // ── Titel ──
    doc.font(BOLD).fontSize(18).fillColor('#111827').text('Abrechnung', M, M);
    const sub = ['Veranstaltung: ' + (c.event_title || '—'), c.event_date ? dateDE(c.event_date) : null].filter(Boolean).join('  ·  ');
    doc.font(REG).fontSize(10).fillColor('#6b7280').text(sub, M, doc.y + 2);
    doc.moveDown(0.6);

    // ── Beteiligte + Deal ──
    const kv = (k, v) => { if (!v) return; doc.font(REG).fontSize(9).fillColor('#6b7280').text(k + ': ', M, doc.y, { continued: true }); doc.font(BOLD).fillColor('#111827').text(String(v)); };
    kv('Artist / Rechnungssteller', issuerName);
    kv('Veranstalter', c.partner_name);
    kv('Deal', dealLabel);
    doc.moveDown(0.4);
    doc.moveTo(M, doc.y).lineTo(M + CONTENT_W, doc.y).lineWidth(1).strokeColor('#111827').stroke();
    doc.moveDown(0.6);

    // ── Aufstellung (Label links, Wert rechts) ──
    // U+2212 (echtes Minus) ist nicht im WinAnsi-Zeichensatz von Helvetica → durch ASCII-„-" ersetzen.
    const sane = (s) => String(s ?? '').replace(/−/g, '-');
    const labelX = M, valX = M + CONTENT_W - 170;
    for (const ln of lines) {
      if (ln.rule) { doc.moveDown(0.15); doc.moveTo(valX, doc.y).lineTo(M + CONTENT_W, doc.y).lineWidth(0.5).strokeColor('#d1d5db').stroke(); doc.moveDown(0.3); }
      const yy = doc.y;
      const size = ln.big ? 12 : 10;
      const color = ln.muted ? '#6b7280' : '#111827';
      doc.font(ln.bold ? BOLD : REG).fontSize(size).fillColor(color);
      doc.text(sane(ln.label), labelX + (ln.sub ? 14 : 0), yy, { width: valX - labelX - (ln.sub ? 14 : 0) });
      doc.font(ln.bold ? BOLD : REG).fontSize(size).fillColor(color);
      doc.text(sane(ln.value), valX, yy, { width: 170, align: 'right' });
      doc.moveDown(ln.big ? 0.5 : 0.3);
    }

    // ── Fußzeile ──
    doc.font(REG).fontSize(8).fillColor('#9ca3af');
    doc.text('Interne Abrechnungs-Aufstellung – keine Rechnung. Erzeugt mit ProTouring.', M, 800, { width: CONTENT_W, align: 'center' });

    doc.end();
  });
}

module.exports = { generateSettlementPdf };
