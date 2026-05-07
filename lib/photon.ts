/**
 * Photon (Komoot) geocoder helper
 * Adds soft location bias based on browser timezone — no permission required.
 */

const TIMEZONE_COORDS: Record<string, [number, number]> = {
  'Europe/Berlin':    [51.2, 10.5],
  'Europe/Vienna':    [47.7, 13.3],
  'Europe/Zurich':    [47.0,  8.3],
  'Europe/London':    [51.5, -0.1],
  'Europe/Paris':     [48.9,  2.3],
  'Europe/Amsterdam': [52.4,  4.9],
  'Europe/Brussels':  [50.8,  4.4],
  'Europe/Prague':    [50.1, 14.4],
  'Europe/Warsaw':    [52.2, 21.0],
  'Europe/Stockholm': [59.3, 18.1],
  'Europe/Copenhagen':[55.7, 12.6],
  'Europe/Oslo':      [59.9, 10.8],
  'Europe/Helsinki':  [60.2, 24.9],
  'Europe/Rome':      [41.9, 12.5],
  'Europe/Madrid':    [40.4, -3.7],
  'Europe/Lisbon':    [38.7, -9.1],
  'America/New_York': [40.7,-74.0],
  'America/Chicago':  [41.9,-87.6],
  'America/Los_Angeles':[34.1,-118.2],
  'America/Toronto':  [43.7,-79.4],
  'Australia/Sydney': [-33.9,151.2],
}

function getBiasCoords(): [number, number] | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (TIMEZONE_COORDS[tz]) return TIMEZONE_COORDS[tz]
    // Fallback: match by prefix (e.g. "Europe/*" → center of Europe)
    const prefix = tz.split('/')[0]
    if (prefix === 'Europe') return [50.0, 10.0]
    if (prefix === 'America') return [40.0, -95.0]
    if (prefix === 'Asia') return [35.0, 105.0]
  } catch {}
  return null
}

export function buildPhotonUrl(query: string, limit = 6, lang = 'de'): string {
  const bias = getBiasCoords()
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lang,
  })
  if (bias) {
    params.set('lat', String(bias[0]))
    params.set('lon', String(bias[1]))
  }
  return `https://photon.komoot.io/api/?${params}`
}
