// Abnahmetest – einzelne Zeile pro Show + Variante weghaken (rowExclude).
// Weggehakte Zeile zählt in der betroffenen Variante nicht mehr; andere Varianten
// und der gespeicherte Wert bleiben unberührt.

import { describe, it, expect } from 'vitest'
import { buildOverview } from './engine'
import type { CalcDataset, CalcShow } from './types'

const mkShow = (id: string, sort: number): CalcShow => ({
  id, sort_order: sort, guarantee: '0', deal_share: '0', break_even: '0',
  commission: '0', deal_type: 'guarantee', is_active: true, capacity: 0, ticket_price: '0',
})

const base: CalcDataset = {
  project: { id: 'p', name: 'T', fuel_consumption: '0', fuel_price: '0', scenario_factor: '1', member_count: 1, default_variant_id: 'vA' },
  variants: [{ id: 'vA', name: 'A', sort_order: 1 }, { id: 'vB', name: 'B', sort_order: 2 }],
  shows: [mkShow('s1', 1)],
  categories: [{ id: 'c1', name: 'AUSGABEN', kind: 'expense', sort_order: 1 }],
  positions: [{ id: 'pos1', category_id: 'c1', name: 'Hotel', is_overhead: false, sort_order: 1 }],
  // Wert gilt in allen Varianten (variant_id null)
  entries: [{ id: 'e1', show_id: 's1', position_id: 'pos1', variant_id: null, amount: '200', kind: 'base' }],
}

const num = (d: { toDecimalPlaces: (n: number) => { toNumber: () => number } }) => d.toDecimalPlaces(4).toNumber()
const ausg = (r: ReturnType<typeof buildOverview>, id: string) => num(r.shows.find(s => s.showId === id)!.ausgaben)

describe('Zeile weghaken (rowExclude) pro Show + Variante', () => {
  it('ohne Haken: Position zählt in beiden Varianten', () => {
    expect(ausg(buildOverview(base, { variantId: 'vA' }), 's1')).toBeCloseTo(200, 4)
    expect(ausg(buildOverview(base, { variantId: 'vB' }), 's1')).toBeCloseTo(200, 4)
  })

  it('weggehakt in Variante A: A = 0, B bleibt 200', () => {
    const data: CalcDataset = { ...base, rowExclude: [{ show_id: 's1', position_id: 'pos1', variant_id: 'vA' }] }
    expect(ausg(buildOverview(data, { variantId: 'vA' }), 's1')).toBeCloseTo(0, 4)
    expect(ausg(buildOverview(data, { variantId: 'vB' }), 's1')).toBeCloseTo(200, 4)
  })

  it('Haken entfernt (leere Liste): zählt wieder normal', () => {
    const data: CalcDataset = { ...base, rowExclude: [] }
    expect(ausg(buildOverview(data, { variantId: 'vA' }), 's1')).toBeCloseTo(200, 4)
  })
})
