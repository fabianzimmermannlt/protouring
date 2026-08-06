'use client'

// Kalkulation – Übergeordnete Kosten (Phase 3).
// Posten (z.B. Kulisse, Anschaffung) mit einem Betrag, der sich gleichmäßig auf
// die angehakten aktiven Shows verteilt. Optional als Sammelposten mit mehreren
// Unterzeilen (z.B. einzelne Rechnungen) – Summe = Postenbetrag, aufklappbar.
// Posten und Unterzeilen sind per Drag & Drop sortierbar.

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { TrashIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, updateCalcPosition, deleteCalcPosition,
  setCalcOverhead, setCalcOverheadShow,
  createOverheadLine, updateOverheadLine, deleteOverheadLine, reorderOverheadLines,
} from '@/lib/api-client'
import type { CalcDataset, CalcOverheadLine } from '@/lib/calculation/types'
import { formulaNorm, useFormulaFields } from '@/lib/calculation/formula'
import { formatMoney, formatDate } from '@/lib/calculation/format'

const norm = (v: string): string | null => formulaNorm(v)   // Betragsfelder: "=236+44" → "280"
const D = (v: unknown): Decimal => { try { return new Decimal(v == null || v === '' ? 0 : (v as string)) } catch { return new Decimal(0) } }

function Grip({ dragging }: { dragging?: boolean }) {
  return (
    <span title="Zum Sortieren ziehen" className="shrink-0 cursor-grab active:cursor-grabbing"
      style={{ color: dragging ? '#60a5fa' : '#6b7280', lineHeight: 0 }}>
      <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor" aria-hidden="true">
        <circle cx="2.2" cy="3" r="1.25" /><circle cx="6.8" cy="3" r="1.25" />
        <circle cx="2.2" cy="7.5" r="1.25" /><circle cx="6.8" cy="7.5" r="1.25" />
        <circle cx="2.2" cy="12" r="1.25" /><circle cx="6.8" cy="12" r="1.25" />
      </svg>
    </span>
  )
}

export default function OverheadView({ dataset, projectId, onChanged }: { dataset: CalcDataset; projectId: string; onChanged: () => void }) {
  const { onFormulaBlur, onFormulaFocus } = useFormulaFields(projectId, dataset.formulas)
  const activeShows = useMemo(
    () => dataset.shows.filter(s => s.is_active).slice().sort((a, b) => a.sort_order - b.sort_order),
    [dataset])
  const items = useMemo(
    () => dataset.positions.filter(p => p.is_overhead).slice().sort((a, b) => a.sort_order - b.sort_order),
    [dataset])
  const categories = useMemo(() => dataset.categories.slice().sort((a, b) => a.sort_order - b.sort_order), [dataset])

  const amountOf = (posId: string) => dataset.entries.find(e => e.position_id === posId && e.show_id == null)
  const linesOf = (posId: string) => (dataset.overheadLines ?? []).filter(l => l.position_id === posId).slice().sort((a, b) => a.sort_order - b.sort_order)
  const excluded = (posId: string, showId: string) =>
    (dataset.overheadExclude ?? []).some(x => x.position_id === posId && x.show_id === showId)
  const includedCount = (posId: string) => activeShows.filter(s => !excluded(posId, s.id)).length
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? '—'

  // Posten sortieren (Drag & Drop)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const reorderPosten = async (targetId: string) => {
    const src = dragId
    setDragId(null); setDragOverId(null)
    if (!src || src === targetId) return
    const order = items.map(p => p.id)
    const from = order.indexOf(src)
    if (from < 0 || order.indexOf(targetId) < 0) return
    order.splice(from, 1)
    order.splice(order.indexOf(targetId), 0, src)
    const updates = order.map((id, i) => ({ id, i, cur: items.find(p => p.id === id) })).filter(x => x.cur && x.cur.sort_order !== x.i)
    try { await Promise.all(updates.map(x => updateCalcPosition(x.id, { sort_order: x.i }))); onChanged() } catch { /* Sortierung unkritisch */ }
  }

  return (
    <div className="space-y-4" onBlurCapture={onFormulaBlur} onFocusCapture={onFormulaFocus}>
      <div className="text-xs" style={{ color: '#9ca3af', lineHeight: 1.5 }}>
        Übergeordnete Kosten verteilen sich automatisch gleichmäßig auf die angehakten Shows
        (<span style={{ color: '#e0e0e0' }}>Umlage = Soll ÷ Anzahl angehakter Shows</span>).
        Eine Show abwählen, wenn der Posten dort nicht anfällt. Ein Posten kann als
        <span style={{ color: '#e0e0e0' }}> Sammelposten</span> mehrere Einzelpositionen enthalten (aufklappbar).
      </div>

      {activeShows.length === 0 && (
        <div className="text-sm" style={{ color: '#facc15' }}>Noch keine aktiven Shows – lege zuerst Shows an.</div>
      )}

      {items.length === 0 ? (
        <div className="text-sm" style={{ color: '#9ca3af' }}>Noch keine übergeordneten Kosten erfasst.</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const e = amountOf(item.id)
            const n = includedCount(item.id)
            const pctRaw = item.allocation_pct != null && item.allocation_pct !== '' ? String(item.allocation_pct) : '100'
            const pct = D(pctRaw)
            const effective = D(e?.amount).times(pct).div(100)
            const share = n > 0 ? effective.div(n) : new Decimal(0)
            const pctNote = pct.eq(100) ? '' : ` · ${pct.toString()} % von ${formatMoney(D(e?.amount))}`
            return (
              <OverheadRow key={item.id} item={item} catName={catName(item.category_id)}
                soll={e?.amount != null ? String(e.amount) : ''} ist={e?.ist_amount != null ? String(e.ist_amount) : ''} pct={pctRaw}
                lines={linesOf(item.id)}
                shareLabel={n > 0 ? `${formatMoney(share)} je Show (${n})${pctNote}` : 'keine Show angehakt'}
                activeShows={activeShows} isExcluded={sid => excluded(item.id, sid)} onChanged={onChanged}
                dragging={dragId === item.id} dropTarget={dragOverId === item.id}
                onDragStartRow={() => setDragId(item.id)} onDragEnterRow={() => { if (dragId && dragId !== item.id) setDragOverId(item.id) }}
                onDragEndRow={() => { setDragId(null); setDragOverId(null) }} onDropRow={() => reorderPosten(item.id)} />
            )
          })}
        </div>
      )}

      <AddOverhead categories={categories} onChanged={onChanged} />
    </div>
  )
}

function OverheadRow({ item, catName, soll, ist, pct, lines, shareLabel, activeShows, isExcluded, onChanged, dragging, dropTarget, onDragStartRow, onDragEnterRow, onDragEndRow, onDropRow }: {
  item: { id: string; name: string }
  catName: string; soll: string; ist: string; pct: string; lines: CalcOverheadLine[]; shareLabel: string
  activeShows: CalcDataset['shows']
  isExcluded: (showId: string) => boolean
  onChanged: () => void
  dragging: boolean; dropTarget: boolean
  onDragStartRow: () => void; onDragEnterRow: () => void; onDragEndRow: () => void; onDropRow: () => void
}) {
  const hasLines = lines.length > 0
  const [name, setName] = useState(item.name)
  const [sollV, setSollV] = useState(soll)
  const [istV, setIstV] = useState(ist)
  const [pctV, setPctV] = useState(pct)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(hasLines)

  const saveName = async () => { const nn = name.trim(); if (!nn || nn === item.name) { setName(item.name); return } try { await updateCalcPosition(item.id, { name: nn }); onChanged() } catch { setName(item.name) } }
  const saveAmount = async () => { try { await setCalcOverhead(item.id, { amount: norm(sollV), ist_amount: norm(istV), allocation_pct: norm(pctV) ?? '100' }); onChanged() } catch { /* still */ } }
  const savePct = async () => { try { await setCalcOverhead(item.id, { allocation_pct: norm(pctV) ?? '100' }); onChanged() } catch { /* still */ } }
  const toggleShow = async (showId: string, included: boolean) => { setBusy(true); try { await setCalcOverheadShow(item.id, showId, included); onChanged() } finally { setBusy(false) } }
  const del = async () => {
    if (!confirm(`„${item.name}" löschen?`)) return
    setBusy(true)
    try { await deleteCalcPosition(item.id); onChanged() } catch { setBusy(false) }
  }
  const addLine = async () => {
    // Erste Zeile mit vorhandenem Direktbetrag vorbefüllen, damit nichts verloren geht.
    const prefill = (!hasLines && (norm(sollV) != null || norm(istV) != null)) ? { amount: norm(sollV), ist_amount: norm(istV) } : {}
    setBusy(true)
    try { await createOverheadLine(item.id, prefill); setExpanded(true); onChanged() } finally { setBusy(false) }
  }

  // Unterzeilen sortieren
  const [lDragId, setLDragId] = useState<string | null>(null)
  const [lDragOver, setLDragOver] = useState<string | null>(null)
  const reorderLine = async (targetId: string) => {
    const src = lDragId; setLDragId(null); setLDragOver(null)
    if (!src || src === targetId) return
    const order = lines.map(l => l.id)
    const from = order.indexOf(src)
    if (from < 0 || order.indexOf(targetId) < 0) return
    order.splice(from, 1); order.splice(order.indexOf(targetId), 0, src)
    try { await reorderOverheadLines(item.id, order); onChanged() } catch { /* unkritisch */ }
  }

  const sumMoney = (k: 'amount' | 'ist_amount') => lines.reduce((a, l) => a.plus(D(l[k])), new Decimal(0))

  return (
    <div onDragOver={e => e.preventDefault()} onDragEnter={onDragEnterRow} onDrop={onDropRow}
      style={{
        background: dragging ? '#243044' : '#242424', border: '1px solid #3c3c3c', borderRadius: 8, padding: '10px 12px',
        opacity: dragging ? 0.35 : 1,
        boxShadow: dropTarget ? 'inset 0 3px 0 0 #60a5fa' : undefined,
        transition: 'background 120ms ease, opacity 120ms ease, box-shadow 120ms ease',
      }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span draggable onDragStart={onDragStartRow} onDragEnd={onDragEndRow} style={{ marginRight: 2 }}><Grip dragging={dragging} /></span>
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#33312a', color: '#d6c98a', whiteSpace: 'nowrap' }}>{catName}</span>
        <input className="form-input" style={{ fontSize: '0.85rem', padding: '3px 8px', flex: '1 1 160px', minWidth: 120 }}
          value={name} onChange={e => setName(e.target.value)} onBlur={saveName} placeholder="Bezeichnung" />
        {hasLines ? (
          <>
            <span className="text-xs" style={{ color: '#9ca3af' }}>Soll <b style={{ color: '#e0e0e0', marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(sumMoney('amount'))}</b></span>
            <span className="text-xs" style={{ color: '#9ca3af' }}>Ist <b style={{ color: '#facc15', marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(sumMoney('ist_amount'))}</b></span>
          </>
        ) : (
          <>
            <label className="text-xs" style={{ color: '#9ca3af' }}>Soll
              <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.85rem', padding: '3px 8px', width: 110, marginLeft: 6 }}
                value={sollV} onChange={e => setSollV(e.target.value)} onBlur={saveAmount} placeholder="0" />
            </label>
            <label className="text-xs" style={{ color: '#9ca3af' }}>Ist
              <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.85rem', padding: '3px 8px', width: 110, marginLeft: 6, color: '#facc15' }}
                value={istV} onChange={e => setIstV(e.target.value)} onBlur={saveAmount} placeholder="0" />
            </label>
          </>
        )}
        <label className="text-xs" style={{ color: '#9ca3af' }} title="Anteil, der auf DIESE Kalkulation entfällt (z.B. 50 %, wenn die Anschaffung auch für andere Touren/Saisons genutzt wird). Gilt für Soll und Ist.">
          Anteil
          <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
            <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.85rem', padding: '3px 8px', width: 60 }}
              value={pctV} onChange={e => setPctV(e.target.value)} onBlur={savePct} placeholder="100" />
            <span style={{ marginLeft: 3 }}>%</span>
          </span>
        </label>
        <span className="text-xs" style={{ color: '#93c5fd', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{shareLabel}</span>
        <button onClick={del} disabled={busy} className="p-1 text-gray-400 hover:text-red-500 ml-auto" title="Löschen">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2" style={{ paddingTop: 8, borderTop: '1px solid #333' }}>
        <span className="text-xs mr-1" style={{ color: '#6b7280' }}>Gilt für:</span>
        {activeShows.map(s => {
          const inc = !isExcluded(s.id)
          const label = `${s.city || '(Stadt)'}${s.show_date ? ' · ' + formatDate(s.show_date) : ''}`
          return (
            <button key={s.id} onClick={() => toggleShow(s.id, !inc)} disabled={busy} title={inc ? 'Angehakt – klicken zum Abwählen' : 'Abgewählt – klicken zum Anhaken'}
              className="text-xs rounded inline-flex items-center gap-1" style={{
                padding: '2px 8px', color: inc ? '#111827' : '#9ca3af',
                background: inc ? '#60a5fa' : 'transparent', border: `1px solid ${inc ? '#60a5fa' : '#4a4a4a'}`, opacity: busy ? 0.6 : 1,
              }}>
              <span style={{ fontWeight: 700 }}>{inc ? '✓' : '×'}</span> {label}
            </button>
          )
        })}
      </div>

      {/* Einzelpositionen (Sammelposten) – aufklappbar */}
      <div className="mt-2" style={{ paddingTop: 8, borderTop: '1px solid #333' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(v => !v)} className="text-xs inline-flex items-center gap-1" style={{ color: '#9ca3af' }}>
            {expanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
            Einzelpositionen{hasLines ? ` (${lines.length})` : ''}
          </button>
          <button onClick={addLine} disabled={busy} className="btn btn-secondary inline-flex items-center gap-1" style={{ fontSize: '0.72rem', padding: '0.12rem 0.45rem' }}>
            <PlusIcon className="w-3.5 h-3.5" /> Zeile
          </button>
          {!hasLines && <span className="text-[11px]" style={{ color: '#6b7280' }}>Optional: Betrag in mehrere Rechnungen/Posten aufteilen</span>}
        </div>
        {expanded && hasLines && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-[10px]" style={{ color: '#6b7280', paddingLeft: 18 }}>
              <span style={{ flex: 1 }}>Bezeichnung</span>
              <span style={{ width: 96, textAlign: 'right' }}>Soll</span>
              <span style={{ width: 96, textAlign: 'right' }}>Ist</span>
              <span style={{ width: 22 }} />
            </div>
            {lines.map(l => (
              <LineRow key={l.id} line={l} onChanged={onChanged}
                dragging={lDragId === l.id} dropTarget={lDragOver === l.id}
                onDragStartLine={() => setLDragId(l.id)} onDragEnterLine={() => { if (lDragId && lDragId !== l.id) setLDragOver(l.id) }}
                onDragEndLine={() => { setLDragId(null); setLDragOver(null) }} onDropLine={() => reorderLine(l.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LineRow({ line, onChanged, dragging, dropTarget, onDragStartLine, onDragEnterLine, onDragEndLine, onDropLine }: {
  line: CalcOverheadLine; onChanged: () => void
  dragging: boolean; dropTarget: boolean
  onDragStartLine: () => void; onDragEnterLine: () => void; onDragEndLine: () => void; onDropLine: () => void
}) {
  const [label, setLabel] = useState(line.label ?? '')
  const [amount, setAmount] = useState(line.amount != null ? String(line.amount) : '')
  const [ist, setIst] = useState(line.ist_amount != null ? String(line.ist_amount) : '')
  const [busy, setBusy] = useState(false)

  const saveLabel = async () => { if ((label ?? '') === (line.label ?? '')) return; try { await updateOverheadLine(line.id, { label: label.trim() || null }); onChanged() } catch { /* still */ } }
  const saveAmount = async () => { try { await updateOverheadLine(line.id, { amount: norm(amount), ist_amount: norm(ist) }); onChanged() } catch { /* still */ } }
  const del = async () => { setBusy(true); try { await deleteOverheadLine(line.id); onChanged() } catch { setBusy(false) } }

  return (
    <div onDragOver={e => e.preventDefault()} onDragEnter={onDragEnterLine} onDrop={onDropLine}
      className="flex items-center gap-2"
      style={{
        background: dragging ? '#2a3340' : '#1f1f1f', border: '1px solid #333', borderRadius: 6, padding: '3px 6px',
        opacity: dragging ? 0.35 : 1,
        boxShadow: dropTarget ? 'inset 0 2px 0 0 #60a5fa' : undefined,
        transition: 'background 120ms ease, opacity 120ms ease, box-shadow 120ms ease',
      }}>
      <span draggable onDragStart={onDragStartLine} onDragEnd={onDragEndLine}><Grip dragging={dragging} /></span>
      <input className="form-input" style={{ fontSize: '0.78rem', padding: '2px 6px', flex: 1, minWidth: 80 }}
        value={label} onChange={e => setLabel(e.target.value)} onBlur={saveLabel} placeholder="z.B. Rechnung Zubehör" />
      <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.78rem', padding: '2px 6px', width: 96, fontVariantNumeric: 'tabular-nums' }}
        value={amount} onChange={e => setAmount(e.target.value)} onBlur={saveAmount} placeholder="Soll" />
      <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.78rem', padding: '2px 6px', width: 96, color: '#facc15', fontVariantNumeric: 'tabular-nums' }}
        value={ist} onChange={e => setIst(e.target.value)} onBlur={saveAmount} placeholder="Ist" />
      <button onClick={del} disabled={busy} className="p-0.5 text-gray-500 hover:text-red-500" title="Zeile löschen"><TrashIcon className="w-3.5 h-3.5" /></button>
    </div>
  )
}

function AddOverhead({ categories, onChanged }: { categories: CalcDataset['categories']; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [catId, setCatId] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const add = async () => {
    if (!catId || !name.trim()) { setErr('Bereich und Bezeichnung nötig'); return }
    setBusy(true); setErr('')
    try {
      const { id } = await createCalcPosition(catId, name.trim(), null, true)
      if (norm(amount) != null) await setCalcOverhead(id, { amount: norm(amount) })
      setName(''); setAmount(''); setOpen(false); onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false); return }
    setBusy(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-secondary inline-flex items-center gap-1" style={{ fontSize: '0.8rem' }}>
        <PlusIcon className="w-4 h-4" /> Übergeordneten Posten hinzufügen
      </button>
    )
  }
  return (
    <div style={{ background: '#1e2a24', border: '1px solid #2f5c46', borderRadius: 8, padding: '10px 12px' }}>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="form-label">Bereich</label>
          <select className="form-input" value={catId} onChange={e => setCatId(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">– wählen –</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label className="form-label">Bezeichnung</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Kulisse Festivalsaison" autoFocus />
        </div>
        <div>
          <label className="form-label">Soll (€)</label>
          <input inputMode="decimal" className="form-input text-right" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ width: 120 }} />
        </div>
        <button onClick={add} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>{busy ? '…' : 'Anlegen'}</button>
        <button onClick={() => { setOpen(false); setErr('') }} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>Abbrechen</button>
      </div>
      {err && <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{err}</p>}
    </div>
  )
}
