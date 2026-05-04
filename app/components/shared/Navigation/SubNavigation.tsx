'use client'

import { getEffectiveRole, type TenantRole } from '@/lib/api-client'

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

// Rollen-Zuordnung pro Sub-Tab:
// profil, appearance, notifications, erste-schritte → alle
// permissions, contacts, guestlist, daysheet        → Rollen 1–3 (editor)
// artist                                             → nur admin (Rolle 1)
const EDITOR_ROLES: TenantRole[] = ['admin', 'agency', 'tourmanagement']

interface SubNavigationItemDef extends SubNavigationItem {
  allowedRoles?: TenantRole[] // undefined = alle Rollen
}

const platformSubItems: SubNavigationItemDef[] = [
  { id: 'profil',         name: 'MEIN PROFIL',        description: 'Profil & Passwort' },
  { id: 'permissions',    name: 'BERECHTIGUNGEN',     description: 'User-Berechtigungen',          allowedRoles: EDITOR_ROLES },
  { id: 'appearance',     name: 'DARSTELLUNG',         description: 'Aussehen & Layout' },
  { id: 'notifications',  name: 'BENACHRICHTIGUNGEN',  description: 'Benachrichtigungseinstellungen' },
  { id: 'contacts',       name: 'KONTAKTE',            description: 'Kontaktverwaltung',            allowedRoles: EDITOR_ROLES },
  { id: 'guestlist',      name: 'GÄSTELISTE',          description: 'Gästenliste & VIPs',           allowedRoles: EDITOR_ROLES },
  { id: 'daysheet',       name: 'DAYSHEET',            description: 'Tagespläne & Routinen',        allowedRoles: EDITOR_ROLES },
  { id: 'vorlagen',       name: 'VORLAGEN',            description: 'Dokumentenvorlagen',           allowedRoles: EDITOR_ROLES },
  { id: 'artist',         name: 'ARTIST',              description: 'Artist-Informationen',         allowedRoles: ['admin'] },
  { id: 'partners',       name: 'PARTNERS',            description: 'Partner-Typen verwalten',      allowedRoles: ['admin'] },
  { id: 'gewerke',        name: 'GEWERKE',             description: 'Crew-Gewerke & Briefings',     allowedRoles: EDITOR_ROLES },
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
  vorlagen: 'Vorlagen',
  artist: 'Artist',
  partners: 'Partners',
  gewerke: 'Gewerke',
  'erste-schritte': 'Hilfe',
}

export function SubNavigation({
  activeTab = 'profil',
  parentTab = 'settings',
  onTabChange,
  maxWidth = 'max-w-full'
}: SubNavigationProps) {
  if (parentTab !== 'settings') return null

  const role = getEffectiveRole() as TenantRole
  const visibleItems = platformSubItems.filter(item =>
    !item.allowedRoles || item.allowedRoles.includes(role)
  )

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
