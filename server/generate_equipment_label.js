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
const M = 14; // margin

const HEADER_H  = 68;
const CONTENT_Y = HEADER_H + 10;   // 78
const LOWER_Y   = CONTENT_Y + 58;  // 136 — start of lower section

async function generateEquipmentLabel(opts) {
  const {
    artistName    = '',
    logoPath      = null,
    useArtistName = true,
    tourName      = '',
    caseId        = '',
    bezeichnung   = '',
    loadOrder     = null,
    position      = null,
    positionCustom = null,
    gruppeName    = null,   // z.B. "DRU" oder "PA-Cases"
    gruppeXY      = null,   // z.B. "1/3"
    gesamtgewicht = null,
  } = opts;

  // QR code als PNG-Buffer (enkodiert Case-ID)
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(caseId || 'N/A', {
      type: 'png', width: 160, margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.warn('QR generation failed:', e.message);
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
  if (position && position !== 'sonstiges') {
    posAbbr = POSITION_ABBR[position] ?? position.toUpperCase().slice(0, 5);
  } else if (position === 'sonstiges' && positionCustom) {
    posAbbr = positionCustom.toUpperCase().slice(0, 6);
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

    const headerTextY = (HEADER_H - 18) / 2;

    // Header links: Logo oder Artist-Name
    if (!useArtistName && logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, M, 6, { height: HEADER_H - 12, fit: [160, HEADER_H - 12] });
      } catch {
        doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
          .text(artistName || '', M, headerTextY, { width: 210, lineBreak: false, ellipsis: true });
      }
    } else {
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
        .text(artistName || '', M, headerTextY, { width: 200, lineBreak: false, ellipsis: true });
    }

    // Header rechts: Tour-Name
    if (tourName) {
      doc.fillColor('#cccccc').fontSize(11).font('Helvetica')
        .text(tourName, W - M - 180, headerTextY + 1,
          { width: 180, align: 'right', lineBreak: false, ellipsis: true });
    }

    // ── INHALT-SECTION ─────────────────────────────────────────────────────
    const contentW = W - M * 2;

    doc.fillColor('#888888').fontSize(7).font('Helvetica')
      .text('INHALT:', M, CONTENT_Y + 2);

    doc.fillColor('#444444').fontSize(8).font('Helvetica-Bold')
      .text(caseId, M, CONTENT_Y + 2, { width: contentW, align: 'right' });

    const bezSize = bezeichnung.length > 28 ? 17 : bezeichnung.length > 20 ? 19 : 22;
    doc.fillColor('#111111').fontSize(bezSize).font('Helvetica-Bold')
      .text(bezeichnung, M, CONTENT_Y + 14, { width: contentW, lineBreak: false, ellipsis: true });

    // ── TRENNLINIE ──────────────────────────────────────────────────────────
    doc.moveTo(M, LOWER_Y - 5).lineTo(W - M, LOWER_Y - 5)
      .lineWidth(0.5).stroke('#dddddd');

    // ── SPALTEN-LAYOUT ──────────────────────────────────────────────────────
    // QR-Code: rechts, quadratisch bis Unterrand
    const qrSize = H - LOWER_Y - M;          // verfügbare Höhe
    const qrX    = W - M - qrSize;           // x-Start QR

    if (qrBuffer) {
      doc.image(qrBuffer, qrX, LOWER_Y, { width: qrSize, height: qrSize });
    } else {
      doc.rect(qrX, LOWER_Y, qrSize, qrSize).stroke('#aaaaaa');
      doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica')
        .text(caseId, qrX, LOWER_Y + qrSize / 2 - 4, { width: qrSize, align: 'center' });
    }

    // Linke Spalte: Ladereihenfolge-Label + riesige Zahl
    const leftColW = 148;
    const loadStr  = loadOrder != null ? String(loadOrder).padStart(2, '0') : '—';

    // "Ladereihenfolge" Überschrift
    doc.fillColor('#888888').fontSize(7).font('Helvetica')
      .text('Ladereihenfolge', M, LOWER_Y, { width: leftColW });

    // Zahl — riesig, kein Umbruch
    doc.fillColor('#111111').fontSize(96).font('Helvetica-Bold')
      .text(loadStr, M, LOWER_Y + 10, { width: leftColW, lineBreak: false, align: 'left' });

    // Mittlere Spalte: Gruppe + Standort
    const midX = M + leftColW + 6;
    const midW = qrX - midX - 8;
    let   midY = LOWER_Y;

    if (gruppeName) {
      // Überschrift "Gruppe"
      doc.fillColor('#888888').fontSize(7).font('Helvetica')
        .text('Gruppe', midX, midY, { width: midW });
      midY += 12;

      // gruppe_name (z.B. "DRU") — groß
      doc.fillColor('#111111').fontSize(30).font('Helvetica-Bold')
        .text(gruppeName, midX, midY, { width: midW, lineBreak: false, ellipsis: true });
      midY += 36;

      // x/y (z.B. "1/3") — gleich groß wie gruppe_name
      if (gruppeXY) {
        doc.fillColor('#111111').fontSize(30).font('Helvetica-Bold')
          .text(gruppeXY, midX, midY, { width: midW, lineBreak: false });
        midY += 36;
      }
      midY += 6; // Abstand vor Standort
    }

    if (posAbbr) {
      // Überschrift "Standort"
      doc.fillColor('#888888').fontSize(7).font('Helvetica')
        .text('Standort', midX, midY, { width: midW });
      midY += 12;

      // Position (z.B. "FOH") — groß
      doc.fillColor('#111111').fontSize(30).font('Helvetica-Bold')
        .text(posAbbr, midX, midY, { width: midW, lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { generateEquipmentLabel };
