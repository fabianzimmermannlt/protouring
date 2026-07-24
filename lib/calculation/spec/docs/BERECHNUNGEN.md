# Rechenregeln

Verbindlich. Alle Regeln sind gegen `Kalkulation_Festivals_2026.xlsm` geprüft, die
Sollwerte stehen in `ABNAHMETESTS.md`.

Nirgends wird in Zwischenschritten gerundet. Gerundet wird nur zur Anzeige, auf zwei
Nachkommastellen, kaufmännisch.

---

## Regel 1 – Betrag einer Buchung

Zwei Erfassungsarten. Welche greift, entscheidet sich an den Fahrzeugfeldern:

```
wenn distance_km > 0 ODER rental_price > 0:
    betrag =   rental_price
             + max(0, distance_km - included_km) * price_extra_km
             + distance_km / 100 * fuel_consumption * fuel_price
sonst:
    betrag = quantity * unit_price
```

Leere Felder zählen als 0.

`fuel_consumption` und `fuel_price` kommen aus dem Projekt, nicht aus der Buchung.

**Abweichung zur Excel-Datei, bewusst:** dort fehlte das `max(0, …)`. Blieb die
gefahrene Strecke unter den Inklusiv-Kilometern und war gleichzeitig ein Preis je
Mehrkilometer hinterlegt, wurde die Miete rechnerisch kleiner. Das ist falsch und
wurde korrigiert. In den Bestandsdaten tritt der Fall nicht auf, die Sollwerte bleiben
dadurch unverändert.

**Warum die Oder-Bedingung:** manche Fahrzeugbuchungen haben nur einen Mietpreis und
keine Strecke, etwa ein Pauschalangebot für einen Nightliner. Eine Prüfung allein auf
`distance_km` würde diese Buchungen auf 0 setzen.

---

## Regel 2 – Gage netto einer Show

Die Band bekommt entweder ihre Garantie oder ihren Anteil am Überschuss, je nachdem
was höher ist. Von beidem geht die Provision der Booking-Agentur ab.

```
garantie_netto = guarantee * (1 - commission)

deal_netto = ((capacity * ticket_price * scenario_factor - break_even) * deal_share)
             * (1 - commission)

gage_netto = max(garantie_netto, deal_netto)
```

`scenario_factor` ist die angenommene Auslastung, 1 entspricht 100 %. Er wirkt nur auf
den Deal-Zweig, nicht auf die Garantie.

Sind `capacity`, `ticket_price` oder `deal_share` leer, ergibt der Deal-Zweig 0 oder
einen negativen Wert, und es greift die Garantie. Das ist der Normalfall bei Festivals
und muss ohne Sonderbehandlung funktionieren.

---

## Regel 3 – Variantenfilter

Eine Buchung zählt in der gewählten Variante mit, wenn gilt:

```
entry.variant_id IS NULL  ODER  entry.variant_id = gewählte Variante
```

`NULL` heißt: gilt immer. So werden nur die tatsächlich abweichenden Positionen doppelt
erfasst, alles andere steht genau einmal da.

---

## Regel 4 – Fixkosten

Eine Buchung ohne Show (`show_id IS NULL`) ist ein Fixkostenposten des Projekts.

```
anteil_je_show = betrag / anzahl_aktiver_shows
```

`anzahl_aktiver_shows` ist die Zahl der Shows des Projekts mit `is_active = true`.
Ist sie 0, wird nichts umgelegt.

Der Anteil geht in die Bereichssumme derselben Kategorie ein wie eine normale Buchung.

---

## Regel 5 – Aggregation

```
kosten(show, position)  = Summe der Beträge aller Buchungen dieser Show und Position,
                          die den Variantenfilter passieren,
                        + anteiliger Fixkostenbetrag derselben Position

kosten(show, bereich)   = Summe über alle Positionen des Bereichs

einnahmen(show)         = gage_netto(show) + Summe der Bereiche mit kind = 'income'
ausgaben(show)          = Summe der Bereiche mit kind = 'expense'
ergebnis(show)          = einnahmen(show) - ausgaben(show)

ergebnis_gesamt         = Summe über alle aktiven Shows
je_bandmitglied         = ergebnis_gesamt / member_count
```

Wichtig: Bereichssummen werden **aus den Buchungen** gebildet, nicht aus den angezeigten
Positionszeilen. Die Anzeige darf die Rechnung nicht beeinflussen. Genau daran ist die
Excel-Lösung mehrfach gescheitert.

---

## Regel 6 – Prozentanteile

```
Zeile im Einnahmenteil: wert / SUMME EINNAHMEN
Zeile im Ausgabenteil:  wert / SUMME AUSGABEN
```

Nicht alles auf eine gemeinsame Bezugsgröße beziehen. Beide Summenzeilen ergeben damit
100 %, und die Bereiche eines Abschnitts addieren sich auf 100 %.

Bezugsgröße 0 ergibt keine Anzeige, keine Division durch null.

---

## Rundung

Datenbank `numeric`, keine Gleitkommazahlen. Aggregation in SQL. Wo im Frontend
gerechnet wird, `decimal.js`.

Beispiel aus den Bestandsdaten: Show S04 ergibt 11.492,935 EUR Ausgaben. Wird bei jeder
Position auf zwei Stellen gerundet, entsteht ein anderer Gesamtwert. Die Abnahmetests
sind auf ungerundete Zwischenwerte ausgelegt.
