/**
 * Robuster CSV-Parser mit Semikolon als Standard-Trennzeichen.
 * Unterstützt:
 * - Felder in Anführungszeichen (z.B. "Hamburg, HH")
 * - Escaped Quotes innerhalb von Feldern ("er sagte ""Hallo""")
 * - Zeilenumbrüche innerhalb von gequoteten Feldern
 * - Leerzeilen werden übersprungen
 *
 * Verwendet Semikolon als Trennzeichen → CSV öffnet sich direkt
 * korrekt in Excel (de/at/ch Regionaleinstellungen).
 */
export function parseCSV(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = []
  const len = text.length
  let i = 0

  while (i < len) {
    const row: string[] = []

    // Zeile lesen
    while (i < len) {
      if (text[i] === '"') {
        // Gequotetes Feld
        let field = ''
        i++ // öffnendes " überspringen
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              // Escaped quote: "" → "
              field += '"'
              i += 2
            } else {
              // Schließendes "
              i++
              break
            }
          } else {
            field += text[i]
            i++
          }
        }
        row.push(field)
        // Trennzeichen oder Zeilenende danach erwarten
        if (i < len && text[i] === delimiter) i++
      } else {
        // Ungequotetes Feld: bis Trennzeichen oder Zeilenende
        let field = ''
        while (i < len && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]
          i++
        }
        row.push(field.trim())
        if (i < len && text[i] === delimiter) i++
      }

      // Zeilenende
      if (i >= len || text[i] === '\n' || text[i] === '\r') break
    }

    // \r\n oder \n überspringen
    if (i < len && text[i] === '\r') i++
    if (i < len && text[i] === '\n') i++

    // Leere Zeilen überspringen
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }

  return rows
}

/**
 * Gibt den Wert an Index idx zurück, oder '' wenn der Index nicht existiert.
 * Verhindert undefined-Fehler beim destrukturieren von CSV-Zeilen.
 */
export function col(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}
