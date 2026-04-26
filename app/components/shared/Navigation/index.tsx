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
  CircleStackIcon,
  PuzzlePieceIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { MobileBottomNav } from './MobileBottomNav'
import { getCurrentUser, getCurrentTenant, getAllTenants, setAllTenants, getMyTenants, logout, CURRENT_TENANT_KEY, getTenantArtistSettings, NAV_VISIBLE, canDo, getEffectiveRole } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import PreviewBanner from '@/app/components/shared/PreviewBanner'
import DeactivatedScreen from '@/app/components/shared/DeactivatedScreen'
import { SubNavigation } from './SubNavigation'
import { ContactsSubNavigation } from './ContactsSubNavigation'
import { TermineSubNavigation, TermineListSubNavigation, type TermineListFilter, type TermineListView } from './TermineSubNavigation'
import { EquipmentSubNavigation } from './EquipmentSubNavigation'

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

// Haupt-Nav-Items
const navigationItems: NavigationItem[] = [
  { id: 'desk',         name: 'SCHREIBTISCH',  icon: HomeIcon,         description: 'Haupt-Dashboard' },
  { id: 'appointments', name: 'TERMINE',        icon: CalendarDaysIcon, description: 'Termine & Planung' },
  { id: 'contacts',     name: 'KONTAKTE',       icon: UsersIcon,        description: 'Kontaktverwaltung' },
  { id: 'venues',       name: 'VENUES',         icon: MusicalNoteIcon,  description: 'Spielstätten' },
  { id: 'partners',     name: 'PARTNER',        icon: BriefcaseIcon,    description: 'Partnerunternehmen' },
  { id: 'hotels',       name: 'HOTELS',         icon: BuildingOfficeIcon, description: 'Hotels & Unterkünfte' },
  { id: 'vehicles',     name: 'FAHRZEUGE',      icon: TruckIcon,        description: 'Fahrzeugverwaltung' },
  { id: 'settings',     name: 'EINSTELLUNGEN',  icon: Cog6ToothIcon,    description: 'Anwendungseinstellungen' },
]

// Stammdaten-Gruppe (nur noch für canSeeStammdaten-Check intern genutzt)
const STAMMDATEN_CHILDREN = [
  { id: 'venues',   name: 'Venues',    icon: MusicalNoteIcon },
  { id: 'partners', name: 'Partner',   icon: BriefcaseIcon },
  { id: 'hotels',   name: 'Hotels',    icon: BuildingOfficeIcon },
  { id: 'vehicles', name: 'Fahrzeuge', icon: TruckIcon },
]

// Module-Gruppe (Addon-Dropdown)
const MODULE_CHILDREN = [
  { id: 'equipment', name: 'Equipment', icon: WrenchScrewdriverIcon },
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

  // Prop-Sync
  useEffect(() => { setCurrentTab(activeTab) }, [activeTab])

  const [artistName, setArtistName] = useState('')
  const [termineInDetail, setTermineInDetail] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.startsWith('/appointments/')
  })
  const [termineView, setTermineView] = useState<'details' | 'travelparty' | 'advance-sheet' | 'guestlist'>(() => {
    if (typeof window === 'undefined') return 'details'
    const parts = window.location.pathname.split('/')
    const view = parts[3]
    const validViews = ['details', 'travelparty', 'advance-sheet', 'guestlist']
    return (validViews.includes(view) ? view : 'details') as 'details' | 'travelparty' | 'advance-sheet' | 'guestlist'
  })
  const [termineFilter, setTermineFilter] = useState<TermineListFilter>(() => {
    if (typeof window === 'undefined') return 'aktuell'
    const f = new URLSearchParams(window.location.search).get('filter') as TermineListFilter
    return f ?? 'aktuell'
  })
  const [termineListView, setTermineListView] = useState<TermineListView>('list')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showStammdatenDropdown, setShowStammdatenDropdown] = useState(false)
  const [showModulesDropdown, setShowModulesDropdown] = useState(false)
  const [tenantCount, setTenantCount] = useState(0)
  const [allTenants, setAllTenantsState] = useState<Array<{ id: number; name: string; slug: string; status: string; role: string }>>([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const stammdatenRef = useRef<HTMLDivElement>(null)
  const modulesRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)
  const router = useRouter()
  const hasMultipleTenants = tenantCount > 1
  const role = getEffectiveRole()

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

  // Alle Dropdowns bei Klick außerhalb schließen
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (stammdatenRef.current && !stammdatenRef.current.contains(e.target as Node)) {
        setShowStammdatenDropdown(false)
      }
      if (modulesRef.current && !modulesRef.current.contains(e.target as Node)) {
        setShowModulesDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Artist-Name laden
  useEffect(() => {
    const loadArtistName = () => {
      getTenantArtistSettings()
        .then(s => setArtistName(s.displayName || getCurrentTenant()?.name || ''))
        .catch(() => setArtistName(getCurrentTenant()?.name || ''))
    }
    loadArtistName()
    window.addEventListener('artistUpdated', loadArtistName)
    return () => window.removeEventListener('artistUpdated', loadArtistName)
  }, [])

  // Termine Detail-View Events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ inDetail: boolean; view?: 'details' | 'travelparty' | 'advance-sheet' | 'guestlist' }>).detail
      if (detail.inDetail) {
        setTermineInDetail(true)
        if (detail.view) setTermineView(detail.view)
      }
    }
    window.addEventListener('termine-view-changed', handler)
    return () => window.removeEventListener('termine-view-changed', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      setTermineInDetail(false)
      setTermineView('details')
    }
    window.addEventListener('termine-go-to-list', handler)
    return () => window.removeEventListener('termine-go-to-list', handler)
  }, [])

  const handleTabChange = (tabId: string, subTabId?: string) => {
    setCurrentTab(tabId)
    setShowStammdatenDropdown(false)
    setShowModulesDropdown(false)
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

  // Aktiv-States für Dropdown-Gruppen
  const isStammdatenActive = STAMMDATEN_CHILDREN.some(c => c.id === currentTab)
  const isModulesActive = MODULE_CHILDREN.some(c => c.id === currentTab)

  // Sichtbarkeit: Stammdaten zeigen wenn mindestens ein Kind sichtbar
  const canSeeStammdaten = STAMMDATEN_CHILDREN.some(c => canDo(role, NAV_VISIBLE[c.id] ?? []))
  const canSeeModules = canDo(role, NAV_VISIBLE['modules'] ?? [])

  // Nav-Button Helper
  const NavButton = ({ item }: { item: NavigationItem }) => (
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
  )

  const visibleItems = (ids: string[]) =>
    navigationItems.filter(item =>
      ids.includes(item.id) &&
      (item.superadminOnly ? isSuperadmin : canDo(role, NAV_VISIBLE[item.id] ?? []))
    )

  return (
    <>
      <DeactivatedScreen />
      {/* Desktop Navigation */}
      <header className="hidden md:block bg-gray-900 text-white shadow-sm border-b">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="flex items-center h-16">
            {/* Links: Logo */}
            <div className="flex-1 flex items-center">
              <div>
                <h1 className="text-xl font-bold text-orange-400">ProTouring</h1>
                {artistName && (
                  <p className="text-xs text-gray-400 mt-0.5">{artistName}</p>
                )}
              </div>
            </div>

            {/* Mitte: Hauptnavigation */}
            <nav className="hidden md:flex items-center space-x-1">

              {/* Schreibtisch, Termine, Kontakte, Venues, Partner, Hotels, Fahrzeuge */}
              {visibleItems(['desk', 'appointments', 'contacts', 'venues', 'partners', 'hotels', 'vehicles']).map(item => (
                <NavButton key={item.id} item={item} />
              ))}

              {/* MODULE Dropdown */}
              {canSeeModules && (
                <div className="relative" ref={modulesRef}>
                  <button
                    onClick={() => {
                      setShowModulesDropdown(v => !v)
                      setShowStammdatenDropdown(false)
                      setShowUserMenu(false)
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isModulesActive || showModulesDropdown
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <PuzzlePieceIcon className="w-4 h-4" />
                    MODULE
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${showModulesDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showModulesDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {MODULE_CHILDREN.map(child => (
                        <button
                          key={child.id}
                          onClick={() => handleTabChange(child.id)}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                            currentTab === child.id
                              ? 'text-blue-600 bg-blue-50 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <child.icon className="w-4 h-4 text-gray-400" />
                          {child.name}
                          <span className="ml-auto text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                            ADDON
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Einstellungen */}
              {visibleItems(['settings']).map(item => (
                <NavButton key={item.id} item={item} />
              ))}

            </nav>

            {/* Rechts: User-Menu */}
            <div className="flex-1 flex justify-end items-center">
              <div className="flex items-center gap-2">
                <PreviewBanner />
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => {
                      setShowUserMenu(v => !v)
                      setShowStammdatenDropdown(false)
                      setShowModulesDropdown(false)
                    }}
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
            </div>
          </div>
        </div>
      </header>

      {/* Mobile: slim Header */}
      {showMobileNavigation && (
        <div className="md:hidden bg-gray-900 text-white border-b border-gray-700 px-4 h-14 flex items-center justify-between">
          {/* Links: Initials / User-Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-1 text-gray-300 hover:text-white"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
            {showUserMenu && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button onClick={handleGoToProfil} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <UserCircleIcon className="w-4 h-4 text-gray-400" />
                  Mein Profil
                </button>
                {allTenants.length > 0 && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { setShowUserMenu(false); router.push('/artists') }} className="w-full text-left px-4 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 uppercase tracking-wider flex items-center justify-between">
                      Artists <span className="normal-case text-gray-300 text-xs font-normal">Übersicht</span>
                    </button>
                    {allTenants.map(t => (
                      <button key={t.id} onClick={() => activeTenantSlug === t.slug ? setShowUserMenu(false) : handleSwitchTenant(t)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        {activeTenantSlug === t.slug && <CheckIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                      </button>
                    ))}
                  </>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setShowUserMenu(false); logout() }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  Abmelden
                </button>
              </div>
            )}
          </div>

          {/* Mitte: Logo + Artist */}
          <div className="text-center absolute left-1/2 -translate-x-1/2">
            <p className="text-base font-bold text-orange-400 leading-none">ProTouring</p>
            {artistName && <p className="text-[10px] text-gray-400 mt-0.5">{artistName}</p>}
          </div>

          {/* Rechts: PreviewBanner */}
          <div className="flex items-center">
            <PreviewBanner />
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
          onBack={() => {
            setTermineInDetail(false)
            window.dispatchEvent(new CustomEvent('termine-go-to-list'))
          }}
          onViewChange={(view) => {
            setTermineView(view)
            setTermineInDetail(true)
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
            const p = new URLSearchParams(window.location.search)
            p.set('filter', f)
            window.history.replaceState(null, '', `/?${p.toString()}`)
          }}
          onListViewChange={(v) => {
            setTermineListView(v)
            window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: v } }))
          }}
        />
      )}
      {currentTab === 'equipment' && (
        <EquipmentSubNavigation
          activeTab={activeSubTab}
          parentTab={currentTab}
          onTabChange={onSubTabChange}
          maxWidth={maxWidth}
        />
      )}
      {currentTab !== 'desk' && currentTab !== 'settings' && currentTab !== 'contacts' && currentTab !== 'appointments' && currentTab !== 'equipment' && (
        <div className="bg-gray-50 border-b h-12" />
      )}
    </>
  )
}

export default Navigation
