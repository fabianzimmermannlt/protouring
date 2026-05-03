'use client'
import { AppShell } from '@/app/components/shared/AppShell'
import PartnersPage from '@/app/modules/partners/page'
export default function PartnersRoute() {
  return <AppShell activeTab="partners" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}><PartnersPage /></AppShell>
}
