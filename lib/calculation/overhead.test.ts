// Abnahmetest – Übergeordnete Kosten (show_id NULL) mit Show-Ausnahmen (overheadExclude).
// Umlage eines Postens verteilt sich gleichmäßig auf die zutreffenden aktiven Shows;
// abgewählte Shows tragen 0, der Gesamtbetrag bleibt erhalten.

import { describe, it, expect } from 'vitest'
import { buildOverview } from './engine'
import type { CalcDataset, CalcShow } from './types'

const mkShow = (id: string, sort: number): CalcShow => ({
  id, sort_order: sort, guarantee: '0', deal_share: '0', break_even: '0',
  commission: '0', deal_type: 'guarantee', is_active: true, capacity: 0, ticket_price: '0',
})

const base: CalcDataset = {
  project: { id: 'p', name: 'T', fuel_consumption: '0', fuel_price: '0', scenario_factor: '1', member_count: 1, default_variant_id: null },
  variants: [],
  shows: [mkShow('s1', 1), mkShow('s2', 2), mkShow('s3', 3)],
  categories: [{ id: 'c1', name: 'ANSCHAFFUNGEN', kind: 'expense', sort_order: 1 }],
  positions: [{ id: 'pos1', category_id: 'c1', name: 'Kulisse', is_overhead: true, sort_order: 1 }],
  entries: [{ id: 'e1', show_id: null, position_id: 'pos1', variant_id: null, amount: '900', kind: 'base' }],
}

const num = (d: { toDecimalPlaces: (n: number) => { toNumber: () => number } }) => d.toDecimalPlaces(4).toNumber()
const showAmt = (r: ReturnType<typeof buildOverview>, id: string) =>
  num(r.shows.find(s => s.showId === id)!.positionAmount.get('pos1') ?? (r.shows.find(s => s.showId === id)!.ausgaben.times(0)))

describe('Übergeordnete Kosten – Umlage', () => {
  it('ohne Ausnahme: 900 gleichmäßig auf 3 Shows = je 300', () => {
    const r = buildOverview(base, { memberCount: 1 })
    expect(num(r.categories[0].total)).toBeCloseTo(900, 4)
    expect(showAmt(r, 's1')).toBeCloseTo(300, 4)
    expect(showAmt(r, 's2')).toBeCloseTo(300, 4)
    expect(showAmt(r, 's3')).toBeCloseTo(300, 4)
  })

  it('eine Show abgewählt: 900 auf 2 Shows = je 450, abgewählte Show 0, Gesamt bleibt 900', () => {
    const data: CalcDataset = { ...base, overheadExclude: [{ position_id: 'pos1', show_id: 's3' }] }
    const r = buildOverview(data, { memberCount: 1 })
    expect(showAmt(r, 's1')).toBeCloseTo(450, 4)
    expect(showAmt(r, 's2')).toBeCloseTo(450, 4)
    expect(num(r.shows.find(s => s.showId === 's3')!.ausgaben)).toBeCloseTo(0, 4)
    expect(num(r.categories[0].total)).toBeCloseTo(900, 4)
  })

  it('inaktive Show zählt nicht als Umlage-Ziel', () => {
    const data: CalcDataset = { ...base, shows: [mkShow('s1', 1), mkShow('s2', 2), { ...mkShow('s3', 3), is_active: false }] }
    const r = buildOverview(data, { memberCount: 1 })
    expect(showAmt(r, 's1')).toBeCloseTo(450, 4)
    expect(showAmt(r, 's2')).toBeCloseTo(450, 4)
  })

  it('allocation_pct 50%: nur die Hälfte umlegen (900 → 450 auf 3 Shows = je 150)', () => {
    const data: CalcDataset = { ...base, positions: [{ ...base.positions[0], allocation_pct: '50' }] }
    const r = buildOverview(data, { memberCount: 1 })
    expect(showAmt(r, 's1')).toBeCloseTo(150, 4)
    expect(showAmt(r, 's2')).toBeCloseTo(150, 4)
    expect(showAmt(r, 's3')).toBeCloseTo(150, 4)
    expect(num(r.categories[0].total)).toBeCloseTo(450, 4)
  })
})
