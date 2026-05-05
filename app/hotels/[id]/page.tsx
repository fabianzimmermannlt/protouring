'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import { isAuthenticated } from '@/lib/api-client'
import { HotelDetailContent } from '@/app/modules/hotels/HotelDetail'

export default function HotelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const hotelId = String(params.id)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  return (
    <AppShell activeTab="hotels" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
      <HotelDetailContent hotelId={hotelId} />
    </AppShell>
  )
}
