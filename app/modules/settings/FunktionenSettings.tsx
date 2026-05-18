'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/app/lib/i18n/translations/de'
import {
  getFunctionCatalog,
  saveFunctionCatalog,
  getActiveFunctions,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

const GROUP_KEY_MAP: Record<string, TranslationKey> = {
  'Talente & Akteure': 'settings.funktionen.group.talente',
  'Management':        'settings.funktionen.group.management',
  'Technik':           'settings.funktionen.group.technik',
  'Driver':            'settings.funktionen.group.driver',
  'Sonstige':          'settings.funktionen.group.sonstige',
}

function catalogSig(catalog: FunctionCatalogGroup[], custom: string[]) {
  const active = catalog.flatMap(g => g.functions.filter(f => f.active).map(f => f.name)).sort()
  return [...active, ...custom.slice().sort()].join('|')
}

export default function FunktionenSettings() {
  const t = useT()
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [customNames, setCustomNames] = useState<string[]>([])
  const [newCustom, setNewCustom] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const originalSigRef = useRef<string>('')

  useEffect(() => {
    Promise.all([
      getFunctionCatalog(),
      getActiveFunctions().catch(() => [] as { name: string }[]),
    ]).then(([cat, active]) => {
      setCatalog(cat)
      const predefinedNames = new Set(cat.flatMap(g => g.functions.map(f => f.name)))
      const custom = active.map(f => f.name).filter(n => !predefinedNames.has(n))
      setCustomNames(custom)
      originalSigRef.current = catalogSig(cat, custom)
    }).finally(() => setLoading(false))
  }, [])

  // Dirty detection
  useEffect(() => {
    if (loading) return
    const dirty = catalogSig(catalog, customNames) !== originalSigRef.current
    setIsDirty(dirty)
  }, [catalog, customNames, loading])

  // Global dirty flag for L2 nav guard
  useEffect(() => {
    ;(window as any).__pt_isDirty = isDirty
    return () => { ;(window as any).__pt_isDirty = false }
  }, [isDirty])

  const saveEdit = async (): Promise<boolean> => {
    setSaving(true)
    try {
      const catalogActive = catalog.flatMap(g => g.functions.filter(f => f.active).map(f => f.name))
      await saveFunctionCatalog([...catalogActive, ...customNames])
      originalSigRef.current = catalogSig(catalog, customNames)
      setIsDirty(false)
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  // Always-fresh save reference (no deps — runs every render)
  useEffect(() => {
    ;(window as any).__pt_save = saveEdit
    return () => { ;(window as any).__pt_save = null }
  })

  const cancelEdit = () => {
    // Reload from server to reset state cleanly
    setLoading(true)
    Promise.all([
      getFunctionCatalog(),
      getActiveFunctions().catch(() => [] as { name: string }[]),
    ]).then(([cat, active]) => {
      setCatalog(cat)
      const predefinedNames = new Set(cat.flatMap(g => g.functions.map(f => f.name)))
      const custom = active.map(f => f.name).filter(n => !predefinedNames.has(n))
      setCustomNames(custom)
      originalSigRef.current = catalogSig(cat, custom)
      setIsDirty(false)
    }).finally(() => setLoading(false))
  }

  const toggle = (groupIdx: number, fnName: string) => {
    setCatalog(prev => prev.map((g, gi) =>
      gi !== groupIdx ? g : {
        ...g,
        functions: g.functions.map(f =>
          f.name === fnName ? { ...f, active: !f.active } : f
        ),
      }
    ))
  }

  const toggleGroup = (groupIdx: number, active: boolean) => {
    setCatalog(prev => prev.map((g, gi) =>
      gi !== groupIdx ? g : {
        ...g,
        functions: g.functions.map(f => ({ ...f, active })),
      }
    ))
  }

  const addCustom = () => {
    const name = newCustom.trim()
    if (!name || customNames.includes(name)) return
    setCustomNames(prev => [...prev, name])
    setNewCustom('')
  }

  const removeCustom = (name: string) => {
    setCustomNames(prev => prev.filter(n => n !== name))
  }

  const totalActive = catalog.flatMap(g => g.functions).filter(f => f.active).length + customNames.length
  const totalAll = catalog.flatMap(g => g.functions).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="module-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header + dirty bar */}
      <div className="flex items-center justify-between" style={{ minHeight: '32px', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: 600 }}>Funktionen</h1>
          <p className="pt-fn-subtitle" style={{ marginTop: '2px' }}>
            {t('settings.funktionen.activeCount').replace('{active}', String(totalActive)).replace('{total}', String(totalAll))}
          </p>
        </div>
        {isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#b0b0b0' }}>Ungespeicherte Änderungen</span>
            <button onClick={cancelEdit}
              style={{ padding: '5px 12px', fontSize: '13px', color: '#b0b0b0', background: 'none', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}>
              <X className="w-3 h-3 inline mr-1" />{t('general.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving}
              style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 500, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t('general.save')}
            </button>
          </div>
        )}
      </div>

      <div className="pt-fn-groups">
        {catalog.map((group, gi) => {
          return (
            <div key={group.group} className="pt-fn-group">
              <div className="pt-fn-group-header">
                <span className="pt-fn-group-name">
                  {GROUP_KEY_MAP[group.group] ? t(GROUP_KEY_MAP[group.group]) : group.group}
                </span>
                <div className="pt-fn-group-actions">
                  <button className="pt-fn-group-toggle" onClick={() => toggleGroup(gi, true)}>{t('settings.funktionen.allOn')}</button>
                  <span className="pt-fn-group-divider">·</span>
                  <button className="pt-fn-group-toggle" onClick={() => toggleGroup(gi, false)}>{t('settings.funktionen.allOff')}</button>
                </div>
              </div>
              <div className="pt-fn-chips">
                {group.functions.map(fn => (
                  <button
                    key={fn.name}
                    className={`pt-fn-chip ${fn.active ? 'pt-fn-chip--active' : ''}`}
                    onClick={() => toggle(gi, fn.name)}
                  >
                    {fn.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {/* Eigene Einträge */}
        <div className="pt-fn-group">
          <div className="pt-fn-group-header">
            <span className="pt-fn-group-name">Eigene Einträge</span>
          </div>
          <div className="pt-fn-chips" style={{ marginBottom: '0.75rem', minHeight: '28px' }}>
            {customNames.length === 0 && (
              <span className="pt-fn-subtitle" style={{ fontSize: '0.78rem' }}>Noch keine eigenen Einträge</span>
            )}
            {customNames.map(name => (
              <button
                key={name}
                className="pt-fn-chip pt-fn-chip--active group"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                {name}
                <span
                  className="opacity-0 group-hover:opacity-60 transition-opacity"
                  style={{ fontSize: '10px', lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); removeCustom(name) }}
                >✕</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center" style={{ maxWidth: '360px' }}>
            <input
              type="text"
              value={newCustom}
              onChange={e => setNewCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Neue Funktion eingeben…"
              className="detail-input"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button
              onClick={addCustom}
              disabled={!newCustom.trim() || customNames.includes(newCustom.trim())}
              className="btn btn-primary flex-shrink-0"
              style={{ borderRadius: '4px', height: '30px', padding: '0 12px', fontSize: '13px' }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
