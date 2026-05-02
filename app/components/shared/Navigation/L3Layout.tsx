'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import {
  HomeIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
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
  getVenues,
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
  type Venue,
} from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useLayout } from './LayoutContext'
import { useT, useLanguage } from '@/app/lib/i18n/LanguageContext'
import PreviewBanner from '@/app/components/shared/PreviewBanner'
import type { TermineDetailView, TermineListFilter, TermineListView } from './TermineSubNavigation'

// ─── Rail nav items ───────────────────────────────────────────────────────────

const RAIL_NAV = [
  { id: 'desk',         name: 'Schreibtisch', icon: HomeIcon },
  { id: 'advancing',    name: 'Vorbereitung', icon: ClipboardDocumentCheckIcon },
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
const HAS_PANEL = ['advancing', 'appointments', 'contacts', 'venues', 'partners', 'hotels', 'vehicles', 'equipment', 'settings']

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
// Settings sub-items: names resolved via t() in component
const SETTINGS_KONTO_IDS = [
  { id: 'profil',         tKey: 'settings.sub.profil' as const },
  { id: 'appearance',     tKey: 'settings.sub.appearance' as const },
  { id: 'notifications',  tKey: 'settings.sub.notifications' as const },
  { id: 'erste-schritte', tKey: 'settings.sub.ersteSchritte' as const },
]
const SETTINGS_WORKSPACE_IDS = [
  { id: 'artist',      tKey: 'settings.sub.artist' as const,      adminOnly: true },
  { id: 'permissions', tKey: 'settings.sub.permissions' as const, editorOnly: true },
  { id: 'contacts',    tKey: 'settings.sub.contacts' as const,    editorOnly: true },
  { id: 'partners',    tKey: 'settings.sub.partners' as const,    adminOnly: true },
  { id: 'guestlist',   tKey: 'settings.sub.guestlist' as const,   editorOnly: true },
  { id: 'daysheet',    tKey: 'settings.sub.daysheet' as const,    editorOnly: true },
  { id: 'vorlagen',    tKey: 'settings.sub.vorlagen' as const,    editorOnly: true },
]

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
  const t = useT()
  const { language, setLanguage } = useLanguage()

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
  // Sofort aus URL ableiten — kein Event-Race-Condition
  const [termineInDetail, setTermineInDetail] = useState(() =>
    typeof window !== 'undefined' && /\/appointments\/\d+/.test(window.location.pathname)
  )
  const [termineView, setTermineView] = useState<TermineDetailView>(() => {
    if (typeof window === 'undefined') return 'details'
    const m = window.location.pathname.match(/\/appointments\/\d+\/(.+)/)
    const v = m?.[1] as TermineDetailView | undefined
    return (['details','details2','travel','schedule','catering','agreements','travelparty','advance-sheet','guestlist'].includes(v ?? '')) ? v! : 'details'
  })

  // ── Advancing state ────────────────────────────────────────────────────────
  const [advancingView, setAdvancingView] = useState<TermineDetailView>(() => {
    if (typeof window === 'undefined') return 'details2'
    const m = window.location.pathname.match(/\/advancing\/\d+\/(.+)/)
    const v = m?.[1] as TermineDetailView | undefined
    const valid = ['details2','travel','schedule','catering','hospitality','advancing','agreements','travelparty','advance-sheet','guestlist']
    return (valid.includes(v ?? '')) ? v! : 'details2'
  })
  const [termineFilter, setTermineFilter] = useState<TermineListFilter>('aktuell')
  const [termineListView, setTermineListView] = useState<TermineListView>('list')

  useEffect(() => {
    const onViewChanged = (e: Event) => {
      const d = (e as CustomEvent<{ inDetail: boolean; view?: TermineDetailView }>).detail
      if (d.inDetail !== undefined) setTermineInDetail(d.inDetail)
      if (d.inDetail && d.view) setTermineView(d.view)
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
    // Advancing events
    const onAdvancingView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setAdvancingView(v)
    }
    const onAdvancingSetView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setAdvancingView(v)
    }

    window.addEventListener('termine-view-changed',    onViewChanged)
    window.addEventListener('termine-go-to-list',      onGoToList)
    window.addEventListener('termine-set-view',        onSetView)
    window.addEventListener('termine-filter-changed',  onFilter)
    window.addEventListener('termine-listview-changed',onListView)
    window.addEventListener('advancing-view-changed',  onAdvancingView)
    window.addEventListener('advancing-set-view',      onAdvancingSetView)
    return () => {
      window.removeEventListener('termine-view-changed',    onViewChanged)
      window.removeEventListener('termine-go-to-list',      onGoToList)
      window.removeEventListener('termine-set-view',        onSetView)
      window.removeEventListener('termine-filter-changed',  onFilter)
      window.removeEventListener('termine-listview-changed',onListView)
      window.removeEventListener('advancing-view-changed',  onAdvancingView)
      window.removeEventListener('advancing-set-view',      onAdvancingSetView)
    }
  }, [])

  // ── Venues list ───────────────────────────────────────────────────────────
  const [venuesList, setVenuesList] = useState<Venue[]>([])
  const [venuesSearch, setVenuesSearch] = useState('')
  const [activeVenueId, setActiveVenueId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/venues\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    if (activeTab !== 'venues') return
    getVenues().then(v => setVenuesList(v)).catch(() => {})
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'venues') return
    const m = window.location.pathname.match(/\/venues\/([^/]+)/)
    setActiveVenueId(m?.[1] ?? null)
  }, [activeTab])

  // ── Termine list laden ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'appointments' && activeTab !== 'advancing') return
    getTermine().then(setTermineList).catch(() => {})
  }, [activeTab])

  // Aktiven Termin aus URL lesen (appointments oder advancing)
  useEffect(() => {
    const match = window.location.pathname.match(/\/(?:appointments|advancing)\/(\d+)/)
    setActiveTerminId(match ? parseInt(match[1], 10) : null)
  }, [activeTab, termineInDetail, advancingView])

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
    // Advancing hat eine eigene Next.js-Route
    if (id === 'advancing') {
      const lastId = localStorage.getItem('pt_advancing_last_id')
      window.location.href = lastId ? `/advancing/${lastId}/details2` : '/advancing'
      return
    }
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
    // ── Advancing ─────────────────────────────────────────────────────────────
    if (activeTab === 'advancing') {
      const today = new Date().toISOString().slice(0, 10)
      const filtered = termineList
        .filter(item => item.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
      const past = termineList
        .filter(item => item.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))
      const allSorted = [...filtered, ...past]

      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-1">
            {allSorted.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">{t('appointments.panel.empty')}</p>
            ) : allSorted.map(item => {
              const isActive = item.id === activeTerminId
              const dateStr = new Date(item.date).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit'
              })
              const label = item.title && !item.showTitleAsHeader
                ? item.title
                : item.venueName || item.city || '–'
              const isPast = item.date < today

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTerminId(item.id)
                    localStorage.setItem('pt_advancing_last_id', String(item.id))
                    router.push(`/advancing/${item.id}/details2`)
                  }}
                  className={`w-full text-left px-3 py-2 transition-colors border-l-2 ${
                    isActive
                      ? 'border-blue-500 bg-gray-700'
                      : 'border-transparent hover:bg-gray-800'
                  }`}
                >
                  <p className={`text-[11px] leading-none mb-0.5 ${isPast ? 'text-gray-600' : 'text-gray-400'}`}>{dateStr}</p>
                  <p className={`text-xs leading-snug truncate ${isActive ? 'text-white font-medium' : isPast ? 'text-gray-500' : 'text-gray-300'}`}>
                    {label}
                  </p>
                  {item.city && item.venueName && (
                    <p className="text-[10px] text-gray-500 truncate">{item.city}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

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
        { id: 'details',       label: t('appointments.view.details') },
        { id: 'travelparty',   label: t('appointments.view.travelparty') },
        ...(isEditor ? [{ id: 'advance-sheet', label: t('appointments.view.advancesheet') }] : []),
        { id: 'guestlist',     label: t('appointments.view.guestlist') },
      ]

      return (
        <div className="flex flex-col h-full">
          {/* Filter-Tabs kompakt */}
          <div className="flex gap-0.5 px-2 py-2 border-b border-gray-700 flex-shrink-0">
            {(['aktuell', 'vergangen', 'alle'] as TermineListFilter[]).map(f => {
              const labels = {
                aktuell:   t('appointments.panel.filter.current'),
                vergangen: t('appointments.panel.filter.past'),
                alle:      t('appointments.panel.filter.all'),
              }
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
              <p className="px-3 py-4 text-xs text-gray-600 text-center">{t('appointments.panel.empty')}</p>
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
      const contactsSubs = [
        { id: 'overview',     label: t('contacts.sub.overview') },
        { id: 'crew-booking', label: t('contacts.sub.crewBooking'), editorOnly: true },
        { id: 'conditions',   label: t('contacts.sub.conditions'),  editorOnly: true },
      ].filter(s => !('editorOnly' in s) || isEditor)
      return (
        <div className="space-y-0.5 px-2">
          {contactsSubs.map(s =>
            subBtn(s.id, s.label, activeSubTab === s.id, () => onSubTabChange?.(s.id))
          )}
        </div>
      )
    }

    // ── Equipment ────────────────────────────────────────────────────────────
    if (activeTab === 'equipment') {
      const equipSubs = [
        { id: 'items',       label: t('equipment.sub.items') },
        { id: 'materials',   label: t('equipment.sub.materials') },
        { id: 'categories',  label: t('equipment.sub.categories') },
        { id: 'eigentuemer', label: t('equipment.sub.eigentuemer') },
        { id: 'carnets',     label: t('equipment.sub.carnets') },
      ]
      return (
        <div className="space-y-0.5 px-2">
          {equipSubs.map(s =>
            subBtn(s.id, s.label, activeSubTab === s.id, () => onSubTabChange?.(s.id))
          )}
        </div>
      )
    }

    // ── Einstellungen ────────────────────────────────────────────────────────
    if (activeTab === 'settings') {
      const kontoItems = SETTINGS_KONTO_IDS
      const wsItems    = SETTINGS_WORKSPACE_IDS.filter(s => {
        if (s.adminOnly) return role === 'admin'
        if (s.editorOnly) return isEditor
        return true
      })
      return (
        <div className="px-2">
          {kontoItems.length > 0 && (
            <>
              {panelSectionLabel(t('settings.konto'))}
              <div className="space-y-0.5">
                {kontoItems.map(s =>
                  subBtn(s.id, t(s.tKey), activeSubTab === s.id, () => onSubTabChange?.(s.id))
                )}
              </div>
            </>
          )}
          {wsItems.length > 0 && (
            <>
              {panelSectionLabel(t('settings.workspace'))}
              <div className="space-y-0.5">
                {wsItems.map(s =>
                  subBtn(s.id, t(s.tKey), activeSubTab === s.id, () => onSubTabChange?.(s.id))
                )}
              </div>
            </>
          )}
        </div>
      )
    }

    // ── Venues ───────────────────────────────────────────────────────────────
    if (activeTab === 'venues') {
      const q = venuesSearch.toLowerCase()
      const filtered = venuesList
        .filter(v => !q || v.name?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))

      return (
        <div className="flex flex-col h-full">
          {/* Suche */}
          <div className="px-2 py-2 border-b border-gray-700 flex-shrink-0">
            <input
              type="text"
              value={venuesSearch}
              onChange={e => setVenuesSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {/* Liste */}
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">
                {venuesList.length === 0 ? 'Keine Venues' : 'Keine Treffer'}
              </p>
            ) : filtered.map(v => {
              const isActive = String(v.id) === activeVenueId
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVenueId(String(v.id))
                    router.push(`/venues/${v.id}`)
                  }}
                  className={`w-full text-left px-3 py-2 transition-colors border-l-2 ${
                    isActive
                      ? 'border-blue-500 bg-gray-700'
                      : 'border-transparent hover:bg-gray-800'
                  }`}
                >
                  <p className={`text-xs leading-snug truncate ${isActive ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {v.name}
                  </p>
                  {v.city && (
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{v.city}{v.country ? `, ${v.country}` : ''}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    return null
  }

  // Breadcrumb — translated
  const TAB_LABEL_KEYS: Record<string, string> = {
    desk: t('nav.desk'), advancing: t('nav.advancing'), appointments: t('nav.appointments'),
    contacts: t('nav.contacts'), venues: t('nav.venues'), partners: t('nav.partners'),
    hotels: t('nav.hotels'), vehicles: t('nav.vehicles'), equipment: t('nav.equipment'),
    settings: t('nav.settings'),
  }
  const SUB_LABEL_MAP: Record<string, string> = {
    overview:     t('contacts.sub.overview'),
    'crew-booking': t('contacts.sub.crewBooking'),
    conditions:   t('contacts.sub.conditions'),
    items:        t('equipment.sub.items'),
    materials:    t('equipment.sub.materials'),
    categories:   t('equipment.sub.categories'),
    eigentuemer:  t('equipment.sub.eigentuemer'),
    carnets:      t('equipment.sub.carnets'),
    profil:            t('settings.sub.profil'),
    appearance:        t('settings.sub.appearance'),
    notifications:     t('settings.sub.notifications'),
    'erste-schritte':  t('settings.sub.ersteSchritte'),
    artist:            t('settings.sub.artist'),
    permissions:       t('settings.sub.permissions'),
    contacts:          t('settings.sub.contacts'),
    partners:          t('settings.sub.partners'),
    guestlist:         t('settings.sub.guestlist'),
    daysheet:          t('settings.sub.daysheet'),
    vorlagen:          t('settings.sub.vorlagen'),
  }

  const breadcrumb = [
    TAB_LABEL_KEYS[activeTab] ?? activeTab,
    activeSubTab ? (SUB_LABEL_MAP[activeSubTab] ?? activeSubTab) : null,
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
                {t('user.myProfile')}
              </button>

              {/* Language switcher */}
              <div className="border-t border-gray-100 my-1" />
              <p className="px-4 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t('user.language')}</p>
              {(['de', 'en'] as const).map(lang => (
                <button key={lang}
                  onClick={() => { setLanguage(lang) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <span>{lang === 'de' ? '🇩🇪 Deutsch' : '🇺🇸 English'}</span>
                  {language === lang && <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                </button>
              ))}

              {isSuperadmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <p className="px-4 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t('user.layout')}</p>
                  {(['L1', 'L2', 'L3'] as const).map(m => (
                    <button key={m}
                      onClick={() => { setShowUserMenu(false); setLayout(m) }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2">
                        <ViewColumnsIcon className="w-4 h-4 text-gray-400" />
                        {t(`layout.${m.toLowerCase() as 'l1' | 'l2' | 'l3'}`)}
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
                    {t('user.artists')} <span className="normal-case text-gray-300 font-normal">{t('user.artistsOverview')}</span>
                  </button>
                  {allTenantsState.map(tenant => (
                    <button
                      key={tenant.id}
                      onClick={() => activeTenantSlug === tenant.slug ? setShowUserMenu(false) : handleSwitchTenant(tenant)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{tenant.name}</span>
                      {activeTenantSlug === tenant.slug && <CheckIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                    </button>
                  ))}
                  {allTenantsState.some(tenant => tenant.role === 'admin') && (
                    <button
                      onClick={() => { setShowUserMenu(false); router.push('/artists?new=1') }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      {t('user.newArtist')}
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
                    {t('nav.feedback')}
                  </button>
                </>
              )}

              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setShowUserMenu(false); logout() }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                {t('user.logout')}
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
                <span className="text-[9px] leading-tight text-center">{t(`nav.${item.id}` as any)}</span>
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
                    title={t(`nav.${item.id}` as any)}
                    className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[9px] leading-tight text-center">{t(`nav.${item.id}` as any)}</span>
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
            <span className="text-[9px] leading-tight">{t('nav.settings')}</span>
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
                {TAB_LABEL_KEYS[activeTab] ?? activeTab}
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
              title={t('panel.openPanel')}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}

          {/* Left: Detail-Tabs — Advancing (immer) oder Appointments (wenn in Detail) */}
          <div className="flex-1 flex items-center min-w-0">
            {(activeTab === 'advancing' || (activeTab === 'appointments' && termineInDetail)) && (() => {
              const isAdvancing = activeTab === 'advancing'
              const currentView = isAdvancing ? advancingView : termineView
              const eventName = isAdvancing ? 'advancing-set-view' : 'termine-set-view'
              const setView = isAdvancing ? setAdvancingView : setTermineView
              return (
                <div className="flex items-center gap-0.5">
                  {([
                    ...(!isAdvancing ? [{ id: 'details', label: t('appointments.view.details') }] : []),
                    ...(isAdvancing ? [{ id: 'details2',    label: 'Details' }] : []),
                    ...(isAdvancing ? [{ id: 'travel',      label: 'Travel' }] : []),
                    ...(isAdvancing ? [{ id: 'schedule',    label: 'Schedule' }] : []),
                    ...(isAdvancing ? [{ id: 'hospitality', label: 'Hospitality' }] : []),
                    ...(isAdvancing ? [{ id: 'advancing',   label: 'Advancing' }] : []),
                    ...(isAdvancing ? [{ id: 'agreements',  label: 'Agreements' }] : []),
                    { id: 'travelparty',   label: t('appointments.view.travelparty') },
                    ...(isEditor ? [{ id: 'advance-sheet', label: t('appointments.view.advancesheet') }] : []),
                    { id: 'guestlist',     label: t('appointments.view.guestlist') },
                  ] as { id: string; label: string }[]).map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setView(v.id as TermineDetailView)
                        window.dispatchEvent(new CustomEvent(eventName, { detail: { view: v.id } }))
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        currentView === v.id
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Right: Preview Banner */}
          <div className="flex items-center gap-3">
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
