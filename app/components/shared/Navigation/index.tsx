'use client'

import { useState } from 'react'
import { Home, Calendar, Users, MapPin, Hotel, Car, Music, FileText, Settings } from 'lucide-react'

export interface NavigationItem {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

export interface NavigationProps {
  activeTab?: string
  onTabChange?: (tabId: string) => void
  maxWidth?: string
  showMobileNavigation?: boolean
}

const navigationItems: NavigationItem[] = [
  { id: 'desk', name: 'SCHREIBTISCH', icon: Home, description: 'Haupt-Dashboard' },
  { id: 'appointments', name: 'TERMINE', icon: Calendar, description: 'Termine & Planung' },
  { id: 'contacts', name: 'KONTAKTE', icon: Users, description: 'Kontaktverwaltung' },
  { id: 'about', name: 'ÜBER UNS', icon: Music, description: 'Band-Informationen' },
  { id: 'hotels', name: 'HOTELS', icon: Hotel, description: 'Unterkünfte' },
  { id: 'vehicles', name: 'FAHRZEUGE', icon: Car, description: 'Transport & Logistik' },
  { id: 'venues', name: 'LOCATIONS', icon: MapPin, description: 'Spielorte' },
  { id: 'templates', name: 'VORLAGEN', icon: FileText, description: 'Dokumentenvorlagen' },
  { id: 'settings', name: 'EINSTELLUNGEN', icon: Settings, description: 'Anwendungseinstellungen' }
]

export function Navigation({
  activeTab = 'desk',
  onTabChange,
  maxWidth = 'max-w-full',
  showMobileNavigation = true
}: NavigationProps) {
  const [currentTab, setCurrentTab] = useState(activeTab)

  const handleTabChange = (tabId: string) => {
    setCurrentTab(tabId)
    if (onTabChange) {
      onTabChange(tabId)
    }
  }

  return (
    <>
      {/* Desktop Navigation */}
      <header className="bg-gray-900 text-white shadow-sm border-b">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">ProTouring</h1>
            </div>
            <nav className="hidden md:flex space-x-1">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentTab === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {showMobileNavigation && (
        <div className="md:hidden border-b bg-gray-900 text-white px-4 py-2">
          <div className={`${maxWidth} mx-auto`}>
            <div className="flex space-x-2 overflow-x-auto">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    currentTab === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-3 h-3" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Navigation
