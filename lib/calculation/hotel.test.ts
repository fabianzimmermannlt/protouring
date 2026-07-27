// Abnahmetest – Hotel-Position: Betrag = Zimmer × Nächte × €/Nacht (kind='hotel').

import { describe, it, expect } from 'vitest'
import { entryAmount, buildOverview } from './engine'
import type { CalcEntry, CalcProject, CalcDataset, CalcShow } from './types'

const project: CalcProject = { id: 'p', name: 'T', fuel_consumption: '0', fuel_price: '0', scenario_factor: '1', member_count: 1, default_variant_id: null }

describe('Hotel-Formel', () => {
  it('Zimmer × Nächte × €/Nacht', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'hotel', quantity: '2', nights: '3', unit_price: '100' }
    expect(entryAmount(e, project).toNumber()).toBe(600)
  })

  it('leere Faktoren → 0 (kein NaN)', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'hotel', quantity: '', nights: '3', unit_price: '100' }
    expect(entryAmount(e, project).toNumber()).toBe(0)
  })

  it('fließt in die Show-Ausgaben ein', () => {
    const show: CalcShow = { id: 's1', sort_order: 1, guarantee: '0', deal_share: '0', break_even: '0', commission: '0', deal_type: 'guarantee', is_active: true, capacity: 0, ticket_price: '0' }
    const ds: CalcDataset = {
      project, variants: [], shows: [show],
      categories: [{ id: 'c', name: 'UNTERKUNFT', kind: 'expense', sort_order: 1 }],
      positions: [{ id: 'x', category_id: 'c', name: 'Hotel', pos_type: 'hotel', sort_order: 1 }],
      entries: [{ id: 'e', show_id: 's1', position_id: 'x', variant_id: null, kind: 'hotel', quantity: '4', nights: '2', unit_price: '80' }],
    }
    const r = buildOverview(ds, { memberCount: 1 })
    expect(r.sumAusgaben.toNumber()).toBe(640)
  })
})
