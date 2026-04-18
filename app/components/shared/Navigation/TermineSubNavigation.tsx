'use client'

import { getEffectiveRole, canDo, CAN_SEE_KALENDER, isEditorRole } from '@/lib/api-client'

export type TermineDetailView = 'details' | 'travelparty' | 'advance-sheet' | 'guestlist'
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

export function TermineListSubNavigation({
  maxWidth = 'max-w-full',
  activeFilter = 'aktuell',
  onFilterChange,
  listView = 'list',
  onListViewChange,
}: TermineListSubNavigationProps) {
  const canSeeKalender = canDo(getEffectiveRole(), CAN_SEE_KALENDER)
  return (
    <div className="pt-subnav">
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
  return (
    <div className="pt-subnav">
      <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="pt-subnav-inner">
          <button onClick={() => onBack?.()} className="pt-subnav-btn">
            Terminliste
          </button>
          <button
            onClick={() => onViewChange?.('details')}
            className={`pt-subnav-btn ${activeView === 'details' ? 'active' : ''}`}
          >
            Details
          </button>
          <button
            onClick={() => onViewChange?.('travelparty')}
            className={`pt-subnav-btn ${activeView === 'travelparty' ? 'active' : ''}`}
          >
            Reisegruppe
          </button>
          {isEditor && (
            <button
              onClick={() => onViewChange?.('advance-sheet')}
              className={`pt-subnav-btn ${activeView === 'advance-sheet' ? 'active' : ''}`}
            >
              Advance Sheet
            </button>
          )}
          <button
            onClick={() => onViewChange?.('guestlist')}
            className={`pt-subnav-btn ${activeView === 'guestlist' ? 'active' : ''}`}
          >
            Gästeliste
          </button>
        </div>
      </div>
    </div>
  )
}

export default TermineSubNavigation
