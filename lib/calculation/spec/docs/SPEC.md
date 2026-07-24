# Spezifikation

## Zweck

Vor einer Tournee oder Festivalsaison wird kalkuliert, ob sie sich trägt. Eingang sind
Gagenangebote je Show und alle anfallenden Kosten. Ausgang ist ein Ergebnis je Show,
ein Gesamtergebnis und ein Ergebnis je Bandmitglied. Die Kalkulation wird mehrfach
überarbeitet, in Varianten gerechnet und mit Booking, Management und Band besprochen.

Die Anwendung ersetzt eine Excel-Datei, die an genau dieser Stelle gescheitert ist:
in Excel hängen Formeln an Zellpositionen, jede Strukturänderung bricht etwas.

## Begriffe

| Begriff | Bedeutung |
|---|---|
| Projekt | Eine Kalkulation. Etwa "Festivals 2026" oder "Herbsttour 2026" |
| Show | Ein Auftritt. Datum, Stadt, Venue, Deal-Parameter |
| Bereich | Kostengruppe: Personal, Transport & Logistik, Technik & Produktion … |
| Position | Einzelne Kostenart innerhalb eines Bereichs: Sound FOH, Truck 7,5t … |
| Buchung | Ein konkreter Betrag: diese Position, diese Show, diese Variante |
| Variante | Alternative Rechnung derselben Saison, z. B. "mit NL" und "ohne NL" |
| Fixkosten | Buchung ohne Show, wird gleichmäßig auf alle aktiven Shows umgelegt |
| Szenario-Faktor | Angenommene Auslastung bei Shows mit Deal-Beteiligung |

## Datenmodell

Siehe `db/schema.sql`. Die tragende Idee:

Eine Buchung verweist auf Show, Position und Variante. Sie kennt keine Zeile, keine
Spalte, keine Reihenfolge. Jede Auswertung ist eine Aggregation über diese Verweise.
Deshalb kann das Löschen einer Show, das Einfügen einer Position oder das Umsortieren
nichts zerstören.

Zwei Sonderfälle:

- `show_id IS NULL` – Fixkosten. Werden durch die Anzahl aktiver Shows geteilt und
  jeder Show anteilig zugerechnet.
- `variant_id IS NULL` – gilt in allen Varianten. Sonst nur in der genannten.

## Ansichten

### Übersicht

Die zentrale Ansicht. Matrix:

- Zeilen: Bereiche, darin die Positionen, dazu je Bereich eine Summenzeile.
  Reihenfolge nach `sort_order`.
- Spalten: die aktiven Shows in ihrer `sort_order`, dazu Gesamt und Prozentanteil.
- Kopf je Spalte: Datum, Stadt, Venue.

Aufbau von oben nach unten:

```
EINNAHMEN
  Gage (abzgl. Provision)
  Gesamt GAGEN
  BUYOUTS & SPONSORING
    … Positionen …
  Gesamt BUYOUTS & SPONSORING
SUMME EINNAHMEN
AUSGABEN
  je Bereich: Positionen, dann Gesamt <Bereich>
SUMME AUSGABEN
ERGEBNIS
  je Bandmitglied
```

Positionen ohne jede Buchung im Projekt werden trotzdem angezeigt, mit 0. Sie dienen
als Checkliste, damit nichts vergessen wird. Ein Schalter blendet sie aus.

Der Prozentanteil bezieht sich im Einnahmenteil auf SUMME EINNAHMEN, im Ausgabenteil
auf SUMME AUSGABEN. Beide Summenzeilen stehen damit auf 100 %.

Kopfbereich: Variantenauswahl, Szenario-Faktor, Anzahl Shows.

### Show

Detailansicht einer Show mit den Deal-Parametern und allen Buchungen dieser Show,
gruppiert nach Bereich. Gage netto, Kosten, Deckungsbeitrag.

### Katalog

Bereiche und Positionen pflegen, sortieren. Eine Position, auf die noch Buchungen
verweisen, lässt sich nicht löschen, nur umbenennen oder ausblenden.

### Parameter

Verbrauch, Spritpreis, Szenario-Faktor, Anzahl Bandmitglieder, Varianten.

## Funktionen

**Muss**

- Shows anlegen, ändern, umsortieren, deaktivieren. Eine deaktivierte Show verschwindet
  aus der Übersicht und aus der Fixkostenumlage, ihre Buchungen bleiben erhalten.
- Buchungen erfassen, inline in der Übersicht bearbeitbar.
- Zwei Erfassungsarten je Buchung: Menge mal Einzelpreis, oder Fahrzeugrechnung aus
  Strecke, Mietpreis, Inklusiv-Kilometern und Preis je Mehrkilometer.
- Varianten umschalten, ohne die Daten zu duplizieren.
- Szenario-Faktor als Regler; die Übersicht rechnet sofort neu.
- Ergebnis je Show, gesamt und je Bandmitglied.

**Soll**

- Projekt duplizieren als Vorlage für die nächste Saison, wahlweise ohne Beträge.
- Export nach Excel und PDF, Layout wie die Übersicht.
- Angebotsstand einfrieren und später vergleichen.
- Notizfeld je Buchung; die migrierten Daten bringen bereits Notizen mit
  (Routen, Namen, Herkunftsformeln aus Excel).

**Später**

- Mehrere Bands, Authentifizierung, Freigabelinks mit reduzierter Sicht.
- Ist gegen Plan nach der Tour.
- Mehrwährung mit Kurs je Show.

## Offene Punkte

Diese Fragen sind bewusst nicht entschieden. Nicht selbst festlegen.

1. **Hotelkosten.** In der Excel-Datei existiert ein Feld "Anzahl Zimmer", das aber
   nicht in die Rechnung eingeht – gerechnet wird nur Übernachtungen mal Betrag.
   Ist das gewollt, oder soll künftig Zimmer mal Nächte mal Preis gelten?
2. **Fixkostenumlage.** Aktuell gleichmäßig auf alle aktiven Shows. Soll es alternativ
   eine Umlage nach Reisetagen oder eine Umlage auf eine Teilmenge von Shows geben?
   In der Excel-Datei wurden solche Fälle von Hand halbiert.
3. **Mehrere Varianten gleichzeitig.** Bisher wird eine Variante angezeigt. Soll es
   einen Vergleich nebeneinander geben?
4. **Provision.** Steht je Show. Soll es einen Projektvorgabewert geben, den einzelne
   Shows überschreiben?
