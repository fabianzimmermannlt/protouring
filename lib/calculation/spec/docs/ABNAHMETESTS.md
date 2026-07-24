# Abnahmetests

Diese Werte stammen aus der produktiv genutzten Excel-Datei und wurden gegen die
migrierten Startdaten (`db/seed.sql`) nachgerechnet. Sie sind die Definition von
"es rechnet richtig".

Als automatisierte Tests umsetzen, bevor Oberflächenarbeit beginnt. Grundlage ist
`db/seed.sql` im unveränderten Zustand, Szenario-Faktor 1, alle Shows aktiv,
5 Bandmitglieder.

Vergleich auf vier Nachkommastellen. Wer bei jeder Position auf zwei Stellen rundet,
verfehlt die Sollwerte – siehe Show S04.

## Variante "mit NL"

| Kennzahl | Sollwert |
|---|---:|
| SUMME EINNAHMEN | 122.400,00 |
| SUMME AUSGABEN | 98.960,22 |
| ERGEBNIS | 23.439,78 |
| je Bandmitglied | 4.687,956 |

### Bereichssummen

| Bereich | Art | Sollwert |
|---|---|---:|
| BUYOUTS & SPONSORING | Einnahme | 2.000,00 |
| TOURSUPPORT | Ausgabe | 0,00 |
| PERSONAL | Ausgabe | 25.050,00 |
| TRANSPORT & LOGISTIK | Ausgabe | 33.530,22 |
| UNTERKUNFT & VERPFLEGUNG | Ausgabe | 10.880,00 |
| TECHNIK & PRODUKTION | Ausgabe | 27.700,00 |
| SONSTIGE KOSTEN | Ausgabe | 1.800,00 |
| ANSCHAFFUNGEN | Ausgabe | 0,00 |

### Je Show

| Show | Stadt | Gage netto | Ausgaben | Ergebnis |
|---|---|---:|---:|---:|
| S01 | CH-BERN | 13.600,00 | 8.079,820 | 5.520,180 |
| S02 | BALLENSTEDT | 12.750,00 | 13.369,320 | -619,320 |
| S03 | WIESMOOR | 18.700,00 | 11.654,820 | 7.045,180 |
| S04 | MARKTREDWITZ | 12.750,00 | 11.492,935 | 1.257,065 |
| S05 | HANNOVER | 17.850,00 | 11.359,485 | 7.490,515 |
| S06 | DINKELSBÜHL | 12.750,00 | 13.387,830 | -637,830 |
| S07 | BREMEN | 7.500,00 | 10.767,730 | -3.267,730 |
| S08 | MÜNSTER | 7.500,00 | 8.655,680 | -1.155,680 |
| S09 | LINGEN | 17.000,00 | 10.192,600 | 7.807,400 |

### Prozentanteile (Regel 6)

| Zeile | Bezug | Sollwert |
|---|---|---:|
| Gesamt GAGEN | Einnahmen | 98,3660 % |
| Gesamt BUYOUTS & SPONSORING | Einnahmen | 1,6340 % |
| Gesamt PERSONAL | Ausgaben | 25,3132 % |
| Gesamt TRANSPORT & LOGISTIK | Ausgaben | 33,8825 % |
| Gesamt UNTERKUNFT & VERPFLEGUNG | Ausgaben | 10,9943 % |
| Gesamt TECHNIK & PRODUKTION | Ausgaben | 27,9910 % |
| Gesamt SONSTIGE KOSTEN | Ausgaben | 1,8189 % |

## Variante "ohne NL"

| Kennzahl | Sollwert |
|---|---:|
| SUMME EINNAHMEN | 122.400,00 |
| SUMME AUSGABEN | 92.092,48 |
| ERGEBNIS | 30.307,52 |
| je Bandmitglied | 6.061,504 |

### Bereichssummen

| Bereich | Art | Sollwert |
|---|---|---:|
| BUYOUTS & SPONSORING | Einnahme | 2.000,00 |
| TOURSUPPORT | Ausgabe | 0,00 |
| PERSONAL | Ausgabe | 25.050,00 |
| TRANSPORT & LOGISTIK | Ausgabe | 20.962,48 |
| UNTERKUNFT & VERPFLEGUNG | Ausgabe | 16.280,00 |
| TECHNIK & PRODUKTION | Ausgabe | 28.000,00 |
| SONSTIGE KOSTEN | Ausgabe | 1.800,00 |
| ANSCHAFFUNGEN | Ausgabe | 0,00 |


## Regressionstests für die Struktur

Diese Fälle haben die Excel-Lösung reihenweise zerlegt. Sie müssen durchlaufen,
ohne dass sich irgendeine andere Zahl verändert.

| Fall | Erwartung |
|---|---|
| Show mitten in der Reihenfolge löschen | Alle übrigen Shows behalten Gage und Kosten unverändert. Gesamtwerte sinken exakt um die Werte der gelöschten Show. |
| Show deaktivieren statt löschen | Wie oben, aber die Buchungen bleiben erhalten und kehren beim Reaktivieren unverändert zurück. |
| Show zwischen zwei bestehende einfügen | Erscheint an der gewünschten Stelle. Kein anderer Wert ändert sich. |
| Position im Katalog umbenennen | Alle Buchungen behalten ihre Beträge, keine Zahl ändert sich. |
| Neue Position anlegen und bebuchen | Erscheint automatisch im richtigen Bereich. Bereichssumme und Gesamtergebnis steigen um genau diesen Betrag. |
| Position ohne Buchungen | Erscheint mit 0, verändert keine Summe. |
| Fixkostenbuchung über 9.000 bei 9 aktiven Shows | 1.000 je Show, Gesamtwirkung exakt 9.000. |
| Eine Show deaktivieren, danach Fixkosten prüfen | Umlage verteilt sich auf 8 Shows, Gesamtwirkung bleibt 9.000. |
| Variante umschalten | Nur die als variantenabhängig markierten Buchungen ändern sich. Siehe die beiden Sollwertblöcke oben. |
| Szenario-Faktor auf 0,8 | Shows mit gefüllter Kapazität und Deal-Anteil ändern ihre Gage, reine Garantieshows nicht. In den Bestandsdaten hat kein Show Deal-Parameter, daher darf sich hier nichts ändern. |

## Bekannte Eigenheiten der Altdaten

- Kein Show der Saison 2026 hat Kapazität, Ticketpreis oder Deal-Anteil gefüllt.
  Alle Gagen laufen über die Garantie. Der Deal-Zweig muss trotzdem korrekt
  implementiert und getestet werden, für Clubtourneen ist er der Regelfall.
- Die Provision beträgt bei sieben Shows 15 %, bei zweien 0 %.
- 28 Buchungen sind variantenabhängig, alle übrigen gelten in beiden Varianten.
- Die Notizfelder enthalten teils die ursprünglichen Excel-Formeln als Herkunftsnachweis,
  etwa `Ursprung: =13000/8`. Das sind Altlasten aus handverteilten Pauschalen und
  gehören mittelfristig in echte Fixkostenbuchungen überführt.
