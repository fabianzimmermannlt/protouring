'use client'

/**
 * Shared Lightbox — identisch zum Venue-Page-Pattern
 * Referenz: app/venues/[id]/page.tsx
 *
 * USAGE:
 *   const lb = useLightbox(photos, apiBase, authHeadersFn)
 *   <button onClick={() => lb.open(idx)} />
 *   <Lightbox {...lb.props} />
 *
 * Das Hook übernimmt State, Ref, Blob-Fetching und Keyboard-Navigation.
 * Die Komponente rendert 1:1 wie in der Venue-Page.
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LightboxFile {
  id: string
  originalName: string
}

export interface LightboxProps {
  index: number | null
  blobUrl: string | null
  loading: boolean
  files: LightboxFile[]
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLightbox(
  files: LightboxFile[],
  apiBase: string,
  getHeaders: () => Record<string, string>
) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState<string | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)
  const lightboxIndexRef = useRef<number | null>(null)
  // Ref für files — damit open/navigate immer die aktuelle Liste sehen
  const filesRef = useRef<LightboxFile[]>(files)
  useEffect(() => { filesRef.current = files }, [files])

  async function open(index: number) {
    setLightboxLoading(true)
    setLightboxIndex(index)
    lightboxIndexRef.current = index
    try {
      const file = filesRef.current[index]
      const res = await fetch(`${apiBase}/api/files/download/${file.id}`, { headers: getHeaders() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setLightboxBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch { /* ignore */ }
    finally { setLightboxLoading(false) }
  }

  function close() {
    setLightboxBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setLightboxIndex(null)
    lightboxIndexRef.current = null
  }

  function navigate(dir: 1 | -1) {
    const idx = lightboxIndexRef.current
    const len = filesRef.current.length
    if (idx === null || len === 0) return
    open((idx + dir + len) % len)
  }

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowLeft') navigate(-1)
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex])

  const props: LightboxProps = {
    index: lightboxIndex,
    blobUrl: lightboxBlobUrl,
    loading: lightboxLoading,
    files,
    onClose: close,
    onPrev: () => navigate(-1),
    onNext: () => navigate(1),
  }

  return { open, close, navigate, props }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Lightbox({ index, blobUrl, loading, files, onClose, onPrev, onNext }: LightboxProps) {
  if (index === null) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev */}
      {files.length > 1 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          onClick={e => { e.stopPropagation(); onPrev() }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      {loading ? (
        <Loader2 className="w-10 h-10 text-white/60 animate-spin" onClick={e => e.stopPropagation()} />
      ) : blobUrl ? (
        <img
          src={blobUrl}
          alt={files[index]?.originalName}
          className="max-w-full max-h-full object-contain rounded"
          onClick={e => e.stopPropagation()}
        />
      ) : null}

      {/* Next */}
      {files.length > 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          onClick={e => { e.stopPropagation(); onNext() }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Caption + Counter — unten mittig */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white/60 text-sm">{files[index]?.originalName}</p>
        {files.length > 1 && (
          <p className="text-white/40 text-xs mt-0.5">{index + 1} / {files.length}</p>
        )}
      </div>
    </div>
  )
}
