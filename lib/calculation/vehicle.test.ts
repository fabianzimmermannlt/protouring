// Abnahmetest – Fahrzeug-Position: Betrag = Miete + max(0, km − inkl.) × €/Mehr-km
// (Sprit läuft als eigene Zeile, NICHT hier).

import { describe, it, expect } from 'vitest'
import { entryAmount, buildOverview } from './engine'
import type { CalcEntry, CalcProject, CalcDataset, CalcShow } from './types'

const project: CalcProject = { id: 'p', name: 'T', fuel_consumption: '15', fuel_price: '2.0', scenario_factor: '1', member_count: 1, default_variant_id: null }

describe('Fahrzeug-Formel (kind=vehicle)', () => {
  it('Miete + Mehr-km × Preis, KEIN Sprit', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'vehicle', rental_price: '450', distance_km: '600', included_km: '500', price_extra_km: '0.35' }
    // 450 + max(0,100)*0.35 = 485 – ohne Sprit (sonst käme 600/100*15*2=180 dazu)
    expect(entryAmount(e, project).toNumber()).toBe(485)
  })

  it('nur Miete, wenn km innerhalb inkl.', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'vehicle', rental_price: '450', distance_km: '400', included_km: '500', price_extra_km: '0.35' }
    expect(entryAmount(e, project).toNumber()).toBe(450)
  })

  it('fließt in Show-Ausgaben ein', () => {
    const show: CalcShow = { id: 's1', sort_order: 1, guarantee: '0', deal_share: '0', break_even: '0', commission: '0', deal_type: 'guarantee', is_active: true, capacity: 0, ticket_price: '0' }
    const ds: CalcDataset = {
      project, variants: [], shows: [show],
      categories: [{ id: 'c', name: 'TRANSPORT & LOGISTIK', kind: 'expense', sort_order: 1 }],
      positions: [{ id: 'x', category_id: 'c', name: 'Van', pos_type: 'vehicle', sort_order: 1 }],
      entries: [{ id: 'e', show_id: 's1', position_id: 'x', variant_id: null, kind: 'vehicle', rental_price: '300', distance_km: '700', included_km: '500', price_extra_km: '0.4' }],
    }
    const r = buildOverview(ds, { memberCount: 1 })
    // 300 + max(0,200)*0.4 = 380
    expect(r.sumAusgaben.toNumber()).toBe(380)
  })
})
