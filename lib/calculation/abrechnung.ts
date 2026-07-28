// Abrechnungs-Snapshot einer Show – SELF-CONTAINED (nur aufgelöste Zahlen/Texte,
// keine Verweise auf Variante/Buchung/Position). Beim Sperren eingefroren, damit
// spätere Änderungen (Variante löschen, Werte ändern) die Abrechnung NICHT ändern.

import { buildOverview, D } from './engine'
import type { CalcDataset, CalcShow } from './types'

export interface AbrechnungPosition { name: string; soll: string; ist: string }
export interface AbrechnungCategory { name: string; kind: 'income' | 'expense'; total: string; totalIst: string; positions: AbrechnungPosition[] }
export interface AbrechnungSnapshot {
  version: 1
  showLabel: string
  variantName: string
  memberCount: number
  gageNet: string
  categories: AbrechnungCategory[]
  sumEinnahmen: string
  sumAusgaben: string
  ergebnis: string
  jeBandmitglied: string
  // Ist-Seite (Gage-Ist = Gage-Soll, da nicht separat erfasst)
  sumEinnahmenIst: string
  sumAusgabenIst: string
  ergebnisIst: string
  jeBandmitgliedIst: string
  lockedAt?: string | null
}

const showLabelOf = (s: CalcShow): string =>
  [s.city || '(ohne Stadt)', s.show_date || '', s.venue || ''].filter(Boolean).join(' · ')

/** Baut den Abrechnungs-Snapshot einer Show für die gewählte Variante. */
export function buildAbrechnung(dataset: CalcDataset, show: CalcShow, variantId: string | null): AbrechnungSnapshot {
  const memberCount = dataset.project.member_count || 1
  const ov = buildOverview(dataset, { variantId, variantByShow: { [show.id]: variantId }, memberCount })
  const sr = ov.shows.find(s => s.showId === show.id)
  const variantName = dataset.variants.find(v => v.id === variantId)?.name ?? '—'

  const catsSorted = [...dataset.categories].sort((a, b) => a.sort_order - b.sort_order)
  // Volles Ist einer Position = Ist-Betrag + Ist-Reise (km×€/km + Fixpreis).
  const nz = (v: unknown) => v != null && String(v) !== ''
  const actualOf = (posId: string): string => {
    const a = (dataset.actuals ?? []).find(x => x.show_id === show.id && x.position_id === posId)
    if (!a) return ''
    let r = D(0); let has = false
    if (nz(a.amount)) { r = r.plus(D(a.amount)); has = true }
    if (nz(a.travel_km) && nz(a.travel_rate)) { r = r.plus(D(a.travel_km).times(D(a.travel_rate))); has = true }
    if (nz(a.travel_fix)) { r = r.plus(D(a.travel_fix)); has = true }
    return has ? r.toString() : ''
  }

  const categories: AbrechnungCategory[] = catsSorted.map(cat => {
    const posInCat = [...dataset.positions].filter(p => p.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order)
    const positions: AbrechnungPosition[] = []
    let istSum = D(0)
    posInCat.forEach(p => {
      const soll = sr?.positionAmount.get(p.id)
      const ist = actualOf(p.id)
      if (ist) istSum = istSum.plus(D(ist))
      const sollStr = soll ? soll.toString() : ''
      if ((sollStr && soll && !soll.isZero()) || ist) {
        positions.push({ name: p.name + (p.spec ? ' · ' + p.spec : ''), soll: sollStr || '0', ist: ist || '' })
      }
    })
    const total = sr?.categoryAmount.get(cat.id)
    return { name: cat.name, kind: cat.kind, total: (total ? total.toString() : '0'), totalIst: istSum.toString(), positions }
  }).filter(c => c.positions.length > 0 || c.total !== '0')

  const gage = sr ? sr.gageNet : D(0)
  const sumIncomeIst = categories.filter(c => c.kind === 'income').reduce((a, c) => a.plus(D(c.totalIst)), D(0))
  const sumExpenseIst = categories.filter(c => c.kind === 'expense').reduce((a, c) => a.plus(D(c.totalIst)), D(0))
  const sumEinnahmenIst = gage.plus(sumIncomeIst)   // Gage-Ist = Gage-Soll (nicht separat erfasst)
  const sumAusgabenIst = sumExpenseIst
  const ergebnisIst = sumEinnahmenIst.minus(sumAusgabenIst)

  return {
    version: 1,
    showLabel: showLabelOf(show),
    variantName,
    memberCount,
    gageNet: gage.toString(),
    categories,
    sumEinnahmen: sr ? sr.einnahmen.toString() : '0',
    sumAusgaben: sr ? sr.ausgaben.toString() : '0',
    ergebnis: sr ? sr.ergebnis.toString() : '0',
    jeBandmitglied: sr ? sr.ergebnis.div(memberCount).toString() : '0',
    sumEinnahmenIst: sumEinnahmenIst.toString(),
    sumAusgabenIst: sumAusgabenIst.toString(),
    ergebnisIst: ergebnisIst.toString(),
    jeBandmitgliedIst: ergebnisIst.div(memberCount).toString(),
  }
}
