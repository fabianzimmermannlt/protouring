/**
 * Geoapify Geocoding Autocomplete helper
 * Kostenlos: 3.000 Anfragen/Tag, kein Kreditkarte erforderlich
 * Account: https://myprojects.geoapify.com/
 * Benötigt NEXT_PUBLIC_GEOAPIFY_KEY in .env.local
 */

export interface GeoapifyFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    state?: string
    country?: string
    formatted?: string
    address_line1?: string
    address_line2?: string
    lat?: number
    lon?: number
    result_type?: string
  }
}

export function buildGeoapifyUrl(query: string, limit = 6, lang = 'de'): string {
  const key = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || 'fd5eb442dd624f3d912f16d0491e0232'
  if (!key) return ''

  const params = new URLSearchParams({
    text: query,
    lang,
    limit: String(limit),
    // Weicher Bias: Mitte Deutschland
    bias: 'proximity:10.5,51.2',
    // Touring-relevante Länder
    filter: 'countrycode:de,at,ch,fr,nl,be,gb,dk,no,se,pl,cz,it,es,pt',
    apiKey: key,
  })
  return `https://api.geoapify.com/v1/geocode/autocomplete?${params}`
}

export function parseGeoapifyFeature(f: GeoapifyFeature) {
  const p = f.properties
  const name = p.name || ''
  const street = p.street
    ? p.housenumber
      ? `${p.street} ${p.housenumber}`
      : p.street
    : ''

  return {
    name,
    street,
    postalCode: p.postcode || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    latitude: String(f.geometry.coordinates[1]),
    longitude: String(f.geometry.coordinates[0]),
  }
}
