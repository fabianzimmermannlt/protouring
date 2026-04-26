'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Check, X, Loader2, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react'
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
  first_name: string | null
  last_name: string | null
  created_at: string
}

const ENTRY_TYPES: { value: EntryType; label: string; color: string; bg: string }[] = [
  { value: 'info',         label: 'Info',            color: '#6b7280', bg: '#f3f4f6' },
  { value: 'abweichung',   label: 'Abweichung',      color: '#dc2626', bg: '#fef2f2' },
  { value: 'absprache',    label: 'Zusatzabsprache',  color: '#d97706', bg: '#fffbeb' },
  { value: 'bestaetigung', label: 'Bestätigung',     color: '#16a34a', bg: '#f0fdf4' },
  { value: 'problem',      label: 'Problem',          color: '#7c3aed', bg: '#faf5ff' },
]

function typeCfg(type: EntryType) {
  return ENTRY_TYPES.find(t => t.value === type) ?? ENTRY_TYPES[0]
}

function fmtDate(dt: string) {
  try { return new Date(dt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  catch { return dt }
}

function EntryBadge({ type }: { type: EntryType }) {
  const c = typeCfg(type)
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '0.2rem', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      {c.label.toUpperCase()}
    </span>
  )
}

const EMPTY_FORM = { type: 'info' as EntryType, title: '', details: '' }

interface Props { terminId: number; isAdmin: boolean }

export default function AdvancingCard({ terminId, isAdmin }: Props) {
  const canEdit = isEditorRole(getEffectiveRole())

  const [areas, setAreas] = useState<Area[]>([])
  const [entriesByArea, setEntriesByArea] = useState<Record<number, Entry[]>>({})
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Area editing
  const [addingArea, setAddingArea] = useState(false)
  const [areaName, setAreaName] = useState('')
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')

  // Entry editing
  const [addingEntryForArea, setAddingEntryForArea] = useState<number | null>(null)
  const [entryForm, setEntryForm] = useState(EMPTY_FORM)
  const [editingEntry, setEditingEntry] = useState<{ id: number; areaId: number } | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas`, { headers: authHeaders() })
      if (!res.ok) return
      const { areas: loadedAreas } = await res.json()
      setAreas(loadedAreas ?? [])

      // Load entries for all areas in parallel
      const results = await Promise.all(
        (loadedAreas ?? []).map((a: Area) =>
          fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${a.id}/entries`, { headers: authHeaders() })
            .then(r => r.json())
            .then(d => ({ areaId: a.id, entries: d.entries ?? [] }))
            .catch(() => ({ areaId: a.id, entries: [] }))
        )
      )
      const map: Record<number, Entry[]> = {}
      results.forEach(r => { map[r.areaId] = r.entries })
      setEntriesByArea(map)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [terminId])

  useEffect(() => { loadAll() }, [loadAll])

  const toggleCollapse = (areaId: number) => setCollapsed(p => ({ ...p, [areaId]: !p[areaId] }))

  // ── Area actions ──────────────────────────────────────────────────────────

  const handleAddArea = async () => {
    if (!areaName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name: areaName.trim(), sort_order: areas.length }),
      })
      const { area } = await res.json()
      setAreas(prev => [...prev, { ...area, entry_count: 0 }])
      setEntriesByArea(prev => ({ ...prev, [area.id]: [] }))
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
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: editingAreaName.trim() }),
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
        method: 'DELETE', headers: authHeaders(),
      })
      setAreas(prev => prev.filter(a => a.id !== areaId))
      setEntriesByArea(prev => { const n = { ...prev }; delete n[areaId]; return n })
    } catch { /* silent */ }
  }

  // ── Entry actions ─────────────────────────────────────────────────────────

  const handleAddEntry = async (areaId: number) => {
    if (!entryForm.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${areaId}/entries`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...entryForm, status: 'open' }),
      })
      const { entry } = await res.json()
      setEntriesByArea(prev => ({ ...prev, [areaId]: [...(prev[areaId] ?? []), entry] }))
      setAreas(prev => prev.map(a => a.id === areaId ? { ...a, entry_count: a.entry_count + 1 } : a))
      setEntryForm(EMPTY_FORM)
      setAddingEntryForArea(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleToggleStatus = async (entry: Entry) => {
    const newStatus: EntryStatus = entry.status === 'open' ? 'resolved' : 'open'
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${entry.area_id}/entries/${entry.id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
      })
      setEntriesByArea(prev => ({
        ...prev,
        [entry.area_id]: prev[entry.area_id].map(e => e.id === entry.id ? { ...e, status: newStatus } : e),
      }))
    } catch { /* silent */ }
  }

  const handleSaveEntry = async () => {
    if (!editingEntry || !editForm.title.trim()) return
    setSaving(true)
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${editingEntry.areaId}/entries/${editingEntry.id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(editForm),
      })
      setEntriesByArea(prev => ({
        ...prev,
        [editingEntry.areaId]: prev[editingEntry.areaId].map(e =>
          e.id === editingEntry.id ? { ...e, ...editForm } : e
        ),
      }))
      setEditingEntry(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleDeleteEntry = async (entry: Entry) => {
    if (!confirm('Eintrag löschen?')) return
    try {
      await fetch(`${API_BASE}/api/termine/${terminId}/advancing/areas/${entry.area_id}/entries/${entry.id}`, {
        method: 'DELETE', headers: authHeaders(),
      })
      setEntriesByArea(prev => ({
        ...prev,
        [entry.area_id]: prev[entry.area_id].filter(e => e.id !== entry.id),
      }))
      setAreas(prev => prev.map(a => a.id === entry.area_id ? { ...a, entry_count: Math.max(0, a.entry_count - 1) } : a))
    } catch { /* silent */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">
          <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
          Advancing
        </span>
        {canEdit && (
          <button onClick={() => { setAddingArea(true); setAreaName('') }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Bereich hinzufügen">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="pt-card-body space-y-0">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /><span className="text-xs">Lade…</span>
          </div>
        ) : (
          <>
            {areas.map(area => {
              const entries = entriesByArea[area.id] ?? []
              const isOpen = !collapsed[area.id]

              return (
                <div key={area.id} className="border-b border-gray-100 last:border-0">
                  {/* Area Header */}
                  <div className="flex items-center gap-1 px-0 py-2 group">
                    <button onClick={() => toggleCollapse(area.id)} className="flex items-center gap-1 flex-1 min-w-0 text-left">
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      {editingAreaId === area.id ? (
                        <input
                          autoFocus
                          value={editingAreaName}
                          onChange={e => setEditingAreaName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameArea(area.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-semibold border border-blue-300 rounded px-1 py-0.5 focus:outline-none flex-1"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide truncate">
                          {area.name}
                          {entries.length > 0 && <span className="ml-1 text-gray-400 font-normal normal-case">({entries.length})</span>}
                        </span>
                      )}
                    </button>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {editingAreaId === area.id ? (
                          <>
                            <button onClick={() => handleRenameArea(area.id)} className="text-green-600 hover:text-green-700 p-0.5"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingAreaId(null)} className="text-gray-400 hover:text-gray-600 p-0.5"><X className="w-3 h-3" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingAreaId(area.id); setEditingAreaName(area.name) }} className="text-gray-400 hover:text-blue-600 p-0.5"><Pencil className="w-2.5 h-2.5" /></button>
                            <button onClick={() => handleDeleteArea(area.id)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-2.5 h-2.5" /></button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Entries */}
                  {isOpen && (
                    <div className="pl-4 pb-2 space-y-1">
                      {entries.map(entry => (
                        <div key={entry.id}>
                          {editingEntry?.id === entry.id ? (
                            <div className="space-y-1.5 bg-gray-50 rounded p-2">
                              <select
                                value={editForm.type}
                                onChange={e => setEditForm(f => ({ ...f, type: e.target.value as EntryType }))}
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                              >
                                {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <input
                                autoFocus
                                value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Titel *"
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <textarea
                                value={editForm.details}
                                onChange={e => setEditForm(f => ({ ...f, details: e.target.value }))}
                                placeholder="Details (optional)"
                                rows={2}
                                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none resize-none"
                              />
                              <div className="flex gap-1">
                                <button onClick={handleSaveEntry} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">Speichern</button>
                                <button onClick={() => setEditingEntry(null)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                              </div>
                            </div>
                          ) : (
                            <div className={`group flex items-start gap-2 py-1 ${entry.status === 'resolved' ? 'opacity-55' : ''}`}>
                              {/* Status toggle */}
                              {canEdit ? (
                                <button
                                  onClick={() => handleToggleStatus(entry)}
                                  title={entry.status === 'open' ? 'Als geklärt markieren' : 'Wieder öffnen'}
                                  className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${entry.status === 'resolved' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}
                                >
                                  {entry.status === 'resolved' && <Check className="w-2 h-2 text-white" />}
                                </button>
                              ) : (
                                <div className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${entry.status === 'resolved' ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
                                  {entry.status === 'resolved' && <Check className="w-2 h-2 text-white" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <EntryBadge type={entry.type} />
                                  <span className={`text-xs font-medium leading-tight ${entry.status === 'resolved' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{entry.title}</span>
                                </div>
                                {entry.details && (
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.details}</p>
                                )}
                                <p className="text-xs text-gray-300 mt-0.5">
                                  {entry.first_name ? `${entry.first_name}${entry.last_name ? ' ' + entry.last_name : ''}` : ''}{entry.first_name ? ' · ' : ''}{fmtDate(entry.created_at)}
                                </p>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => { setEditingEntry({ id: entry.id, areaId: entry.area_id }); setEditForm({ type: entry.type, title: entry.title, details: entry.details ?? '' }) }} className="text-gray-400 hover:text-blue-600 p-0.5"><Pencil className="w-3 h-3" /></button>
                                  <button onClick={() => handleDeleteEntry(entry)} className="text-gray-400 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add entry form */}
                      {canEdit && (
                        addingEntryForArea === area.id ? (
                          <div className="space-y-1.5 bg-gray-50 rounded p-2 mt-1">
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
                              onKeyDown={e => e.key === 'Escape' && setAddingEntryForArea(null)}
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
                              <button onClick={() => handleAddEntry(area.id)} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">Hinzufügen</button>
                              <button onClick={() => { setAddingEntryForArea(null); setEntryForm(EMPTY_FORM) }} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingEntryForArea(area.id); setEntryForm(EMPTY_FORM) }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors py-0.5"
                          >
                            <Plus className="w-3 h-3" /> Eintrag hinzufügen
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add area form */}
            {addingArea && (
              <div className="pt-2 space-y-1.5">
                <input
                  autoFocus
                  value={areaName}
                  onChange={e => setAreaName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddArea(); if (e.key === 'Escape') setAddingArea(false) }}
                  placeholder="Bereichsname…"
                  className="w-full text-xs border border-blue-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex gap-1">
                  <button onClick={handleAddArea} disabled={saving} className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50">Erstellen</button>
                  <button onClick={() => setAddingArea(false)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                </div>
              </div>
            )}

            {areas.length === 0 && !addingArea && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400 text-center">
                <ClipboardList className="w-5 h-5 mb-1 opacity-40" />
                <p className="text-xs">Noch keine Bereiche angelegt</p>
                {canEdit && (
                  <button onClick={() => setAddingArea(true)} className="text-xs text-blue-500 hover:text-blue-700 mt-1.5">+ Bereich hinzufügen</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
