'use client'
import { AppShell } from '@/app/components/shared/AppShell'
import HotelsPage from '@/app/modules/hotels/page'
export default function HotelsRoute() {
  return <AppShell activeTab="hotels" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}><HotelsPage /></AppShell>
}
