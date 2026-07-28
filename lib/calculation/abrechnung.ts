// Abrechnungs-Snapshot einer Show – SELF-CONTAINED (nur aufgelöste Zahlen/Texte,
// keine Verweise auf Variante/Buchung/Position). Beim Sperren eingefroren, damit
// spätere Änderungen (Variante löschen, Werte ändern) die Abrechnung NICHT ändern.

import { buildOverview } from './engine'
import type { CalcDataset, CalcShow } from './types'

export interface AbrechnungPosition { name: string; soll: string; ist: string }
export interface AbrechnungCategory { name: string; kind: 'income' | 'expense'; total: string; positions: AbrechnungPosition[] }
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
  const actualOf = (posId: string): string => {
    const a = (dataset.actuals ?? []).find(x => x.show_id === show.id && x.position_id === posId)
    return a?.amount != null && String(a.amount) !== '' ? String(a.amount) : ''
  }

  const categories: AbrechnungCategory[] = catsSorted.map(cat => {
    const posInCat = [...dataset.positions].filter(p => p.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order)
    const positions: AbrechnungPosition[] = []
    posInCat.forEach(p => {
      const soll = sr?.positionAmount.get(p.id)
      const ist = actualOf(p.id)
      const sollStr = soll ? soll.toString() : ''
      if ((sollStr && soll && !soll.isZero()) || ist) {
        positions.push({ name: p.name + (p.spec ? ' · ' + p.spec : ''), soll: sollStr || '0', ist: ist || '' })
      }
    })
    const total = sr?.categoryAmount.get(cat.id)
    return { name: cat.name, kind: cat.kind, total: (total ? total.toString() : '0'), positions }
  }).filter(c => c.positions.length > 0 || c.total !== '0')

  return {
    version: 1,
    showLabel: showLabelOf(show),
    variantName,
    memberCount,
    gageNet: sr ? sr.gageNet.toString() : '0',
    categories,
    sumEinnahmen: sr ? sr.einnahmen.toString() : '0',
    sumAusgaben: sr ? sr.ausgaben.toString() : '0',
    ergebnis: sr ? sr.ergebnis.toString() : '0',
    jeBandmitglied: sr ? sr.ergebnis.div(memberCount).toString() : '0',
  }
}
