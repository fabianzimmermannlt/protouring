'use client'

// Tour-/Festival-Kalkulation – Übersicht (Phase 2, lesend).
// Rendert die Matrix aus dem versionierten Seed über den geprüften Rechenkern
// (lib/calculation/engine). Noch KEINE DB-Anbindung – die Zahlen sind die
// Abnahmetest-Sollwerte. Siehe DECISIONS ADR-105 / ADDONS.

import { useMemo, useState, type CSSProperties } from 'react'
import Decimal from 'decimal.js'
import seedRaw from '@/lib/calculation/spec/data/seed.json'
import { buildOverview, percentOf } from '@/lib/calculation/engine'
import type { CalcDataset } from '@/lib/calculation/types'
import { formatMoney, formatPercent, formatDate } from '@/lib/calculation/format'

const seed = seedRaw as unknown as CalcDataset & { band: unknown }
const dataset: CalcDataset = {
  project: seed.project, variants: seed.variants, shows: seed.shows,
  categories: seed.categories, positions: seed.positions, entries: seed.entries,
}

type RowType = 'section' | 'line' | 'catsum' | 'grand' | 'member'
interface Row {
  type: RowType
  label: string
  perShow?: Decimal[]
  total?: Decimal
  percent?: Decimal | null
}

const ZERO = new Decimal(0)

export default function CalculationModule() {
  const variantsSorted = useMemo(
    () => [...dataset.variants].sort((a, b) => a.sort_order - b.sort_order), [])
  const [variantId, setVariantId] = useState<string>(
    dataset.project.default_variant_id ?? variantsSorted[0]?.id ?? '')
  const [scenario, setScenario] = useState<number>(Number(dataset.project.scenario_factor) || 1)
  const [hideZero, setHideZero] = useState(false)

  const overview = useMemo(
    () => buildOverview(dataset, { variantId, scenarioFactor: scenario, memberCount: dataset.project.member_count }),
    [variantId, scenario])

  const shows = overview.shows
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const sumE = overview.sumEinnahmen
    const sumA = overview.sumAusgaben
    const posByCat = (catId: string) =>
      dataset.positions.filter(p => p.category_id === catId).sort((a, b) => a.sort_order - b.sort_order)
    const catTotal = (catId: string) => overview.categories.find(c => c.categoryId === catId)?.total ?? ZERO

    const pushCategory = (catId: string, kind: 'income' | 'expense', name: string) => {
      const basis = kind === 'income' ? sumE : sumA
      for (const pos of posByCat(catId)) {
        const perShow = shows.map(s => s.positionAmount.get(pos.id) ?? ZERO)
        const total = perShow.reduce((a, b) => a.plus(b), ZERO)
        if (hideZero && total.isZero()) continue
        out.push({ type: 'line', label: pos.name, perShow, total, percent: percentOf(total, basis) })
      }
      const perShow = shows.map(s => s.categoryAmount.get(catId) ?? ZERO)
      out.push({ type: 'catsum', label: `Gesamt ${name}`, perShow, total: catTotal(catId), percent: percentOf(catTotal(catId), basis) })
    }

    // EINNAHMEN
    out.push({ type: 'section', label: 'EINNAHMEN' })
    out.push({ type: 'line', label: 'Gage (abzgl. Provision)', perShow: shows.map(s => s.gageNet), total: overview.gageTotal, percent: null })
    out.push({ type: 'catsum', label: 'Gesamt GAGEN', perShow: shows.map(s => s.gageNet), total: overview.gageTotal, percent: percentOf(overview.gageTotal, sumE) })
    overview.categories.filter(c => c.kind === 'income').forEach(c => pushCategory(c.categoryId, 'income', c.name))
    out.push({ type: 'grand', label: 'SUMME EINNAHMEN', perShow: shows.map(s => s.einnahmen), total: sumE, percent: percentOf(sumE, sumE) })

    // AUSGABEN
    out.push({ type: 'section', label: 'AUSGABEN' })
    overview.categories.filter(c => c.kind === 'expense').forEach(c => pushCategory(c.categoryId, 'expense', c.name))
    out.push({ type: 'grand', label: 'SUMME AUSGABEN', perShow: shows.map(s => s.ausgaben), total: sumA, percent: percentOf(sumA, sumA) })

    // ERGEBNIS
    out.push({ type: 'grand', label: 'ERGEBNIS', perShow: shows.map(s => s.ergebnis), total: overview.ergebnis })
    const mc = dataset.project.member_count || 1
    out.push({ type: 'member', label: `Ergebnis je Bandmitglied (${mc})`, perShow: shows.map(s => s.ergebnis.div(mc)), total: overview.jeBandmitglied })
    return out
  }, [overview, shows, hideZero])

  const money = (v: Decimal, dashZero = false) =>
    dashZero && v.isZero() ? '–' : formatMoney(v)
  const neg = (v: Decimal) => (v.isNegative() ? { color: '#f87171' } : undefined)

  return (
    <div className="pb-10">
      {/* Kopf: Variante · Szenario-Faktor · Info */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>Variante</label>
          <select className="form-select" value={variantId} onChange={e => setVariantId(e.target.value)} style={{ minWidth: 160 }}>
            {variantsSorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>
            Szenario-Faktor: <span style={{ color: '#e0e0e0' }}>{(scenario * 100).toFixed(0)} %</span>
          </label>
          <input type="range" min={0} max={1.5} step={0.05} value={scenario}
            onChange={e => setScenario(Number(e.target.value))} style={{ width: 180 }} />
        </div>
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          Aktive Shows: <span style={{ color: '#e0e0e0' }}>{overview.activeShowCount}</span>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none ml-auto" style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
          Nullzeilen ausblenden
        </label>
      </div>

      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
        {dataset.project.name} · Demodaten (Seed) · Beträge in {dataset.project.currency}, kaufmännisch gerundet zur Anzeige.
      </p>

      <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, minWidth: 220 }}>Bereich / Position</th>
              {shows.map(s => {
                const meta = dataset.shows.find(sh => sh.id === s.showId)
                return (
                  <th key={s.showId} className="text-right" style={{ minWidth: 96 }}>
                    <div style={{ fontWeight: 600 }}>{meta?.city ?? s.legacyKey}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.7 }}>{formatDate(meta?.show_date)}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.55 }}>{meta?.venue}</div>
                  </th>
                )
              })}
              <th className="text-right" style={{ minWidth: 110 }}>Gesamt</th>
              <th className="text-right" style={{ minWidth: 64 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.type === 'section') {
                return (
                  <tr key={i}>
                    <td colSpan={shows.length + 3} style={{ fontWeight: 700, letterSpacing: '0.03em', background: '#383838', color: '#e0e0e0' }}>
                      {r.label}
                    </td>
                  </tr>
                )
              }
              const bold = r.type === 'catsum' || r.type === 'grand'
              const strong = r.type === 'grand'
              const rowStyle: CSSProperties = {
                fontWeight: bold ? 600 : 400,
                background: strong ? '#2f2f2f' : undefined,
              }
              return (
                <tr key={i} style={rowStyle}>
                  <td style={{ position: 'sticky', left: 0, background: strong ? '#2f2f2f' : 'inherit', paddingLeft: r.type === 'line' ? 24 : 12 }}>
                    {r.label}
                  </td>
                  {r.perShow!.map((v, j) => (
                    <td key={j} className="text-right" style={{ fontVariantNumeric: 'tabular-nums', ...neg(v) }}>
                      {money(v, r.type === 'line')}
                    </td>
                  ))}
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, ...neg(r.total!) }}>
                    {money(r.total!)}
                  </td>
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#9ca3af' }}>
                    {formatPercent(r.percent ?? null)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
