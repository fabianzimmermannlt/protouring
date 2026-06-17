'use client'

import { useState, useEffect } from 'react'
import { Loader2, CloudSun } from 'lucide-react'

// Wetter-Kachel für den Showtag — stündlich, via Open-Meteo (kostenlos, kein API-Key).
// Forecast reicht ~16 Tage in die Zukunft → ab ~14 Tagen vor dem Event verfügbar.
// Niederschlag in mm entspricht l/m².

interface WeatherCardProps {
  date: string                    // Showtag (ISO oder YYYY-MM-DD)
  lat?: number | null
  lon?: number | null
  locationQuery?: string          // Fallback-Geocoding, z.B. "10115 Berlin Deutschland"
  locationLabel?: string
}

const WMO: Record<number, { icon: string; label: string }> = {
  0:  { icon: '☀️', label: 'Klar' },
  1:  { icon: '🌤️', label: 'Überwiegend klar' },
  2:  { icon: '⛅', label: 'Teils bewölkt' },
  3:  { icon: '☁️', label: 'Bewölkt' },
  45: { icon: '🌫️', label: 'Nebel' },
  48: { icon: '🌫️', label: 'Reifnebel' },
  51: { icon: '🌦️', label: 'Leichter Niesel' },
  53: { icon: '🌦️', label: 'Niesel' },
  55: { icon: '🌦️', label: 'Starker Niesel' },
  56: { icon: '🌧️', label: 'Gefrierender Niesel' },
  57: { icon: '🌧️', label: 'Gefrierender Niesel' },
  61: { icon: '🌧️', label: 'Leichter Regen' },
  63: { icon: '🌧️', label: 'Regen' },
  65: { icon: '🌧️', label: 'Starker Regen' },
  66: { icon: '🌧️', label: 'Gefrierender Regen' },
  67: { icon: '🌧️', label: 'Gefrierender Regen' },
  71: { icon: '🌨️', label: 'Leichter Schnee' },
  73: { icon: '🌨️', label: 'Schnee' },
  75: { icon: '❄️', label: 'Starker Schnee' },
  77: { icon: '❄️', label: 'Schneegriesel' },
  80: { icon: '🌦️', label: 'Leichte Schauer' },
  81: { icon: '🌧️', label: 'Schauer' },
  82: { icon: '⛈️', label: 'Starke Schauer' },
  85: { icon: '🌨️', label: 'Schneeschauer' },
  86: { icon: '❄️', label: 'Starke Schneeschauer' },
  95: { icon: '⛈️', label: 'Gewitter' },
  96: { icon: '⛈️', label: 'Gewitter mit Hagel' },
  99: { icon: '⛈️', label: 'Gewitter mit Hagel' },
}
const wmo = (c: number) => WMO[c] ?? { icon: '·', label: '' }

interface HourRow { time: string; temp: number; prob: number | null; precip: number; code: number; wind: number; gust: number }

export default function WeatherCard({ date, lat, lon, locationQuery, locationLabel }: WeatherCardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hours, setHours] = useState<HourRow[]>([])

  const dateOnly = (date || '').slice(0, 10)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setError(null); setHours([])
      if (!dateOnly) { setError('Kein Datum hinterlegt.'); setLoading(false); return }

      const target = new Date(dateOnly + 'T12:00:00')
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
      if (diffDays > 16) { setError(`Vorhersage erst ab ~16 Tagen vor dem Event (noch ${diffDays} Tage).`); setLoading(false); return }
      if (diffDays < -1) { setError('Event liegt in der Vergangenheit – keine Vorhersage.'); setLoading(false); return }

      try {
        let la = (lat != null && !Number.isNaN(lat)) ? lat : null
        let lo = (lon != null && !Number.isNaN(lon)) ? lon : null
        if ((la == null || lo == null) && locationQuery?.trim()) {
          const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery.trim())}&count=1&language=de&format=json`).then(r => r.json())
          if (geo?.results?.[0]) { la = geo.results[0].latitude; lo = geo.results[0].longitude }
        }
        if (la == null || lo == null) { if (!cancelled) { setError('Kein Ort/Koordinaten für das Event hinterlegt.'); setLoading(false) } return }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}`
          + `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m`
          + `&timezone=auto&start_date=${dateOnly}&end_date=${dateOnly}`
        const data = await fetch(url).then(r => r.json())
        const h = data?.hourly
        if (!h?.time) { if (!cancelled) { setError('Keine Wetterdaten verfügbar.'); setLoading(false) } return }

        const rows: HourRow[] = h.time.map((t: string, i: number) => ({
          time: t.slice(11, 16),
          temp: Math.round(h.temperature_2m?.[i] ?? 0),
          prob: h.precipitation_probability?.[i] ?? null,
          precip: h.precipitation?.[i] ?? 0,
          code: h.weather_code?.[i] ?? 0,
          wind: Math.round(h.wind_speed_10m?.[i] ?? 0),
          gust: Math.round(h.wind_gusts_10m?.[i] ?? 0),
        }))
        if (!cancelled) { setHours(rows); setLoading(false) }
      } catch {
        if (!cancelled) { setError('Wetter konnte nicht geladen werden.'); setLoading(false) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [dateOnly, lat, lon, locationQuery])

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CloudSun className="w-4 h-4" /> WETTER
        </span>
        {locationLabel && <span className="text-xs text-gray-500 truncate" style={{ marginLeft: 'auto', maxWidth: '50%' }}>{locationLabel}</span>}
      </div>
      <div className="pt-card-body">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Lade Wetter…</div>
        ) : error ? (
          <div className="text-xs text-gray-400 py-3">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
                {hours.map(hr => (
                  <div key={hr.time} className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg"
                    style={{ background: '#2a2a2a', minWidth: 50 }} title={wmo(hr.code).label}>
                    <span className="text-gray-400" style={{ fontSize: 10 }}>{hr.time}</span>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{wmo(hr.code).icon}</span>
                    <span className="font-semibold text-gray-200 text-xs">{hr.temp}°</span>
                    <span className="text-blue-400" style={{ fontSize: 10 }}>{hr.prob != null ? `${hr.prob}%` : '–'}</span>
                    <span className="text-gray-500" style={{ fontSize: 10 }}>{hr.precip > 0 ? `${hr.precip.toFixed(1)}` : '–'}</span>
                    <span className="text-gray-300" style={{ fontSize: 10 }}>💨{hr.wind}</span>
                    <span className="text-gray-500" style={{ fontSize: 9 }}>⇡{hr.gust}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-gray-500" style={{ fontSize: 10 }}>
              <span>°C</span>
              <span className="text-blue-400">% Regenwahrsch.</span>
              <span>mm = l/m²</span>
              <span>💨 Wind · ⇡ Böen (km/h)</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
