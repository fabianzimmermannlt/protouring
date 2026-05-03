'use client'

import { AppShell } from '@/app/components/shared/AppShell'
import VenuesPage from '@/app/modules/venues/page'

export default function VenuesRoute() {
  function handleTabChange(tab: string) {
    window.location.href = `/?tab=${tab}`
  }

  return (
    <AppShell activeTab="venues" onTabChange={handleTabChange}>
      <VenuesPage />
    </AppShell>
  )
}
