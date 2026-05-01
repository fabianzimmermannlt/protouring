'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTermine, isAuthenticated } from '@/lib/api-client'
import { AppShell } from '@/app/components/shared/AppShell'
import { Loader2, ClipboardList } from 'lucide-react'

const ADVANCING_LAST_KEY = 'pt_advancing_last_id'

export default function AdvancingPage() {
  const router = useRouter()
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    async function redirect() {
      // 1. Letzten geöffneten Termin aus localStorage
      const lastId = localStorage.getItem(ADVANCING_LAST_KEY)
      if (lastId) {
        router.replace(`/advancing/${lastId}/details2`)
        return
      }

      // 2. Nächsten anstehenden Termin ermitteln
      try {
        const termine = await getTermine()
        const today = new Date().toISOString().slice(0, 10)
        const sorted = [...termine].sort((a, b) => a.date.localeCompare(b.date))
        const next = sorted.find(t => t.date >= today) ?? sorted[sorted.length - 1]
        if (next) {
          router.replace(`/advancing/${next.id}/details2`)
          return
        }
      } catch {
        // ignore
      }

      // Keine Termine → leeren State anzeigen
      setEmpty(true)
    }

    redirect()
  }, [router])

  if (empty) {
    return (
      <AppShell activeTab="advancing" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
          <ClipboardList className="w-10 h-10 text-gray-300" />
          <p className="text-gray-400 text-sm">Noch keine Termine vorhanden.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  )
}
