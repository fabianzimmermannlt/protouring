'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, File, Trash2, Edit, AlertCircle, X, ChevronDown, ChevronRight, FolderInput } from 'lucide-react'
import { getAuthToken, getCurrentTenant } from '@/lib/api-client'

// ============================================================
// Kategorien
// ============================================================

export const TERMIN_FILE_CATEGORIES = [
  'Allgemein',
  'Spielstätte',
  'Anfahrt & Parken',
  'Akkreditierung',
  'Tickets',
  'Garderobe',
  'Catering',
  'Hotel / Unterkunft',
  'Busbelegung',
  'Technik: Allgemein',
  'Technik: Ton',
  'Technik: Licht',
  'Technik: Rigging',
  'Technik: Video',
  'Backline',
  'Bühne',
  'Logistik & Transport',
  'Merchandise',
  'Sicherheit',
  'Kommunikation',
  'Genehmigungen & Dokumente',
  'Marketing & PR',
  'Finanzen',
  'Setlist',
  'Hallenplan',
  'Vorverkaufsplan',
  'Spielplan',
] as const

export type TerminFileCategory = typeof TERMIN_FILE_CATEGORIES[number]

// ============================================================
// Types
// ============================================================

interface FileItem {
  id: string
  category: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  createdAt: string
  url: string
}

// ============================================================
// API helpers
// ============================================================

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3002`
  : 'http://localhost:3002'

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const h: Record<string, string> = {}
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant) h['X-Tenant-Slug'] = tenant.slug
  return h
}

async function apiListAll(terminId: string): Promise<FileItem[]> {
  const res = await fetch(`${API_BASE}/api/files/termin/${terminId}`, { headers: authHeaders() })
  if (!res.ok) throw new Error('List failed')
  return (await res.json()).files ?? []
}

async function apiUpload(terminId: string, category: string, files: File[]): Promise<void> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const res = await fetch(
    `${API_BASE}/api/files/termin/${terminId}?category=${encodeURIComponent(category)}`,
    { method: 'POST', headers: authHeaders(), body: form }
  )
  if (!res.ok) throw new Error('Upload failed')
}

async function apiDelete(fileId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/${fileId}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) throw new Error('Delete failed')
}

async function apiPatchFile(fileId: string, patch: { originalName?: string; category?: string }): Promise<FileItem> {
  const res = await fetch(`${API_BASE}/api/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Patch failed')
  return (await res.json()).file
}

// ============================================================
// Helpers
// ============================================================

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎥'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊'
  if (mime.includes('zip') || mime.includes('rar')) return '📦'
  return '📎'
}

// ============================================================
// CategorySection — ein ausklappbarer Abschnitt pro Kategorie
// ============================================================

function CategorySection({
  category,
  files,
  onDelete,
  onRename,
  onMoveCategory,
  onOpen,
}: {
  category: string
  files: FileItem[]
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onMoveCategory: (id: string, newCategory: string) => Promise<void>
  onOpen: (file: FileItem) => void
}) {
  const [open, setOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('')

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Kategorie-Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {category}
          <span className="ml-1.5 text-gray-400 font-normal normal-case">({files.length})</span>
        </span>
        {open
          ? <ChevronDown size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />
        }
      </button>

      {/* Dateiliste */}
      {open && (
        <div className="px-4 pb-2 space-y-1">
          {files.map(file => (
            <div key={file.id} className="rounded hover:bg-gray-50 transition-colors">
              {/* Hauptzeile */}
              <div className="flex items-center justify-between py-1 px-1.5 text-sm">
                {editingId === file.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter') { await onRename(file.id, editingName); setEditingId(null) }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 px-1 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button onClick={async () => { await onRename(file.id, editingName); setEditingId(null) }} className="text-green-600 px-1 text-xs">✓</button>
                    <button onClick={() => setEditingId(null)} className="text-red-500 px-1 text-xs">✕</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onOpen(file)}
                      className="flex items-center gap-1.5 flex-1 text-left truncate hover:text-blue-600 transition-colors"
                      title={file.originalName}
                    >
                      <span className="text-base leading-none">{fileIcon(file.mimeType)}</span>
                      <span className="truncate text-xs">{file.originalName}</span>
                    </button>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                      <button
                        onClick={() => { setEditingId(file.id); setEditingName(file.originalName); setMovingId(null) }}
                        className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                        title="Umbenennen"
                      >
                        <Edit size={11} />
                      </button>
                      <button
                        onClick={() => {
                          if (movingId === file.id) { setMovingId(null) }
                          else { setMovingId(file.id); setMoveTarget(category) }
                        }}
                        className={`p-0.5 rounded transition-colors ${movingId === file.id ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                        title="Kategorie ändern"
                      >
                        <FolderInput size={11} />
                      </button>
                      <button
                        onClick={() => onDelete(file.id)}
                        className="text-gray-400 hover:text-red-600 p-0.5 rounded"
                        title="Löschen"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Kategorie-Wechsel (ausgeklappt unter der Zeile) */}
              {movingId === file.id && (
                <div className="px-1.5 pb-2 space-y-1">
                  <select
                    value={moveTarget}
                    onChange={e => setMoveTarget(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  >
                    {TERMIN_FILE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        if (moveTarget && moveTarget !== category) {
                          await onMoveCategory(file.id, moveTarget)
                        }
                        setMovingId(null)
                      }}
                      className="flex-1 text-xs py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Verschieben
                    </button>
                    <button
                      onClick={() => setMovingId(null)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// TerminFileCard — Haupt-Komponente
// ============================================================

export function TerminFileCard({
  terminId,
  className = '',
}: {
  terminId: string
  className?: string
}) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Upload-Modal
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>(TERMIN_FILE_CATEGORIES[0])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Stats
  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  const totalCount = files.length

  useEffect(() => { load() }, [terminId])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setFiles(await apiListAll(terminId))
    } catch (e) {
      setLoadError('Fehler beim Laden: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Dateien nach Kategorie gruppieren (nur Kategorien mit Dateien)
  const byCategory = TERMIN_FILE_CATEGORIES.reduce<Record<string, FileItem[]>>((acc, cat) => {
    const matching = files.filter(f => f.category === cat)
    if (matching.length > 0) acc[cat] = matching
    return acc
  }, {})
  // Dateien ohne bekannte Kategorie unter "Allgemein" bündeln
  const unknownCatFiles = files.filter(f => !(TERMIN_FILE_CATEGORIES as readonly string[]).includes(f.category))
  if (unknownCatFiles.length > 0) {
    byCategory['Allgemein'] = [...(byCategory['Allgemein'] ?? []), ...unknownCatFiles]
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadError('')
    setUploading(true)
    try {
      await apiUpload(terminId, selectedCategory, Array.from(fileList))
      await load()
      setShowModal(false)
    } catch (e) {
      setUploadError('Upload fehlgeschlagen: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await apiDelete(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch { alert('Löschen fehlgeschlagen') }
  }

  async function handleRename(fileId: string, newName: string) {
    try {
      const updated = await apiPatchFile(fileId, { originalName: newName.trim() })
      setFiles(prev => prev.map(f => f.id === updated.id ? { ...f, originalName: updated.originalName } : f))
    } catch { alert('Umbenennen fehlgeschlagen') }
  }

  async function handleMoveCategory(fileId: string, newCategory: string) {
    try {
      const updated = await apiPatchFile(fileId, { category: newCategory })
      setFiles(prev => prev.map(f => f.id === updated.id ? { ...f, category: updated.category } : f))
    } catch { alert('Kategorie ändern fehlgeschlagen') }
  }

  async function openFile(file: FileItem) {
    try {
      const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (file.mimeType.startsWith('image/') || file.mimeType.includes('pdf')) {
        window.open(url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = url; a.download = file.originalName; a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { alert('Datei konnte nicht geöffnet werden') }
  }

  const usedCategories = Object.keys(byCategory)

  return (
    <>
      {/* Card */}
      <div className={`pt-card flex flex-col ${className}`}>
        {/* Header */}
        <div className="pt-card-header">
          <span className="pt-card-title">Dateien</span>
          <button
            onClick={() => { setUploadError(''); setShowModal(true) }}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="Datei hochladen"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-16 text-xs text-gray-400">Lade…</div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-20 px-4 text-center">
              <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
              <span className="text-xs text-red-500">{loadError}</span>
              <button onClick={load} className="mt-2 text-xs text-blue-500 hover:underline">Erneut versuchen</button>
            </div>
          ) : usedCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-gray-400">
              <File className="w-6 h-6 mb-1" />
              <span className="text-xs">Keine Dateien</span>
            </div>
          ) : (
            usedCategories.map(cat => (
              <CategorySection
                key={cat}
                category={cat}
                files={byCategory[cat]}
                onDelete={handleDelete}
                onRename={handleRename}
                onMoveCategory={handleMoveCategory}
                onOpen={openFile}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 py-2 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>{totalCount} {totalCount === 1 ? 'Datei' : 'Dateien'}</span>
          <span>{formatSize(totalBytes)}</span>
        </div>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            {/* Header */}
            <div className="modal-header">
              <span className="modal-title">Datei hochladen</span>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* Kategorie-Auswahl */}
              <div>
                <label className="form-label">Kategorie</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="form-select"
                >
                  {TERMIN_FILE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Dateien hierher ziehen oder klicken</p>
                <p className="text-xs text-gray-400 mt-1">Max. 50 MB pro Datei</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Wird hochgeladen…
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-700">{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TerminFileCard
