'use client'

import { useState } from 'react'
import { Navigation } from '@/app/components/shared/Navigation'
import DeskModule from './modules/desk/page'
import HotelsPage from './modules/hotels/page'
import VehiclesPage from './modules/vehicles/page'

export default function ProTouringApp() {
  const [activeTab, setActiveTab] = useState('desk')

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <Navigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {activeTab === 'desk' ? 'SCHREIBTISCH' : 
             activeTab === 'appointments' ? 'TERMINE' :
             activeTab === 'contacts' ? 'KONTAKTE' :
             activeTab === 'about' ? 'ÜBER UNS' :
             activeTab === 'hotels' ? 'HOTELS' :
             activeTab === 'vehicles' ? 'FAHRZEUGE' :
             activeTab === 'venues' ? 'LOCATIONS' :
             activeTab === 'templates' ? 'VORLAGEN' :
             activeTab === 'settings' ? 'EINSTELLUNGEN' : ''}
          </h1>
          <p className="text-gray-600 mb-4">
            {activeTab === 'desk' ? 'Haupt-Dashboard' : 
             activeTab === 'appointments' ? 'Termine & Planung' :
             activeTab === 'contacts' ? 'Kontaktverwaltung' :
             activeTab === 'about' ? 'Band-Informationen' :
             activeTab === 'hotels' ? 'Unterkünfte' :
             activeTab === 'vehicles' ? 'Transport & Logistik' :
             activeTab === 'venues' ? 'Spielorte' :
             activeTab === 'templates' ? 'Dokumentenvorlagen' :
             activeTab === 'settings' ? 'Anwendungseinstellungen' : ''}
          </p>
          
          {/* Content based on active tab */}
          <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
            {activeTab === 'desk' && <DeskModule />}
            {activeTab === 'appointments' && (
              <div className="text-center py-8">
                <div className="text-gray-500">TERMINE</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="text-center py-8">
                <div className="text-gray-500">KONTAKTE</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="text-center py-8">
                <div className="text-gray-500">ÜBER UNS</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
            {activeTab === 'hotels' && <HotelsPage />}
            {activeTab === 'vehicles' && <VehiclesPage />}
            {activeTab === 'venues' && (
              <div className="text-center py-8">
                <div className="text-gray-500">LOCATIONS</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
            {activeTab === 'templates' && (
              <div className="text-center py-8">
                <div className="text-gray-500">VORLAGEN</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="text-center py-8">
                <div className="text-gray-500">EINSTELLUNGEN</div>
                <div className="text-sm text-gray-400 mt-2">Bald verfügbar...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
