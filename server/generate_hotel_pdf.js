'use strict';
/**
 * Generates a hotel room assignment PDF using pdfkit.
 * Usage: generateHotelPdf({ termin, stays }) → Promise<Buffer>
 */

const PDFDocument = require('pdfkit');

const MARGIN_H   = 56;
const MARGIN_V   = 51;
const PAGE_W     = 595;
const CONTENT_W  = PAGE_W - MARGIN_H * 2;

const FONT_REG   = 'Helvetica';
const FONT_BOLD  = 'Helvetica-Bold';

const ROOM_TYPE_LABELS = {
  einzelzimmer: 'Einzelzimmer',
  doppelzimmer: 'Doppelzimmer',
  twin:         'Twin Room',
  suite:        'Suite',
  duschzimmer:  'Duschzimmer',
  sonstiges:    'Sonstiges',
};

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function generateHotelPdf({ termin, stays }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN_V, bottom: MARGIN_V, left: MARGIN_H, right: MARGIN_H },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = MARGIN_V;
    const bottom = 842 - MARGIN_V;

    function ensureSpace(needed) {
      if (y + needed > bottom) {
        doc.addPage();
        y = MARGIN_V;
      }
    }

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.font(FONT_REG).fontSize(7).fillColor('#6b7280')
      .text('HOTELBELEGUNG', MARGIN_H, y, { lineBreak: false });
    y += 12;

    const terminLabel = [
      termin.date ? formatDate(termin.date) : '',
      termin.title || '',
      termin.city  || '',
    ].filter(Boolean).join('  ·  ');

    doc.font(FONT_BOLD).fontSize(18).fillColor('#111827')
      .text(terminLabel || 'Hotel', MARGIN_H, y, { width: CONTENT_W, lineBreak: false });
    y += 26;

    // Title rule
    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
      .lineWidth(1.5).strokeColor('#111827').stroke();
    y += 14;

    if (!stays || stays.length === 0) {
      doc.font(FONT_REG).fontSize(10).fillColor('#6b7280')
        .text('Keine Hotels erfasst.', MARGIN_H, y);
      doc.end();
      return;
    }

    // ── Stays ────────────────────────────────────────────────────────────────────
    for (const stay of stays) {
      ensureSpace(60);

      // Hotel name
      doc.font(FONT_BOLD).fontSize(12).fillColor('#111827')
        .text(stay.hotel_name || '– kein Hotel –', MARGIN_H, y, { width: CONTENT_W });
      y += 17;

      // City + address
      const addrParts = [
        stay.hotel_street,
        [stay.hotel_postal_code, stay.hotel_city].filter(Boolean).join(' '),
      ].filter(Boolean);
      if (addrParts.length) {
        doc.font(FONT_REG).fontSize(9).fillColor('#4b5563')
          .text(addrParts.join(', '), MARGIN_H, y, { width: CONTENT_W });
        y += 13;
      }

      // Contact
      const contactParts = [
        stay.hotel_phone   ? `Tel: ${stay.hotel_phone}`   : null,
        stay.hotel_email   ? `E-Mail: ${stay.hotel_email}` : null,
        stay.hotel_website ? stay.hotel_website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null,
      ].filter(Boolean);
      if (contactParts.length) {
        doc.font(FONT_REG).fontSize(9).fillColor('#4b5563')
          .text(contactParts.join('   '), MARGIN_H, y, { width: CONTENT_W });
        y += 13;
      }

      // Check-in / Check-out + Buchungscode
      const checkParts = [];
      if (stay.check_in_date && stay.check_out_date) {
        checkParts.push(`Check-in: ${formatDate(stay.check_in_date)}   Check-out: ${formatDate(stay.check_out_date)}`);
      } else if (stay.check_in_date) {
        checkParts.push(`Check-in: ${formatDate(stay.check_in_date)}`);
      }
      if (stay.booking_code) checkParts.push(`Buchungscode: ${stay.booking_code}`);
      if (checkParts.length) {
        doc.font(FONT_REG).fontSize(9).fillColor('#6b7280')
          .text(checkParts.join('   '), MARGIN_H, y, { width: CONTENT_W });
        y += 13;
      }

      y += 6;

      // ── Rooms ──
      if (stay.rooms && stay.rooms.length > 0) {
        // Section header
        doc.font(FONT_BOLD).fontSize(8).fillColor('#6b7280')
          .text('ZIMMERBELEGUNG', MARGIN_H, y, { lineBreak: false });
        y += 12;

        // Light separator
        doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
          .lineWidth(0.5).strokeColor('#e5e7eb').stroke();
        y += 6;

        // Spaltenbreiten: Zimmertyp 120px, Rest für Namen
        const COL1 = 120;
        const COL2_X = MARGIN_H + COL1;
        const COL2_W = CONTENT_W - COL1;
        const ROW_H = 18;
        const TEXT_PAD = 4; // vertikales Padding damit Text mittig zwischen den Linien sitzt

        for (const room of stay.rooms) {
          ensureSpace(ROW_H);

          const label = ROOM_TYPE_LABELS[room.room_type] || room.room_type || '–';
          const roomLabel = room.room_label ? ` · ${room.room_label}` : '';
          const persons = (room.persons || [])
            .map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim())
            .filter(Boolean)
            .join(', ');

          // Zimmertyp – linke Spalte
          doc.font(FONT_BOLD).fontSize(9).fillColor('#111827')
            .text(label + roomLabel, MARGIN_H, y + TEXT_PAD, { width: COL1, lineBreak: false });

          // Personen – rechte Spalte (linksbündig)
          doc.font(FONT_REG).fontSize(9).fillColor('#374151')
            .text(persons || '–', COL2_X, y + TEXT_PAD, { width: COL2_W, lineBreak: false });

          y += ROW_H;

          // Light row line
          doc.moveTo(MARGIN_H, y - 1).lineTo(MARGIN_H + CONTENT_W, y - 1)
            .lineWidth(0.3).strokeColor('#f3f4f6').stroke();
        }
      }

      y += 10;

      // Stay separator
      ensureSpace(4);
      doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
        .lineWidth(1).strokeColor('#d1d5db').stroke();
      y += 16;
    }

    doc.end();
  });
}

module.exports = { generateHotelPdf };
