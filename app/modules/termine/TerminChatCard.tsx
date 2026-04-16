'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Communication } from '@/app/components/shared/Communication/Communication'
import { getAuthToken, getCurrentTenant } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3002`
    : 'http://localhost:3002'
)

export default function TerminChatCard({ terminId }: { terminId: number }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  // Key-Trick: Communication neu mounten nach Clear → leert den State
  const [chatKey, setChatKey] = useState(0)

  const tenant = getCurrentTenant()
  const isAdmin = !!tenant && ['owner', 'admin', 'manager'].includes(tenant.role)

  const handleClear = async () => {
    setClearing(true)
    try {
      const token = getAuthToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (tenant) headers['X-Tenant-Slug'] = tenant.slug
      await fetch(`${API_BASE}/api/chat/termin/${terminId}`, { method: 'DELETE', headers })
      setChatKey(k => k + 1)
      setShowDeleteConfirm(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="pt-card flex flex-col" style={{ height: '400px' }}>
      <div className="pt-card-header">
        <span className="pt-card-title">Chat</span>
        {isAdmin && !showDeleteConfirm && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Chat-Verlauf löschen"
          >
            <Trash2 size={13} />
          </button>
        )}
        {showDeleteConfirm && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Verlauf löschen?</span>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 text-xs"
            >
              Ja
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs"
            >
              Nein
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <Communication
          key={chatKey}
          entityType="termin"
          entityId={String(terminId)}
          showHeader={false}
          maxHeight=""
          className="h-full"
        />
      </div>
    </div>
  )
}
