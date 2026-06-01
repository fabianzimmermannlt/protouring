'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronUp, Save,
  FileText, Upload, AlertCircle, File as FileIcon, X, ExternalLink, FolderOpen, MapPin,
  Lock, Unlock
} from 'lucide-react'
import {
  getBriefings, addBriefingSection, updateBriefingSection, deleteBriefingSection,
  getAuthToken, getCurrentTenant,
  type BriefingItem, type BriefingSection, type BriefingFile,
} from '@/lib/api-client'

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
  return h
}

interface BriefingViewProps {
  terminId: number
  isAdmin: boolean
}

interface SectionEditState {
  title: string
  content: string
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Section-Editor ────────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: BriefingSection
  terminId: number
  gewerkId: number
  onUpdated: (s: BriefingSection) => void
  onDeleted: (id: number) => void
  canEdit: boolean
}

function SectionEditor({ section, terminId, gewerkId, onUpdated, onDeleted, canEdit }: SectionEditorProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<SectionEditState>({ title: section.title, content: section.content })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateBriefingSection(terminId, gewerkId, section.id, form)
      onUpdated(updated)
      setEditing(false)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm('Abschnitt löschen?')) return
    try {
      await deleteBriefingSection(terminId, gewerkId, section.id)
      onDeleted(section.id)
    } catch { /* silent */ }
  }

  if (editing && canEdit) {
    return (
      <div className="border border-blue-200 rounded-lg bg-blue-50/20 p-3 space-y-2">
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Titel (optional)"
          className="form-input text-sm"
        />
        <textarea
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="Inhalt…"
          rows={4}
          className="form-input text-sm font-mono resize-y"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Speichern
          </button>
          <button
            onClick={() => { setEditing(false); setForm({ title: section.title, content: section.content }) }}
            className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {section.title && (
            <div className="text-xs font-semibold text-gray-700 mb-1">{section.title}</div>
          )}
          {section.content ? (
            <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{section.content}</pre>
          ) : (
            <span className="text-xs text-gray-400 italic">Kein Inhalt</span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-0.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            >
              Bearbeiten
            </button>
            <button onClick={handleDelete} className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── FileUpload inline ────────────────────────────────────────────────────────

interface BriefingFilesProps {
  briefingId: number
  files: BriefingFile[]
  onFilesChanged: (files: BriefingFile[]) => void
  canEdit: boolean
}

function BriefingFiles({ briefingId, files, onFilesChanged, canEdit }: BriefingFilesProps) {
  const [uploading, setUploading] = useState(false)

  const openFile = async (file: BriefingFile) => {
    try {
      if (file.mime_type.startsWith('image/') || file.mime_type.includes('pdf')) {
        const token = getAuthToken()
        const tenant = getCurrentTenant()
        const viewUrl = `${API_BASE}/api/files/view/${file.id}?token=${encodeURIComponent(token ?? '')}&slug=${encodeURIComponent(tenant?.slug ?? '')}`
        window.open(viewUrl, '_blank')
      } else {
        const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.original_name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch { /* silent */ }
  }

  const deleteFile = async (fileId: number) => {
    if (!confirm('Datei löschen?')) return
    try {
      await fetch(`${API_BASE}/api/files/${fileId}`, { method: 'DELETE', headers: authHeaders() })
      onFilesChanged(files.filter(f => f.id !== fileId))
    } catch { /* silent */ }
  }

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_BASE}/api/files/crew_briefing/${briefingId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      })
      if (!res.ok) return
      const data = await res.json()
      onFilesChanged([...files, data.file])
    } catch { /* silent */ }
    finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-1">
      {files.map(f => (
        <div key={f.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
          <FileIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <button
            onClick={() => openFile(f)}
            className="flex-1 text-left text-xs text-blue-600 hover:text-blue-800 truncate"
          >
            {f.original_name}
          </button>
          <span className="text-xs text-gray-400 shrink-0">{fmtFileSize(f.size)}</span>
          {canEdit && (
            <button
              onClick={() => deleteFile(f.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 shrink-0" />
        </div>
      ))}
      {canEdit && (
        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Datei hochladen
          <input type="file" className="hidden" onChange={uploadFile} disabled={uploading} />
        </label>
      )}
    </div>
  )
}

// ── Alle Dokumente ───────────────────────────────────────────────────────────

interface AggFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  category: string
  gewerkIds: number[]
}

interface AggDocs {
  termin: AggFile[]
  venue: AggFile[]
  venueName: string | null
}

function fileEmoji(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎥'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
  if (mime.includes('zip') || mime.includes('rar')) return '📦'
  return '📎'
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface GewerkMini { id: number; name: string; color: string }

const KEINER_ID = -1
const ALLE_ID = 0  // Sentinel: zurücksetzen auf "Alle"

function GewerkChips({ file, gewerke, isAdmin, addingTo, setAddingTo, toggleGewerk }: {
  file: AggFile
  gewerke: GewerkMini[]
  isAdmin: boolean
  addingTo: string | null
  setAddingTo: (id: string | null) => void
  toggleGewerk: (file: AggFile, gewerkId: number) => void
}) {
  if (!isAdmin || gewerke.length === 0) return null
  const ids = file.gewerkIds ?? []
  const hasKeiner = ids.includes(KEINER_ID)
  const realIds = ids.filter(id => id !== KEINER_ID)
  const unassigned = gewerke.filter(g => !realIds.includes(g.id))

  return (
    <div className="flex items-center gap-1 shrink-0">
      {hasKeiner ? (
        <button
          onClick={() => toggleGewerk(file, KEINER_ID)}
          title="Einschränkung entfernen"
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium text-white bg-gray-400"
        >Keiner ×</button>
      ) : realIds.length === 0 ? (
        <span className="text-xs text-gray-300 italic">Alle</span>
      ) : (
        realIds.map(gId => {
          const g = gewerke.find(x => x.id === gId)
          if (!g) return null
          return (
            <button key={gId} onClick={() => toggleGewerk(file, gId)} title={`${g.name} entfernen`}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: g.color }}
            >{g.name} ×</button>
          )
        })
      )}
      {!hasKeiner && (
        <div className="relative">
          <button
            onClick={() => setAddingTo(addingTo === file.id ? null : file.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 text-xs"
            title="Gewerk zuweisen"
          >+</button>
          {addingTo === file.id && (
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-max">
              {unassigned.map(g => (
                <button key={g.id} onClick={() => toggleGewerk(file, g.id)}
                  className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
              {unassigned.length === 0 && (
                <span className="px-2 py-1 text-xs text-gray-400 italic block">Alle zugewiesen</span>
              )}
              <button onClick={() => toggleGewerk(file, KEINER_ID)}
                className="flex items-center gap-2 w-full px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 rounded mt-0.5 border-t border-gray-100"
              >
                <span className="w-2 h-2 rounded-full shrink-0 bg-gray-400" />
                Keiner
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Lock-Variante (barrierefreier, kein Farb-Encoding) ────────────────────────
function GewerkLock({ file, gewerke, isAdmin, addingTo, setAddingTo, toggleGewerk }: {
  file: AggFile
  gewerke: GewerkMini[]
  isAdmin: boolean
  addingTo: string | null
  setAddingTo: (id: string | null) => void
  toggleGewerk: (file: AggFile, gewerkId: number) => void
}) {
  if (!isAdmin || gewerke.length === 0) return null
  const ids = file.gewerkIds ?? []
  const hasKeiner = ids.includes(KEINER_ID)
  const realIds = ids.filter(id => id !== KEINER_ID)
  const isRestricted = hasKeiner || realIds.length > 0

  // Inline-Label: immer sichtbar, kein Klick nötig
  const inlineLabel = hasKeiner
    ? 'Keiner'
    : realIds.length === 0
      ? 'Alle'
      : realIds.length <= 2
        ? realIds.map(id => gewerke.find(g => g.id === id)?.name ?? '').filter(Boolean).join(', ')
        : `${realIds.length} Gewerke`

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAddingTo(addingTo === file.id ? null : file.id)}
        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs transition-colors ${
          isRestricted
            ? 'text-gray-600 hover:bg-gray-100'
            : 'text-gray-400 hover:bg-gray-50'
        }`}
      >
        {isRestricted
          ? <Lock className="w-3 h-3 shrink-0" />
          : <Unlock className="w-3 h-3 shrink-0" />
        }
        <span>{inlineLabel}</span>
      </button>

      {addingTo === file.id && (
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[160px]">
          {/* Alle */}
          <button
            onClick={() => toggleGewerk(file, ALLE_ID)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded ${
              !isRestricted ? 'bg-gray-100 font-medium text-gray-800' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Unlock className="w-3 h-3 shrink-0" />
            Alle
          </button>

          {/* Gewerke */}
          <div className="border-t border-gray-100 my-1" />
          {gewerke.map(g => {
            const checked = realIds.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGewerk(file, g.id)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded ${
                  checked ? 'font-medium text-gray-800 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`w-3.5 h-3.5 shrink-0 flex items-center justify-center border rounded text-[10px] ${
                  checked ? 'border-gray-600 bg-gray-600 text-white' : 'border-gray-300'
                }`}>
                  {checked && '✓'}
                </span>
                {g.name}
              </button>
            )
          })}

          {/* Keiner */}
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => toggleGewerk(file, KEINER_ID)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded ${
              hasKeiner ? 'bg-gray-100 font-medium text-gray-800' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Lock className="w-3 h-3 shrink-0" />
            Keiner
          </button>
        </div>
      )}
    </div>
  )
}

function AllDocsPanel({ terminId, gewerke, isAdmin }: { terminId: number; gewerke: GewerkMini[]; isAdmin: boolean }) {
  const [docs, setDocs] = useState<AggDocs | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [addingTo, setAddingTo] = useState<string | null>(null) // fileId mit offener Gewerk-Auswahl

  useEffect(() => {
    if (!addingTo) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddingTo(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [addingTo])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/files/termin-aggregated/${terminId}`, { headers: authHeaders() })
        if (res.ok) setDocs(await res.json())
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [terminId])

  async function toggleGewerk(file: AggFile, gewerkId: number) {
    const current = file.gewerkIds ?? []
    let next: number[]
    if (gewerkId === ALLE_ID) {
      next = []
    } else if (gewerkId === KEINER_ID) {
      next = current.includes(KEINER_ID) ? [] : [KEINER_ID]
    } else {
      const withoutKeiner = current.filter(id => id !== KEINER_ID)
      next = withoutKeiner.includes(gewerkId)
        ? withoutKeiner.filter(id => id !== gewerkId)
        : [...withoutKeiner, gewerkId]
    }
    try {
      const res = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ gewerkIds: next }),
      })
      if (!res.ok) return
      const { file: updated } = await res.json()
      setDocs(prev => {
        if (!prev) return prev
        const patch = (list: AggFile[]) => list.map(f => f.id === updated.id ? { ...f, gewerkIds: updated.gewerkIds } : f)
        return { ...prev, termin: patch(prev.termin), venue: patch(prev.venue) }
      })
    } catch { /* silent */ }
    // Alle/Keiner schließen das Dropdown (exklusive Auswahl), einzelne Gewerke nicht
    if (gewerkId === ALLE_ID || gewerkId === KEINER_ID) setAddingTo(null)
  }

  const openFile = async (file: AggFile) => {
    try {
      if (file.mimeType.startsWith('image/') || file.mimeType.includes('pdf')) {
        const token = getAuthToken()
        const tenant = getCurrentTenant()
        const viewUrl = `${API_BASE}/api/files/view/${file.id}?token=${encodeURIComponent(token ?? '')}&slug=${encodeURIComponent(tenant?.slug ?? '')}`
        window.open(viewUrl, '_blank')
      } else {
        const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.originalName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch { /* silent */ }
  }

  const totalCount = (docs?.termin.length ?? 0) + (docs?.venue.length ?? 0)

  return (
    <>
    {/* Backdrop: schließt offenes Dropdown bei Klick außerhalb */}
    {addingTo && (
      <div className="fixed inset-0 z-40" onClick={() => setAddingTo(null)} />
    )}
    <div className="border border-gray-200 rounded-xl bg-white">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left rounded-xl"
      >
        <FolderOpen className="w-4 h-4 text-gray-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">Alle Dokumente</div>
          <div className="text-xs text-gray-500">
            {loading ? 'Lädt…' : totalCount === 0 ? 'Keine Dokumente' : `${totalCount} Datei${totalCount !== 1 ? 'en' : ''}`}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          {loading && <div className="text-xs text-gray-400 py-2">Lädt…</div>}

          {!loading && totalCount === 0 && (
            <div className="text-xs text-gray-400 text-center py-3">
              Noch keine Dokumente hochgeladen.
            </div>
          )}

          {/* Termin-Dokumente */}
          {!loading && (docs?.termin.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Show-Dokumente
              </div>
              <div className="space-y-0.5">
                {docs!.termin.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                    <button onClick={() => openFile(f)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                      <span className="text-base shrink-0">{fileEmoji(f.mimeType)}</span>
                      <span className="flex-1 text-xs text-blue-600 group-hover:text-blue-800 truncate">{f.originalName}</span>
                      <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 shrink-0" />
                    </button>
                    <GewerkLock file={f} gewerke={gewerke} isAdmin={isAdmin} addingTo={addingTo} setAddingTo={setAddingTo} toggleGewerk={toggleGewerk} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Venue-Dokumente */}
          {!loading && (docs?.venue.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {docs!.venueName ?? 'Venue'}
              </div>
              <div className="space-y-0.5">
                {docs!.venue.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                    <button onClick={() => openFile(f)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                      <span className="text-base shrink-0">{fileEmoji(f.mimeType)}</span>
                      <span className="flex-1 text-xs text-blue-600 group-hover:text-blue-800 truncate">{f.originalName}</span>
                      <span className="text-xs text-gray-400 shrink-0">{fmtSize(f.size)}</span>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 shrink-0" />
                    </button>
                    <GewerkLock file={f} gewerke={gewerke} isAdmin={isAdmin} addingTo={addingTo} setAddingTo={setAddingTo} toggleGewerk={toggleGewerk} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

// ── Gewerk-Panel ─────────────────────────────────────────────────────────────

interface GewerkPanelProps {
  item: BriefingItem
  terminId: number
  isAdmin: boolean
  onItemChanged: (item: BriefingItem) => void
}

function GewerkPanel({ item, terminId, isAdmin, onItemChanged }: GewerkPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [addingSection, setAddingSection] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [adding, setAdding] = useState(false)

  const canEdit = isAdmin || item.gewerk.can_write === 1

  const handleAddSection = async () => {
    setAdding(true)
    try {
      const { section, briefingId } = await addBriefingSection(terminId, item.gewerk.id, {
        title: newTitle,
        content: newContent,
        sort_order: (item.briefing?.sections.length ?? 0) * 10,
      })
      const updatedBriefing = item.briefing
        ? { ...item.briefing, sections: [...item.briefing.sections, section] }
        : { id: briefingId, tenant_id: 0, termin_id: terminId, gewerk_id: item.gewerk.id, created_at: '', updated_at: '', sections: [section], files: [] }
      onItemChanged({ ...item, briefing: updatedBriefing })
      setNewTitle('')
      setNewContent('')
      setAddingSection(false)
    } catch { /* silent */ }
    finally { setAdding(false) }
  }

  const handleSectionUpdated = (updated: BriefingSection) => {
    if (!item.briefing) return
    onItemChanged({
      ...item,
      briefing: {
        ...item.briefing,
        sections: item.briefing.sections.map(s => s.id === updated.id ? updated : s),
      },
    })
  }

  const handleSectionDeleted = (id: number) => {
    if (!item.briefing) return
    onItemChanged({
      ...item,
      briefing: { ...item.briefing, sections: item.briefing.sections.filter(s => s.id !== id) },
    })
  }

  const handleFilesChanged = (files: BriefingFile[]) => {
    if (!item.briefing) return
    onItemChanged({ ...item, briefing: { ...item.briefing, files } })
  }

  const sectionCount = item.briefing?.sections.length ?? 0
  const fileCount = item.briefing?.files.length ?? 0
  const isEmpty = sectionCount === 0 && fileCount === 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.gewerk.color }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{item.gewerk.name}</div>
          <div className="text-xs text-gray-500">
            {item.gewerk.funktionen.length === 0
              ? 'Keine Funktionen'
              : item.gewerk.funktionen.join(', ')}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isEmpty && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {sectionCount > 0 && <span>{sectionCount} Abschnitt{sectionCount !== 1 ? 'e' : ''}</span>}
              {fileCount > 0 && <span>{fileCount} Datei{fileCount !== 1 ? 'en' : ''}</span>}
            </div>
          )}
          {isEmpty && <span className="text-xs text-gray-400">Leer</span>}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Sections */}
          {(item.briefing?.sections ?? []).length > 0 && (
            <div className="space-y-2">
              {item.briefing!.sections.map(section => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  terminId={terminId}
                  gewerkId={item.gewerk.id}
                  onUpdated={handleSectionUpdated}
                  onDeleted={handleSectionDeleted}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}

          {/* Neuer Abschnitt-Form */}
          {addingSection && canEdit && (
            <div className="border border-blue-200 rounded-lg bg-blue-50/20 p-3 space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Titel (optional)"
                className="form-input text-sm"
                autoFocus
              />
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Inhalt…"
                rows={3}
                className="form-input text-sm font-mono resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddSection}
                  disabled={adding || (!newTitle && !newContent)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Hinzufügen
                </button>
                <button
                  onClick={() => { setAddingSection(false); setNewTitle(''); setNewContent('') }}
                  className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Dateien */}
          {item.briefing && (
            <div>
              {(item.briefing.files.length > 0 || canEdit) && (
                <div className="text-xs font-medium text-gray-500 mb-1.5">Dateien</div>
              )}
              <BriefingFiles
                briefingId={item.briefing.id}
                files={item.briefing.files}
                onFilesChanged={handleFilesChanged}
                canEdit={canEdit}
              />
            </div>
          )}

          {/* Actions */}
          {canEdit && !addingSection && (
            <button
              onClick={() => setAddingSection(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Abschnitt hinzufügen
            </button>
          )}

          {isEmpty && !canEdit && (
            <div className="text-xs text-gray-400 text-center py-2">Noch kein Briefing vorhanden.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Haupt-View ───────────────────────────────────────────────────────────────

export default function BriefingView({ terminId, isAdmin }: BriefingViewProps) {
  const [items, setItems] = useState<BriefingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBriefings(terminId)
      setItems(data)
    } catch {
      setError('Briefings konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [terminId])

  useEffect(() => { load() }, [load])

  const handleItemChanged = (updated: BriefingItem) => {
    setItems(prev => prev.map(item => item.gewerk.id === updated.gewerk.id ? updated : item))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-8 text-red-600 text-sm">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {/* Gewerk-Briefings — volle Breite */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <div className="text-xs text-gray-400">
            Keine Gewerke konfiguriert — unter Einstellungen → Gewerke anlegen.
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs font-semibold text-gray-500 pt-1">Gewerk-Briefings</div>
          {items.map(item => (
            <GewerkPanel
              key={item.gewerk.id}
              item={item}
              terminId={terminId}
              isAdmin={isAdmin}
              onItemChanged={handleItemChanged}
            />
          ))}
        </>
      )}

      {/* Alle Dokumente — darunter, 50% Breite */}
      <div className="max-w-xl">
        <AllDocsPanel terminId={terminId} gewerke={items.map(i => ({ id: i.gewerk.id, name: i.gewerk.name, color: i.gewerk.color }))} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
