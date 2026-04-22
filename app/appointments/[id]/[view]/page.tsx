'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Navigation } from '@/app/components/shared/Navigation'
import { MobileBottomNav } from '@/app/components/shared/Navigation/MobileBottomNav'
import { FeedbackButton } from '@/app/components/shared/FeedbackButton'
import {
  isAuthenticated, getCurrentUser, getCurrentTenant, getTermine,
  getEffectiveRole, isAdminRole, isEditorRole, canDo,
  CAN_SEE_FILES_TERMIN,
  type Termin,
} from '@/lib/api-client'
import TerminDetailMobile from '@/app/modules/termine/TerminDetailMobile'
import ReisegruppeView from '@/app/modules/termine/ReisegruppeView'
import AdvanceSheetView from '@/app/modules/termine/AdvanceSheetView'
import GaestelisteView from '@/app/modules/termine/GaestelisteView'
import TerminModal from '@/app/modules/termine/TerminModal'
import { TerminDatumzeile, TerminDetail } from '@/app/modules/termine/TermineModule'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import { Loader2, AlertCircle } from 'lucide-react'

type DetailView = 'details' | 'travelparty' | 'advance-sheet' | 'guestlist'
const VALID_VIEWS: DetailView[] = ['details', 'travelparty', 'advance-sheet', 'guestlist']

export default function AppointmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const isMobile = useIsMobile()

  const terminId = parseInt(String(params.id), 10)
  const view = (VALID_VIEWS.includes(params.view as DetailView)
    ? params.view as DetailView
    : 'details')

  // Wenn via Aktuell-Button navigiert: diesen Button aktiv halten
  const fromAktuell = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('from') === 'aktuell'
  const activeNavItem = fromAktuell ? 'aktuell' : 'appointments'

  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Modal for mobile edit
  const [editModalOpen, setEditModalOpen] = useState(false)

  const effectiveRole = getEffectiveRole()
  const isEditor = isEditorRole(effectiveRole)
  const canSeeFiles = canDo(effectiveRole, CAN_SEE_FILES_TERMIN)
  const currentUser = getCurrentUser()
  const currentTenant = getCurrentTenant()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  // Load termine list (for prev/next navigation in TerminDatumzeile)
  useEffect(() => {
    if (!authChecked) return
    getTermine()
      .then(t => { setTermine(t); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); setLoading(false) })
  }, [authChecked])

  // Tell Navigation: we're in detail mode with the current view
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('termine-view-changed', {
      detail: { inDetail: true, view }
    }))
  }, [view])

  // Navigation back button → list page
  useEffect(() => {
    const handler = () => router.push('/?tab=appointments')
    window.addEventListener('termine-go-to-list', handler)
    return () => window.removeEventListener('termine-go-to-list', handler)
  }, [router])

  // Sub-tab view change → new URL
  useEffect(() => {
    const handler = (e: Event) => {
      const newView = (e as CustomEvent<{ view: DetailView }>).detail?.view
      if (newView && VALID_VIEWS.includes(newView)) {
        router.push(`/appointments/${terminId}/${newView}`)
      }
    }
    window.addEventListener('termine-set-view', handler)
    return () => window.removeEventListener('termine-set-view', handler)
  }, [terminId, router])

  const handleTabChange = useCallback((tabId: string) => {
    // window.location.href statt router.push: umgeht Next.js Router-Cache
    // (router.push würde den alten SPA-State wiederherstellen)
    let defaultSub = ''
    if (tabId === 'settings') defaultSub = 'artist'
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
          <button onClick={() => router.push('/?tab=appointments')} className="mt-3 text-blue-600 text-sm hover:underline">
            Zur Terminliste
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
    router.push('/?tab=appointments')
  }

  const content = (
    <div className="module-content">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <TerminDatumzeile
        termin={termin}
        termine={sortedTermine}
        onNavigate={id => router.push(`/appointments/${id}/details`)}
      />

      {view === 'travelparty' ? (
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
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden flex flex-col bg-gray-100" style={{ height: 'calc(100dvh - var(--pt-preview-height, 0px))' }}>
        <Navigation
          activeTab="appointments"
          onTabChange={handleTabChange}
          showMobileNavigation={true}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            {content}
          </div>
        </div>
        <FeedbackButton />
        <MobileBottomNav
          activeTab="appointments"
          onTabChange={handleTabChange}
          isSuperadmin={isSuperadmin}
          initialActiveItem={activeNavItem}
        />
      </div>

      {/* ── DESKTOP ── */}
      <main className="hidden md:block min-h-screen bg-gray-100">
        <Navigation
          activeTab="appointments"
          onTabChange={handleTabChange}
          showMobileNavigation={false}
        />
        <FeedbackButton />
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
              {content}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
