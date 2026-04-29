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
 *  ├──────────────────────┬──────────────────────┬───────────────────┤
 *  │  003 (huge)          │  Gruppe: PA-Cases 1/3│  [QR CODE]        │
 *  │  FOH (position)      │  14,5 kg             │                   │
 *  └──────────────────────┴──────────────────────┴───────────────────┘
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// A6 landscape: width=419.53, height=297.64
const W = 419.53;
const H = 297.64;
const M = 14; // margin

const HEADER_H = 44;
const CONTENT_Y = HEADER_H + 10;
const LOWER_Y = CONTENT_Y + 70;

/**
 * @param {object} opts
 * @param {string} opts.artistName        - Display name or logo fallback
 * @param {string|null} opts.logoPath     - Absolute path to logo image (PNG/JPEG)
 * @param {boolean} opts.useArtistName    - If false, use logo; if true, use artist name text
 * @param {string} opts.tourName          - Tour name for header right
 * @param {string} opts.caseId            - e.g. "BTD-D1"
 * @param {string} opts.bezeichnung       - Case description
 * @param {number|null} opts.loadOrder    - Load order number
 * @param {string|null} opts.position     - Position key (e.g. "foh", "sl")
 * @param {string|null} opts.positionCustom - Custom position text
 * @param {string|null} opts.gruppeInfo   - e.g. "PA-Cases 1/3"
 * @param {number|null} opts.gesamtgewicht - Total weight in kg
 * @returns {Promise<Buffer>}
 */
async function generateEquipmentLabel(opts) {
  const {
    artistName = '',
    logoPath = null,
    useArtistName = true,
    tourName = '',
    caseId = '',
    bezeichnung = '',
    loadOrder = null,
    position = null,
    positionCustom = null,
    gruppeInfo = null,
    gesamtgewicht = null,
  } = opts;

  // Generate QR code as PNG buffer (encodes Case-ID)
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(caseId || 'N/A', {
      type: 'png',
      width: 140,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.warn('QR generation failed:', e.message);
  }

  // Position abbreviation: uppercase short form
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
  if (position && position !== 'sonstiges') {
    posAbbr = POSITION_ABBR[position] ?? position.toUpperCase().slice(0, 5);
  } else if (position === 'sonstiges' && positionCustom) {
    posAbbr = positionCustom.toUpperCase().slice(0, 5);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [W, H],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
    });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── HEADER (black background) ─────────────────────────────────────────
    doc.rect(0, 0, W, HEADER_H).fill('#111111');

    // Header left: logo or artist name
    const headerTextY = (HEADER_H - 14) / 2; // vertically center 14pt text
    if (!useArtistName && logoPath && fs.existsSync(logoPath)) {
      try {
        const maxLogoH = HEADER_H - 12;
        doc.image(logoPath, M, 6, { height: maxLogoH, fit: [160, maxLogoH] });
      } catch {
        // fallback to text
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
          .text(artistName || '', M, headerTextY, { width: 200, lineBreak: false, ellipsis: true });
      }
    } else {
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
        .text(artistName || '', M, headerTextY, { width: 200, lineBreak: false, ellipsis: true });
    }

    // Header right: tour name
    if (tourName) {
      doc.fillColor('#cccccc').fontSize(11).font('Helvetica')
        .text(tourName, W - M - 180, headerTextY + 1, { width: 180, align: 'right', lineBreak: false, ellipsis: true });
    }

    // ── CONTENT SECTION ────────────────────────────────────────────────────
    const contentAreaW = W - M * 2;

    // "INHALT:" label (small gray)
    doc.fillColor('#888888').fontSize(7).font('Helvetica')
      .text('INHALT:', M, CONTENT_Y + 2);

    // Case-ID top right
    doc.fillColor('#444444').fontSize(8).font('Helvetica-Bold')
      .text(caseId, M, CONTENT_Y + 2, { width: contentAreaW, align: 'right' });

    // Bezeichnung (large bold)
    const bezFontSize = bezeichnung.length > 25 ? 18 : bezeichnung.length > 18 ? 20 : 22;
    doc.fillColor('#111111').fontSize(bezFontSize).font('Helvetica-Bold')
      .text(bezeichnung, M, CONTENT_Y + 16, { width: contentAreaW - 10, lineBreak: false, ellipsis: true });

    // ── LOWER SECTION ─────────────────────────────────────────────────────
    // Divider line
    doc.moveTo(M, LOWER_Y - 6).lineTo(W - M, LOWER_Y - 6).lineWidth(0.5).stroke('#dddddd');

    // QR code (right column)
    const qrSize = H - LOWER_Y - M;
    const qrX = W - M - qrSize;
    if (qrBuffer) {
      doc.image(qrBuffer, qrX, LOWER_Y, { width: qrSize, height: qrSize });
    } else {
      // Placeholder box
      doc.rect(qrX, LOWER_Y, qrSize, qrSize).stroke('#aaaaaa');
      doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica')
        .text(caseId, qrX, LOWER_Y + qrSize / 2 - 4, { width: qrSize, align: 'center' });
    }

    // Middle column: Gruppe + Gewicht
    const midX = M + 100; // after load_order column
    const midW = qrX - midX - 10;

    if (gruppeInfo) {
      doc.fillColor('#555555').fontSize(7.5).font('Helvetica')
        .text('Gruppe', midX, LOWER_Y + 2);
      doc.fillColor('#111111').fontSize(13).font('Helvetica-Bold')
        .text(gruppeInfo, midX, LOWER_Y + 14, { width: midW, lineBreak: false, ellipsis: true });
    }

    if (gesamtgewicht != null && gesamtgewicht > 0) {
      const gewY = gruppeInfo ? LOWER_Y + 40 : LOWER_Y + 14;
      doc.fillColor('#555555').fontSize(7.5).font('Helvetica')
        .text('Gesamtgewicht', midX, gewY);
      doc.fillColor('#111111').fontSize(13).font('Helvetica-Bold')
        .text(`${Number(gesamtgewicht).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`, midX, gewY + 12);
    }

    // Left column: Load order (HUGE) + Position
    const loadOrderStr = loadOrder != null ? String(loadOrder).padStart(3, '0') : '—';
    const loadOrderFontSize = loadOrderStr.length > 3 ? 48 : 64;

    doc.fillColor('#111111').fontSize(loadOrderFontSize).font('Helvetica-Bold')
      .text(loadOrderStr, M, LOWER_Y - 4, { width: 95, align: 'left', lineBreak: false });

    if (posAbbr) {
      doc.fillColor('#555555').fontSize(16).font('Helvetica-Bold')
        .text(posAbbr, M, H - M - 20, { width: 95, align: 'left' });
    }

    doc.end();
  });
}

module.exports = { generateEquipmentLabel };
