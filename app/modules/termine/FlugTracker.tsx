'use client'

// NOTE (Dark Mode): Diese Komponente ist bewusst hell gestylt.
// Beim Dark Mode: Klassen anpassen oder in zwei Varianten splitten.
// Eintrag in OPEN_QUESTIONS.md → "FlugTracker: Dark-Mode-Version"

import { useState } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { getAuthToken, getCurrentTenant, type TravelLeg } from '@/lib/api-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = getAuthToken()
  const tenant = getCurrentTenant()
  if (token) h['Authorization'] = `Bearer ${token}`
  if (tenant?.slug) h['X-Tenant-Slug'] = tenant.slug
  return h
}

function extractCode(location: string): string {
  if (!location) return '?'
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

// IATA → ICAO operator code mapping
const IATA_TO_ICAO: Record<string, string> = {
  LH: 'DLH', FR: 'RYR', U2: 'EZY', EW: 'EWG',
  OS: 'AUA', LX: 'SWR', KL: 'KLM', AF: 'AFR', BA: 'BAW',
  IB: 'IBE', VY: 'VLG', W6: 'WZZ', DY: 'NAX', SK: 'SAS',
  TK: 'THY', AY: 'FIN', SN: 'BEL', TP: 'TAP',
  X3: 'TUI', DE: 'CFG', '4U': 'GWI', EN: 'DLA',
}

function parseFlightNumber(raw: string): { iata: string; icao: string } {
  const iata = raw.replace(/\s+/g, '').toUpperCase()
  const op = iata.slice(0, 2)
  const num = iata.slice(2)
  const icaoOp = IATA_TO_ICAO[op]
  return { iata, icao: icaoOp ? `${icaoOp}${num}` : iata }
}

interface LiveData {
  actualDeparture?: string
  actualArrival?: string
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

  let progress = 0
  let status: 'pending' | 'airborne' | 'landed' = 'pending'
  if (depMs && arrMs) {
    if (now < depMs) { progress = 0; status = 'pending' }
    else if (now > arrMs) { progress = 1; status = 'landed' }
    else { progress = (now - depMs) / (arrMs - depMs); status = 'airborne' }
  }

  // SVG bezier plane position
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
      const begin = Math.floor((depMs - 60 * 60_000) / 1000)
      const end = Math.floor((depMs + 60 * 60_000) / 1000)
      const res = await fetch(
        `${API_BASE}/api/flights/live?begin=${begin}&end=${end}`,
        { headers: authHeaders(), signal: AbortSignal.timeout(15_000) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const flights: any[] = await res.json()
      const match = flights.find(f => {
        const cs = (f.callsign ?? '').trim().toUpperCase()
        return cs === fn.iata || cs === fn.icao
      })
      if (!match) throw new Error('Flug nicht gefunden — eventuell noch keine Daten verfügbar')
      setLiveData({
        actualDeparture: match.firstSeen
          ? new Date(match.firstSeen * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : undefined,
        actualArrival: match.lastSeen
          ? new Date(match.lastSeen * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : undefined,
      })
    } catch (e: any) {
      setError(e.message ?? 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  const statusLabel =
    status === 'pending' ? 'Noch nicht gestartet' :
    status === 'airborne' ? 'Im Flug' : 'Gelandet'
  const statusColor =
    status === 'pending' ? '#b45309' :
    status === 'airborne' ? '#15803d' : '#6b7280'

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        marginTop: '0.5rem',
        borderRadius: '0.5rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        fontSize: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem 0' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', letterSpacing: '0.1em' }}>
          {fn.iata}
        </span>
        <span style={{ fontWeight: 500, color: statusColor, fontSize: '11px' }}>
          {status === 'airborne' ? '✈ ' : ''}{statusLabel}
        </span>
      </div>

      {/* Arc visualization */}
      <div style={{ padding: '0 0.5rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', display: 'block' }}>
          {/* Dashed flight path */}
          <path
            d={`M ${p0x} ${p0y} Q ${p1x} ${p1y} ${p2x} ${p2y}`}
            fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3"
          />
          {/* Departure dot */}
          <circle cx={p0x} cy={p0y} r="3" fill="#94a3b8" />
          {/* Arrival dot */}
          <circle cx={p2x} cy={p2y} r="3" fill={status === 'landed' ? '#2563eb' : '#94a3b8'} />
          {/* Airport codes */}
          <text x={p0x} y={p0y + 12} textAnchor="middle" fontSize="8"
            fill="#64748b" fontFamily="monospace" fontWeight="700">
            {depCode}
          </text>
          <text x={p2x} y={p2y + 12} textAnchor="middle" fontSize="8"
            fill="#64748b" fontFamily="monospace" fontWeight="700">
            {arrCode}
          </text>
          {/* Plane at current position */}
          {depMs && arrMs && (
            <g transform={`translate(${bx},${by}) rotate(${angle})`}>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle"
                fontSize="14" style={{ userSelect: 'none' }}>✈</text>
            </g>
          )}
        </svg>
      </div>

      {/* Time grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid #e2e8f0',
        margin: '0.25rem 0.75rem 0',
      }}>
        <div style={{ paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>Abflug geplant</div>
          <div style={{ fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}>
            {fmtTime(leg.departureDate, leg.departureTime)}
          </div>
          {liveData?.actualDeparture != null && <>
            <div style={{ color: '#94a3b8', marginTop: '6px', marginBottom: '2px' }}>Abflug tatsächlich</div>
            <div style={{ fontFamily: 'monospace', color: '#15803d', fontWeight: 600 }}>{liveData.actualDeparture}</div>
          </>}
        </div>
        <div style={{ paddingLeft: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>Ankunft geplant</div>
          <div style={{ fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}>
            {fmtTime(leg.arrivalDate, leg.arrivalTime)}
          </div>
          {liveData?.actualArrival != null && <>
            <div style={{ color: '#94a3b8', marginTop: '6px', marginBottom: '2px' }}>Ankunft tatsächlich</div>
            <div style={{ fontFamily: 'monospace', color: '#15803d', fontWeight: 600 }}>{liveData.actualArrival}</div>
          </>}
        </div>
      </div>

      {/* Live fetch button */}
      <div style={{ padding: '0.4rem 0.75rem 0.6rem' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', marginBottom: '4px' }}>
            <AlertCircle style={{ width: 11, height: 11, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={fetchLive}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            color: '#2563eb', background: 'none', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1, padding: 0, fontSize: '11px',
          }}
        >
          {loading
            ? <Loader2 style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
            : <RefreshCw style={{ width: 11, height: 11 }} />}
          {liveData ? 'Aktualisieren' : 'Live-Daten abrufen (OpenSky)'}
        </button>
      </div>
    </div>
  )
}
