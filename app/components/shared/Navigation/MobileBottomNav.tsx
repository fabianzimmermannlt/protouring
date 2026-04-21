'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  HomeIcon,
  CalendarDaysIcon,
  MapPinIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
  UsersIcon,
  MusicalNoteIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  TruckIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { getTermine, isAuthenticated, canDo, getEffectiveRole, NAV_VISIBLE } from '@/lib/api-client'

interface Props {
  activeTab: string
  onTabChange: (tabId: string, subTabId?: string) => void
  isSuperadmin: boolean
  initialActiveItem?: string
}

const MORE_ITEMS = [
  { id: 'contacts',  name: 'Kontakte',      icon: UsersIcon },
  { id: 'venues',    name: 'Venues',         icon: MusicalNoteIcon },
  { id: 'partners',  name: 'Partner',        icon: BriefcaseIcon },
  { id: 'hotels',    name: 'Hotels',         icon: BuildingOfficeIcon },
  { id: 'vehicles',  name: 'Fahrzeuge',      icon: TruckIcon },
  { id: 'templates', name: 'Vorlagen',       icon: DocumentTextIcon },
  { id: 'settings',  name: 'Einstellungen',  icon: Cog6ToothIcon },
]

export function MobileBottomNav({ activeTab, onTabChange, isSuperadmin, initialActiveItem }: Props) {
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)
  const [nextTerminId, setNextTerminId] = useState<number | null>(null)
  // activeNavItem: welcher Button zuletzt aktiv angetippt wurde
  // 'aktuell' wenn Aktuell geklickt, sonst = activeTab
  const [activeNavItem, setActiveNavItem] = useState(initialActiveItem ?? activeTab)
  const role = getEffectiveRole()

  // activeNavItem mit activeTab synchron halten (außer wenn aktuell aktiv)
  useEffect(() => {
    if (activeNavItem !== 'aktuell') {
      setActiveNavItem(activeTab)
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nächsten Termin beim Mount laden
  useEffect(() => {
    if (!isAuthenticated()) return
    getTermine()
      .then(termine => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const upcoming = termine
          .filter(t => new Date(t.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setNextTerminId(upcoming[0]?.id ?? null)
      })
      .catch(() => {})
  }, [])

  const handleAktuell = useCallback(() => {
    setShowMore(false)
    setActiveNavItem('aktuell')
    if (nextTerminId) {
      // Direkt zur Detail-URL navigieren — kein Event-Timing-Problem
      router.push(`/appointments/${nextTerminId}/details?from=aktuell`)
    } else {
      onTabChange('appointments')
    }
  }, [nextTerminId, onTabChange, router])

  const handleTermine = useCallback(() => {
    setShowMore(false)
    setActiveNavItem('appointments')
    // Immer zuerst zur Liste — wenn wir schon in appointments sind, zurück zur Liste
    // Wenn nicht, Tab wechseln
    if (activeTab === 'appointments') {
      window.dispatchEvent(new CustomEvent('termine-go-to-list'))
    } else {
      onTabChange('appointments')
    }
  }, [activeTab, onTabChange])

  const handleMore = useCallback((tabId: string) => {
    setShowMore(false)
    setActiveNavItem(tabId)
    onTabChange(tabId, tabId === 'settings' ? 'profil' : undefined)
  }, [onTabChange])

  const isMoreActive = MORE_ITEMS.some(i => i.id === activeNavItem)
  const visibleMore = MORE_ITEMS.filter(item => canDo(role, NAV_VISIBLE[item.id] ?? []))

  return (
    <>
      {showMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl border-t border-gray-200">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Mehr</span>
              <button onClick={() => setShowMore(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-2 pb-4 grid grid-cols-4 gap-1">
              {visibleMore.map(item => (
                <button key={item.id} onClick={() => handleMore(item.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-colors ${
                    activeNavItem === item.id ? 'bg-orange-50 text-orange-500' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="bg-white border-t border-gray-200 md:hidden flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-16">

          <button onClick={() => { setShowMore(false); setActiveNavItem('desk'); onTabChange('desk') }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${activeNavItem === 'desk' ? 'text-orange-500' : 'text-gray-500'}`}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Desk</span>
          </button>

          <button onClick={handleTermine}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${activeNavItem === 'appointments' ? 'text-orange-500' : 'text-gray-500'}`}>
            <CalendarDaysIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Termine</span>
          </button>

          <button onClick={handleAktuell} disabled={!nextTerminId}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeNavItem === 'aktuell' ? 'text-orange-500' : nextTerminId ? 'text-gray-500' : 'text-gray-300'
            }`}>
            <MapPinIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Aktuell</span>
          </button>

          <button onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isMoreActive || showMore ? 'text-orange-500' : 'text-gray-500'}`}>
            <EllipsisHorizontalIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mehr</span>
          </button>

        </div>
      </nav>
    </>
  )
}
