// Anzeige-Formatierung für die Kalkulation. Gerundet wird AUSSCHLIESSLICH hier
// (zur Anzeige), 2 Stellen kaufmännisch. Zwischenwerte bleiben ungerundet.

import Decimal from 'decimal.js'

/** Kaufmännisch auf 2 Stellen, de-DE, ohne Währungssymbol. */
export function formatMoney(v: Decimal): string {
  const n = v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Mit €-Suffix. */
export function formatEUR(v: Decimal): string {
  return formatMoney(v) + ' €'
}

/** Prozent mit einer Nachkommastelle. null → leer. */
export function formatPercent(v: Decimal | null): string {
  if (v == null) return ''
  return v.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber()
    .toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'
}

/** Datum TT.MM.JJJJ aus ISO-String. */
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}
