'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/app/components/shared/Navigation'
import DeskModule from './modules/desk/page'
import HotelsPage from './modules/hotels/page'
import VehiclesPage from './modules/vehicles/page'
import SettingsModule from './modules/settings/SettingsModule'
import ContactsModule from './modules/contacts/ContactsModule'
import PartnersPage from './modules/partners/page'
import VenuesPage from './modules/venues/page'
import TerminePage from './modules/termine/TermineModule'
import { isAuthenticated, getCurrentUser, getCurrentTenant } from '@/lib/api-client'
import { FeedbackButton } from '@/app/components/shared/FeedbackButton'
import FeedbackPage from './modules/feedback/FeedbackPage'
import { MobileBottomNav } from '@/app/components/shared/Navigation/MobileBottomNav'

export default function ProTouringApp() {
  const router = useRouter()

  const VALID_TABS = ['desk','appointments','contacts','venues','partners','hotels','vehicles','templates','settings','feedback']

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'desk'
    const p = new URLSearchParams(window.location.search)
    const t = p.get('tab')
    return t && VALID_TABS.includes(t) ? t : 'desk'
  })

  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (typeof window === 'undefined') return ''
    const p = new URLSearchParams(window.location.search)
    const s = p.get('sub')
    const t = p.get('tab')
    if (s) return s
    if (t === 'settings') return 'profil'
    if (t === 'contacts') return 'overview'
    return ''
  })

  const [authChecked, setAuthChecked] = useState(false)

  // Direktlink von /artists: /?terminId=123 (ohne tab-Param) öffnet Termin direkt
  // Einmalig beim Mount, kein useSearchParams → keine Re-renders durch history.replaceState
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const terminId = p.get('terminId')
    const tab = p.get('tab')
    if (terminId && !tab) {
      const id = parseInt(terminId, 10)
      if (!isNaN(id)) {
        setActiveTab('appointments')
        router.replace(`/?tab=appointments&terminId=${id}`, { scroll: false })
      }
    }
  }, [])

  // Globales Event: vom Schreibtisch zu einem Termin navigieren → direkt zur Detail-URL
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ terminId: number }>).detail?.terminId
      if (id) router.push(`/appointments/${id}/details`)
    }
    window.addEventListener('navigate-to-termin', handler)
    return () => window.removeEventListener('navigate-to-termin', handler)
  }, [router])

  // Globales Event: zum Feedback-Tab navigieren (z.B. vom FeedbackButton)
  useEffect(() => {
    const handler = () => setActiveTab('feedback')
    window.addEventListener('navigate-to-feedback', handler)
    return () => window.removeEventListener('navigate-to-feedback', handler)
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Wird geladen...</div>
      </div>
    )
  }

  const currentUser = getCurrentUser()
  const currentTenant = getCurrentTenant()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)

  const handleSubTabChange = (subId: string) => {
    setActiveSubTab(subId)
    router.replace(`/?tab=${activeTab}&sub=${subId}`, { scroll: false })
  }

  // Reset sub-tab when switching main tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    let defaultSub = ''
    if (tabId === 'settings') defaultSub = 'profil'
    else if (tabId === 'contacts') defaultSub = 'overview'
    setActiveSubTab(defaultSub)
    router.replace(defaultSub ? `/?tab=${tabId}&sub=${defaultSub}` : `/?tab=${tabId}`, { scroll: false })
  }

  const content = (
    <>
      {activeTab === 'desk' && <DeskModule />}
      {activeTab === 'appointments' && <TerminePage />}
      {activeTab === 'contacts' && <ContactsModule activeSubTab={activeSubTab} />}
      {activeTab === 'venues' && <VenuesPage />}
      {activeTab === 'partners' && <PartnersPage />}
      {activeTab === 'hotels' && <HotelsPage />}
      {activeTab === 'vehicles' && <VehiclesPage />}
      {activeTab === 'templates' && (
        <div className="text-center py-8">
          <div className="text-gray-500">VORLAGEN</div>
          <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
        </div>
      )}
      {activeTab === 'settings' && <SettingsModule activeSubTab={activeSubTab} />}
      {activeTab === 'feedback' && <FeedbackPage />}
    </>
  )

  return (
    <>
      {/* ── MOBILE: Flex-Column mit 100dvh, kein fixed positioning ── */}
      <div className="md:hidden flex flex-col bg-gray-100" style={{ height: 'calc(100dvh - var(--pt-preview-height, 0px))' }}>
        {/* Slim Header + Sub-Nav */}
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeSubTab={activeSubTab}
          onSubTabChange={handleSubTabChange}
          showMobileNavigation={true}
        />

        {/* Scrollbarer Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            {content}
          </div>
        </div>

        <FeedbackButton />
        {/* Bottom Nav — normaler Flex-Item, kein fixed */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isSuperadmin={isSuperadmin}
        />
      </div>

      {/* ── DESKTOP: bisheriges Layout ── */}
      <main className="hidden md:block min-h-screen bg-gray-100">
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeSubTab={activeSubTab}
          onSubTabChange={handleSubTabChange}
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
