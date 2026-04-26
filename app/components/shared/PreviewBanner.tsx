'use client'

import { useState, useEffect } from 'react'
import { Eye, X } from 'lucide-react'
import { getRealTenantRole, getPreviewRole, setPreviewRole, ROLE_LABELS } from '@/lib/api-client'

export default function PreviewBanner() {
  const [previewRole, setPreviewRoleState] = useState<string | null>(null)
  const [realRole, setRealRole]            = useState<string | null>(null)
  const [open, setOpen]                    = useState(false)

  const BANNER_HEIGHT = '32px'

  useEffect(() => {
    const preview = getPreviewRole()
    setPreviewRoleState(preview)
    setRealRole(getRealTenantRole())
    // CSS-Variable setzen damit mobile 100dvh-Container die Höhe abziehen können
    if (preview) {
      document.body.style.paddingTop = BANNER_HEIGHT
      document.documentElement.style.setProperty('--pt-preview-height', BANNER_HEIGHT)
    }
    return () => {
      document.body.style.paddingTop = ''
      document.documentElement.style.removeProperty('--pt-preview-height')
    }
  }, [])

  // Nur für Rollen 1–3 sichtbar (4–7 brauchen keinen Preview)
  const ROLE_ORDER = ['admin', 'agency', 'tourmanagement', 'artist', 'crew_plus', 'crew', 'guest']
  const realRoleIndex = realRole ? ROLE_ORDER.indexOf(realRole) : -1
  if (realRoleIndex < 0 || realRoleIndex > 2) return null

  // Nur Rollen ab der eigenen aufwärts anzeigen
  const availableRoles = ROLE_ORDER.slice(realRoleIndex)

  const activate = (role: string) => {
    setPreviewRole(role)
    setPreviewRoleState(role)
    setOpen(false)
    window.location.reload()
  }

  const deactivate = () => {
    setPreviewRole(null)
    setPreviewRoleState(null)
    window.location.reload()
  }

  return (
    <>
      {/* Aktiver Preview-Banner */}
      {previewRole && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#f59e0b', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.75rem', padding: '0.4rem 1rem',
          fontSize: '0.8rem', fontWeight: 600,
        }}>
          <Eye size={14} />
          Vorschau als: {(ROLE_LABELS as Record<string, string>)[previewRole ?? ''] ?? previewRole}
          <button
            onClick={deactivate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: '0.25rem', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <X size={12} /> Beenden
          </button>
        </div>
      )}

      {/* Toggle-Button (nur wenn kein Preview aktiv) */}
      {!previewRole && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setOpen(v => !v)}
            title="Seite als andere Rolle anzeigen"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.6rem', borderRadius: '0.375rem',
              background: open ? '#e0e7ff' : 'transparent',
              border: '1px solid #e5e7eb',
              color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Eye size={13} />
            Vorschau
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 0.25rem)',
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 200, minWidth: '160px', padding: '0.4rem 0',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.3rem 0.75rem 0.4rem' }}>
                Ansicht als…
              </div>
              {availableRoles.map(role => (
                <button
                  key={role}
                  onClick={() => activate(role)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    color: '#374151', background: 'none', border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {(ROLE_LABELS as Record<string, string>)[role]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
