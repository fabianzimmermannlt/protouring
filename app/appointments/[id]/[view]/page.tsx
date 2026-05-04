'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Redirect: /appointments/ID/view → /?tab=appointments&id=ID&view=view
export default function AppointmentDetailRedirect() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const id = params.id
    const view = params.view || 'details'
    router.replace(`/?tab=appointments&id=${id}&view=${view}`)
  }, [params, router])

  return null
}
