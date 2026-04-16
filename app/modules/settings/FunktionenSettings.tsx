'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import {
  getFunctionCatalog,
  saveFunctionCatalog,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

export default function FunktionenSettings() {
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
            {totalActive} von {totalAll} Funktionen aktiv — diese erscheinen in allen Dropdowns der App.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> Speichern…</>
            : saved
            ? <><Check size={14} /> Gespeichert</>
            : 'Speichern'}
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
                  <button className="pt-fn-group-toggle" onClick={() => toggleGroup(gi, true)}>Alle an</button>
                  <span className="pt-fn-group-divider">·</span>
                  <button className="pt-fn-group-toggle" onClick={() => toggleGroup(gi, false)}>Alle aus</button>
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
