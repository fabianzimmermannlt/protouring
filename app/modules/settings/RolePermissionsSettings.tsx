'use client'

import { useState, useEffect, Fragment } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import {
  PERMISSION_CATALOG, ROLE_ORDER, ROLE_LABELS, getRolePermissions, saveRolePermissions,
  refreshRolePermissions, type TenantRole, type PermGroup,
} from '@/lib/api-client'

const GROUPS: PermGroup[] = ['Bereiche', 'Event-Unterbereiche', 'Funktionen', 'Bearbeiten']

export default function RolePermissionsSettings() {
  const configurable = PERMISSION_CATALOG.filter(p => p.configurable)
  const [matrix, setMatrix] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const buildDefaults = () => {
    const m: Record<string, string[]> = {}
    for (const p of configurable) m[p.key] = [...p.default]
    return m
  }

  useEffect(() => {
    getRolePermissions().then(ov => {
      const m: Record<string, string[]> = {}
      for (const p of configurable) m[p.key] = Array.isArray(ov[p.key]) ? ov[p.key] : [...p.default]
      setMatrix(m)
    }).catch(() => setMatrix(buildDefaults())).finally(() => setLoading(false))
  }, [])

  const toggle = (key: string, role: TenantRole) => {
    if (role === 'admin') return
    setMatrix(prev => {
      const cur = prev[key] ?? []
      const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]
      return { ...prev, [key]: next }
    })
    setDirty(true); setSaved(false)
  }

  const resetDefaults = () => { setMatrix(buildDefaults()); setDirty(true); setSaved(false) }

  const save = async () => {
    setSaving(true)
    try {
      const out: Record<string, string[]> = {}
      for (const p of configurable) out[p.key] = Array.from(new Set<string>(['admin', ...(matrix[p.key] ?? [])]))
      await saveRolePermissions(out)
      await refreshRolePermissions()
      setDirty(false); setSaved(true)
    } catch { alert('Speichern fehlgeschlagen') } finally { setSaving(false) }
  }

  const th: React.CSSProperties = { padding: '0.5rem 0.4rem', fontSize: '0.68rem', fontWeight: 600, color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center', whiteSpace: 'nowrap' }
  const rowLabel: React.CSSProperties = { padding: '0.55rem 0.75rem', fontSize: '0.85rem', color: '#e0e0e0', whiteSpace: 'nowrap' }
  const cell: React.CSSProperties = { padding: '0.4rem', textAlign: 'center', borderTop: '1px solid #383838' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-100">Rollen & Rechte</h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.5, maxWidth: 720 }}>
        Lege fest, was jede Rolle in der App <strong>sehen</strong> und <strong>bearbeiten</strong> darf. Ein Häkchen = erlaubt.
        Die Spalte <strong>Admin</strong> ist immer aktiv und kann nicht entfernt werden (Schutz vor Aussperren).
        Änderungen wirken nach dem Speichern beim nächsten Laden der App.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Lädt…</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #3c3c3c', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#2d2d2d' }}>
            <thead>
              <tr style={{ background: '#383838' }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 220 }}>Recht</th>
                {ROLE_ORDER.map(r => (
                  <th key={r} style={th}>{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => {
                const rows = configurable.filter(p => p.group === group)
                if (rows.length === 0) return null
                return (
                  <Fragment key={group}>
                    <tr>
                      <td colSpan={ROLE_ORDER.length + 1} style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: '#f5c518', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#242015', borderTop: '1px solid #3c3c3c' }}>
                        {group}
                      </td>
                    </tr>
                    {rows.map(p => (
                      <tr key={p.key}>
                        <td style={{ ...rowLabel, borderTop: '1px solid #383838' }}>{p.label}</td>
                        {ROLE_ORDER.map(role => {
                          const checked = role === 'admin' || (matrix[p.key] ?? []).includes(role)
                          return (
                            <td key={role} style={cell}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={role === 'admin'}
                                onChange={() => toggle(p.key, role)}
                                style={{ width: 16, height: 16, accentColor: '#7c7cf8', cursor: role === 'admin' ? 'not-allowed' : 'pointer', opacity: role === 'admin' ? 0.6 : 1 }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={resetDefaults} className="text-sm text-gray-400 hover:text-gray-200">Auf Standard zurücksetzen</button>
        <div className="flex-1" />
        {saved && <span className="text-sm text-green-400">✓ Gespeichert</span>}
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-1.5 text-sm rounded-lg text-white"
          style={{ background: '#7c7cf8', opacity: (!dirty || saving) ? 0.5 : 1, cursor: (!dirty || saving) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Speichern
        </button>
      </div>
    </div>
  )
}
