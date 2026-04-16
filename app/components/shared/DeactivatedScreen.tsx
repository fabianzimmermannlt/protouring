'use client'

import { useEffect, useState } from 'react'
import { getCurrentTenant } from '@/lib/api-client'

export default function DeactivatedScreen() {
  const [show, setShow] = useState(false)
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setTenantName(detail?.tenantName ?? getCurrentTenant()?.name ?? '')
      setShow(true)
    }
    window.addEventListener('account-deactivated', handler)
    return () => window.removeEventListener('account-deactivated', handler)
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6v2m0 0a4 4 0 100-8 4 4 0 000 8zm0 0v2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Zugang deaktiviert</h2>
          {tenantName && (
            <p className="text-sm text-gray-500 mt-1">{tenantName}</p>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Dein Zugang für diesen Tenant ist aktuell deaktiviert.<br />
          Wende dich an einen Admin um wieder freigeschaltet zu werden.
        </p>
      </div>
    </div>
  )
}
