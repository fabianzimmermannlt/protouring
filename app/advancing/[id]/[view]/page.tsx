'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Redirect: /advancing/ID/view → /?tab=advancing&id=ID&view=view
export default function AdvancingDetailRedirect() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const id = params.id
    const view = params.view || 'details2'
    router.replace(`/?tab=advancing&id=${id}&view=${view}`)
  }, [params, router])

  return null
}
