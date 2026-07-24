// Abnahmetests – docs/ABNAHMETESTS.md ist die Definition von "es rechnet richtig".
// Grundlage: db/seed.json unverändert, Szenario-Faktor 1, alle Shows aktiv,
// 5 Bandmitglieder. Vergleich auf vier Nachkommastellen.

import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import seedRaw from './spec/data/seed.json'
import { buildOverview, showGage, entryAmount, D } from './engine'
import type { CalcDataset, CalcProject, CalcShow } from './types'

const seed = seedRaw as unknown as CalcDataset & { band: unknown }
const dataset: CalcDataset = {
  project: seed.project,
  variants: seed.variants,
  shows: seed.shows,
  categories: seed.categories,
  positions: seed.positions,
  entries: seed.entries,
}

const MIT_NL = '12bed137-ea17-5b36-967f-992d2186a244'
const OHNE_NL = '25abaf9d-57bb-5629-8a2e-16526b6296db'

/** Vergleich auf 4 Nachkommastellen (Sollwerte haben ≤4). */
const num = (d: Decimal) => d.toDecimalPlaces(4).toNumber()
const clone = (d: CalcDataset): CalcDataset => JSON.parse(JSON.stringify(d))

function catTotal(r: ReturnType<typeof buildOverview>, name: string): Decimal {
  const c = r.categories.find(c => c.name === name)
  if (!c) throw new Error(`Bereich fehlt: ${name}`)
  return c.total
}
function show(r: ReturnType<typeof buildOverview>, key: string) {
  const s = r.shows.find(s => s.legacyKey === key)
  if (!s) throw new Error(`Show fehlt: ${key}`)
  return s
}

describe('Variante "mit NL"', () => {
  const r = buildOverview(dataset, { variantId: MIT_NL, memberCount: 5 })

  it('Kennzahlen', () => {
    expect(num(r.sumEinnahmen)).toBeCloseTo(122400.0, 4)
    expect(num(r.sumAusgaben)).toBeCloseTo(98960.22, 4)
    expect(num(r.ergebnis)).toBeCloseTo(23439.78, 4)
    expect(num(r.jeBandmitglied)).toBeCloseTo(4687.956, 4)
  })

  it('Bereichssummen', () => {
    expect(num(catTotal(r, 'BUYOUTS & SPONSORING'))).toBeCloseTo(2000.0, 4)
    expect(num(catTotal(r, 'TOURSUPPORT'))).toBeCloseTo(0.0, 4)
    expect(num(catTotal(r, 'PERSONAL'))).toBeCloseTo(25050.0, 4)
    expect(num(catTotal(r, 'TRANSPORT & LOGISTIK'))).toBeCloseTo(33530.22, 4)
    expect(num(catTotal(r, 'UNTERKUNFT & VERPFLEGUNG'))).toBeCloseTo(10880.0, 4)
    expect(num(catTotal(r, 'TECHNIK & PRODUKTION'))).toBeCloseTo(27700.0, 4)
    expect(num(catTotal(r, 'SONSTIGE KOSTEN'))).toBeCloseTo(1800.0, 4)
    expect(num(catTotal(r, 'ANSCHAFFUNGEN'))).toBeCloseTo(0.0, 4)
  })

  it('Je Show (Gage netto, Ausgaben, Ergebnis)', () => {
    const soll: Record<string, [number, number, number]> = {
      S01: [13600.0, 8079.82, 5520.18],
      S02: [12750.0, 13369.32, -619.32],
      S03: [18700.0, 11654.82, 7045.18],
      S04: [12750.0, 11492.935, 1257.065],
      S05: [17850.0, 11359.485, 7490.515],
      S06: [12750.0, 13387.83, -637.83],
      S07: [7500.0, 10767.73, -3267.73],
      S08: [7500.0, 8655.68, -1155.68],
      S09: [17000.0, 10192.6, 7807.4],
    }
    for (const [key, [gage, aus, erg]] of Object.entries(soll)) {
      const s = show(r, key)
      expect(num(s.gageNet), `${key} Gage`).toBeCloseTo(gage, 4)
      expect(num(s.ausgaben), `${key} Ausgaben`).toBeCloseTo(aus, 4)
      expect(num(s.ergebnis), `${key} Ergebnis`).toBeCloseTo(erg, 4)
    }
  })

  it('Prozentanteile (Regel 6)', () => {
    const pE = (v: Decimal) => num(v.div(r.sumEinnahmen).times(100))
    const pA = (v: Decimal) => num(v.div(r.sumAusgaben).times(100))
    expect(pE(r.gageTotal)).toBeCloseTo(98.366, 4)
    expect(pE(catTotal(r, 'BUYOUTS & SPONSORING'))).toBeCloseTo(1.634, 4)
    expect(pA(catTotal(r, 'PERSONAL'))).toBeCloseTo(25.3132, 4)
    expect(pA(catTotal(r, 'TRANSPORT & LOGISTIK'))).toBeCloseTo(33.8825, 4)
    expect(pA(catTotal(r, 'UNTERKUNFT & VERPFLEGUNG'))).toBeCloseTo(10.9943, 4)
    expect(pA(catTotal(r, 'TECHNIK & PRODUKTION'))).toBeCloseTo(27.991, 4)
    expect(pA(catTotal(r, 'SONSTIGE KOSTEN'))).toBeCloseTo(1.8189, 4)
  })
})

describe('Variante "ohne NL"', () => {
  const r = buildOverview(dataset, { variantId: OHNE_NL, memberCount: 5 })

  it('Kennzahlen', () => {
    expect(num(r.sumEinnahmen)).toBeCloseTo(122400.0, 4)
    expect(num(r.sumAusgaben)).toBeCloseTo(92092.48, 4)
    expect(num(r.ergebnis)).toBeCloseTo(30307.52, 4)
    expect(num(r.jeBandmitglied)).toBeCloseTo(6061.504, 4)
  })

  it('Bereichssummen', () => {
    expect(num(catTotal(r, 'BUYOUTS & SPONSORING'))).toBeCloseTo(2000.0, 4)
    expect(num(catTotal(r, 'PERSONAL'))).toBeCloseTo(25050.0, 4)
    expect(num(catTotal(r, 'TRANSPORT & LOGISTIK'))).toBeCloseTo(20962.48, 4)
    expect(num(catTotal(r, 'UNTERKUNFT & VERPFLEGUNG'))).toBeCloseTo(16280.0, 4)
    expect(num(catTotal(r, 'TECHNIK & PRODUKTION'))).toBeCloseTo(28000.0, 4)
    expect(num(catTotal(r, 'SONSTIGE KOSTEN'))).toBeCloseTo(1800.0, 4)
  })
})

// ── Regel 2 – deal_type (ProTouring-Erweiterung) ─────────────────────────────
describe('Regel 2 – deal_type', () => {
  const proj = { scenario_factor: 1, fuel_consumption: 15, fuel_price: 2.6, member_count: 5 } as unknown as CalcProject
  const base = {
    id: 'x', sort_order: 1, guarantee: 10000, deal_share: 0.7,
    break_even: 20000, commission: 0.1, is_active: true,
    capacity: 1000, ticket_price: 40,
  } as unknown as CalcShow
  // Überschuss bei factor 1 = 1000*40 - 20000 = 20000; *0.7 = 14000; netto *0.9

  it('guarantee → nur Garantie netto', () => {
    expect(num(showGage({ ...base, deal_type: 'guarantee' }, proj))).toBeCloseTo(9000, 4) // 10000*0.9
  })
  it('vs → max(Garantie, Deal) netto', () => {
    // Deal netto = 14000*0.9 = 12600 > 9000
    expect(num(showGage({ ...base, deal_type: 'vs' }, proj))).toBeCloseTo(12600, 4)
    // Unter Break Even → Deal 0/neg → Garantie greift
    expect(num(showGage({ ...base, deal_type: 'vs', break_even: 60000 }, proj))).toBeCloseTo(9000, 4)
  })
  it('plus → Garantie + Beteiligung, Überschuss nie negativ', () => {
    // (10000 + 14000) * 0.9 = 21600
    expect(num(showGage({ ...base, deal_type: 'plus' }, proj))).toBeCloseTo(21600, 4)
    // Unter Break Even → nur Garantie netto (kein Abzug)
    expect(num(showGage({ ...base, deal_type: 'plus', break_even: 60000 }, proj))).toBeCloseTo(9000, 4)
  })
  it('door → nur Beteiligung', () => {
    expect(num(showGage({ ...base, deal_type: 'door' }, proj))).toBeCloseTo(12600, 4)
    expect(num(showGage({ ...base, deal_type: 'door', break_even: 60000 }, proj))).toBeCloseTo(0, 4)
  })
  it('break_even=0 → Beteiligung am ganzen Eintritt', () => {
    // Überschuss = 40000; door = 40000*0.7*0.9 = 25200
    expect(num(showGage({ ...base, deal_type: 'door', break_even: 0 }, proj))).toBeCloseTo(25200, 4)
  })
  it('Szenario-Faktor wirkt nur auf den Deal-Zweig', () => {
    // factor 0.8: Überschuss = 1000*40*0.8 - 20000 = 12000; vs: max(9000, 12000*0.7*0.9=7560)=9000
    expect(num(showGage({ ...base, deal_type: 'vs' }, proj, 0.8))).toBeCloseTo(9000, 4)
  })
})

// ── Regel 1 – Betrag einer Buchung ───────────────────────────────────────────
describe('Regel 1 – entryAmount', () => {
  const proj = { fuel_consumption: 15, fuel_price: 2.6 } as unknown as CalcProject
  it('Mengenrechnung', () => {
    expect(num(entryAmount({ id: 'a', position_id: 'p', quantity: 3, unit_price: 250 } as any, proj))).toBeCloseTo(750, 4)
  })
  it('Fahrzeugrechnung mit Mehrkilometern', () => {
    // rental 500 + max(0,1200-1000)*0.5=100 + 1200/100*15*2.6=468 = 1068
    const e = { id: 'b', position_id: 'p', distance_km: 1200, rental_price: 500, included_km: 1000, price_extra_km: 0.5 } as any
    expect(num(entryAmount(e, proj))).toBeCloseTo(1068, 4)
  })
  it('Fahrzeugrechnung unter Inklusiv-km → kein negativer Mehrkm-Abzug (max(0,…))', () => {
    // rental 500 + max(0,800-1000)*0.5=0 + 800/100*15*2.6=312 = 812
    const e = { id: 'c', position_id: 'p', distance_km: 800, rental_price: 500, included_km: 1000, price_extra_km: 0.5 } as any
    expect(num(entryAmount(e, proj))).toBeCloseTo(812, 4)
  })
  it('Nightliner-Pauschale: nur rental_price, keine Strecke', () => {
    expect(num(entryAmount({ id: 'd', position_id: 'p', rental_price: 1500 } as any, proj))).toBeCloseTo(1500, 4)
  })
})

// ── Struktur-Regressionstests (ABNAHMETESTS.md) ──────────────────────────────
describe('Struktur-Regressionstests', () => {
  const baseline = buildOverview(dataset, { variantId: MIT_NL, memberCount: 5 })

  it('Show deaktivieren: übrige Shows unverändert, Gesamt sinkt exakt um deren Werte', () => {
    const s02 = show(baseline, 'S02')
    const d = clone(dataset)
    d.shows.find(s => s.legacy_key === 'S02')!.is_active = false
    const r = buildOverview(d, { variantId: MIT_NL, memberCount: 5 })

    for (const key of ['S01', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09']) {
      expect(num(show(r, key).ausgaben), `${key} Ausgaben unverändert`).toBeCloseTo(num(show(baseline, key).ausgaben), 4)
      expect(num(show(r, key).gageNet), `${key} Gage unverändert`).toBeCloseTo(num(show(baseline, key).gageNet), 4)
    }
    expect(num(r.sumEinnahmen)).toBeCloseTo(num(baseline.sumEinnahmen.minus(s02.einnahmen)), 4)
    expect(num(r.sumAusgaben)).toBeCloseTo(num(baseline.sumAusgaben.minus(s02.ausgaben)), 4)
    expect(r.activeShowCount).toBe(8)
  })

  it('Position umbenennen: keine Zahl ändert sich', () => {
    const d = clone(dataset)
    d.positions[0].name = 'Völlig anderer Name'
    const r = buildOverview(d, { variantId: MIT_NL, memberCount: 5 })
    expect(num(r.sumAusgaben)).toBeCloseTo(num(baseline.sumAusgaben), 4)
    expect(num(r.ergebnis)).toBeCloseTo(num(baseline.ergebnis), 4)
  })

  it('Neue Position + Buchung: Bereichssumme und Gesamt steigen um genau den Betrag', () => {
    const d = clone(dataset)
    const cat = d.categories.find(c => c.name === 'SONSTIGE KOSTEN')!
    d.positions.push({ id: 'newpos', category_id: cat.id, name: 'Neuer Posten', sort_order: 999 })
    const anyShow = d.shows.find(s => s.legacy_key === 'S01')!
    d.entries.push({ id: 'newentry', show_id: anyShow.id, position_id: 'newpos', variant_id: null, quantity: 1, unit_price: 500 } as any)
    const r = buildOverview(d, { variantId: MIT_NL, memberCount: 5 })
    expect(num(catTotal(r, 'SONSTIGE KOSTEN'))).toBeCloseTo(num(catTotal(baseline, 'SONSTIGE KOSTEN').plus(500)), 4)
    expect(num(r.sumAusgaben)).toBeCloseTo(num(baseline.sumAusgaben.plus(500)), 4)
  })

  it('Position ohne Buchungen: erscheint mit 0, verändert keine Summe', () => {
    const d = clone(dataset)
    const cat = d.categories.find(c => c.name === 'SONSTIGE KOSTEN')!
    d.positions.push({ id: 'leerpos', category_id: cat.id, name: 'Leerer Posten', sort_order: 998 })
    const r = buildOverview(d, { variantId: MIT_NL, memberCount: 5 })
    expect(num(r.sumAusgaben)).toBeCloseTo(num(baseline.sumAusgaben), 4)
  })

  it('Szenario-Faktor 0,8: reine Garantieshows ändern sich nicht', () => {
    const r = buildOverview(dataset, { variantId: MIT_NL, memberCount: 5, scenarioFactor: 0.8 })
    expect(num(r.sumEinnahmen)).toBeCloseTo(num(baseline.sumEinnahmen), 4)
    expect(num(r.sumAusgaben)).toBeCloseTo(num(baseline.sumAusgaben), 4)
  })
})

// ── Fixkosten (synthetisch – Seed hat keine) ─────────────────────────────────
describe('Regel 4 – Fixkostenumlage', () => {
  function fixture(nShows: number): CalcDataset {
    const project = { id: 'p', name: 'Fix', fuel_consumption: 15, fuel_price: 2.6, scenario_factor: 1, member_count: 5, default_variant_id: null } as CalcProject
    const shows: CalcShow[] = Array.from({ length: nShows }, (_, i) => ({
      id: `s${i}`, sort_order: i + 1, guarantee: 0, deal_share: 0, break_even: 0, commission: 0, is_active: true,
    }))
    return {
      project, variants: [], shows,
      categories: [{ id: 'c', name: 'SONSTIGE KOSTEN', kind: 'expense', sort_order: 1 }],
      positions: [{ id: 'pos', category_id: 'c', name: 'Fixkosten', sort_order: 1 }],
      entries: [{ id: 'fix', show_id: null, position_id: 'pos', variant_id: null, quantity: 1, unit_price: 9000 } as any],
    }
  }

  it('9.000 auf 9 aktive Shows → 1.000 je Show, Gesamtwirkung 9.000', () => {
    const r = buildOverview(fixture(9), {})
    expect(num(r.sumAusgaben)).toBeCloseTo(9000, 4)
    for (const s of r.shows) expect(num(s.ausgaben)).toBeCloseTo(1000, 4)
  })

  it('Eine Show deaktiviert → Umlage auf 8, Gesamtwirkung bleibt 9.000', () => {
    const d = fixture(9)
    d.shows[0].is_active = false
    const r = buildOverview(d, {})
    expect(r.activeShowCount).toBe(8)
    expect(num(r.sumAusgaben)).toBeCloseTo(9000, 4)
    for (const s of r.shows) expect(num(s.ausgaben)).toBeCloseTo(1125, 4)
  })
})
