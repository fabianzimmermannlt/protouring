'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Check, X, Loader2, ChevronRight, ClipboardList } from 'lucide-react'
import { getAuthToken, getCurrentTenant, isEditorRole, getEffectiveRole } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant?.slug) h['X-Tenant-Slug'] = tenant.slug
  h['Content-Type'] = 'application/json'
  return h
}

// ── Types ────────────────────────────────────────────────────────────────────

type EntryType = 'info' | 'abweichung' | 'absprache' | 'bestaetigung' | 'problem'
type EntryStatus = 'open' | 'resolved'

interface Area {
  id: number
  name: string
  sort_order: number
  entry_count: number
}

interface Entry {
  id: number
  area_id: number
  type: EntryType
  title: string
  details: string | null
  status: EntryStatus
  created_by: number
  first_name: string | null
  last_name: string | null
  created_at: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const ENTRY_TYPES: { value: EntryType; label: string; color: string; bg: string }[] = [
  { value: 'info',         label: 'Info',           color: '#6b7280', bg: '#f3f4f6' },
  { value: 'abweichung',   label: 'Abweichung',     color: '#dc2626', bg: '#fef2f2' },
  { value: 'absprache',    label: 'Zusatzabsprache', color: '#d97706', bg: '#fffbeb' },
  { value: 'bestaetigung', label: 'Bestätigung',    color: '#16a34a', bg: '#f0fdf4' },
  { value: 'problem',      label: 'Problem',         color: '#7c3aed', bg: '#faf5ff' },
]

function typeConfig(type: EntryType) {
  return ENTRY_TYPES.find(t => t.value === type) ?? ENTRY_TYPES[0]
}

function fmtDate(dt: string) {
  try {
    return new Date(dt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return dt }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryBadge({ type }: { type: EntryType }) {
  const cfg = typeConfig(type)
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '0.25rem', letterSpacing: '0.03em' }}>
      {cfg.label.toUpperCase()}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  terminId: number
  isAdmin: boolean
}

export default function AdvancingCard({ terminId, isAdmin }: Props) {
  const canEdit = isEditorRole(getEffectiveRole())

  const [areas, setAreas] = useState<Area[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)

  // Area form
  const [addingArea, setAddingArea] = useState(false)
  const [areaName, setAreaName] = useState('')
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')

  // Entry form
  const [addingEntry, setAddingEntry] = useState(false)
  const [entryForm, setEntryForm] = useState<{ type: EntryType; title: string; details: string; status: EntryStatus }>({
    type: 'info', title: '', details: '', status: 'open'
  })
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editingEntryForm, setEditingEntryForm] = useState<{ type: EntryType; title: string; details: string; status: EntryStatus }>({
    type: 'info', title: '', details: '', status: 'open'
  })
  const [saving, setSaving] = useState(false)

  // ── Load areas ──────────────────────────────────────────────────────────────

  const loadAreas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setAreas(data.areas ?? [])
      if (data.areas?.length && selectedAreaId === null) {
        setSelectedAreaId(data.areas[0].id)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [terminId, selectedAreaId])

  useEffect(() => { loadAreas() }, [terminId])

  // ── Load entries ────────────────────────────────────────────────────────────

  const loadEntries = useCallback(async (areaId: number) => {
    setEntriesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${areaId}/entries`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries ?? [])
    } catch { /* silent */ }
    finally { setEntriesLoading(false) }
  }, [terminId])

  useEffect(() => {
    if (selectedAreaId !== null) loadEntries(selectedAreaId)
    else setEntries([])
  }, [selectedAreaId, loadEntries])

  // ── Area actions ────────────────────────────────────────────────────────────

  const handleAddArea = async () => {
    if (!areaName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: areaName.trim(), sort_order: areas.length })
      })
      const data = await res.json()
      const newArea = data.area
      setAreas(prev => [...prev, { ...newArea, entry_count: 0 }])
      setSelectedAreaId(newArea.id)
      setAreaName('')
      setAddingArea(false)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleRenameArea = async (areaId: number) => {
    if (!editingAreaName.trim()) return
    setSaving(true)
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${areaId}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: editingAreaName.trim() })
      })
      setAreas(prev => prev.map(a => a.id === areaId ? { ...a, name: editingAreaName.trim() } : a))
      setEditingAreaId(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleDeleteArea = async (areaId: number) => {
    if (!confirm('Bereich und alle Einträge löschen?')) return
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${areaId}`, {
        method: 'DELETE', headers: authHeaders()
      })
      const remaining = areas.filter(a => a.id !== areaId)
      setAreas(remaining)
      setSelectedAreaId(remaining.length ? remaining[0].id : null)
    } catch { /* silent */ }
  }

  // ── Entry actions ────────────────────────────────────────────────────────────

  const handleAddEntry = async () => {
    if (!entryForm.title.trim() || selectedAreaId === null) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${selectedAreaId}/entries`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(entryForm)
      })
      const data = await res.json()
      setEntries(prev => [...prev, data.entry])
      setAreas(prev => prev.map(a => a.id === selectedAreaId ? { ...a, entry_count: a.entry_count + 1 } : a))
      setEntryForm({ type: 'info', title: '', details: '', status: 'open' })
      setAddingEntry(false)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleToggleStatus = async (entry: Entry) => {
    const newStatus: EntryStatus = entry.status === 'open' ? 'resolved' : 'open'
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${entry.area_id}/entries/${entry.id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: newStatus })
      })
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: newStatus } : e))
    } catch { /* silent */ }
  }

  const handleSaveEntry = async () => {
    if (!editingEntryId || !editingEntryForm.title.trim()) return
    setSaving(true)
    const entry = entries.find(e => e.id === editingEntryId)
    if (!entry) { setSaving(false); return }
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${entry.area_id}/entries/${editingEntryId}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(editingEntryForm)
      })
      setEntries(prev => prev.map(e => e.id === editingEntryId ? { ...e, ...editingEntryForm } : e))
      setEditingEntryId(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleDeleteEntry = async (entry: Entry) => {
    if (!confirm('Eintrag löschen?')) return
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${entry.area_id}/entries/${entry.id}`, {
        method: 'DELETE', headers: authHeaders()
      })
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      setAreas(prev => prev.map(a => a.id === entry.area_id ? { ...a, entry_count: Math.max(0, a.entry_count - 1) } : a))
    } catch { /* silent */ }
  }

  const selectedArea = areas.find(a => a.id === selectedAreaId)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">
          <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
          Advancing
        </span>
        {canEdit && !addingArea && (
          <button onClick={() => { setAddingArea(true); setAreaName('') }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bereich hinzufügen">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-xs">Lade…</span>
        </div>
      ) : (
        <div className="flex" style={{ minHeight: areas.length === 0 && !addingArea ? undefined : '180px' }}>

          {/* Linke Spalte: Bereiche */}
          <div className="flex flex-col border-r border-gray-100" style={{ width: '38%', minWidth: '110px' }}>
            {areas.map(area => (
              <div key={area.id}>
                {editingAreaId === area.id ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      autoFocus
                      value={editingAreaName}
                      onChange={e => setEditingAreaName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameArea(area.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                      className="flex-1 text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none"
                    />
                    <button onClick={() => handleRenameArea(area.id)} className="text-green-600 hover:text-green-700"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingAreaId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`group flex items-center justify-between px-2 py-2 cursor-pointer transition-colors ${selectedAreaId === area.id ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <ChevronRight className={`w-3 h-3 shrink-0 ${selectedAreaId === area.id ? 'text-blue-500' : 'text-gray-300'}`} />
                      <span className={`text-xs truncate ${selectedAreaId === area.id ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>{area.name}</span>
                      {area.entry_count > 0 && (
                        <span className="text-xs text-gray-400 shrink-0">({area.entry_count})</span>
                      )}
                    </div>
                    {canEdit && selectedAreaId === area.id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={e => { e.stopPropagation(); setEditingAreaId(area.id); setEditingAreaName(area.name) }} className="text-gray-400 hover:text-blue-600 p-0.5"><Pencil className="w-2.5 h-2.5" /></button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteArea(area.id) }} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-2.5 h-2.5" /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Neuer Bereich */}
            {addingArea && (
              <div className="flex flex-col gap-1 px-2 py-2 border-t border-gray-100">
                <input
                  autoFocus
                  value={areaName}
                  onChange={e => setAreaName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddArea(); if (e.key === 'Escape') setAddingArea(false) }}
                  placeholder="Bereichsname…"
                  className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex gap-1">
                  <button onClick={handleAddArea} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">OK</button>
                  <button onClick={() => setAddingArea(false)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                </div>
              </div>
            )}

            {areas.length === 0 && !addingArea && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-center px-2">
                <ClipboardList className="w-5 h-5 mb-1 opacity-40" />
                <p className="text-xs">Noch keine Bereiche</p>
                {canEdit && (
                  <button onClick={() => setAddingArea(true)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">+ Bereich</button>
                )}
              </div>
            )}
          </div>

          {/* Rechte Spalte: Einträge */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {selectedArea ? (
              <>
                {/* Einträge */}
                <div className="flex-1 overflow-y-auto">
                  {entriesLoading ? (
                    <div className="flex items-center justify-center py-4 text-gray-400">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" /><span className="text-xs">Lade…</span>
                    </div>
                  ) : entries.length === 0 && !addingEntry ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-center px-3">
                      <p className="text-xs">Keine Einträge in „{selectedArea.name}"</p>
                      {canEdit && (
                        <button onClick={() => setAddingEntry(true)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">+ Eintrag hinzufügen</button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {entries.map(entry => (
                        <div key={entry.id} className={`px-3 py-2 ${entry.status === 'resolved' ? 'opacity-60' : ''}`}>
                          {editingEntryId === entry.id ? (
                            <div className="space-y-1.5">
                              <select
                                value={editingEntryForm.type}
                                onChange={e => setEditingEntryForm(f => ({ ...f, type: e.target.value as EntryType }))}
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                              >
                                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <input
                                autoFocus
                                value={editingEntryForm.title}
                                onChange={e => setEditingEntryForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Titel *"
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <textarea
                                value={editingEntryForm.details}
                                onChange={e => setEditingEntryForm(f => ({ ...f, details: e.target.value }))}
                                placeholder="Details (optional)"
                                rows={2}
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none resize-none"
                              />
                              <div className="flex gap-1">
                                <button onClick={handleSaveEntry} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">Speichern</button>
                                <button onClick={() => setEditingEntryId(null)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                              </div>
                            </div>
                          ) : (
                            <div className="group">
                              <div className="flex items-start gap-2">
                                {/* Status-Toggle */}
                                {canEdit && (
                                  <button
                                    onClick={() => handleToggleStatus(entry)}
                                    title={entry.status === 'open' ? 'Als geklärt markieren' : 'Als offen markieren'}
                                    className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${entry.status === 'resolved' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                                  >
                                    {entry.status === 'resolved' && <Check className="w-2.5 h-2.5 text-white" />}
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <EntryBadge type={entry.type} />
                                    <span className={`text-xs font-medium ${entry.status === 'resolved' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{entry.title}</span>
                                  </div>
                                  {entry.details && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.details}</p>
                                  )}
                                  <p className="text-xs text-gray-300 mt-0.5">
                                    {entry.first_name ? `${entry.first_name} ${entry.last_name ?? ''}` : ''} · {fmtDate(entry.created_at)}
                                  </p>
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => { setEditingEntryId(entry.id); setEditingEntryForm({ type: entry.type, title: entry.title, details: entry.details ?? '', status: entry.status }) }} className="text-gray-400 hover:text-blue-600 p-0.5"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => handleDeleteEntry(entry)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Eintrag hinzufügen */}
                {canEdit && (
                  <div className="border-t border-gray-100">
                    {addingEntry ? (
                      <div className="px-3 py-2 space-y-1.5">
                        <select
                          value={entryForm.type}
                          onChange={e => setEntryForm(f => ({ ...f, type: e.target.value as EntryType }))}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                        >
                          {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input
                          autoFocus
                          value={entryForm.title}
                          onChange={e => setEntryForm(f => ({ ...f, title: e.target.value }))}
                          onKeyDown={e => e.key === 'Escape' && setAddingEntry(false)}
                          placeholder="Titel *"
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <textarea
                          value={entryForm.details}
                          onChange={e => setEntryForm(f => ({ ...f, details: e.target.value }))}
                          placeholder="Details (optional)"
                          rows={2}
                          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none resize-none"
                        />
                        <div className="flex gap-1">
                          <button onClick={handleAddEntry} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">Hinzufügen</button>
                          <button onClick={() => { setAddingEntry(false); setEntryForm({ type: 'info', title: '', details: '', status: 'open' }) }} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEntry(true)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Eintrag hinzufügen
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-300 text-xs px-3 text-center">
                {areas.length > 0 ? 'Bereich auswählen' : 'Erst einen Bereich anlegen'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
