'use client'

import { getEffectiveRole, isEditorRole } from '@/lib/api-client'

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

const contactsSubItems: SubNavigationItem[] = [
  { id: 'overview',     name: 'ÜBERSICHT',       description: 'Alle Kontakte anzeigen' },
  { id: 'crew-booking', name: 'CREW-VERMITTLUNG', description: 'Crew-Buchungen verwalten' },
  { id: 'conditions',   name: 'KONDITIONEN',      description: 'Verträge und Konditionen' }
]

const SHORT_LABEL: Record<string, string> = {
  overview: 'Übersicht',
  'crew-booking': 'Crew',
  conditions: 'Konditionen',
}

export function ContactsSubNavigation({
  activeTab = 'overview',
  parentTab = 'contacts',
  onTabChange,
  maxWidth = 'max-w-full'
}: SubNavigationProps) {
  if (parentTab !== 'contacts') return null

  const canSeeCrew = isEditorRole(getEffectiveRole())
  const visibleItems = contactsSubItems.filter(
    item => item.id !== 'crew-booking' || canSeeCrew
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

export default ContactsSubNavigation
