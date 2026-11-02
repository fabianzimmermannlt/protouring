// Validierung des Abrechnungs-Rechenkerns gegen eine echte Konzertabrechnung (Osnabrück, Q4/2026).
import { describe, it, expect } from 'vitest'
import { computeSettlement, parseNum } from './settlement'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 2)

describe('parseNum – deutsche & kanonische Schreibweise', () => {
  it('erkennt Tausender-Punkt + Dezimal-Komma', () => {
    close(parseNum('1.600,50'), 1600.5)
    close(parseNum('1.600.000'), 1600000)
    close(parseNum('44859,81'), 44859.81)
  })
  it('erkennt kanonische (toFixed) und US-Schreibweise', () => {
    close(parseNum('32000.00'), 32000)
    close(parseNum('1,600.50'), 1600.5)
  })
  it('liefert bei leer/ungültig 0', () => {
    expect(parseNum('')).toBe(0)
    expect(parseNum(null)).toBe(0)
    expect(parseNum('abc')).toBe(0)
  })
  it('wird in der Abrechnung genutzt (Umsatz mit Tausender-Punkt)', () => {
    const r = computeSettlement({
      channels: [{ name: 'X', art: 'vvk', money_with: 'promoter', tickets: '1.000', revenue: '45.000,00' }],
      ticketVat: '7', guarantee: '0', dealShare: '100', dealBase: 'gross',
    } as Parameters<typeof computeSettlement>[0])
    close(r.ticketGross, 45000)
  })
})

describe('computeSettlement – echte KA Osnabrück', () => {
  const r = computeSettlement({
    channels: [
      { name: 'Eventim', art: 'vvk', money_with: 'promoter', tickets: '675', revenue: '30375,00' },
      { name: 'Bandshop', art: 'ownshop', money_with: 'band', tickets: '200', revenue: '9000,00' },
    ],
    costs: [{ label: 'Nightliner Buyout', net: '750', vat: '19' }],
    ticketVat: '7', feePerTicket: '3,38', feeVat: '7', feeBandSplitPct: '60', artistVat: '7',
    dealBase: 'gross', guarantee: '3000', pct1: '60',
    ticketingPayoutGross: '9876', deductOwnShop: false,
  })

  it('Ticketeinnahmen', () => { close(r.ticketGross, 39375); close(r.ticketNet, 36799.07); close(r.totalTickets, 875) })
  it('Gebühr/Refundierung netto + Band-Split', () => { close(r.feeNet, 2764.02); close(r.bandFeeShareNet, 1658.41) })
  it('Deal-Anteil (60% vom Netto-Ticketumsatz, vs Garantie)', () => { close(r.dealShareNet, 22079.44) })
  it('Anteil gesamt netto', () => { close(r.artistShareNet, 23737.85) })
  it('Rechnungsbetrag netto/USt/brutto', () => { close(r.rechnungNet, 24487.85); close(r.rechnungVat, 1804.15); close(r.rechnungGross, 26292.00) })
  it('offener Betrag nach Ticketing-Payout', () => { close(r.payableGross, 26292.00 - 9876) })
})

// Refundierung PRO Kanal: Abendkasse hat KEINE Systemgebühr → über 956 statt 961 Tickets.
describe('computeSettlement – echte KA Wiesbaden (Refundierung ohne Abendkasse)', () => {
  const r = computeSettlement({
    channels: [
      { name: 'Eventim', art: 'vvk', money_with: 'promoter', tickets: '578', revenue: '26010,00' },
      { name: 'Artistshop', art: 'ownshop', money_with: 'band', tickets: '119', revenue: '5355,00' },
      { name: 'Reservix', art: 'vvk', money_with: 'promoter', tickets: '259', revenue: '11655,00' },
      { name: 'Box Office', art: 'boxoffice', money_with: 'promoter', tickets: '5', revenue: '300,00' },
    ],
    costs: [{ label: 'Nightliner Buyout', net: '1000', vat: '19' }],
    ticketVat: '7', feePerTicket: '3,38', feeVat: '7', feeBandSplitPct: '50', artistVat: '7',
    dealBase: 'gross', guarantee: '0',
    tiers: [{ from: 0, pct: 50 }, { from: 44859.81, pct: 55 }],
    ticketingPayoutGross: '6013,07', deductOwnShop: false,
  })

  // Die KA rundet pro Schritt auf Cent, der Rechenkern rechnet durchgängig → bis zu 1 Cent Drift.
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.02)
  it('Ticketeinnahmen brutto/netto + Stück', () => { close(r.ticketGross, 43320); close(r.ticketNet, 40485.98); close(r.totalTickets, 961) })
  it('Refundierung brutto über 956 Tickets (Abendkasse 0)', () => { close(r.feeTotalGross, 3231.28); near(r.feeNet, 3019.89); near(r.bandFeeShareNet, 1509.95) })
  it('Deal-Anteil (50% vom Netto-Ticketumsatz, unter 2. Schwelle)', () => { near(r.dealShareNet, 20242.99) })
  it('Anteil gesamt netto', () => { near(r.artistShareNet, 21752.94) })
  it('Rechnungsbetrag netto/USt/brutto', () => { near(r.rechnungNet, 22752.94); near(r.rechnungVat, 1712.71); near(r.rechnungGross, 24465.65) })
  it('Restbetrag an Band nach Ticketing-Payout', () => { near(r.payableGross, 18452.58) })
})

describe('computeSettlement – beliebig viele Stufen (progressiv)', () => {
  it('3 Stufen marginal: 50 % bis 20k, 60 % bis 40k, 70 % darüber', () => {
    const r = computeSettlement({
      channels: [{ revenue: '53500', money_with: 'promoter' }], costs: [],
      ticketVat: '7', dealBase: 'gross', guarantee: '0', artistVat: '7',
      tiers: [{ from: '0', pct: '50' }, { from: '20000', pct: '60' }, { from: '40000', pct: '70' }],
    })
    const net = 53500 / 1.07 // 50000
    const expected = 20000 * 0.5 + 20000 * 0.6 + (net - 40000) * 0.7 // 10000+12000+7000 = 29000
    close(r.dealShareNet, expected)
  })
  it('Reihenfolge der Stufen egal (wird sortiert)', () => {
    const r = computeSettlement({
      channels: [{ revenue: '53500', money_with: 'promoter' }], costs: [], ticketVat: '7', dealBase: 'gross', guarantee: '0', artistVat: '7',
      tiers: [{ from: '40000', pct: '70' }, { from: '0', pct: '50' }, { from: '20000', pct: '60' }],
    })
    close(r.dealShareNet, 29000)
  })
})

describe('computeSettlement – 2. Schwelle (Wiesbaden-artig, Fallback pct1/threshold2/pct2)', () => {
  it('pct1 bis Schwelle, pct2 darüber', () => {
    const r = computeSettlement({
      channels: [{ revenue: '53500', tickets: '1000', money_with: 'promoter' }],
      costs: [], ticketVat: '7', dealBase: 'gross', guarantee: '0',
      pct1: '50', threshold2: '44859,81', pct2: '55', artistVat: '7',
    })
    const net = 53500 / 1.07 // 50000
    const expected = 44859.81 * 0.5 + (net - 44859.81) * 0.55
    close(r.dealShareNet, expected)
  })
})

// Zusammensetzbares Deal-Modell: Verhältnis (vs/plus), Basis (ab Break-Even), Stufen-Basis (Ticketzahl).
describe('computeSettlement – Deal-Modell-Bausteine', () => {
  const base = { costs: [], ticketVat: '7', artistVat: '7' as const }
  const net = 53500 / 1.07 // 50000

  it('Fixgage plus Beteiligung (addiert)', () => {
    const r = computeSettlement({
      ...base, channels: [{ revenue: '53500', money_with: 'promoter' }],
      dealBase: 'gross', dealType: 'plus', guarantee: '3000', tiers: [{ from: 0, pct: 50 }],
    })
    close(r.dealShareNet, 3000 + net * 0.5) // 28000
  })

  it('Fixgage gegen Beteiligung – das Höhere gewinnt (Garantie)', () => {
    const r = computeSettlement({
      ...base, channels: [{ revenue: '53500', money_with: 'promoter' }],
      dealBase: 'gross', dealType: 'vs', guarantee: '30000', tiers: [{ from: 0, pct: 50 }],
    })
    close(r.dealShareNet, 30000) // max(30000, 25000)
  })

  it('Stufen auf Ticketzahl (Schwelle in Stück → Umsatz umgerechnet)', () => {
    const r = computeSettlement({
      ...base, channels: [{ revenue: '53500', tickets: '1000', money_with: 'promoter' }],
      dealBase: 'gross', dealType: 'vs', guarantee: '0', tierBasis: 'tickets',
      tiers: [{ from: 0, pct: 50 }, { from: 500, pct: 60 }],
    })
    // Ø 50 €/Ticket → Schwelle 500 Tickets = 25.000 €; 25000*0,5 + 25000*0,6
    close(r.dealShareNet, 25000 * 0.5 + 25000 * 0.6) // 27500
  })

  it('Nur Beteiligung ab Break-Even (netprofit)', () => {
    const r = computeSettlement({
      ...base, channels: [{ revenue: '53500', money_with: 'promoter' }],
      dealBase: 'netprofit', dealType: 'vs', guarantee: '0', promoterCosts: '30000',
      tiers: [{ from: 0, pct: 50 }],
    })
    close(r.dealShareNet, (net - 30000) * 0.5) // 10000
  })
})
