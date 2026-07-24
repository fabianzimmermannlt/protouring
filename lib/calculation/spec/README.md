# Tour- und Festivalkalkulation

Ablösung der Excel-Kalkulation durch eine Web-App. Dieses Verzeichnis enthält alles,
was Claude Code braucht, um loszulegen: Spezifikation, Datenmodell, Rechenregeln,
migrierte Echtdaten und Abnahmetests.

## Inhalt

| Datei | Zweck |
|---|---|
| `CLAUDE.md` | Arbeitsanweisung für Claude Code – Stack, Konventionen, Reihenfolge |
| `docs/SPEC.md` | Was die Anwendung können muss |
| `docs/BERECHNUNGEN.md` | Die Rechenregeln, exakt, mit Herkunft aus der Excel-Datei |
| `docs/ABNAHMETESTS.md` | Geprüfte Sollwerte – daran misst sich, ob es stimmt |
| `db/schema.sql` | PostgreSQL-Schema inklusive Views |
| `db/seed.sql` | Startdaten, direkt ausführbar |
| `data/seed.json` | Dieselben Startdaten lesbar, als Referenz |

## Startbefehl für Claude Code

```
Lies CLAUDE.md, docs/SPEC.md, docs/BERECHNUNGEN.md und docs/ABNAHMETESTS.md.
Fasse mir in zehn Zeilen zusammen, was du bauen wirst, und nenne die Punkte,
bei denen du eine Entscheidung von mir brauchst. Fang noch nicht an zu coden.
```

Erst danach Phase 1 aus `CLAUDE.md` starten.

## Woher die Daten kommen

Aus `Kalkulation_Festivals_2026.xlsm`: 9 Shows, 8 Bereiche, 54 Positionen, 192 Buchungen,
zwei Varianten (mit und ohne Nightliner). Die Migration ist gegen die Originaldatei
geprüft – siehe `docs/ABNAHMETESTS.md`.
