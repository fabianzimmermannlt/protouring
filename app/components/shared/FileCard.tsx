'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Upload, File, Trash2, Edit, AlertCircle, X, Download } from 'lucide-react'
import { getAuthToken, getCurrentTenant } from '@/lib/api-client'

// ============================================================
// Types
// ============================================================

export interface FileItem {
  id: string
  entityType: string
  entityId: string
  category: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  uploadedBy?: number
  createdAt: string
  url: string
}

export interface FileCardProps {
  title: string
  /** z.B. 'desk', 'termin', 'contact' */
  entityType: string
  /** ID des zugehörigen Objekts (userId, terminId, contactId …) */
  entityId: string
  /** Unterkategorie innerhalb des Entity-Types, z.B. 'general', 'personal', 'rider' */
  category?: string
  maxFiles?: number
  maxFileSizeMB?: number
  className?: string
  /** Darf hochladen, umbenennen, löschen. Default: true (Abwärtskompatibilität) */
  canManage?: boolean
}

// ============================================================
// API helpers
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenant) headers['X-Tenant-Slug'] = tenant.slug
  return headers
}

async function apiListFiles(entityType: string, entityId: string, category: string): Promise<FileItem[]> {
  const res = await fetch(`${API_BASE}/api/files/${entityType}/${entityId}?category=${category}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('List failed')
  const data = await res.json()
  return data.files ?? []
}

async function apiUpload(
  entityType: string,
  entityId: string,
  category: string,
  files: File[]
): Promise<FileItem[]> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  const res = await fetch(`${API_BASE}/api/files/${entityType}/${entityId}?category=${category}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.files ?? []
}

async function apiDelete(fileId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Delete failed')
}

async function apiRename(fileId: string, originalName: string): Promise<FileItem> {
  const res = await fetch(`${API_BASE}/api/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ originalName }),
  })
  if (!res.ok) throw new Error('Rename failed')
  const data = await res.json()
  return data.file
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
// Component
// ============================================================

export function FileCard({
  title,
  entityType,
  entityId,
  category = 'general',
  maxFiles = 10,
  maxFileSizeMB = 50,
  className = '',
  canManage = true,
}: FileCardProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  const pct = Math.min((totalBytes / (maxFiles * maxFileSizeMB * 1024 * 1024)) * 100, 100)

  useEffect(() => {
    load()
  }, [entityType, entityId, category])

  async function load() {
    setLoading(true)
    try {
      const list = await apiListFiles(entityType, entityId, category)
      setFiles(list)
    } catch {
      // ignore – entity/tenant may not be ready yet
    } finally {
      setLoading(false)
    }
  }

  function validate(fileList: File[]): string[] {
    const errs: string[] = []
    if (files.length + fileList.length > maxFiles) {
      errs.push(`Max. ${maxFiles} Dateien erlaubt (aktuell ${files.length})`)
    }
    fileList.forEach(f => {
      if (f.size > maxFileSizeMB * 1024 * 1024) {
        errs.push(`${f.name} ist größer als ${maxFileSizeMB} MB`)
      }
    })
    return errs
  }

  async function handleSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const arr = Array.from(fileList)
    const errs = validate(arr)
    if (errs.length > 0) { setError(errs.join('\n')); return }
    setError('')
    setUploading(true)
    try {
      await apiUpload(entityType, entityId, category, arr)
      await load()
      setShowModal(false)
    } catch (e) {
      setError('Upload fehlgeschlagen: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await apiDelete(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch {
      alert('Löschen fehlgeschlagen')
    }
  }

  async function handleRename() {
    if (!editingId || !editingName.trim()) return
    try {
      const updated = await apiRename(editingId, editingName.trim())
      setFiles(prev => prev.map(f => f.id === updated.id ? updated : f))
    } catch {
      alert('Umbenennen fehlgeschlagen')
    } finally {
      setEditingId(null)
      setEditingName('')
    }
  }

  async function openFile(file: FileItem) {
    try {
      const res = await fetch(`${API_BASE}/api/files/download/${file.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Fehler beim Laden')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      // Für PDFs und Bilder: im Tab öffnen. Für andere: Download.
      if (file.mimeType.startsWith('image/') || file.mimeType.includes('pdf')) {
        window.open(blobUrl, '_blank')
      } else {
        a.download = file.originalName
        a.click()
      }
      // Blob-URL nach kurzer Zeit freigeben
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch {
      alert('Datei konnte nicht geöffnet werden')
    }
  }

  return (
    <>
      {/* Card */}
      <div className={`pt-card flex flex-col ${className}`}>
        {/* Header */}
        <div className="pt-card-header">
          <span className="pt-card-title">{title}</span>
          {canManage && (
            <button
              onClick={() => { setError(''); setShowModal(true) }}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Dateien hochladen"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-sm text-gray-400">Lade…</div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-gray-400">
              <File className="w-6 h-6 mb-1" />
              <span className="text-xs">Keine Dateien</span>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-sm hover:bg-gray-100 transition-colors">
                  {editingId === file.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename()
                          if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                        }}
                        className="flex-1 px-1 py-0.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button onClick={handleRename} className="text-green-600 px-1" title="Speichern">✓</button>
                      <button onClick={() => { setEditingId(null); setEditingName('') }} className="text-red-500 px-1" title="Abbrechen">✕</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => openFile(file)}
                        className="flex items-center gap-1.5 flex-1 text-left truncate hover:text-blue-600 transition-colors"
                        title={file.originalName}
                      >
                        <span>{fileIcon(file.mimeType)}</span>
                        <span className="truncate">{file.originalName}</span>
                      </button>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                        {canManage && (
                          <>
                            <button
                              onClick={() => { setEditingId(file.id); setEditingName(file.originalName) }}
                              className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                              title="Umbenennen"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5 rounded"
                              title="Löschen"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage bar */}
        <div className="mt-auto pt-2 pb-3 px-4 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{formatSize(totalBytes)} genutzt</span>
            <span>{files.length} / {maxFiles} Dateien</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">Max. {maxFileSizeMB} MB pro Datei</div>
        </div>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">{title} — Dateien hochladen</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drop Zone */}
            <div className="p-5">
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleSelect(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">Dateien hierher ziehen oder klicken</p>
                <p className="text-xs text-gray-400">
                  Max. {maxFileSizeMB} MB pro Datei · max. {maxFiles} Dateien gesamt
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => handleSelect(e.target.files)}
                />
              </div>

              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Wird hochgeladen…
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-red-700 whitespace-pre-line">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
