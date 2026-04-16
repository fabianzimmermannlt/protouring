'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navigation } from '@/app/components/shared/Navigation'
import DeskModule from './modules/desk/page'
import HotelsPage from './modules/hotels/page'
import VehiclesPage from './modules/vehicles/page'
import SettingsModule from './modules/settings/page'
import ContactsModule from './modules/contacts/page'
import PartnersPage from './modules/partners/page'
import VenuesPage from './modules/venues/page'
import TerminePage from './modules/termine/page'
import { isAuthenticated, getCurrentUser, getCurrentTenant } from '@/lib/api-client'

export default function ProTouringApp() {
  const [activeTab, setActiveTab] = useState('desk')
  const [activeSubTab, setActiveSubTab] = useState('artist')
  const [authChecked, setAuthChecked] = useState(false)
  const [navigateToTerminId, setNavigateToTerminId] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Direktlink von /artists: /?terminId=123 öffnet Termin direkt
  useEffect(() => {
    const terminId = searchParams.get('terminId')
    if (terminId) {
      const id = parseInt(terminId, 10)
      if (!isNaN(id)) {
        setNavigateToTerminId(id)
        setActiveTab('appointments')
        // Param aus URL entfernen ohne Re-Render
        router.replace('/')
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

  // Reset sub-tab when switching main tabs
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    // Set appropriate default sub-tab for each main tab
    if (tabId === 'settings') {
      setActiveSubTab('artist')
    } else if (tabId === 'contacts') {
      setActiveSubTab('overview')
    } else {
      setActiveSubTab('')
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <Navigation 
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
      />

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-4">
          {/* Content based on active tab */}
          <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
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
          </div>
        </div>
      </div>
    </main>
  )
}
