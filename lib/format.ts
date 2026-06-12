// Zentrale Zahlen-/Geld-Formatierung (de-DE: Punkt als Tausender-Trenner, Komma als Dezimal)
// Verwendung:
//   formatNumber(25000)        -> "25.000"
//   formatNumber("25000")      -> "25.000"
//   formatMoney(20)            -> "20,00"
//   formatMoney(25000, 'EUR')  -> "25.000,00 EUR"

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value
  return Number.isFinite(n) ? n : null
}

/** Ganzzahl/Dezimal mit Tausender-Trennung (de-DE). Standard ohne Nachkommastellen. */
export function formatNumber(
  value: number | string | null | undefined,
  opts?: { minDecimals?: number; maxDecimals?: number },
): string {
  const n = toNumber(value)
  if (n === null) return ''
  const min = opts?.minDecimals ?? 0
  const max = opts?.maxDecimals ?? Math.max(min, 0)
  return n.toLocaleString('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max })
}

/** Geldbetrag, immer mit 2 Nachkommastellen + Tausender-Trennung. Optional Währung anhängen. */
export function formatMoney(
  value: number | string | null | undefined,
  currency?: string,
): string {
  const s = formatNumber(value, { minDecimals: 2, maxDecimals: 2 })
  if (s === '') return ''
  return currency ? `${s} ${currency}` : s
}
