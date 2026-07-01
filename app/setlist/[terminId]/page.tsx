'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import { isAuthenticated } from '@/lib/api-client'
import SetlistView from '@/app/modules/termine/SetlistView'

export default function StandaloneSetlistPage() {
  const params = useParams()
  const router = useRouter()
  const terminId = parseInt(params.terminId as string)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    setReady(true)
  }, [router])

  if (!ready) return <div className="min-h-screen bg-gray-950" />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-900 px-5 h-12 flex items-center gap-2">
        <span className="h-7 w-7 bg-orange-500 rounded-full flex items-center justify-center">
          <Music className="h-4 w-4 text-white" />
        </span>
        <span className="font-semibold text-white">ProTouring · Setlist</span>
      </header>
      <div className="p-4">
        <SetlistView terminId={terminId} standalone autoFullscreen />
      </div>
    </div>
  )
}
