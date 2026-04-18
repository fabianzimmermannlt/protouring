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
  const canSeeKalender = canDo(getEffectiveRole(), CAN_SEE_KALENDER)

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

  const views = [
    { id: 'details',       label: 'Details',       short: 'Details' },
    { id: 'travelparty',   label: 'Reisegruppe',   short: 'Crew' },
    ...(isEditor ? [{ id: 'advance-sheet', label: 'Advance Sheet', short: 'Advance' }] : []),
    { id: 'guestlist',     label: 'Gästeliste',    short: 'Gäste' },
  ] as { id: string; label: string; short: string }[]

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block pt-subnav">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="pt-subnav-inner">
            <button onClick={() => onBack?.()} className="pt-subnav-btn">Terminliste</button>
            {views.map(v => (
              <button key={v.id} onClick={() => onViewChange?.(v.id as TermineDetailView)}
                className={`pt-subnav-btn ${activeView === v.id ? 'active' : ''}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Chips */}
      <div className="md:hidden pt-chips">
        {views.map(v => (
          <button key={v.id} onClick={() => onViewChange?.(v.id as TermineDetailView)}
            className={`pt-chip ${activeView === v.id ? 'active' : ''}`}>
            {v.short}
          </button>
        ))}
      </div>
    </>
  )
}

export default TermineSubNavigation
