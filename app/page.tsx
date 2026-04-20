'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()

  const VALID_TABS = ['desk','appointments','contacts','venues','partners','hotels','vehicles','templates','settings','feedback']
  const initialTab = (() => {
    const t = searchParams.get('tab')
    return t && VALID_TABS.includes(t) ? t : 'desk'
  })()

  const [activeTab, setActiveTab] = useState(initialTab)
  const [activeSubTab, setActiveSubTab] = useState(initialTab === 'settings' ? 'artist' : initialTab === 'contacts' ? 'overview' : '')
  const [authChecked, setAuthChecked] = useState(false)
  const [navigateToTerminId, setNavigateToTerminId] = useState<number | null>(null)

  // Direktlink von /artists: /?terminId=123 öffnet Termin direkt
  useEffect(() => {
    const terminId = searchParams.get('terminId')
    if (terminId) {
      const id = parseInt(terminId, 10)
      if (!isNaN(id)) {
        setNavigateToTerminId(id)
        setActiveTab('appointments')
        router.replace('/?tab=appointments')
      }
    }
  }, [searchParams, router])

  // Globales Event: vom Schreibtisch zu einem Termin navigieren
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ terminId: number }>).detail?.terminId
      if (id) {
        setNavigateToTerminId(id)
        setActiveTab('appointments')
      }
    }
    window.addEventListener('navigate-to-termin', handler)
    return () => window.removeEventListener('navigate-to-termin', handler)
  }, [])

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

  // Reset sub-tab when switching main tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    if (tabId === 'settings') {
      setActiveSubTab('artist')
    } else if (tabId === 'contacts') {
      setActiveSubTab('overview')
    } else {
      setActiveSubTab('')
    }
    router.replace(`/?tab=${tabId}`)
  }

  const content = (
    <>
      {activeTab === 'desk' && <DeskModule />}
      {activeTab === 'appointments' && (
        <TerminePage
          initialSelectedId={navigateToTerminId}
          onNavigated={() => setNavigateToTerminId(null)}
        />
      )}
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
      <div className="md:hidden flex flex-col bg-gray-100" style={{ height: '100dvh' }}>
        {/* Slim Header + Sub-Nav */}
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeSubTab={activeSubTab}
          onSubTabChange={setActiveSubTab}
          showMobileNavigation={true}
        />

        {/* Scrollbarer Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            {content}
          </div>
        </div>

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
          onSubTabChange={setActiveSubTab}
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
