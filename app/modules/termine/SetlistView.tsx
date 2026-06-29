'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, GripVertical, Play, RotateCcw, Loader2, Music, Clock, Maximize2, X, Settings } from 'lucide-react'
import {
  getSetlists, createSetlist, updateSetlist, deleteSetlist,
  addSetlistItem, deleteSetlistItem, reorderSetlistItems, pushSetlistItem, skipSetlistItem, stopSetlist, resetSetlist,
  getSongs, isEditorRole, getEffectiveRole,
  getSetlistTemplates, saveSetlistAsTemplate, createSetlistFromTemplate,
  type Setlist, type Song, type SetlistTemplate,
} from '@/lib/api-client'

function secToMMSS(sec: number): string {
  const neg = sec < 0; sec = Math.abs(Math.round(sec))
  const m = Math.floor(sec / 60), s = sec % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}
function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtClockSec(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
function parseStart(hhmm: string | null): Date | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(n => parseInt(n))
  if (Number.isNaN(h)) return null
  const d = new Date(); d.setHours(h, m || 0, 0, 0); return d
}

// Zeiten einer Setlist berechnen (geplant + live ab letztem Push)
function computeTimes(sl: Setlist) {
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
  return { base, planned, actual, lastPush, deltaSec, totalSec }
}

// Show-Modus-Konfiguration (pro Gerät)
type ShowCfg = { push: boolean; timesPlanned: boolean; timesActual: boolean; duration: boolean; delta: boolean; ansagen: boolean; onlyUpcoming: boolean; font: 's' | 'm' | 'l' }
const DEFAULT_CFG: ShowCfg = { push: true, timesPlanned: true, timesActual: true, duration: true, delta: true, ansagen: true, onlyUpcoming: false, font: 'm' }
const CFG_KEY = 'pt_setlist_showcfg'
function loadCfg(): ShowCfg {
  try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') } } catch { return DEFAULT_CFG }
}

export default function SetlistView({ terminId }: { terminId: number }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [templates, setTemplates] = useState<SetlistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const isEditor = isEditorRole(getEffectiveRole())
  const focusedRef = useRef(false)
  const draggingRef = useRef(false)

  // Show-Modus (Vollbild) – pro Gerät
  const [showId, setShowId] = useState<number | null>(null)
  const [cfg, setCfg] = useState<ShowCfg>(DEFAULT_CFG)
  const [gearOpen, setGearOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { setCfg(loadCfg()) }, [])
  useEffect(() => {
    if (showId === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [showId])
  const setCfgPersist = (patchCfg: Partial<ShowCfg>) => {
    setCfg(prev => { const next = { ...prev, ...patchCfg }; try { localStorage.setItem(CFG_KEY, JSON.stringify(next)) } catch {}; return next })
  }

  const refetch = useCallback(async () => {
    try { setSetlists(await getSetlists(terminId)) } catch { /* still */ }
  }, [terminId])

  useEffect(() => {
    Promise.all([getSetlists(terminId), getSongs(), getSetlistTemplates()])
      .then(([sl, sg, tpl]) => { setSetlists(sl); setSongs(sg); setTemplates(tpl) })
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
  const addFromTemplate = async (templateId: number) => {
    try { const s = await createSetlistFromTemplate(terminId, templateId); setSetlists(prev => [...prev, s]) } catch {}
  }
  const saveAsTemplate = async (sl: Setlist) => {
    const name = prompt('Name der Vorlage:', sl.title)
    if (name === null) return
    try { await saveSetlistAsTemplate(sl.id, name.trim() || sl.title); setTemplates(await getSetlistTemplates()) } catch {}
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
  const toggleStop = async (sl: Setlist) => {
    const wasEnded = !!sl.endedAt
    patch(sl.id, s => ({ ...s, endedAt: wasEnded ? null : new Date().toISOString() }))
    try { await stopSetlist(sl.id, wasEnded) } catch {}
  }
  const resetRun = async (sl: Setlist) => {
    if (!confirm('Alle gedrückten Zeiten dieser Setlist wirklich zurücksetzen?')) return
    patch(sl.id, s => ({ ...s, endedAt: null, items: s.items.map(i => ({ ...i, startedAt: null })) }))
    try { await resetSetlist(sl.id) } catch {}
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
    const sl = setlists.find(s => s.id === sid)
    if (!sl) { endDrag(); return }
    const items = [...sl.items]
    const [m] = items.splice(d.idx, 1)
    items.splice(target, 0, m)
    const order = items.map(i => i.id)
    patch(sid, s => ({ ...s, items }))
    try { await reorderSetlistItems(sid, order) } catch {}
    endDrag()
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Lädt…</div>

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      {isEditor && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={addSetlist} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Neue Setlist
          </button>
          {templates.length > 0 && (
            <select value="" onChange={e => { const id = parseInt(e.target.value); if (id) addFromTemplate(id); e.target.value = '' }}
              className="bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg px-2 py-2 text-sm text-gray-200 outline-none">
              <option value="">Aus Vorlage …</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title} ({t.itemCount})</option>)}
            </select>
          )}
        </div>
      )}

      {setlists.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm">
          <Music className="w-6 h-6 mb-2" />
          {isEditor ? 'Noch keine Setlist – oben anlegen.' : 'Noch keine Setlist.'}
        </div>
      )}

      {setlists.map(sl => {
        const { base, planned, actual, lastPush, deltaSec, totalSec } = computeTimes(sl)

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
              {(sl.items.some(i => i.startedAt) || sl.endedAt) && (
                <button onClick={() => resetRun(sl)} className="text-gray-400 hover:text-amber-400 p-0.5" title="Push-Zeiten zurücksetzen"><RotateCcw className="w-4 h-4" /></button>
              )}
              {isEditor && <button onClick={() => saveAsTemplate(sl)} className="text-xs text-gray-400 hover:text-blue-400 px-1.5 py-0.5" title="Als Vorlage speichern">Vorlage</button>}
              <button onClick={() => setShowId(sl.id)} className="text-gray-400 hover:text-blue-400 p-0.5" title="Show-Modus (Vollbild)"><Maximize2 className="w-4 h-4" /></button>
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
                    <span className="tabular-nums text-sm w-12 shrink-0 text-gray-500" title="geplant">{planned[idx] ? fmtClock(planned[idx] as Date) : '–'}</span>
                    <span className={`tabular-nums text-sm w-12 shrink-0 ${isLive ? 'text-blue-300 font-semibold' : 'text-gray-400'}`} title="aktuell">{t ? fmtClock(t) : '–'}</span>
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

            {/* Gesamtdauer */}
            <div className="px-3 py-2 border-t border-[#3a3a3a] bg-[#262626] flex items-center justify-between text-sm">
              <span className="text-gray-400">Gesamtdauer</span>
              <span className="tabular-nums font-semibold text-gray-200">{secToMMSS(totalSec)}{base ? ` · Ende ~${fmtClock(new Date(base.getTime() + totalSec * 1000))}` : ''}</span>
            </div>
          </div>
        )
      })}

      {/* ── Show-Modus (Vollbild) ── */}
      {showId !== null && (() => {
        const sl = setlists.find(s => s.id === showId)
        if (!sl) return null
        const { base, planned, actual, lastPush, deltaSec, totalSec } = computeTimes(sl)
        const cur = lastPush >= 0 ? sl.items[lastPush] : null
        const liveNow = sl.endedAt ? new Date(sl.endedAt).getTime() : now
        const runningSec = cur?.startedAt ? Math.floor((liveNow - new Date(cur.startedAt).getTime()) / 1000) : null
        const remainingSec = cur && runningSec !== null ? cur.durationSec - runningSec : null
        const fontItem = cfg.font === 'l' ? 'text-3xl' : cfg.font === 's' ? 'text-lg' : 'text-2xl'
        const visible = sl.items
          .map((it, idx) => ({ it, idx }))
          .filter(({ it, idx }) => (cfg.ansagen || it.type !== 'ansage') && (!cfg.onlyUpcoming || idx >= lastPush))

        return (
          <div className="fixed inset-0 z-[100] bg-gray-950 text-white flex flex-col">
            {/* Topbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
              <span className="text-lg font-bold flex-1 truncate">{sl.title}</span>
              <button onClick={() => toggleStop(sl)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${sl.endedAt ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
                {sl.endedAt ? 'Fortsetzen' : 'Show stoppen'}
              </button>
              <button onClick={() => resetRun(sl)} title="Push-Zeiten zurücksetzen" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2d2d2d] hover:bg-[#3a3a3a] text-gray-200 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <div className="relative">
                <button onClick={() => setGearOpen(o => !o)} className="p-2 text-gray-300 hover:text-white"><Settings className="w-5 h-5" /></button>
                {gearOpen && (
                  <div className="absolute right-0 top-full mt-1 z-10 bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg shadow-xl p-3 w-56 space-y-2 text-sm">
                    {([['push', 'Push-Button'], ['timesPlanned', 'Geplante Zeit'], ['timesActual', 'Aktuelle Zeit'], ['duration', 'Dauer'], ['delta', 'Timing/Delta'], ['ansagen', 'Ansagen'], ['onlyUpcoming', 'Nur kommende Songs']] as [keyof ShowCfg, string][]).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-gray-200 cursor-pointer">
                        <input type="checkbox" checked={!!cfg[k]} onChange={e => setCfgPersist({ [k]: e.target.checked } as Partial<ShowCfg>)} className="w-4 h-4 accent-blue-500" /> {label}
                      </label>
                    ))}
                    <div className="flex items-center gap-2 pt-1 border-t border-[#3a3a3a]">
                      <span className="text-gray-400 text-xs">Schrift</span>
                      {(['s', 'm', 'l'] as const).map(f => (
                        <button key={f} onClick={() => setCfgPersist({ font: f })} className={`px-2 py-0.5 rounded text-xs ${cfg.font === f ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-300'}`}>{f.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { setShowId(null); setGearOpen(false) }} className="p-2 text-gray-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Aktueller Song + Ticker */}
            {cur && (
              <div className="px-5 py-4 border-b border-gray-800 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Jetzt</div>
                  <div className="text-3xl md:text-4xl font-bold truncate">{cur.title}</div>
                </div>
                {runningSec !== null && (
                  <div className="text-right shrink-0">
                    <div className={`text-4xl md:text-5xl font-bold tabular-nums ${remainingSec !== null && remainingSec < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {remainingSec !== null ? (remainingSec < 0 ? `+${secToMMSS(-remainingSec)}` : secToMMSS(remainingSec)) : secToMMSS(runningSec)}
                    </div>
                    <div className="text-xs text-gray-500">{remainingSec !== null && remainingSec < 0 ? 'über Zeit' : 'verbleibend'} · läuft {secToMMSS(runningSec)} / {secToMMSS(cur.durationSec)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Delta */}
            {cfg.delta && deltaSec !== null && (
              <div className={`px-5 py-2 text-center text-lg font-semibold ${deltaSec > 30 ? 'bg-red-500/15 text-red-300' : deltaSec < -30 ? 'bg-green-500/15 text-green-300' : 'bg-blue-500/15 text-blue-300'}`}>
                {deltaSec > 0 ? `${secToMMSS(deltaSec)} hinter Plan` : deltaSec < 0 ? `${secToMMSS(-deltaSec)} vor Plan` : 'Im Plan'}
              </div>
            )}

            {/* Liste */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {visible.map(({ it, idx }) => {
                const t = actual[idx] ?? planned[idx]
                const isCur = idx === lastPush
                const isNext = lastPush >= 0 && idx > lastPush && !sl.items.slice(lastPush + 1, idx).some(x => !x.skipped)
                return (
                  <div key={it.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isCur ? 'bg-blue-600/25' : isNext ? 'bg-white/5' : ''} ${it.skipped ? 'opacity-30 line-through' : ''}`}>
                    {cfg.timesPlanned && <span className="tabular-nums text-gray-500 w-20 shrink-0" title="geplant">{planned[idx] ? fmtClockSec(planned[idx] as Date) : '–'}</span>}
                    {cfg.timesActual && <span className="tabular-nums text-gray-200 w-20 shrink-0" title="aktuell">{t ? fmtClockSec(t) : '–'}</span>}
                    {cfg.push && (
                      <button onClick={() => togglePush(sl.id, it.id, !!it.startedAt)}
                        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${it.startedAt ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-200 hover:bg-[#3a3a3a]'}`}>
                        {it.startedAt ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    )}
                    <span className={`flex-1 min-w-0 truncate ${fontItem} ${isCur ? 'font-bold' : ''}`}>
                      {it.type === 'ansage' && <span className="text-xs uppercase tracking-wide text-amber-400/80 mr-2">Ansage</span>}
                      {it.title}
                    </span>
                    {cfg.duration && <span className="tabular-nums text-gray-400 shrink-0">{secToMMSS(it.durationSec)}</span>}
                  </div>
                )
              })}
            </div>

            {/* Gesamtdauer */}
            <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-sm text-gray-400">Gesamtdauer</span>
              <span className="tabular-nums text-lg font-semibold">{secToMMSS(totalSec)}{base ? ` · Ende ~${fmtClock(new Date(base.getTime() + totalSec * 1000))}` : ''}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
