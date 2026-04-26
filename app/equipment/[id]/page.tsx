'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeftIcon, PlusIcon, TrashIcon, PencilIcon, XMarkIcon,
  ArchiveBoxIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import {
  getEquipmentItemDetail, getCaseContents, addToCaseContents, updateCaseContent, removeCaseContent,
  getEquipmentMaterials, getMaterialUnits, updateEquipmentItem,
  getEquipmentCategories,
  isAuthenticated, canDo, getEffectiveRole,
  type EquipmentItem, type EquipmentCaseContent, type EquipmentMaterial,
  type EquipmentMaterialUnit, type EquipmentCategory,
} from '@/lib/api-client'

const TYP_LABELS: Record<string, string> = {
  case: 'Case', dolly: 'Dolly', kulisse: 'Kulisse', flightcase: 'Flightcase', sonstiges: 'Sonstiges'
}
const POSITION_LABELS: Record<string, string> = {
  sl: 'Stage Left', sr: 'Stage Right', foh: 'FOH', drums: 'Drums',
  backline: 'Backline', truck: 'Truck', sonstiges: 'Sonstiges'
}

function fmt(v: number | null | undefined, unit = '', digits = 2) {
  if (v == null || v === 0) return '—'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: digits })}${unit}`
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
  const [bulkAnzahl, setBulkAnzahl] = useState(1)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { getEquipmentMaterials().then(setMaterials).catch(() => {}) }, [])

  const selectMaterial = async (mat: EquipmentMaterial) => {
    setSelected(mat)
    setSelectedUnitIds([])
    setBulkAnzahl(1)
    setErr('')
    if (mat.typ === 'serial') {
      const u = await getMaterialUnits(mat.id)
      // Nur freie Einheiten anzeigen (nicht in einem anderen Case)
      setUnits(u.filter(u => !u.in_case_id))
    }
  }

  const toggleUnit = (unitId: number) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    )
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      if (selected.typ === 'serial') {
        if (selectedUnitIds.length === 0) { setErr('Mindestens eine Einheit auswählen'); setSaving(false); return }
        await addToCaseContents(itemId, { material_unit_ids: selectedUnitIds })
      } else {
        await addToCaseContents(itemId, { material_id: selected.id, anzahl: bulkAnzahl })
      }
      onDone()
      onClose()
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
              <input
                className="search-input mb-3"
                placeholder="Produkt oder Hersteller suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Kein Material gefunden</p>
                )}
                {filtered.map(mat => (
                  <button
                    key={mat.id}
                    onClick={() => selectMaterial(mat)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm text-gray-900">{mat.produkt}</span>
                        {mat.hersteller && <span className="text-xs text-gray-400 ml-2">{mat.hersteller}</span>}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        mat.typ === 'serial' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {mat.typ === 'serial' ? `${mat.unit_count ?? 0} Einh. frei` : 'Masse'}
                      </span>
                    </div>
                    {mat.category_name && <p className="text-xs text-gray-400 mt-0.5">{mat.category_name}</p>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <button onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline mb-3 flex items-center gap-1">
                <ArrowLeftIcon className="w-3 h-3" /> Zurück zur Auswahl
              </button>
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                <p className="font-medium text-gray-900">{selected.produkt}</p>
                {selected.hersteller && <p className="text-xs text-gray-500">{selected.hersteller}</p>}
                {selected.info && <p className="text-xs text-gray-400">{selected.info}</p>}
              </div>

              {selected.typ === 'bulk' ? (
                <div>
                  <label className="form-label">Anzahl</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: '8rem' }}
                    value={bulkAnzahl}
                    onChange={e => setBulkAnzahl(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <p className="form-label mb-2">Freie Einheiten auswählen</p>
                  {units.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Keine freien Einheiten vorhanden</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {units.map(u => (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUnitIds.includes(u.id)}
                            onChange={() => toggleUnit(u.id)}
                            className="accent-blue-600"
                          />
                          <span className="font-mono text-sm font-medium">{u.seriennummer}</span>
                          {u.notiz && <span className="text-xs text-gray-400">{u.notiz}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedUnitIds.length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">{selectedUnitIds.length} Einheit(en) ausgewählt</p>
                  )}
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

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function EquipmentItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const itemId = parseInt(id, 10)

  const [item, setItem] = useState<(EquipmentItem & { content_count: number; content_gewicht: number; content_wert: number }) | null>(null)
  const [contents, setContents] = useState<EquipmentCaseContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const role = getEffectiveRole()
  const canEdit = canDo(role, ['admin', 'agency', 'tourmanagement'])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemData, contentsData] = await Promise.all([
        getEquipmentItemDetail(itemId),
        getCaseContents(itemId),
      ])
      setItem(itemData)
      setContents(contentsData)
    } catch {}
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    load()
  }, [load, router])

  const handleRemove = async (contentId: number) => {
    if (!confirm('Eintrag aus diesem Case entfernen?')) return
    await removeCaseContent(contentId)
    load()
  }

  const handleAnzahlChange = async (contentId: number, newAnzahl: number) => {
    if (newAnzahl < 1) return
    await updateCaseContent(contentId, newAnzahl)
    load()
  }

  if (loading || !item) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Lädt…</p>
      </div>
    )
  }

  const totalWeight = (item.weight_empty_kg ?? 0) + (item.content_gewicht ?? 0)

  // Inhalte gruppieren: erst nach Hersteller+Produkt, dann Seriennummern darunter
  const grouped: { key: string; rows: EquipmentCaseContent[] }[] = []
  for (const c of contents) {
    const key = `${c.hersteller ?? ''}__${c.produkt}__${c.typ}`
    const existing = grouped.find(g => g.key === key)
    if (existing) existing.rows.push(c)
    else grouped.push({ key, rows: [c] })
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <button
          onClick={() => router.push('/?tab=equipment&sub=items')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Gegenstände
        </button>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-blue-400">{item.case_id}</span>
          <span className="text-white font-semibold">{item.name}</span>
        </div>
      </div>

      {/* Sub-Info-Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-2 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
        <span>{TYP_LABELS[item.typ] ?? item.typ}</span>
        {item.position && <span>{POSITION_LABELS[item.position] ?? item.position}</span>}
        {item.load_order && <span>Ladereihenfolge: {item.load_order}</span>}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Info-Karte */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Maße (H×B×T)</p>
              <p className="font-medium text-gray-900">
                {item.height_cm || item.width_cm || item.depth_cm
                  ? `${item.height_cm ?? '?'}×${item.width_cm ?? '?'}×${item.depth_cm ?? '?'} cm`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Eigengewicht</p>
              <p className="font-medium text-gray-900">{fmt(item.weight_empty_kg, ' kg')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gesamtgewicht</p>
              <p className="font-semibold text-gray-900">{totalWeight > 0 ? `${totalWeight.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Inhalte</p>
              <p className="font-medium text-gray-900">{item.content_count} {item.content_count === 1 ? 'Eintrag' : 'Einträge'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gesamtwert</p>
              <p className="font-semibold text-gray-900">
                {item.content_wert > 0
                  ? `€ ${item.content_wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </p>
            </div>
          </div>
          {item.notiz && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">{item.notiz}</p>
          )}
        </div>

        {/* Inhalte */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
              Inhalt
            </h2>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                <PlusIcon className="w-4 h-4" />
                Hinzufügen
              </button>
            )}
          </div>

          {contents.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 py-16 text-center">
              <WrenchScrewdriverIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Noch kein Material in diesem Case</p>
              {canEdit && (
                <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  + Material hinzufügen
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
                    <th>Info</th>
                    <th>Seriennummer</th>
                    <th className="text-right">Anzahl</th>
                    <th>Land</th>
                    <th className="text-right">Wert</th>
                    <th className="text-right">Gewicht</th>
                    {canEdit && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {contents.map(c => {
                    const gewicht = c.gewicht_kg != null ? c.gewicht_kg * (c.typ === 'bulk' ? c.anzahl : 1) : null
                    const wert = c.wert_zeitwert != null ? c.wert_zeitwert * (c.typ === 'bulk' ? c.anzahl : 1) : null
                    return (
                      <tr key={c.id}>
                        <td className="text-gray-500">{c.hersteller || '—'}</td>
                        <td className="font-medium">{c.produkt}</td>
                        <td className="text-gray-500 text-xs">{c.info || '—'}</td>
                        <td>
                          {c.seriennummer
                            ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.seriennummer}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-right">
                          {c.typ === 'bulk' ? (
                            canEdit ? (
                              <input
                                type="number"
                                className="form-input text-right w-16 ml-auto"
                                value={c.anzahl}
                                min={1}
                                onChange={e => handleAnzahlChange(c.id, parseInt(e.target.value) || 1)}
                              />
                            ) : c.anzahl
                          ) : (
                            <span className="text-gray-400">1</span>
                          )}
                        </td>
                        <td className="text-xs">{c.herstellungsland || '—'}</td>
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
      </div>

      {showAddModal && (
        <AddContentModal
          itemId={itemId}
          onDone={load}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
