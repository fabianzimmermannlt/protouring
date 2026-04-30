'use strict';
/**
 * Fixed-zone A6 landscape label generator (pdfkit + qrcode).
 * Zones are fixed; content adapts via auto font-scaling.
 * A6 landscape: 419.53 × 297.64 pt
 */
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const fs          = require('fs');

const W = 419.53;
const H = 297.64;
const M = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Auto font-size: steps = [[maxLen, size], ...] */
function autoSize(text, steps) {
  const len = (text || '').replace(/\n/g, '').length;
  for (const [max, size] of steps) {
    if (len <= max) return size;
  }
  return steps[steps.length - 1][1];
}

/**
 * Draw text and immediately reset doc.y to prevent pdfkit's
 * internal cursor from crossing page bottom and auto-adding a 2nd page.
 */
function txt(doc, text, x, y, opts) {
  doc.text(text, x, y, opts);
  if (doc.y > H - 1) doc.y = Math.min(y, H - 1);
}

// ── Position abbreviation map ─────────────────────────────────────────────────

const POSITION_ABBR = {
  sl: 'SL', sr: 'SR', cs: 'CS', us: 'US', ds: 'DS',
  usl: 'USL', usr: 'USR', usc: 'USC',
  cl: 'CL', cr: 'CR',
  dsl: 'DSL', dsr: 'DSR', dsc: 'DSC',
  swl: 'SWL', swr: 'SWR',
  osl: 'OSL', osr: 'OSR', osc: 'OSC',
  foh: 'FOH', mon: 'MON', backstage: 'BST',
  distro: 'DIST', delay: 'DLY', merchandise: 'MERCH',
  balcony: 'BAL', sonstiges: null,
};

const TYP_LABELS = {
  case: 'Case', dolly: 'Dolly', gitterbox: 'Gitterbox',
  kulisse: 'Kulisse', sonstiges: 'Sonstiges',
};

const DEFAULT_TEMPLATE = {
  headerBgColor: '#111111',
  showLoadOrder: true,
  showGruppe:    true,
  showPosition:  true,
  showQR:        true,
  showGewicht:   false,
  showTyp:       false,
};

// ── Main export ───────────────────────────────────────────────────────────────

async function generateEquipmentLabel(opts) {
  const {
    artistName     = '',
    logoPath       = null,
    useArtistName  = true,
    tourName       = '',
    caseId         = '',
    bezeichnung    = '',
    loadOrder      = null,
    position       = null,
    positionCustom = null,
    gruppeName     = null,
    gruppeXY       = null,
    gesamtgewicht  = null,
    typ            = null,
    template       = {},
  } = opts;

  const {
    headerBgColor = '#111111',
    showLoadOrder = true,
    showGruppe    = true,
    showPosition  = true,
    showQR        = true,
    showGewicht   = false,
    showTyp       = false,
  } = { ...DEFAULT_TEMPLATE, ...template };

  // Position abbreviation
  let posAbbr = null;
  if (position && position !== 'sonstiges') {
    posAbbr = POSITION_ABBR[position] ?? position.toUpperCase().slice(0, 5);
  } else if (position === 'sonstiges' && positionCustom) {
    posAbbr = positionCustom.toUpperCase().slice(0, 6);
  }

  // QR code
  let qrBuffer = null;
  if (showQR) {
    try {
      qrBuffer = await QRCode.toBuffer(caseId || 'N/A', {
        type: 'png', width: 160, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR generation failed:', e.message);
    }
  }

  // Tour name: replace <br> with newline
  const tourText  = (tourName || '').replace(/<br\s*\/?>/gi, '\n').trim();
  const tourLines = tourText ? tourText.split('\n') : [];

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
    });
    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Block any attempt by pdfkit to add a 2nd page.
    // doc.addPage() is called internally when text overflows page height.
    // We clip visually AND prevent the page addition entirely.
    doc.save();
    doc.rect(0, 0, W, H).clip();
    const _addPage = doc.addPage.bind(doc);
    doc.addPage = function () {
      console.warn('Label: overflow blocked – staying on page 1');
      return doc; // no-op
    };

    // ── HEADER BACKGROUND ───────────────────────────────────────────────────
    const HDR_H = 68;
    doc.rect(0, 0, W, HDR_H).fill(headerBgColor);

    // ── ARTIST ZONE (x=M, w=232) ────────────────────────────────────────────
    const artistW = 232;
    if (!useArtistName && logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, M + 2, 4, { fit: [artistW - 8, HDR_H - 8], align: 'left', valign: 'center' });
      } catch {
        drawArtistText(doc, artistName, artistW, HDR_H);
      }
    } else {
      drawArtistText(doc, artistName, artistW, HDR_H);
    }

    // ── TOUR NAME ZONE (x=242, w=170) ───────────────────────────────────────
    if (tourLines.length > 0) {
      const tourW  = 170;
      const tourX  = 242;
      const tourFS = autoSize(tourText, [[12, 18], [20, 14], [Infinity, 11]]);
      const lineH  = tourFS * 1.25;
      const blockH = tourLines.length * lineH;
      const startY = Math.max((HDR_H - blockH) / 2, 2);
      tourLines.forEach((line, i) => {
        const ty = startY + i * lineH;
        doc.fillColor('#ffffff').fontSize(tourFS).font('Helvetica-Bold');
        txt(doc, line.trim(), tourX, ty, { width: tourW, align: 'center', lineBreak: false, ellipsis: true });
      });
    }

    // ── CASE ID (y=80) ──────────────────────────────────────────────────────
    doc.fillColor('#111111').fontSize(7).font('Helvetica');
    txt(doc, 'INHALT:', M, 80, { lineBreak: false });
    if (caseId) {
      doc.fillColor('#111111').fontSize(8).font('Helvetica-Bold');
      txt(doc, caseId, M, 80, { width: W - M * 2, align: 'right', lineBreak: false });
    }

    // ── BEZEICHNUNG (y=92, h=35) ────────────────────────────────────────────
    if (bezeichnung) {
      const bezFS = autoSize(bezeichnung, [[20, 22], [28, 18], [Infinity, 14]]);
      const bezY  = 92 + Math.max((35 - bezFS) / 2, 0);
      doc.fillColor('#111111').fontSize(bezFS).font('Helvetica-Bold');
      txt(doc, bezeichnung, M, bezY, { width: W - M * 2, lineBreak: false, ellipsis: true });
    }

    // ── SEPARATOR (y=131) ────────────────────────────────────────────────────
    doc.moveTo(M, 131).lineTo(W - M, 131).lineWidth(0.75).stroke('#111111');

    // ── LOAD ORDER (x=M, w=148, bottom-anchored) ────────────────────────────
    if (showLoadOrder && loadOrder != null) {
      const loadStr = String(loadOrder).padStart(2, '0');
      // 3 cm cap-height: Helvetica cap-height ≈ 0.718 × em → em ≈ 85 / 0.718 ≈ 118 pt
      const numFS = 118;
      // Bottom-anchor: zone bottom = y=290, visible glyph sits from numY to numY+numFS.
      // Leave 2 pt bottom margin.
      const numY = 290 - numFS - 2;
      doc.fillColor('#111111').fontSize(7).font('Helvetica');
      txt(doc, 'Ladereihenfolge', M, 136, { width: 148, lineBreak: false });
      doc.fillColor('#111111').fontSize(numFS).font('Helvetica-Bold');
      txt(doc, loadStr, M, numY, { width: 148, lineBreak: false });
    }

    // ── GRUPPE + POSITION ZONE (x=161, w=90) ────────────────────────────────
    const midX = 161;
    const midW = 90;

    if (showGruppe && gruppeName) {
      const grpFS = autoSize(gruppeName, [[5, 30], [8, 22], [Infinity, 16]]);
      doc.fillColor('#111111').fontSize(7).font('Helvetica');
      txt(doc, 'Gruppe', midX, 136, { width: midW, lineBreak: false });
      doc.fillColor('#111111').fontSize(grpFS).font('Helvetica-Bold');
      txt(doc, gruppeName, midX, 148, { width: midW, lineBreak: false, ellipsis: true });
      if (gruppeXY) {
        const gyXY = 148 + Math.round(grpFS * 1.2);
        txt(doc, gruppeXY, midX, gyXY, { width: midW, lineBreak: false });
      }
    }

    if (showPosition && posAbbr) {
      const posFS = posAbbr.length <= 5 ? 30 : 22;
      doc.fillColor('#111111').fontSize(7).font('Helvetica');
      txt(doc, 'Standort', midX, 230, { width: midW, lineBreak: false });
      doc.fillColor('#111111').fontSize(posFS).font('Helvetica-Bold');
      txt(doc, posAbbr, midX, 242, { width: midW, lineBreak: false });
    }

    // ── QR CODE (x=258, 4.5 cm = 128 pt) ───────────────────────────────────
    if (showQR) {
      const qrX = 258;
      const qrS = 128; // 4.5 cm = 127.56 pt ≈ 128 pt
      // Center vertically in the 154pt zone (y=136..290)
      const qrY = 136 + Math.round((154 - qrS) / 2);
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, qrY, { width: qrS, height: qrS });
      } else {
        doc.rect(qrX, qrY, qrS, qrS).stroke('#111111');
        doc.fillColor('#111111').fontSize(8).font('Helvetica');
        txt(doc, caseId || '', qrX, qrY + qrS / 2 - 4, { width: qrS, align: 'center', lineBreak: false });
      }
    }

    // ── OPTIONAL FOOTER ──────────────────────────────────────────────────────
    let footY = 254;
    if (showTyp && typ) {
      doc.fillColor('#555555').fontSize(9).font('Helvetica');
      txt(doc, TYP_LABELS[typ] || typ, M, footY, { width: 160, lineBreak: false });
      footY += 14;
    }
    if (showGewicht && gesamtgewicht) {
      doc.fillColor('#555555').fontSize(9).font('Helvetica');
      txt(doc, `Gewicht: ${gesamtgewicht} kg`, M, footY, { width: 160, lineBreak: false });
    }

    // Restore real addPage before ending (pdfkit needs it internally for finalization)
    doc.addPage = _addPage;
    doc.end();
  });
}

function drawArtistText(doc, name, w, hdrH) {
  if (!name) return;
  const fs = autoSize(name, [[10, 20], [16, 16], [22, 12], [Infinity, 9]]);
  const ty = Math.max((hdrH - fs) / 2, 2);
  doc.fillColor('#ffffff').fontSize(fs).font('Helvetica-Bold');
  txt(doc, name, M + 2, ty, { width: w - 8, lineBreak: false, ellipsis: true });
}

module.exports = { generateEquipmentLabel, DEFAULT_TEMPLATE };
