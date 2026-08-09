'use client'

import { useState, useEffect, Fragment } from 'react'
import { Loader2, ShieldCheck, Eye, Pencil } from 'lucide-react'
import {
  PERMISSION_CATALOG, ROLE_ORDER, ROLE_LABELS, getRolePermissions, saveRolePermissions,
  refreshRolePermissions, EDIT_AREAS, type TenantRole, type PermGroup,
} from '@/lib/api-client'

const GROUPS: PermGroup[] = ['Bereiche', 'Event-Unterbereiche', 'Funktionen', 'Bearbeiten']
const EDIT_DEFAULT_ROLES = ['admin', 'agency', 'tourmanagement']
const editAreaSet = new Set<string>(EDIT_AREAS)
const editKeyOf = (areaKey: string) => `${areaKey}.edit`

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
    for (const a of EDIT_AREAS) m[editKeyOf(a)] = [...EDIT_DEFAULT_ROLES]
    return m
  }

  useEffect(() => {
    getRolePermissions().then(ov => {
      const m: Record<string, string[]> = {}
      for (const p of configurable) m[p.key] = Array.isArray(ov[p.key]) ? ov[p.key] : [...p.default]
      for (const a of EDIT_AREAS) { const k = editKeyOf(a); m[k] = Array.isArray(ov[k]) ? ov[k] : [...EDIT_DEFAULT_ROLES] }
      setMatrix(m)
    }).catch(() => setMatrix(buildDefaults())).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Einfacher Toggle (Nicht-Bereichs-Zeilen: eine Checkbox)
  const toggle = (key: string, role: TenantRole) => {
    if (role === 'admin') return
    setMatrix(prev => {
      const cur = prev[key] ?? []
      const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]
      return { ...prev, [key]: next }
    })
    setDirty(true); setSaved(false)
  }

  // Bereichs-Zeilen: Sehen-Icon. Sehen aus → Bearbeiten automatisch aus.
  const toggleView = (key: string, role: TenantRole) => {
    if (role === 'admin') return
    setMatrix(prev => {
      const view = prev[key] ?? []
      const on = !view.includes(role)
      const nextView = on ? [...view, role] : view.filter(r => r !== role)
      const ek = editKeyOf(key)
      const edit = prev[ek] ?? []
      const nextEdit = on ? edit : edit.filter(r => r !== role)
      return { ...prev, [key]: nextView, [ek]: nextEdit }
    })
    setDirty(true); setSaved(false)
  }
  // Bearbeiten-Icon. Bearbeiten an → Sehen automatisch an.
  const toggleEdit = (key: string, role: TenantRole) => {
    if (role === 'admin') return
    setMatrix(prev => {
      const ek = editKeyOf(key)
      const edit = prev[ek] ?? []
      const on = !edit.includes(role)
      const nextEdit = on ? [...edit, role] : edit.filter(r => r !== role)
      const view = prev[key] ?? []
      const nextView = on ? (view.includes(role) ? view : [...view, role]) : view
      return { ...prev, [key]: nextView, [ek]: nextEdit }
    })
    setDirty(true); setSaved(false)
  }

  const resetDefaults = () => { setMatrix(buildDefaults()); setDirty(true); setSaved(false) }

  const save = async () => {
    setSaving(true)
    try {
      const out: Record<string, string[]> = {}
      for (const p of configurable) out[p.key] = Array.from(new Set<string>(['admin', ...(matrix[p.key] ?? [])]))
      for (const a of EDIT_AREAS) { const k = editKeyOf(a); out[k] = Array.from(new Set<string>(['admin', ...(matrix[k] ?? [])])) }
      await saveRolePermissions(out)
      await refreshRolePermissions()
      setDirty(false); setSaved(true)
    } catch { alert('Speichern fehlgeschlagen') } finally { setSaving(false) }
  }

  const th: React.CSSProperties = { padding: '0.5rem 0.4rem', fontSize: '0.68rem', fontWeight: 600, color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center', whiteSpace: 'nowrap' }
  const rowLabel: React.CSSProperties = { padding: '0.55rem 0.75rem', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }
  const cell: React.CSSProperties = { padding: '0.4rem', textAlign: 'center', borderTop: '1px solid #383838' }
  const iconBtn = (disabled: boolean): React.CSSProperties => ({ background: 'none', border: 'none', padding: 2, lineHeight: 0, cursor: disabled ? 'not-allowed' : 'pointer' })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-100">Rollen & Rechte</h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 720 }}>
        Lege fest, was jede Rolle in der App darf. Bei den Bereichen unterscheidest du zwischen{' '}
        <Eye size={13} style={{ display: 'inline', verticalAlign: '-2px', color: '#7c7cf8' }} /> <strong>sehen</strong> und{' '}
        <Pencil size={12} style={{ display: 'inline', verticalAlign: '-1px', color: 'var(--accent)' }} /> <strong>bearbeiten</strong>.
        „Bearbeiten" schaltet „Sehen" automatisch mit ein. Die Spalte <strong>Admin</strong> ist immer aktiv (Schutz vor Aussperren).
        Änderungen wirken nach dem Speichern.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Lädt…</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)' }}>
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
                      <td colSpan={ROLE_ORDER.length + 1} style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#242015', borderTop: '1px solid var(--border)' }}>
                        {group}{group === 'Bereiche' && <span style={{ color: '#8a8a8a', fontWeight: 400, textTransform: 'none' }}> — 👁 sehen · ✏️ bearbeiten</span>}
                      </td>
                    </tr>
                    {rows.map(p => {
                      const twoIcon = group === 'Bereiche' && editAreaSet.has(p.key)
                      return (
                        <tr key={p.key}>
                          <td style={{ ...rowLabel, borderTop: '1px solid #383838' }}>{p.label}</td>
                          {ROLE_ORDER.map(role => {
                            const isAdmin = role === 'admin'
                            if (twoIcon) {
                              const viewOn = isAdmin || (matrix[p.key] ?? []).includes(role)
                              const editOn = isAdmin || (matrix[editKeyOf(p.key)] ?? []).includes(role)
                              return (
                                <td key={role} style={cell}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                                    <button type="button" title={viewOn ? 'Darf sehen' : 'Sehen: aus'} disabled={isAdmin} onClick={() => toggleView(p.key, role)} style={iconBtn(isAdmin)}>
                                      <Eye size={15} color={viewOn ? '#7c7cf8' : 'var(--border-strong)'} />
                                    </button>
                                    <button type="button" title={editOn ? 'Darf bearbeiten' : 'Bearbeiten: aus'} disabled={isAdmin} onClick={() => toggleEdit(p.key, role)} style={iconBtn(isAdmin)}>
                                      <Pencil size={14} color={editOn ? 'var(--accent)' : 'var(--border-strong)'} />
                                    </button>
                                  </div>
                                </td>
                              )
                            }
                            const checked = isAdmin || (matrix[p.key] ?? []).includes(role)
                            return (
                              <td key={role} style={cell}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isAdmin}
                                  onChange={() => toggle(p.key, role)}
                                  style={{ width: 16, height: 16, accentColor: '#7c7cf8', cursor: isAdmin ? 'not-allowed' : 'pointer', opacity: isAdmin ? 0.6 : 1 }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
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
