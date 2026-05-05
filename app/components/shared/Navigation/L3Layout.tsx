'use client'

import { useState, useEffect, useRef, useCallback, ReactNode, ChangeEvent } from 'react'
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
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'
import {
  getCurrentUser,
  getCurrentTenant,
  getAllTenants,
  setAllTenants,
  getMyTenants,
  getTermine,
  getVenues,
  createVenue,
  deleteVenue,
  getPartners,
  createPartner,
  deletePartner,
  getHotels,
  createHotel,
  deleteHotel,
  getVehicles,
  createVehicle,
  deleteVehicle,
  getContacts,
  deleteContact,
  deleteTermin,
  createTermin,
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
  type Partner,
  type Hotel,
  type Vehicle,
  type Contact,
} from '@/lib/api-client'
import { parseCSV, col } from '@/lib/csvParser'
import { useRouter } from 'next/navigation'
import { useLayout } from './LayoutContext'
import { useT, useLanguage } from '@/app/lib/i18n/LanguageContext'
import PreviewBanner from '@/app/components/shared/PreviewBanner'
import GlobalTopBar from './GlobalTopBar'
import type { SearchResult } from '@/lib/api-client'
import type { TermineDetailView, TermineListFilter, TermineListView } from './TermineSubNavigation'

// ─── Rail nav items ───────────────────────────────────────────────────────────

const RAIL_NAV = [
  { id: 'desk',         name: 'Schreibtisch', icon: HomeIcon },
  { id: 'events',       name: 'Events',        icon: CalendarDaysIcon },
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
const HAS_PANEL = ['events', 'contacts', 'venues', 'partners', 'hotels', 'vehicles', 'equipment', 'settings']

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
  { id: 'gewerke',     tKey: 'settings.sub.gewerke' as const,     editorOnly: true },
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
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 224
    return parseInt(localStorage.getItem('pt_l3_panel_width') ?? '224', 10)
  })
  const isDraggingPanel = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const [allTenantsState, setAllTenantsState] = useState<
    Array<{ id: number; name: string; slug: string; status: string; role: string }>
  >([])
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null)
  const [termineList, setTermineList] = useState<Termin[]>([])
  const [activeTerminId, setActiveTerminId] = useState<number | null>(null)
  const [terminMenuOpenId, setTerminMenuOpenId] = useState<number | null>(null)

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
    typeof window !== 'undefined' && /\/events\/\d+/.test(window.location.pathname)
  )

  // ── Events/Advancing state ─────────────────────────────────────────────────
  const [advancingView, setAdvancingView] = useState<TermineDetailView>(() => {
    if (typeof window === 'undefined') return 'details2'
    const m = window.location.pathname.match(/\/events\/\d+\/(.+)/)
    const v = m?.[1] as TermineDetailView | undefined
    const valid = ['details2','travel','schedule','catering','hospitality','advancing','agreements','travelparty','advance-sheet','guestlist','briefing']
    return (valid.includes(v ?? '')) ? v! : 'details2'
  })
  const [termineFilter, setTermineFilter] = useState<TermineListFilter>('aktuell')
  const [termineListView, setTermineListView] = useState<TermineListView>('list')
  const [termineSearch, setTermineSearch] = useState('')
  const [advancingSearch, setAdvancingSearch] = useState('')

  useEffect(() => {
    const onViewChanged = (e: Event) => {
      const d = (e as CustomEvent<{ inDetail: boolean; view?: TermineDetailView }>).detail
      if (d.inDetail !== undefined) setTermineInDetail(d.inDetail)
    }
    const onFilter = (e: Event) => {
      const f = (e as CustomEvent<{ filter: TermineListFilter }>).detail?.filter
      if (f) setTermineFilter(f)
    }
    const onListView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineListView }>).detail?.view
      if (v) setTermineListView(v)
    }
    const onAdvancingView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setAdvancingView(v)
    }
    const onAdvancingSetView = (e: Event) => {
      const v = (e as CustomEvent<{ view: TermineDetailView }>).detail?.view
      if (v) setAdvancingView(v)
    }

    window.addEventListener('termine-view-changed',    onViewChanged)
    window.addEventListener('termine-filter-changed',  onFilter)
    window.addEventListener('termine-listview-changed',onListView)
    window.addEventListener('advancing-view-changed',  onAdvancingView)
    window.addEventListener('advancing-set-view',      onAdvancingSetView)
    return () => {
      window.removeEventListener('termine-view-changed',    onViewChanged)
      window.removeEventListener('termine-filter-changed',  onFilter)
      window.removeEventListener('termine-listview-changed',onListView)
      window.removeEventListener('advancing-view-changed',  onAdvancingView)
      window.removeEventListener('advancing-set-view',      onAdvancingSetView)
    }
  }, [])

  // ── Panel resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingPanel.current) return
      const delta = e.clientX - dragStartX.current
      const next = Math.min(360, Math.max(180, dragStartWidth.current + delta))
      setPanelWidth(next)
    }
    function onMouseUp() {
      if (!isDraggingPanel.current) return
      isDraggingPanel.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // persist
      setPanelWidth(w => { localStorage.setItem('pt_l3_panel_width', String(w)); return w })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function startPanelDrag(e: React.MouseEvent) {
    isDraggingPanel.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  // ── Partners list ─────────────────────────────────────────────────────────
  const [partnersList, setPartnersList] = useState<Partner[]>([])
  const [partnersSearch, setPartnersSearch] = useState('')
  const [partnerMenuOpenId, setPartnerMenuOpenId] = useState<string | null>(null)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/partners\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    if (activeTab !== 'partners') return
    getPartners().then(setPartnersList).catch(() => {})
  }, [activeTab])

  // Refresh partners list when a partner is created/updated/deleted
  useEffect(() => {
    const refresh = () => getPartners().then(setPartnersList).catch(() => {})
    const discard = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      setPartnersList(prev => prev.filter(p => p.id !== id))
      setActivePartnerId(null)
      history.pushState(null, '', '/?tab=partners')
    }
    window.addEventListener('partner-list-refresh', refresh)
    window.addEventListener('partner-discarded', discard)
    return () => {
      window.removeEventListener('partner-list-refresh', refresh)
      window.removeEventListener('partner-discarded', discard)
    }
  }, [])

  // Auto-select last / first partner when navigating to partners with no selection
  useEffect(() => {
    if (activeTab !== 'partners') return
    if (partnersList.length === 0) return
    if (activePartnerId) return
    const lastId = localStorage.getItem('pt_partners_last_id')
    const sorted = [...partnersList].sort((a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? '', 'de'))
    const target = (lastId && partnersList.find(p => p.id === lastId)) ? lastId : sorted[0].id
    setActivePartnerId(target)
    history.pushState(null, '', `/partners/${target}`)
    window.dispatchEvent(new CustomEvent('select-partner', { detail: { id: target } }))
  }, [activeTab, partnersList, activePartnerId])

  // ── Hotels list ───────────────────────────────────────────────────────────
  const [hotelsList, setHotelsList] = useState<Hotel[]>([])
  const [hotelsSearch, setHotelsSearch] = useState('')
  const [hotelMenuOpenId, setHotelMenuOpenId] = useState<string | null>(null)
  const [activeHotelId, setActiveHotelId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/hotels\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    if (activeTab !== 'hotels') return
    getHotels().then(setHotelsList).catch(() => {})
  }, [activeTab])

  // Refresh hotels list when a hotel is created/updated/deleted
  useEffect(() => {
    const refresh = () => getHotels().then(setHotelsList).catch(() => {})
    const discard = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      setHotelsList(prev => prev.filter(h => h.id !== id))
      setActiveHotelId(null)
      history.pushState(null, '', '/?tab=hotels')
    }
    window.addEventListener('hotel-list-refresh', refresh)
    window.addEventListener('hotel-discarded', discard)
    return () => {
      window.removeEventListener('hotel-list-refresh', refresh)
      window.removeEventListener('hotel-discarded', discard)
    }
  }, [])

  // Auto-select last / first hotel when navigating to hotels with no selection
  useEffect(() => {
    if (activeTab !== 'hotels') return
    if (hotelsList.length === 0) return
    if (activeHotelId) return
    const lastId = localStorage.getItem('pt_hotels_last_id')
    const sorted = [...hotelsList].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
    const target = (lastId && hotelsList.find(h => h.id === lastId)) ? lastId : sorted[0].id
    setActiveHotelId(target)
    history.pushState(null, '', `/hotels/${target}`)
    window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: target } }))
  }, [activeTab, hotelsList, activeHotelId])

  // ── Vehicles list ─────────────────────────────────────────────────────────
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([])
  const [vehiclesSearch, setVehiclesSearch] = useState('')
  const [vehicleMenuOpenId, setVehicleMenuOpenId] = useState<string | null>(null)
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/vehicles\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    if (activeTab !== 'vehicles') return
    getVehicles().then(setVehiclesList).catch(() => {})
  }, [activeTab])

  // Refresh vehicles list when a vehicle is created/updated/deleted
  useEffect(() => {
    const refresh = () => getVehicles().then(setVehiclesList).catch(() => {})
    const discard = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      setVehiclesList(prev => prev.filter(v => v.id !== id))
      setActiveVehicleId(null)
      history.pushState(null, '', '/?tab=vehicles')
    }
    window.addEventListener('vehicle-list-refresh', refresh)
    window.addEventListener('vehicle-discarded', discard)
    return () => {
      window.removeEventListener('vehicle-list-refresh', refresh)
      window.removeEventListener('vehicle-discarded', discard)
    }
  }, [])

  // Auto-select last / first vehicle when navigating to vehicles with no selection
  useEffect(() => {
    if (activeTab !== 'vehicles') return
    if (vehiclesList.length === 0) return
    if (activeVehicleId) return
    const lastId = localStorage.getItem('pt_vehicles_last_id')
    const sorted = [...vehiclesList].sort((a, b) => (a.designation ?? '').localeCompare(b.designation ?? '', 'de'))
    const target = (lastId && vehiclesList.find(v => v.id === lastId)) ? lastId : sorted[0].id
    setActiveVehicleId(target)
    history.pushState(null, '', `/vehicles/${target}`)
    window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id: target } }))
  }, [activeTab, vehiclesList, activeVehicleId])

  // ── Venues list ───────────────────────────────────────────────────────────
  const [venuesList, setVenuesList] = useState<Venue[]>([])
  const [venuesSearch, setVenuesSearch] = useState('')
  const [venueInlineNew, setVenueInlineNew] = useState(false)
  const [venueNewName, setVenueNewName] = useState('')
  const [venueCreating, setVenueCreating] = useState(false)
  const [venueMenuOpenId, setVenueMenuOpenId] = useState<string | null>(null)
  const [venuesCsvMenuOpen, setVenuesCsvMenuOpen] = useState(false)
  const venuesCsvInputRef = useRef<HTMLInputElement>(null)
  const [partnersCsvMenuOpen, setPartnersCsvMenuOpen] = useState(false)
  const partnersCsvInputRef = useRef<HTMLInputElement>(null)
  const [hotelsCsvMenuOpen, setHotelsCsvMenuOpen] = useState(false)
  const hotelsCsvInputRef = useRef<HTMLInputElement>(null)
  const [vehiclesCsvMenuOpen, setVehiclesCsvMenuOpen] = useState(false)
  const vehiclesCsvInputRef = useRef<HTMLInputElement>(null)
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

  // Auto-select last / first venue when navigating to venues with no selection
  useEffect(() => {
    if (activeTab !== 'venues') return
    if (venuesList.length === 0) return
    if (activeVenueId) return
    const lastId = localStorage.getItem('pt_venues_last_id')
    const sorted = [...venuesList].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
    const target = (lastId && venuesList.find(v => String(v.id) === lastId)) ? lastId : String(sorted[0].id)
    setActiveVenueId(target)
    history.pushState(null, '', `/venues/${target}`)
    window.dispatchEvent(new CustomEvent('select-venue', { detail: { id: target } }))
  }, [activeTab, venuesList, activeVenueId])

  // ── Contacts list ─────────────────────────────────────────────────────────
  const [contactsList, setContactsList] = useState<Contact[]>([])
  const [contactsSearch, setContactsSearch] = useState('')
  const [contactsMenuOpenId, setContactsMenuOpenId] = useState<string | null>(null)
  const [contactsPlusOpen, setContactsPlusOpen] = useState(false)
  const [activeContactId, setActiveContactId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.pathname.match(/\/contacts\/([^/]+)/)
    return m?.[1] ?? null
  })

  useEffect(() => {
    if (activeTab !== 'contacts') return
    getContacts().then(setContactsList).catch(() => {})
  }, [activeTab])

  useEffect(() => {
    const handler = (e: Event) => {
      const contact = (e as CustomEvent).detail?.contact as Contact | undefined
      if (contact) setContactsList(prev => [...prev, contact])
    }
    window.addEventListener('contact-created', handler)
    return () => window.removeEventListener('contact-created', handler)
  }, [])

  // Auto-select first contact when list loads
  useEffect(() => {
    if (activeTab !== 'contacts') return
    if (contactsList.length === 0) return
    if (activeContactId) return
    const lastId = localStorage.getItem('pt_contacts_last_id')
    const sorted = [...contactsList].sort((a, b) =>
      (a.lastName ?? '').localeCompare(b.lastName ?? '', 'de') ||
      (a.firstName ?? '').localeCompare(b.firstName ?? '', 'de')
    )
    const target = (lastId && contactsList.find(c => String(c.id) === lastId)) ? lastId : String(sorted[0].id)
    setActiveContactId(target)
    localStorage.setItem('pt_contacts_last_id', target)
    history.pushState(null, '', `/contacts/${target}`)
    window.dispatchEvent(new CustomEvent('select-contact', { detail: { id: target } }))
  }, [activeTab, contactsList, activeContactId])

  // ── Termine list laden ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'events') return
    getTermine().then(setTermineList).catch(() => {})
  }, [activeTab])

  // Auto-select last / first termin when navigating to events with no selection
  useEffect(() => {
    if (activeTab !== 'events') return
    if (termineList.length === 0) return
    if (activeTerminId) return
    const lastId = localStorage.getItem('pt_events_last_id')
    const today = new Date().toISOString().slice(0, 10)
    const sorted = [
      ...termineList.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
      ...termineList.filter(t => t.date < today).sort((a, b) => b.date.localeCompare(a.date)),
    ]
    const target = (lastId && termineList.find(t => t.id === parseInt(lastId, 10)))
      ? parseInt(lastId, 10)
      : sorted[0].id
    setActiveTerminId(target)
    localStorage.setItem('pt_events_last_id', String(target))
    window.dispatchEvent(new CustomEvent('select-termin', { detail: { id: target, view: 'details2' } }))
  }, [activeTab, termineList, activeTerminId])

  // Reload termineList wenn ein Termin erstellt/geändert wurde
  useEffect(() => {
    const handler = () => { getTermine().then(setTermineList).catch(() => {}) }
    window.addEventListener('termin-list-changed', handler)
    return () => window.removeEventListener('termin-list-changed', handler)
  }, [])

  // Aktiven Termin aus URL lesen (events) — nur beim Tab-Wechsel, nicht bei View-Änderung
  useEffect(() => {
    if (activeTab !== 'events') return
    const id = new URLSearchParams(window.location.search).get('id')
    if (id) setActiveTerminId(parseInt(id, 10))
  }, [activeTab])

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
      setVenuesCsvMenuOpen(false)
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

  const handleCreateNewTermin = async () => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const newTermin = await createTermin({ date: today, title: 'Neues Event' })
      setTermineList(prev => [newTermin, ...prev])
      setActiveTerminId(newTermin.id)
      localStorage.setItem('pt_events_last_id', String(newTermin.id))
      // Erst das neue Objekt in TermineModule einspeisen, dann navigieren
      window.dispatchEvent(new CustomEvent('termin-added', { detail: { termin: newTermin } }))
      window.dispatchEvent(new CustomEvent('select-termin', { detail: { id: newTermin.id, view: 'details2' } }))
    } catch (e) {
      console.error('Failed to create event', e)
    }
  }

  const handleCreateNewPartner = async () => {
    try {
      const created = await createPartner({ companyName: 'Neuer Partner' } as any)
      setPartnersList(prev => [created, ...prev])
      setActivePartnerId(created.id)
      localStorage.setItem('pt_partners_last_id', created.id)
      history.pushState(null, '', `/partners/${created.id}`)
      window.dispatchEvent(new CustomEvent('select-partner', { detail: { id: created.id } }))
    } catch (e) { console.error('Failed to create partner', e) }
  }

  const handleCreateNewHotel = async () => {
    try {
      const created = await createHotel({ name: 'Neues Hotel' } as any)
      setHotelsList(prev => [created, ...prev])
      setActiveHotelId(created.id)
      localStorage.setItem('pt_hotels_last_id', created.id)
      history.pushState(null, '', `/hotels/${created.id}`)
      window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: created.id } }))
    } catch (e) { console.error('Failed to create hotel', e) }
  }

  const handleCreateNewVehicle = async () => {
    try {
      const created = await createVehicle({ designation: 'Neues Fahrzeug' } as any)
      setVehiclesList(prev => [created, ...prev])
      setActiveVehicleId(created.id)
      localStorage.setItem('pt_vehicles_last_id', created.id)
      history.pushState(null, '', `/vehicles/${created.id}`)
      window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id: created.id } }))
    } catch (e) { console.error('Failed to create vehicle', e) }
  }

  const handleNav = (id: string) => {
    // Advancing: SPA-Navigation ohne Route-Wechsel
    if (id === 'events') {
      onTabChange('events')
      const lastId = localStorage.getItem('pt_events_last_id')
      if (lastId) {
        const numId = parseInt(lastId, 10)
        history.pushState(null, '', `/?tab=events&id=${lastId}&view=details2`)
        window.dispatchEvent(new CustomEvent('select-termin', { detail: { id: numId, view: 'details2' } }))
      }
      setShowUserMenu(false)
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

  // ── Venues CSV ────────────────────────────────────────────────────────────

  const exportVenuesCsv = () => {
    const headers = ['Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Kapazität']
    const rows = venuesList.map(v =>
      [v.name, v.street, v.postalCode, v.city, v.state, v.country, v.capacity]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venues_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setVenuesCsvMenuOpen(false)
  }

  const importVenuesCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).slice(1)
      let count = 0
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const created = await createVenue({
            name: col(row, 0), street: col(row, 1), postalCode: col(row, 2),
            city: col(row, 3), state: col(row, 4), country: col(row, 5), capacity: col(row, 6),
            website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '', arrivalCity: '',
            capacitySeated: '', stageDimensions: '', clearanceHeight: '', merchandiseFee: '',
            merchandiseStand: '', wardrobe: '', showers: '', wifi: '', parking: '',
            nightlinerParking: '', loadingPath: '', notes: '', latitude: '', longitude: '',
          })
          setVenuesList(prev => [...prev, created])
          count++
        } catch { /* skip */ }
      }
      if (count > 0) alert(`${count} Venue(s) importiert.`)
    }
    reader.readAsText(file)
    e.target.value = ''
    setVenuesCsvMenuOpen(false)
  }

  // ── Partners CSV ──────────────────────────────────────────────────────────

  const exportPartnersCsv = () => {
    const headers = ['Firmenname', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Art']
    const rows = partnersList.map(p =>
      [p.companyName, p.street, p.postalCode, p.city, p.state, p.country, p.type]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partners_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setPartnersCsvMenuOpen(false)
  }

  const importPartnersCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).slice(1)
      let count = 0
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const { createPartner } = await import('@/lib/api-client')
          const created = await createPartner({
            companyName: col(row, 0), street: col(row, 1), postalCode: col(row, 2),
            city: col(row, 3), state: col(row, 4), country: col(row, 5),
            type: col(row, 6), contactPerson: '', email: '', phone: '', taxId: '', billingAddress: '', notes: '',
          })
          setPartnersList(prev => [...prev, created])
          count++
        } catch { /* skip */ }
      }
      if (count > 0) alert(`${count} Partner importiert.`)
    }
    reader.readAsText(file)
    e.target.value = ''
    setPartnersCsvMenuOpen(false)
  }

  // ── Hotels CSV ─────────────────────────────────────────────────────────────

  const exportHotelsCsv = () => {
    const headers = ['Name', 'Straße', 'PLZ', 'Ort', 'Bundesland', 'Land', 'Website']
    const rows = hotelsList.map(h =>
      [h.name, h.street, h.postalCode, h.city, h.state, h.country, h.website]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hotels_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setHotelsCsvMenuOpen(false)
  }

  const importHotelsCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).slice(1)
      let count = 0
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const { createHotel } = await import('@/lib/api-client')
          const created = await createHotel({
            name: col(row, 0), street: col(row, 1), postalCode: col(row, 2),
            city: col(row, 3), state: col(row, 4), country: col(row, 5),
            website: col(row, 6), email: '', phone: '', reception: '',
            checkIn: '', checkOut: '', earlyCheckIn: '', lateCheckOut: '',
            breakfast: '', breakfastWeekend: '', additionalInfo: '',
          })
          setHotelsList(prev => [...prev, created])
          count++
        } catch { /* skip */ }
      }
      if (count > 0) alert(`${count} Hotels importiert.`)
    }
    reader.readAsText(file)
    e.target.value = ''
    setHotelsCsvMenuOpen(false)
  }

  // ── Vehicles CSV ───────────────────────────────────────────────────────────

  const exportVehiclesCsv = () => {
    const headers = ['Bezeichnung', 'Fahrzeugart', 'Driver', 'Kennzeichen', 'Maße', 'Stromanschluss', 'Sitzplätze', 'Schlafplätze']
    const rows = vehiclesList.map(v =>
      [v.designation, v.vehicleType, v.driver, v.licensePlate, v.dimensions, v.powerConnection, v.seats, v.sleepingPlaces]
        .map(val => `"${(val || '').replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vehicles_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setVehiclesCsvMenuOpen(false)
  }

  const importVehiclesCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).slice(1)
      let count = 0
      for (const row of rows) {
        if (!col(row, 0)) continue
        try {
          const { createVehicle } = await import('@/lib/api-client')
          const created = await createVehicle({
            designation: col(row, 0), vehicleType: col(row, 1), driver: col(row, 2),
            licensePlate: col(row, 3), dimensions: col(row, 4), powerConnection: col(row, 5),
            seats: col(row, 6), sleepingPlaces: col(row, 7),
            hasTrailer: false, trailerDimensions: '', trailerLicensePlate: '', notes: '',
          })
          setVehiclesList(prev => [...prev, created])
          count++
        } catch { /* skip */ }
      }
      if (count > 0) alert(`${count} Fahrzeuge importiert.`)
    }
    reader.readAsText(file)
    e.target.value = ''
    setVehiclesCsvMenuOpen(false)
  }

  // ── Context panel content ──────────────────────────────────────────────────

  const subBtn = (id: string, label: string, isActive: boolean, onClick: () => void) => (
    <button
      key={id}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? 'bg-gray-200 text-gray-900 font-medium'
          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
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
    if (activeTab === 'events') {
      const today = new Date().toISOString().slice(0, 10)
      const q = advancingSearch.toLowerCase()
      const allSorted = [
        ...termineList.filter(item => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
        ...termineList.filter(item => item.date < today).sort((a, b) => b.date.localeCompare(a.date)),
      ].filter(item => !q || [item.title, item.city, item.venueName, item.art].some(v => v?.toLowerCase().includes(q)))

      return (
        <div className="flex flex-col h-full">
          {/* Suche + Neu */}
          <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-200 flex-shrink-0">
            <input
              type="text"
              value={advancingSearch}
              onChange={e => setAdvancingSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 bg-gray-100 text-gray-700 placeholder-gray-400 text-xs rounded px-2 py-1 outline-none border border-gray-200 focus:border-gray-300"
            />
            {isEditor && (
              <button
                onClick={handleCreateNewTermin}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-white transition-colors text-sm font-bold"
                title="Neues Event"
              >+</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light" onClick={() => setTerminMenuOpenId(null)}>
            {allSorted.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">{t('appointments.panel.empty')}</p>
            ) : allSorted.map(item => {
              const isActive = item.id === activeTerminId
              const menuOpen = terminMenuOpenId === item.id
              const dateStr = new Date(item.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
              const locationLabel = item.venueName || item.city
              const label = item.showTitleAsHeader ? item.title : (locationLabel || item.title || '–')
              const isPast = item.date < today

              return (
                <div key={item.id} className={`group relative flex items-center border-l-2 transition-colors ${isActive ? 'border-blue-500 bg-gray-200' : 'border-transparent hover:bg-gray-100'}`}>
                  <button
                    onClick={() => {
                      setActiveTerminId(item.id)
                      setTerminMenuOpenId(null)
                      localStorage.setItem('pt_events_last_id', String(item.id))
                      window.dispatchEvent(new CustomEvent('select-termin', { detail: { id: item.id, view: 'details2' } }))
                    }}
                    className="flex-1 text-left px-3 py-2 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={`text-[11px] leading-none ${isPast ? 'text-gray-600' : 'text-gray-400'}`}>{dateStr}</p>
                      {item.art && (
                        <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-gray-200 text-gray-400 font-medium">{item.art}</span>
                      )}
                    </div>
                    <p className={`text-xs leading-snug truncate ${isActive ? 'text-gray-900 font-medium' : isPast ? 'text-gray-500' : 'text-gray-700'}`}>
                      {label}
                    </p>
                    {item.city && item.venueName && (
                      <p className="text-[10px] text-gray-500 truncate">{item.city}</p>
                    )}
                  </button>
                  {isEditor && (
                    <div className="relative flex-shrink-0 pr-1">
                      <button
                        onClick={e => { e.stopPropagation(); setTerminMenuOpenId(menuOpen ? null : item.id) }}
                        className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              setTerminMenuOpenId(null)
                              if (!confirm(`Event „${label}" wirklich löschen?`)) return
                              try {
                                await deleteTermin(item.id)
                                setTermineList(prev => prev.filter(x => x.id !== item.id))
                                if (activeTerminId === item.id) {
                                  setActiveTerminId(null)
                                  localStorage.removeItem('pt_events_last_id')
                                  window.dispatchEvent(new CustomEvent('advancing-go-to-list'))
                                }
                              } catch { /* silent */ }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                          >
                            Event löschen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // ── Kontakte ─────────────────────────────────────────────────────────────
    if (activeTab === 'contacts') {
      const q = contactsSearch.toLowerCase()
      const filtered = contactsList
        .filter(c => !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.function1 || '').toLowerCase().includes(q))
        .sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? '', 'de') || (a.firstName ?? '').localeCompare(b.firstName ?? '', 'de'))

      return (
        <div className="flex flex-col h-full" onClick={() => { setContactsMenuOpenId(null); setContactsPlusOpen(false) }}>
          {/* Suche + Plus */}
          <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0 flex gap-1.5">
            <input
              type="text"
              value={contactsSearch}
              onChange={e => setContactsSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isEditor && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setContactsPlusOpen(o => !o) }}
                  className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors"
                  title="Kontakt hinzufügen"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
                {contactsPlusOpen && (
                  <div
                    className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setContactsPlusOpen(false); window.dispatchEvent(new CustomEvent('contact-sidebar-invite')) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      + Einladen
                    </button>
                    <button
                      onClick={() => { setContactsPlusOpen(false); window.dispatchEvent(new CustomEvent('contact-sidebar-create')) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      + Manuell anlegen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">
                {contactsList.length === 0 ? 'Keine Kontakte' : 'Keine Treffer'}
              </p>
            ) : filtered.map(c => {
              const cid = String(c.id)
              const menuOpen = contactsMenuOpenId === cid
              const fn = [c.function1, c.function2, c.function3].filter(Boolean).join(' · ')
              const isActiveContact = activeContactId === cid
              return (
                <div
                  key={c.id}
                  className={`group relative flex items-center border-l-2 transition-colors ${isActiveContact ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-100'}`}
                >
                  <button
                    onClick={() => {
                      setContactsMenuOpenId(null)
                      setActiveContactId(cid)
                      localStorage.setItem('pt_contacts_last_id', cid)
                      history.pushState(null, '', `/contacts/${cid}`)
                      window.dispatchEvent(new CustomEvent('select-contact', { detail: { id: cid } }))
                    }}
                    className="flex-1 text-left px-3 py-2 min-w-0"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-xs leading-snug truncate font-medium ${isActiveContact ? 'text-gray-900' : 'text-gray-700'}`}>
                        {c.lastName}{c.firstName ? `, ${c.firstName}` : ''}
                      </p>
                      {c.contactType === 'guest' && (
                        <span className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-400 leading-none">manuell</span>
                      )}
                    </div>
                    {fn && <p className="text-[10px] text-gray-500 truncate mt-0.5">{fn}</p>}
                  </button>

                  {isEditor && (
                    <div className="relative flex-shrink-0 pr-1">
                      <button
                        onClick={e => { e.stopPropagation(); setContactsMenuOpenId(menuOpen ? null : cid) }}
                        className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title="Optionen"
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                      </button>
                      {menuOpen && (
                        <div
                          className="absolute right-0 top-full mt-0.5 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={async () => {
                              setContactsMenuOpenId(null)
                              if (!confirm(`${c.firstName} ${c.lastName} wirklich löschen?`)) return
                              try {
                                await deleteContact(String(c.id))
                                setContactsList(prev => prev.filter(x => x.id !== c.id))
                                if (activeContactId === cid) {
                                  setActiveContactId(null)
                                  localStorage.removeItem('pt_contacts_last_id')
                                  window.dispatchEvent(new CustomEvent('contact-deleted', { detail: { id: cid } }))
                                }
                              } catch { /* silent */ }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                          >
                            Kontakt löschen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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

      const handleCreateVenue = async () => {
        if (!venueNewName.trim() || venueCreating) return
        setVenueCreating(true)
        try {
          const created = await createVenue({
            name: venueNewName.trim(), street: '', postalCode: '', city: '', state: '',
            country: '', website: '', arrival: '', arrivalStreet: '', arrivalPostalCode: '',
            arrivalCity: '', capacity: '', capacitySeated: '', stageDimensions: '',
            clearanceHeight: '', merchandiseFee: '', merchandiseStand: '', wardrobe: '',
            showers: '', wifi: '', parking: '', nightlinerParking: '', loadingPath: '',
            notes: '', latitude: '', longitude: '',
          })
          setVenuesList(prev => [...prev, created])
          const newId = String(created.id)
          setActiveVenueId(newId)
          setVenueInlineNew(false)
          setVenueNewName('')
          localStorage.setItem('pt_venues_last_id', newId)
          history.pushState(null, '', `/venues/${newId}`)
          window.dispatchEvent(new CustomEvent('select-venue', { detail: { id: newId } }))
        } catch { /* silent */ }
        finally { setVenueCreating(false) }
      }

      return (
        <div className="flex flex-col h-full">
          {/* Suche + Neu-Button */}
          <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0 flex gap-1.5">
            <input
              type="text"
              value={venuesSearch}
              onChange={e => setVenuesSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isEditor && (
              <button
                onClick={() => { setVenueInlineNew(true); setVenueNewName('') }}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors"
                title="Neue Venue"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Inline-Anlegen */}
          {venueInlineNew && (
            <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0">
              <input
                autoFocus
                type="text"
                value={venueNewName}
                onChange={e => setVenueNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateVenue()
                  if (e.key === 'Escape') { setVenueInlineNew(false); setVenueNewName('') }
                }}
                placeholder="Name der Venue…"
                className="w-full px-2.5 py-1.5 bg-white border border-blue-500 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={handleCreateVenue}
                  disabled={!venueNewName.trim() || venueCreating}
                  className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-gray-900 rounded disabled:opacity-50 transition-colors"
                >
                  {venueCreating ? '…' : 'Anlegen'}
                </button>
                <button
                  onClick={() => { setVenueInlineNew(false); setVenueNewName('') }}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-900"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Liste */}
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light" onClick={() => setVenueMenuOpenId(null)}>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 text-center">
                {venuesList.length === 0 ? 'Keine Venues' : 'Keine Treffer'}
              </p>
            ) : filtered.map(v => {
              const isActive = String(v.id) === activeVenueId
              const menuOpen = venueMenuOpenId === String(v.id)
              return (
                <div
                  key={v.id}
                  className={`group relative flex items-center border-l-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-gray-200'
                      : 'border-transparent hover:bg-gray-100'
                  }`}
                >
                  <button
                    onClick={() => {
                      setVenueMenuOpenId(null)
                      const id = String(v.id)
                      setActiveVenueId(id)
                      localStorage.setItem('pt_venues_last_id', id)
                      history.pushState(null, '', `/venues/${id}`)
                      window.dispatchEvent(new CustomEvent('select-venue', { detail: { id } }))
                    }}
                    className="flex-1 text-left px-3 py-2 min-w-0"
                  >
                    <p className={`text-xs leading-snug truncate ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                      {v.name}
                    </p>
                    {v.city && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{v.city}{v.country ? `, ${v.country}` : ''}</p>
                    )}
                  </button>

                  {isEditor && (
                    <div className="relative flex-shrink-0 pr-1">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setVenueMenuOpenId(menuOpen ? null : String(v.id))
                        }}
                        className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${
                          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="Optionen"
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4" />
                      </button>

                      {menuOpen && (
                        <div
                          className="absolute right-0 top-full mt-0.5 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={async () => {
                              setVenueMenuOpenId(null)
                              if (!confirm(`Venue „${v.name}" wirklich löschen?`)) return
                              try {
                                await deleteVenue(String(v.id))
                                setVenuesList(prev => prev.filter(x => x.id !== v.id))
                                if (activeVenueId === String(v.id)) {
                                  setActiveVenueId(null)
                                  history.pushState(null, '', '/?tab=venues')
                                }
                              } catch { /* silent */ }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                          >
                            Venue löschen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // ── Partner ──────────────────────────────────────────────────────────────
    if (activeTab === 'partners') {
      const q = partnersSearch.toLowerCase()
      const filtered = partnersList
        .filter(p => !q || p.companyName?.toLowerCase().includes(q) || p.type?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q))
        .sort((a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? '', 'de'))

      return (
        <div className="flex flex-col h-full">
          <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0 flex gap-1.5">
            <input
              type="text" value={partnersSearch} onChange={e => setPartnersSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isEditor && (
              <button onClick={handleCreateNewPartner}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors" title="Neuer Partner">
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light" onClick={() => setPartnerMenuOpenId(null)}>
            {filtered.length === 0
              ? <p className="px-3 py-4 text-xs text-gray-600 text-center">{partnersList.length === 0 ? 'Keine Partner' : 'Keine Treffer'}</p>
              : filtered.map(p => {
                const isActive = activePartnerId === p.id
                const menuOpen = partnerMenuOpenId === p.id
                return (
                  <div key={p.id} className={`group relative flex items-center border-l-2 transition-colors ${isActive ? 'border-blue-500 bg-gray-200' : 'border-transparent hover:bg-gray-100'}`}>
                    <button
                      onClick={() => {
                        setActivePartnerId(p.id)
                        localStorage.setItem('pt_partners_last_id', p.id)
                        history.pushState(null, '', `/partners/${p.id}`)
                        window.dispatchEvent(new CustomEvent('select-partner', { detail: { id: p.id } }))
                      }}
                      className="flex-1 text-left px-3 py-2 min-w-0"
                    >
                      <p className={`text-xs leading-snug truncate ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{p.companyName}</p>
                      {(p.type || p.city) && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{[p.type, p.city].filter(Boolean).join(' · ')}</p>
                      )}
                    </button>
                    {isEditor && (
                      <div className="relative flex-shrink-0 pr-1">
                        <button onClick={e => { e.stopPropagation(); setPartnerMenuOpenId(menuOpen ? null : p.id) }}
                          className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <EllipsisHorizontalIcon className="w-4 h-4" />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1" onClick={e => e.stopPropagation()}>
                            <button onClick={async () => { setPartnerMenuOpenId(null); if (!confirm(`Partner „${p.companyName}" wirklich löschen?`)) return; try { await deletePartner(p.id); setPartnersList(prev => prev.filter(x => x.id !== p.id)); if (activePartnerId === p.id) setActivePartnerId(null) } catch { /* silent */ } }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors">
                              Partner löschen
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      )
    }

    // ── Hotels ───────────────────────────────────────────────────────────────
    if (activeTab === 'hotels') {
      const q = hotelsSearch.toLowerCase()
      const filtered = hotelsList
        .filter(h => !q || h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))

      return (
        <div className="flex flex-col h-full">
          <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0 flex gap-1.5">
            <input
              type="text" value={hotelsSearch} onChange={e => setHotelsSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isEditor && (
              <button onClick={handleCreateNewHotel}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors" title="Neues Hotel">
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light" onClick={() => setHotelMenuOpenId(null)}>
            {filtered.length === 0
              ? <p className="px-3 py-4 text-xs text-gray-600 text-center">{hotelsList.length === 0 ? 'Keine Hotels' : 'Keine Treffer'}</p>
              : filtered.map(h => {
                const isActive = activeHotelId === h.id
                const menuOpen = hotelMenuOpenId === h.id
                return (
                  <div key={h.id} className={`group relative flex items-center border-l-2 transition-colors ${isActive ? 'border-blue-500 bg-gray-200' : 'border-transparent hover:bg-gray-100'}`}>
                    <button
                      onClick={() => {
                        setActiveHotelId(h.id)
                        localStorage.setItem('pt_hotels_last_id', h.id)
                        history.pushState(null, '', `/hotels/${h.id}`)
                        window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id: h.id } }))
                      }}
                      className="flex-1 text-left px-3 py-2 min-w-0"
                    >
                      <p className={`text-xs leading-snug truncate ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{h.name}</p>
                      {(h.city || h.country) && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{[h.city, h.country].filter(Boolean).join(', ')}</p>
                      )}
                    </button>
                    {isEditor && (
                      <div className="relative flex-shrink-0 pr-1">
                        <button onClick={e => { e.stopPropagation(); setHotelMenuOpenId(menuOpen ? null : h.id) }}
                          className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <EllipsisHorizontalIcon className="w-4 h-4" />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1" onClick={e => e.stopPropagation()}>
                            <button onClick={async () => { setHotelMenuOpenId(null); if (!confirm(`Hotel „${h.name}" wirklich löschen?`)) return; try { await deleteHotel(h.id); setHotelsList(prev => prev.filter(x => x.id !== h.id)); if (activeHotelId === h.id) setActiveHotelId(null) } catch { /* silent */ } }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors">
                              Hotel löschen
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      )
    }

    // ── Fahrzeuge ─────────────────────────────────────────────────────────────
    if (activeTab === 'vehicles') {
      const q = vehiclesSearch.toLowerCase()
      const filtered = vehiclesList
        .filter(v => !q || v.designation?.toLowerCase().includes(q) || v.vehicleType?.toLowerCase().includes(q) || v.licensePlate?.toLowerCase().includes(q))
        .sort((a, b) => (a.designation ?? '').localeCompare(b.designation ?? '', 'de'))

      return (
        <div className="flex flex-col h-full">
          <div className="px-2 py-2 border-b border-gray-200 flex-shrink-0 flex gap-1.5">
            <input
              type="text" value={vehiclesSearch} onChange={e => setVehiclesSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isEditor && (
              <button onClick={handleCreateNewVehicle}
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors" title="Neues Fahrzeug">
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1 scrollbar-light" onClick={() => setVehicleMenuOpenId(null)}>
            {filtered.length === 0
              ? <p className="px-3 py-4 text-xs text-gray-600 text-center">{vehiclesList.length === 0 ? 'Keine Fahrzeuge' : 'Keine Treffer'}</p>
              : filtered.map(v => {
                const isActive = activeVehicleId === v.id
                const menuOpen = vehicleMenuOpenId === v.id
                return (
                  <div key={v.id} className={`group relative flex items-center border-l-2 transition-colors ${isActive ? 'border-blue-500 bg-gray-200' : 'border-transparent hover:bg-gray-100'}`}>
                    <button
                      onClick={() => {
                        setActiveVehicleId(v.id)
                        localStorage.setItem('pt_vehicles_last_id', v.id)
                        history.pushState(null, '', `/vehicles/${v.id}`)
                        window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id: v.id } }))
                      }}
                      className="flex-1 text-left px-3 py-2 min-w-0"
                    >
                      <p className={`text-xs leading-snug truncate ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{v.designation || v.vehicleType || '–'}</p>
                      {(v.vehicleType || v.licensePlate) && (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{[v.vehicleType, v.licensePlate].filter(Boolean).join(' · ')}</p>
                      )}
                    </button>
                    {isEditor && (
                      <div className="relative flex-shrink-0 pr-1">
                        <button onClick={e => { e.stopPropagation(); setVehicleMenuOpenId(menuOpen ? null : v.id) }}
                          className={`p-1 rounded transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-200 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <EllipsisHorizontalIcon className="w-4 h-4" />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1" onClick={e => e.stopPropagation()}>
                            <button onClick={async () => { setVehicleMenuOpenId(null); if (!confirm(`Fahrzeug „${v.designation || v.vehicleType}" wirklich löschen?`)) return; try { await deleteVehicle(v.id); setVehiclesList(prev => prev.filter(x => x.id !== v.id)); if (activeVehicleId === v.id) setActiveVehicleId(null) } catch { /* silent */ } }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors">
                              Fahrzeug löschen
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>
        </div>
      )
    }

    return null
  }

  // Breadcrumb — translated
  const TAB_LABEL_KEYS: Record<string, string> = {
    desk: t('nav.desk'), events: t('nav.events'),
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

  // ── Search navigation handler ──────────────────────────────────────────────
  const handleSearchNavigate = (result: SearchResult) => {
    const id = result.id

    switch (result.type) {
      case 'event': {
        // URL setzen damit TermineModule beim Mount direkt die richtige ID liest
        history.pushState(null, '', `/?tab=events&id=${id}&view=details2`)
        setActiveTerminId(id)
        localStorage.setItem('pt_events_last_id', String(id))
        onTabChange('events')
        // Sofort dispatchen (wie Sidebar-Click) — Modul ist bereits gemountet wenn
        // User auf Events-Tab ist; wenn nicht, liest es die ID aus der URL beim Mount
        window.dispatchEvent(new CustomEvent('select-termin', { detail: { id, view: 'details2' } }))
        break
      }
      case 'contact':
        history.pushState(null, '', `/?tab=contacts&id=${id}`)
        onTabChange('contacts')
        setTimeout(() => window.dispatchEvent(new CustomEvent('select-contact', { detail: { id } })), 80)
        break
      case 'venue':
        history.pushState(null, '', `/?tab=venues&id=${id}`)
        onTabChange('venues')
        setTimeout(() => window.dispatchEvent(new CustomEvent('select-venue', { detail: { id } })), 80)
        break
      case 'partner':
        history.pushState(null, '', `/?tab=partners&id=${id}`)
        onTabChange('partners')
        setTimeout(() => window.dispatchEvent(new CustomEvent('select-partner', { detail: { id } })), 80)
        break
      case 'hotel':
        history.pushState(null, '', `/?tab=hotels&id=${id}`)
        onTabChange('hotels')
        setTimeout(() => window.dispatchEvent(new CustomEvent('select-hotel', { detail: { id } })), 80)
        break
      case 'vehicle':
        history.pushState(null, '', `/?tab=vehicles&id=${id}`)
        onTabChange('vehicles')
        setTimeout(() => window.dispatchEvent(new CustomEvent('select-vehicle', { detail: { id } })), 80)
        break
    }
  }

  return (
    <div className="hidden md:flex flex-col h-screen bg-gray-100">

      {/* ── GLOBAL TOP BAR ──────────────────────────────────────────────────── */}
      <GlobalTopBar artistName={artistName} onNavigate={handleSearchNavigate} />

      {/* ── BODY (Rail + Panel + Content) ───────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── RAIL (64px) ─────────────────────────────────────────────────────── */}
      <aside className="w-16 flex-shrink-0 bg-gray-200 flex flex-col items-center border-r border-gray-300">

        {/* User initials / dropdown trigger */}
        <div className="relative w-full flex justify-center pt-3 pb-2" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex flex-col items-center gap-1 w-full py-2 hover:bg-gray-300 transition-colors rounded-md mx-1"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <span className="text-[9px] text-gray-500 leading-none">Account</span>
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
        <nav className="flex-1 flex flex-col items-center w-full px-1 py-1 space-y-0.5 overflow-y-auto scrollbar-light">
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
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300'
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
              <div className="w-8 border-t border-gray-300 my-1" />
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
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300'
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
        <div className="w-full px-1 pb-3 border-t border-gray-300 pt-2">
          <button
            onClick={() => handleNav('settings')}
            title="Einstellungen"
            className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-md transition-colors ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300'
            }`}
          >
            <Cog6ToothIcon className="w-5 h-5" />
            <span className="text-[9px] leading-tight">{t('nav.settings')}</span>
          </button>
        </div>
      </aside>

      {/* ── CONTEXT PANEL (collapsible) ──────────────────────────────────────── */}
      {hasPanelForSection && panelOpen && (
        <div
          className="flex-shrink-0 bg-gray-50 flex flex-col border-r border-gray-200 relative"
          style={{ width: panelWidth }}
        >

          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {TAB_LABEL_KEYS[activeTab] ?? activeTab}
              </p>
              {artistName && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{artistName}</p>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* CSV Menu — Venues, Partners, Hotels, Vehicles */}
              {(['venues', 'partners', 'hotels', 'vehicles'] as const).includes(activeTab as any) && isEditor && (() => {
                const menuOpen = activeTab === 'venues' ? venuesCsvMenuOpen : activeTab === 'partners' ? partnersCsvMenuOpen : activeTab === 'hotels' ? hotelsCsvMenuOpen : vehiclesCsvMenuOpen
                const setMenuOpen = activeTab === 'venues' ? setVenuesCsvMenuOpen : activeTab === 'partners' ? setPartnersCsvMenuOpen : activeTab === 'hotels' ? setHotelsCsvMenuOpen : setVehiclesCsvMenuOpen
                const inputRef = activeTab === 'venues' ? venuesCsvInputRef : activeTab === 'partners' ? partnersCsvInputRef : activeTab === 'hotels' ? hotelsCsvInputRef : vehiclesCsvInputRef
                const onExport = activeTab === 'venues' ? exportVenuesCsv : activeTab === 'partners' ? exportPartnersCsv : activeTab === 'hotels' ? exportHotelsCsv : exportVehiclesCsv
                const onImport = activeTab === 'venues' ? importVenuesCsv : activeTab === 'partners' ? importPartnersCsv : activeTab === 'hotels' ? importHotelsCsv : importVehiclesCsv
                return (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(o => !o)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors"
                      title="CSV Import / Export"
                    >
                      <EllipsisHorizontalIcon className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <div
                        className="absolute right-0 top-full mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={onExport}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          CSV exportieren
                        </button>
                        <label className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer block">
                          CSV importieren
                          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })()}
              <button
                onClick={togglePanel}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto py-2">
            {renderPanelContent()}
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={startPanelDrag}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10"
            title="Breite anpassen"
          />
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

          {/* Left: Detail-Tabs — Advancing, Appointments oder Venues */}
          <div className="flex-1 flex items-center min-w-0">
            {activeTab === 'venues' && (
              <div className="flex items-center gap-0.5">
                <button
                  className="px-3 py-1.5 rounded-md text-sm bg-gray-100 text-gray-900 font-medium"
                >
                  Details
                </button>
              </div>
            )}
            {(['partners', 'hotels', 'vehicles'] as const).includes(activeTab as any) && (
              <div className="flex items-center gap-0.5">
                <button className="px-3 py-1.5 rounded-md text-sm bg-gray-100 text-gray-900 font-medium">
                  Details
                </button>
              </div>
            )}
            {activeTab === 'contacts' && (
              <div className="flex items-center gap-0.5">
                {[
                  { id: 'overview',     label: t('contacts.sub.overview') },
                  ...(isEditor ? [{ id: 'crew-booking', label: t('contacts.sub.crewBooking') }] : []),
                  ...(isEditor ? [{ id: 'conditions',   label: t('contacts.sub.conditions') }] : []),
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => onSubTabChange?.(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      activeSubTab === tab.id
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'events' && (() => {
              const isAdvancing = true
              const currentView = advancingView
              const eventName = 'advancing-set-view'
              const setView = setAdvancingView

              // "Übersicht"-Tab immer anzeigen
              const overviewActive = !termineInDetail
              const detailTabs: { id: string; label: string }[] = termineInDetail
                ? isAdvancing
                  ? [
                      { id: 'details2',    label: 'Details' },
                      { id: 'travel',      label: 'Travel' },
                      { id: 'schedule',    label: 'Schedule' },
                      { id: 'hospitality', label: 'Hospitality' },
                      { id: 'advancing',   label: 'Advancing' },
                      { id: 'agreements',  label: 'Agreements' },
                      { id: 'travelparty', label: 'Reisegruppe' },
                      { id: 'briefing',    label: 'Briefing' },
                    ]
                  : [
                      { id: 'details', label: 'Details' },
                    ]
                : []

              return (
                <div className="flex items-center gap-0.5">
                  {/* Übersicht — führt zurück zur Liste */}
                  <button
                    onClick={() => {
                      setTermineInDetail(false)
                      window.dispatchEvent(new CustomEvent('advancing-go-to-list'))
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      overviewActive
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    Übersicht
                  </button>
                  {/* Detail-Tabs — nur wenn Event offen */}
                  {detailTabs.map(v => (
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
      </div> {/* end BODY */}
    </div>
  )
}

export default L3Layout
