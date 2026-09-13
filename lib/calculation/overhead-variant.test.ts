// Abnahmetest – Übergeordnete Kosten pro Variante (show_id NULL, variant_id gesetzt).
// Verknüpft (variant_id NULL) gilt für alle Varianten; aufgelöst zählt je Variante der
// eigene Betrag. Umlage wie gehabt gleichmäßig auf die aktiven Shows.

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
  shows: [mkShow('s1', 1), mkShow('s2', 2)],
  categories: [{ id: 'c1', name: 'ANSCHAFFUNGEN', kind: 'expense', sort_order: 1 }],
  positions: [{ id: 'pos1', category_id: 'c1', name: 'Bühne', is_overhead: true, sort_order: 1 }],
  // pro Variante: A = 900, B = 500 (show_id NULL, variant_id gesetzt)
  entries: [
    { id: 'ea', show_id: null, position_id: 'pos1', variant_id: 'vA', amount: '900', kind: 'base' },
    { id: 'eb', show_id: null, position_id: 'pos1', variant_id: 'vB', amount: '500', kind: 'base' },
  ],
}

const num = (d: { toDecimalPlaces: (n: number) => { toNumber: () => number } }) => d.toDecimalPlaces(4).toNumber()
const ausg = (r: ReturnType<typeof buildOverview>, id: string) => num(r.shows.find(s => s.showId === id)!.ausgaben)

describe('Übergeordnete Kosten pro Variante', () => {
  it('Variante A: 900 gleichmäßig auf 2 Shows = je 450', () => {
    const r = buildOverview(base, { variantId: 'vA', memberCount: 1 })
    expect(ausg(r, 's1')).toBeCloseTo(450, 4)
    expect(ausg(r, 's2')).toBeCloseTo(450, 4)
  })

  it('Variante B: 500 auf 2 Shows = je 250 (unabhängig von A)', () => {
    const r = buildOverview(base, { variantId: 'vB', memberCount: 1 })
    expect(ausg(r, 's1')).toBeCloseTo(250, 4)
    expect(ausg(r, 's2')).toBeCloseTo(250, 4)
  })

  it('verknüpft (variant_id NULL) gilt für beide Varianten', () => {
    const linked: CalcDataset = { ...base, entries: [{ id: 'e0', show_id: null, position_id: 'pos1', variant_id: null, amount: '800', kind: 'base' }] }
    expect(ausg(buildOverview(linked, { variantId: 'vA', memberCount: 1 }), 's1')).toBeCloseTo(400, 4)
    expect(ausg(buildOverview(linked, { variantId: 'vB', memberCount: 1 }), 's1')).toBeCloseTo(400, 4)
  })
})
