// DB-Serialisierung: Seed → Import-Zeilen (TEXT-Dezimalstrings) → CalcDataset →
// Rechenkern muss dieselben Sollwerte liefern wie direkt aus dem Seed.
// Beweist, dass die TEXT-Speicherung (Weg A) die Präzision erhält. Nutzt die
// EINE Import-Implementierung, die auch der Server verwendet (server/calc_import).

import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import seedRaw from './spec/data/seed.json'
import { buildOverview } from './engine'
import type { CalcDataset } from './types'
import * as calcImport from '../../server/calc_import.js'

const calc = calcImport as unknown as {
  buildImportRows: (seed: unknown, tenantId: number) => any
  rowsToDataset: (rows: any) => CalcDataset
}
const num = (d: Decimal) => d.toDecimalPlaces(4).toNumber()

describe('DB-Serialisierung (Import → Dataset → Rechenkern)', () => {
  const rows = calc.buildImportRows(seedRaw, 1)
  const dataset = calc.rowsToDataset(rows)
  const variant = (name: string) => dataset.variants.find(v => v.name === name)!.id

  it('frische UUIDs + korrekte Zeilenzahlen', () => {
    expect(rows.project.tenant_id).toBe(1)
    expect(dataset.variants.length).toBe(2)
    expect(dataset.shows.length).toBe(9)
    expect(dataset.positions.length).toBe(54)
    expect(dataset.entries.length).toBe(192)
    // FK-Remap: default_variant_id zeigt auf eine echte (neue) Variante
    expect(dataset.variants.some(v => v.id === dataset.project.default_variant_id)).toBe(true)
    // Beträge als Strings gespeichert (kein float)
    expect(typeof dataset.shows[0].guarantee).toBe('string')
  })

  it('Sollwerte „mit NL"', () => {
    const r = buildOverview(dataset, { variantId: variant('mit NL'), memberCount: 5 })
    expect(num(r.sumAusgaben)).toBeCloseTo(98960.22, 4)
    expect(num(r.ergebnis)).toBeCloseTo(23439.78, 4)
    expect(num(r.jeBandmitglied)).toBeCloseTo(4687.956, 4)
  })

  it('Sollwerte „ohne NL"', () => {
    const r = buildOverview(dataset, { variantId: variant('ohne NL'), memberCount: 5 })
    expect(num(r.sumAusgaben)).toBeCloseTo(92092.48, 4)
    expect(num(r.ergebnis)).toBeCloseTo(30307.52, 4)
  })
})
