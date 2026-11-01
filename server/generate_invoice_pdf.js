'use strict';
/**
 * Erzeugt ein Rechnungs-PDF (Add-on „Booking", Phase 1) mit pdfkit.
 * generateInvoicePdf({ invoice, issuer }) → Promise<Buffer>
 *
 * HINWEIS: Phase 1 = inhaltlich korrektes PDF. Rechtliche „Schärfung" (vollständige
 * §14-UStG-Pflichtangaben je Fall, GoBD-Festschreibung, ZUGFeRD/e-Rechnung, USt-Sonderfälle)
 * kommt in der Compliance-Phase und sollte mit dem Steuerberater geprüft werden.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
function drawLogo(doc, logoPath, x, y) {
  if (!logoPath || !fs.existsSync(logoPath) || !/\.(png|jpe?g)$/i.test(logoPath)) return false;
  try { doc.image(logoPath, x, y, { fit: [120, 40], align: 'right' }); return true; } catch { return false; }
}

const M = 56, PAGE_W = 595, CONTENT_W = PAGE_W - M * 2;
const REG = 'Helvetica', BOLD = 'Helvetica-Bold';

function num(v) { const x = Number(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; }
function money(n, cur = 'EUR') { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur; }
function dateDE(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return (y && m && d) ? `${d}.${m}.${y}` : iso; }

function generateInvoicePdf({ invoice: inv, issuer = {}, logoPath = null }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M } });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cur = inv.currency || 'EUR';
    const totalNet = num(inv.total_net);
    const taxAmt = num(inv.tax_amount);
    const grossAmt = num(inv.gross_amount) || (totalNet + taxAmt);
    const deductions = num(inv.deductions_gross);
    const payable = grossAmt - deductions;
    const titleMap = { deposit: 'Anzahlungsrechnung', final: 'Rechnung' };
    const issuerName = issuer.name || [issuer.firstName, issuer.lastName].filter(Boolean).join(' ') || '—';

    // ── Absenderzeile (klein) ──
    const senderLine = [issuerName, issuer.address, [issuer.postalCode, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    doc.font(REG).fontSize(7).fillColor('#9ca3af').text(senderLine, M, M, { width: CONTENT_W });

    // ── Empfänger (Anschriftenfeld) ──
    doc.font(REG).fontSize(10.5).fillColor('#111827');
    doc.text([inv.recipient_name, inv.recipient_address].filter(Boolean).join('\n') || '—', M, M + 24, { width: 280 });

    // ── Logo (oben rechts) ──
    const hasLogo = drawLogo(doc, logoPath, M + CONTENT_W - 120, M);

    // ── Rechnungs-Meta (rechts) ──
    const metaX = M + CONTENT_W - 200;
    let my = hasLogo ? M + 50 : M + 24;
    const meta = (k, v) => { doc.font(REG).fontSize(9).fillColor('#6b7280').text(k, metaX, my, { width: 90 }); doc.font(BOLD).fontSize(9).fillColor('#111827').text(v, metaX + 90, my, { width: 110 }); my += 14; };
    meta('Rechnungs-Nr.', inv.invoice_no || '—');
    meta('Datum', dateDE(inv.issue_date));
    if (inv.service_date) meta('Leistungsdatum', dateDE(inv.service_date));
    if (issuer.taxId) meta('USt-IdNr./St-Nr.', issuer.taxId);

    // ── Titel ──
    doc.y = M + 120;
    doc.font(BOLD).fontSize(18).fillColor('#111827').text(titleMap[inv.kind] || 'Rechnung', M, doc.y);
    if (inv.event_title || inv.event_date) {
      doc.font(REG).fontSize(10).fillColor('#6b7280').text(
        ['Veranstaltung: ' + (inv.event_title || '—'), inv.event_date ? dateDE(inv.event_date) : null].filter(Boolean).join('  ·  '), M, doc.y + 2);
    }
    doc.moveDown(1);
    doc.moveTo(M, doc.y).lineTo(M + CONTENT_W, doc.y).lineWidth(1).strokeColor('#111827').stroke();
    doc.moveDown(0.6);

    // ── Position ──
    const descY = doc.y;
    doc.font(REG).fontSize(10).fillColor('#111827').text(inv.description || 'Leistung', M, descY, { width: CONTENT_W - 130 });
    doc.font(BOLD).fontSize(10).text(money(totalNet, cur), M + CONTENT_W - 130, descY, { width: 130, align: 'right' });
    doc.moveDown(1);
    doc.moveTo(M, doc.y).lineTo(M + CONTENT_W, doc.y).lineWidth(0.5).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);

    // ── Summenblock (rechts) ──
    const sumX = M + CONTENT_W - 260;
    const line = (k, v, opts = {}) => {
      const yy = doc.y;
      doc.font(opts.bold ? BOLD : REG).fontSize(opts.big ? 11 : 10).fillColor(opts.muted ? '#6b7280' : '#111827');
      doc.text(k, sumX, yy, { width: 150 });
      doc.font(opts.bold ? BOLD : REG).fontSize(opts.big ? 11 : 10).fillColor(opts.muted ? '#6b7280' : '#111827');
      doc.text(v, sumX + 150, yy, { width: 110, align: 'right' });
      doc.moveDown(opts.big ? 0.5 : 0.35);
    };

    line('Rechnungsbetrag netto', money(totalNet, cur));
    line('zzgl. USt', money(taxAmt, cur), { muted: true });
    line('Gesamt brutto', money(grossAmt, cur), { bold: true });
    if (deductions > 0) {
      doc.moveDown(0.2);
      line('abzgl. Anzahlung / Auszahlungen (brutto)', '− ' + money(deductions, cur), { muted: true });
      doc.moveDown(0.2);
      doc.moveTo(sumX, doc.y).lineTo(sumX + 260, doc.y).lineWidth(0.5).strokeColor('#d1d5db').stroke();
      doc.moveDown(0.3);
      line('Zahlbetrag', money(payable, cur), { bold: true, big: true });
    } else {
      doc.moveDown(0.1);
      line('Zahlbetrag', money(payable, cur), { bold: true, big: true });
    }

    // ── Fußzeile ──
    doc.font(REG).fontSize(8).fillColor('#9ca3af');
    const footer = [
      issuerName,
      [issuer.address, [issuer.postalCode, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      [issuer.email, issuer.phone].filter(Boolean).join(' · '),
      issuer.taxId ? `USt-IdNr./St-Nr.: ${issuer.taxId}` : null,
    ].filter(Boolean).join('   ·   ');
    doc.text(footer, M, 790, { width: CONTENT_W, align: 'center' });

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
