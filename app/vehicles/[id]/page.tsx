'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import { isAuthenticated } from '@/lib/api-client'
import { VehicleDetailContent } from '@/app/modules/vehicles/VehicleDetail'

export default function VehicleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = String(params.id)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  return (
    <AppShell activeTab="vehicles" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
      <VehicleDetailContent vehicleId={vehicleId} />
    </AppShell>
  )
}
