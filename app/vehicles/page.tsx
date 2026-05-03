'use client'
import { AppShell } from '@/app/components/shared/AppShell'
import VehiclesPage from '@/app/modules/vehicles/page'
export default function VehiclesRoute() {
  return <AppShell activeTab="vehicles" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}><VehiclesPage /></AppShell>
}
