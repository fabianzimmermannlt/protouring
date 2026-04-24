'use client'

import { getEffectiveRole } from '@/lib/api-client'

export interface SubNavigationItem {
  id: string
  name: string
  description: string
}

export interface SubNavigationProps {
  activeTab?: string
  parentTab?: string
  onTabChange?: (tabId: string) => void
  maxWidth?: string
}

const platformSubItems: SubNavigationItem[] = [
  { id: 'profil',        name: 'MEIN PROFIL',         description: 'Profil & Passwort' },
  { id: 'permissions',   name: 'BERECHTIGUNGEN',      description: 'User-Berechtigungen' },
  { id: 'appearance',    name: 'DARSTELLUNG',          description: 'Aussehen & Layout' },
  { id: 'notifications', name: 'BENACHRICHTIGUNGEN',   description: 'Benachrichtigungseinstellungen' },
  { id: 'contacts',      name: 'KONTAKTE',             description: 'Kontaktverwaltung' },
  { id: 'guestlist',     name: 'GÄSTELISTE',           description: 'Gästenliste & VIPs' },
  { id: 'daysheet',      name: 'DAYSHEET',             description: 'Tagespläne & Routinen' },
  { id: 'artist',         name: 'ARTIST',              description: 'Artist-Informationen' },
  { id: 'erste-schritte', name: 'ERSTE SCHRITTE',      description: 'Hilfe & Übersicht' },
]

const SHORT_LABEL: Record<string, string> = {
  profil: 'Profil',
  permissions: 'Rechte',
  appearance: 'Style',
  notifications: 'Alerts',
  contacts: 'Kontakte',
  guestlist: 'Gäste',
  daysheet: 'Daysheet',
  artist: 'Artist',
  'erste-schritte': 'Hilfe',
}

export function SubNavigation({
  activeTab = 'profil',
  parentTab = 'settings',
  onTabChange,
  maxWidth = 'max-w-full'
}: SubNavigationProps) {
  if (parentTab !== 'settings') return null

  const isAdmin = getEffectiveRole() === 'admin'
  const visibleItems = platformSubItems.filter(item => {
    if (item.id === 'permissions' || item.id === 'artist') return isAdmin
    return true // alle anderen inkl. 'erste-schritte' für alle Rollen
  })

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block pt-subnav">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="pt-subnav-inner">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={`pt-subnav-btn${activeTab === item.id ? ' active' : ''}`}
                title={item.description}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Mobile Chips */}
      <div className="md:hidden pt-chips">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange?.(item.id)}
            className={`pt-chip${activeTab === item.id ? ' active' : ''}`}
          >
            {SHORT_LABEL[item.id] ?? item.name}
          </button>
        ))}
      </div>
    </>
  )
}

export default SubNavigation
