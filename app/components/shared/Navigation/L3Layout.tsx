'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
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
  ChevronLeftIcon,
  ChevronRightIcon,
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
  getTermine,
  logout,
  CURRENT_TENANT_KEY,
  getTenantArtistSettings,
  NAV_VISIBLE,
  canDo,
  getEffectiveRole,
  isEditorRole,
  CAN_SEE_KALENDER,
  type TenantRole,
  type Termin,
} from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useLayout } from './LayoutContext'
import PreviewBanner from '@/app/components/shared/PreviewBanner'
import type { TermineDetailView, TermineListFilter, TermineListView } from './TermineSubNavigation'

// ─── Rail nav items ───────────────────────────────────────────────────────────

const RAIL_NAV = [
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

// ─── Context panel definitions ────────────────────────────────────────────────

// Sections that show a context panel
const HAS_PANEL = ['appointments', 'contacts', 'venues', 'partners', 'hotels', 'vehicles', 'equipment', 'settings']

type SubItem = { id: string; name: string; editorOnly?: boolean; adminOnly?: boolean }

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
const SETTINGS_KONTO: SubItem[] = [
  { id: 'profil',         name: 'Mein Profil' },
  { id: 'appearance',     name: 'Darstellung' },
  { id: 'notifications',  name: 'Benachrichtigungen' },
  { id: 'erste-schritte', name: 'Erste Schritte' },
]
const SETTINGS_WORKSPACE: SubItem[] = [
  { id: 'artist',      name: 'Artist',         adminOnly: true },
  { id: 'permissions', name: 'Berechtigungen', editorOnly: true },
  { id: 'contacts',    name: 'Kontakte',        editorOnly: true },
  { id: 'guestlist',   name: 'Gästeliste',      editorOnly: true },
  { id: 'daysheet',    name: 'Daysheet',        editorOnly: true },
  { id: 'vorlagen',    name: 'Vorlagen',        editorOnly: true },
]

// Tab labels for breadcrumb
const TAB_LABELS: Record<string, string> = {
  desk: 'Schreibtisch', appointments: 'Termine', contacts: 'Kontakte',
  venues: 'Venues', partners: 'Partner', hotels: 'Hotels',
  vehicles: 'Fahrzeuge', equipment: 'Equipment', settings: 'Einstellungen',
}

const SUB_LABELS: Record<string, string> = {}
;[...CONTACTS_SUBS, ...EQUIPMENT_SUBS, ...SETTINGS_KONTO, ...SETTINGS_WORKSPACE].forEach(
  s => { SUB_LABELS[s.id] = s.name }
)

// ─── Props ────────────────────────────────────────────────────────────────────

interface L3LayoutProps {
  activeTab: string
  activeSubTab?: string
  onTabChange: (tab: string, sub?: string) => void
  onSubTabChange?: (sub: string) => void
  children: ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export function L3Layout({
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
  children,
}: L3LayoutProps) {
  const router = useRouter()
  const { layout, setLayout } = useLayout()

  const [artistName, setArtistName] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('pt_l3_panel') !== 'closed'
  })
  const [allTenantsState, setAllTenantsState] = useState<
    Array<{ id: number; name: string; slug: string; status: string; role: string }>
  >([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)
  const [termineList, setTermineList] = useState<Termin[]>([])
  const [activeTerminId, setActiveTerminId] = useState<number | null>(null)

  const userMenuRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()
  const isSuperadmin = Boolean((currentUser as any)?.isSuperadmin)
  const role = getEffectiveRole() as TenantRole
  const isEditor = isEditorRole(role)
  const canSeeKalender = canDo(role, CAN_SEE_KALENDER)

  const initials =
    [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .map(n => n![0].toUpperCase())
      .join('') || currentUser?.email?.[0]?.toUpperCase() || '?'

  // ── Termine state ──────────────────────────────────────────────────────────
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
    const onSetView  = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setTermineView(v)
    }
    const onFilter   = (e: Event) => {
      const f = (e as CustomEvent<{ filter: TermineListFilter }>).detail?.filter
      if (f) setTermineFilter(f)
    }
    const onListView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineListView }>).detail?.view
      if (v) setTermineListView(v)
    }
    window.addEventListener('termine-view-changed',   onViewChanged)
    window.addEventListener('termine-go-to-list',     onGoToList)
    window.addEventListener('termine-set-view',       onSetView)
    window.addEventListener('termine-filter-changed', onFilter)
    window.addEventListener('termine-listview-changed', onListView)
    return () => {
      window.removeEventListener('termine-view-changed',   onViewChanged)
      window.removeEventListener('termine-go-to-list',     onGoToList)
      window.removeEventListener('termine-set-view',       onSetView)
      window.removeEventListener('termine-filter-changed', onFilter)
      window.removeEventListener('termine-listview-changed', onListView)
    }
  }, [])

  // ── Termine list laden ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'appointments') return
    getTermine().then(setTermineList).catch(() => {})
  }, [activeTab])

  // Aktiven Termin aus URL lesen (z.B. /appointments/42/details)
  useEffect(() => {
    const match = window.location.pathname.match(/\/appointments\/(\d+)/)
    setActiveTerminId(match ? parseInt(match[1], 10) : null)
  }, [activeTab, termineInDetail])

  // ── Effects ────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    setActiveTenantSlug(getCurrentTenant()?.slug ?? null)
    const cached = getAllTenants()
    if (cached.length > 0) setAllTenantsState(cached)
    getMyTenants()
      .then(res => { setAllTenants(res.tenants); setAllTenantsState(res.tenants) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-open panel when navigating to a section that has one
  useEffect(() => {
    if (HAS_PANEL.includes(activeTab)) {
      const stored = localStorage.getItem('pt_l3_panel')
      if (stored !== 'closed') setPanelOpen(true)
    } else {
      setPanelOpen(false)
    }
  }, [activeTab])

  const togglePanel = () => {
    setPanelOpen(v => {
      const next = !v
      localStorage.setItem('pt_l3_panel', next ? 'open' : 'closed')
      return next
    })
  }

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

  const filterSubs = (items: SubItem[]) =>
    items.filter(s => {
      if (s.adminOnly) return role === 'admin'
      if (s.editorOnly) return isEditor
      return true
    })

  // ── Context panel content ──────────────────────────────────────────────────

  const subBtn = (id: string, label: string, isActive: boolean, onClick: () => void) => (
    <button
      key={id}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? 'bg-gray-700 text-white font-medium'
          : 'text-gray-300 hover:text-white hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )

  const panelSectionLabel = (label: string) => (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
      {label}
    </p>
  )

  const renderPanelContent = () => {
    // ── Termine ──────────────────────────────────────────────────────────────
    if (activeTab === 'appointments') {
      const today = new Date().toISOString().slice(0, 10)

      // Filter-Funktion
      const filtered = termineList.filter(t => {
        if (termineFilter === 'aktuell')   return t.date >= today
        if (termineFilter === 'vergangen') return t.date < today
        return true
      }).sort((a, b) => {
        if (termineFilter === 'vergangen') return b.date.localeCompare(a.date)
        return a.date.localeCompare(b.date)
      })

      // Detail-View: Termin-Liste oben + View-Tabs darunter
      const detailViews = [
        { id: 'details',       label: 'Details' },
        { id: 'travelparty',   label: 'Reisegruppe' },
        ...(isEditor ? [{ id: 'advance-sheet', label: 'Advance Sheet' }] : []),
        { id: 'guestlist',     label: 'Gästeliste' },
      ]

      return (
        <div className="flex flex-col h-full">
          {/* Filter-Tabs kompakt */}
          <div className="flex gap-0.5 px-2 py-2 border-b border-gray-700 flex-shrink-0">
            {(['aktuell', 'vergangen', 'alle'] as TermineListFilter[]).map(f => {
              const labels = { aktuell: 'Aktuell', vergangen: 'Vergangen', alle: 'Alle' }
              return (
                <button
                  key={f}
                  onClick={() => {
                    setTermineFilter(f)
                    setTermineListView('list')
                    window.dispatchEvent(new CustomEvent('termine-filter-changed', { detail: { filter: f } }))
                    window.dispatchEvent(new CustomEvent('termine-listview-changed', { detail: { view: 'list' } }))
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                    termineFilter === f && termineListView === 'list'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {labels[f]}
                </button>
              )
            })}
          </div>

          {/* Terminliste scrollbar */}
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">Keine Termine</p>
            ) : filtered.map(t => {
              const isActive = t.id === activeTerminId
              const dateStr = new Date(t.date).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit'
              })
              const label = t.title && !t.showTitleAsHeader
                ? t.title
                : t.venueName || t.city || '–'

              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTerminId(t.id)
                    router.push(`/appointments/${t.id}/details`)
                  }}
                  className={`w-full text-left px-3 py-2 transition-colors border-l-2 ${
                    isActive
                      ? 'border-blue-500 bg-gray-700'
                      : 'border-transparent hover:bg-gray-800'
                  }`}
                >
                  <p className="text-[11px] text-gray-400 leading-none mb-0.5">{dateStr}</p>
                  <p className={`text-xs leading-snug truncate ${isActive ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {label}
                  </p>
                  {t.city && t.venueName && (
                    <p className="text-[10px] text-gray-500 truncate">{t.city}</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Detail-View-Tabs — nur wenn Termin offen */}
          {termineInDetail && (
            <div className="border-t border-gray-700 py-1 flex-shrink-0">
              {detailViews.map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setTermineView(v.id as TermineDetailView)
                    window.dispatchEvent(new CustomEvent('termine-set-view', { detail: { view: v.id } }))
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    termineView === v.id
                      ? 'text-white font-medium bg-gray-700'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    // ── Kontakte ─────────────────────────────────────────────────────────────
    if (activeTab === 'contacts') {
      return (
        <div className="space-y-0.5 px-2">
          {filterSubs(CONTACTS_SUBS).map(s =>
            subBtn(s.id, s.name, activeSubTab === s.id, () => onSubTabChange?.(s.id))
          )}
        </div>
      )
    }

    // ── Equipment ────────────────────────────────────────────────────────────
    if (activeTab === 'equipment') {
      return (
        <div className="space-y-0.5 px-2">
          {EQUIPMENT_SUBS.map(s =>
            subBtn(s.id, s.name, activeSubTab === s.id, () => onSubTabChange?.(s.id))
          )}
        </div>
      )
    }

    // ── Einstellungen ────────────────────────────────────────────────────────
    if (activeTab === 'settings') {
      const kontoItems = filterSubs(SETTINGS_KONTO)
      const wsItems    = filterSubs(SETTINGS_WORKSPACE)
      return (
        <div className="px-2">
          {kontoItems.length > 0 && (
            <>
              {panelSectionLabel('Konto')}
              <div className="space-y-0.5">
                {kontoItems.map(s =>
                  subBtn(s.id, s.name, activeSubTab === s.id, () => onSubTabChange?.(s.id))
                )}
              </div>
            </>
          )}
          {wsItems.length > 0 && (
            <>
              {panelSectionLabel('Workspace')}
              <div className="space-y-0.5">
                {wsItems.map(s =>
                  subBtn(s.id, s.name, activeSubTab === s.id, () => onSubTabChange?.(s.id))
                )}
              </div>
            </>
          )}
        </div>
      )
    }

    // ── Alle anderen Sektionen mit Placeholder ───────────────────────────────
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-gray-500">{TAB_LABELS[activeTab] ?? activeTab}</p>
        <p className="text-xs text-gray-600 mt-1">Liste folgt</p>
      </div>
    )
  }

  // Breadcrumb
  const breadcrumb = [
    TAB_LABELS[activeTab] ?? activeTab,
    activeSubTab ? (SUB_LABELS[activeSubTab] ?? activeSubTab) : null,
  ].filter(Boolean)

  const hasPanelForSection = HAS_PANEL.includes(activeTab)

  return (
    <div className="hidden md:flex h-screen bg-gray-100 overflow-hidden">

      {/* ── RAIL (64px) ─────────────────────────────────────────────────────── */}
      <aside className="w-16 flex-shrink-0 bg-gray-900 flex flex-col items-center border-r border-gray-700">

        {/* User initials / dropdown trigger */}
        <div className="relative w-full flex justify-center pt-3 pb-2" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex flex-col items-center gap-1 w-full py-2 hover:bg-gray-800 transition-colors rounded-md mx-1"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-[9px] text-gray-400 leading-none">Account</span>
          </button>

          {showUserMenu && (
            <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {/* User name */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-700">
                  {currentUser?.firstName
                    ? `${currentUser.firstName} ${currentUser.lastName ?? ''}`.trim()
                    : currentUser?.email ?? ''}
                </p>
                {artistName && <p className="text-xs text-gray-400 mt-0.5">{artistName}</p>}
              </div>

              <button
                onClick={() => { setShowUserMenu(false); handleNav('settings') }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <UserCircleIcon className="w-4 h-4 text-gray-400" />
                Mein Profil
              </button>

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

              {allTenantsState.length > 0 && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/artists') }}
                    className="w-full text-left px-4 py-1 text-xs font-medium text-gray-400 hover:text-gray-600 uppercase tracking-wider flex items-center justify-between"
                  >
                    Artists <span className="normal-case text-gray-300 font-normal">Übersicht</span>
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

        {/* Main nav items */}
        <nav className="flex-1 flex flex-col items-center w-full px-1 py-1 space-y-0.5 overflow-y-auto">
          {RAIL_NAV.filter(item => canDo(role, NAV_VISIBLE[item.id] ?? [])).map(item => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                title={item.name}
                className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-[9px] leading-tight text-center">{item.name}</span>
              </button>
            )
          })}

          {/* Module divider */}
          {canDo(role, NAV_VISIBLE['modules'] ?? []) && (
            <>
              <div className="w-8 border-t border-gray-700 my-1" />
              {MODULE_NAV.map(item => {
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    title={item.name}
                    className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[9px] leading-tight text-center">{item.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* Settings at bottom */}
        <div className="w-full px-1 pb-3 border-t border-gray-700 pt-2">
          <button
            onClick={() => handleNav('settings')}
            title="Einstellungen"
            className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Cog6ToothIcon className="w-5 h-5" />
            <span className="text-[9px] leading-tight">Einstellungen</span>
          </button>
        </div>
      </aside>

      {/* ── CONTEXT PANEL (collapsible) ──────────────────────────────────────── */}
      {hasPanelForSection && panelOpen && (
        <div className="w-56 flex-shrink-0 bg-gray-850 bg-gray-800 flex flex-col border-r border-gray-700">

          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-700">
            <div>
              <p className="text-sm font-semibold text-white">
                {TAB_LABELS[activeTab] ?? activeTab}
              </p>
              {artistName && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{artistName}</p>
              )}
            </div>
            <button
              onClick={togglePanel}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto py-2">
            {renderPanelContent()}
          </div>
        </div>
      )}

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          {/* Panel toggle when closed */}
          {hasPanelForSection && !panelOpen && (
            <button
              onClick={togglePanel}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
              title="Panel öffnen"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}

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
        <div className="flex-1 overflow-y-auto p-5">
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

export default L3Layout
