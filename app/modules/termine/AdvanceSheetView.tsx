'use client'

import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { API_BASE, getAuthToken, getCurrentTenant } from '@/lib/api-client'

const SECTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'show',        label: 'Veranstaltung',   desc: 'Datum, Titel, Art, Status' },
  { key: 'venue',       label: 'Spielstätte',      desc: 'Adresse, Kapazität, Bühne, Parken' },
  { key: 'partner',     label: 'Partner',           desc: 'Veranstalter / Booking' },
  { key: 'contacts',    label: 'Lokale Kontakte',   desc: 'Ansprechpartner vor Ort' },
  { key: 'schedules',   label: 'Zeitpläne',         desc: 'Alle Tagesabläufe' },
  { key: 'travel',      label: 'Anreise / Abreise', desc: 'Alle Reiselegs inkl. Mitreisende' },
  { key: 'hotel',       label: 'Hotel',             desc: 'Hotelbelegung mit Zimmern' },
  { key: 'travelparty', label: 'Reisegruppe',       desc: 'Alle Crew-Mitglieder mit Funktionen' },
  { key: 'catering',    label: 'Catering',          desc: 'Art, Kontakt, Bestellungen' },
  { key: 'todos',       label: 'Aufgaben',          desc: 'Offene TODOs (ohne erledigte)' },
]

interface Props {
  terminId: number
}

export default function AdvanceSheetView({ terminId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SECTIONS.map(s => s.key))
  )
  const [loading, setLoading] = useState(false)

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(SECTIONS.map(s => s.key)))
  const clearAll  = () => setSelected(new Set())

  const openPdf = () => {
    const token  = getAuthToken()
    const tenant = getCurrentTenant() as { slug: string } | null
    if (!token || !tenant?.slug) {
      alert('Nicht angemeldet.')
      return
    }
    if (selected.size === 0) {
      alert('Bitte mindestens einen Abschnitt auswählen.')
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    params.set('token',    token)
    params.set('tenant',   tenant.slug)
    params.set('sections', Array.from(selected).join(','))
    const url = `${API_BASE}/api/termine/${terminId}/advance-sheet/pdf?${params}`
    const win = window.open(url, '_blank')
    // Reset loading after a moment (PDF opens in new tab)
    setTimeout(() => setLoading(false), 1500)
    if (!win) {
      alert('Popup wurde blockiert. Bitte Popups für diese Seite erlauben.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-6 md:px-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">Advance Sheet</span>
          <span className="ml-auto text-xs text-gray-400">PDF-Export</span>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Quick-select */}
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={selectAll}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Alle auswählen
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={clearAll}
              className="text-gray-400 hover:text-gray-600"
            >
              Alle abwählen
            </button>
            <span className="ml-auto text-gray-400">
              {selected.size} von {SECTIONS.length} Abschnitten
            </span>
          </div>

          {/* Section checkboxes */}
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <label
                key={s.key}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selected.has(s.key)
                    ? 'bg-blue-50 border border-blue-200'
                    : 'border border-transparent hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.key)}
                  onChange={() => toggle(s.key)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Generate button */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={openPdf}
              disabled={loading || selected.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download size={16} />
              {loading ? 'Wird generiert…' : 'PDF generieren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
