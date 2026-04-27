'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronRightIcon, ChevronDownIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { WrenchScrewdriverIcon, ArchiveBoxIcon, TagIcon } from '@heroicons/react/24/outline'
import { parseCSV, col } from '@/lib/csvParser'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'
import {
  getEquipmentCategories, createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
  getEquipmentItems, createEquipmentItem, updateEquipmentItem, deleteEquipmentItem,
  getEquipmentMaterials, createEquipmentMaterial, updateEquipmentMaterial, deleteEquipmentMaterial,
  getMaterialUnits, createMaterialUnit, deleteMaterialUnit,
  getEquipmentItemDetail, getCaseContents, addToCaseContents, updateCaseContent, removeCaseContent,
  initEquipmentKuerzel, getEquipmentSettings, updateEquipmentSettings,
  canDo, getEffectiveRole,
  type EquipmentCategory, type EquipmentItem, type EquipmentMaterial, type EquipmentMaterialUnit,
  type EquipmentCaseContent,
} from '@/lib/api-client'

const TYP_LABELS: Record<string, string> = {
  case: 'Case', dolly: 'Dolly', kulisse: 'Kulisse', flightcase: 'Flightcase', sonstiges: 'Sonstiges'
}
const POSITION_LABELS: Record<string, string> = {
  sl: 'Stage Left', sr: 'Stage Right', foh: 'FOH', drums: 'Drums', backline: 'Backline', truck: 'Truck', sonstiges: 'Sonstiges'
}

const MATERIAL_COLUMNS = [
  { id: 'hersteller',  label: 'Hersteller',     defaultVisible: true  },
  { id: 'produkt',     label: 'Produkt',         defaultVisible: true,  alwaysVisible: true },
  { id: 'category',    label: 'Kategorie',       defaultVisible: true  },
  { id: 'typ',         label: 'Typ',             defaultVisible: true  },
  { id: 'einheiten',   label: 'Einheiten',       defaultVisible: true  },
  { id: 'land',        label: 'Land',            defaultVisible: true  },
  { id: 'wert',        label: 'Wert/Stk',        defaultVisible: true  },
  { id: 'gewicht',     label: 'Gewicht/Stk',     defaultVisible: true  },
]

type MatSortKey = 'hersteller' | 'produkt' | 'category_name' | 'typ' | 'unit_count' | 'herstellungsland' | 'wert_zollwert' | 'gewicht_kg'

const ITEMS_COLUMNS = [
  { id: 'case_id',      label: 'Case ID',       defaultVisible: true  },
  { id: 'name',         label: 'Name',          defaultVisible: true,  alwaysVisible: true },
  { id: 'typ',          label: 'Typ',           defaultVisible: true  },
  { id: 'category',     label: 'Kategorie',     defaultVisible: true  },
  { id: 'position',     label: 'Position',      defaultVisible: true  },
  { id: 'masse',        label: 'Maße H×B×T',    defaultVisible: true  },
  { id: 'leer_kg',      label: 'Leer kg',       defaultVisible: true  },
  { id: 'material',     label: 'Material',      defaultVisible: true  },
  { id: 'gesamt_kg',    label: 'Gesamt kg',     defaultVisible: true  },
]

type ItemSortKey = 'case_id' | 'name' | 'typ' | 'category_name' | 'position' | 'weight_empty_kg' | 'material_count' | 'load_order'

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1 text-blue-500">{dir === 'asc' ? '↑' : '↓'}</span>
}

function fmt(v: number | null | undefined, unit = '') {
  if (v == null) return '—'
  return `${v.toLocaleString('de-DE')}${unit}`
}

// ── Kategorie-Modal ─────────────────────────────────────────────────────────

function CategoryModal({ cat, onSave, onClose }: {
  cat: EquipmentCategory | null
  onSave: (data: { name: string; kuerzel: string }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(cat?.name ?? '')
  const [kuerzel, setKuerzel] = useState(cat?.kuerzel ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handle = async () => {
    if (!name.trim()) { setErr('Name ist Pflicht'); return }
    if (!kuerzel.trim()) { setErr('Kürzel ist Pflicht'); return }
    setSaving(true)
    try { await onSave({ name: name.trim(), kuerzel: kuerzel.trim().toUpperCase() }); onClose() }
    catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{cat ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body space-y-3">
          <div>
            <label className="form-label">Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Audio" autoFocus />
          </div>
          <div>
            <label className="form-label">Kürzel <span className="text-gray-400 font-normal">(max. 5 Zeichen)</span></label>
            <input className="form-input font-mono uppercase" style={{ width: '6rem' }}
              value={kuerzel} onChange={e => setKuerzel(e.target.value.toUpperCase().slice(0, 5))} placeholder="AUD" maxLength={5} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Gegenstand-Modal ─────────────────────────────────────────────────────────

function ItemModal({ item, categories, onSave, onClose }: {
  item: EquipmentItem | null
  categories: EquipmentCategory[]
  onSave: (data: Partial<EquipmentItem>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category_id: item?.category_id ?? '',
    typ: item?.typ ?? 'case',
    position: item?.position ?? '',
    load_order: item?.load_order != null ? String(item.load_order) : '',
    height_cm: item?.height_cm != null ? String(item.height_cm) : '',
    width_cm: item?.width_cm != null ? String(item.width_cm) : '',
    depth_cm: item?.depth_cm != null ? String(item.depth_cm) : '',
    weight_empty_kg: item?.weight_empty_kg != null ? String(item.weight_empty_kg) : '',
    notiz: item?.notiz ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const n = (v: string) => v === '' ? null : parseFloat(v)
  const ni = (v: string) => v === '' ? null : parseInt(v, 10)

  const handle = async () => {
    if (!form.name.trim()) { setErr('Name ist Pflicht'); return }
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        typ: form.typ as any,
        position: (form.position || null) as any,
        load_order: ni(form.load_order),
        height_cm: n(form.height_cm),
        width_cm: n(form.width_cm),
        depth_cm: n(form.depth_cm),
        weight_empty_kg: n(form.weight_empty_kg),
        notiz: form.notiz || null,
      })
      onClose()
    } catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{item ? `${item.case_id} bearbeiten` : 'Neuer Gegenstand'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="z.B. FOH-Rack" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Typ</label>
              <select className="form-select" value={form.typ} onChange={e => setForm({...form, typ: e.target.value as any})}>
                {Object.entries(TYP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Kategorie</label>
              <select className="form-select" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">— keine —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Position (Bühne)</label>
              <select className="form-select" value={form.position} onChange={e => setForm({...form, position: e.target.value})}>
                <option value="">— keine —</option>
                {Object.entries(POSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Ladereihenfolge</label>
              <input type="number" className="form-input" value={form.load_order} onChange={e => setForm({...form, load_order: e.target.value})} placeholder="1" min={1} />
            </div>
          </div>
          <div>
            <label className="form-label">Maße (cm) — Höhe / Breite / Tiefe</label>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" className="form-input" value={form.height_cm} onChange={e => setForm({...form, height_cm: e.target.value})} placeholder="H" />
              <input type="number" className="form-input" value={form.width_cm} onChange={e => setForm({...form, width_cm: e.target.value})} placeholder="B" />
              <input type="number" className="form-input" value={form.depth_cm} onChange={e => setForm({...form, depth_cm: e.target.value})} placeholder="T" />
            </div>
          </div>
          <div>
            <label className="form-label">Leergewicht (kg)</label>
            <input type="number" className="form-input" value={form.weight_empty_kg} onChange={e => setForm({...form, weight_empty_kg: e.target.value})} placeholder="0.0" step="0.1" />
          </div>
          <div>
            <label className="form-label">Notiz</label>
            <textarea className="form-textarea" rows={2} value={form.notiz} onChange={e => setForm({...form, notiz: e.target.value})} placeholder="Interne Notizen…" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Material-Modal ────────────────────────────────────────────────────────────

function MaterialModal({ mat, categories, onSave, onClose, carnetEnabled = false }: {
  mat: EquipmentMaterial | null
  categories: EquipmentCategory[]
  onSave: (data: Partial<EquipmentMaterial>) => Promise<number> // returns material id
  onClose: () => void
  carnetEnabled?: boolean
}) {
  const [form, setForm] = useState({
    hersteller:             mat?.hersteller ?? '',
    produkt:                mat?.produkt ?? '',
    info:                   mat?.info ?? '',
    category_id:            mat?.category_id != null ? String(mat.category_id) : '',
    typ:                    mat?.typ ?? 'bulk',
    herstellungsland:       mat?.herstellungsland ?? '',
    wert_zollwert:          mat?.wert_zollwert != null ? String(mat.wert_zollwert) : '',
    wert_wiederbeschaffungswert: mat?.wert_wiederbeschaffungswert != null ? String(mat.wert_wiederbeschaffungswert) : '',
    waehrung:               mat?.waehrung ?? 'EUR',
    gewicht_kg:             mat?.gewicht_kg != null ? String(mat.gewicht_kg) : '',
    anschaffungsdatum:      mat?.anschaffungsdatum ?? '',
    notiz:                  mat?.notiz ?? '',
  })

  // Seriennummern-Verwaltung
  const [existingUnits, setExistingUnits] = useState<EquipmentMaterialUnit[]>([])
  const [newSerials, setNewSerials] = useState<string[]>(['']) // neue Eingabefelder
  const [deletedUnitIds, setDeletedUnitIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Bestehende Units laden (nur beim Bearbeiten eines Serienartikels)
  useEffect(() => {
    if (mat && mat.typ === 'serial') {
      getMaterialUnits(mat.id).then(setExistingUnits).catch(() => {})
    }
  }, [mat])

  // Typ-Wechsel: Inputs zurücksetzen
  const handleTypChange = (t: 'bulk' | 'serial') => {
    setForm(f => ({ ...f, typ: t }))
    setNewSerials([''])
    setErr('')
  }

  const n = (v: string) => v === '' ? null : parseFloat(v)

  // Carnet ATA: fehlende Pflichtfelder im Formular
  const carnetWarn = (field: string): boolean => {
    if (!carnetEnabled) return false
    const checks: Record<string, boolean> = {
      hersteller:       !form.hersteller.trim(),
      produkt:          !form.produkt.trim(),
      info:             !form.info.trim(),
      herstellungsland: !form.herstellungsland.trim(),
      gewicht_kg:       !form.gewicht_kg.trim(),
      wert_zollwert:    !form.wert_zollwert.trim(),
      waehrung:         !form.waehrung.trim(),
    }
    return checks[field] ?? false
  }
  const carnetMissingCount = carnetEnabled
    ? ['hersteller','produkt','info','herstellungsland','gewicht_kg','wert_zollwert','waehrung']
        .filter(f => carnetWarn(f)).length
    : 0
  const inp = (field: string) => carnetWarn(field) ? 'form-input border-red-400 bg-red-50' : 'form-input'
  const lbl = (field: string, label: string) => carnetWarn(field)
    ? <><span>{label}</span><span className="ml-1 text-red-500 text-xs font-semibold">Carnet!</span></>
    : label

  const handle = async () => {
    if (!form.produkt.trim()) { setErr('Produkt ist Pflicht'); return }

    // Neue Serials validieren (darf keine Duplikate haben)
    const filled = newSerials.map(s => s.trim()).filter(Boolean)
    if (form.typ === 'serial' && filled.length > 0) {
      const dupes = filled.filter((s, i) => filled.indexOf(s) !== i)
      if (dupes.length > 0) { setErr(`Doppelte Seriennummer: ${dupes[0]}`); return }
    }

    setSaving(true)
    try {
      const matId = await onSave({
        hersteller:             form.hersteller || null,
        produkt:                form.produkt.trim(),
        info:                   form.info || null,
        category_id:            form.category_id ? Number(form.category_id) : null,
        typ:                    form.typ as 'serial' | 'bulk',
        herstellungsland:       form.herstellungsland || null,
        wert_zollwert:          n(form.wert_zollwert),
        wert_wiederbeschaffungswert: n(form.wert_wiederbeschaffungswert),
        waehrung:               form.waehrung,
        gewicht_kg:             n(form.gewicht_kg),
        anschaffungsdatum:      form.anschaffungsdatum || null,
        notiz:                  form.notiz || null,
      })

      // Units löschen
      await Promise.all(deletedUnitIds.map(id => deleteMaterialUnit(id)))

      // Neue Units anlegen
      if (form.typ === 'serial') {
        await Promise.all(filled.map(s => createMaterialUnit(matId, { seriennummer: s })))
      }

      onClose()
    } catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
  }

  const removeExisting = (unitId: number) => {
    setDeletedUnitIds(p => [...p, unitId])
    setExistingUnits(p => p.filter(u => u.id !== unitId))
  }

  const updateSerial = (idx: number, val: string) => {
    setNewSerials(p => { const n = [...p]; n[idx] = val; return n })
  }

  const addSerial = () => setNewSerials(p => [...p, ''])

  const removeSerial = (idx: number) =>
    setNewSerials(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [''])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{mat ? 'Material bearbeiten' : 'Neues Material'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body space-y-4">

          {/* Basisfelder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{lbl('hersteller', 'Hersteller')}</label>
              <input className={inp('hersteller')} value={form.hersteller} onChange={e => setForm({...form, hersteller: e.target.value})} placeholder="z.B. Shure" autoFocus />
            </div>
            <div>
              <label className="form-label">Produkt *</label>
              <input className={inp('produkt')} value={form.produkt} onChange={e => setForm({...form, produkt: e.target.value})} placeholder="z.B. SM58" />
            </div>
          </div>
          <div>
            <label className="form-label">{lbl('info', 'Beschreibung / Info')}</label>
            <input className={inp('info')} value={form.info} onChange={e => setForm({...form, info: e.target.value})} placeholder="Kurzbeschreibung für Carnet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Kategorie</label>
              <select className="form-select" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">— keine —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Typ</label>
              <div className="flex gap-2 mt-1">
                {(['bulk', 'serial'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => handleTypChange(t)}
                    className={`flex-1 py-1.5 text-sm rounded border font-medium transition-colors ${
                      form.typ === t ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {t === 'bulk' ? 'Massenartikel' : 'Serienartikel'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Seriennummern-Bereich */}
          {form.typ === 'serial' && (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seriennummern</p>

              {/* Bestehende */}
              {existingUnits.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  <span className={`flex-1 font-mono text-sm px-2 py-1.5 rounded border ${
                    u.in_case_id
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}>
                    {u.seriennummer}
                    {u.in_case_id && (
                      <span className="ml-2 text-xs text-blue-400 font-sans">→ {u.in_case_id}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExisting(u.id)}
                    disabled={!!u.in_case_id}
                    title={u.in_case_id ? `In Case ${u.in_case_id} — nicht löschbar` : 'Löschen'}
                    className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Neue Eingabefelder */}
              {newSerials.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="form-input font-mono flex-1"
                    value={s}
                    onChange={e => updateSerial(idx, e.target.value)}
                    placeholder="Seriennummer eingeben…"
                  />
                  <button
                    type="button"
                    onClick={() => removeSerial(idx)}
                    className="p-1 text-gray-300 hover:text-red-500"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* + Zeile hinzufügen */}
              <button
                type="button"
                onClick={addSerial}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium pt-1"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Weitere Seriennummer
              </button>
            </div>
          )}

          {/* Technische Felder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{lbl('herstellungsland', 'Herstellungsland')}</label>
              <input className={inp('herstellungsland')} value={form.herstellungsland} onChange={e => setForm({...form, herstellungsland: e.target.value})} placeholder="z.B. DE, US" />
            </div>
            <div>
              <label className="form-label">{lbl('gewicht_kg', 'Gewicht kg/Stk')}</label>
              <input type="number" className={inp('gewicht_kg')} value={form.gewicht_kg} onChange={e => setForm({...form, gewicht_kg: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="form-label">Währung</label>
              <select className="form-select" value={form.waehrung} onChange={e => setForm({...form, waehrung: e.target.value})}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div>
              <label className="form-label">{lbl('wert_zollwert', 'Zollwert/Stk')}</label>
              <input type="number" className={inp('wert_zollwert')} value={form.wert_zollwert} onChange={e => setForm({...form, wert_zollwert: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Wiederbeschaffungswert</label>
              <input type="number" className="form-input" value={form.wert_wiederbeschaffungswert} onChange={e => setForm({...form, wert_wiederbeschaffungswert: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="form-label">Anschaffungsdatum</label>
            <input type="date" className="form-input" value={form.anschaffungsdatum} onChange={e => setForm({...form, anschaffungsdatum: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Notiz</label>
            <textarea className="form-textarea" rows={2} value={form.notiz} onChange={e => setForm({...form, notiz: e.target.value})} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add-Content Modal ─────────────────────────────────────────────────────────

function AddContentModal({ itemId, onDone, onClose }: {
  itemId: number
  onDone: () => void
  onClose: () => void
}) {
  const [materials, setMaterials] = useState<EquipmentMaterial[]>([])
  const [selected, setSelected] = useState<EquipmentMaterial | null>(null)
  const [units, setUnits] = useState<EquipmentMaterialUnit[]>([])
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { getEquipmentMaterials().then(setMaterials).catch(() => {}) }, [])

  const selectMaterial = async (mat: EquipmentMaterial) => {
    setErr('')
    if (mat.typ === 'bulk') {
      setSaving(true)
      try {
        await addToCaseContents(itemId, { material_id: mat.id, anzahl: 0 })
        onDone(); onClose()
      } catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
      return
    }
    setSelected(mat)
    setSelectedUnitIds([])
    const u = await getMaterialUnits(mat.id)
    setUnits(u.filter(u => !u.in_case_id))
  }

  const save = async () => {
    if (!selected || selectedUnitIds.length === 0) { setErr('Mindestens eine Einheit auswählen'); return }
    setSaving(true)
    try {
      await addToCaseContents(itemId, { material_unit_ids: selectedUnitIds })
      onDone(); onClose()
    } catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
  }

  const filtered = materials.filter(m =>
    !search ||
    m.produkt.toLowerCase().includes(search.toLowerCase()) ||
    (m.hersteller ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Material hinzufügen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body">
          {!selected ? (
            <>
              <input className="search-input mb-3" placeholder="Produkt oder Hersteller suchen…"
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Kein Material gefunden</p>}
                {filtered.map(mat => (
                  <button key={mat.id} onClick={() => selectMaterial(mat)} disabled={saving}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm text-gray-900">{mat.produkt}</span>
                        {mat.hersteller && <span className="text-xs text-gray-400 ml-2">{mat.hersteller}</span>}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${mat.typ === 'serial' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {mat.typ === 'serial' ? `${mat.unit_count ?? 0} Einh. frei` : 'Masse'}
                      </span>
                    </div>
                    {mat.category_name && <p className="text-xs text-gray-400 mt-0.5">{mat.category_name}</p>}
                  </button>
                ))}
              </div>
              {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            </>
          ) : (
            <div>
              <button onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline mb-3">← Zurück</button>
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                <p className="font-medium text-gray-900">{selected.produkt}</p>
                {selected.hersteller && <p className="text-xs text-gray-500">{selected.hersteller}</p>}
              </div>
              <p className="form-label mb-2">Freie Einheiten auswählen</p>
              {units.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Keine freien Einheiten vorhanden</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {units.map(u => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedUnitIds.includes(u.id)}
                        onChange={() => setSelectedUnitIds(p => p.includes(u.id) ? p.filter(id => id !== u.id) : [...p, u.id])}
                        className="accent-blue-600" />
                      <span className="font-mono text-sm font-medium">{u.seriennummer}</span>
                    </label>
                  ))}
                </div>
              )}
              {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          {selected && (
            <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">
              {saving ? 'Hinzufügen…' : 'Hinzufügen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Item-Accordion ────────────────────────────────────────────────────────────

function ItemAccordion({ item, colSpan, canEdit, onReload }: {
  item: EquipmentItem
  colSpan: number
  canEdit: boolean
  onReload: () => void
}) {
  const [detail, setDetail] = useState<(EquipmentItem & { content_count: number; content_gewicht: number; content_wert: number }) | null>(null)
  const [contents, setContents] = useState<EquipmentCaseContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([getEquipmentItemDetail(item.id), getCaseContents(item.id)])
      setDetail(d); setContents(c)
    } catch {}
    setLoading(false)
  }, [item.id])

  useEffect(() => { load() }, [load])

  const handleAnzahlChange = async (contentId: number, newAnzahl: number) => {
    if (newAnzahl < 0 || isNaN(newAnzahl)) return
    await updateCaseContent(contentId, newAnzahl)
    load(); onReload()
  }

  const handleRemove = async (contentId: number) => {
    if (!confirm('Eintrag aus diesem Case entfernen?')) return
    await removeCaseContent(contentId)
    load(); onReload()
  }

  const totalWeight = detail ? (detail.weight_empty_kg ?? 0) + (detail.content_gewicht ?? 0) : 0

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-blue-50/40 border-b border-blue-100">
        <div className="px-4 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Lädt…</p>
          ) : detail && (
            <>
              {/* Info-Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm bg-white rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Maße H×B×T</p>
                  <p className="font-medium text-gray-900 text-xs">
                    {detail.height_cm || detail.width_cm || detail.depth_cm
                      ? `${detail.height_cm ?? '?'}×${detail.width_cm ?? '?'}×${detail.depth_cm ?? '?'} cm`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Eigengewicht</p>
                  <p className="font-medium text-gray-900 text-xs">{detail.weight_empty_kg != null ? `${detail.weight_empty_kg} kg` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Gesamtgewicht</p>
                  <p className="font-semibold text-gray-900 text-xs">{totalWeight > 0 ? `${totalWeight.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Einträge</p>
                  <p className="font-medium text-gray-900 text-xs">{detail.content_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Gesamtwert</p>
                  <p className="font-semibold text-gray-900 text-xs">
                    {detail.content_wert > 0 ? `€ ${detail.content_wert.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '—'}
                  </p>
                </div>
              </div>

              {/* Inhalt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <ArchiveBoxIcon className="w-3.5 h-3.5" /> Inhalt
                  </p>
                  {canEdit && (
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
                      <PlusIcon className="w-3.5 h-3.5" /> Hinzufügen
                    </button>
                  )}
                </div>

                {contents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Noch kein Material eingepackt</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Hersteller</th>
                          <th>Produkt</th>
                          <th>Seriennummer</th>
                          <th className="text-right">Anzahl</th>
                          <th className="text-right">Wert</th>
                          <th className="text-right">Gewicht</th>
                          {canEdit && <th style={{ width: 36 }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {contents.map(c => {
                          const gewicht = c.gewicht_kg != null ? c.gewicht_kg * (c.typ === 'bulk' ? c.anzahl : 1) : null
                          const wert = c.wert_zollwert != null ? c.wert_zollwert * (c.typ === 'bulk' ? c.anzahl : 1) : null
                          return (
                            <tr key={c.id}>
                              <td className="text-gray-500 text-xs">{c.hersteller || '—'}</td>
                              <td className="font-medium text-sm">{c.produkt}</td>
                              <td>
                                {c.seriennummer
                                  ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.seriennummer}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-right">
                                {c.typ === 'bulk' ? (
                                  canEdit ? (
                                    <input type="number" className="form-input text-right w-16 ml-auto"
                                      value={c.anzahl} min={0}
                                      onChange={e => handleAnzahlChange(c.id, parseInt(e.target.value))} />
                                  ) : c.anzahl
                                ) : <span className="text-gray-400 text-xs">1</span>}
                              </td>
                              <td className="text-right text-xs">
                                {wert != null ? `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${c.waehrung}` : '—'}
                              </td>
                              <td className="text-right text-xs">
                                {gewicht != null ? `${gewicht.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg` : '—'}
                              </td>
                              {canEdit && (
                                <td>
                                  <button onClick={() => handleRemove(c.id)} className="p-1 text-gray-300 hover:text-red-500">
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {showAddModal && (
          <AddContentModal itemId={item.id} onDone={() => { load(); onReload() }} onClose={() => setShowAddModal(false)} />
        )}
      </td>
    </tr>
  )
}

// ── Carnet ATA Pflichtfeld-Check ─────────────────────────────────────────────

export const CARNET_REQUIRED_FIELDS: (keyof EquipmentMaterial)[] = [
  'hersteller', 'produkt', 'info', 'herstellungsland', 'gewicht_kg', 'wert_zollwert', 'waehrung'
]

export function carnetMissingFields(mat: Partial<EquipmentMaterial>): string[] {
  const labels: Record<string, string> = {
    hersteller: 'Hersteller', produkt: 'Produkt', info: 'Beschreibung',
    herstellungsland: 'Herstellungsland', gewicht_kg: 'Gewicht/Stk',
    wert_zollwert: 'Zollwert/Stk', waehrung: 'Währung',
  }
  return CARNET_REQUIRED_FIELDS
    .filter(f => mat[f] == null || mat[f] === '' || mat[f] === 0)
    .map(f => labels[f] ?? f)
}

// ── Equipment-Settings Modal ──────────────────────────────────────────────────

function EquipmentSettingsModal({ carnetEnabled, onSave, onClose }: {
  carnetEnabled: boolean
  onSave: (enabled: boolean) => Promise<void>
  onClose: () => void
}) {
  const [enabled, setEnabled] = useState(carnetEnabled)
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    setSaving(true)
    await onSave(enabled)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Equipment Einstellungen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="mt-0.5 accent-blue-600 w-4 h-4"
            />
            <div>
              <p className="font-medium text-gray-900 text-sm">Carnet ATA</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pflichtfelder für Carnet ATA werden beim Material markiert:
                Hersteller, Beschreibung, Herstellungsland, Gewicht, Zollwert.
                Fehlende Angaben werden farblich hervorgehoben.
              </p>
            </div>
          </label>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Modul ───────────────────────────────────────────────────────────────

export default function EquipmentModule({ activeSubTab }: { activeSubTab?: string }) {
  const activeTab = activeSubTab || 'items'
  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [materials, setMaterials] = useState<EquipmentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null)
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>('case_id')
  const [itemSortDir, setItemSortDir] = useState<'asc' | 'desc'>('asc')
  const { isVisible, toggle, columns: itemColumns } = useColumnVisibility('equipment-items', ITEMS_COLUMNS)
  const [matSortKey, setMatSortKey] = useState<MatSortKey>('produkt')
  const [matSortDir, setMatSortDir] = useState<'asc' | 'desc'>('asc')
  const { isVisible: isMatVisible, toggle: toggleMatCol, columns: matColumns } = useColumnVisibility('equipment-materials', MATERIAL_COLUMNS)

  const toggleMatSort = (key: MatSortKey) => {
    if (key === matSortKey) setMatSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setMatSortKey(key); setMatSortDir('asc') }
  }

  const toggleItemSort = (key: ItemSortKey) => {
    if (key === itemSortKey) setItemSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setItemSortKey(key); setItemSortDir('asc') }
  }

  const [catModal, setCatModal] = useState<{ open: boolean; cat: EquipmentCategory | null }>({ open: false, cat: null })
  const [itemModal, setItemModal] = useState<{ open: boolean; item: EquipmentItem | null }>({ open: false, item: null })
  const [matModal, setMatModal] = useState<{ open: boolean; mat: EquipmentMaterial | null }>({ open: false, mat: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [carnetEnabled, setCarnetEnabled] = useState(false)

  const role = getEffectiveRole()
  const canEdit = canDo(role, ['admin', 'agency', 'tourmanagement'])

  const load = async (silent = false) => {
    const scrollY = silent ? window.scrollY : 0
    if (!silent) setLoading(true)
    try {
      const [k, cats, itms, mats, settings] = await Promise.all([
        initEquipmentKuerzel(),
        getEquipmentCategories(),
        getEquipmentItems(),
        getEquipmentMaterials(),
        getEquipmentSettings(),
      ])
      setKuerzel(k)
      setCategories(cats)
      setItems(itms)
      setMaterials(mats)
      setCarnetEnabled(settings.carnet_ata_enabled)
    } catch {}
    if (!silent) setLoading(false)
    if (silent) requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setSearch('') }, [activeTab])

  // ── Gegenstände ──────────────────────────────────────────────────────────────
  const sortedItems = useMemo(() => {
    const filtered = items.filter(i =>
      !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.case_id.toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (itemSortKey === 'weight_empty_kg') { av = a.weight_empty_kg ?? 0; bv = b.weight_empty_kg ?? 0 }
      else if (itemSortKey === 'material_count') { av = a.material_count ?? 0; bv = b.material_count ?? 0 }
      else if (itemSortKey === 'load_order') { av = a.load_order ?? 9999; bv = b.load_order ?? 9999 }
      else { av = (a[itemSortKey] ?? '').toString().toLowerCase(); bv = (b[itemSortKey] ?? '').toString().toLowerCase() }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return itemSortDir === 'asc' ? cmp : -cmp
    })
  }, [items, search, itemSortKey, itemSortDir])

  const renderItems = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {canEdit && (
          <button onClick={() => setItemModal({ open: true, item: null })} className="btn btn-primary">
            <PlusIcon className="w-4 h-4" />
            Neuer Gegenstand
          </button>
        )}
        <input
          type="text"
          className="search-input"
          placeholder="Gegenstände durchsuchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="data-table-wrapper">
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Lädt…</div>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="text-center py-12">
          <ArchiveBoxIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Gegenstände angelegt</p>
          {canEdit && (
            <button onClick={() => setItemModal({ open: true, item: null })}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Ersten Gegenstand anlegen
            </button>
          )}
        </div>
      ) : (() => {
        const visibleColCount = ITEMS_COLUMNS.filter(c => isVisible(c.id)).length + 1 // +1 für Actions
        return (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {isVisible('case_id')   && <th className="sortable" onClick={() => toggleItemSort('case_id')}>Case ID <SortIndicator active={itemSortKey === 'case_id'} dir={itemSortDir} /></th>}
                {isVisible('name')      && <th className="sortable" onClick={() => toggleItemSort('name')}>Name <SortIndicator active={itemSortKey === 'name'} dir={itemSortDir} /></th>}
                {isVisible('typ')       && <th className="sortable" onClick={() => toggleItemSort('typ')}>Typ <SortIndicator active={itemSortKey === 'typ'} dir={itemSortDir} /></th>}
                {isVisible('category')  && <th className="sortable" onClick={() => toggleItemSort('category_name')}>Kategorie <SortIndicator active={itemSortKey === 'category_name'} dir={itemSortDir} /></th>}
                {isVisible('position')  && <th className="sortable" onClick={() => toggleItemSort('position')}>Position <SortIndicator active={itemSortKey === 'position'} dir={itemSortDir} /></th>}
                {isVisible('masse')     && <th className="text-right">Maße H×B×T cm</th>}
                {isVisible('leer_kg')   && <th className="sortable text-right" onClick={() => toggleItemSort('weight_empty_kg')}>Leer kg <SortIndicator active={itemSortKey === 'weight_empty_kg'} dir={itemSortDir} /></th>}
                {isVisible('material')  && <th className="sortable text-right" onClick={() => toggleItemSort('material_count')}>Material <SortIndicator active={itemSortKey === 'material_count'} dir={itemSortDir} /></th>}
                {isVisible('gesamt_kg') && <th className="text-right">Gesamt kg</th>}
                <th style={{ width: 72 }}>
                  <ColumnToggle columns={itemColumns} isVisible={isVisible} toggle={toggle} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => {
                const totalWeight = (item.weight_empty_kg ?? 0) + (item.material_gewicht ?? 0)
                const isExpanded = expandedItemId === item.id
                return (
                  <>
                    <tr key={item.id} className="clickable" onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                      {isVisible('case_id')   && <td><span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{item.case_id}</span></td>}
                      {isVisible('name')      && <td className="font-medium">{item.name}</td>}
                      {isVisible('typ')       && <td><span className="badge">{TYP_LABELS[item.typ] ?? item.typ}</span></td>}
                      {isVisible('category')  && <td>{item.category_name ?? '—'}</td>}
                      {isVisible('position')  && <td>{item.position ? POSITION_LABELS[item.position] ?? item.position : '—'}</td>}
                      {isVisible('masse')     && <td className="text-right text-xs text-gray-600">
                        {item.height_cm || item.width_cm || item.depth_cm
                          ? `${item.height_cm ?? '?'} × ${item.width_cm ?? '?'} × ${item.depth_cm ?? '?'}`
                          : '—'}
                      </td>}
                      {isVisible('leer_kg')   && <td className="text-right">{fmt(item.weight_empty_kg, ' kg')}</td>}
                      {isVisible('material')  && <td className="text-right">{item.material_count ? `${item.material_count}×` : '—'}</td>}
                      {isVisible('gesamt_kg') && <td className="text-right font-medium">{totalWeight > 0 ? `${totalWeight.toLocaleString('de-DE')} kg` : '—'}</td>}
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end items-center">
                          {canEdit && (
                            <button onClick={() => setItemModal({ open: true, item })} className="p-1 text-gray-400 hover:text-blue-600">
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={async () => {
                              if (!confirm(`${item.case_id} — ${item.name} wirklich löschen?`)) return
                              await deleteEquipmentItem(item.id)
                              load(true)
                            }} className="p-1 text-gray-400 hover:text-red-600">
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isExpanded
                            ? <ChevronDownIcon className="w-3.5 h-3.5 text-blue-400" />
                            : <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <ItemAccordion
                        key={`acc-${item.id}`}
                        item={item}
                        colSpan={visibleColCount}
                        canEdit={canEdit}
                        onReload={load}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      })()}
    </div>
  )

  // ── Material ─────────────────────────────────────────────────────────────────
  const sortedMaterials = useMemo(() => {
    const filtered = materials.filter(m =>
      !search || m.produkt.toLowerCase().includes(search.toLowerCase()) ||
      (m.hersteller ?? '').toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (matSortKey === 'unit_count') { av = a.unit_count ?? 0; bv = b.unit_count ?? 0 }
      else if (matSortKey === 'wert_zollwert') { av = a.wert_zollwert ?? 0; bv = b.wert_zollwert ?? 0 }
      else if (matSortKey === 'gewicht_kg') { av = a.gewicht_kg ?? 0; bv = b.gewicht_kg ?? 0 }
      else { av = (a[matSortKey] ?? '').toString().toLowerCase(); bv = (b[matSortKey] ?? '').toString().toLowerCase() }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return matSortDir === 'asc' ? cmp : -cmp
    })
  }, [materials, search, matSortKey, matSortDir])

  const CSV_HEADERS = ['Hersteller', 'Produkt', 'Info', 'Typ', 'Kategorie', 'Herstellungsland', 'Gewicht_kg', 'Zollwert', 'Wiederbeschaffungswert', 'Waehrung', 'Anschaffungsdatum', 'Notiz']

  const exportMaterialsCSV = () => {
    const q = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [
      CSV_HEADERS.join(';'),
      ...sortedMaterials.map(m => [
        q(m.hersteller), q(m.produkt), q(m.info), q(m.typ),
        q(m.category_name), q(m.herstellungsland),
        q(m.gewicht_kg), q(m.wert_zollwert), q(m.wert_wiederbeschaffungswert),
        q(m.waehrung), q(m.anschaffungsdatum), q(m.notiz),
      ].join(';')),
    ].join('\n')
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `material_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const importMaterialsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text).slice(1) // Header überspringen
      let count = 0
      for (const row of rows) {
        if (!col(row, 1)) continue // Produkt Pflicht
        try {
          // Kategorie per Name suchen
          const catName = col(row, 4)
          const cat = catName ? categories.find(c => c.name.toLowerCase() === catName.toLowerCase()) : undefined
          const n = (v: string) => v === '' ? null : parseFloat(v)
          await createEquipmentMaterial({
            hersteller:             col(row, 0) || null,
            produkt:                col(row, 1),
            info:                   col(row, 2) || null,
            typ:                    (col(row, 3) === 'serial' ? 'serial' : 'bulk') as 'serial' | 'bulk',
            category_id:            cat?.id ?? null,
            herstellungsland:       col(row, 5) || null,
            gewicht_kg:             n(col(row, 6)),
            wert_zollwert:          n(col(row, 7)),
            wert_wiederbeschaffungswert: n(col(row, 8)),
            waehrung:               col(row, 9) || 'EUR',
            anschaffungsdatum:      col(row, 10) || null,
            notiz:                  col(row, 11) || null,
          })
          count++
        } catch {}
      }
      if (count > 0) { alert(`${count} Material-Einträge importiert.`); load(true) }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const renderMaterials = () => (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-between items-center">
          <button onClick={() => setMatModal({ open: true, mat: null })} className="btn btn-primary">
            <PlusIcon className="w-4 h-4" />
            Neues Material
          </button>
          <div className="flex gap-3">
            <button onClick={exportMaterialsCSV} className="btn btn-ghost">
              <ArrowDownTrayIcon className="w-4 h-4" />
              CSV
            </button>
            <label className="btn btn-ghost cursor-pointer">
              <ArrowUpTrayIcon className="w-4 h-4" />
              CSV
              <input type="file" accept=".csv" onChange={importMaterialsCSV} className="hidden" />
            </label>
          </div>
        </div>
      )}
      <input
        type="text"
        className="search-input"
        placeholder="Material durchsuchen…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="data-table-wrapper">
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Lädt…</div>
        </div>
      ) : sortedMaterials.length === 0 ? (
        <div className="text-center py-12">
          <WrenchScrewdriverIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch kein Material angelegt</p>
          {canEdit && (
            <button onClick={() => setMatModal({ open: true, mat: null })}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Erstes Material anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {carnetEnabled && <th style={{ width: 24 }} title="Carnet ATA Status" />}
                {isMatVisible('hersteller') && <th className="sortable" onClick={() => toggleMatSort('hersteller')}>Hersteller <SortIndicator active={matSortKey === 'hersteller'} dir={matSortDir} /></th>}
                {isMatVisible('produkt')    && <th className="sortable" onClick={() => toggleMatSort('produkt')}>Produkt <SortIndicator active={matSortKey === 'produkt'} dir={matSortDir} /></th>}
                {isMatVisible('category')   && <th className="sortable" onClick={() => toggleMatSort('category_name')}>Kategorie <SortIndicator active={matSortKey === 'category_name'} dir={matSortDir} /></th>}
                {isMatVisible('typ')        && <th className="sortable" onClick={() => toggleMatSort('typ')}>Typ <SortIndicator active={matSortKey === 'typ'} dir={matSortDir} /></th>}
                {isMatVisible('einheiten')  && <th className="sortable text-right" onClick={() => toggleMatSort('unit_count')}>Einheiten <SortIndicator active={matSortKey === 'unit_count'} dir={matSortDir} /></th>}
                {isMatVisible('land')       && <th className="sortable" onClick={() => toggleMatSort('herstellungsland')}>Land <SortIndicator active={matSortKey === 'herstellungsland'} dir={matSortDir} /></th>}
                {isMatVisible('wert')       && <th className="sortable text-right" onClick={() => toggleMatSort('wert_zollwert')}>Wert/Stk <SortIndicator active={matSortKey === 'wert_zollwert'} dir={matSortDir} /></th>}
                {isMatVisible('gewicht')    && <th className="sortable text-right" onClick={() => toggleMatSort('gewicht_kg')}>Gewicht/Stk <SortIndicator active={matSortKey === 'gewicht_kg'} dir={matSortDir} /></th>}
                <th style={{ width: 60 }}>
                  <ColumnToggle columns={matColumns} isVisible={isMatVisible} toggle={toggleMatCol} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMaterials.map(mat => {
                const missing = carnetEnabled ? carnetMissingFields(mat) : []
                const hasWarning = missing.length > 0
                const warnField = (field: string) => hasWarning && missing.includes(field)
                return (
                  <tr key={mat.id} className={`hoverable${hasWarning ? ' bg-red-50' : ''}`}>
                    {carnetEnabled && (
                      <td className="text-center" style={{ width: 24 }}>
                        {hasWarning && (
                          <ExclamationTriangleIcon
                            className="w-3.5 h-3.5 text-red-400 inline"
                            title={`Carnet: ${missing.length} Feld${missing.length !== 1 ? 'er' : ''} fehlt`}
                          />
                        )}
                      </td>
                    )}
                    {isMatVisible('hersteller') && <td className={warnField('hersteller') ? 'text-red-500 font-medium' : 'text-gray-500'}>
                      {mat.hersteller || '—'}
                    </td>}
                    {isMatVisible('produkt')    && <td className={`font-medium${warnField('produkt') ? ' text-red-500' : ''}`}>
                      {mat.produkt}
                    </td>}
                    {isMatVisible('category')   && <td>{mat.category_name ?? '—'}</td>}
                    {isMatVisible('typ')        && <td>
                      <span className={`badge ${mat.typ === 'serial' ? 'badge-blue' : ''}`}>
                        {mat.typ === 'serial' ? 'Serienartikel' : 'Massenartikel'}
                      </span>
                    </td>}
                    {isMatVisible('einheiten')  && <td className="text-right font-medium">
                      {mat.typ === 'serial' ? `${mat.unit_count ?? 0}×` : '∞'}
                    </td>}
                    {isMatVisible('land')       && <td className={warnField('herstellungsland') ? 'text-red-500 font-medium' : ''}>
                      {mat.herstellungsland || '—'}
                    </td>}
                    {isMatVisible('wert')       && <td className={`text-right${warnField('wert_zollwert') || warnField('waehrung') ? ' text-red-500 font-medium' : ''}`}>
                      {mat.wert_zollwert != null ? `${mat.wert_zollwert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mat.waehrung}` : '—'}
                    </td>}
                    {isMatVisible('gewicht')    && <td className={`text-right${warnField('gewicht_kg') ? ' text-red-500 font-medium' : ''}`}>
                      {mat.gewicht_kg != null ? `${mat.gewicht_kg.toLocaleString('de-DE')} kg` : '—'}
                    </td>}
                    <td>
                      {canEdit && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setMatModal({ open: true, mat })} className="p-1 text-gray-400 hover:text-blue-600">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`${mat.hersteller ? mat.hersteller + ' ' : ''}${mat.produkt} wirklich löschen?`)) return
                            await deleteEquipmentMaterial(mat.id)
                            load(true)
                          }} className="p-1 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ── Kategorien ────────────────────────────────────────────────────────────────
  const renderCategories = () => (
    <div className="space-y-4 max-w-md">
      {canEdit && (
        <button onClick={() => setCatModal({ open: true, cat: null })} className="btn btn-primary">
          <PlusIcon className="w-4 h-4" />
          Neue Kategorie
        </button>
      )}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <TagIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Kategorien angelegt</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kürzel</th>
                <th>Name</th>
                {canEdit && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td><span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{cat.kuerzel}</span></td>
                  <td className="font-medium">{cat.name}</td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setCatModal({ open: true, cat })} className="p-1 text-gray-400 hover:text-blue-600">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Kategorie "${cat.name}" löschen?`)) return
                          await deleteEquipmentCategory(cat.id)
                          load(true)
                        }} className="p-1 text-gray-400 hover:text-red-600">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-5 h-5 text-orange-500" />
            Equipment
            <span className="text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">ADDON</span>
            {carnetEnabled && (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Carnet ATA</span>
            )}
          </h1>
          {kuerzel && (
            <p className="text-xs text-gray-400 mt-0.5">
              Kürzel: <span className="font-mono font-semibold text-gray-600">{kuerzel}</span>
              {' · '}{items.length} Gegenstände · {materials.length} Material-Einträge
            </p>
          )}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Equipment Einstellungen"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
      </div>

      {activeTab === 'items'      && renderItems()}
      {activeTab === 'materials'  && renderMaterials()}
      {activeTab === 'categories' && renderCategories()}

      {settingsOpen && (
        <EquipmentSettingsModal
          carnetEnabled={carnetEnabled}
          onSave={async (enabled) => {
            await updateEquipmentSettings({ carnet_ata_enabled: enabled })
            setCarnetEnabled(enabled)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {catModal.open && (
        <CategoryModal
          cat={catModal.cat}
          onSave={async data => {
            if (catModal.cat) await updateEquipmentCategory(catModal.cat.id, data)
            else await createEquipmentCategory(data)
            load(true)
          }}
          onClose={() => setCatModal({ open: false, cat: null })}
        />
      )}
      {itemModal.open && (
        <ItemModal
          item={itemModal.item}
          categories={categories}
          onSave={async data => {
            if (itemModal.item) await updateEquipmentItem(itemModal.item.id, data)
            else await createEquipmentItem(data)
            load(true)
          }}
          onClose={() => setItemModal({ open: false, item: null })}
        />
      )}
      {matModal.open && (
        <MaterialModal
          mat={matModal.mat}
          categories={categories}
          carnetEnabled={carnetEnabled}
          onSave={async data => {
            let id: number
            if (matModal.mat) {
              await updateEquipmentMaterial(matModal.mat.id, data)
              id = matModal.mat.id
            } else {
              const m = await createEquipmentMaterial(data)
              id = m.id
            }
            load(true)
            return id
          }}
          onClose={() => setMatModal({ open: false, mat: null })}
        />
      )}
    </div>
  )
}
