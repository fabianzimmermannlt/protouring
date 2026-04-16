'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Termin } from '@/lib/api-client'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const STATUS_COLOR: Record<string, string> = {
  'Idee':                  '#9ca3af',
  'Option':                '#f59e0b',
  'noch nicht bestätigt':  '#3b82f6',
  'bestätigt':             '#22c55e',
  'abgeschlossen':         '#6b7280',
  'abgesagt':              '#ef4444',
}

const AVAIL_DOT: Record<string, string> = {
  available:   '#22c55e',
  maybe:       '#f59e0b',
  unavailable: '#ef4444',
}

interface KalenderViewProps {
  termine: Termin[]
  onSelectTermin: (id: number) => void
}

export default function KalenderView({ termine, onSelectTermin }: KalenderViewProps) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  // Build calendar grid
  const { days } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month + 1, 0)

    // Monday-based week: getDay() returns 0=Sun → map to 6, 1=Mon → 0, etc.
    const startOffset = (firstDay.getDay() + 6) % 7
    const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7

    const days: Array<{ date: Date | null; dateStr: string | null }> = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        days.push({ date: null, dateStr: null })
      } else {
        const d = new Date(year, month, dayNum)
        days.push({ date: d, dateStr: d.toISOString().slice(0, 10) })
      }
    }
    return { days }
  }, [year, month])

  // Group termine by date
  const termineByDate = useMemo(() => {
    const map: Record<string, Termin[]> = {}
    for (const t of termine) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return map
  }, [termine])

  const todayStr = today.toISOString().slice(0, 10)
  const monthLabel = new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div className="mt-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-base font-semibold text-gray-900 w-44 text-center capitalize">
          {monthLabel}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={goToToday}
          className="ml-2 text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Heute
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {termine.length} {termine.length === 1 ? 'Termin' : 'Termine'} im Filter
        </span>
      </div>

      {/* Grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-100">
            {week.map((cell, di) => {
              const isToday   = cell.dateStr === todayStr
              const isWeekend = di >= 5
              const events    = cell.dateStr ? (termineByDate[cell.dateStr] ?? []) : []
              const MAX_SHOW  = 3

              return (
                <div
                  key={di}
                  className={`min-h-[90px] p-1.5 flex flex-col border-b border-gray-100
                    ${!cell.date ? 'bg-gray-50' : isWeekend ? 'bg-orange-50/30' : 'bg-white'}
                  `}
                >
                  {/* Day number */}
                  {cell.date && (
                    <div className="flex items-center justify-end mb-1">
                      <span className={`
                        text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-gray-500'
                        }
                      `}>
                        {cell.date.getDate()}
                      </span>
                    </div>
                  )}

                  {/* Events */}
                  <div className="flex flex-col gap-0.5 flex-1">
                    {events.slice(0, MAX_SHOW).map(t => (
                      <button
                        key={t.id}
                        onClick={() => onSelectTermin(t.id)}
                        className="text-left rounded px-1 py-0.5 text-xs leading-tight truncate transition-opacity hover:opacity-80 cursor-pointer"
                        style={{
                          backgroundColor: (STATUS_COLOR[t.statusBooking ?? ''] ?? '#9ca3af') + '22',
                          borderLeft: `3px solid ${STATUS_COLOR[t.statusBooking ?? ''] ?? '#9ca3af'}`,
                          color: '#1f2937',
                        }}
                        title={[t.title, t.city, t.venueName].filter(Boolean).join(' · ')}
                      >
                        <span className="flex items-center gap-1">
                          {t.myAvailability && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: AVAIL_DOT[t.myAvailability] ?? '#9ca3af' }}
                            />
                          )}
                          <span className="truncate">
                            {t.title || t.city || '–'}
                          </span>
                        </span>
                      </button>
                    ))}
                    {events.length > MAX_SHOW && (
                      <span className="text-xs text-gray-400 pl-1">
                        +{events.length - MAX_SHOW} weitere
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(STATUS_COLOR).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-gray-400 ml-2 border-l pl-3">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Verfügbar
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1" /> Vielleicht
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1" /> Nicht verfügbar
        </span>
      </div>
    </div>
  )
}
