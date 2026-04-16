'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Edit2, Loader2, AlertCircle } from 'lucide-react'
import {
  getTermin,
  patchTermin,
  getCurrentTenant,
  isAuthenticated,
  type Termin,
} from '@/lib/api-client'
import TerminModal from '../TerminModal'
import TerminFileCard from '../TerminFileCard'

// ============================================================
// Status badge helpers
// ============================================================

const STATUS_BOOKING_COLOR: Record<string, string> = {
  'Idee':                  'badge badge-gray',
  'Option':                'badge badge-yellow',
  'noch nicht bestätigt':  'badge badge-orange',
  'bestätigt':             'badge badge-green',
  'abgeschlossen':         'badge badge-blue',
  'abgesagt':              'badge badge-red',
}

const STATUS_PUBLIC_COLOR: Record<string, string> = {
  'nicht öffentlich': 'badge badge-gray',
  'tba':              'badge badge-yellow',
  'veröffentlicht':   'badge badge-green',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ============================================================
// Veranstaltung-Card (read-only)
// ============================================================

function VeranstaltungCard({ termin, isAdmin, onEditClick }: {
  termin: Termin
  isAdmin: boolean
  onEditClick: () => void
}) {
  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">Veranstaltung</span>
        {isAdmin && (
          <button
            onClick={onEditClick}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit2 size={12} /> Bearbeiten
          </button>
        )}
      </div>
      <div className="pt-card-body">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-gray-400 font-medium whitespace-nowrap">Datum</dt>
          <dd className="text-gray-800">{formatDate(termin.date)}</dd>

          <dt className="text-gray-400 font-medium">Titel</dt>
          <dd className="text-gray-800 font-semibold">{termin.title}</dd>

          {(termin.art || termin.artSub) && (
            <>
              <dt className="text-gray-400 font-medium">Art</dt>
              <dd className="text-gray-800">
                {termin.art}
                {termin.artSub && <span className="text-gray-400 ml-1">· {termin.artSub}</span>}
              </dd>
            </>
          )}

          {termin.statusBooking && (
            <>
              <dt className="text-gray-400 font-medium">Status</dt>
              <dd>
                <span className={STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}>
                  {termin.statusBooking}
                </span>
              </dd>
            </>
          )}

          {termin.statusPublic && (
            <>
              <dt className="text-gray-400 font-medium">Öffentlich</dt>
              <dd>
                <span className={STATUS_PUBLIC_COLOR[termin.statusPublic] || 'badge badge-gray'}>
                  {termin.statusPublic}
                </span>
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}

// ============================================================
// Placeholder card
// ============================================================

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="pt-card" style={{ borderStyle: 'dashed' }}>
      <div className="pt-card-header">
        <span className="pt-card-title">{title}</span>
      </div>
      <div className="pt-card-body text-center text-gray-300 text-sm">
        Noch nicht verfügbar
      </div>
    </div>
  )
}

// ============================================================
// Main page
// ============================================================

export default function TerminDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [termin, setTermin] = useState<Termin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [togglingHeader, setTogglingHeader] = useState(false)

  useEffect(() => {
    const tenant = getCurrentTenant()
    setIsAdmin(!!tenant && ['owner', 'admin', 'manager'].includes(tenant.role))
  }, [])

  const loadTermin = useCallback(async () => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    try {
      setLoading(true)
      setError(null)
      const t = await getTermin(id)
      setTermin(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Termin nicht gefunden')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { loadTermin() }, [loadTermin])

  if (loading) return (
    <div className="p-8 text-center text-gray-400">
      <Loader2 className="inline animate-spin mb-2" size={24} />
      <p>Lade Termin…</p>
    </div>
  )

  if (error || !termin) return (
    <div className="p-8 text-center text-gray-500">
      <AlertCircle className="inline mb-2 text-red-400" size={24} />
      <p className="mb-4">{error || 'Termin nicht gefunden'}</p>
      <button onClick={() => router.back()} className="text-blue-600 hover:underline text-sm">← Zurück</button>
    </div>
  )

  const pageTitle = termin.showTitleAsHeader
    ? termin.title
    : [termin.city, termin.venueName].filter(Boolean).join(' · ') || termin.title

  const handleToggleHeader = async (checked: boolean) => {
    if (togglingHeader) return
    setTogglingHeader(true)
    try {
      const updated = await patchTermin(termin.id, { show_title_as_header: checked })
      setTermin(prev => prev ? { ...prev, ...updated } : updated)
    } finally {
      setTogglingHeader(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Sub-navigation bar */}
      <div className="bg-gray-50 border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-12 gap-2">
            <button
              onClick={() => router.push('/modules/termine')}
              className="px-3 py-2 rounded-md text-xs font-medium uppercase text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              Terminliste
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <span className="text-xs text-gray-400 font-mono mr-2">
            {new Date(termin.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
          <span className="text-base font-semibold text-gray-900">{pageTitle}</span>
        </div>
        {termin.statusBooking && (
          <span className={`ml-1 ${STATUS_BOOKING_COLOR[termin.statusBooking] || 'badge badge-gray'}`}>
            {termin.statusBooking}
          </span>
        )}
        {isAdmin && (
          <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none" title="Titel statt Ort · Spielstätte anzeigen">
            <input
              type="checkbox"
              checked={!!termin.showTitleAsHeader}
              onChange={e => handleToggleHeader(e.target.checked)}
              disabled={togglingHeader}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="text-xs text-gray-400">Titel als Header</span>
            {togglingHeader && <Loader2 size={10} className="animate-spin text-gray-400" />}
          </label>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <VeranstaltungCard
          termin={termin}
          isAdmin={isAdmin}
          onEditClick={() => setModalOpen(true)}
        />
        <PlaceholderCard title="Spielstätte & Ort" />
        <PlaceholderCard title="Logistik" />
        <PlaceholderCard title="Crew" />
        <PlaceholderCard title="Rider" />
        <PlaceholderCard title="Finanzen" />
        <TerminFileCard terminId={String(termin.id)} className="min-h-[200px]" />
        <PlaceholderCard title="Notizen" />
      </div>

      {/* Edit modal */}
      {modalOpen && (
        <TerminModal
          termin={termin}
          onClose={() => setModalOpen(false)}
          onSaved={updated => {
            setTermin(prev => prev ? { ...prev, ...updated } : updated)
            setModalOpen(false)
          }}
          onDeleted={() => router.replace('/modules/termine')}
        />
      )}
      </div>
    </div>
  )
}
