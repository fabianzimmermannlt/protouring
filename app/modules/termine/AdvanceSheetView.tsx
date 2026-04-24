'use client'

import { useState, useRef } from 'react'
import { FileText, Download, Users, GripVertical } from 'lucide-react'
import { API_BASE, getAuthToken, getCurrentTenant } from '@/lib/api-client'

// ── Advance Sheet ─────────────────────────────────────────────────────────────

const ADVANCE_SECTIONS_DEFAULT: { key: string; label: string; desc: string }[] = [
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

// ── Call Sheet ────────────────────────────────────────────────────────────────

const CALL_SECTIONS_DEFAULT: { key: string; label: string; desc: string }[] = [
  { key: 'travelparty', label: 'Reisegruppe',       desc: 'Wer ist dabei, mit Funktionen' },
  { key: 'schedules',   label: 'Zeitpläne',         desc: 'Tagesablauf / Daysheet' },
  { key: 'travel',      label: 'Anreise / Abreise', desc: 'Abfahrtszeiten, Fahrzeuge, Mitreisende' },
  { key: 'hotel',       label: 'Hotel',             desc: 'Wo schlafen wir, Zimmerbelegung' },
  { key: 'catering',    label: 'Catering',          desc: 'Essen, Buyout, Bestellungen' },
  { key: 'contacts',    label: 'Lokale Kontakte',   desc: 'Ansprechpartner vor Ort' },
]

type Section = { key: string; label: string; desc: string }

interface Props {
  terminId: number
}

export default function AdvanceSheetView({ terminId }: Props) {
  const [activeTab, setActiveTab] = useState<'advance' | 'callsheet'>('advance')

  const [advanceSections, setAdvanceSections] = useState<Section[]>(ADVANCE_SECTIONS_DEFAULT)
  const [callSections,    setCallSections]    = useState<Section[]>(CALL_SECTIONS_DEFAULT)
  const [advanceSel, setAdvanceSel] = useState<Set<string>>(new Set(ADVANCE_SECTIONS_DEFAULT.map(s => s.key)))
  const [callSel,    setCallSel]    = useState<Set<string>>(new Set(CALL_SECTIONS_DEFAULT.map(s => s.key)))
  const [loading, setLoading]       = useState(false)

  const sections    = activeTab === 'advance' ? advanceSections : callSections
  const setSections = activeTab === 'advance' ? setAdvanceSections : setCallSections
  const selected    = activeTab === 'advance' ? advanceSel : callSel
  const setSelected = activeTab === 'advance' ? setAdvanceSel : setCallSel
  const accentClass = activeTab === 'advance' ? 'border-blue-600 text-blue-600' : 'border-green-700 text-green-700'
  const checkedClass = activeTab === 'advance' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
  const btnClass    = activeTab === 'advance' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-700 hover:bg-green-800'
  const accentColor = activeTab === 'advance' ? 'accent-blue-600' : 'accent-green-700'

  const toggle    = (key: string) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const selectAll  = () => setSelected(new Set(sections.map(s => s.key)))
  const clearAll   = () => setSelected(new Set())

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const onDragStart = (i: number) => { dragIdx.current = i }
  const onDragEnter = (i: number) => { if (dragIdx.current !== i) setDragOver(i) }
  const onDragEnd   = () => { dragIdx.current = null; setDragOver(null) }

  const onDrop = (targetIdx: number) => {
    const from = dragIdx.current
    if (from === null || from === targetIdx) { setDragOver(null); return }
    setSections(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
    dragIdx.current = null
    setDragOver(null)
  }

  // ── PDF öffnen ────────────────────────────────────────────────────────────────
  const openPdf = () => {
    const token  = getAuthToken()
    const tenant = getCurrentTenant() as { slug: string } | null
    if (!token || !tenant?.slug) { alert('Nicht angemeldet.'); return }
    if (selected.size === 0) { alert('Bitte mindestens einen Abschnitt auswählen.'); return }
    setLoading(true)
    const params = new URLSearchParams()
    params.set('token',    token)
    params.set('tenant',   tenant.slug)
    // Reihenfolge aus sections (nur ausgewählte, in der aktuellen Reihenfolge)
    const orderedSelected = sections.filter(s => selected.has(s.key)).map(s => s.key)
    params.set('sections', orderedSelected.join(','))
    const endpoint = activeTab === 'advance'
      ? `/api/termine/${terminId}/advance-sheet/pdf`
      : `/api/termine/${terminId}/call-sheet/pdf`
    const win = window.open(`${API_BASE}${endpoint}?${params}`, '_blank')
    setTimeout(() => setLoading(false), 1500)
    if (!win) { alert('Popup wurde blockiert. Bitte Popups für diese Seite erlauben.'); setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto pb-6 md:px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('advance')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'advance' ? accentClass : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <FileText size={15} /> Advance Sheet
          </button>
          <button onClick={() => setActiveTab('callsheet')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'callsheet' ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Users size={15} /> Call Sheet
          </button>
          <span className="ml-auto self-center pr-4 text-xs text-gray-400">PDF-Export</span>
        </div>

        {/* Description */}
        <div className="px-5 pt-3 pb-1">
          <p className="text-xs text-gray-400">
            {activeTab === 'advance'
              ? 'Für Spielstätten & Veranstalter — alle relevanten Show-Informationen.'
              : 'Für die Crew — wer, wann, wo: Zeitplan, Anreise, Hotel, Catering.'}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Quick-select */}
          <div className="flex items-center gap-3 text-xs">
            <button onClick={selectAll} className="text-blue-600 hover:text-blue-800 font-medium">Alle auswählen</button>
            <span className="text-gray-300">·</span>
            <button onClick={clearAll} className="text-gray-400 hover:text-gray-600">Alle abwählen</button>
            <span className="ml-auto text-gray-400">{selected.size} von {sections.length} · Reihenfolge per Drag</span>
          </div>

          {/* Section list — draggable */}
          <div className="space-y-1">
            {sections.map((s, i) => (
              <div
                key={s.key}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={onDragEnd}
                className={`flex items-start gap-2 px-2 py-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-all select-none border ${
                  dragOver === i
                    ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
                    : selected.has(s.key)
                    ? checkedClass
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                {/* Drag handle */}
                <div className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab">
                  <GripVertical size={16} />
                </div>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(s.key)}
                  onChange={() => toggle(s.key)}
                  onClick={e => e.stopPropagation()}
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 ${accentColor}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Generate button */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={openPdf}
              disabled={loading || selected.size === 0}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors ${btnClass}`}
            >
              <Download size={16} />
              {loading ? 'Wird generiert…' : `${activeTab === 'advance' ? 'Advance Sheet' : 'Call Sheet'} generieren`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
