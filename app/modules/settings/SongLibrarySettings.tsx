'use client'

import { useState, useEffect } from 'react'
import { Music, Plus, Trash2, Pencil, X } from 'lucide-react'
import { getSongs, createSong, updateSong, deleteSong, type Song, type SongType, type SongInput } from '@/lib/api-client'

function secToMMSS(sec: number): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function parseDuration(str: string): number {
  const t = (str || '').trim()
  if (!t) return 0
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    return (parseInt(m) || 0) * 60 + (parseInt(s) || 0)
  }
  return (parseInt(t) || 0) * 60 // ohne Doppelpunkt = Minuten
}

const EMPTY: SongInput = { type: 'song', title: '', durationSec: 0, bpm: null, gemaWorkNo: '', lyricist: '', composer: '', publisher: '', notes: '', startTimecode: '' }

export default function SongLibrarySettings() {
  const [tab, setTab] = useState<SongType>('song')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<SongInput>(EMPTY)
  const [durStr, setDurStr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getSongs().then(setSongs).catch(() => {}).finally(() => setLoading(false)) }, [])

  const list = songs.filter(s => s.type === tab)

  const startAdd = () => { setForm({ ...EMPTY, type: tab }); setDurStr(''); setEditId('new') }
  const startEdit = (s: Song) => {
    setForm({ type: s.type, title: s.title, durationSec: s.durationSec, bpm: s.bpm, gemaWorkNo: s.gemaWorkNo, lyricist: s.lyricist, composer: s.composer, publisher: s.publisher, notes: s.notes, startTimecode: s.startTimecode })
    setDurStr(secToMMSS(s.durationSec)); setEditId(s.id)
  }
  const cancel = () => { setEditId(null); setForm(EMPTY); setDurStr('') }

  const save = async () => {
    if (!form.title?.trim()) return
    setSaving(true)
    const payload: SongInput = { ...form, type: tab, durationSec: parseDuration(durStr) }
    try {
      if (editId === 'new') { const s = await createSong(payload); setSongs(prev => [...prev, s]) }
      else if (typeof editId === 'number') { await updateSong(editId, payload); setSongs(prev => prev.map(x => x.id === editId ? { ...x, ...payload, durationSec: payload.durationSec! } as Song : x)) }
      cancel()
    } catch { /* still */ } finally { setSaving(false) }
  }
  const remove = async (id: number) => {
    if (!confirm('Wirklich löschen?')) return
    try { await deleteSong(id); setSongs(prev => prev.filter(s => s.id !== id)) } catch {}
  }

  const inp = 'w-full px-2 py-1.5 bg-[var(--surface-3)] border border-[var(--border)] rounded text-sm text-white outline-none focus:border-blue-500'
  const lbl = 'block text-[11px] text-gray-400 mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2"><Music className="w-5 h-5" /> Songs &amp; Ansagen</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-lg w-fit">
        {(['song', 'ansage'] as SongType[]).map(t => (
          <button key={t} onClick={() => { setTab(t); cancel() }}
            className={`px-4 py-1.5 text-sm rounded-md ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'song' ? 'Songs' : 'Ansagen'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-gray-400 py-4">Lädt…</div> : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 border border-[var(--border)] rounded-lg">
              <span className="flex-1 text-sm text-gray-100 truncate">{s.title || <span className="text-gray-500">(ohne Titel)</span>}</span>
              <span className="text-xs text-gray-400 tabular-nums">{secToMMSS(s.durationSec) || '–'}</span>
              {tab === 'song' && s.bpm ? <span className="text-xs text-gray-500">{s.bpm} BPM</span> : null}
              <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-blue-500 p-0.5"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-gray-500 py-2">Noch nichts angelegt.</p>}

          {editId === null ? (
            <button onClick={startAdd} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2">
              <Plus className="w-4 h-4" /> {tab === 'song' ? 'Song' : 'Ansage'} hinzufügen
            </button>
          ) : (
            <div className="border border-[var(--border)] rounded-lg p-4 mt-2 bg-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{editId === 'new' ? 'Neu' : 'Bearbeiten'}</span>
                <button onClick={cancel} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className={lbl}>{tab === 'song' ? 'Titel' : 'Name'} *</label><input className={inp} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><label className={lbl}>Dauer (m:ss)</label><input className={inp} value={durStr} onChange={e => setDurStr(e.target.value)} placeholder="4:30" /></div>
                {tab === 'song' && (
                  <>
                    <div><label className={lbl}>BPM</label><input className={inp} type="number" value={form.bpm ?? ''} onChange={e => setForm(f => ({ ...f, bpm: e.target.value === '' ? null : parseInt(e.target.value) }))} /></div>
                    <div><label className={lbl}>GEMA-Werknummer</label><input className={inp} value={form.gemaWorkNo || ''} onChange={e => setForm(f => ({ ...f, gemaWorkNo: e.target.value }))} /></div>
                    <div><label className={lbl}>Komponist</label><input className={inp} value={form.composer || ''} onChange={e => setForm(f => ({ ...f, composer: e.target.value }))} /></div>
                    <div><label className={lbl}>Texter</label><input className={inp} value={form.lyricist || ''} onChange={e => setForm(f => ({ ...f, lyricist: e.target.value }))} /></div>
                    <div><label className={lbl}>Verlag</label><input className={inp} value={form.publisher || ''} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Start-Timecode (LTC)</label><input className={inp} value={form.startTimecode || ''} onChange={e => setForm(f => ({ ...f, startTimecode: e.target.value }))} placeholder="HH:MM:SS:FF" /><p className="text-[10px] text-gray-500 mt-1">Für die spätere Show-Control-Anbindung. Kann leer bleiben.</p></div>
                  </>
                )}
                <div className="sm:col-span-2"><label className={lbl}>Notiz</label><textarea className={inp} rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={cancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Abbrechen</button>
                <button onClick={save} disabled={saving || !form.title?.trim()} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50">{saving ? 'Speichern…' : 'Speichern'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
