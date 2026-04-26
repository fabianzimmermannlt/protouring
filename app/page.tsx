'use client'

import { useState, useEffect, useRef } from 'react'
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

  const VALID_TABS = ['desk','appointments','contacts','venues','partners','hotels','vehicles','templates','equipment','settings','feedback']

  const STORAGE_TAB = 'pt_tab'
  const STORAGE_SUB = 'pt_sub'

  const [activeTab, setActiveTab] = useState('desk')
  const [activeSubTab, setActiveSubTab] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const activeTabRef = useRef('desk') // Ref für stale-closure-sichere Tab-Zugriffe

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    const p = new URLSearchParams(window.location.search)
    const tUrl = p.get('tab')
    const sUrl = p.get('sub')
    const terminId = p.get('terminId')

    if (terminId && !tUrl) {
      const id = parseInt(terminId, 10)
      if (!isNaN(id)) {
        window.location.href = `/appointments/${id}/details`
        return
      }
    }

    // URL-Params haben Priorität (z.B. window.location.href von appointments-Seite)
    // Fallback: sessionStorage (überlebt F5-Reload auch wenn Next.js URL zurücksetzt)
    const t = (tUrl && VALID_TABS.includes(tUrl)) ? tUrl : sessionStorage.getItem(STORAGE_TAB)
    const s = sUrl || sessionStorage.getItem(STORAGE_SUB)

    if (t && VALID_TABS.includes(t)) {
      activeTabRef.current = t
      setActiveTab(t)
      setActiveSubTab(s || (t === 'settings' ? 'profil' : t === 'contacts' ? 'overview' : ''))
    }
    setAuthChecked(true)
  }, [router])

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
    sessionStorage.setItem(STORAGE_SUB, subId)
    // activeTabRef statt activeTab: Closure-sicher auch wenn handleTabChange davor aufgerufen wurde
    history.replaceState(null, '', `/?tab=${activeTabRef.current}&sub=${subId}`)
  }

  const handleTabChange = (tabId: string) => {
    activeTabRef.current = tabId  // sofort aktualisieren, bevor Sub-Tab-Handler feuert
    setActiveTab(tabId)
    let defaultSub = ''
    if (tabId === 'settings') defaultSub = 'profil'
    else if (tabId === 'contacts') defaultSub = 'overview'
    setActiveSubTab(defaultSub)
    sessionStorage.setItem(STORAGE_TAB, tabId)
    sessionStorage.setItem(STORAGE_SUB, defaultSub)
    history.replaceState(null, '', defaultSub ? `/?tab=${tabId}&sub=${defaultSub}` : `/?tab=${tabId}`)
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
      {activeTab === 'equipment' && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.885-9.088a9.998 9.998 0 00-1.1.21M5.065 2.93A10 10 0 001 12a10 10 0 008.285 9.82M14.25 4.28l-2.45 2.45" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Equipment-Modul</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Gegenstände, Material und Carnet ATA.<br />
            Wird in Kürze gebaut.
          </p>
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
