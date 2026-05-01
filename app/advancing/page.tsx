'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTermine, isAuthenticated } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'

const ADVANCING_LAST_KEY = 'pt_advancing_last_id'

export default function AdvancingPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    async function redirect() {
      // 1. Letzten geöffneten Termin aus localStorage
      const lastId = localStorage.getItem(ADVANCING_LAST_KEY)
      if (lastId) {
        router.replace(`/advancing/${lastId}/details`)
        return
      }

      // 2. Nächsten anstehenden Termin ermitteln
      try {
        const termine = await getTermine()
        const today = new Date().toISOString().slice(0, 10)
        const sorted = [...termine].sort((a, b) => a.date.localeCompare(b.date))
        const next = sorted.find(t => t.date >= today)
        if (next) {
          router.replace(`/advancing/${next.id}/details`)
          return
        }
        // Kein zukünftiger Termin → letzten verfügbaren
        if (sorted.length > 0) {
          router.replace(`/advancing/${sorted[sorted.length - 1].id}/details`)
          return
        }
      } catch {
        // Kein Termin gefunden → zurück zur SPA
      }

      // Fallback
      window.location.href = '/?tab=appointments'
    }

    redirect()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  )
}
