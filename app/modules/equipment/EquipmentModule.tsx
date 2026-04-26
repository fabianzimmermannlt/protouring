'use client'

import { useState, useEffect, useRef } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { WrenchScrewdriverIcon, ArchiveBoxIcon, TagIcon } from '@heroicons/react/24/outline'
import {
  getEquipmentCategories, createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
  getEquipmentItems, createEquipmentItem, updateEquipmentItem, deleteEquipmentItem,
  getEquipmentMaterials, createEquipmentMaterial, updateEquipmentMaterial, deleteEquipmentMaterial,
  initEquipmentKuerzel,
  canDo, getEffectiveRole,
  type EquipmentCategory, type EquipmentItem, type EquipmentMaterial,
} from '@/lib/api-client'

const TABS = [
  { id: 'items',      label: 'Gegenstände', icon: ArchiveBoxIcon },
  { id: 'materials',  label: 'Material',    icon: WrenchScrewdriverIcon },
  { id: 'categories', label: 'Kategorien',  icon: TagIcon },
]

const TYP_LABELS: Record<string, string> = {
  case: 'Case', dolly: 'Dolly', kulisse: 'Kulisse', flightcase: 'Flightcase', sonstiges: 'Sonstiges'
}
const POSITION_LABELS: Record<string, string> = {
  sl: 'Stage Left', sr: 'Stage Right', foh: 'FOH', drums: 'Drums', backline: 'Backline', truck: 'Truck', sonstiges: 'Sonstiges'
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{cat ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Audio" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Kürzel <span className="text-gray-400 font-normal">(max. 5 Zeichen)</span></label>
            <input className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
              value={kuerzel} onChange={e => setKuerzel(e.target.value.toUpperCase().slice(0, 5))} placeholder="AUD" maxLength={5} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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

  const inp = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
  const sel = inp + ' bg-white'
  const lbl = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {item ? `${item.case_id} bearbeiten` : 'Neuer Gegenstand'}
          </h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={lbl}>Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="z.B. FOH-Rack" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Typ</label>
              <select className={sel} value={form.typ} onChange={e => setForm({...form, typ: e.target.value as any})}>
                {Object.entries(TYP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Kategorie</label>
              <select className={sel} value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">— keine —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Position (Bühne)</label>
              <select className={sel} value={form.position} onChange={e => setForm({...form, position: e.target.value})}>
                <option value="">— keine —</option>
                {Object.entries(POSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Ladereihenfolge</label>
              <input type="number" className={inp} value={form.load_order} onChange={e => setForm({...form, load_order: e.target.value})} placeholder="1" min={1} />
            </div>
          </div>
          <div>
            <label className={lbl}>Maße (cm) — Höhe / Breite / Tiefe</label>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" className={inp} value={form.height_cm} onChange={e => setForm({...form, height_cm: e.target.value})} placeholder="H" />
              <input type="number" className={inp} value={form.width_cm} onChange={e => setForm({...form, width_cm: e.target.value})} placeholder="B" />
              <input type="number" className={inp} value={form.depth_cm} onChange={e => setForm({...form, depth_cm: e.target.value})} placeholder="T" />
            </div>
          </div>
          <div>
            <label className={lbl}>Leergewicht (kg)</label>
            <input type="number" className={inp} value={form.weight_empty_kg} onChange={e => setForm({...form, weight_empty_kg: e.target.value})} placeholder="0.0" step="0.1" />
          </div>
          <div>
            <label className={lbl}>Notiz</label>
            <textarea className={inp} rows={2} value={form.notiz} onChange={e => setForm({...form, notiz: e.target.value})} placeholder="Interne Notizen…" />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Material-Modal ────────────────────────────────────────────────────────────

function MaterialModal({ mat, items, categories, onSave, onClose }: {
  mat: EquipmentMaterial | null
  items: EquipmentItem[]
  categories: EquipmentCategory[]
  onSave: (data: Partial<EquipmentMaterial>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    item_id:               mat?.item_id != null ? String(mat.item_id) : '',
    hersteller:            mat?.hersteller ?? '',
    produkt:               mat?.produkt ?? '',
    info:                  mat?.info ?? '',
    category_id:           mat?.category_id != null ? String(mat.category_id) : '',
    anzahl:                mat?.anzahl != null ? String(mat.anzahl) : '1',
    seriennummer:          mat?.seriennummer ?? '',
    herstellungsland:      mat?.herstellungsland ?? '',
    wert_zeitwert:         mat?.wert_zeitwert != null ? String(mat.wert_zeitwert) : '',
    wert_wiederbeschaffung: mat?.wert_wiederbeschaffung != null ? String(mat.wert_wiederbeschaffung) : '',
    waehrung:              mat?.waehrung ?? 'EUR',
    gewicht_kg:            mat?.gewicht_kg != null ? String(mat.gewicht_kg) : '',
    anschaffungsdatum:     mat?.anschaffungsdatum ?? '',
    notiz:                 mat?.notiz ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const n = (v: string) => v === '' ? null : parseFloat(v)

  const handle = async () => {
    if (!form.produkt.trim()) { setErr('Produkt ist Pflicht'); return }
    setSaving(true)
    try {
      await onSave({
        item_id:               form.item_id ? Number(form.item_id) : null,
        hersteller:            form.hersteller || null,
        produkt:               form.produkt.trim(),
        info:                  form.info || null,
        category_id:           form.category_id ? Number(form.category_id) : null,
        anzahl:                parseInt(form.anzahl, 10) || 1,
        seriennummer:          form.seriennummer || null,
        herstellungsland:      form.herstellungsland || null,
        wert_zeitwert:         n(form.wert_zeitwert),
        wert_wiederbeschaffung: n(form.wert_wiederbeschaffung),
        waehrung:              form.waehrung,
        gewicht_kg:            n(form.gewicht_kg),
        anschaffungsdatum:     form.anschaffungsdatum || null,
        notiz:                 form.notiz || null,
      })
      onClose()
    } catch (e: any) { setErr(e.message || 'Fehler'); setSaving(false) }
  }

  const inp = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500'
  const sel = inp + ' bg-white'
  const lbl = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{mat ? 'Material bearbeiten' : 'Neues Material'}</h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Hersteller</label>
              <input className={inp} value={form.hersteller} onChange={e => setForm({...form, hersteller: e.target.value})} placeholder="z.B. Shure" autoFocus />
            </div>
            <div>
              <label className={lbl}>Produkt *</label>
              <input className={inp} value={form.produkt} onChange={e => setForm({...form, produkt: e.target.value})} placeholder="z.B. SM58" />
            </div>
          </div>
          <div>
            <label className={lbl}>Beschreibung / Info</label>
            <input className={inp} value={form.info} onChange={e => setForm({...form, info: e.target.value})} placeholder="Kurzbeschreibung für Carnet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Kategorie</label>
              <select className={sel} value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">— keine —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>In Gegenstand</label>
              <select className={sel} value={form.item_id} onChange={e => setForm({...form, item_id: e.target.value})}>
                <option value="">— kein Case —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.case_id} — {i.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Anzahl</label>
              <input type="number" className={inp} value={form.anzahl} onChange={e => setForm({...form, anzahl: e.target.value})} min={1} />
            </div>
            <div>
              <label className={lbl}>Seriennummer</label>
              <input className={inp} value={form.seriennummer} onChange={e => setForm({...form, seriennummer: e.target.value})} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Herstellungsland</label>
              <input className={inp} value={form.herstellungsland} onChange={e => setForm({...form, herstellungsland: e.target.value})} placeholder="z.B. DE, US" />
            </div>
            <div>
              <label className={lbl}>Gewicht (kg, pro Stück)</label>
              <input type="number" className={inp} value={form.gewicht_kg} onChange={e => setForm({...form, gewicht_kg: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className={lbl}>Währung</label>
              <select className={sel} value={form.waehrung} onChange={e => setForm({...form, waehrung: e.target.value})}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Zeitwert</label>
              <input type="number" className={inp} value={form.wert_zeitwert} onChange={e => setForm({...form, wert_zeitwert: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
            <div>
              <label className={lbl}>Wiederbeschaffung</label>
              <input type="number" className={inp} value={form.wert_wiederbeschaffung} onChange={e => setForm({...form, wert_wiederbeschaffung: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className={lbl}>Anschaffungsdatum</label>
            <input type="date" className={inp} value={form.anschaffungsdatum} onChange={e => setForm({...form, anschaffungsdatum: e.target.value})} />
          </div>
          <div>
            <label className={lbl}>Notiz</label>
            <textarea className={inp} rows={2} value={form.notiz} onChange={e => setForm({...form, notiz: e.target.value})} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Abbrechen</button>
          <button onClick={handle} disabled={saving} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Modul ───────────────────────────────────────────────────────────────

export default function EquipmentModule() {
  const [activeTab, setActiveTab] = useState('items')
  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [materials, setMaterials] = useState<EquipmentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kuerzel, setKuerzel] = useState('')

  // Modal-States
  const [catModal, setCatModal] = useState<{ open: boolean; cat: EquipmentCategory | null }>({ open: false, cat: null })
  const [itemModal, setItemModal] = useState<{ open: boolean; item: EquipmentItem | null }>({ open: false, item: null })
  const [matModal, setMatModal] = useState<{ open: boolean; mat: EquipmentMaterial | null }>({ open: false, mat: null })

  const role = getEffectiveRole()
  const canEdit = canDo(role, ['admin', 'agency', 'tourmanagement'])

  const load = async () => {
    setLoading(true)
    try {
      // Kürzel: beim ersten Öffnen automatisch generieren lassen (POST /api/equipment/init)
      // init gibt vorhandenes zurück oder erstellt eines — idempotent
      const [k, cats, itms, mats] = await Promise.all([
        initEquipmentKuerzel(),
        getEquipmentCategories(),
        getEquipmentItems(),
        getEquipmentMaterials(),
      ])
      setKuerzel(k)
      setCategories(cats)
      setItems(itms)
      setMaterials(mats)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Gegenstände-Tab ──────────────────────────────────────────────────────
  const filteredItems = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.case_id.toLowerCase().includes(search.toLowerCase())
  )

  const renderItems = () => (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <button onClick={() => setItemModal({ open: true, item: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <PlusIcon className="w-4 h-4" />
            Gegenstand
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Lädt…</div>
      ) : filteredItems.length === 0 ? (
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
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Name</th>
                <th>Typ</th>
                <th>Kategorie</th>
                <th>Position</th>
                <th className="text-right">Maße (H×B×T cm)</th>
                <th className="text-right">Leer kg</th>
                <th className="text-right">Material</th>
                <th className="text-right">Gesamtgewicht</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const totalWeight = (item.weight_empty_kg ?? 0) + (item.material_gewicht ?? 0)
                return (
                  <tr key={item.id}>
                    <td><span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{item.case_id}</span></td>
                    <td className="font-medium">{item.name}</td>
                    <td><span className="badge">{TYP_LABELS[item.typ] ?? item.typ}</span></td>
                    <td>{item.category_name ? <span className="text-xs text-gray-600">{item.category_name}</span> : <span className="text-gray-300">—</span>}</td>
                    <td>{item.position ? <span className="text-xs text-gray-600">{POSITION_LABELS[item.position] ?? item.position}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="text-right text-xs text-gray-600">
                      {item.height_cm || item.width_cm || item.depth_cm
                        ? `${item.height_cm ?? '?'} × ${item.width_cm ?? '?'} × ${item.depth_cm ?? '?'}`
                        : '—'}
                    </td>
                    <td className="text-right text-xs">{fmt(item.weight_empty_kg, ' kg')}</td>
                    <td className="text-right text-xs">{item.material_count ? `${item.material_count} Items` : '—'}</td>
                    <td className="text-right text-xs font-medium">{totalWeight > 0 ? `${totalWeight.toLocaleString('de-DE')} kg` : '—'}</td>
                    {canEdit && (
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setItemModal({ open: true, item })} className="p-1 text-gray-400 hover:text-blue-600">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`${item.case_id} — ${item.name} wirklich löschen?`)) return
                            await deleteEquipmentItem(item.id)
                            load()
                          }} className="p-1 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
  )

  // ── Material-Tab ─────────────────────────────────────────────────────────
  const filteredMaterials = materials.filter(m =>
    !search || m.produkt.toLowerCase().includes(search.toLowerCase()) ||
    (m.hersteller ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (m.case_id ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const renderMaterials = () => (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <button onClick={() => setMatModal({ open: true, mat: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <PlusIcon className="w-4 h-4" />
            Material
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Lädt…</div>
      ) : filteredMaterials.length === 0 ? (
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
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Hersteller</th>
                <th>Produkt</th>
                <th>Kategorie</th>
                <th>In Case</th>
                <th className="text-right">Anzahl</th>
                <th>Seriennummer</th>
                <th>Herstellungsland</th>
                <th className="text-right">Zeitwert</th>
                <th className="text-right">Gewicht</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map(mat => (
                <tr key={mat.id}>
                  <td className="text-xs text-gray-500">{mat.hersteller || '—'}</td>
                  <td className="font-medium">{mat.produkt}</td>
                  <td>{mat.category_name ? <span className="text-xs text-gray-600">{mat.category_name}</span> : <span className="text-gray-300">—</span>}</td>
                  <td>{mat.case_id ? <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1 py-0.5 rounded">{mat.case_id}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="text-right text-sm font-medium">{mat.anzahl}</td>
                  <td className="text-xs font-mono text-gray-600">{mat.seriennummer || '—'}</td>
                  <td className="text-xs text-gray-600">{mat.herstellungsland || '—'}</td>
                  <td className="text-right text-xs">
                    {mat.wert_zeitwert != null ? `${mat.wert_zeitwert.toLocaleString('de-DE')} ${mat.waehrung}` : '—'}
                  </td>
                  <td className="text-right text-xs">
                    {mat.gewicht_kg != null ? `${(mat.gewicht_kg * mat.anzahl).toLocaleString('de-DE')} kg` : '—'}
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setMatModal({ open: true, mat })} className="p-1 text-gray-400 hover:text-blue-600">
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`${mat.hersteller ? mat.hersteller + ' ' : ''}${mat.produkt} wirklich löschen?`)) return
                          await deleteEquipmentMaterial(mat.id)
                          load()
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

  // ── Kategorien-Tab ───────────────────────────────────────────────────────
  const renderCategories = () => (
    <div className="max-w-md">
      {canEdit && (
        <button onClick={() => setCatModal({ open: true, cat: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-4">
          <PlusIcon className="w-4 h-4" />
          Kategorie
        </button>
      )}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <TagIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Noch keine Kategorien angelegt</p>
        </div>
      ) : (
        <div className="space-y-1">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-lg">
              <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded w-14 text-center">{cat.kuerzel}</span>
              <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setCatModal({ open: true, cat })} className="p-1 text-gray-400 hover:text-blue-600">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={async () => {
                    if (!confirm(`Kategorie "${cat.name}" löschen?`)) return
                    await deleteEquipmentCategory(cat.id)
                    load()
                  }} className="p-1 text-gray-400 hover:text-red-600">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-5 h-5 text-orange-500" />
            Equipment
            <span className="text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded ml-1">ADDON</span>
          </h1>
          {kuerzel && (
            <p className="text-xs text-gray-400 mt-0.5">
              Kürzel: <span className="font-mono font-semibold text-gray-600">{kuerzel}</span>
              {' · '}{items.length} Gegenstände · {materials.length} Material-Einträge
            </p>
          )}
        </div>
      </div>

      {/* Tab-Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'items' && items.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{items.length}</span>
            )}
            {tab.id === 'materials' && materials.length > 0 && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{materials.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab-Inhalt */}
      {activeTab === 'items'      && renderItems()}
      {activeTab === 'materials'  && renderMaterials()}
      {activeTab === 'categories' && renderCategories()}

      {/* Modals */}
      {catModal.open && (
        <CategoryModal
          cat={catModal.cat}
          onSave={async data => {
            if (catModal.cat) await updateEquipmentCategory(catModal.cat.id, data)
            else await createEquipmentCategory(data)
            load()
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
            load()
          }}
          onClose={() => setItemModal({ open: false, item: null })}
        />
      )}
      {matModal.open && (
        <MaterialModal
          mat={matModal.mat}
          items={items}
          categories={categories}
          onSave={async data => {
            if (matModal.mat) await updateEquipmentMaterial(matModal.mat.id, data)
            else await createEquipmentMaterial(data)
            load()
          }}
          onClose={() => setMatModal({ open: false, mat: null })}
        />
      )}
    </div>
  )
}
