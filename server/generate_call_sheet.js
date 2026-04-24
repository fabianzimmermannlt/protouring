'use strict';
/**
 * Call Sheet PDF – Crew-Perspektive.
 * Fokus: Wer fährt wann wohin, wo schlafen wir, Zeitplan, Catering.
 * Im Gegensatz zum Advance Sheet (Venue-Perspektive) ist das für die Crew gedacht.
 *
 * Usage: generateCallSheetPdf({ termin, sections, data }) → Promise<Buffer>
 */

const PDFDocument = require('pdfkit');

const MARGIN_H  = 50;
const MARGIN_V  = 48;
const PAGE_W    = 595;
const PAGE_H    = 842;
const CONTENT_W = PAGE_W - MARGIN_H * 2;

const FONT_REG  = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

const C_DARK   = '#111827';
const C_MID    = '#374151';
const C_MUTED  = '#6b7280';
const C_LIGHT  = '#9ca3af';
const C_RULE   = '#d1d5db';
const C_ACCENT = '#1e40af';   // dunkleres Blau als Advance Sheet
const C_CREW   = '#065f46';   // Grün für Crew-Kontext

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function fmtDateShort(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

function fmtTime(t) {
  if (!t) return '';
  return t.length > 5 ? t.slice(0, 5) : t;
}

function generateCallSheetPdf({ termin, sections, data }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN_V, autoFirstPage: true });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const footerText = `ProTouring  ·  ${new Date().toLocaleDateString('de-DE')}`;
    const addFooter = () => {
      doc.font(FONT_REG).fontSize(7).fillColor(C_LIGHT)
        .text(footerText, MARGIN_H, PAGE_H - MARGIN_V - 2, { width: CONTENT_W, align: 'center', lineBreak: false });
    };
    doc.on('pageAdded', addFooter);

    let y = MARGIN_V;

    // ── Helpers ───────────────────────────────────────────────────────────────

    function ensureSpace(needed) {
      if (y + needed > PAGE_H - MARGIN_V) {
        doc.addPage();
        y = MARGIN_V;
        drawPageHeader();
      }
    }

    function rule(color = C_RULE, thickness = 0.5) {
      doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
        .strokeColor(color).lineWidth(thickness).stroke();
    }

    function sectionHeader(title, icon = '') {
      ensureSpace(30);
      y += 10;
      doc.rect(MARGIN_H, y, CONTENT_W, 22).fillColor(C_ACCENT).fill();
      doc.font(FONT_BOLD).fontSize(9).fillColor('#ffffff')
        .text(`${icon}  ${title}`.trim(), MARGIN_H + 8, y + 6, { width: CONTENT_W - 16 });
      y += 22 + 6;
    }

    function kv(label, value, opts = {}) {
      if (!value) return;
      ensureSpace(14);
      const labelW = opts.labelW || 130;
      doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_MUTED)
        .text(label, MARGIN_H, y, { width: labelW, continued: false });
      doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
        .text(String(value), MARGIN_H + labelW, y, { width: CONTENT_W - labelW });
      y = doc.y + 2;
    }

    function bodyText(text, indent = 0) {
      if (!text?.trim()) return;
      ensureSpace(12);
      doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
        .text(text, MARGIN_H + indent, y, { width: CONTENT_W - indent });
      y = doc.y + 3;
    }

    // ── Page header (repeated on new pages) ─────────────────────────────────
    function drawPageHeader() {
      doc.font(FONT_BOLD).fontSize(7).fillColor(C_LIGHT)
        .text(`CALL SHEET  ·  ${termin.title || termin.city || ''}  ·  ${fmtDateShort(termin.date)}`,
          MARGIN_H, MARGIN_V - 16, { width: CONTENT_W, align: 'right' });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TITLE BLOCK
    // ══════════════════════════════════════════════════════════════════════════

    // Green top bar
    doc.rect(MARGIN_H, y, CONTENT_W, 5).fillColor(C_CREW).fill();
    y += 10;

    doc.font(FONT_BOLD).fontSize(8).fillColor(C_CREW)
      .text('CALL SHEET', MARGIN_H, y, { width: CONTENT_W, align: 'center' });
    y += 14;

    // Show title
    const mainTitle = termin.title || termin.city || 'Termin';
    doc.font(FONT_BOLD).fontSize(22).fillColor(C_DARK)
      .text(mainTitle, MARGIN_H, y, { width: CONTENT_W, align: 'center' });
    y = doc.y + 4;

    // Date
    doc.font(FONT_REG).fontSize(11).fillColor(C_MID)
      .text(fmtDate(termin.date), MARGIN_H, y, { width: CONTENT_W, align: 'center' });
    y = doc.y + 4;

    // Venue + City
    const location = [termin.venue_name, termin.city].filter(Boolean).join('  ·  ');
    if (location) {
      doc.font(FONT_REG).fontSize(10).fillColor(C_MUTED)
        .text(location, MARGIN_H, y, { width: CONTENT_W, align: 'center' });
      y = doc.y + 4;
    }

    // Art / Status
    const meta = [termin.art, termin.art_sub, termin.status_booking].filter(Boolean).join('  ·  ');
    if (meta) {
      doc.font(FONT_REG).fontSize(8).fillColor(C_LIGHT)
        .text(meta, MARGIN_H, y, { width: CONTENT_W, align: 'center' });
      y = doc.y + 4;
    }

    y += 4;
    doc.rect(MARGIN_H, y, CONTENT_W, 2).fillColor(C_CREW).fill();
    y += 14;

    // ══════════════════════════════════════════════════════════════════════════
    // REISEGRUPPE
    // ══════════════════════════════════════════════════════════════════════════
    if (sections.includes('travelparty') && data.travelParty?.length) {
      sectionHeader('REISEGRUPPE');
      const party = data.travelParty;
      const colW = Math.floor(CONTENT_W / 2) - 4;

      for (let i = 0; i < party.length; i += 2) {
        ensureSpace(16);
        const left  = party[i];
        const right = party[i + 1];

        const name1 = `${left.first_name} ${left.last_name}`.trim();
        const fn1   = [left.function1, left.function2, left.function3].filter(Boolean).join(', ');
        const name2 = right ? `${right.first_name} ${right.last_name}`.trim() : '';
        const fn2   = right ? [right.function1, right.function2, right.function3].filter(Boolean).join(', ') : '';

        doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK)
          .text(name1, MARGIN_H, y, { width: colW, continued: false });
        if (name2) {
          doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK)
            .text(name2, MARGIN_H + colW + 8, y, { width: colW });
        }
        const lineY = doc.y;

        if (fn1) {
          doc.font(FONT_REG).fontSize(7.5).fillColor(C_MUTED)
            .text(fn1, MARGIN_H, lineY, { width: colW });
        }
        if (fn2) {
          doc.font(FONT_REG).fontSize(7.5).fillColor(C_MUTED)
            .text(fn2, MARGIN_H + colW + 8, lineY, { width: colW });
        }
        y = doc.y + 4;

        if (i + 2 < party.length) {
          rule(C_RULE, 0.3);
          y += 3;
        }
      }
      y += 4;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ZEITPLÄNE — identisches Rendering wie Advance Sheet
    // ══════════════════════════════════════════════════════════════════════════
    function normalizeScheduleLines(content) {
      return (content || '')
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n')
        .replace(/<div>/gi, '').replace(/<p>/gi, '').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n').split('\n')
    }

    if (sections.includes('schedules') && data.schedules?.length) {
      for (const sched of data.schedules) {
        sectionHeader((sched.title || 'Zeitplan').toUpperCase());
        const lines = normalizeScheduleLines(sched.content);

        // Spaltenbreiten messen
        let maxLeftW = 0, maxRightW = 0;
        doc.font(FONT_BOLD).fontSize(8.5);
        for (const line of lines) {
          if (line.includes('-//-')) {
            const sep = line.indexOf('-//-');
            const lw = doc.widthOfString(line.slice(0, sep).trim());
            if (lw > maxLeftW) maxLeftW = lw;
          }
        }
        doc.font(FONT_REG).fontSize(8.5);
        for (const line of lines) {
          if (line.includes('-//-')) {
            const sep = line.indexOf('-//-');
            const rw = doc.widthOfString(line.slice(sep + 4).trim());
            if (rw > maxRightW) maxRightW = rw;
          }
        }
        const tabX = MARGIN_H + (maxLeftW > 0 ? maxLeftW + 22 : 40);
        const rightColEnd = tabX + (maxRightW > 0 ? maxRightW : 120);

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { y += 4; continue; }
          if (trimmed === '---') {
            ensureSpace(10);
            doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
              .lineWidth(0.5).strokeColor(C_MUTED).stroke();
            y += 6; continue;
          }
          if (line.includes('-//-')) {
            ensureSpace(18);
            const sepIdx = line.indexOf('-//-');
            const leftText  = line.slice(0, sepIdx).trim();
            const rightText = line.slice(sepIdx + 4).trim();
            const lineY = y;
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_MID)
              .text(leftText, MARGIN_H, lineY, { lineBreak: false });
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK);
            const rw = doc.widthOfString(rightText);
            doc.text(rightText, rightColEnd - rw, lineY, { lineBreak: false });
            y = lineY + 18; continue;
          }
          ensureSpace(18);
          doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
            .text(trimmed, MARGIN_H, y, { width: CONTENT_W });
          y += doc.heightOfString(trimmed, { width: CONTENT_W, fontSize: 8.5 }) + 7;
        }
        y += 8;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ANREISE / ABREISE
    // ══════════════════════════════════════════════════════════════════════════
    if (sections.includes('travel') && data.legs?.length) {
      const anreise = data.legs.filter(l => l.leg_type === 'arrival');
      const abreise = data.legs.filter(l => l.leg_type === 'departure');

      for (const group of [{ label: 'ANREISE', legs: anreise }, { label: 'ABREISE', legs: abreise }]) {
        if (!group.legs.length) continue;
        sectionHeader(group.label);

        for (const leg of group.legs) {
          ensureSpace(18);
          const vehicle = leg.vehicle_designation
            ? `${leg.transport_type || ''} · ${leg.vehicle_designation}${leg.vehicle_license_plate ? ` (${leg.vehicle_license_plate})` : ''}`
            : leg.transport_type || '';
          const route   = [leg.from_location, leg.to_location].filter(Boolean).join(' → ');
          const timing  = [
            leg.departure_time ? `Abfahrt ${fmtTime(leg.departure_time)}` : '',
            leg.arrival_time   ? `Ankunft ${fmtTime(leg.arrival_time)}`   : '',
          ].filter(Boolean).join('  ·  ');

          if (route) {
            doc.font(FONT_BOLD).fontSize(9).fillColor(C_DARK).text(route, MARGIN_H, y, { width: CONTENT_W });
            y = doc.y + 1;
          }
          if (timing) {
            doc.font(FONT_REG).fontSize(8).fillColor(C_MUTED).text(timing, MARGIN_H, y, { width: CONTENT_W });
            y = doc.y + 1;
          }
          if (vehicle) {
            doc.font(FONT_REG).fontSize(8).fillColor(C_MUTED).text(vehicle, MARGIN_H, y, { width: CONTENT_W });
            y = doc.y + 1;
          }
          if (leg.persons?.length) {
            const names = leg.persons.map(p => `${p.first_name} ${p.last_name}`).join(', ');
            doc.font(FONT_REG).fontSize(7.5).fillColor(C_LIGHT).text(names, MARGIN_H, y, { width: CONTENT_W });
            y = doc.y + 1;
          }
          y += 6;
          rule(); y += 4;
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HOTEL
    // ══════════════════════════════════════════════════════════════════════════
    if (sections.includes('hotel') && data.hotelStays?.length) {
      sectionHeader('HOTEL');
      for (const stay of data.hotelStays) {
        ensureSpace(20);
        doc.font(FONT_BOLD).fontSize(9.5).fillColor(C_DARK)
          .text(stay.hotel_name || 'Hotel', MARGIN_H, y, { width: CONTENT_W });
        y = doc.y + 1;

        const addr = [stay.hotel_street, [stay.hotel_postal_code, stay.hotel_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        if (addr) { doc.font(FONT_REG).fontSize(8).fillColor(C_MUTED).text(addr, MARGIN_H, y); y = doc.y + 1; }
        if (stay.hotel_phone) { doc.font(FONT_REG).fontSize(8).fillColor(C_MUTED).text(`Tel: ${stay.hotel_phone}`, MARGIN_H, y); y = doc.y + 1; }

        const checkIn  = stay.check_in_date  ? `Check-in: ${fmtDateShort(stay.check_in_date)}` : '';
        const checkOut = stay.check_out_date ? `Check-out: ${fmtDateShort(stay.check_out_date)}` : '';
        const times = [checkIn, checkOut].filter(Boolean).join('  ·  ');
        if (times) { doc.font(FONT_REG).fontSize(8).fillColor(C_MID).text(times, MARGIN_H, y); y = doc.y + 1; }

        // Zimmer
        if (stay.rooms?.length) {
          y += 3;
          for (const room of stay.rooms) {
            ensureSpace(14);
            const persons = room.persons?.map(p => `${p.first_name} ${p.last_name}`).join(', ') || '';
            const roomLabel = [room.room_type, room.room_label].filter(Boolean).join(' · ');
            doc.font(FONT_REG).fontSize(8).fillColor(C_MID)
              .text(`  ${roomLabel || 'Zimmer'}${persons ? ':  ' + persons : ''}`, MARGIN_H, y, { width: CONTENT_W });
            y = doc.y + 2;
          }
        }
        y += 4; rule(); y += 4;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CATERING
    // ══════════════════════════════════════════════════════════════════════════
    if (sections.includes('catering') && data.catering) {
      sectionHeader('CATERING');
      const c = data.catering;
      const typeMap = { 'none': 'Kein Catering', 'catering': 'Catering', 'buyout': 'Buyout', 'order': 'Auf Bestellung' };
      kv('Art', typeMap[c.type] || c.type);
      if (c.type === 'buyout' && c.buyout_amount) kv('Buyout', `€ ${parseFloat(c.buyout_amount).toFixed(2)}`);
      if (c.contact_name) kv('Kontakt', c.contact_name);
      if (c.contact_phone) kv('Telefon', c.contact_phone);
      if (c.notes) bodyText(stripHtml(c.notes), 0);

      if (data.cateringOrders?.length) {
        y += 4;
        doc.font(FONT_BOLD).fontSize(8).fillColor(C_MUTED).text('BESTELLUNGEN', MARGIN_H, y); y = doc.y + 3;
        for (const order of data.cateringOrders) {
          ensureSpace(12);
          const label = order.contact_name ? `${order.contact_name}: ` : '';
          doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
            .text(`${label}${order.order_text}`, MARGIN_H + 8, y, { width: CONTENT_W - 8 });
          y = doc.y + 2;
        }
      }
      y += 4;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LOKALE KONTAKTE
    // ══════════════════════════════════════════════════════════════════════════
    if (sections.includes('contacts') && data.localContacts?.length) {
      sectionHeader('LOKALE KONTAKTE');
      for (const lc of data.localContacts) {
        ensureSpace(14);
        const name = [lc.first_name, lc.last_name].filter(Boolean).join(' ');
        doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK).text(name || lc.role || '', MARGIN_H, y, { width: CONTENT_W / 2 });
        if (lc.phone) doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(lc.phone, MARGIN_H + CONTENT_W / 2, y, { width: CONTENT_W / 2 });
        y = doc.y + 1;
        if (lc.role) { doc.font(FONT_REG).fontSize(7.5).fillColor(C_MUTED).text(lc.role, MARGIN_H, y); y = doc.y + 2; }
        rule(C_RULE, 0.3); y += 3;
      }
      y += 4;
    }

    // Footer auf erster Seite (pageAdded feuert nur bei addPage, nicht bei Seite 1)
    addFooter();

    doc.end();
  });
}

module.exports = { generateCallSheetPdf };
