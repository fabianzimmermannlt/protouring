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

function generateInvoicePdf({ invoice: inv, issuer = {}, logoPath = null, draft = false }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M } });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Vorschau/Entwurf: diagonales Wasserzeichen, damit das PDF nicht mit einer echten Rechnung
    // verwechselt wird (keine gültige Rechnungsnummer, nicht gebucht).
    if (draft) {
      doc.save();
      doc.rotate(-32, { origin: [PAGE_W / 2, 421] });
      doc.font(BOLD).fontSize(96).fillColor('#dc2626').opacity(0.08)
        .text('VORSCHAU', PAGE_W / 2 - 320, 421 - 70, { width: 640, align: 'center' });
      doc.restore();
      doc.y = M;
    }

    const cur = inv.currency || 'EUR';
    const totalNet = num(inv.total_net);
    const taxAmt = num(inv.tax_amount);
    const grossAmt = num(inv.gross_amount) || (totalNet + taxAmt);
    // USt-Satz: aus dem Datensatz, sonst aus Betrag/Netto abgeleitet (eff. Satz).
    const taxRate = num(inv.tax_rate) || (totalNet > 0 ? Math.round((taxAmt / totalNet) * 10000) / 100 : 0);
    const pctDE = r => r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    const deductions = num(inv.deductions_gross);
    const payable = grossAmt - deductions;
    const titleMap = { deposit: 'Anzahlungsrechnung', final: 'Rechnung' };
    const issuerName = issuer.name || [issuer.firstName, issuer.lastName].filter(Boolean).join(' ') || '—';
    const issuerAddrLines = [
      issuer.address,
      [issuer.postalCode, issuer.city].filter(Boolean).join(' '),
      issuer.country,
    ].filter(Boolean);

    // ── Absenderzeile (klein, DIN 5008 über dem Anschriftfeld) ──
    const senderLine = [issuerName, ...issuerAddrLines].join(' · ');
    doc.font(REG).fontSize(7).fillColor('#9ca3af').text(senderLine, M, M, { width: 280 });

    // ── Empfänger (Anschriftenfeld) ──
    doc.font(REG).fontSize(10.5).fillColor('#111827');
    doc.text([inv.recipient_name, inv.recipient_address].filter(Boolean).join('\n') || '—', M, M + 22, { width: 260 });
    const leftBottom = doc.y;

    // ── Rechte Spalte: Logo + Aussteller-Anschrift (Rechnungssteller = Band) + Meta ──
    const colW = 210, colX = M + CONTENT_W - colW;
    let yR = M;
    if (drawLogo(doc, logoPath, colX + colW - 120, yR)) yR += 48;
    doc.font(BOLD).fontSize(10.5).fillColor('#111827').text(issuerName, colX, yR, { width: colW, align: 'right' });
    yR = doc.y + 1;
    if (issuerAddrLines.length) {
      doc.font(REG).fontSize(9).fillColor('#6b7280').text(issuerAddrLines.join('\n'), colX, yR, { width: colW, align: 'right' });
      yR = doc.y;
    }
    const issuerContact = [issuer.email, issuer.phone].filter(Boolean).join('  ·  ');
    if (issuerContact) { doc.font(REG).fontSize(9).fillColor('#6b7280').text(issuerContact, colX, yR, { width: colW, align: 'right' }); yR = doc.y; }
    yR += 12;

    // ── Rechnungs-Meta ──
    const meta = (k, v) => {
      const ly = yR;
      doc.font(REG).fontSize(9).fillColor('#6b7280').text(k, colX, ly, { width: colW - 110, align: 'left' });
      doc.font(BOLD).fontSize(9).fillColor('#111827').text(v, colX + colW - 110, ly, { width: 110, align: 'right' });
      yR = Math.max(doc.y, ly + 13);
    };
    meta('Rechnungs-Nr.', draft ? 'Entwurf (noch keine)' : (inv.invoice_no || '—'));
    meta('Datum', dateDE(inv.issue_date));
    if (inv.service_date) meta('Leistungsdatum', dateDE(inv.service_date));
    if (issuer.taxId) meta('USt-IdNr./St-Nr.', issuer.taxId);

    // ── Titel ──
    doc.y = Math.max(leftBottom, yR, M + 108) + 16;
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
    const SUMW = 300, LBLW = 200, VALW = SUMW - LBLW;
    const sumX = M + CONTENT_W - SUMW;
    const line = (k, v, opts = {}) => {
      const yy = doc.y;
      const f = opts.bold ? BOLD : REG, fs = opts.big ? 11 : 10, col = opts.muted ? '#6b7280' : '#111827';
      doc.font(f).fontSize(fs).fillColor(col);
      const hK = doc.heightOfString(k, { width: LBLW });
      doc.text(k, sumX, yy, { width: LBLW });
      doc.font(f).fontSize(fs).fillColor(col);
      doc.text(v, sumX + LBLW, yy, { width: VALW, align: 'right' });
      doc.y = yy + Math.max(hK, fs + 2);   // Zeilenhöhe = höhere der beiden Spalten (kein Überlapp bei Umbruch)
      doc.moveDown(opts.big ? 0.4 : 0.3);
    };

    line('Rechnungsbetrag netto', money(totalNet, cur));
    line('zzgl. USt ' + pctDE(taxRate), money(taxAmt, cur), { muted: true });
    line('Gesamt brutto', money(grossAmt, cur), { bold: true });
    if (deductions > 0) {
      doc.moveDown(0.2);
      line('abzgl. geleistete Zahlungen (brutto)', '- ' + money(deductions, cur), { muted: true });
      doc.moveDown(0.15);
      doc.moveTo(sumX, doc.y).lineTo(sumX + SUMW, doc.y).lineWidth(0.5).strokeColor('#d1d5db').stroke();
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
