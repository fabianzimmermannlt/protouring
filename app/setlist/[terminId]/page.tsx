'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/api-client'
import SetlistShowView from '@/app/modules/termine/SetlistShowView'

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
  return <SetlistShowView terminId={terminId} />
}
