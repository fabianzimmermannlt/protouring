'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Loader2, Save, X } from 'lucide-react'

// Gemeinsamer Rahmen für einen Settings-Bereich: Titel oben + eine zentrale
// "Ungespeicherte Änderungen"-Leiste, die für ALLE enthaltenen Abschnitte gilt.
// Abschnitts-Komponenten melden ihren Dirty-Status via Event 'pt:settings-dirty'
// und stellen Speichern/Abbrechen über window.__pt_save / window.__pt_cancel bereit
// (dasselbe Muster, das auch der L2-Nav-Guard nutzt).

export function SettingsAreaShell({ title, children }: { title: string; children: ReactNode }) {
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => setDirty(Boolean((e as CustomEvent<{ dirty: boolean }>).detail?.dirty))
    window.addEventListener('pt:settings-dirty', handler)
    setDirty(Boolean((window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty))
    return () => window.removeEventListener('pt:settings-dirty', handler)
  }, [])

  const onSave = async () => {
    const fn = (window as unknown as { __pt_save?: () => Promise<boolean> | void }).__pt_save
    if (typeof fn !== 'function') return
    setSaving(true)
    try { await fn() } finally { setSaving(false) }
  }
  const onCancel = () => {
    const fn = (window as unknown as { __pt_cancel?: () => void }).__pt_cancel
    if (typeof fn === 'function') fn()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <h2 style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: 600 }}>{title}</h2>
        {dirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#b0b0b0' }}>Ungespeicherte Änderungen</span>
            <button onClick={onCancel}
              style={{ padding: '5px 12px', fontSize: '13px', color: '#b0b0b0', background: 'none', border: '1px solid #555', borderRadius: 0, cursor: 'pointer' }}>
              <X className="w-3 h-3 inline mr-1" />Abbrechen
            </button>
            <button onClick={onSave} disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 0, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Speichern
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
