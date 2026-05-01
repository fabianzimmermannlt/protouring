'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import {
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  MusicalNoteIcon,
  BuildingOfficeIcon,
  TruckIcon,
  Cog6ToothIcon,
  BriefcaseIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  WrenchScrewdriverIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import {
  getCurrentUser,
  getCurrentTenant,
  getAllTenants,
  setAllTenants,
  getMyTenants,
  logout,
  CURRENT_TENANT_KEY,
  getTenantArtistSettings,
  NAV_VISIBLE,
  canDo,
  getEffectiveRole,
} from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useLayout } from './LayoutContext'
import PreviewBanner from '@/app/components/shared/PreviewBanner'

// ─── Nav structure ────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { id: 'desk',         name: 'Schreibtisch', icon: HomeIcon },
  { id: 'appointments', name: 'Termine',       icon: CalendarDaysIcon },
  { id: 'contacts',     name: 'Kontakte',      icon: UsersIcon },
  { id: 'venues',       name: 'Venues',        icon: MusicalNoteIcon },
  { id: 'partners',     name: 'Partner',       icon: BriefcaseIcon },
  { id: 'hotels',       name: 'Hotels',        icon: BuildingOfficeIcon },
  { id: 'vehicles',     name: 'Fahrzeuge',     icon: TruckIcon },
  { id: 'settings',     name: 'Einstellungen', icon: Cog6ToothIcon },
]

const MODULE_NAV = [
  { id: 'equipment', name: 'Equipment', icon: WrenchScrewdriverIcon },
]

// Label for breadcrumb
const TAB_LABELS: Record<string, string> = {
  desk:         'Schreibtisch',
  appointments: 'Termine',
  contacts:     'Kontakte',
  venues:       'Venues',
  partners:     'Partner',
  hotels:       'Hotels',
  vehicles:     'Fahrzeuge',
  settings:     'Einstellungen',
  equipment:    'Equipment',
}

const SUB_LABELS: Record<string, string> = {
  profil:        'Profil',
  artist:        'Artist',
  team:          'Team',
  overview:      'Übersicht',
  items:         'Gegenstände',
  material:      'Material',
  categories:    'Kategorien',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface L2LayoutProps {
  activeTab: string
  activeSubTab?: string
  onTabChange: (tab: string, sub?: string) => void
  onSubTabChange?: (sub: string) => void
  children: ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export function L2Layout({
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
  children,
}: L2LayoutProps) {
  const router = useRouter()
  const { setLayout } = useLayout()

  const [artistName, setArtistName] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [allTenantsState, setAllTenantsState] = useState<Array<{ id: number; name: string; slug: string; status: string; role: string }>>([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)

  const userMenuRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)
  const role = getEffectiveRole()

  const initials = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .map(n => n![0].toUpperCase())
    .join('') || currentUser?.email?.[0]?.toUpperCase() || '?'

  // Artist name
  useEffect(() => {
    const load = () => {
      getTenantArtistSettings()
        .then(s => setArtistName(s.displayName || getCurrentTenant()?.name || ''))
        .catch(() => setArtistName(getCurrentTenant()?.name || ''))
    }
    load()
    window.addEventListener('artistUpdated', load)
    return () => window.removeEventListener('artistUpdated', load)
  }, [])

  // Tenant list
  useEffect(() => {
    setActiveTenantSlug(getCurrentTenant()?.slug ?? null)
    const cached = getAllTenants()
    if (cached.length > 0) { setAllTenantsState(cached) }
    getMyTenants()
      .then(res => { setAllTenants(res.tenants); setAllTenantsState(res.tenants) })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNav = (id: string) => {
    let defaultSub: string | undefined
    if (id === 'settings') defaultSub = 'profil'
    else if (id === 'contacts') defaultSub = 'overview'
    else if (id === 'equipment') defaultSub = 'items'
    onTabChange(id, defaultSub)
    setShowUserMenu(false)
  }

  const handleSwitchTenant = (t: { id: number; name: string; slug: string; status: string; role: string }) => {
    setShowUserMenu(false)
    localStorage.removeItem('protouring_preview_role')
    localStorage.setItem(CURRENT_TENANT_KEY, JSON.stringify(t))
    setActiveTenantSlug(t.slug)
    window.location.href = '/'
  }

  // Breadcrumb
  const breadcrumb = [
    TAB_LABELS[activeTab] ?? activeTab,
    activeSubTab ? (SUB_LABELS[activeSubTab] ?? activeSubTab) : null,
  ].filter(Boolean)

  return (
    <div className="hidden md:flex h-screen bg-gray-100 overflow-hidden">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col border-r border-gray-700">

        {/* Top: Identity */}
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2.5 mb-1">
            {/* User Menu trigger */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {initials}
                </div>
                <span className="text-sm font-semibold text-orange-400 leading-none">ProTouring</span>
                <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* Profil */}
                  <button
                    onClick={() => { setShowUserMenu(false); onTabChange('settings', 'profil') }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <UserCircleIcon className="w-4 h-4 text-gray-400" />
                    Mein Profil
                  </button>

                  {/* Layout toggle */}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setShowUserMenu(false); setLayout('L1') }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ViewColumnsIcon className="w-4 h-4 text-gray-400" />
                    Layout: zurück zu L1
                  </button>

                  {/* Artists */}
                  {allTenantsState.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setShowUserMenu(false); router.push('/artists') }}
                        className="w-full text-left px-4 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 uppercase tracking-wider flex items-center justify-between"
                      >
                        Artists
                        <span className="normal-case text-gray-300 text-xs font-normal">Übersicht</span>
                      </button>
                      {allTenantsState.map(t => (
                        <button
                          key={t.id}
                          onClick={() => activeTenantSlug === t.slug ? setShowUserMenu(false) : handleSwitchTenant(t)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{t.name}</span>
                          {activeTenantSlug === t.slug && <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                        </button>
                      ))}
                      {allTenantsState.some(t => t.role === 'admin') && (
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

                  {/* Superadmin: Feedback */}
                  {isSuperadmin && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setShowUserMenu(false); onTabChange('feedback') }}
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

          {/* Artist name */}
          {artistName && (
            <p className="text-xs text-gray-400 truncate pl-[42px]">{artistName}</p>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {MAIN_NAV.filter(item => canDo(role, NAV_VISIBLE[item.id] ?? [])).map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </button>
          ))}
        </nav>

        {/* Module section (bottom) */}
        {canDo(role, NAV_VISIBLE['modules'] ?? []) && (
          <div className="px-2 pb-3 border-t border-gray-700 pt-3">
            <p className="px-3 pb-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">Module</p>
            {MODULE_NAV.map(item => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.name}
                <span className="ml-auto text-[9px] font-semibold text-orange-400 bg-orange-950 border border-orange-800 px-1 py-0.5 rounded">
                  ADDON
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header bar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'font-medium text-gray-900' : 'text-gray-400'}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>

          {/* Right: PreviewBanner */}
          <div className="flex items-center gap-3">
            <PreviewBanner />
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default L2Layout
