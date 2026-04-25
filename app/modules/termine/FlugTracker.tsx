'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import type { TravelLeg } from '@/lib/api-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCode(location: string): string {
  if (!location) return '?'
  // Try to find 3-letter IATA airport code in the string
  const match = location.match(/\b([A-Z]{3})\b/)
  if (match) return match[1]
  return location.trim().slice(0, 3).toUpperCase()
}

function fmtTime(date: string, time: string): string {
  if (!time) return '–'
  return time.slice(0, 5)
}

function toMs(date: string, time: string): number | null {
  if (!date || !time) return null
  try { return new Date(`${date.slice(0, 10)}T${time}`).getTime() }
  catch { return null }
}

// IATA airline code → ICAO operator code (for OpenSky callsign lookup)
const IATA_TO_ICAO: Record<string, string> = {
  LH: 'DLH', FR: 'RYR', U2: 'EZY', EW: 'EWG',
  OS: 'AUA', LX: 'SWR', KL: 'KLM', AF: 'AFR', BA: 'BAW',
  IB: 'IBE', VY: 'VLG', W6: 'WZZ', DY: 'NAX', SK: 'SAS',
  TK: 'THY', AY: 'FIN', SN: 'BEL', TP: 'TAP',
  X3: 'TUI', DE: 'CFG', '4U': 'GWI', EN: 'DLA', HG: 'HAH',
}

function parseFlightNumber(raw: string): { iata: string; icao: string } {
  const iata = raw.replace(/\s+/g, '').toUpperCase()
  const op = iata.slice(0, 2)
  const num = iata.slice(2)
  const icaoOp = IATA_TO_ICAO[op]
  return { iata, icao: icaoOp ? `${icaoOp}${num}` : iata }
}

// ─── Live data via OpenSky Network (free, no API key needed) ──────────────────

interface LiveData {
  actualDeparture?: string // HH:MM
  actualArrival?: string   // HH:MM (firstSeen + duration estimate)
}

async function fetchFromOpenSky(
  fn: { iata: string; icao: string },
  depMs: number
): Promise<LiveData> {
  // OpenSky flights/all: max 2h window, returns all active flights in that interval
  const begin = Math.floor((depMs - 60 * 60_000) / 1000)
  const end = Math.floor((depMs + 60 * 60_000) / 1000)

  const res = await fetch(
    `https://opensky-network.org/api/flights/all?begin=${begin}&end=${end}`,
    { signal: AbortSignal.timeout(12_000) }
  )
  if (res.status === 400) throw new Error('OpenSky: Zeitfenster ungültig')
  if (!res.ok) throw new Error(`OpenSky: HTTP ${res.status}`)

  const flights: any[] = await res.json()

  // Match by IATA or ICAO callsign
  const match = flights.find(f => {
    const cs = (f.callsign ?? '').trim().toUpperCase()
    return cs === fn.iata || cs === fn.icao
  })

  if (!match) throw new Error('Flug nicht gefunden — eventuell noch zu früh oder Daten verzögert')

  const actualDeparture = match.firstSeen
    ? new Date(match.firstSeen * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : undefined
  const actualArrival = match.lastSeen
    ? new Date(match.lastSeen * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : undefined

  return { actualDeparture, actualArrival }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlugTracker({ leg }: { leg: TravelLeg }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fn = parseFlightNumber(leg.flightNumber)
  const depCode = extractCode(leg.departureLocation)
  const arrCode = extractCode(leg.arrivalLocation)

  const depMs = toMs(leg.departureDate, leg.departureTime)
  const arrMs = toMs(leg.arrivalDate, leg.arrivalTime)
  const now = Date.now()

  // Flight progress (0 = not yet departed, 1 = landed)
  let progress = 0
  let status: 'pending' | 'airborne' | 'landed' = 'pending'
  if (depMs && arrMs) {
    if (now < depMs) { progress = 0; status = 'pending' }
    else if (now > arrMs) { progress = 1; status = 'landed' }
    else { progress = (now - depMs) / (arrMs - depMs); status = 'airborne' }
  }

  // ─── SVG bezier plane position ─────────────────────────────────────────────
  const W = 260, H = 58, mx = 40
  const p0x = mx, p2x = W - mx, p1x = W / 2
  const p0y = H / 2 + 4, p2y = H / 2 + 4, p1y = H / 2 - 12

  const t = Math.max(0.02, Math.min(0.98, progress))
  const bx = (1-t)*(1-t)*p0x + 2*(1-t)*t*p1x + t*t*p2x
  const by = (1-t)*(1-t)*p0y + 2*(1-t)*t*p1y + t*t*p2y
  const dx = 2*(1-t)*(p1x - p0x) + 2*t*(p2x - p1x)
  const dy = 2*(1-t)*(p1y - p0y) + 2*t*(p2y - p1y)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI

  async function fetchLive() {
    if (!depMs) { setError('Kein Abflugzeitpunkt eingetragen'); return }
    setLoading(true)
    setError('')
    try {
      const data = await fetchFromOpenSky(fn, depMs)
      setLiveData(data)
    } catch (e: any) {
      setError(e.message ?? 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  const statusLabel =
    status === 'pending' ? '⏳ Noch nicht gestartet' :
    status === 'airborne' ? '✈ Im Flug' : '✓ Gelandet'

  const statusColor =
    status === 'pending' ? 'text-yellow-400' :
    status === 'airborne' ? 'text-green-400' : 'text-gray-400'

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="mt-2 rounded-lg bg-gray-900 text-white overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-xs font-mono font-bold text-blue-400 tracking-widest">{fn.iata}</span>
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Arc visualization */}
      <div className="px-2 -mb-1">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
          {/* Dashed flight path */}
          <path
            d={`M ${p0x} ${p0y} Q ${p1x} ${p1y} ${p2x} ${p2y}`}
            fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3"
          />
          {/* Departure dot */}
          <circle cx={p0x} cy={p0y} r="3" fill="#4b5563" />
          {/* Arrival dot */}
          <circle cx={p2x} cy={p2y} r="3" fill={status === 'landed' ? '#3b82f6' : '#4b5563'} />
          {/* Airport codes */}
          <text x={p0x} y={p0y + 12} textAnchor="middle" fontSize="8"
            fill="#6b7280" fontFamily="monospace" fontWeight="700">
            {depCode}
          </text>
          <text x={p2x} y={p2y + 12} textAnchor="middle" fontSize="8"
            fill="#6b7280" fontFamily="monospace" fontWeight="700">
            {arrCode}
          </text>
          {/* Plane icon at current position */}
          {depMs && arrMs && (
            <g transform={`translate(${bx},${by}) rotate(${angle})`}>
              <text
                x="0" y="0"
                textAnchor="middle" dominantBaseline="middle"
                fontSize="14"
                style={{ userSelect: 'none' }}
              >✈</text>
            </g>
          )}
        </svg>
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-2 divide-x divide-gray-700 border-t border-gray-700 mx-3 mt-2 mb-1 text-xs">
        <div className="pr-3 py-2">
          <div className="text-gray-500 mb-0.5">Abflug geplant</div>
          <div className="font-mono text-white">{fmtTime(leg.departureDate, leg.departureTime)}</div>
          {liveData?.actualDeparture != null && (
            <>
              <div className="text-gray-500 mt-1.5 mb-0.5">Abflug tatsächlich</div>
              <div className="font-mono text-green-400">{liveData.actualDeparture}</div>
            </>
          )}
        </div>
        <div className="pl-3 py-2">
          <div className="text-gray-500 mb-0.5">Ankunft geplant</div>
          <div className="font-mono text-white">{fmtTime(leg.arrivalDate, leg.arrivalTime)}</div>
          {liveData?.actualArrival != null && (
            <>
              <div className="text-gray-500 mt-1.5 mb-0.5">Ankunft tatsächlich</div>
              <div className="font-mono text-green-400">{liveData.actualArrival}</div>
            </>
          )}
        </div>
      </div>

      {/* Live fetch */}
      <div className="px-3 pb-2.5">
        {error && (
          <div className="flex items-center gap-1 text-xs text-red-400 mb-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" />{error}
          </div>
        )}
        <button
          onClick={fetchLive}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          {liveData ? 'Aktualisieren' : 'Live-Daten abrufen (OpenSky)'}
        </button>
      </div>
    </div>
  )
}
