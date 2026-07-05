'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, RotateCcw, Settings, Loader2, Music } from 'lucide-react'
import {
  getSetlists, pushSetlistItem, skipSetlistItem, stopSetlist, resetSetlist,
  type Setlist,
} from '@/lib/api-client'

function secToMMSS(sec: number): string {
  const neg = sec < 0; sec = Math.abs(Math.round(sec))
  return `${neg ? '-' : ''}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
function fmtClockSec(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
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

type ShowCfg = { push: boolean; timesPlanned: boolean; timesActual: boolean; duration: boolean; delta: boolean; ansagen: boolean; onlyUpcoming: boolean; font: 's' | 'm' | 'l' }
const DEFAULT_CFG: ShowCfg = { push: true, timesPlanned: true, timesActual: true, duration: true, delta: true, ansagen: true, onlyUpcoming: false, font: 'm' }
const CFG_KEY = 'pt_setlist_showcfg'
function loadCfg(): ShowCfg { try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') } } catch { return DEFAULT_CFG } }

export default function SetlistShowView({ terminId }: { terminId: number }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [cfg, setCfg] = useState<ShowCfg>(DEFAULT_CFG)
  const [gearOpen, setGearOpen] = useState(false)

  const refetch = useCallback(async () => { try { setSetlists(await getSetlists(terminId)) } catch {} }, [terminId])
  useEffect(() => {
    setCfg(loadCfg())
    getSetlists(terminId).then(sl => { setSetlists(sl); if (sl.length) setSelId(sl[0].id) }).catch(() => {}).finally(() => setLoading(false))
  }, [terminId])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { const t = setInterval(refetch, 4000); return () => clearInterval(t) }, [refetch])

  const setCfgPersist = (p: Partial<ShowCfg>) => setCfg(prev => { const n = { ...prev, ...p }; try { localStorage.setItem(CFG_KEY, JSON.stringify(n)) } catch {}; return n })
  const patch = (id: number, fn: (s: Setlist) => Setlist) => setSetlists(prev => prev.map(s => s.id === id ? fn(s) : s))

  const togglePush = async (sid: number, itemId: number, has: boolean) => {
    patch(sid, s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, startedAt: has ? null : new Date().toISOString() } : i) }))
    try { await pushSetlistItem(itemId, has) } catch {}
  }
  const toggleSkip = async (sid: number, itemId: number, skipped: boolean) => {
    patch(sid, s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, skipped } : i) }))
    try { await skipSetlistItem(itemId, skipped) } catch {}
  }
  const toggleStop = async (sl: Setlist) => {
    const was = !!sl.endedAt
    patch(sl.id, s => ({ ...s, endedAt: was ? null : new Date().toISOString() }))
    try { await stopSetlist(sl.id, was) } catch {}
  }
  const resetRun = async (sl: Setlist) => {
    if (!confirm('Alle gedrückten Zeiten wirklich zurücksetzen?')) return
    patch(sl.id, s => ({ ...s, endedAt: null, items: s.items.map(i => ({ ...i, startedAt: null })) }))
    try { await resetSetlist(sl.id) } catch {}
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  const sl = setlists.find(s => s.id === selId) || setlists[0]
  if (!sl) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-gray-500 gap-2">
      <Music className="w-8 h-8" /> Keine Setlist vorhanden.
    </div>
  )

  const { base, planned, actual, lastPush, deltaSec, totalSec } = computeTimes(sl)
  const cur = lastPush >= 0 ? sl.items[lastPush] : null
  const liveNow = sl.endedAt ? new Date(sl.endedAt).getTime() : now
  const runningSec = cur?.startedAt ? Math.floor((liveNow - new Date(cur.startedAt).getTime()) / 1000) : null
  const remainingSec = cur && runningSec !== null ? cur.durationSec - runningSec : null
  const fontItem = cfg.font === 'l' ? 'text-3xl' : cfg.font === 's' ? 'text-lg' : 'text-2xl'
  const visible = sl.items.map((it, idx) => ({ it, idx })).filter(({ it, idx }) => (cfg.ansagen || it.type !== 'ansage') && (!cfg.onlyUpcoming || idx >= lastPush))
  const plannedEnd = base ? new Date(base.getTime() + totalSec * 1000) : null
  let actualEnd: Date | null = null
  if (lastPush >= 0) {
    const anchor = new Date(sl.items[lastPush].startedAt as string).getTime()
    let rem = 0
    for (let i = lastPush; i < sl.items.length; i++) if (!sl.items[i].skipped) rem += sl.items[i].durationSec
    actualEnd = new Date(anchor + rem * 1000)
  }
  const endDelta = plannedEnd && actualEnd ? Math.round((actualEnd.getTime() - plannedEnd.getTime()) / 1000) : null

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
        {setlists.length > 1 ? (
          <select value={sl.id} onChange={e => setSelId(parseInt(e.target.value))} className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-2 py-1 text-lg font-bold text-white outline-none">
            {setlists.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        ) : <span className="text-lg font-bold flex-1 truncate">{sl.title}</span>}
        {setlists.length > 1 && <span className="flex-1" />}
        <button onClick={() => toggleStop(sl)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${sl.endedAt ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white`}>
          {sl.endedAt ? 'Fortsetzen' : 'Show stoppen'}
        </button>
        <button onClick={() => resetRun(sl)} title="Zurücksetzen" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2d2d2d] hover:bg-[#3a3a3a] text-gray-200 flex items-center gap-1.5">
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
                <button onClick={() => togglePush(sl.id, it.id, !!it.startedAt)} className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${it.startedAt ? 'bg-blue-600 text-white' : 'bg-[#2d2d2d] text-gray-200 hover:bg-[#3a3a3a]'}`}>
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

      {/* Zusammenfassung */}
      <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between gap-6 text-sm">
        <span className="text-gray-400">Gesamtdauer <span className="tabular-nums text-gray-200 font-semibold ml-1">{secToMMSS(totalSec)}</span></span>
        {plannedEnd && <span className="text-gray-400">Soll-Ende <span className="tabular-nums text-gray-200 font-semibold ml-1">{fmtClock(plannedEnd)}</span></span>}
        {actualEnd && (
          <span className="text-gray-400">Ist-Ende <span className={`tabular-nums font-bold ml-1 ${endDelta !== null && endDelta > 30 ? 'text-red-400' : endDelta !== null && endDelta < -30 ? 'text-green-400' : 'text-gray-200'}`}>{fmtClock(actualEnd)}{endDelta ? ` (${endDelta > 0 ? '+' : '-'}${secToMMSS(Math.abs(endDelta))})` : ''}</span></span>
        )}
      </div>
    </div>
  )
}
