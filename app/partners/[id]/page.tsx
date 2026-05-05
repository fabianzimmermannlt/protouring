'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import { isAuthenticated } from '@/lib/api-client'
import { PartnerDetailContent } from '@/app/modules/partners/PartnerDetail'

export default function PartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const partnerId = String(params.id)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  return (
    <AppShell activeTab="partners" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
      <PartnerDetailContent partnerId={partnerId} />
    </AppShell>
  )
}
