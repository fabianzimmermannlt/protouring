// Abnahmetest – Break/Deal-Ticketschwelle.
// VS: Deal ≥ Garantie ⇔ Besucher ≥ (Break-Even + Garantie/Deal-Anteil) / Ticketpreis.

import { describe, it, expect } from 'vitest'
import { dealTicketThresholds } from './engine'

describe('dealTicketThresholds', () => {
  it('VS: Break-Even- und Deal-Schwelle (Beispiel Garantie 5000, 70%, BE 8000, Ticket 30)', () => {
    const r = dealTicketThresholds({ dealType: 'vs', guarantee: '5000', deal_share: '0.7', break_even: '8000', ticket_price: '30', capacity: 1000, vvk: 400 })
    expect(r.applicable).toBe(true)
    expect(r.breakTickets).toBe(267)   // ceil(8000/30)
    expect(r.dealTickets).toBe(505)    // ceil((8000 + 5000/0.7)/30)
    expect(r.note).toBe('ok')
  })

  it('VS ohne Break-Even (am Eintritt): Schwelle = Garantie/Anteil/Ticketpreis', () => {
    const r = dealTicketThresholds({ dealType: 'vs', guarantee: '7000', deal_share: '0.7', break_even: '0', ticket_price: '35' })
    expect(r.breakTickets).toBe(0)
    expect(r.dealTickets).toBe(286)    // ceil((7000/0.7)/35) = ceil(10000/35) = 286
  })

  it('guarantee-Typ: nicht anwendbar', () => {
    const r = dealTicketThresholds({ dealType: 'guarantee', guarantee: '5000', deal_share: '0', break_even: '0', ticket_price: '30' })
    expect(r.applicable).toBe(false)
    expect(r.note).toBe('not-deal')
    expect(r.dealTickets).toBeNull()
  })

  it('Ticketpreis 0: nicht berechenbar', () => {
    const r = dealTicketThresholds({ dealType: 'vs', guarantee: '5000', deal_share: '0.7', break_even: '8000', ticket_price: '0' })
    expect(r.applicable).toBe(false)
    expect(r.note).toBe('no-ticketprice')
  })

  it('VS mit Deal-Anteil 0 %: kann Garantie nie schlagen (nur Break-Even)', () => {
    const r = dealTicketThresholds({ dealType: 'vs', guarantee: '5000', deal_share: '0', break_even: '9000', ticket_price: '30' })
    expect(r.note).toBe('no-share')
    expect(r.dealTickets).toBeNull()
    expect(r.breakTickets).toBe(300)   // ceil(9000/30)
  })

  it('door / plus: nur Break-Even, keine Deal-schlägt-Garantie-Schwelle', () => {
    const door = dealTicketThresholds({ dealType: 'door', guarantee: '0', deal_share: '0.8', break_even: '6000', ticket_price: '25' })
    expect(door.dealTickets).toBeNull()
    expect(door.breakTickets).toBe(240) // ceil(6000/25)
    const plus = dealTicketThresholds({ dealType: 'plus', guarantee: '4000', deal_share: '0.1', break_even: '5000', ticket_price: '20' })
    expect(plus.dealTickets).toBeNull()
    expect(plus.breakTickets).toBe(250) // ceil(5000/20)
  })
})
