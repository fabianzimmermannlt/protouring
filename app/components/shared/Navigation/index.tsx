'use client'

import { useState, useEffect, useRef } from 'react'
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  MusicalNoteIcon,
  BuildingOfficeIcon,
  TruckIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  BriefcaseIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { getCurrentUser, getCurrentTenant, getAllTenants, setAllTenants, getMyTenants, logout, CURRENT_TENANT_KEY, getTenantArtistSettings, NAV_VISIBLE, canDo, getEffectiveRole } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import PreviewBanner from '@/app/components/shared/PreviewBanner'
import DeactivatedScreen from '@/app/components/shared/DeactivatedScreen'
import { SubNavigation } from './SubNavigation'
import { ContactsSubNavigation } from './ContactsSubNavigation'
import { TermineSubNavigation, TermineListSubNavigation, type TermineListFilter, type TermineListView } from './TermineSubNavigation'

export interface NavigationItem {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  superadminOnly?: boolean
}

export interface NavigationProps {
  activeTab?: string
  onTabChange?: (tabId: string) => void
  maxWidth?: string
  showMobileNavigation?: boolean
  activeSubTab?: string
  onSubTabChange?: (subTabId: string) => void
}

const navigationItems: NavigationItem[] = [
  { id: 'desk', name: 'SCHREIBTISCH', icon: HomeIcon, description: 'Haupt-Dashboard' },
  { id: 'appointments', name: 'TERMINE', icon: CalendarDaysIcon, description: 'Termine & Planung' },
  { id: 'contacts', name: 'KONTAKTE', icon: UsersIcon, description: 'Kontaktverwaltung' },
  { id: 'venues', name: 'VENUES', icon: MusicalNoteIcon, description: 'Spielstätten & Locations' },
  { id: 'partners', name: 'PARTNER', icon: BriefcaseIcon, description: 'Partner & Dienstleister' },
  { id: 'hotels', name: 'HOTELS', icon: BuildingOfficeIcon, description: 'Unterkünfte' },
  { id: 'vehicles', name: 'FAHRZEUGE', icon: TruckIcon, description: 'Transport & Logistik' },
  { id: 'templates', name: 'VORLAGEN', icon: DocumentTextIcon, description: 'Dokumentenvorlagen' },
  { id: 'settings', name: 'EINSTELLUNGEN', icon: Cog6ToothIcon, description: 'Anwendungseinstellungen' },
]

export function Navigation({
  activeTab = 'desk',
  onTabChange,
  maxWidth = 'max-w-full',
  showMobileNavigation = true,
  activeSubTab,
  onSubTabChange
}: NavigationProps) {
  const [currentTab, setCurrentTab] = useState(activeTab)
  const [artistName, setArtistName] = useState('')
  const [termineInDetail, setTermineInDetail] = useState(false)
  const [termineView, setTermineView] = useState<'details' | 'travelparty'>('details')
  const [termineFilter, setTermineFilter] = useState<TermineListFilter>('aktuell')
  const [termineListView, setTermineListView] = useState<TermineListView>('list')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [tenantCount, setTenantCount] = useState(0)
  const [allTenants, setAllTenantsState] = useState<Array<{ id: number; name: string; slug: string; status: string; role: string }>>([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)
  const router = useRouter()
  const hasMultipleTenants = tenantCount > 1

  // Tenant-Liste beim Mount aktualisieren
  useEffect(() => {
    setActiveTenantSlug(getCurrentTenant()?.slug ?? null)
    const cached = getAllTenants()
    if (cached.length > 0) { setAllTenantsState(cached); setTenantCount(cached.length) }
    getMyTenants()
      .then(res => {
        setAllTenants(res.tenants)
        setAllTenantsState(res.tenants)
        setTenantCount(res.tenants.length)
      })
      .catch(() => {/* ignore */})
  }, [])
  const initials = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .map(n => n![0].toUpperCase())
    .join('') || currentUser?.email?.[0]?.toUpperCase() || '?'

  // Dropdown schließen bei Klick außerhalb
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load artist name from API
  useEffect(() => {
    const loadArtistName = () => {
      getTenantArtistSettings()
        .then(s => setArtistName(s.displayName || getCurrentTenant()?.name || ''))
        .catch(() => setArtistName(getCurrentTenant()?.name || ''))
    }

    loadArtistName()

    // Nach Speichern in Settings neu laden
    window.addEventListener('artistUpdated', loadArtistName)
    return () => window.removeEventListener('artistUpdated', loadArtistName)
  }, []);

  // Listen for Termine detail view changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ inDetail: boolean; view?: 'details' | 'travelparty' }>).detail
      setTermineInDetail(detail.inDetail)
      if (detail.view) setTermineView(detail.view)
      if (!detail.inDetail) setTermineView('details')
    }
    window.addEventListener('termine-view-changed', handler)
    return () => window.removeEventListener('termine-view-changed', handler)
  }, [])

  const handleTabChange = (tabId: string, subTabId?: string) => {
    setCurrentTab(tabId)
    onTabChange?.(tabId)
    if (subTabId) onSubTabChange?.(subTabId)
  }

  const handleGoToProfil = () => {
    setShowUserMenu(false)
    handleTabChange('settings', 'profil')
  }

  const handleSwitchTenant = (tenant: { id: number; name: string; slug: string; status: string; role: string }) => {
    setShowUserMenu(false)
    localStorage.removeItem('protouring_preview_role')
    localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify(tenant))
    setActiveTenantSlug(tenant.slug)
    window.location.href = '/'
  }

  return (
    <>
      <DeactivatedScreen />
      {/* Desktop Navigation */}
      <header className="bg-gray-900 text-white shadow-sm border-b">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div>
                <h1 className="text-xl font-bold text-orange-400">ProTouring</h1>
                {artistName && (
                  <p className="text-xs text-gray-400 mt-0.5">{artistName}</p>
                )}
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              {navigationItems.filter(item =>
  (item.superadminOnly ? isSuperadmin : canDo(getEffectiveRole(), NAV_VISIBLE[item.id] ?? []))
).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id, item.id === 'settings' ? 'profil' : undefined)}
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
              <div className="ml-3 pl-3 border-l border-gray-700 flex items-center gap-2">
                <PreviewBanner />
                {/* User-Dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                      {initials}
                    </div>
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {/* Mein Profil */}
                      <button
                        onClick={handleGoToProfil}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <UserCircleIcon className="w-4 h-4 text-gray-400" />
                        Mein Profil
                      </button>

                      {/* Artist-Liste */}
                      {allTenants.length > 0 && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={() => { setShowUserMenu(false); router.push('/artists') }}
                            className="w-full text-left px-4 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 uppercase tracking-wider flex items-center justify-between"
                          >
                            Artists
                            <span className="normal-case text-gray-300 text-xs font-normal">Übersicht</span>
                          </button>
                          {allTenants.map(t => (
                            <button
                              key={t.id}
                              onClick={() => activeTenantSlug === t.slug ? setShowUserMenu(false) : handleSwitchTenant(t)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{t.name}</span>
                              {activeTenantSlug === t.slug && (
                                <CheckIcon className="w-4 h-4 text-blue-500 shrink-0" />
                              )}
                            </button>
                          ))}
                          {allTenants.some(t => t.role === 'admin') && (
                            <button
                              onClick={() => { setShowUserMenu(false); router.push('/artists?new=1') }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <PlusIcon className="w-4 h-4" />
                              Neuer Artist
                            </button>
                          )}
                        </>
                      )}

                      {/* Feedback (nur Superadmin) */}
                      {isSuperadmin && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={() => { setShowUserMenu(false); onTabChange?.('feedback') }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400" />
                            Feedback
                          </button>
                        </>
                      )}

                      {/* Abmelden */}
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setShowUserMenu(false); logout() }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Abmelden
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {showMobileNavigation && (
        <div className="md:hidden border-b bg-gray-900 text-white px-4 py-2">
          <div className={`${maxWidth} mx-auto`}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h1 className="text-lg font-bold text-orange-400">ProTouring</h1>
                {artistName && (
                  <p className="text-xs text-gray-400">{artistName}</p>
                )}
              </div>
            </div>
            <div className="flex space-x-2 overflow-x-auto">
              {navigationItems.filter(item =>
  (item.superadminOnly ? isSuperadmin : canDo(getEffectiveRole(), NAV_VISIBLE[item.id] ?? []))
).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id, item.id === 'settings' ? 'profil' : undefined)}
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

      {/* Sub Navigation */}
      {currentTab === 'settings' && (
        <SubNavigation
          activeTab={activeSubTab}
          parentTab={currentTab}
          onTabChange={onSubTabChange}
          maxWidth={maxWidth}
        />
      )}
      {currentTab === 'contacts' && (
        <ContactsSubNavigation
          activeTab={activeSubTab}
          parentTab={currentTab}
          onTabChange={onSubTabChange}
          maxWidth={maxWidth}
        />
      )}
      {currentTab === 'appointments' && termineInDetail && (
        <TermineSubNavigation
          maxWidth={maxWidth}
          activeView={termineView}
          onBack={() => window.dispatchEvent(new CustomEvent('termine-go-to-list'))}
          onViewChange={(view) => {
            setTermineView(view)
            window.dispatchEvent(new CustomEvent('termine-set-view', { detail: { view } }))
          }}
        />
      )}
      {currentTab === 'appointments' && !termineInDetail && (
        <TermineListSubNavigation
          maxWidth={maxWidth}
          activeFilter={termineFilter}
          listView={termineListView}
          onFilterChange={(f) => {
            setTermineFilter(f)
            window.dispatchEvent(new CustomEvent('termine-filter-changed', { detail: { filter: f } }))
          }}
          onListViewChange={(v) => {
            setTermineListView(v)
            window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: v } }))
          }}
        />
      )}
      {currentTab !== 'desk' && currentTab !== 'settings' && currentTab !== 'contacts' && currentTab !== 'appointments' && (
        <div className="bg-gray-50 border-b h-12" />
      )}
    </>
  )
}

export default Navigation
