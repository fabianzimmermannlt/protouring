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
  isEditorRole,
  isTenantModuleEnabled,
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
  { id: 'uploads',     name: 'Upload-Kategorien', editorOnly: true },
  { id: 'guestlist',   name: 'Gästeliste',       editorOnly: true },
  { id: 'daysheet',    name: 'Daysheet',         editorOnly: true },
  { id: 'vorlagen',    name: 'Vorlagen',         editorOnly: true },
]

const CONTACTS_SUBS: SubItem[] = [
  { id: 'overview',     name: 'Übersicht' },
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
  { id: 'events', name: 'Events',       icon: CalendarDaysIcon },
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
  const [dirtyDialog, setDirtyDialog] = useState<{ onProceed: () => void } | null>(null)

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

  // Chip-Flash: JS-driven weil CSS :active + React re-render kollidieren
  useEffect(() => {
    function handleChipClick(e: MouseEvent) {
      const btn = (e.target as Element).closest('.pt-fn-chip') as HTMLElement | null
      if (!btn) return
      btn.style.animation = 'none'
      void btn.offsetWidth // force reflow -> animation restart
      btn.style.animation = 'chip-flash 0.25s ease-out'
      setTimeout(() => btn.style.removeProperty('animation'), 350)
    }
    document.addEventListener('click', handleChipClick, true)
    return () => document.removeEventListener('click', handleChipClick, true)
  }, [])

  const guardDirtyNav = (onProceed: () => void) => {
    if ((window as any).__pt_isDirty) {
      setDirtyDialog({ onProceed })
    } else {
      onProceed()
    }
  }

  const handleNav = (id: string) => {
    guardDirtyNav(() => {
      if (id === 'settings') { onTabChange('settings', 'profil'); return }
      let defaultSub: string | undefined
      if (id === 'contacts') defaultSub = 'overview'
      else if (id === 'equipment') defaultSub = 'items'
      onTabChange(id, defaultSub)
      setShowUserMenu(false)
    })
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
  const renderTermineSubs = () => (
    <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-[#333] space-y-0.5">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-new-termin'))}
        className="w-full text-left px-2 py-1.5 rounded text-xs l2-nav-sub-item hover:text-white hover:bg-[#2d2d2d] transition-colors flex items-center gap-1.5"
      >
        <PlusIcon className="w-3 h-3" /> Neuer Termin
      </button>
      <button
        onClick={() => guardDirtyNav(() => { handleNav('events'); onSubTabChange?.('crew-booking') })}
        className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
          activeTab === 'events' && activeSubTab === 'crew-booking'
            ? 'pt-nav-sub-active'
            : 'l2-nav-sub-item hover:text-white hover:bg-[#2d2d2d]'
        }`}
      >
        Crew-Buchung
      </button>
    </div>
  )

  // ── Nav item renderer ───────────────────────────────────────────────────────
  const renderNavItem = (
    item: { id: string; name: string; icon: React.ComponentType<{ className?: string }> },
    isModule = false
  ) => {
    const isActive = activeTab === item.id
    const subs = getVisibleSubs(item.id)
    const hasSubNav = subs.length > 0 || item.id === 'events'

    return (
      <div key={item.id}>
        <button
          onClick={() => handleNav(item.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
            isActive
              ? 'pt-nav-active'
              : 'hover:text-white hover:bg-[#2d2d2d]'
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
                isActive ? 'rotate-180 text-gray-700' : 'text-gray-500'
              }`}
            />
          )}
        </button>

        {isActive && item.id === 'events' && renderTermineSubs()}

        {isActive && item.id !== 'appointments' && hasSubNav && (
          <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-[#333] space-y-0.5">
            {subs.map(sub => (
              <button
                key={sub.id}
                onClick={() => guardDirtyNav(() => onSubTabChange?.(sub.id))}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                  activeSubTab === sub.id
                    ? 'pt-nav-sub-active'
                    : 'l2-nav-sub-item hover:text-white hover:bg-[#2d2d2d]'
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

  // ── Settings sidebar sub-items (inline, like Events/Contacts) ───────────────
  const renderSettingsSubs = () => {
    const kontoItems = filterSettings(SETTINGS_KONTO)
    const workspaceItems = filterSettings(SETTINGS_WORKSPACE)
    return (
      <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-[#333] space-y-0.5">
        {kontoItems.length > 0 && (
          <>
            <p className="px-2 pt-1 pb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Konto</p>
            {kontoItems.map(sub => (
              <button key={sub.id}
                onClick={() => guardDirtyNav(() => onSubTabChange?.(sub.id))}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                  activeSubTab === sub.id ? 'pt-nav-sub-active' : 'l2-nav-sub-item hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </>
        )}
        {workspaceItems.length > 0 && (
          <>
            <p className="px-2 pt-2 pb-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Workspace</p>
            {workspaceItems.map(sub => (
              <button key={sub.id}
                onClick={() => guardDirtyNav(() => onSubTabChange?.(sub.id))}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                  activeSubTab === sub.id ? 'pt-nav-sub-active' : 'l2-nav-sub-item hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="hidden md:flex h-screen bg-gray-100 overflow-hidden">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-[#1c1c1c] flex flex-col border-r border-[#333] l2-sidebar">

        {/* Identity */}
        <div className="px-4 py-4 border-b border-[#333]">
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
            <p className="text-xs text-gray-500 truncate pl-[42px]" style={{color:'#888'}}>{artistName}</p>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-0 py-3 overflow-y-auto space-y-0.5">
          {MAIN_NAV.filter(item => canDo(role, NAV_VISIBLE[item.id] ?? [])).map(item =>
            renderNavItem(item)
          )}

          {/* Module section inside main nav */}
          {canDo(role, NAV_VISIBLE['modules'] ?? []) && MODULE_NAV.some(item => isTenantModuleEnabled(item.id as any)) && (
            <>
              <div className="pt-2 pb-1">
                <div className="border-t border-[#333]" />
              </div>
              <p className="px-3 pb-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Module
              </p>
              {MODULE_NAV.filter(item => isTenantModuleEnabled(item.id as any)).map(item => renderNavItem(item, true))}
            </>
          )}
        </nav>

        {/* Einstellungen – ganz unten */}
        <div className="px-0 pb-3 border-t border-[#333] pt-3">
          <button
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
              activeTab === 'settings' ? 'pt-nav-active' : 'hover:text-white hover:bg-[#2d2d2d]'
            }`}
          >
            <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Einstellungen</span>
            <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 transition-transform ${
              activeTab === 'settings' ? 'rotate-180 text-gray-700' : 'text-gray-500'
            }`} />
          </button>
          {activeTab === 'settings' && renderSettingsSubs()}
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0 gap-4">
          <div className="flex-1" />

          {/* Right: Preview Banner */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <PreviewBanner />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#1c1c1c] l2-content">
          {children}
        </div>
      </div>

      {dirtyDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#2a2a2a', borderRadius: '8px', padding: '24px', maxWidth: '360px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Ungespeicherte Änderungen</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>Möchtest du die Änderungen speichern oder verwerfen?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDirtyDialog(null)}
                style={{ padding: '8px 16px', fontSize: '13px', color: '#9ca3af', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={() => { setDirtyDialog(null); dirtyDialog.onProceed() }}
                style={{ padding: '8px 16px', fontSize: '13px', color: '#9ca3af', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
                Verwerfen
              </button>
              <button onClick={async () => {
                const save = (window as any).__pt_save as (() => Promise<boolean>) | null
                if (save) { const ok = await save(); if (!ok) return }
                setDirtyDialog(null)
                dirtyDialog.onProceed()
              }}
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default L2Layout
