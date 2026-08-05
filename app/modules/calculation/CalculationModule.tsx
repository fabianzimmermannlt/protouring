'use client'

// Tour-/Festival-Kalkulation – Übersicht (Phase 2, lesend, DB-gestützt).
// Lädt Projekte des Tenants aus der DB und rendert die Matrix über den geprüften
// Rechenkern (lib/calculation/engine). Bearbeiten = Phase 3. Siehe ADR-105.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Decimal from 'decimal.js'
import { TrashIcon } from '@heroicons/react/24/outline'
import {
  getCalcProjects, getCalcProject, seedCalcDemo, createCalcProject, duplicateCalcProject, renameCalcProject,
  createCalcVariant, updateCalcVariant, deleteCalcVariant, getArtistMembers, type CalcProjectSummary,
} from '@/lib/api-client'
import { buildOverview, percentOf } from '@/lib/calculation/engine'
import type { CalcDataset, CalcVariant } from '@/lib/calculation/types'
import { formatMoney, formatPercent, formatDate } from '@/lib/calculation/format'
import ShowsView from './ShowsView'
import OverheadView from './OverheadView'

type View = 'overview' | 'shows' | 'overhead'

export default function CalculationModule() {
  const [projects, setProjects] = useState<CalcProjectSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string>('')
  const [dataset, setDataset] = useState<CalcDataset | null>(null)
  const [loadingDataset, setLoadingDataset] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('overview')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showVariants, setShowVariants] = useState(false)
  // Nav-Guard: bei ungespeicherten Zeilen (window.__pt_isDirty) vor dem Wechseln warnen
  const [pendingNav, setPendingNav] = useState<{ go: () => void } | null>(null)
  const guardNav = (fn: () => void) => {
    if ((window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty) setPendingNav({ go: fn })
    else fn()
  }

  const loadProjects = async (selectFirst = true) => {
    try {
      const list = await getCalcProjects()
      setProjects(list)
      if (selectFirst && list.length && !selectedId) setSelectedId(list[0].id)
      return list
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Laden'); setProjects([]); return []
    }
  }

  useEffect(() => { loadProjects() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Bandgröße aus den Artist-Mitgliedern (Settings/Artist) – Teiler für „je Bandmitglied".
  const [bandSize, setBandSize] = useState(0)
  useEffect(() => { getArtistMembers().then(m => setBandSize(m.length)).catch(() => {}) }, [])

  useEffect(() => {
    if (!selectedId) { setDataset(null); return }
    let cancelled = false
    setLoadingDataset(true)
    getCalcProject(selectedId)
      .then(d => { if (!cancelled) setDataset(d) })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Fehler beim Laden des Projekts') })
      .finally(() => { if (!cancelled) setLoadingDataset(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const reloadDataset = async () => {
    if (!selectedId) return
    try { setDataset(await getCalcProject(selectedId)) }
    catch (e: any) { setError(e?.message ?? 'Fehler beim Laden des Projekts') }
  }

  // „je Bandmitglied" über die tatsächliche Bandgröße (Artist-Mitglieder) teilen.
  const effDataset = useMemo<CalcDataset | null>(
    () => (dataset && bandSize > 0 ? { ...dataset, project: { ...dataset.project, member_count: bandSize } } : dataset),
    [dataset, bandSize])

  const [duplicating, setDuplicating] = useState(false)
  const handleDuplicate = async () => {
    if (!selectedId) return
    if (!confirm('Diese Kalkulation komplett duplizieren (alle Shows, Werte, Ist)? Die Kopie ist entsperrt und zum Ausprobieren gedacht.')) return
    setDuplicating(true); setError('')
    try {
      const created = await duplicateCalcProject(selectedId)
      await loadProjects(false)
      setSelectedId(created.id)
      setView('overview')
    } catch (e: any) { setError(e?.message ?? 'Fehler beim Duplizieren') } finally { setDuplicating(false) }
  }

  const handleRename = async () => {
    if (!selectedId || !dataset) return
    const next = window.prompt('Neuer Name der Kalkulation:', dataset.project.name)?.trim()
    if (!next || next === dataset.project.name) return
    setError('')
    try {
      await renameCalcProject(selectedId, next)
      await loadProjects(false)
      await reloadDataset()
    } catch (e: any) { setError(e?.message ?? 'Fehler beim Umbenennen') }
  }

  const handleCreateProject = async (name: string) => {
    const created = await createCalcProject(name)
    await loadProjects(false)
    setSelectedId(created.id)
    setView('shows')
    setShowNewProject(false)
  }

  const handleImportDemo = async () => {
    setImporting(true); setError('')
    try {
      const created = await seedCalcDemo()
      await loadProjects(false)
      setSelectedId(created.id)
    } catch (e: any) {
      setError(e?.message ?? 'Import fehlgeschlagen')
    } finally { setImporting(false) }
  }

  if (projects === null) {
    return <div className="py-10 text-center text-sm" style={{ color: '#9ca3af' }}>Lädt…</div>
  }

  const btnBar: CSSProperties = { fontSize: '0.8rem', padding: '0.28rem 0.6rem', whiteSpace: 'nowrap' }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'nowrap' }}>
        <h2 className="text-lg font-semibold shrink-0" style={{ color: '#e0e0e0' }}>Kalkulation</h2>
        {projects.length > 0 && (
          <select className="form-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}
            title="Kalkulation auswählen"
            style={{ flex: '1 1 auto', minWidth: 90, textOverflow: 'ellipsis' }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.year ? ` (${p.year})` : ''}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2 shrink-0" style={{ flexWrap: 'nowrap' }}>
          {dataset && (
            <button onClick={() => setShowVariants(true)} className="btn btn-ghost shrink-0" style={btnBar}>Varianten</button>
          )}
          {dataset && (
            <button onClick={handleRename} className="btn btn-ghost shrink-0" style={btnBar}>Umbenennen</button>
          )}
          {dataset && (
            <button onClick={handleDuplicate} disabled={duplicating} className="btn btn-ghost shrink-0" style={btnBar}>{duplicating ? 'Dupliziere…' : 'Duplizieren'}</button>
          )}
          <button onClick={() => setShowNewProject(true)} className="btn btn-ghost shrink-0" style={btnBar}>+ Neues Projekt</button>
          <button onClick={handleImportDemo} disabled={importing} className="btn btn-ghost shrink-0" style={btnBar}>
            {importing ? 'Importiere…' : '+ Demo'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 mb-3 rounded text-sm" style={{ background: '#3b1f22', color: '#fca5a5' }}>{error}</div>}

      {projects.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#9ca3af' }}>
          <p className="mb-4">Noch kein Kalkulations-Projekt vorhanden.</p>
          <button onClick={handleImportDemo} disabled={importing} className="btn btn-primary">
            {importing ? 'Importiere…' : 'Demo-Projekt importieren'}
          </button>
          <p className="text-xs mt-3" style={{ color: '#6b7280' }}>
            Legt „Festivals 2026" (9 Shows, 2 Varianten) als bearbeitbares Beispiel an.
          </p>
        </div>
      ) : loadingDataset || !dataset ? (
        <div className="py-10 text-center text-sm" style={{ color: '#9ca3af' }}>Projekt lädt…</div>
      ) : (
        <>
          <div style={{ display: 'flex', borderBottom: '1px solid #333', overflowX: 'auto', marginBottom: '1rem' }}>
            <button onClick={() => guardNav(() => setView('overview'))} className={`pt-detail-tab${view === 'overview' ? ' active' : ''}`}>Übersicht</button>
            <button onClick={() => guardNav(() => setView('shows'))} className={`pt-detail-tab${view === 'shows' ? ' active' : ''}`}>Shows</button>
            <button onClick={() => guardNav(() => setView('overhead'))} className={`pt-detail-tab${view === 'overhead' ? ' active' : ''}`}>Übergeordnet</button>
          </div>
          {view === 'overview' && <OverviewMatrix key={selectedId} dataset={effDataset!} />}
          {view === 'shows' && <ShowsView dataset={effDataset!} projectId={selectedId} onChanged={reloadDataset} guardNav={guardNav} />}
          {view === 'overhead' && <OverheadView key={selectedId} dataset={effDataset!} projectId={selectedId} onChanged={reloadDataset} />}
        </>
      )}

      {pendingNav && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h3 className="modal-title">Ungespeicherte Änderungen</h3></div>
            <div className="modal-body">
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Es gibt Zeilen mit ungespeicherten Werten. Wenn du wechselst, gehen diese Eingaben verloren.
              </p>
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setPendingNav(null)}>Zurück</button>
              <button className="btn btn-primary" onClick={() => {
                const go = pendingNav.go
                setPendingNav(null)
                ;(window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty = false
                go()
              }}>Verwerfen & wechseln</button>
            </div>
          </div>
        </div>
      )}

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={handleCreateProject} />}
      {showVariants && dataset && (
        <VariantsModal projectId={selectedId} variants={dataset.variants} dataset={dataset} onClose={() => setShowVariants(false)} onChanged={reloadDataset} />
      )}
    </div>
  )
}

// ── Modals ───────────────────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const create = async () => {
    setBusy(true); setErr('')
    try { await onCreate(name.trim() || 'Neue Kalkulation') }
    catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }
  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: 420 }}>
        <div className="modal-header"><h3 className="modal-title">Neue Kalkulation</h3><button onClick={onClose} className="text-gray-400 hover:text-white">✕</button></div>
        <div className="modal-body space-y-3">
          <div>
            <label className="form-label">Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Tour 2026" autoFocus onKeyDown={e => { if (e.key === 'Enter') create() }} />
          </div>
          <p className="text-xs" style={{ color: '#6b7280' }}>Legt ein leeres Projekt mit Standard-Bereichen und Variante 1/2 an.</p>
          {err && <p className="text-xs" style={{ color: '#fca5a5' }}>{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={create} disabled={busy} className="btn btn-primary">{busy ? 'Anlegen…' : 'Anlegen'}</button>
        </div>
      </div>
    </div>
  )
}

function VariantsModal({ projectId, variants, dataset, onClose, onChanged }: {
  projectId: string; variants: CalcVariant[]; dataset: CalcDataset; onClose: () => void; onChanged: () => void
}) {
  const sorted = [...variants].sort((a, b) => a.sort_order - b.sort_order)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const rename = async (id: string, name: string, original: string) => {
    const n = name.trim()
    if (!n || n === original) return
    try { await updateCalcVariant(id, n); onChanged() } catch (e: any) { setErr(e?.message ?? 'Fehler') }
  }
  const add = async () => {
    setBusy(true); setErr('')
    try { await createCalcVariant(projectId, ''); onChanged() } catch (e: any) { setErr(e?.message ?? 'Fehler') } finally { setBusy(false) }
  }
  const del = async (id: string) => {
    setErr('')
    const vname = variants.find(v => v.id === id)?.name || 'Variante'
    const affected = dataset.entries.filter(e => e.variant_id === id)
    let force = false
    if (affected.length > 0) {
      const showIds = Array.from(new Set(affected.map(e => e.show_id).filter((x): x is string => !!x)))
      const labels = showIds.map(sid => {
        const s = dataset.shows.find(x => x.id === sid)
        return s ? `${s.city || '(ohne Stadt)'}${s.show_date ? ' · ' + formatDate(s.show_date) : ''}` : '?'
      })
      const shown = labels.slice(0, 8).join('\n• ')
      const more = labels.length > 8 ? `\n… und ${labels.length - 8} weitere` : ''
      const scope = labels.length > 0 ? `in ${labels.length} Show(s):\n\n• ${shown}${more}` : `(projektweite Fixkosten)`
      if (!confirm(`„${vname}" hat variantenspezifische Werte ${scope}\n\nDiese Werte gehen beim Löschen verloren; gemeinsame (🔗-verknüpfte) Werte bleiben erhalten.\n\nTrotzdem löschen?`)) return
      force = true
    } else {
      if (!confirm(`„${vname}" löschen?`)) return
    }
    setBusy(true)
    try { await deleteCalcVariant(id, force); onChanged() } catch (e: any) { setErr(e?.message ?? 'Fehler') } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: 440 }}>
        <div className="modal-header"><h3 className="modal-title">Varianten</h3><button onClick={onClose} className="text-gray-400 hover:text-white">✕</button></div>
        <div className="modal-body space-y-2">
          <p className="text-xs" style={{ color: '#6b7280' }}>Benenne die Varianten (z.B. „Variante 1"). Beim Löschen zeigt eine Abfrage, in welchen Shows variantenspezifische Werte liegen – diese kannst du dann bewusst mit verwerfen (gemeinsame 🔗-Werte bleiben).</p>
          {sorted.map(v => (
            <div key={v.id} className="flex items-center gap-2">
              <input className="form-input" defaultValue={v.name} onBlur={e => rename(v.id, e.target.value, v.name)} style={{ fontSize: '0.85rem' }} />
              <button onClick={() => del(v.id)} className="p-1 text-gray-400 hover:text-red-500" title="Löschen"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={add} disabled={busy} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>+ Variante</button>
          {err && <p className="text-xs" style={{ color: '#fca5a5' }}>{err}</p>}
        </div>
        <div className="modal-footer"><button onClick={onClose} className="btn btn-primary">Fertig</button></div>
      </div>
    </div>
  )
}

// ── Übersichts-Matrix ────────────────────────────────────────────────────────

type RowType = 'section' | 'line' | 'catsum' | 'grand' | 'member'
interface Row { type: RowType; label: string; note?: string; perShow?: Decimal[]; total?: Decimal; percent?: Decimal | null }
const ZERO = new Decimal(0)

function OverviewMatrix({ dataset }: { dataset: CalcDataset }) {
  const variantsSorted = useMemo(() => [...dataset.variants].sort((a, b) => a.sort_order - b.sort_order), [dataset])
  const defaultVariant = dataset.project.default_variant_id ?? variantsSorted[0]?.id ?? ''
  const activeShowIds = useMemo(
    () => dataset.shows.filter(s => s.is_active).sort((a, b) => a.sort_order - b.sort_order).map(s => s.id), [dataset])
  const mkVariants = (vid: string): Record<string, string> => {
    const r: Record<string, string> = {}
    activeShowIds.forEach(id => { r[id] = vid })
    return r
  }
  const [variantByShow, setVariantByShow] = useState<Record<string, string>>(() => mkVariants(defaultVariant))
  const [scenario, setScenario] = useState<number>(Number(dataset.project.scenario_factor) || 1)
  const [useVVK, setUseVVK] = useState(false)
  const [hideZero, setHideZero] = useState(false)

  const overview = useMemo(
    () => buildOverview(dataset, { variantByShow, variantId: defaultVariant, scenarioFactor: scenario, useVVK, memberCount: dataset.project.member_count }),
    [dataset, variantByShow, scenario, defaultVariant, useVVK])

  // Show-Spalten nach Datum sortieren (nicht nach Anlege-Reihenfolge).
  const shows = useMemo(() => {
    const dateOf = (id: string) => dataset.shows.find(s => s.id === id)?.show_date ?? ''
    return [...overview.shows].sort((a, b) => dateOf(a.showId).localeCompare(dateOf(b.showId)))
  }, [overview, dataset])

  // Ist-Ansicht: tatsächliche Werte (calc_actuals) statt Soll – analog zur Abrechnung.
  const [istMode, setIstMode] = useState(false)
  const nz = (v: unknown) => v != null && String(v) !== ''
  const DA = (v: unknown) => { try { return new Decimal((v as string) || 0) } catch { return ZERO } }
  const actualOf = (showId: string, posId: string): Decimal => {
    const a = (dataset.actuals ?? []).find(x => x.show_id === showId && x.position_id === posId)
    if (!a) return ZERO
    let r = ZERO
    if (nz(a.amount)) r = r.plus(DA(a.amount))
    if (nz(a.travel_km) && nz(a.travel_rate)) r = r.plus(DA(a.travel_km).times(DA(a.travel_rate)))
    if (nz(a.travel_fix)) r = r.plus(DA(a.travel_fix))
    if (nz(a.fuel_amount)) r = r.plus(DA(a.fuel_amount))
    return r
  }
  // Ansicht je Show: Soll (ShowResult) oder Ist (aus Actuals). Gage-Ist = Gage-Soll.
  type VShow = { showId: string; positionAmount: Map<string, Decimal>; categoryAmount: Map<string, Decimal>; gageNet: Decimal; gageFix: Decimal; gageDeal: Decimal; gageProvision: Decimal; einnahmen: Decimal; ausgaben: Decimal; ergebnis: Decimal }
  const viewShows = useMemo<VShow[]>(() => {
    if (!istMode) return shows as unknown as VShow[]
    return shows.map(s => {
      const positionAmount = new Map<string, Decimal>()
      const categoryAmount = new Map<string, Decimal>()
      let income = ZERO, expense = ZERO
      for (const p of dataset.positions) {
        // Übergeordnete Posten: pro Show nicht erfassbar → kalkulierter (umgelegter)
        // Soll-Wert gilt als Ist. Sonstige Positionen: tatsächliche Actuals.
        const v = p.is_overhead ? (s.positionAmount.get(p.id) ?? ZERO) : actualOf(s.showId, p.id)
        if (v.isZero()) continue
        positionAmount.set(p.id, v)
        const cat = dataset.categories.find(c => c.id === p.category_id)
        if (!cat) continue
        categoryAmount.set(cat.id, (categoryAmount.get(cat.id) ?? ZERO).plus(v))
        if (cat.kind === 'income') income = income.plus(v); else expense = expense.plus(v)
      }
      const einnahmen = s.gageNet.plus(income)
      return { showId: s.showId, positionAmount, categoryAmount, gageNet: s.gageNet, gageFix: s.gageFix, gageDeal: s.gageDeal, gageProvision: s.gageProvision, einnahmen, ausgaben: expense, ergebnis: einnahmen.minus(expense) }
    })
  }, [istMode, shows, dataset])
  const totals = useMemo(() => {
    if (!istMode) return { sumE: overview.sumEinnahmen, sumA: overview.sumAusgaben, gageTotal: overview.gageTotal, ergebnis: overview.ergebnis, jeBandmitglied: overview.jeBandmitglied }
    const sumE = viewShows.reduce((a, s) => a.plus(s.einnahmen), ZERO)
    const sumA = viewShows.reduce((a, s) => a.plus(s.ausgaben), ZERO)
    const gageTotal = viewShows.reduce((a, s) => a.plus(s.gageNet), ZERO)
    const ergebnis = sumE.minus(sumA)
    const mc = dataset.project.member_count || 1
    return { sumE, sumA, gageTotal, ergebnis, jeBandmitglied: ergebnis.div(mc) }
  }, [istMode, viewShows, overview, dataset])
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const sumE = totals.sumE
    const sumA = totals.sumA
    const posByCat = (catId: string) =>
      dataset.positions.filter(p => p.category_id === catId).sort((a, b) => a.sort_order - b.sort_order)
    const catTotal = (catId: string) => viewShows.reduce((a, s) => a.plus(s.categoryAmount.get(catId) ?? ZERO), ZERO)

    const pushCategory = (catId: string, kind: 'income' | 'expense', name: string) => {
      const basis = kind === 'income' ? sumE : sumA
      const personal = /personal/i.test(name || '')
      for (const pos of posByCat(catId)) {
        const perShow = viewShows.map(s => s.positionAmount.get(pos.id) ?? ZERO)
        const total = perShow.reduce((a, b) => a.plus(b), ZERO)
        if (hideZero && total.isZero()) continue
        // Beim Personal Hinweis, wenn für die Position in einer aktiven Show Reisekosten hinterlegt sind
        const hasTravel = personal && dataset.entries.some(e =>
          e.position_id === pos.id && e.kind === 'travel' && e.show_id != null && activeShowIds.includes(e.show_id))
        out.push({ type: 'line', label: pos.name, note: hasTravel ? 'inkl. Reisekosten' : undefined, perShow, total, percent: percentOf(total, basis) })
      }
      const perShow = viewShows.map(s => s.categoryAmount.get(catId) ?? ZERO)
      out.push({ type: 'catsum', label: `Gesamt ${name}`, perShow, total: catTotal(catId), percent: percentOf(catTotal(catId), basis) })
    }

    out.push({ type: 'section', label: 'EINNAHMEN' })
    const sumPer = (pick: (s: VShow) => Decimal) => {
      const per = viewShows.map(pick)
      return { per, total: per.reduce((a, b) => a.plus(b), ZERO) }
    }
    const fix = sumPer(s => s.gageFix)
    const deal = sumPer(s => s.gageDeal)
    const prov = sumPer(s => s.gageProvision)
    out.push({ type: 'line', label: 'Fixgage (Garantie)', perShow: fix.per, total: fix.total, percent: null })
    out.push({ type: 'line', label: 'Deal (Beteiligung)', perShow: deal.per, total: deal.total, percent: null })
    out.push({ type: 'line', label: 'Provision (Booking)', perShow: prov.per.map(p => p.negated()), total: prov.total.negated(), percent: null })
    out.push({ type: 'catsum', label: 'Gesamt GAGEN (netto)', perShow: viewShows.map(s => s.gageNet), total: totals.gageTotal, percent: percentOf(totals.gageTotal, sumE) })
    overview.categories.filter(c => c.kind === 'income').forEach(c => pushCategory(c.categoryId, 'income', c.name))
    out.push({ type: 'grand', label: 'SUMME EINNAHMEN', perShow: viewShows.map(s => s.einnahmen), total: sumE, percent: percentOf(sumE, sumE) })

    out.push({ type: 'section', label: 'AUSGABEN' })
    overview.categories.filter(c => c.kind === 'expense').forEach(c => pushCategory(c.categoryId, 'expense', c.name))
    out.push({ type: 'grand', label: 'SUMME AUSGABEN', perShow: viewShows.map(s => s.ausgaben), total: sumA, percent: percentOf(sumA, sumA) })

    out.push({ type: 'grand', label: 'ERGEBNIS', perShow: viewShows.map(s => s.ergebnis), total: totals.ergebnis })
    const mc = dataset.project.member_count || 1
    out.push({ type: 'member', label: `Ergebnis je Bandmitglied (${mc})`, perShow: viewShows.map(s => s.ergebnis.div(mc)), total: totals.jeBandmitglied })
    return out
  }, [overview, viewShows, totals, hideZero, dataset])

  const money = (v: Decimal, dashZero = false) => (dashZero && v.isZero() ? '–' : formatMoney(v))
  const neg = (v: Decimal): CSSProperties | undefined => (v.isNegative() ? { color: '#f87171' } : undefined)

  // Hintergrund je Zeilentyp: Gesamt-/Ergebnis-Zeilen heben sich farblich ab.
  const rowBgFor = (t: Row['type']): string | undefined => {
    if (t === 'grand' || t === 'member') return '#38414d'  // SUMME / ERGEBNIS / je Mitglied
    if (t === 'catsum') return '#3d3d3d'                    // Gesamt <Bereich> – deutlich heller abgesetzt
    return undefined                                        // Detailzeile
  }

  // ── Export (Übersicht) ──────────────────────────────────────────────────────
  const showLabel = (showId: string) => {
    const m = dataset.shows.find(sh => sh.id === showId)
    return [m?.city, m?.show_date ? formatDate(m.show_date) : ''].filter(Boolean).join(' · ')
  }
  const escHtml = (s: string | undefined) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const viewLabel = istMode ? 'Ist' : 'Soll'
  const fileBase = `${dataset.project.name} – Übersicht (${viewLabel})`

  const exportCsv = () => {
    const sep = ';'
    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const num = (v: Decimal) => v.toFixed(2).replace('.', ',')   // deutsch, ohne Tausenderpunkt
    const out: string[] = [
      [dataset.project.name, `Ansicht: ${viewLabel}`, `Beträge in ${dataset.project.currency}`, `Aktive Shows: ${overview.activeShowCount}`].map(esc).join(sep),
      '',
      ['Bereich / Position', ...shows.map(s => showLabel(s.showId)), 'Gesamt', '%'].map(esc).join(sep),
    ]
    for (const r of rows) {
      if (r.type === 'section') { out.push(esc(r.label)); continue }
      const label = r.note ? `${r.label} (${r.note})` : r.label
      out.push([label, ...r.perShow!.map(num), num(r.total!), r.percent != null ? formatPercent(r.percent) : ''].map(esc).join(sep))
    }
    const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${fileBase}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportPdf = () => {
    const head = `<th class="pos">Bereich / Position</th>${shows.map(s => `<th class="num">${escHtml(showLabel(s.showId))}</th>`).join('')}<th class="num">Gesamt</th><th class="num">%</th>`
    const body = rows.map(r => {
      if (r.type === 'section') return `<tr class="sec"><td colspan="${shows.length + 3}">${escHtml(r.label)}</td></tr>`
      const cls = (r.type === 'grand' || r.type === 'member') ? 'grand' : (r.type === 'catsum' ? 'catsum' : '')
      const cells = r.perShow!.map(v => `<td class="num">${escHtml(money(v, r.type === 'line'))}</td>`).join('')
      const label = escHtml(r.label) + (r.note ? ` <span class="note">${escHtml(r.note)}</span>` : '')
      return `<tr class="${cls}"><td class="pos">${label}</td>${cells}<td class="num">${escHtml(money(r.total!))}</td><td class="num">${r.percent != null ? escHtml(formatPercent(r.percent)) : ''}</td></tr>`
    }).join('')
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escHtml(fileBase)}</title><style>
      @page{size:A4 landscape;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10px;margin:0}
      h1{font-size:15px;margin:0 0 2px}
      .meta{color:#555;margin:0 0 10px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #cfcfcf;padding:3px 6px;white-space:nowrap}
      th{background:#ececec;text-align:right}
      th.pos,td.pos{text-align:left}
      td.num{text-align:right;font-variant-numeric:tabular-nums}
      tr.sec td{background:#333;color:#fff;font-weight:bold;letter-spacing:.04em}
      tr.catsum td{background:#f1f1f1;font-weight:bold}
      tr.grand td{background:#dde6f0;font-weight:bold}
      .note{color:#777;font-style:italic;font-size:9px}
    </style></head><body>
      <h1>${escHtml(dataset.project.name)} – Übersicht (${viewLabel})</h1>
      <div class="meta">Beträge in ${escHtml(dataset.project.currency)} · Aktive Shows: ${overview.activeShowCount} · Stand: ${new Date().toLocaleDateString('de-DE')}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`
    const w = window.open('', '_blank')
    if (!w) { alert('Bitte Pop-ups für diese Seite erlauben, damit das PDF erzeugt werden kann.'); return }
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 350)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>Ansicht</label>
          <div className="inline-flex" style={{ border: '1px solid #3c3c3c', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setIstMode(false)} className="btn" title="Soll (geplant, je Variante)"
              style={{ fontSize: '0.75rem', padding: '0.28rem 0.8rem', borderRadius: 0, background: !istMode ? '#2b3a4d' : 'transparent', color: !istMode ? '#dbeafe' : '#9ca3af', fontWeight: !istMode ? 600 : 400 }}>Soll</button>
            <button onClick={() => setIstMode(true)} className="btn" title="Ist (tatsächliche Werte aus den Shows)"
              style={{ fontSize: '0.75rem', padding: '0.28rem 0.8rem', borderRadius: 0, background: istMode ? '#3a3222' : 'transparent', color: istMode ? '#facc15' : '#9ca3af', fontWeight: istMode ? 600 : 400 }}>Ist</button>
          </div>
        </div>
        <div style={{ opacity: istMode ? 0.4 : 1 }}>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>Alle Shows auf Variante</label>
          <select className="form-select" value="" style={{ minWidth: 160 }} disabled={istMode}
            onChange={e => { if (e.target.value) setVariantByShow(mkVariants(e.target.value)) }}>
            <option value="">– wählen –</option>
            {variantsSorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={{ opacity: istMode ? 0.4 : 1 }}>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>
            Szenario-Faktor: <span style={{ color: '#e0e0e0' }}>{(scenario * 100).toFixed(0)} %</span>
          </label>
          <input type="range" min={0} max={1.5} step={0.05} value={scenario} disabled={useVVK || istMode}
            onChange={e => setScenario(Number(e.target.value))} style={{ width: 180, opacity: (useVVK || istMode) ? 0.4 : 1 }} />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: useVVK && !istMode ? '#facc15' : '#9ca3af', opacity: istMode ? 0.4 : 1 }}>
          <input type="checkbox" checked={useVVK} disabled={istMode} onChange={e => setUseVVK(e.target.checked)} />
          Ist-VVK verwenden
        </label>
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          Aktive Shows: <span style={{ color: '#e0e0e0' }}>{overview.activeShowCount}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} title="Übersicht als CSV (Excel) herunterladen">CSV</button>
          <button onClick={exportPdf} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} title="Übersicht als PDF drucken/speichern">PDF</button>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
          Nullzeilen ausblenden
        </label>
      </div>

      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
        {dataset.project.name} · Beträge in {dataset.project.currency}, kaufmännisch gerundet zur Anzeige.
      </p>

      <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 1, background: 'inherit', minWidth: 220 }}>Bereich / Position</th>
              {shows.map(s => {
                const meta = dataset.shows.find(sh => sh.id === s.showId)
                return (
                  <th key={s.showId} className="text-right" style={{ minWidth: 110 }}>
                    <div style={{ fontWeight: 600 }}>{meta?.city ?? s.legacyKey}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.7 }}>{formatDate(meta?.show_date)}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.55 }}>{meta?.venue}</div>
                    {istMode ? (
                      <div style={{ marginTop: 4, fontSize: '0.7rem', fontWeight: 600, color: '#facc15' }} title="Ist – tatsächliche Werte">Ist</div>
                    ) : (
                      <select
                        value={variantByShow[s.showId] ?? defaultVariant}
                        onChange={e => setVariantByShow(prev => ({ ...prev, [s.showId]: e.target.value }))}
                        className="form-select" title="Variante dieser Show"
                        style={{ marginTop: 4, fontSize: '0.7rem', padding: '2px 4px', width: '100%', textAlign: 'left', fontWeight: 400 }}
                      >
                        {variantsSorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    )}
                  </th>
                )
              })}
              <th className="text-right" style={{ minWidth: 110 }}>Gesamt</th>
              <th className="text-right" style={{ minWidth: 72, whiteSpace: 'nowrap' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.type === 'section') {
                return (
                  <tr key={i}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, fontWeight: 700, letterSpacing: '0.03em', background: '#383838', color: '#e0e0e0' }}>{r.label}</td>
                    <td colSpan={shows.length + 2} style={{ background: '#383838' }} />
                  </tr>
                )
              }
              const isTotal = r.type === 'catsum' || r.type === 'grand' || r.type === 'member'
              const bg = rowBgFor(r.type)
              const numSize = r.type === 'line' ? '0.8rem' : undefined  // Detailzeilen etwas kleiner
              const rowStyle: CSSProperties = { fontWeight: isTotal ? 600 : 400, background: bg }
              // In der ERGEBNIS-Zeile beste (höchste) + schlechteste (niedrigste) Show markieren
              const ergExtremes = (r.type === 'grand' && r.label === 'ERGEBNIS' && r.perShow && r.perShow.length > 1)
                ? (() => { let mx = r.perShow[0], mn = r.perShow[0]; for (const v of r.perShow!) { if (v.gt(mx)) mx = v; if (v.lt(mn)) mn = v } return mx.eq(mn) ? null : { mx, mn } })()
                : null
              const isFixRow = r.label === 'Fixgage (Garantie)'
              return (
                <tr key={i} style={rowStyle}>
                  <td style={{ position: 'sticky', left: 0, background: bg ?? 'inherit', paddingLeft: r.type === 'line' ? 24 : 12 }}>
                    <div>{r.label}</div>
                    {r.note && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#8b9467', marginTop: 1 }}>{r.note}</div>}
                  </td>
                  {r.perShow!.map((v, j) => {
                    const isMax = ergExtremes ? v.eq(ergExtremes.mx) : false
                    const isMin = ergExtremes ? v.eq(ergExtremes.mn) : false
                    const cellBg = isMax ? '#166534' : isMin ? '#7f1d1d' : bg
                    const cellStyle: CSSProperties = (isMax || isMin)
                      ? { fontVariantNumeric: 'tabular-nums', fontSize: numSize, background: cellBg, color: '#fff' }
                      : { fontVariantNumeric: 'tabular-nums', fontSize: numSize, background: bg, ...neg(v) }
                    // Fixgage-Zeile: Garantie vorhanden, aber Deal ist höher (vs) → „(Deal)" statt „–"
                    const fixDealWon = isFixRow && v.isZero() && (() => {
                      const m = dataset.shows.find(sh => sh.id === shows[j]?.showId)
                      return !!m && (m.deal_type ?? 'vs') === 'vs' && parseFloat(String(m.guarantee ?? '0')) > 0
                    })()
                    return (
                      <td key={j} className="text-right" style={cellStyle}
                        title={isMax ? 'Höchstes Ergebnis' : isMin ? 'Niedrigstes Ergebnis' : (fixDealWon ? 'Garantie vorhanden – Deal ist höher und zählt' : undefined)}>
                        {fixDealWon
                          ? <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.72rem' }}>(Deal)</span>
                          : money(v, r.type === 'line')}
                      </td>
                    )
                  })}
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, background: bg, ...neg(r.total!) }}>
                    {money(r.total!)}
                  </td>
                  <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#9ca3af', whiteSpace: 'nowrap', background: bg }}>
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
