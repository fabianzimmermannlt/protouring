import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ModalScrollReset } from '@/app/components/shared/ModalScrollReset'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ProTouring - Professional Tour Management',
  description: 'Comprehensive tour management platform for artists and agencies',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ModalScrollReset />
        {children}
      </body>
    </html>
  )
}
