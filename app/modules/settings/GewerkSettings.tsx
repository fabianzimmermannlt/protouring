'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/app/lib/i18n/translations/de'
import {
  getGewerke,
  createGewerk,
  updateGewerk,
  deleteGewerk,
  getFunctionCatalog,
  type Gewerk,
  type FunctionCatalogGroup,
} from '@/lib/api-client'

const GROUP_KEY_MAP: Record<string, TranslationKey> = {
  'Talente & Akteure': 'settings.funktionen.group.talente',
  'Management':        'settings.funktionen.group.management',
  'Technik':           'settings.funktionen.group.technik',
  'Driver':            'settings.funktionen.group.driver',
  'Sonstige':          'settings.funktionen.group.sonstige',
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#1f2937',
]

interface GewerkFormState {
  name: string
  color: string
  can_write: boolean
  funktionen: string[]
}

const EMPTY_FORM: GewerkFormState = {
  name: '',
  color: '#6366f1',
  can_write: false,
  funktionen: [],
}

export default function GewerkSettings() {
  const t = useT()
  const [gewerke, setGewerke] = useState<Gewerk[]>([])
  const [catalog, setCatalog] = useState<FunctionCatalogGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Create/Edit state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<GewerkFormState>(EMPTY_FORM)
  const [expandedCatalog, setExpandedCatalog] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([getGewerke(), getFunctionCatalog()])
      .then(([g, c]) => {
        setGewerke(g)
        setCatalog(c)
        // Default: alle Gruppen ausgeklappt
        const exp: Record<string, boolean> = {}
        c.forEach(gr => { exp[gr.group] = true })
        setExpandedCatalog(exp)
      })
      .finally(() => setLoading(false))
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (g: Gewerk) => {
    setEditingId(g.id)
    setForm({ name: g.name, color: g.color, can_write: g.can_write === 1, funktionen: [...g.funktionen] })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const toggleFunktion = (fn: string) => {
    setForm(prev => ({
      ...prev,
      funktionen: prev.funktionen.includes(fn)
        ? prev.funktionen.filter(f => f !== fn)
        : [...prev.funktionen, fn],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId !== null) {
        const updated = await updateGewerk(editingId, { ...form })
        setGewerke(prev => prev.map(g => g.id === editingId ? updated : g))
      } else {
        const created = await createGewerk({ ...form })
        setGewerke(prev => [...prev, created])
      }
      cancelForm()
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.gewerke.deleteConfirm'))) return
    try {
      await deleteGewerk(id)
      setGewerke(prev => prev.filter(g => g.id !== id))
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">{t('general.loading')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">{t('settings.gewerke.title')}</h3>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('settings.gewerke.new')}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {t('settings.gewerke.description')}
        </p>

        {/* Liste bestehender Gewerke */}
        {gewerke.length === 0 && !showForm && (
          <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
            {t('settings.gewerke.empty')}
          </div>
        )}

        <div className="space-y-2">
          {gewerke.map(g => (
            <div
              key={g.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: g.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{g.name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {g.funktionen.length === 0
                    ? t('settings.gewerke.noFunctions')
                    : g.funktionen.join(', ')}
                </div>
                {g.can_write === 1 && (
                  <div className="text-xs text-indigo-600 mt-0.5">{t('settings.gewerke.crewCanWrite')}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(g)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  {t('general.edit')}
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title={t('general.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Formular */}
        {showForm && (
          <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                {editingId !== null ? t('settings.gewerke.edit') : t('settings.gewerke.new')}
              </span>
              <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="form-label">{t('general.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="form-input"
                placeholder={t('settings.gewerke.namePlaceholder')}
                autoFocus
              />
            </div>

            {/* Farbe */}
            <div>
              <label className="form-label">{t('settings.gewerke.color')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-800 scale-125' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Schreibrecht Crew */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="can_write"
                checked={form.can_write}
                onChange={e => setForm(f => ({ ...f, can_write: e.target.checked }))}
                className="mt-0.5"
              />
              <label htmlFor="can_write" className="text-xs text-gray-700 cursor-pointer">
                <span className="font-medium">{t('settings.gewerke.crewWriteRight')}</span>
                <span className="text-gray-500 block">{t('settings.gewerke.crewWriteRightDesc')}</span>
              </label>
            </div>

            {/* Funktionen zuweisen */}
            <div>
              <label className="form-label">
                {t('settings.gewerke.functions')}
                {form.funktionen.length > 0 && (
                  <span className="ml-1.5 text-blue-600 font-normal">({t('settings.gewerke.functionsSelected').replace('{count}', String(form.funktionen?.length ?? 0))})</span>
                )}
              </label>
              <div className="space-y-2 mt-1">
                {catalog.map(group => (
                  <div key={group.group} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedCatalog(prev => ({ ...prev, [group.group]: !prev[group.group] }))}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
                    >
                      <span>{GROUP_KEY_MAP[group.group] ? t(GROUP_KEY_MAP[group.group]) : group.group}</span>
                      {expandedCatalog[group.group]
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                    {expandedCatalog[group.group] && (
                      <div className="p-2 flex flex-wrap gap-1.5">
                        {group.functions
                          .filter(fn => fn.active)
                          .map(fn => {
                            const selected = form.funktionen.includes(fn.name)
                            return (
                              <button
                                key={fn.name}
                                type="button"
                                onClick={() => toggleFunktion(fn.name)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                  selected
                                    ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-700'
                                }`}
                              >
                                {selected && <Check className="w-2.5 h-2.5" />}
                                {fn.name}
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Speichern */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editingId !== null ? t('general.save') : t('general.create')}
              </button>
              <button
                onClick={cancelForm}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {t('general.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
