'use client'

// Kalkulation – Übergeordnete Kosten (Phase 3).
// Posten (z.B. Kulisse, Anschaffung) mit einem Betrag, der sich gleichmäßig auf
// die angehakten aktiven Shows verteilt. Häkchen ab-/anwählen rechnet die Umlage
// live neu (Umlage = Soll ÷ Anzahl angehakter Shows). Siehe engine.ts Regel 4.

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, updateCalcPosition, deleteCalcPosition,
  setCalcOverhead, setCalcOverheadShow,
} from '@/lib/api-client'
import type { CalcDataset } from '@/lib/calculation/types'
import { formatMoney, formatDate } from '@/lib/calculation/format'

const norm = (v: string): string | null => { const t = v.trim().replace(',', '.'); return t === '' ? null : t }
const D = (v: unknown): Decimal => { try { return new Decimal(v == null || v === '' ? 0 : (v as string)) } catch { return new Decimal(0) } }

export default function OverheadView({ dataset, onChanged }: { dataset: CalcDataset; projectId: string; onChanged: () => void }) {
  const activeShows = useMemo(
    () => dataset.shows.filter(s => s.is_active).slice().sort((a, b) => a.sort_order - b.sort_order),
    [dataset])
  const items = useMemo(
    () => dataset.positions.filter(p => p.is_overhead).slice().sort((a, b) => a.sort_order - b.sort_order),
    [dataset])
  const categories = useMemo(() => dataset.categories.slice().sort((a, b) => a.sort_order - b.sort_order), [dataset])

  // Betrag (Soll/Ist) je Posten = die eine Fixkosten-Buchung (show_id NULL)
  const amountOf = (posId: string) => dataset.entries.find(e => e.position_id === posId && e.show_id == null)
  // Ausnahmen: Posten gilt NICHT für diese Show
  const excluded = (posId: string, showId: string) =>
    (dataset.overheadExclude ?? []).some(x => x.position_id === posId && x.show_id === showId)
  const includedCount = (posId: string) => activeShows.filter(s => !excluded(posId, s.id)).length

  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: '#9ca3af', lineHeight: 1.5 }}>
        Übergeordnete Kosten verteilen sich automatisch gleichmäßig auf die angehakten Shows
        (<span style={{ color: '#e0e0e0' }}>Umlage = Soll ÷ Anzahl angehakter Shows</span>).
        Eine Show abwählen, wenn der Posten dort nicht anfällt – die Umlage rechnet sich sofort neu.
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
            const soll = D(e?.amount)
            const share = n > 0 ? soll.div(n) : new Decimal(0)
            return (
              <OverheadRow key={item.id} item={item} catName={catName(item.category_id)}
                soll={e?.amount != null ? String(e.amount) : ''} ist={e?.ist_amount != null ? String(e.ist_amount) : ''}
                shareLabel={n > 0 ? `${formatMoney(share)} je Show (${n})` : 'keine Show angehakt'}
                activeShows={activeShows} isExcluded={sid => excluded(item.id, sid)} onChanged={onChanged} />
            )
          })}
        </div>
      )}

      <AddOverhead categories={categories} onChanged={onChanged} />
    </div>
  )
}

function OverheadRow({ item, catName, soll, ist, shareLabel, activeShows, isExcluded, onChanged }: {
  item: { id: string; name: string }
  catName: string; soll: string; ist: string; shareLabel: string
  activeShows: CalcDataset['shows']
  isExcluded: (showId: string) => boolean
  onChanged: () => void
}) {
  const [name, setName] = useState(item.name)
  const [sollV, setSollV] = useState(soll)
  const [istV, setIstV] = useState(ist)
  const [busy, setBusy] = useState(false)

  const saveName = async () => { const nn = name.trim(); if (!nn || nn === item.name) { setName(item.name); return } try { await updateCalcPosition(item.id, { name: nn }); onChanged() } catch { setName(item.name) } }
  const saveAmount = async () => { try { await setCalcOverhead(item.id, { amount: norm(sollV), ist_amount: norm(istV) }); onChanged() } catch { /* still */ } }
  const toggleShow = async (showId: string, included: boolean) => {
    setBusy(true)
    try { await setCalcOverheadShow(item.id, showId, included); onChanged() } finally { setBusy(false) }
  }
  const del = async () => {
    if (!confirm(`„${item.name}" löschen?`)) return
    setBusy(true)
    try { await deleteCalcPosition(item.id); onChanged() } catch { setBusy(false) }
  }

  return (
    <div style={{ background: '#242424', border: '1px solid #3c3c3c', borderRadius: 8, padding: '10px 12px' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#33312a', color: '#d6c98a', whiteSpace: 'nowrap' }}>{catName}</span>
        <input className="form-input" style={{ fontSize: '0.85rem', padding: '3px 8px', flex: '1 1 160px', minWidth: 120 }}
          value={name} onChange={e => setName(e.target.value)} onBlur={saveName} placeholder="Bezeichnung" />
        <label className="text-xs" style={{ color: '#9ca3af' }}>Soll
          <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.85rem', padding: '3px 8px', width: 110, marginLeft: 6 }}
            value={sollV} onChange={e => setSollV(e.target.value)} onBlur={saveAmount} placeholder="0" />
        </label>
        <label className="text-xs" style={{ color: '#9ca3af' }}>Ist
          <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.85rem', padding: '3px 8px', width: 110, marginLeft: 6, color: '#facc15' }}
            value={istV} onChange={e => setIstV(e.target.value)} onBlur={saveAmount} placeholder="0" />
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
                padding: '2px 8px',
                color: inc ? '#111827' : '#9ca3af',
                background: inc ? '#60a5fa' : 'transparent',
                border: `1px solid ${inc ? '#60a5fa' : '#4a4a4a'}`,
                opacity: busy ? 0.6 : 1,
              }}>
              <span style={{ fontWeight: 700 }}>{inc ? '✓' : '×'}</span> {label}
            </button>
          )
        })}
      </div>
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
