'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, GripVertical, Play, RotateCcw, Loader2, Music, Clock } from 'lucide-react'
import {
  getSetlists, createSetlist, updateSetlist, deleteSetlist,
  addSetlistItem, deleteSetlistItem, reorderSetlistItems, pushSetlistItem, skipSetlistItem,
  getSongs, isEditorRole, getEffectiveRole,
  type Setlist, type Song,
} from '@/lib/api-client'

function secToMMSS(sec: number): string {
  const neg = sec < 0; sec = Math.abs(Math.round(sec))
  const m = Math.floor(sec / 60), s = sec % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}
function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function parseStart(hhmm: string | null): Date | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(n => parseInt(n))
  if (Number.isNaN(h)) return null
  const d = new Date(); d.setHours(h, m || 0, 0, 0); return d
}

export default function SetlistView({ terminId }: { terminId: number }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const isEditor = isEditorRole(getEffectiveRole())
  const focusedRef = useRef(false)
  const draggingRef = useRef(false)

  const refetch = useCallback(async () => {
    try { setSetlists(await getSetlists(terminId)) } catch { /* still */ }
  }, [terminId])

  useEffect(() => {
    Promise.all([getSetlists(terminId), getSongs()])
      .then(([sl, sg]) => { setSetlists(sl); setSongs(sg) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [terminId])

  // Live-Sync: alle 6s nachladen (pausiert während Eingabe)
  useEffect(() => {
    const t = setInterval(() => { if (!focusedRef.current && !draggingRef.current) refetch() }, 6000)
    return () => clearInterval(t)
  }, [refetch])

  const patch = (id: number, fn: (s: Setlist) => Setlist) => setSetlists(prev => prev.map(s => s.id === id ? fn(s) : s))

  // ── Setlist ──
  const addSetlist = async () => {
    try { const s = await createSetlist(terminId, 'Setlist', '20:00'); setSetlists(prev => [...prev, s]) } catch {}
  }
  const renameSetlist = (id: number, title: string) => patch(id, s => ({ ...s, title }))
  const setStart = (id: number, startTime: string) => patch(id, s => ({ ...s, startTime }))
  const saveSetlist = async (id: number, p: { title?: string; startTime?: string | null }) => { try { await updateSetlist(id, p) } catch {} }
  const removeSetlist = async (id: number) => { if (!confirm('Setlist löschen?')) return; try { await deleteSetlist(id); setSetlists(prev => prev.filter(s => s.id !== id)) } catch {} }

  // ── Items ──
  const addItem = async (setlistId: number, songId: number) => {
    try { const it = await addSetlistItem(setlistId, songId); patch(setlistId, s => ({ ...s, items: [...s.items, it] })) } catch {}
  }
  const removeItem = async (setlistId: number, itemId: number) => {
    try { await deleteSetlistItem(itemId); patch(setlistId, s => ({ ...s, items: s.items.filter(i => i.id !== itemId) })) } catch {}
  }
  const togglePush = async (setlistId: number, itemId: number, has: boolean) => {
    const now = new Date().toISOString()
    patch(setlistId, s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, startedAt: has ? null : now } : i) }))
    try { await pushSetlistItem(itemId, has) } catch {}
  }
  const toggleSkip = async (setlistId: number, itemId: number, skipped: boolean) => {
    patch(setlistId, s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, skipped } : i) }))
    try { await skipSetlistItem(itemId, skipped) } catch {}
  }

  // ── Drag ──
  const dragRef = useRef<{ sid: number; idx: number } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const startDrag = (sid: number, idx: number) => { dragRef.current = { sid, idx }; draggingRef.current = true; setDragging(`${sid}-${idx}`) }
  const endDrag = () => { dragRef.current = null; draggingRef.current = false; setDragging(null); setDragOver(null) }
  const onDrop = async (sid: number, target: number) => {
    const d = dragRef.current
    setDragOver(null)
    if (!d || d.sid !== sid || d.idx === target) { endDrag(); return }
    let order: number[] = []
    patch(sid, s => {
      const items = [...s.items]; const [m] = items.splice(d.idx, 1); items.splice(target, 0, m)
      order = items.map(i => i.id); return { ...s, items }
    })
    try { await reorderSetlistItems(sid, order) } catch {}
    endDrag()
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Lädt…</div>

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      {isEditor && (
        <button onClick={addSetlist} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Neue Setlist
        </button>
      )}

      {setlists.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
          <Music className="w-6 h-6 mb-2" />
          {isEditor ? 'Noch keine Setlist – oben anlegen.' : 'Noch keine Setlist.'}
        </div>
      )}

      {setlists.map(sl => {
        // Zeiten berechnen
        const base = parseStart(sl.startTime)
        const planned: (Date | null)[] = []
        let acc = 0
        for (const it of sl.items) { planned.push(base ? new Date(base.getTime() + acc * 1000) : null); if (!it.skipped) acc += it.durationSec }
        let lastPush = -1
        for (let i = 0; i < sl.items.length; i++) if (sl.items[i].startedAt) lastPush = i
        const actual: (Date | null)[] = new Array(sl.items.length).fill(null)
        if (lastPush >= 0) {
          const anchor = new Date(sl.items[lastPush].startedAt as string).getTime()
          let a = 0
          for (let i = lastPush; i < sl.items.length; i++) { actual[i] = new Date(anchor + a * 1000); if (!sl.items[i].skipped) a += sl.items[i].durationSec }
        }
        let deltaSec: number | null = null
        if (lastPush >= 0 && planned[lastPush]) deltaSec = Math.round((new Date(sl.items[lastPush].startedAt as string).getTime() - (planned[lastPush] as Date).getTime()) / 1000)
        const totalSec = sl.items.filter(i => !i.skipped).reduce((a, i) => a + i.durationSec, 0)
        const usedSongIds = new Set<number>() // erlaubt Mehrfachnutzung; nur für optionale Hinweise

        return (
          <div key={sl.id} className="border border-[#3a3a3a] rounded-xl overflow-hidden">
            {/* Kopf */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#2d2d2d] border-b border-[#3a3a3a]">
              {isEditor ? (
                <input value={sl.title}
                  onFocus={() => { focusedRef.current = true }} onBlur={e => { focusedRef.current = false; saveSetlist(sl.id, { title: e.target.value }) }}
                  onChange={e => renameSetlist(sl.id, e.target.value)}
                  className="flex-1 min-w-[120px] bg-transparent text-base font-semibold text-white outline-none" />
              ) : <span className="flex-1 text-base font-semibold text-white">{sl.title}</span>}
              <div className="flex items-center gap-1.5 text-sm text-gray-300">
                <Clock className="w-4 h-4 text-gray-400" /> Start
                {isEditor ? (
                  <input type="time" value={sl.startTime || ''}
                    onFocus={() => { focusedRef.current = true }} onBlur={e => { focusedRef.current = false; saveSetlist(sl.id, { startTime: e.target.value || null }) }}
                    onChange={e => setStart(sl.id, e.target.value)}
                    className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-2 py-1 text-white outline-none" />
                ) : <span className="text-white">{sl.startTime || '–'}</span>}
              </div>
              <span className="text-xs text-gray-400">Σ {secToMMSS(totalSec)}{base ? ` · Ende ~${fmtClock(new Date(base.getTime() + totalSec * 1000))}` : ''}</span>
              {isEditor && <button onClick={() => removeSetlist(sl.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-4 h-4" /></button>}
            </div>

            {/* Delta-Banner live */}
            {deltaSec !== null && (
              <div className={`px-4 py-1.5 text-sm font-medium ${deltaSec > 30 ? 'bg-red-500/15 text-red-300' : deltaSec < -30 ? 'bg-green-500/15 text-green-300' : 'bg-blue-500/15 text-blue-300'}`}>
                {deltaSec > 0 ? `${secToMMSS(deltaSec)} hinter Plan` : deltaSec < 0 ? `${secToMMSS(-deltaSec)} vor Plan` : 'Im Plan'}
              </div>
            )}

            {/* Items */}
            <div>
              {sl.items.map((it, idx) => {
                const t = actual[idx] ?? planned[idx]
                const isLive = lastPush >= 0 && idx >= lastPush
                usedSongIds.add(it.songId ?? -1)
                return (
                  <div key={it.id}
                    draggable={isEditor}
                    onDragStart={() => startDrag(sl.id, idx)}
                    onDragEnter={() => { if (draggingRef.current) setDragOver(`${sl.id}-${idx}`) }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(sl.id, idx)}
                    onDragEnd={endDrag}
                    className={`relative flex items-center gap-2 px-3 py-2 border-t border-[#2d2d2d] transition-all duration-150 ${dragging === `${sl.id}-${idx}` ? 'opacity-40 scale-[.99]' : it.skipped ? 'opacity-40' : ''}`}
                  >
                    {dragOver === `${sl.id}-${idx}` && dragging !== `${sl.id}-${idx}` && (
                      <div className="absolute -top-px left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                    )}
                    {isEditor && <span className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-4 h-4" /></span>}
                    {/* Zeit */}
                    <span className={`tabular-nums text-sm w-12 shrink-0 ${isLive ? 'text-blue-300 font-semibold' : 'text-gray-400'}`}>{t ? fmtClock(t) : '–'}</span>
                    {/* Push */}
                    <button onClick={() => togglePush(sl.id, it.id, !!it.startedAt)} title={it.startedAt ? 'Push zurücksetzen' : 'Song-Start pushen'}
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${it.startedAt ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-300 hover:bg-[#3a3a3a]'}`}>
                      {it.startedAt ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    {/* Titel */}
                    <span className={`flex-1 min-w-0 truncate text-sm ${it.skipped ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                      {it.type === 'ansage' && <span className="text-[10px] uppercase tracking-wide text-amber-400/80 mr-1.5">Ansage</span>}
                      {it.title || '(ohne Titel)'}
                    </span>
                    <span className="tabular-nums text-xs text-gray-400 shrink-0">{secToMMSS(it.durationSec)}</span>
                    {/* Streichen (alle) */}
                    <button onClick={() => toggleSkip(sl.id, it.id, !it.skipped)} title={it.skipped ? 'Wieder aufnehmen' : 'Streichen'}
                      className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${it.skipped ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:text-amber-400'}`}>
                      {it.skipped ? '↩' : '✕'}
                    </button>
                    {isEditor && <button onClick={() => removeItem(sl.id, it.id)} className="shrink-0 text-gray-600 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                )
              })}
              {sl.items.length === 0 && <div className="px-4 py-4 text-xs text-gray-500">Noch keine Einträge.</div>}
            </div>

            {/* Hinzufügen */}
            {isEditor && (
              <div className="px-3 py-2 border-t border-[#2d2d2d] flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value=""
                  onChange={e => { const id = parseInt(e.target.value); if (id) addItem(sl.id, id); e.target.value = '' }}
                  className="flex-1 bg-[#1f1f1f] border border-[#3a3a3a] rounded px-2 py-1.5 text-sm text-gray-200 outline-none"
                >
                  <option value="">Song / Ansage hinzufügen …</option>
                  <optgroup label="Songs">
                    {songs.filter(s => s.type === 'song').map(s => <option key={s.id} value={s.id}>{s.title} ({secToMMSS(s.durationSec)})</option>)}
                  </optgroup>
                  <optgroup label="Ansagen">
                    {songs.filter(s => s.type === 'ansage').map(s => <option key={s.id} value={s.id}>{s.title} ({secToMMSS(s.durationSec)})</option>)}
                  </optgroup>
                </select>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
