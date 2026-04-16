/**
 * seed-testdata.js
 * Importiert CSV-Testdaten in die SQLite-Datenbank (Tenant: betontod)
 * Ausführen: node server/scripts/seed-testdata.js
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'protouring.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Tenant ermitteln ──────────────────────────────────────────────────────────
const tenant = db.prepare("SELECT id FROM tenants WHERE slug = 'betontod'").get();
if (!tenant) {
  console.error('❌  Tenant "betontod" nicht gefunden. Bitte zuerst seed-fabian.js ausführen.');
  process.exit(1);
}
const tenantId = tenant.id;
console.log(`✅  Tenant "betontod" (id=${tenantId}) gefunden`);

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
// CSV mit Komma-Trenner (einfach, kein Quoting)
function parseCSVComma(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
}

// CSV mit Semikolon-Trenner + einfachem Quoting-Strip
function parseCSVSemi(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.split(';').map(v => v.replace(/^"|"$/g, '').trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
}

// ── KONTAKTE ──────────────────────────────────────────────────────────────────
const kontakteCSV = `Vorname,Nachname,Funktion 1,Funktion 2,Funktion 3,Spezifikation,Zugriffsrechte,E-Mail,Telefon,Anschrift,PLZ,Ort,Steuer-ID,Stundensatz,Tagessatz,Notizen
Fabian,Zimmermann,Sound Operating,Sound Operating FOH,Production Manager,keine Tomaten,Admin,fabian@blindpage.de,+49 1749181911,Waldstraße 106,56626,Andernach,,0,0,keine Tomaten
Max,Mustermann,Monitor Engineer,Tour Manager,,Kontakt,Artist,max@mustermann.de,,,12345,Musterhausen,,0,0,`;

const contacts = parseCSVComma(kontakteCSV);
const insertContact = db.prepare(`
  INSERT OR IGNORE INTO contacts
    (tenant_id, first_name, last_name, function1, function2, function3,
     specification, access_rights, email, phone, address, postal_code, residence,
     tax_id, hourly_rate, daily_rate, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let cCount = 0;
for (const c of contacts) {
  // Duplikat-Check nach Vorname + Nachname + E-Mail
  const exists = db.prepare(
    'SELECT id FROM contacts WHERE tenant_id = ? AND first_name = ? AND last_name = ? AND email = ?'
  ).get(tenantId, c['Vorname'], c['Nachname'], c['E-Mail']);
  if (exists) { console.log(`  ⏭  Kontakt "${c['Vorname']} ${c['Nachname']}" bereits vorhanden`); continue; }

  insertContact.run(
    tenantId, c['Vorname'], c['Nachname'],
    c['Funktion 1'], c['Funktion 2'], c['Funktion 3'],
    c['Spezifikation'], c['Zugriffsrechte'], c['E-Mail'], c['Telefon'],
    c['Anschrift'], c['PLZ'], c['Ort'], c['Steuer-ID'],
    parseFloat(c['Stundensatz']) || 0,
    parseFloat(c['Tagessatz']) || 0,
    c['Notizen']
  );
  cCount++;
}
console.log(`✅  Kontakte: ${cCount} importiert`);

// ── HOTELS ────────────────────────────────────────────────────────────────────
const hotelsCSV = `Name;Straße;PLZ;Ort;Bundesland;Land;Website
"B&B Hotel Berlin";"Waldstraße 22";"12345";"Mendig";"Berlin";"Deutscheland";"www.hotel-berlin-bb.de"
"MARITIM Hotel Magdeburg";"Musterstraße 77";"54321";"Magdeburg";"Sachsen";"Deutschland";""
"WIND Hotel";"Hauptstr. 66";"12345";"Mendig";"";"Deutschland";""
"Parkhotel";"Bachstr. 19";"54321";"Magdeburg";"Sachsen";"Deutschland";"www.parkhotel-andernach.de"
"IBIS";"Doofstr. 99";"32456";"Andernach";"Rheinland-Pfalz";"Deutschland";""
"Google Hotel";"Kemper Allee 213";"87656";"Neuwied";"";"Deutschland";""
"Katharina Hotel";"Birkenweg 9";"98746";"Berlin";"";"Polen";""
"Best Western";"Aktienstraße 889";"43567";"Koblenz";"";"Deutschland";"www.best-western.de"
"Test";"Schalke Straße 04";"87467";"Dortmund";"Nordrhein-Westfalen";"Germany";""`;

const hotels = parseCSVSemi(hotelsCSV);
const insertHotel = db.prepare(`
  INSERT OR IGNORE INTO hotels (tenant_id, name, street, postal_code, city, state, country, website)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let hCount = 0;
for (const h of hotels) {
  const exists = db.prepare(
    'SELECT id FROM hotels WHERE tenant_id = ? AND name = ? AND city = ?'
  ).get(tenantId, h['Name'], h['Ort']);
  if (exists) { console.log(`  ⏭  Hotel "${h['Name']}" bereits vorhanden`); continue; }

  insertHotel.run(tenantId, h['Name'], h['Straße'], h['PLZ'], h['Ort'], h['Bundesland'], h['Land'], h['Website']);
  hCount++;
}
console.log(`✅  Hotels: ${hCount} importiert`);

// ── FAHRZEUGE ─────────────────────────────────────────────────────────────────
const vehiclesCSV = `Bezeichnung;Fahrzeugart;Driver;Kennzeichen;Maße;Stromanschluss;Anhänger;Anhängermaße;Anhänger-Kennzeichen;Sitzplätze;Schlafplätze;Bemerkung
"Nightliner SD";"Nightliner";"Max Mustermann";"";"";"";"Nein";"";"";"8";"8";"undefined"
"Transporter (Equipment)";"Transporter";"";"";"";"";"Nein";"";"";"2";"0";"undefined"`;

const vehicles = parseCSVSemi(vehiclesCSV);
const insertVehicle = db.prepare(`
  INSERT OR IGNORE INTO vehicles
    (tenant_id, designation, vehicle_type, driver, license_plate, dimensions,
     power_connection, has_trailer, trailer_dimensions, trailer_license_plate,
     seats, sleeping_places, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let vCount = 0;
for (const v of vehicles) {
  const exists = db.prepare(
    'SELECT id FROM vehicles WHERE tenant_id = ? AND designation = ?'
  ).get(tenantId, v['Bezeichnung']);
  if (exists) { console.log(`  ⏭  Fahrzeug "${v['Bezeichnung']}" bereits vorhanden`); continue; }

  const hasTrailer = v['Anhänger'].toLowerCase() === 'ja' ? 1 : 0;
  const notes = v['Bemerkung'] === 'undefined' ? '' : v['Bemerkung'];
  insertVehicle.run(
    tenantId, v['Bezeichnung'], v['Fahrzeugart'], v['Driver'], v['Kennzeichen'],
    v['Maße'], v['Stromanschluss'], hasTrailer,
    v['Anhängermaße'], v['Anhänger-Kennzeichen'],
    v['Sitzplätze'], v['Schlafplätze'], notes
  );
  vCount++;
}
console.log(`✅  Fahrzeuge: ${vCount} importiert`);

// ── PARTNER ───────────────────────────────────────────────────────────────────
const partnerCSV = `Firmenname,Straße,PLZ,Ort,Bundesland,Land,Art
MMS Cologne,,56765,Köln,NRW,Deutschland,Veranstaltende
ASR - Audio Service Rheinland,,54321,Irlich,Rheinland-Pfalz,Deutschland,Technik-Lieferant
MEXS,,45678,Münster,NRW,Deutschland,Trucking-Firma`;

const partners = parseCSVComma(partnerCSV);
const insertPartner = db.prepare(`
  INSERT OR IGNORE INTO partners
    (tenant_id, company_name, street, postal_code, city, state, country, type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let pCount = 0;
for (const p of partners) {
  const exists = db.prepare(
    'SELECT id FROM partners WHERE tenant_id = ? AND company_name = ?'
  ).get(tenantId, p['Firmenname']);
  if (exists) { console.log(`  ⏭  Partner "${p['Firmenname']}" bereits vorhanden`); continue; }

  insertPartner.run(
    tenantId, p['Firmenname'], p['Straße'], p['PLZ'], p['Ort'],
    p['Bundesland'], p['Land'], p['Art']
  );
  pCount++;
}
console.log(`✅  Partner: ${pCount} importiert`);

console.log('\n🎉  Import abgeschlossen');
db.close();
