'use client'

import { getEffectiveRole, canDo, can, CAN_SEE_KALENDER, isEditorRole, isTenantModuleEnabled } from '@/lib/api-client'
import { visibleGroups, visibleLeaves, defaultViewForGroup, groupForView, isLeafActive, type CanLeaf } from './eventNav'

export type TermineDetailView = 'details' | 'details2' | 'venue' | 'partner' | 'communication' | 'travel' | 'schedule' | 'catering' | 'hospitality' | 'advancing' | 'briefing' | 'agreements' | 'travelparty' | 'advance-sheet' | 'guestlist' | 'setlist' | 'files' | 'booking'
export type TermineListFilter = 'aktuell' | 'vergangen' | 'alle'
export type TermineListView = 'list' | 'calendar'

const FILTER_LABELS: Record<TermineListFilter, string> = {
  aktuell:   'Aktuelle Termine',
  vergangen: 'Vergangene Termine',
  alle:      'Alle Termine',
}

export interface TermineListSubNavigationProps {
  maxWidth?: string
  activeFilter?: TermineListFilter
  onFilterChange?: (filter: TermineListFilter) => void
  listView?: TermineListView
  onListViewChange?: (view: TermineListView) => void
}

const FILTER_SHORT: Record<TermineListFilter, string> = {
  aktuell:   'Aktuell',
  vergangen: 'Vergangen',
  alle:      'Alle',
}

export function TermineListSubNavigation({
  maxWidth = 'max-w-full',
  activeFilter = 'aktuell',
  onFilterChange,
  listView = 'list',
  onListViewChange,
}: TermineListSubNavigationProps) {
  const canSeeKalender = can('CAN_SEE_KALENDER')

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block pt-subnav">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="pt-subnav-inner">
            {(['aktuell', 'vergangen', 'alle'] as TermineListFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { onListViewChange?.('list'); onFilterChange?.(f) }}
                className={`pt-subnav-btn${listView === 'list' && activeFilter === f ? ' active' : ''}`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
            {canSeeKalender && (
              <button
                onClick={() => onListViewChange?.('calendar')}
                className={`pt-subnav-btn${listView === 'calendar' ? ' active' : ''}`}
              >
                KALENDER
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Chips */}
      <div className="md:hidden pt-chips">
        {(['aktuell', 'vergangen', 'alle'] as TermineListFilter[]).map(f => (
          <button
            key={f}
            onClick={() => { onListViewChange?.('list'); onFilterChange?.(f) }}
            className={`pt-chip${listView === 'list' && activeFilter === f ? ' active' : ''}`}
          >
            {FILTER_SHORT[f]}
          </button>
        ))}
        {canSeeKalender && (
          <button
            onClick={() => onListViewChange?.('calendar')}
            className={`pt-chip${listView === 'calendar' ? ' active' : ''}`}
          >
            Kalender
          </button>
        )}
      </div>
    </>
  )
}

export interface TermineSubNavigationProps {
  maxWidth?: string
  onBack?: () => void
  activeView?: TermineDetailView
  onViewChange?: (view: TermineDetailView) => void
}

export function TermineSubNavigation({
  maxWidth = 'max-w-full',
  onBack,
  activeView = 'details',
  onViewChange,
}: TermineSubNavigationProps) {
  const isEditor = isEditorRole(getEffectiveRole())

  const canLeaf: CanLeaf = (leaf) =>
    (!leaf.editorOnly || isEditor) &&
    (!leaf.needsBooking || (isEditor && isTenantModuleEnabled('booking')))

  const groups = visibleGroups(canLeaf)
  const activeGroup = groupForView(activeView) ?? groups[0]
  const activeLeaves = activeGroup?.children ? visibleLeaves(activeGroup, canLeaf) : []
  const go = (view: string) => onViewChange?.(view as TermineDetailView)

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block pt-subnav">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="pt-subnav-inner">
            <button onClick={() => onBack?.()} className="pt-subnav-btn">Terminliste</button>
            {groups.map(g => (
              <button key={g.id} onClick={() => go(defaultViewForGroup(g, canLeaf))}
                className={`pt-subnav-btn ${activeGroup?.id === g.id ? 'active' : ''}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {activeLeaves.length > 0 && (
          <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`} style={{ borderTop: '1px solid var(--border)' }}>
            <div className="pt-subnav-inner" style={{ height: '2.5rem' }}>
              {activeLeaves.map(l => (
                <button key={l.view} onClick={() => go(l.view)}
                  className={`pt-subnav-btn ${isLeafActive(l, activeView) ? 'active' : ''}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Chips */}
      <div className="md:hidden">
        <div className="pt-chips">
          {groups.map(g => (
            <button key={g.id} onClick={() => go(defaultViewForGroup(g, canLeaf))}
              className={`pt-chip ${activeGroup?.id === g.id ? 'active' : ''}`}>
              {g.short || g.label}
            </button>
          ))}
        </div>
        {activeLeaves.length > 0 && (
          <div className="pt-chips" style={{ paddingTop: 0 }}>
            {activeLeaves.map(l => (
              <button key={l.view} onClick={() => go(l.view)}
                className={`pt-chip ${isLeafActive(l, activeView) ? 'active' : ''}`}>
                {l.short || l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default TermineSubNavigation
