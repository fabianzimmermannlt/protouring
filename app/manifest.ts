import type { MetadataRoute } from 'next'

// Wird von Next.js unter /manifest.webmanifest ausgeliefert.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ProTouring – Tour Management',
    short_name: 'ProTouring',
    description: 'Tour-Management für Artists und Agenturen',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'de',
    background_color: '#0a1026',
    theme_color: '#111827',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
