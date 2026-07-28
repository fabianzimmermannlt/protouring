// Abnahmetest – Reisekosten (kind='travel'): km × €/km PLUS optionaler Fixpreis (Zugticket).

import { describe, it, expect } from 'vitest'
import { entryAmount } from './engine'
import type { CalcEntry, CalcProject } from './types'

const project: CalcProject = { id: 'p', name: 'T', fuel_consumption: '0', fuel_price: '0', scenario_factor: '1', member_count: 1, default_variant_id: null }

describe('Reisekosten (kind=travel)', () => {
  it('km × €/km ohne Fix', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'travel', quantity: '200', unit_price: '0.3' }
    expect(entryAmount(e, project).toNumber()).toBe(60)
  })
  it('nur Fixpreis (Zug), keine km', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'travel', amount: '49' }
    expect(entryAmount(e, project).toNumber()).toBe(49)
  })
  it('km × €/km PLUS Fix', () => {
    const e: CalcEntry = { id: 'e', position_id: 'x', kind: 'travel', quantity: '200', unit_price: '0.3', amount: '49' }
    expect(entryAmount(e, project).toNumber()).toBe(109)
  })
})
