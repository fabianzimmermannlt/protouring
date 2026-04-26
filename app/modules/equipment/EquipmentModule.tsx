'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { WrenchScrewdriverIcon, ArchiveBoxIcon, TagIcon } from '@heroicons/react/24/outline'
import {
  getEquipmentCategories, createEquipmentCategory, updateEquipmentCategory, deleteEquipmentCategory,
  getEquipmentItems, createEquipmentItem, updateEquipmentItem, deleteEquipmentItem,
  getEquipmentMaterials, createEquipmentMaterial, updateEquipmentMaterial, deleteEquipmentMaterial,
  initEquipmentKuerzel,
  canDo, getEffectiveRole,
  type EquipmentCategory, type EquipmentItem, type EquipmentMaterial,
} from '@/lib/api-client'

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

function MaterialModal({ mat, items, categories, onSave, onClose }: {
  mat: EquipmentMaterial | null
  items: EquipmentItem[]
  categories: EquipmentCategory[]
  onSave: (data: Partial<EquipmentMaterial>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    hersteller:            mat?.hersteller ?? '',
    produkt:               mat?.produkt ?? '',
    info:                  mat?.info ?? '',
    category_id:           mat?.category_id != null ? String(mat.category_id) : '',
    typ:                   mat?.typ ?? 'bulk',
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
        hersteller:            form.hersteller || null,
        produkt:               form.produkt.trim(),
        info:                  form.info || null,
        category_id:           form.category_id ? Number(form.category_id) : null,
        typ:                   form.typ as 'serial' | 'bulk',
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{mat ? 'Material bearbeiten' : 'Neues Material'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Hersteller</label>
              <input className="form-input" value={form.hersteller} onChange={e => setForm({...form, hersteller: e.target.value})} placeholder="z.B. Shure" autoFocus />
            </div>
            <div>
              <label className="form-label">Produkt *</label>
              <input className="form-input" value={form.produkt} onChange={e => setForm({...form, produkt: e.target.value})} placeholder="z.B. SM58" />
            </div>
          </div>
          <div>
            <label className="form-label">Beschreibung / Info</label>
            <input className="form-input" value={form.info} onChange={e => setForm({...form, info: e.target.value})} placeholder="Kurzbeschreibung für Carnet" />
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
                    onClick={() => setForm({...form, typ: t})}
                    className={`flex-1 py-1.5 text-sm rounded border font-medium transition-colors ${
                      form.typ === t ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {t === 'bulk' ? 'Massenartikel' : 'Serienartikel'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.typ === 'bulk' ? 'Anzahl pro Case festlegbar (z.B. XLR Kabel)' : 'Seriennummern werden separat gepflegt'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Herstellungsland</label>
              <input className="form-input" value={form.herstellungsland} onChange={e => setForm({...form, herstellungsland: e.target.value})} placeholder="z.B. DE, US" />
            </div>
            <div>
              <label className="form-label">Gewicht (kg, pro Stück)</label>
              <input type="number" className="form-input" value={form.gewicht_kg} onChange={e => setForm({...form, gewicht_kg: e.target.value})} step="0.01" placeholder="0.00" />
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
              <label className="form-label">Zeitwert</label>
              <input type="number" className="form-input" value={form.wert_zeitwert} onChange={e => setForm({...form, wert_zeitwert: e.target.value})} step="0.01" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Wiederbeschaffung</label>
              <input type="number" className="form-input" value={form.wert_wiederbeschaffung} onChange={e => setForm({...form, wert_wiederbeschaffung: e.target.value})} step="0.01" placeholder="0.00" />
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

// ── Haupt-Modul ───────────────────────────────────────────────────────────────

export default function EquipmentModule({ activeSubTab }: { activeSubTab?: string }) {
  const router = useRouter()
  const activeTab = activeSubTab || 'items'
  const [categories, setCategories] = useState<EquipmentCategory[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [materials, setMaterials] = useState<EquipmentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [kuerzel, setKuerzel] = useState('')

  const [catModal, setCatModal] = useState<{ open: boolean; cat: EquipmentCategory | null }>({ open: false, cat: null })
  const [itemModal, setItemModal] = useState<{ open: boolean; item: EquipmentItem | null }>({ open: false, item: null })
  const [matModal, setMatModal] = useState<{ open: boolean; mat: EquipmentMaterial | null }>({ open: false, mat: null })

  const role = getEffectiveRole()
  const canEdit = canDo(role, ['admin', 'agency', 'tourmanagement'])

  const load = async () => {
    setLoading(true)
    try {
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
  useEffect(() => { setSearch('') }, [activeTab])

  // ── Gegenstände ──────────────────────────────────────────────────────────────
  const filteredItems = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.case_id.toLowerCase().includes(search.toLowerCase())
  )

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
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Name</th>
                <th>Typ</th>
                <th>Kategorie</th>
                <th>Position</th>
                <th className="text-right">Maße H×B×T cm</th>
                <th className="text-right">Leer kg</th>
                <th className="text-right">Material</th>
                <th className="text-right">Gesamt kg</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const totalWeight = (item.weight_empty_kg ?? 0) + (item.material_gewicht ?? 0)
                return (
                  <tr key={item.id} className="clickable" onClick={() => router.push(`/equipment/${item.id}`)}>
                    <td><span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{item.case_id}</span></td>
                    <td className="font-medium">{item.name}</td>
                    <td><span className="badge">{TYP_LABELS[item.typ] ?? item.typ}</span></td>
                    <td>{item.category_name ?? '—'}</td>
                    <td>{item.position ? POSITION_LABELS[item.position] ?? item.position : '—'}</td>
                    <td className="text-right text-xs text-gray-600">
                      {item.height_cm || item.width_cm || item.depth_cm
                        ? `${item.height_cm ?? '?'} × ${item.width_cm ?? '?'} × ${item.depth_cm ?? '?'}`
                        : '—'}
                    </td>
                    <td className="text-right">{fmt(item.weight_empty_kg, ' kg')}</td>
                    <td className="text-right">{item.material_count ? `${item.material_count}×` : '—'}</td>
                    <td className="text-right font-medium">{totalWeight > 0 ? `${totalWeight.toLocaleString('de-DE')} kg` : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {canEdit && (
                          <button onClick={() => setItemModal({ open: true, item })} className="p-1 text-gray-400 hover:text-blue-600">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={async () => {
                            if (!confirm(`${item.case_id} — ${item.name} wirklich löschen?`)) return
                            await deleteEquipmentItem(item.id)
                            load()
                          }} className="p-1 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />
                      </div>
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

  // ── Material ─────────────────────────────────────────────────────────────────
  const filteredMaterials = materials.filter(m =>
    !search || m.produkt.toLowerCase().includes(search.toLowerCase()) ||
    (m.hersteller ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const renderMaterials = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {canEdit && (
          <button onClick={() => setMatModal({ open: true, mat: null })} className="btn btn-primary">
            <PlusIcon className="w-4 h-4" />
            Neues Material
          </button>
        )}
        <input
          type="text"
          className="search-input"
          placeholder="Material durchsuchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="data-table-wrapper">
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Lädt…</div>
        </div>
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
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hersteller</th>
                <th>Produkt</th>
                <th>Kategorie</th>
                <th>Typ</th>
                <th className="text-right">Einheiten</th>
                <th>Land</th>
                <th className="text-right">Wert/Stk</th>
                <th className="text-right">Gewicht/Stk</th>
                {canEdit && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map(mat => (
                <tr key={mat.id}>
                  <td className="text-gray-500">{mat.hersteller || '—'}</td>
                  <td className="font-medium">{mat.produkt}</td>
                  <td>{mat.category_name ?? '—'}</td>
                  <td>
                    <span className={`badge ${mat.typ === 'serial' ? 'badge-blue' : ''}`}>
                      {mat.typ === 'serial' ? 'Serienartikel' : 'Massenartikel'}
                    </span>
                  </td>
                  <td className="text-right font-medium">
                    {mat.typ === 'serial'
                      ? `${mat.unit_count ?? 0}×`
                      : '∞'}
                  </td>
                  <td>{mat.herstellungsland || '—'}</td>
                  <td className="text-right">
                    {mat.wert_zeitwert != null ? `${mat.wert_zeitwert.toLocaleString('de-DE')} ${mat.waehrung}` : '—'}
                  </td>
                  <td className="text-right">
                    {mat.gewicht_kg != null ? `${mat.gewicht_kg.toLocaleString('de-DE')} kg` : '—'}
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

  return (
    <div className="space-y-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <WrenchScrewdriverIcon className="w-5 h-5 text-orange-500" />
            Equipment
            <span className="text-xs font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">ADDON</span>
          </h1>
          {kuerzel && (
            <p className="text-xs text-gray-400 mt-0.5">
              Kürzel: <span className="font-mono font-semibold text-gray-600">{kuerzel}</span>
              {' · '}{items.length} Gegenstände · {materials.length} Material-Einträge
            </p>
          )}
        </div>
      </div>

      {activeTab === 'items'      && renderItems()}
      {activeTab === 'materials'  && renderMaterials()}
      {activeTab === 'categories' && renderCategories()}

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
