'use strict';
/**
 * Generates an A6 landscape equipment case label PDF using pdfkit.
 * Usage: generateEquipmentLabel(options) → Promise<Buffer>
 *
 * Layout (A6 landscape = 419.53 × 297.64 pt):
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  ARTIST NAME / LOGO (white, left)     TOUR NAME (white, right)  │ ← black header
 *  ├─────────────────────────────────────────────────────────────────┤
 *  │  INHALT:                                        BTD-D1 (small)  │
 *  │  Bezeichnung (large bold)                                       │
 *  ├──────────────┬──────────────────────────────┬───────────────────┤
 *  │ Ladereihenf. │ Gruppe                       │                   │
 *  │ 003 (riesig) │ DRU (groß)                   │  [QR CODE]        │
 *  │              │ 1/3 (mittel)                 │                   │
 *  │              │ Standort                     │                   │
 *  │              │ FOH (groß)                   │                   │
 *  └──────────────┴──────────────────────────────┴───────────────────┘
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');

// A6 landscape: width=419.53, height=297.64
const W = 419.53;
const H = 297.64;
const M = 7; // margin

/** Default template – matches the original hardcoded layout */
const DEFAULT_TEMPLATE = {
  showCaseId:             true,
  showBezeichnung:        true,
  showLoadOrder:          true,
  showGruppe:             true,
  showPosition:           true,
  showQrCode:             true,
  headerH:                68,
  loadOrderFontSize:      108,
  gruppeFontSize:         30,
  bezeichnungMaxFontSize: 22,
  tourNameFontSize:       18,
};

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
    template       = {},
  } = opts;

  // Merge with defaults
  const tpl = { ...DEFAULT_TEMPLATE, ...template };

  const HEADER_H  = tpl.headerH;
  const CONTENT_Y = HEADER_H + 10;
  const LOWER_Y   = CONTENT_Y + 58;

  // QR code als PNG-Buffer
  let qrBuffer = null;
  if (tpl.showQrCode) {
    try {
      qrBuffer = await QRCode.toBuffer(caseId || 'N/A', {
        type: 'png', width: 160, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR generation failed:', e.message);
    }
  }

  // Position-Kürzel
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

  let posAbbr = null;
  if (tpl.showPosition) {
    if (position && position !== 'sonstiges') {
      posAbbr = POSITION_ABBR[position] ?? position.toUpperCase().slice(0, 5);
    } else if (position === 'sonstiges' && positionCustom) {
      posAbbr = positionCustom.toUpperCase().slice(0, 6);
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
    });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER (schwarzer Balken) ─────────────────────────────────────────
    doc.rect(0, 0, W, HEADER_H).fill('#111111');

    // Header links: Logo oder Artist-Name — vertikal zentriert
    if (!useArtistName && logoPath && fs.existsSync(logoPath)) {
      try {
        const maxLogoW = Math.round(W * 2 / 3 - 28.35); // ~252pt ≈ 9cm
        doc.image(logoPath, M, 6, { fit: [maxLogoW, HEADER_H - 12] });
      } catch {
        const afs = 18;
        const ay  = (HEADER_H - afs) / 2;
        doc.fillColor('#ffffff').fontSize(afs).font('Helvetica-Bold')
          .text(artistName || '', M, ay, { width: 210, lineBreak: false, ellipsis: true });
      }
    } else {
      const afs = 14;
      const ay  = (HEADER_H - afs) / 2;
      doc.fillColor('#ffffff').fontSize(afs).font('Helvetica-Bold')
        .text(artistName || '', M, ay, { width: 200, lineBreak: false, ellipsis: true });
    }

    // Header rechts: Tour-Name — <br> als manueller Zeilenumbruch, vertikal zentriert
    if (tourName) {
      const tourFontSize = tpl.tourNameFontSize;
      const tourLineH    = tourFontSize * 1.25;
      const tourText     = tourName.replace(/<br\s*\/?>/gi, '\n');
      const tourLines    = tourText.split('\n').length;
      const tourBlockH   = tourLines * tourLineH;
      const tourY        = Math.max((HEADER_H - tourBlockH) / 2, 4);
      doc.fillColor('#ffffff').fontSize(tourFontSize).font('Helvetica-Bold')
        .text(tourText, W - M - 180, tourY,
          { width: 180, align: 'center', lineBreak: true, ellipsis: false });
    }

    // ── INHALT-SECTION ─────────────────────────────────────────────────────
    const contentW = W - M * 2;

    doc.fillColor('#111111').fontSize(7).font('Helvetica')
      .text('INHALT:', M, CONTENT_Y + 2);

    if (tpl.showCaseId) {
      doc.fillColor('#111111').fontSize(8).font('Helvetica-Bold')
        .text(caseId, M, CONTENT_Y + 2, { width: contentW, align: 'right' });
    }

    if (tpl.showBezeichnung) {
      const bezMax  = tpl.bezeichnungMaxFontSize;
      const bezSize = bezeichnung.length > 28 ? Math.round(bezMax * 0.77)
        : bezeichnung.length > 20 ? Math.round(bezMax * 0.86)
        : bezMax;
      doc.fillColor('#111111').fontSize(bezSize).font('Helvetica-Bold')
        .text(bezeichnung, M, CONTENT_Y + 14, { width: contentW, lineBreak: false, ellipsis: true });
    }

    // ── TRENNLINIE ──────────────────────────────────────────────────────────
    doc.moveTo(M, LOWER_Y - 5).lineTo(W - M, LOWER_Y - 5)
      .lineWidth(0.5).stroke('#111111');

    // ── SPALTEN-LAYOUT ──────────────────────────────────────────────────────
    // QR-Code: rechts, quadratisch bis Unterrand
    const qrSize = H - LOWER_Y - M;
    const qrX    = tpl.showQrCode ? W - M - qrSize : W - M;

    if (tpl.showQrCode) {
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, LOWER_Y, { width: qrSize, height: qrSize });
      } else {
        doc.rect(qrX, LOWER_Y, qrSize, qrSize).stroke('#111111');
        doc.fillColor('#111111').fontSize(8).font('Helvetica')
          .text(caseId, qrX, LOWER_Y + qrSize / 2 - 4, { width: qrSize, align: 'center' });
      }
    }

    // Linke Spalte: Ladereihenfolge
    const leftColW = tpl.showLoadOrder ? 148 : 0;
    if (tpl.showLoadOrder) {
      const loadStr     = loadOrder != null ? String(loadOrder).padStart(2, '0') : '—';
      const numFontSize = tpl.loadOrderFontSize;
      const numY        = Math.max(H - numFontSize * 1.2, LOWER_Y + 12);

      doc.fillColor('#111111').fontSize(7).font('Helvetica')
        .text('Ladereihenfolge', M, LOWER_Y, { width: leftColW });
      doc.fillColor('#111111').fontSize(numFontSize).font('Helvetica-Bold')
        .text(loadStr, M, numY, { width: leftColW, lineBreak: false, align: 'left' });
    }

    // Mittlere Spalte: Gruppe + Standort
    const midX = M + leftColW + (leftColW > 0 ? 6 : 0);
    const midW = qrX - midX - 8;
    let   midY = LOWER_Y;
    const gfs  = tpl.gruppeFontSize;

    if (tpl.showGruppe && gruppeName) {
      doc.fillColor('#111111').fontSize(7).font('Helvetica')
        .text('Gruppe', midX, midY, { width: midW });
      midY += 12;
      doc.fillColor('#111111').fontSize(gfs).font('Helvetica-Bold')
        .text(gruppeName, midX, midY, { width: midW, lineBreak: false, ellipsis: true });
      midY += Math.round(gfs * 1.2);
      if (gruppeXY) {
        doc.fillColor('#111111').fontSize(gfs).font('Helvetica-Bold')
          .text(gruppeXY, midX, midY, { width: midW, lineBreak: false });
        midY += Math.round(gfs * 1.2);
      }
      midY += 6;
    }

    if (tpl.showPosition && posAbbr) {
      doc.fillColor('#111111').fontSize(7).font('Helvetica')
        .text('Standort', midX, midY, { width: midW });
      midY += 12;
      doc.fillColor('#111111').fontSize(gfs).font('Helvetica-Bold')
        .text(posAbbr, midX, midY, { width: midW, lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateEquipmentLabel, DEFAULT_TEMPLATE };
