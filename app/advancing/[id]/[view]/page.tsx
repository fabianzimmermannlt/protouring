'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import {
  isAuthenticated, getCurrentUser, getTermine,
  getEffectiveRole, isEditorRole, canDo,
  CAN_SEE_FILES_TERMIN,
  type Termin,
} from '@/lib/api-client'
import TerminDetailMobile from '@/app/modules/termine/TerminDetailMobile'
import ReisegruppeView from '@/app/modules/termine/ReisegruppeView'
import AdvanceSheetView from '@/app/modules/termine/AdvanceSheetView'
import GaestelisteView from '@/app/modules/termine/GaestelisteView'
import TravelView from '@/app/modules/termine/TravelView'
import TerminModal from '@/app/modules/termine/TerminModal'
import { TerminDetail, TerminDetail2 } from '@/app/modules/termine/TermineModule'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { Loader2, AlertCircle } from 'lucide-react'

const ADVANCING_LAST_KEY = 'pt_advancing_last_id'
const VALID_VIEWS = ['details', 'details2', 'travel', 'travelparty', 'advance-sheet', 'guestlist'] as const
type DetailView = typeof VALID_VIEWS[number]

export default function AdvancingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const isMobile = useIsMobile()

  const terminId = parseInt(String(params.id), 10)
  const view = (VALID_VIEWS.includes(params.view as DetailView)
    ? params.view as DetailView
    : 'details')

  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const effectiveRole = getEffectiveRole()
  const isEditor = isEditorRole(effectiveRole)
  const canSeeFiles = canDo(effectiveRole, CAN_SEE_FILES_TERMIN)

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  // Load termine list
  useEffect(() => {
    if (!authChecked) return
    getTermine()
      .then(data => { setTermine(data); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); setLoading(false) })
  }, [authChecked])

  // Persist last visited advancing termin
  useEffect(() => {
    if (!isNaN(terminId)) {
      localStorage.setItem(ADVANCING_LAST_KEY, String(terminId))
    }
  }, [terminId])

  // Tell L3Layout: we are in advancing/detail mode with current view
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('advancing-view-changed', {
      detail: { view }
    }))
  }, [view])

  // Sub-tab view change → new URL
  useEffect(() => {
    const handler = (e: Event) => {
      const newView = (e as CustomEvent<{ view: DetailView }>).detail?.view
      if (newView && VALID_VIEWS.includes(newView as DetailView)) {
        router.push(`/advancing/${terminId}/${newView}`)
      }
    }
    window.addEventListener('advancing-set-view', handler)
    return () => window.removeEventListener('advancing-set-view', handler)
  }, [terminId, router])

  // Panel: termin selected
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ terminId: number }>).detail?.terminId
      if (id) router.push(`/advancing/${id}/details`)
    }
    window.addEventListener('advancing-select-termin', handler)
    return () => window.removeEventListener('advancing-select-termin', handler)
  }, [router])

  const handleTabChange = useCallback((tabId: string) => {
    let defaultSub = ''
    if (tabId === 'settings') defaultSub = 'profil'
    else if (tabId === 'contacts') defaultSub = 'overview'
    window.location.href = defaultSub ? `/?tab=${tabId}&sub=${defaultSub}` : `/?tab=${tabId}`
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Wird geladen...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  const sortedTermine = [...termine].sort((a, b) => a.date.localeCompare(b.date))
  const termin = sortedTermine.find(t => t.id === terminId) ?? null

  if (!termin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="inline mb-2 text-gray-400" size={24} />
          <p className="text-gray-500">Termin nicht gefunden</p>
          <button onClick={() => router.push('/?tab=advancing')} className="mt-3 text-blue-600 text-sm hover:underline">
            Zurück
          </button>
        </div>
      </div>
    )
  }

  const handleUpdated = (updated: Termin) => {
    setTermine(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
  }

  const handleDeleted = () => {
    setTermine(prev => prev.filter(t => t.id !== terminId))
    localStorage.removeItem(ADVANCING_LAST_KEY)
    router.push('/?tab=advancing')
  }

  const content = (
    <div className="module-content">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {view === 'travel' ? (
        <TravelView termin={termin} termine={sortedTermine} isAdmin={isEditor} />
      ) : view === 'travelparty' ? (
        <ReisegruppeView terminId={termin.id} isAdmin={isEditor} />
      ) : view === 'advance-sheet' ? (
        <AdvanceSheetView terminId={termin.id} />
      ) : view === 'guestlist' ? (
        <GaestelisteView key={termin.id} terminId={termin.id} />
      ) : isMobile ? (
        <>
          <TerminDetailMobile
            termin={termin}
            termine={sortedTermine}
            isAdmin={isEditor}
            canSeeFiles={canSeeFiles}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
            onEditClick={() => setEditModalOpen(true)}
          />
          {editModalOpen && (
            <TerminModal
              termin={termin}
              onClose={() => setEditModalOpen(false)}
              onSaved={updated => { handleUpdated(updated); setEditModalOpen(false) }}
              onDeleted={() => { handleDeleted(); setEditModalOpen(false) }}
            />
          )}
        </>
      ) : view === 'details2' ? (
        <TerminDetail2
          termin={termin}
          termine={sortedTermine}
          isAdmin={isEditor}
          canSeeFiles={canSeeFiles}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ) : (
        <TerminDetail
          termin={termin}
          termine={sortedTermine}
          isAdmin={isEditor}
          canSeeFiles={canSeeFiles}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )

  return (
    <AppShell activeTab="advancing" onTabChange={handleTabChange}>
      {content}
    </AppShell>
  )
}
