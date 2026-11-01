// Validierung des Abrechnungs-Rechenkerns gegen eine echte Konzertabrechnung (Osnabrück, Q4/2026).
import { describe, it, expect } from 'vitest'
import { computeSettlement } from './settlement'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 2)

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

describe('computeSettlement – 2. Schwelle (Wiesbaden-artig)', () => {
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
