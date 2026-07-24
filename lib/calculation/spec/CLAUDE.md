# Arbeitsanweisung

Anwendung zur Kalkulation von Tourneen und Festivalsaisons für Bands.
Fachliche Details in `docs/SPEC.md`, Rechenregeln in `docs/BERECHNUNGEN.md`.

## Stack

- Next.js (App Router), TypeScript
- PostgreSQL 16
- Drizzle ORM – SQL-first, das Schema in `db/schema.sql` ist die Quelle der Wahrheit,
  inklusive der beiden Views. Prisma nur, wenn es in den anderen Projekten hier schon
  gesetzt ist; dann müssen die Views als Raw Queries abgebildet werden.
- Docker Compose für lokale Entwicklung und Deployment auf Hetzner
- Vitest für Unit-Tests, Playwright optional später

## Harte Regeln

**Geld.** Alle Beträge sind `numeric` in der Datenbank. Aggregationen laufen in SQL,
nicht in JavaScript. Wenn im Frontend gerechnet werden muss, dann mit `decimal.js`,
niemals mit `number`. Gerundet wird ausschließlich zur Anzeige, auf zwei Stellen,
kaufmännisch. Zwischenergebnisse werden nie gerundet.

**Sprache.** Oberfläche komplett auf Deutsch. Zahlenformat `de-DE`, Währung EUR,
Datumsformat `TT.MM.JJJJ`. Feldbezeichnungen aus `docs/SPEC.md` wörtlich übernehmen –
sie entsprechen dem Vokabular aus der Branche und der bisherigen Excel-Datei.

**Rechenregeln.** Die Formeln in `docs/BERECHNUNGEN.md` sind verbindlich und nicht
zu verschönern. Sie sind gegen die produktiv genutzte Excel-Datei geprüft.

**Abnahme.** `docs/ABNAHMETESTS.md` enthält geprüfte Sollwerte. Diese Werte als
automatisierte Tests umsetzen, bevor an der Oberfläche gearbeitet wird. Ein grüner
Testlauf ist die Bedingung dafür, eine Phase als fertig zu bezeichnen.

**Migrationen.** Schemaänderungen nur über Migrationsdateien, nie durch Editieren
von `schema.sql` ohne Migration. `db/seed.sql` muss nach jeder Migration weiterhin
durchlaufen.

## Reihenfolge

Eine Phase nach der anderen. Am Ende jeder Phase anhalten und Rückmeldung einholen,
nicht durchlaufen.

**Phase 1 – Fundament.** Projektgerüst, Docker Compose mit Postgres, Schema anlegen,
`seed.sql` einspielen, Rechenregeln als reine Funktionen implementieren, Abnahmetests
schreiben und grün bekommen. Noch keine Oberfläche.

**Phase 2 – Übersicht lesend.** Die Matrix aus `docs/SPEC.md`, Abschnitt "Übersicht":
Zeilen sind Bereiche und Positionen, Spalten sind Shows, dazu Gesamtspalte und
Prozentanteil. Variantenumschalter, Szenario-Faktor. Nur Anzeige.

**Phase 3 – Bearbeiten.** Shows anlegen, ändern, deaktivieren, umsortieren. Buchungen
erfassen und ändern. Katalog pflegen. Inline in der Matrix bearbeiten, nicht über
separate Formulare in Unterseiten.

**Phase 4 – Arbeitserleichterung.** Projekt duplizieren als Vorlage für die nächste
Saison, Export nach Excel und PDF, Angebotsstand einfrieren.

**Phase 5 – Mehrbenutzer.** Authentifizierung, mehrere Bands, Freigabelinks mit
eingeschränkter Sicht für Booking und Management.

## Was nicht zu tun ist

- Keine Features erfinden, die nicht in `docs/SPEC.md` stehen. Bei Bedarf nachfragen.
- Die offenen Punkte am Ende von `docs/SPEC.md` nicht selbst entscheiden.
- Keine Rundung in Zwischenschritten, kein `float` für Geld.
- Die Bezeichner aus dem Fachvokabular nicht eindeutschen, übersetzen oder umbenennen –
  "Buyout", "Advancing", "Nightliner", "Break Even" bleiben so stehen.
