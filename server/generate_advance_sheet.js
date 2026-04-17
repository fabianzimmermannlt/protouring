'use strict';
/**
 * Advance Sheet PDF – aggregiert alle Termin-Daten in einem Dokument.
 * Usage: generateAdvanceSheetPdf({ termin, sections, data }) → Promise<Buffer>
 *
 * sections: string[]  z.B. ['show','venue','partner','contacts','schedules','travel','hotel','travelparty','catering','todos']
 * data: { venue, partner, localContacts, schedules, legs, hotelStays, travelParty, catering, todos }
 */

const PDFDocument = require('pdfkit');

// ── Layout ───────────────────────────────────────────────────────────────────

const MARGIN_H  = 56;
const MARGIN_V  = 51;
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
const C_RULE_L = '#e5e7eb';
const C_ACCENT = '#1d4ed8'; // blue for section headers

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function formatDateLong(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return d; }
}

const TRANSPORT_LABELS = {
  vehicle: 'Fahrzeug', train: 'Bahn', flight: 'Flug', other: 'Sonstiges',
};
const CATERING_LABELS = {
  none: 'Kein Catering', buyout: 'Buyout', provided: 'Bereitgestellt', mixed: 'Gemischt', rider: 'Rider',
};
const ROOM_LABELS = {
  einzelzimmer: 'EZ', doppelzimmer: 'DZ', twin: 'Twin', suite: 'Suite', duschzimmer: 'DZ Dusche', sonstiges: 'Sonstiges',
};
const PRIORITY_LABELS = { low: 'niedrig', medium: 'mittel', high: 'hoch' };

// ── PDF builder ──────────────────────────────────────────────────────────────

function generateAdvanceSheetPdf({ termin, sections, data }) {
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
    const bottom = PAGE_H - MARGIN_V;

    function ensureSpace(needed) {
      if (y + needed > bottom) {
        doc.addPage();
        y = MARGIN_V;
      }
    }

    function sectionTitle(label) {
      ensureSpace(30);
      // Farbiger Balken links
      doc.rect(MARGIN_H, y, 3, 14).fill(C_ACCENT);
      doc.font(FONT_BOLD).fontSize(9).fillColor(C_ACCENT)
        .text(label.toUpperCase(), MARGIN_H + 8, y + 2, { lineBreak: false });
      y += 20;
      doc.moveTo(MARGIN_H, y - 4).lineTo(MARGIN_H + CONTENT_W, y - 4)
        .lineWidth(0.5).strokeColor(C_RULE_L).stroke();
    }

    function kv(label, value, opts = {}) {
      if (!value && value !== 0) return;
      const str = String(value);
      ensureSpace(16);
      const labelW = opts.labelW || 110;
      doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_MUTED)
        .text(label, MARGIN_H, y, { width: labelW, lineBreak: false });
      doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
        .text(str, MARGIN_H + labelW, y, { width: CONTENT_W - labelW });
      const textH = doc.heightOfString(str, { width: CONTENT_W - labelW, fontSize: 8.5 });
      y += Math.max(14, textH + 2);
    }

    function spacer(h = 10) { y += h; }

    // ── DOCUMENT HEADER ────────────────────────────────────────────────────────

    // Logo-Bereich / Dokument-Typ
    doc.font(FONT_REG).fontSize(7).fillColor(C_MUTED)
      .text('ADVANCE SHEET', MARGIN_H, y, { lineBreak: false });
    y += 12;

    // Datum eigene Zeile, dann Titel · Stadt
    if (termin.date) {
      doc.font(FONT_REG).fontSize(11).fillColor(C_MID)
        .text(formatDateLong(termin.date), MARGIN_H, y, { width: CONTENT_W });
      y += 16;
    }
    const terminLabel = [termin.title || '', termin.city || ''].filter(Boolean).join('  ·  ');
    doc.font(FONT_BOLD).fontSize(18).fillColor(C_DARK)
      .text(terminLabel || 'Termin', MARGIN_H, y, { width: CONTENT_W });
    y += 26;

    doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
      .lineWidth(1.5).strokeColor(C_DARK).stroke();
    y += 14;

    // Erstellungsdatum rechts
    const created = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.font(FONT_REG).fontSize(7).fillColor(C_LIGHT)
      .text(`Erstellt: ${created}`, MARGIN_H, y - 24, { width: CONTENT_W, align: 'right', lineBreak: false });

    const has = (s) => sections.includes(s);

    // ── SHOW (Veranstaltung) ───────────────────────────────────────────────────

    if (has('show')) {
      sectionTitle('Veranstaltung');
      kv('Datum',     termin.date ? formatDateLong(termin.date) : '');
      kv('Titel',     termin.title);
      kv('Art',       [termin.art, termin.art_sub].filter(Boolean).join(' · '));
      kv('Status',    termin.status_booking);
      kv('Öffentlich',termin.status_public);
      spacer(8);
    }

    // ── VENUE (Spielstätte) ────────────────────────────────────────────────────

    if (has('venue') && data.venue) {
      const v = data.venue;
      sectionTitle('Spielstätte');
      kv('Name',              v.name);
      kv('Adresse',           [v.street, [v.postal_code, v.city].filter(Boolean).join(' ')].filter(Boolean).join(', '));
      kv('Kapazität',         v.capacity ? `${v.capacity} (stehend)` + (v.capacity_seated ? ` / ${v.capacity_seated} (sitzend)` : '') : null);
      kv('Bühne',             v.stage_dimensions);
      kv('Freihöhe',          v.clearance_height);
      kv('Website',           v.website);
      kv('Anfahrt',           v.arrival ? stripHtml(v.arrival) : null);
      if (v.arrival_street || v.arrival_city) {
        kv('Lieferadresse',   [v.arrival_street, [v.arrival_postal_code, v.arrival_city].filter(Boolean).join(' ')].filter(Boolean).join(', '));
      }
      kv('Parken Nightliner', v.nightliner_parking);
      kv('WLAN',              v.wifi);
      kv('Catering',          v.catering);
      kv('Merch-Gebühr',      v.merchandise_fee);
      if (v.notes) kv('Bemerkung', stripHtml(v.notes));
      spacer(8);
    }

    // ── PARTNER ───────────────────────────────────────────────────────────────

    if (has('partner') && data.partner) {
      const p = data.partner;
      sectionTitle('Partner / Veranstalter');
      kv('Firma',             p.company_name);
      kv('Art',               p.type);
      kv('Adresse',           [p.street, [p.postal_code, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '));
      kv('Ansprechpartner',   p.contact_person);
      kv('Telefon',           p.phone);
      kv('E-Mail',            p.email);
      spacer(8);
    }

    // ── LOKALE KONTAKTE ───────────────────────────────────────────────────────

    if (has('contacts') && data.localContacts && data.localContacts.length > 0) {
      sectionTitle('Lokale Kontakte');
      for (const c of data.localContacts) {
        ensureSpace(20);
        const name = [c.first_name, c.name].filter(Boolean).join(' ');
        const line2Parts = [c.phone, c.email].filter(Boolean);
        doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK)
          .text([c.label, name].filter(Boolean).join(': '), MARGIN_H, y, { width: CONTENT_W });
        y += 13;
        if (line2Parts.length) {
          doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
            .text(line2Parts.join('   '), MARGIN_H, y, { width: CONTENT_W });
          y += 13;
        }
      }
      spacer(8);
    }

    // ── ZEITPLÄNE / TAGESABLAUF ───────────────────────────────────────────────

    // Normalisiert HTML zu plain-text-Zeilen (analog generate_schedule_pdf.js)
    function normalizeScheduleLines(html) {
      return (html || '')
        .replace(/<div><br\s*\/?>< \/div>/gi, '\n')
        .replace(/<p><br\s*\/?>< \/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<div>/gi, '').replace(/<p>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .split('\n');
    }

    if (has('schedules') && data.schedules && data.schedules.length > 0) {
      for (const sched of data.schedules) {
        sectionTitle((sched.not_final ? '⚠ NICHT FINAL – ' : '') + (sched.title || 'Zeitplan'));
        const lines = normalizeScheduleLines(sched.content);

        // Erster Pass: breiteste linke Seite bei -//- Zeilen messen
        let maxLeftW = 0;
        doc.font(FONT_REG).fontSize(8.5);
        for (const line of lines) {
          if (line.includes('-//-')) {
            const leftText = line.slice(0, line.indexOf('-//-')).trim();
            const w = doc.widthOfString(leftText);
            if (w > maxLeftW) maxLeftW = w;
          }
        }
        // Rechte Spalte startet: längster linker Text + kleiner Abstand
        const tabX = MARGIN_H + (maxLeftW > 0 ? maxLeftW + 8 : 40);
        const rightW = MARGIN_H + CONTENT_W - tabX;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { spacer(4); continue; }

          // Trennlinie ---
          if (trimmed === '---') {
            ensureSpace(10);
            doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
              .lineWidth(0.5).strokeColor(C_MUTED).stroke();
            spacer(6);
            continue;
          }

          // Zwei-Spalten-Zeile mit -//-
          // Linke Spalte RECHTSBÜNDIG zu tabX, rechte Spalte linksbündig ab tabX+4
          if (line.includes('-//-')) {
            ensureSpace(18);
            const sepIdx    = line.indexOf('-//-');
            const leftText  = line.slice(0, sepIdx).trim();
            const rightText = line.slice(sepIdx + 4).trim();
            const lineY = y;
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_MID)
              .text(leftText, MARGIN_H, lineY, { lineBreak: false });
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK);
            const rw = doc.widthOfString(rightText);
            doc.text(rightText, MARGIN_H + CONTENT_W - rw, lineY, { lineBreak: false });
            y = lineY + 18;
            continue;
          }

          // Normale Zeile
          ensureSpace(18);
          doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
            .text(trimmed, MARGIN_H, y, { width: CONTENT_W });
          y += doc.heightOfString(trimmed, { width: CONTENT_W, fontSize: 8.5 }) + 7;
        }
        spacer(8);
      }
    }

    // ── REISE (Anreise + Abreise) ─────────────────────────────────────────────

    if (has('travel') && data.legs && data.legs.length > 0) {
      const anreise = data.legs.filter(l => l.leg_type === 'arrival');
      const abreise = data.legs.filter(l => l.leg_type === 'departure');

      function renderLegs(label, legs) {
        if (!legs.length) return;
        sectionTitle(label);
        for (const leg of legs) {
          ensureSpace(30);
          const tt = TRANSPORT_LABELS[leg.transport_type] || leg.transport_type;
          const depLine = [
            leg.departure_date ? formatDate(leg.departure_date) : '',
            leg.departure_time || '',
            leg.from_location ? `ab ${leg.from_location}` : '',
          ].filter(Boolean).join('  ');
          const arrLine = [
            leg.arrival_date ? formatDate(leg.arrival_date) : '',
            leg.arrival_time || '',
            leg.to_location ? `an ${leg.to_location}` : '',
          ].filter(Boolean).join('  ');

          doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK).text(tt, MARGIN_H, y, { lineBreak: false });
          y += 13;

          if (leg.transport_type === 'vehicle' && leg.vehicle_designation) {
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
              .text(`Fahrzeug: ${leg.vehicle_designation}${leg.vehicle_license_plate ? ` (${leg.vehicle_license_plate})` : ''}`, MARGIN_H, y, { width: CONTENT_W });
            y += 12;
          }
          if (leg.transport_type === 'train') {
            const info = [leg.train_number, leg.train_from && leg.train_to ? `${leg.train_from} → ${leg.train_to}` : null, leg.train_platform ? `Gleis ${leg.train_platform}` : null, leg.train_booking_code ? `Code: ${leg.train_booking_code}` : null].filter(Boolean).join(' · ');
            if (info) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(info, MARGIN_H, y, { width: CONTENT_W }); y += 12; }
          }
          if (leg.transport_type === 'flight') {
            const info = [leg.flight_number, leg.flight_airport_from && leg.flight_airport_to ? `${leg.flight_airport_from} → ${leg.flight_airport_to}` : null, leg.flight_terminal ? `Terminal ${leg.flight_terminal}` : null, leg.flight_booking_code ? `Code: ${leg.flight_booking_code}` : null].filter(Boolean).join(' · ');
            if (info) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(info, MARGIN_H, y, { width: CONTENT_W }); y += 12; }
          }
          if (depLine) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(depLine, MARGIN_H, y, { width: CONTENT_W }); y += 12; }
          if (arrLine) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(arrLine, MARGIN_H, y, { width: CONTENT_W }); y += 12; }

          if (leg.persons && leg.persons.length > 0) {
            const names = leg.persons.map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean).join(', ');
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_MUTED).text(`Mitreisende: ${names}`, MARGIN_H, y, { width: CONTENT_W });
            y += 12;
          }
          if (leg.notes) {
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_MUTED).text(stripHtml(leg.notes), MARGIN_H, y, { width: CONTENT_W });
            y += 12;
          }
          spacer(6);
          doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.3).strokeColor(C_RULE_L).stroke();
          spacer(8);
        }
      }

      renderLegs('Anreise', anreise);
      renderLegs('Abreise', abreise);
    }

    // ── HOTEL ─────────────────────────────────────────────────────────────────

    if (has('hotel') && data.hotelStays && data.hotelStays.length > 0) {
      sectionTitle('Hotel');
      for (const stay of data.hotelStays) {
        ensureSpace(40);
        doc.font(FONT_BOLD).fontSize(10).fillColor(C_DARK)
          .text(stay.hotel_name || '– kein Hotel –', MARGIN_H, y, { width: CONTENT_W });
        y += 15;

        const addr = [stay.hotel_street, [stay.hotel_postal_code, stay.hotel_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        if (addr) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(addr, MARGIN_H, y, { width: CONTENT_W }); y += 12; }

        const contact = [stay.hotel_phone ? `Tel: ${stay.hotel_phone}` : null, stay.hotel_email ? `Mail: ${stay.hotel_email}` : null].filter(Boolean);
        if (contact.length) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(contact.join('   '), MARGIN_H, y, { width: CONTENT_W }); y += 12; }

        const checkInfo = [stay.check_in_date ? `Check-in: ${formatDate(stay.check_in_date)}` : null, stay.check_out_date ? `Check-out: ${formatDate(stay.check_out_date)}` : null, stay.booking_code ? `Code: ${stay.booking_code}` : null].filter(Boolean);
        if (checkInfo.length) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MUTED).text(checkInfo.join('   '), MARGIN_H, y, { width: CONTENT_W }); y += 12; }

        if (stay.rooms && stay.rooms.length > 0) {
          spacer(4);
          for (const room of stay.rooms) {
            ensureSpace(14);
            const label = ROOM_LABELS[room.room_type] || room.room_type || '–';
            const persons = (room.persons || []).map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean).join(', ');
            doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK).text(label + (room.room_label ? ` · ${room.room_label}` : ''), MARGIN_H, y, { width: 80, lineBreak: false });
            doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(persons || '–', MARGIN_H + 85, y, { width: CONTENT_W - 85, lineBreak: false });
            y += 13;
          }
        }

        if (stay.notes) { spacer(4); doc.font(FONT_REG).fontSize(8.5).fillColor(C_MUTED).text(stay.notes, MARGIN_H, y, { width: CONTENT_W }); y += 12; }
        spacer(8);
        doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y).lineWidth(0.5).strokeColor(C_RULE_L).stroke();
        spacer(10);
      }
    }

    // ── REISEGRUPPE ────────────────────────────────────────────────────────────

    if (has('travelparty') && data.travelParty && data.travelParty.length > 0) {
      sectionTitle('Reisegruppe');
      const COL = [MARGIN_H, MARGIN_H + 140, MARGIN_H + 260, MARGIN_H + 370];
      const COL_W = [130, 115, 105, CONTENT_W - 370];

      const ROW_H = 22;
      const PAD_T = 8; // Abstand Oberkante → Text: visuell zentriert (pdfkit-Textbox hat intern Freiraum oben)

      // Header-Zeile
      ensureSpace(14 + ROW_H);
      ['Name', 'Funktion 1', 'Funktion 2', 'Funktion 3'].forEach((h, i) => {
        doc.font(FONT_BOLD).fontSize(7).fillColor(C_MUTED)
          .text(h, COL[i], y, { width: COL_W[i], lineBreak: false });
      });
      y += 12;

      // Oberkante der ersten Datenzeile = Separator nach dem Header
      doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
        .lineWidth(0.5).strokeColor(C_RULE_L).stroke();

      // Jede Zeile: Oberkante ist y, Text bei y+PAD_T, Unterkante bei y+ROW_H
      for (const m of data.travelParty) {
        ensureSpace(ROW_H);
        const rowY = y; // explizit festhalten damit pdfkit-Cursor nichts verschiebt
        const name = [m.first_name, m.last_name].filter(Boolean).join(' ');
        doc.font(FONT_REG).fontSize(8.5).fillColor(C_DARK)
          .text(name || '–',   COL[0], rowY + PAD_T, { width: COL_W[0], lineBreak: false });
        doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
          .text(m.role1 || '', COL[1], rowY + PAD_T, { width: COL_W[1], lineBreak: false });
        doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID)
          .text(m.role2 || '', COL[2], rowY + PAD_T, { width: COL_W[2], lineBreak: false });
        doc.font(FONT_REG).fontSize(8.5).fillColor(C_MUTED)
          .text(m.role3 || '', COL[3], rowY + PAD_T, { width: COL_W[3], lineBreak: false });
        y = rowY + ROW_H; // immer exakt ROW_H weitergehen, unabhängig vom pdfkit-Cursor
        doc.moveTo(MARGIN_H, y).lineTo(MARGIN_H + CONTENT_W, y)
          .lineWidth(0.3).strokeColor('#f3f4f6').stroke();
      }
      spacer(10);
    }

    // ── CATERING ──────────────────────────────────────────────────────────────

    if (has('catering') && data.catering) {
      const c = data.catering;
      sectionTitle('Catering');
      kv('Art',       CATERING_LABELS[c.type] || c.type);
      if (c.type === 'buyout' && c.buyout_amount) kv('Buyout-Betrag', `€ ${parseFloat(c.buyout_amount).toFixed(2)}`);
      kv('Kontakt',   c.contact_name);
      kv('Telefon',   c.contact_phone);
      if (c.notes) kv('Bemerkung', c.notes);

      if (data.cateringOrders && data.cateringOrders.length > 0) {
        spacer(6);
        doc.font(FONT_BOLD).fontSize(8).fillColor(C_MUTED).text('BESTELLUNGEN', MARGIN_H, y); y += 12;
        for (const order of data.cateringOrders) {
          ensureSpace(14);
          const name = order.contact_name || '';
          const text = order.order_text || '';
          if (name) { doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK).text(name, MARGIN_H, y, { width: CONTENT_W }); y += 12; }
          if (text) { doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(text, MARGIN_H, y, { width: CONTENT_W }); y += doc.heightOfString(text, { width: CONTENT_W, fontSize: 8.5 }) + 4; }
        }
      }
      spacer(8);
    }

    // ── TODOS ─────────────────────────────────────────────────────────────────

    if (has('todos') && data.todos && data.todos.length > 0) {
      sectionTitle('Offene Aufgaben');
      for (const todo of data.todos) {
        if (todo.status === 'done') continue;
        ensureSpace(20);
        const prio = PRIORITY_LABELS[todo.priority] || todo.priority;
        const titleLine = `${todo.status === 'in_progress' ? '▶ ' : '○ '}${todo.title}`;
        doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_DARK).text(titleLine, MARGIN_H, y, { width: CONTENT_W });
        y += 13;
        const sub = [prio ? `Priorität: ${prio}` : null, todo.assigned_name ? `→ ${todo.assigned_name}` : null].filter(Boolean);
        if (sub.length) {
          doc.font(FONT_REG).fontSize(8).fillColor(C_MUTED).text(sub.join('   '), MARGIN_H, y, { width: CONTENT_W });
          y += 11;
        }
        if (todo.description) {
          doc.font(FONT_REG).fontSize(8.5).fillColor(C_MID).text(todo.description, MARGIN_H, y, { width: CONTENT_W });
          y += doc.heightOfString(todo.description, { width: CONTENT_W, fontSize: 8.5 }) + 3;
        }
        spacer(3);
      }
    }

    doc.end();
  });
}

module.exports = { generateAdvanceSheetPdf };
