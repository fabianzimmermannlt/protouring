'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function MobileBottomNav({ activeTab, onTabChange, isSuperadmin }: Props) {
  const [showMore, setShowMore] = useState(false)
  const [nextTerminId, setNextTerminId] = useState<number | null>(null)
  const [loadingNext, setLoadingNext] = useState(false)

  const role = getEffectiveRole()

  // Nächsten Termin beim Mount laden
  useEffect(() => {
    if (!isAuthenticated()) return
    setLoadingNext(true)
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
      .finally(() => setLoadingNext(false))
  }, [])

  const handleAktuell = useCallback(() => {
    setShowMore(false)
    onTabChange('appointments')
    if (nextTerminId) {
      // Kurz warten bis TermineModule gemountet ist, dann zum Termin navigieren
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigate-to-termin', { detail: { terminId: nextTerminId } }))
      }, 50)
    }
  }, [nextTerminId, onTabChange])

  const handleMore = useCallback((tabId: string) => {
    setShowMore(false)
    onTabChange(tabId, tabId === 'settings' ? 'profil' : undefined)
  }, [onTabChange])

  const isMoreActive = MORE_ITEMS.some(i => i.id === activeTab)

  const visibleMore = MORE_ITEMS.filter(item =>
    canDo(role, NAV_VISIBLE[item.id] ?? [])
  )

  return (
    <>
      {/* Mehr-Sheet: nur rendern wenn offen */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl border-t border-gray-200">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Mehr</span>
              <button onClick={() => setShowMore(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-2 pb-4 grid grid-cols-4 gap-1">
              {visibleMore.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleMore(item.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-colors ${
                    activeTab === item.id
                      ? 'bg-orange-50 text-orange-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
        <div className="flex items-stretch h-16">

          {/* Desk */}
          <button
            onClick={() => { setShowMore(false); onTabChange('desk') }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'desk' ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Desk</span>
          </button>

          {/* Termine */}
          <button
            onClick={() => { setShowMore(false); onTabChange('appointments') }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'appointments' ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <CalendarDaysIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Termine</span>
          </button>

          {/* Aktuell */}
          <button
            onClick={handleAktuell}
            disabled={loadingNext}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              nextTerminId ? 'text-gray-500 active:text-orange-500' : 'text-gray-300'
            }`}
          >
            <MapPinIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Aktuell</span>
          </button>

          {/* Mehr */}
          <button
            onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isMoreActive || showMore ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <EllipsisHorizontalIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mehr</span>
          </button>

        </div>
      </nav>
    </>
  )
}
