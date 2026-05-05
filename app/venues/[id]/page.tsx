'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import { isAuthenticated } from '@/lib/api-client'
import { VenueDetailContent } from '@/app/modules/venues/VenueDetail'

export default function VenueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const venueId = String(params.id)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  return (
    <AppShell activeTab="venues" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
      <VenueDetailContent venueId={venueId} />
    </AppShell>
  )
}
