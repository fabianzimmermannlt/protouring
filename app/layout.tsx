import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ModalScrollReset } from '@/app/components/shared/ModalScrollReset'
import { ServiceWorkerRegister } from '@/app/components/shared/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ProTouring - Professional Tour Management',
  description: 'Comprehensive tour management platform for artists and agencies',
  applicationName: 'ProTouring',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black', title: 'ProTouring' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="dark">
      <body className={inter.className}>
        {/* No-Flash: gespeicherte Theme-Wahl vor dem ersten Zeichnen anwenden.
            Default = dunkel (bis der Hell-Modus vollständig migriert ist). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pt-theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
        <ServiceWorkerRegister />
        <ModalScrollReset />
        {children}
      </body>
    </html>
  )
}
