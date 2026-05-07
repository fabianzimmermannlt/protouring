'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import {
  getFunctionCatalog,
  saveFunctionCatalog,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

export default function FunktionenSettings() {
  const t = useT()
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getFunctionCatalog()
      .then(setCatalog)
      .finally(() => setLoading(false))
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

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const activeNames = catalog.flatMap(g => g.functions.filter(f => f.active).map(f => f.name))
      await saveFunctionCatalog(activeNames)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const totalActive = catalog.flatMap(g => g.functions).filter(f => f.active).length
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
                <span className="pt-fn-group-name">{group.group}</span>
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
      </div>
    </div>
  )
}
