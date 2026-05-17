'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
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

export default function FunktionenSettings() {
  const t = useT()
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [customNames, setCustomNames] = useState<string[]>([])
  const [newCustom, setNewCustom] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      getFunctionCatalog(),
      getActiveFunctions().catch(() => [] as { name: string }[]),
    ]).then(([cat, active]) => {
      setCatalog(cat)
      // Custom names = active names not in predefined catalog
      const predefinedNames = new Set(cat.flatMap(g => g.functions.map(f => f.name)))
      const custom = active.map(f => f.name).filter(n => !predefinedNames.has(n))
      setCustomNames(custom)
    }).finally(() => setLoading(false))
  }, [])

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

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const catalogActive = catalog.flatMap(g => g.functions.filter(f => f.active).map(f => f.name))
      await saveFunctionCatalog([...catalogActive, ...customNames])
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
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
    <div className="pt-fn-settings">
      <div className="pt-fn-header">
        <div>
          <p className="pt-fn-subtitle">
            {t('settings.funktionen.activeCount').replace('{active}', String(totalActive)).replace('{total}', String(totalAll))}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> {t('general.saving')}</>
            : saved
            ? <><Check size={14} /> {t('general.saved')}</>
            : t('general.save')}
        </button>
      </div>

      <div className="pt-fn-groups">
        {catalog.map((group, gi) => {
          const allOn = group.functions.every(f => f.active)
          const someOn = group.functions.some(f => f.active)
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
                onClick={() => removeCustom(name)}
                title="Klicken zum Entfernen"
              >
                {name}
                <span className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ fontSize: '10px', lineHeight: 1 }}>✕</span>
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
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ borderColor: '#3c3c3c', background: '#1e1e1e', color: '#d1d5db' }}
            />
            <button
              onClick={addCustom}
              disabled={!newCustom.trim() || customNames.includes(newCustom.trim())}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              + Hinzufügen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
