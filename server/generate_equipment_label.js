'use strict';
/**
 * Element-based A6 landscape label generator (pdfkit + qrcode).
 * Each element has absolute x/y/w/h in PDF points (A6: 419.53 × 297.64 pt).
 */
const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const fs          = require('fs');

const W = 419.53;
const H = 297.64;
const M = 7;

// ── Default element layout (matches original hardcoded design) ────────────────

const DEFAULT_ELEMENTS = [
  { id: 'header_bg',   type: 'header_bg',   visible: true,  x: 0,   y: 0,   w: W,   h: 68,  fontSize: 0,   align: 'left',   color: '#111111', bgColor: '#111111' },
  { id: 'artist',      type: 'artist',      visible: true,  x: M,   y: 0,   w: 240, h: 68,  fontSize: 14,  align: 'left',   color: '#ffffff' },
  { id: 'tour_name',   type: 'tour_name',   visible: true,  x: 232, y: 0,   w: 180, h: 68,  fontSize: 18,  align: 'center', color: '#ffffff' },
  { id: 'case_id',     type: 'case_id',     visible: true,  x: M,   y: 80,  w: 405, h: 12,  fontSize: 8,   align: 'right',  color: '#111111' },
  { id: 'bezeichnung', type: 'bezeichnung', visible: true,  x: M,   y: 92,  w: 405, h: 35,  fontSize: 22,  align: 'left',   color: '#111111' },
  { id: 'separator',   type: 'separator',   visible: true,  x: M,   y: 131, w: 405, h: 1,   fontSize: 0,   align: 'left',   color: '#111111' },
  { id: 'load_order',  type: 'load_order',  visible: true,  x: M,   y: 136, w: 148, h: 154, fontSize: 108, align: 'left',   color: '#111111' },
  { id: 'gruppe',      type: 'gruppe',      visible: true,  x: 161, y: 136, w: 90,  h: 90,  fontSize: 30,  align: 'left',   color: '#111111' },
  { id: 'position',    type: 'position',    visible: true,  x: 161, y: 230, w: 90,  h: 60,  fontSize: 30,  align: 'left',   color: '#111111' },
  { id: 'qr_code',     type: 'qr_code',     visible: true,  x: 258, y: 136, w: 154, h: 154, fontSize: 0,   align: 'left',   color: '#111111' },
  { id: 'gewicht',     type: 'gewicht',     visible: false, x: M,   y: 265, w: 160, h: 20,  fontSize: 10,  align: 'left',   color: '#111111' },
  { id: 'typ',         type: 'typ',         visible: false, x: M,   y: 250, w: 160, h: 15,  fontSize: 10,  align: 'left',   color: '#111111' },
];

// ── Element renderer ──────────────────────────────────────────────────────────

const TYP_LABELS = {
  case: 'Case', dolly: 'Dolly', gitterbox: 'Gitterbox',
  kulisse: 'Kulisse', sonstiges: 'Sonstiges',
};

function renderElement(doc, el, data) {
  if (!el.visible) return;
  const { type, x, y, w, h, fontSize, align, color } = el;

  switch (type) {

    case 'header_bg':
      doc.rect(x, y, w, h).fill(el.bgColor || color);
      break;

    case 'separator':
      doc.moveTo(x, y).lineTo(x + w, y)
        .lineWidth(Math.max(h, 0.5)).stroke(color);
      break;

    case 'artist':
      if (!data.useArtistName && data.logoPath && fs.existsSync(data.logoPath)) {
        try {
          doc.image(data.logoPath, x + 2, y + 4, { fit: [w - 4, h - 8] });
        } catch {
          const ay = y + (h - fontSize) / 2;
          doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
            .text(data.artistName || '', x, ay, { width: w, lineBreak: false, ellipsis: true });
        }
      } else {
        const ay = y + (h - fontSize) / 2;
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
          .text(data.artistName || '', x, ay, { width: w, lineBreak: false, ellipsis: true });
      }
      break;

    case 'tour_name':
      if (data.tourName) {
        // <br> → actual newline
        const text    = data.tourName.replace(/<br\s*\/?>/gi, '\n');
        const nLines  = text.split('\n').length;
        const lineH   = fontSize * 1.25;
        const blockH  = nLines * lineH;
        const ty      = y + Math.max((h - blockH) / 2, 0);
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
          .text(text, x, ty, { width: w, align, lineBreak: true, ellipsis: false });
      }
      break;

    case 'case_id':
      doc.fillColor(color).fontSize(7).font('Helvetica')
        .text('INHALT:', x, y, { lineBreak: false });
      if (data.caseId) {
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
          .text(data.caseId, x, y, { width: w, align: 'right', lineBreak: false });
      }
      break;

    case 'bezeichnung':
      if (data.bezeichnung) {
        const max = fontSize;
        const fs2 = data.bezeichnung.length > 28 ? Math.round(max * 0.77)
          : data.bezeichnung.length > 20 ? Math.round(max * 0.86)
          : max;
        doc.fillColor(color).fontSize(fs2).font('Helvetica-Bold')
          .text(data.bezeichnung, x, y, { width: w, lineBreak: false, ellipsis: true });
      }
      break;

    case 'load_order': {
      // Number always bottom-anchored within its box
      const loadStr = data.loadOrder != null ? String(data.loadOrder).padStart(2, '0') : '—';
      const numH    = fontSize * 1.2;
      const numY    = Math.max(y + h - numH, y + 12);
      doc.fillColor(color).fontSize(7).font('Helvetica')
        .text('Ladereihenfolge', x, y, { width: w });
      doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
        .text(loadStr, x, numY, { width: w, lineBreak: false, align: 'left' });
      break;
    }

    case 'gruppe':
      if (data.gruppeName) {
        let gy = y;
        doc.fillColor(color).fontSize(7).font('Helvetica')
          .text('Gruppe', x, gy, { width: w });
        gy += 12;
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
          .text(data.gruppeName, x, gy, { width: w, lineBreak: false, ellipsis: true });
        gy += Math.round(fontSize * 1.2);
        if (data.gruppeXY) {
          doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
            .text(data.gruppeXY, x, gy, { width: w, lineBreak: false });
        }
      }
      break;

    case 'position':
      if (data.posAbbr) {
        let py = y;
        doc.fillColor(color).fontSize(7).font('Helvetica')
          .text('Standort', x, py, { width: w });
        py += 12;
        doc.fillColor(color).fontSize(fontSize).font('Helvetica-Bold')
          .text(data.posAbbr, x, py, { width: w, lineBreak: false });
      }
      break;

    case 'qr_code': {
      const s = Math.min(w, h);
      if (data.qrBuffer) {
        doc.image(data.qrBuffer, x, y, { width: s, height: s });
      } else {
        doc.rect(x, y, s, s).stroke(color);
        doc.fillColor(color).fontSize(8).font('Helvetica')
          .text(data.caseId || '', x, y + s / 2 - 4, { width: s, align: 'center' });
      }
      break;
    }

    case 'gewicht':
      if (data.gesamtgewicht) {
        doc.fillColor(color).fontSize(fontSize).font('Helvetica')
          .text(`Gewicht: ${data.gesamtgewicht} kg`, x, y, { width: w, lineBreak: false });
      }
      break;

    case 'typ':
      if (data.typ) {
        doc.fillColor(color).fontSize(fontSize).font('Helvetica')
          .text(TYP_LABELS[data.typ] || data.typ, x, y, { width: w, lineBreak: false });
      }
      break;
  }
}

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

  // Merge saved element overrides onto defaults
  const savedElements = template.elements || null;
  const elements = savedElements && savedElements.length
    ? savedElements
    : DEFAULT_ELEMENTS;

  // QR code buffer (only if qr_code element is visible)
  const needsQR = elements.some(el => el.type === 'qr_code' && el.visible);
  let qrBuffer = null;
  if (needsQR) {
    try {
      qrBuffer = await QRCode.toBuffer(caseId || 'N/A', {
        type: 'png', width: 160, margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR generation failed:', e.message);
    }
  }

  // Position abbreviation
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

  const data = {
    artistName, logoPath, useArtistName, tourName,
    caseId, bezeichnung, loadOrder, posAbbr,
    gruppeName, gruppeXY, gesamtgewicht, typ,
    qrBuffer,
  };

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

    // Clip everything to page bounds – overflow gets cut, never a 2nd page
    doc.save();
    doc.rect(0, 0, W, H).clip();

    let ended = false;
    doc.on('pageAdded', () => {
      if (!ended) {
        ended = true;
        console.warn('Label: content overflowed – truncated to 1 page');
        doc.end();
      }
    });

    // Render elements in order (painter's algorithm)
    for (const el of elements) {
      if (ended) break;
      renderElement(doc, el, data);
    }

    if (!ended) {
      ended = true;
      doc.end();
    }
  });
}

module.exports = { generateEquipmentLabel, DEFAULT_ELEMENTS };
