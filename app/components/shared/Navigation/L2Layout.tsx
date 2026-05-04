'use client'

import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
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
  XMarkIcon,
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
  isEditorRole,
  CAN_SEE_KALENDER,
  type TenantRole,
} from '@/lib/api-client'
import type { TermineDetailView, TermineListFilter, TermineListView } from './TermineSubNavigation'
import { useRouter } from 'next/navigation'
import { useLayout } from './LayoutContext'
import PreviewBanner from '@/app/components/shared/PreviewBanner'

// ─── Sub-item definitions ─────────────────────────────────────────────────────

type SubItem = { id: string; name: string; editorOnly?: boolean; adminOnly?: boolean }

// Settings: grouped für Modal-Sidebar
const SETTINGS_KONTO: SubItem[] = [
  { id: 'profil',         name: 'Mein Profil' },
  { id: 'appearance',     name: 'Darstellung' },
  { id: 'notifications',  name: 'Benachrichtigungen' },
  { id: 'erste-schritte', name: 'Erste Schritte' },
]
const SETTINGS_WORKSPACE: SubItem[] = [
  { id: 'artist',      name: 'Artist',          adminOnly: true },
  { id: 'permissions', name: 'Berechtigungen',  editorOnly: true },
  { id: 'contacts',    name: 'Kontakte',         editorOnly: true },
  { id: 'partners',    name: 'Partners',         adminOnly: true },
  { id: 'gewerke',     name: 'Gewerke',          editorOnly: true },
  { id: 'guestlist',   name: 'Gästeliste',       editorOnly: true },
  { id: 'daysheet',    name: 'Daysheet',         editorOnly: true },
  { id: 'vorlagen',    name: 'Vorlagen',         editorOnly: true },
]

const CONTACTS_SUBS: SubItem[] = [
  { id: 'overview',     name: 'Übersicht' },
  { id: 'crew-booking', name: 'Crew-Vermittlung', editorOnly: true },
  { id: 'conditions',   name: 'Konditionen',       editorOnly: true },
]

const EQUIPMENT_SUBS: SubItem[] = [
  { id: 'items',       name: 'Gegenstände' },
  { id: 'materials',   name: 'Material' },
  { id: 'categories',  name: 'Kategorien' },
  { id: 'eigentuemer', name: 'Eigentümer' },
  { id: 'carnets',     name: 'Carnets' },
]

const SUB_ITEMS: Record<string, SubItem[]> = {
  contacts:  CONTACTS_SUBS,
  equipment: EQUIPMENT_SUBS,
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { id: 'desk',         name: 'Schreibtisch', icon: HomeIcon },
  { id: 'appointments', name: 'Termine',       icon: CalendarDaysIcon },
  { id: 'contacts',     name: 'Kontakte',      icon: UsersIcon },
  { id: 'venues',       name: 'Venues',        icon: MusicalNoteIcon },
  { id: 'partners',     name: 'Partner',       icon: BriefcaseIcon },
  { id: 'hotels',       name: 'Hotels',        icon: BuildingOfficeIcon },
  { id: 'vehicles',     name: 'Fahrzeuge',     icon: TruckIcon },
]

const MODULE_NAV = [
  { id: 'equipment', name: 'Equipment', icon: WrenchScrewdriverIcon },
]

// ─── Breadcrumb labels ────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  desk: 'Schreibtisch', appointments: 'Termine', contacts: 'Kontakte',
  venues: 'Venues', partners: 'Partner', hotels: 'Hotels',
  vehicles: 'Fahrzeuge', equipment: 'Equipment',
}

const SUB_LABELS: Record<string, string> = {}
;[...CONTACTS_SUBS, ...EQUIPMENT_SUBS, ...SETTINGS_KONTO, ...SETTINGS_WORKSPACE].forEach(
  s => { SUB_LABELS[s.id] = s.name }
)

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
  const { layout, setLayout } = useLayout()

  const [artistName, setArtistName] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [allTenantsState, setAllTenantsState] = useState<
    Array<{ id: number; name: string; slug: string; status: string; role: string }>
  >([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)

  const userMenuRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)
  const role = getEffectiveRole() as TenantRole
  const isEditor = isEditorRole(role)
  const canSeeKalender = canDo(role, CAN_SEE_KALENDER)

  // ── Termine state (event-driven, mirrors Navigation/index.tsx) ───────────
  const [termineInDetail, setTermineInDetail] = useState(false)
  const [termineView, setTermineView] = useState<TermineDetailView>('details')
  const [termineFilter, setTermineFilter] = useState<TermineListFilter>('aktuell')
  const [termineListView, setTermineListView] = useState<TermineListView>('list')

  useEffect(() => {
    const onViewChanged = (e: Event) => {
      const d = (e as CustomEvent<{ inDetail: boolean; view?: TermineDetailView }>).detail
      if (d.inDetail) { setTermineInDetail(true); if (d.view) setTermineView(d.view) }
    }
    const onGoToList = () => { setTermineInDetail(false); setTermineView('details') }
    const onSetView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setTermineView(v)
    }
    const onFilterChanged = (e: Event) => {
      const f = (e as CustomEvent<{ filter: TermineListFilter }>).detail?.filter
      if (f) setTermineFilter(f)
    }
    const onListViewChanged = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineListView }>).detail?.view
      if (v) setTermineListView(v)
    }
    window.addEventListener('termine-view-changed', onViewChanged)
    window.addEventListener('termine-go-to-list', onGoToList)
    window.addEventListener('termine-set-view', onSetView)
    window.addEventListener('termine-filter-changed', onFilterChanged)
    window.addEventListener('termine-listview-changed', onListViewChanged)
    return () => {
      window.removeEventListener('termine-view-changed', onViewChanged)
      window.removeEventListener('termine-go-to-list', onGoToList)
      window.removeEventListener('termine-set-view', onSetView)
      window.removeEventListener('termine-filter-changed', onFilterChanged)
      window.removeEventListener('termine-listview-changed', onListViewChanged)
    }
  }, [])

  const initials =
    [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .map(n => n![0].toUpperCase())
      .join('') ||
    currentUser?.email?.[0]?.toUpperCase() ||
    '?'

  // Settings modal state
  const isSettingsOpen = activeTab === 'settings'
  const closeSettings = useCallback(() => {
    onTabChange('desk')
  }, [onTabChange])

  // ESC closes settings modal
  useEffect(() => {
    if (!isSettingsOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isSettingsOpen, closeSettings])

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
    if (cached.length > 0) setAllTenantsState(cached)
    getMyTenants()
      .then(res => { setAllTenants(res.tenants); setAllTenantsState(res.tenants) })
      .catch(() => {})
  }, [])

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleNav = (id: string) => {
    if (id === 'settings') { onTabChange('settings', 'profil'); return }
    let defaultSub: string | undefined
    if (id === 'contacts') defaultSub = 'overview'
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

  const getVisibleSubs = (tabId: string): SubItem[] =>
    (SUB_ITEMS[tabId] ?? []).filter(s => {
      if (s.adminOnly) return role === 'admin'
      if (s.editorOnly) return isEditor
      return true
    })

  const filterSettings = (items: SubItem[]) =>
    items.filter(s => {
      if (s.adminOnly) return role === 'admin'
      if (s.editorOnly) return isEditor
      return true
    })

  // Breadcrumb (only for non-settings tabs)
  const breadcrumb = [
    TAB_LABELS[activeTab] ?? activeTab,
    activeSubTab ? (SUB_LABELS[activeSubTab] ?? activeSubTab) : null,
  ].filter(Boolean)

  // ── Termine sub-nav (event-driven) ─────────────────────────────────────────
  const renderTermineSubs = () => {
    if (termineInDetail) {
      // Detail-Ansicht: Zurück + View-Tabs
      const views = [
        { id: 'details',       label: 'Details' },
        { id: 'travelparty',   label: 'Reisegruppe' },
        ...(isEditor ? [{ id: 'advance-sheet', label: 'Advance Sheet' }] : []),
        { id: 'guestlist',     label: 'Gästeliste' },
      ] as { id: string; label: string }[]

      return (
        <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('termine-go-to-list'))}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors flex items-center gap-1"
          >
            ← Terminliste
          </button>
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => {
                setTermineView(v.id as TermineDetailView)
                window.dispatchEvent(new CustomEvent('termine-set-view', { detail: { view: v.id } }))
              }}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                termineView === v.id
                  ? 'text-white font-medium bg-gray-700'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )
    }

    // Listen-Ansicht: Filter + optional Kalender
    const filters: { id: TermineListFilter; label: string }[] = [
      { id: 'aktuell',   label: 'Aktuelle Termine' },
      { id: 'vergangen', label: 'Vergangene Termine' },
      { id: 'alle',      label: 'Alle Termine' },
    ]
    return (
      <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => {
              setTermineFilter(f.id)
              setTermineListView('list')
              window.dispatchEvent(new CustomEvent('termine-filter-changed', { detail: { filter: f.id } }))
              window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'list' } }))
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
              termineListView === 'list' && termineFilter === f.id
                ? 'text-white font-medium bg-gray-700'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        {canSeeKalender && (
          <button
            onClick={() => {
              setTermineListView('calendar')
              window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'calendar' } }))
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
              termineListView === 'calendar'
                ? 'text-white font-medium bg-gray-700'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Kalender
          </button>
        )}
      </div>
    )
  }

  // ── Nav item renderer ───────────────────────────────────────────────────────
  const renderNavItem = (
    item: { id: string; name: string; icon: React.ComponentType<{ className?: string }> },
    isModule = false
  ) => {
    const isActive = activeTab === item.id
    const subs = getVisibleSubs(item.id)
    const hasSubNav = subs.length > 0 || item.id === 'appointments'

    return (
      <div key={item.id}>
        <button
          onClick={() => handleNav(item.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{item.name}</span>
          {isModule && (
            <span className="text-[9px] font-semibold text-orange-400 bg-orange-950 border border-orange-800 px-1 py-0.5 rounded">
              ADDON
            </span>
          )}
          {hasSubNav && (
            <ChevronDownIcon
              className={`w-3 h-3 flex-shrink-0 transition-transform ${
                isActive ? 'rotate-180 text-blue-200' : 'text-gray-500'
              }`}
            />
          )}
        </button>

        {isActive && item.id === 'appointments' && renderTermineSubs()}

        {isActive && item.id !== 'appointments' && hasSubNav && (
          <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
            {subs.map(sub => (
              <button
                key={sub.id}
                onClick={() => onSubTabChange?.(sub.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  activeSubTab === sub.id
                    ? 'text-white font-medium bg-gray-700'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Settings modal sidebar group ────────────────────────────────────────────
  const renderSettingsGroup = (label: string, items: SubItem[]) => {
    const visible = filterSettings(items)
    if (visible.length === 0) return null
    return (
      <div className="mb-4">
        <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        {visible.map(item => (
          <button
            key={item.id}
            onClick={() => onSubTabChange?.(item.id)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeSubTab === item.id
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="hidden md:flex h-screen bg-gray-100 overflow-hidden">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col border-r border-gray-700">

        {/* Identity */}
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2.5 mb-1">
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

              {showUserMenu && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { setShowUserMenu(false); onTabChange('settings', 'profil') }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <UserCircleIcon className="w-4 h-4 text-gray-400" />
                    Mein Profil
                  </button>
                  {isSuperadmin && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <p className="px-4 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Layout</p>
                      {(['L1', 'L2', 'L3'] as const).map(m => (
                        <button key={m}
                          onClick={() => { setShowUserMenu(false); setLayout(m) }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2">
                            <ViewColumnsIcon className="w-4 h-4 text-gray-400" />
                            {m === 'L1' ? 'L1 – Classic' : m === 'L2' ? 'L2 – Sidebar' : 'L3 – Rail + Panel'}
                          </span>
                          {layout === m && <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                        </button>
                      ))}
                    </>
                  )}
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
          {artistName && (
            <p className="text-xs text-gray-400 truncate pl-[42px]">{artistName}</p>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {MAIN_NAV.filter(item => canDo(role, NAV_VISIBLE[item.id] ?? [])).map(item =>
            renderNavItem(item)
          )}

          {/* Module section inside main nav */}
          {canDo(role, NAV_VISIBLE['modules'] ?? []) && (
            <>
              <div className="pt-2 pb-1">
                <div className="border-t border-gray-700" />
              </div>
              <p className="px-3 pb-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Module
              </p>
              {MODULE_NAV.map(item => renderNavItem(item, true))}
            </>
          )}
        </nav>

        {/* Einstellungen – ganz unten */}
        <div className="px-2 pb-3 border-t border-gray-700 pt-3">
          <button
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" />
            Einstellungen
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0 gap-4">
          {/* Left: Breadcrumb */}
          <nav className="flex-1 flex items-center gap-1.5 text-sm min-w-0">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'font-medium text-gray-900' : 'text-gray-400'}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>

          {/* Center: Termine detail view tabs */}
          {activeTab === 'appointments' && termineInDetail && (
            <div className="flex items-center gap-0.5">
              {([
                { id: 'details',       label: 'Details' },
                { id: 'travelparty',   label: 'Reisegruppe' },
                ...(isEditor ? [{ id: 'advance-sheet', label: 'Advance Sheet' }] : []),
                { id: 'guestlist',     label: 'Gästeliste' },
              ] as { id: string; label: string }[]).map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setTermineView(v.id as TermineDetailView)
                    window.dispatchEvent(new CustomEvent('termine-set-view', { detail: { view: v.id } }))
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    termineView === v.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {/* Right: Preview Banner */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <PreviewBanner />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="bg-gray-50 rounded-lg p-4 min-h-[600px]">
              {!isSettingsOpen && children}
            </div>
          </div>
        </div>
      </div>

      {/* ── SETTINGS MODAL ──────────────────────────────────────────────────── */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) closeSettings() }}
        >
          <div className="bg-white rounded-xl shadow-2xl flex overflow-hidden"
               style={{ width: '860px', height: '600px', maxWidth: '95vw', maxHeight: '90vh' }}>

            {/* Modal left sidebar */}
            <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto p-3">
              {/* User info */}
              <div className="flex items-center gap-2 px-3 py-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                  {initials}
                </div>
                <span className="text-xs font-medium text-gray-700 truncate">
                  {currentUser?.firstName
                    ? `${currentUser.firstName} ${currentUser.lastName ?? ''}`.trim()
                    : currentUser?.email ?? ''}
                </span>
              </div>

              {renderSettingsGroup('Konto', SETTINGS_KONTO)}
              {renderSettingsGroup('Workspace', SETTINGS_WORKSPACE)}
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto relative">
              {/* Close button */}
              <button
                onClick={closeSettings}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>

              <div className="p-8 pr-14">
                {children}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default L2Layout
