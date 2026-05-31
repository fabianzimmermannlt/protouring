/**
 * Mapbox Geocoding v5 helper
 * Sucht nach POIs (Hotels, Venues) + Adressen mit DACH+Europa-Bias.
 * Benötigt NEXT_PUBLIC_MAPBOX_TOKEN in .env.local
 */

export interface MapboxFeature {
  geometry: { coordinates: [number, number] }
  place_name: string
  text: string
  properties: { address?: string; category?: string }
  context?: Array<{ id: string; text: string; short_code?: string }>
}

export function buildMapboxUrl(query: string, limit = 6, lang = 'de'): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return ''

  const params = new URLSearchParams({
    access_token: token,
    language: lang,
    limit: String(limit),
    types: 'poi,address',
    // Weicher Bias: Mitte Deutschland
    proximity: '10.5,51.2',
    // Touring-relevante Länder
    country: 'de,at,ch,fr,nl,be,gb,dk,no,se,pl,cz,it,es,pt',
  })
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
}

export function parseMapboxFeature(f: MapboxFeature) {
  const name = f.text || ''
  // Bei POIs steckt die Straße in properties.address
  const street = f.properties?.address || ''

  let postalCode = ''
  let city = ''
  let state = ''
  let country = ''

  for (const ctx of f.context ?? []) {
    if (ctx.id.startsWith('postcode')) postalCode = ctx.text
    else if (ctx.id.startsWith('place'))   city     = ctx.text
    else if (ctx.id.startsWith('region'))  state    = ctx.text
    else if (ctx.id.startsWith('country')) country  = ctx.text
  }

  return {
    name,
    street,
    postalCode,
    city,
    state,
    country,
    latitude:  String(f.geometry.coordinates[1]),
    longitude: String(f.geometry.coordinates[0]),
  }
}
