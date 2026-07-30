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
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const sumE = overview.sumEinnahmen
    const sumA = overview.sumAusgaben
    const posByCat = (catId: string) =>
      dataset.positions.filter(p => p.category_id === catId).sort((a, b) => a.sort_order - b.sort_order)
    const catTotal = (catId: string) => overview.categories.find(c => c.categoryId === catId)?.total ?? ZERO

    const pushCategory = (catId: string, kind: 'income' | 'expense', name: string) => {
      const basis = kind === 'income' ? sumE : sumA
      const personal = /personal/i.test(name || '')
      for (const pos of posByCat(catId)) {
        const perShow = shows.map(s => s.positionAmount.get(pos.id) ?? ZERO)
        const total = perShow.reduce((a, b) => a.plus(b), ZERO)
        if (hideZero && total.isZero()) continue
        // Beim Personal Hinweis, wenn für die Position in einer aktiven Show Reisekosten hinterlegt sind
        const hasTravel = personal && dataset.entries.some(e =>
          e.position_id === pos.id && e.kind === 'travel' && e.show_id != null && activeShowIds.includes(e.show_id))
        out.push({ type: 'line', label: pos.name, note: hasTravel ? 'inkl. Reisekosten' : undefined, perShow, total, percent: percentOf(total, basis) })
      }
      const perShow = shows.map(s => s.categoryAmount.get(catId) ?? ZERO)
      out.push({ type: 'catsum', label: `Gesamt ${name}`, perShow, total: catTotal(catId), percent: percentOf(catTotal(catId), basis) })
    }

    out.push({ type: 'section', label: 'EINNAHMEN' })
    out.push({ type: 'line', label: 'Gage (abzgl. Provision)', perShow: shows.map(s => s.gageNet), total: overview.gageTotal, percent: null })
    out.push({ type: 'catsum', label: 'Gesamt GAGEN', perShow: shows.map(s => s.gageNet), total: overview.gageTotal, percent: percentOf(overview.gageTotal, sumE) })
    overview.categories.filter(c => c.kind === 'income').forEach(c => pushCategory(c.categoryId, 'income', c.name))
    out.push({ type: 'grand', label: 'SUMME EINNAHMEN', perShow: shows.map(s => s.einnahmen), total: sumE, percent: percentOf(sumE, sumE) })

    out.push({ type: 'section', label: 'AUSGABEN' })
    overview.categories.filter(c => c.kind === 'expense').forEach(c => pushCategory(c.categoryId, 'expense', c.name))
    out.push({ type: 'grand', label: 'SUMME AUSGABEN', perShow: shows.map(s => s.ausgaben), total: sumA, percent: percentOf(sumA, sumA) })

    out.push({ type: 'grand', label: 'ERGEBNIS', perShow: shows.map(s => s.ergebnis), total: overview.ergebnis })
    const mc = dataset.project.member_count || 1
    out.push({ type: 'member', label: `Ergebnis je Bandmitglied (${mc})`, perShow: shows.map(s => s.ergebnis.div(mc)), total: overview.jeBandmitglied })
    return out
  }, [overview, shows, hideZero, dataset])

  const money = (v: Decimal, dashZero = false) => (dashZero && v.isZero() ? '–' : formatMoney(v))
  const neg = (v: Decimal): CSSProperties | undefined => (v.isNegative() ? { color: '#f87171' } : undefined)

  // Hintergrund je Zeilentyp: Gesamt-/Ergebnis-Zeilen heben sich farblich ab.
  const rowBgFor = (t: Row['type']): string => {
    if (t === 'grand' || t === 'member') return '#38414d'  // SUMME / ERGEBNIS / je Mitglied – prominent
    if (t === 'catsum') return '#2a2a2a'                    // Gesamt <Bereich> – subtil
    return '#1e1e1e'                                        // Detailzeile = Wrapper-Farbe (deckt sticky-Spalte)
  }
  // Wie ursprünglich: nur die linke Positions-Spalte klebt (sticky left). Keine
  // sticky Kopfzeile, KEIN Inline-Scroll-Rahmen. Horizontaler Scroll bleibt im
  // Wrapper → die Steuerung darüber wandert nicht mit.
  const thBase: CSSProperties = { position: 'sticky', left: 0, zIndex: 3, background: '#252526' }

  return (
    <div>
      {/* Steuerung + Notiz links angeheftet → bleiben beim Horizontal-Scroll stehen */}
      <div style={{ position: 'sticky', left: 0, zIndex: 5, width: 'max-content', maxWidth: '100%', background: '#1c1c1c' }}>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>Alle Shows auf Variante</label>
          <select className="form-select" value="" style={{ minWidth: 160 }}
            onChange={e => { if (e.target.value) setVariantByShow(mkVariants(e.target.value)) }}>
            <option value="">– wählen –</option>
            {variantsSorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#9ca3af' }}>
            Szenario-Faktor: <span style={{ color: '#e0e0e0' }}>{(scenario * 100).toFixed(0)} %</span>
          </label>
          <input type="range" min={0} max={1.5} step={0.05} value={scenario} disabled={useVVK}
            onChange={e => setScenario(Number(e.target.value))} style={{ width: 180, opacity: useVVK ? 0.4 : 1 }} />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: useVVK ? '#facc15' : '#9ca3af' }}>
          <input type="checkbox" checked={useVVK} onChange={e => setUseVVK(e.target.checked)} />
          Ist-VVK verwenden
        </label>
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          Aktive Shows: <span style={{ color: '#e0e0e0' }}>{overview.activeShowCount}</span>
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none ml-auto" style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
          Nullzeilen ausblenden
        </label>
      </div>

      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
        {dataset.project.name} · Beträge in {dataset.project.currency}, kaufmännisch gerundet zur Anzeige.
      </p>
      </div>

      {/* Kein Inline-Scroll: Wrapper overflow:visible → die SEITE scrollt horizontal.
          Positions-Spalte, Bereich-Titel (EINNAHMEN/AUSGABEN) und Steuerung bleiben
          via sticky-left stehen. Per Browser-Messung belegt. */}
      <div className="data-table-wrapper" style={{ overflow: 'visible', border: 'none', boxShadow: 'none', background: 'transparent' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, minWidth: 220 }}>Bereich / Position</th>
              {shows.map(s => {
                const meta = dataset.shows.find(sh => sh.id === s.showId)
                return (
                  <th key={s.showId} className="text-right" style={{ minWidth: 110 }}>
                    <div style={{ fontWeight: 600 }}>{meta?.city ?? s.legacyKey}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.7 }}>{formatDate(meta?.show_date)}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.55 }}>{meta?.venue}</div>
                    <select
                      value={variantByShow[s.showId] ?? defaultVariant}
                      onChange={e => setVariantByShow(prev => ({ ...prev, [s.showId]: e.target.value }))}
                      className="form-select" title="Variante dieser Show"
                      style={{ marginTop: 4, fontSize: '0.7rem', padding: '2px 4px', width: '100%', textAlign: 'left', fontWeight: 400 }}
                    >
                      {variantsSorted.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
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
                    <td colSpan={shows.length + 3} style={{ fontWeight: 700, letterSpacing: '0.03em', background: '#383838', color: '#e0e0e0' }}>
                      <span style={{ position: 'sticky', left: 0, display: 'inline-block' }}>{r.label}</span>
                    </td>
                  </tr>
                )
              }
              const isTotal = r.type === 'catsum' || r.type === 'grand' || r.type === 'member'
              const bg = rowBgFor(r.type)
              const numSize = r.type === 'line' ? '0.8rem' : undefined  // Detailzeilen etwas kleiner
              const rowStyle: CSSProperties = { fontWeight: isTotal ? 600 : 400, background: bg }
              return (
                <tr key={i} style={rowStyle}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: bg, paddingLeft: r.type === 'line' ? 24 : 12 }}>
                    <div>{r.label}</div>
                    {r.note && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#8b9467', marginTop: 1 }}>{r.note}</div>}
                  </td>
                  {r.perShow!.map((v, j) => (
                    <td key={j} className="text-right" style={{ fontVariantNumeric: 'tabular-nums', fontSize: numSize, background: bg, ...neg(v) }}>
                      {money(v, r.type === 'line')}
                    </td>
                  ))}
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
