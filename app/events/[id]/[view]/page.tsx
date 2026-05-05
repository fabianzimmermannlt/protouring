'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Redirect: /events/ID/view → /?tab=events&id=ID&view=view
export default function EventDetailRedirect() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const id = params.id
    const view = params.view || 'details2'
    router.replace(`/?tab=events&id=${id}&view=${view}`)
  }, [params, router])

  return null
}
