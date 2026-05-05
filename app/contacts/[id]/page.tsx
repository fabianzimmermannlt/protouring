'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/app/components/shared/AppShell'
import { isAuthenticated } from '@/lib/api-client'
import { ContactDetailContent } from '@/app/modules/contacts/ContactDetail'

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = String(params.id)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  return (
    <AppShell activeTab="contacts" onTabChange={tab => { window.location.href = `/?tab=${tab}` }}>
      <ContactDetailContent contactId={contactId} />
    </AppShell>
  )
}
