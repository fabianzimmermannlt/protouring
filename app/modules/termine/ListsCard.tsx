'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, GripVertical, ListChecks, Loader2 } from 'lucide-react'
import {
  getEventLists, createEventList, updateEventList, deleteEventList,
  addListColumn, updateListColumn, deleteListColumn,
  addListRow, updateListRow, deleteListRow, reorderListRows,
  getTravelParty, isEditorRole, getEffectiveRole,
  type EventList, type EventListColumnType, type TravelPartyMember,
} from '@/lib/api-client'

const COL_TYPES: { value: EventListColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'check', label: 'Haken' },
  { value: 'number', label: 'Zahl' },
  { value: 'person', label: 'Person' },
  { value: 'date', label: 'Datum' },
]

// Vorlagen-Presets für „Neue Liste"
const PRESETS: { key: string; label: string; columns: { label: string; type: EventListColumnType }[] }[] = [
  { key: 'checklist', label: 'Checkliste', columns: [{ label: 'Aufgabe', type: 'text' }, { label: 'Verantwortlich', type: 'person' }, { label: 'Erledigt', type: 'check' }] },
  { key: 'packlist', label: 'Packliste', columns: [{ label: 'Position', type: 'text' }, { label: 'Menge', type: 'number' }, { label: 'Gepackt', type: 'check' }] },
  { key: 'info', label: 'Info', columns: [{ label: 'Bezeichnung', type: 'text' }, { label: 'Wert', type: 'text' }] },
  { key: 'empty', label: 'Leer', columns: [{ label: 'Spalte 1', type: 'text' }] },
]

export default function ListsCard({ terminId }: { terminId: number }) {
  const [lists, setLists] = useState<EventList[]>([])
  const [party, setParty] = useState<TravelPartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [presetOpen, setPresetOpen] = useState(false)
  const isEditor = isEditorRole(getEffectiveRole())

  const load = useCallback(async () => {
    try { setLists(await getEventLists(terminId)) } catch { /* still */ } finally { setLoading(false) }
  }, [terminId])
  useEffect(() => { load(); getTravelParty(terminId).then(setParty).catch(() => {}) }, [load, terminId])

  const patchList = (listId: number, fn: (l: EventList) => EventList) =>
    setLists(prev => prev.map(l => (l.id === listId ? fn(l) : l)))

  // ── Listen ──
  const addList = async (preset: typeof PRESETS[number]) => {
    setPresetOpen(false)
    try {
      const l = await createEventList(terminId, preset.label === 'Leer' ? 'Neue Liste' : preset.label, preset.columns)
      setLists(prev => [...prev, l])
    } catch { /* still */ }
  }
  const renameList = (listId: number, title: string) => patchList(listId, l => ({ ...l, title }))
  const saveListTitle = async (listId: number, title: string) => { try { await updateEventList(listId, title) } catch {} }
  const removeList = async (listId: number) => {
    if (!confirm('Liste wirklich löschen?')) return
    try { await deleteEventList(listId); setLists(prev => prev.filter(l => l.id !== listId)) } catch {}
  }

  // ── Spalten ──
  const addColumn = async (listId: number) => {
    try { const col = await addListColumn(listId, { label: 'Spalte', type: 'text' }); patchList(listId, l => ({ ...l, columns: [...l.columns, col] })) } catch {}
  }
  const setColLabel = (listId: number, colId: number, label: string) =>
    patchList(listId, l => ({ ...l, columns: l.columns.map(c => (c.id === colId ? { ...c, label } : c)) }))
  const saveColLabel = async (colId: number, label: string) => { try { await updateListColumn(colId, { label }) } catch {} }
  const changeColType = async (listId: number, colId: number, type: EventListColumnType) => {
    patchList(listId, l => ({ ...l, columns: l.columns.map(c => (c.id === colId ? { ...c, type } : c)) }))
    try { await updateListColumn(colId, { type }) } catch {}
  }
  const removeColumn = async (listId: number, colId: number) => {
    try { await deleteListColumn(colId); patchList(listId, l => ({ ...l, columns: l.columns.filter(c => c.id !== colId) })) } catch {}
  }

  // ── Zeilen ──
  const addRow = async (listId: number) => {
    try { const row = await addListRow(listId, {}); patchList(listId, l => ({ ...l, rows: [...l.rows, row] })) } catch {}
  }
  const removeRow = async (listId: number, rowId: number) => {
    try { await deleteListRow(rowId); patchList(listId, l => ({ ...l, rows: l.rows.filter(r => r.id !== rowId) })) } catch {}
  }
  const setCell = (listId: number, rowId: number, colId: number, value: unknown) =>
    patchList(listId, l => ({ ...l, rows: l.rows.map(r => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)) }))
  // persistiert die aktuellen Zellen der Zeile (liest frischen State)
  const persistRow = (listId: number, rowId: number) => {
    setLists(prev => {
      const l = prev.find(x => x.id === listId); const r = l?.rows.find(x => x.id === rowId)
      if (r) updateListRow(rowId, r.cells).catch(() => {})
      return prev
    })
  }
  const setCellAndPersist = (listId: number, rowId: number, colId: number, value: unknown) => {
    setCell(listId, rowId, colId, value)
    setTimeout(() => persistRow(listId, rowId), 0)
  }

  // ── Drag Reorder Zeilen ──
  const dragRef = useRef<{ listId: number; idx: number } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const onRowDrop = async (listId: number, targetIdx: number) => {
    const d = dragRef.current
    dragRef.current = null; setDragOver(null)
    if (!d || d.listId !== listId || d.idx === targetIdx) return
    let order: number[] = []
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l
      const rows = [...l.rows]
      const [moved] = rows.splice(d.idx, 1)
      rows.splice(targetIdx, 0, moved)
      order = rows.map(r => r.id)
      return { ...l, rows }
    }))
    try { await reorderListRows(listId, order) } catch {}
  }

  const personName = (id: unknown) => {
    const m = party.find(p => p.id === Number(id))
    return m ? `${m.firstName} ${m.lastName}`.trim() : ''
  }

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title"><ListChecks className="w-3.5 h-3.5 inline mr-1" />Listen</span>
        {isEditor && (
          <div className="relative">
            <button onClick={() => setPresetOpen(o => !o)} className="text-gray-400 hover:text-blue-500 transition-colors" title="Neue Liste">
              <Plus className="w-3.5 h-3.5" />
            </button>
            {presetOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-[#2d2d2d]">Neue Liste als…</div>
                {PRESETS.map(p => (
                  <button key={p.key} onClick={() => addList(p)} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#2a2a2a]">{p.label}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-card-body">
        {loading ? (
          <div className="flex items-center justify-center h-16 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" />Lädt…</div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 text-gray-500 text-xs">
            <ListChecks className="w-5 h-5 mb-1" />
            {isEditor ? 'Noch keine Listen – oben mit + anlegen.' : 'Noch keine Listen.'}
          </div>
        ) : (
          <div className="space-y-6">
            {lists.map(list => (
              <div key={list.id} className="border border-[#3a3a3a] rounded-lg overflow-hidden">
                {/* Listen-Kopf */}
                <div className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-b border-[#3a3a3a]">
                  {isEditor ? (
                    <input
                      value={list.title}
                      onChange={e => renameList(list.id, e.target.value)}
                      onBlur={e => saveListTitle(list.id, e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold text-white outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-white">{list.title}</span>
                  )}
                  {isEditor && (
                    <button onClick={() => removeList(list.id)} className="text-gray-400 hover:text-red-500 p-0.5" title="Liste löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>

                {/* Tabelle */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#262626]">
                        {isEditor && <th className="w-6" />}
                        {list.columns.map(col => (
                          <th key={col.id} className="text-left px-2 py-1.5 font-medium text-gray-300 align-top min-w-[120px]">
                            {isEditor ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  value={col.label}
                                  onChange={e => setColLabel(list.id, col.id, e.target.value)}
                                  onBlur={e => saveColLabel(col.id, e.target.value)}
                                  placeholder="Spalte"
                                  className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white outline-none w-full"
                                />
                                <div className="flex items-center gap-1">
                                  <select
                                    value={col.type}
                                    onChange={e => changeColType(list.id, col.id, e.target.value as EventListColumnType)}
                                    className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-1 py-0.5 text-[11px] text-gray-300 outline-none"
                                  >
                                    {COL_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                                  </select>
                                  <button onClick={() => removeColumn(list.id, col.id)} className="text-gray-500 hover:text-red-500" title="Spalte löschen"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs">{col.label}</span>
                            )}
                          </th>
                        ))}
                        {isEditor && (
                          <th className="w-8 px-1">
                            <button onClick={() => addColumn(list.id)} className="text-gray-400 hover:text-blue-500" title="Spalte hinzufügen"><Plus className="w-4 h-4" /></button>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {list.rows.map((row, idx) => (
                        <tr
                          key={row.id}
                          draggable={isEditor}
                          onDragStart={() => { dragRef.current = { listId: list.id, idx } }}
                          onDragEnter={() => setDragOver(`${list.id}-${idx}`)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => onRowDrop(list.id, idx)}
                          onDragEnd={() => { dragRef.current = null; setDragOver(null) }}
                          className={`border-t border-[#2d2d2d] ${dragOver === `${list.id}-${idx}` ? 'bg-blue-500/10' : ''}`}
                        >
                          {isEditor && (
                            <td className="text-center text-gray-600 cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5 inline" /></td>
                          )}
                          {list.columns.map(col => (
                            <td key={col.id} className="px-2 py-1 align-middle">
                              {col.type === 'check' ? (
                                <input type="checkbox" checked={!!row.cells[col.id]} onChange={e => setCellAndPersist(list.id, row.id, col.id, e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                              ) : col.type === 'person' ? (
                                <select
                                  value={(row.cells[col.id] as string) ?? ''}
                                  onChange={e => setCellAndPersist(list.id, row.id, col.id, e.target.value)}
                                  className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white outline-none min-w-[120px]"
                                >
                                  <option value="">—</option>
                                  {party.map(m => <option key={m.id} value={m.id}>{`${m.firstName} ${m.lastName}`.trim()}</option>)}
                                </select>
                              ) : col.type === 'date' ? (
                                <input type="date" value={(row.cells[col.id] as string) ?? ''} onChange={e => setCellAndPersist(list.id, row.id, col.id, e.target.value)} className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white outline-none" />
                              ) : col.type === 'number' ? (
                                <input type="number" value={(row.cells[col.id] as string) ?? ''} onChange={e => setCell(list.id, row.id, col.id, e.target.value)} onBlur={() => persistRow(list.id, row.id)} className="bg-[#1f1f1f] border border-[#3a3a3a] rounded px-1.5 py-1 text-xs text-white outline-none w-20 text-right" />
                              ) : (
                                <input type="text" value={(row.cells[col.id] as string) ?? ''} onChange={e => setCell(list.id, row.id, col.id, e.target.value)} onBlur={() => persistRow(list.id, row.id)} className="bg-transparent border border-transparent hover:border-[#3a3a3a] focus:border-[#3a3a3a] rounded px-1.5 py-1 text-sm text-gray-100 outline-none w-full min-w-[120px]" />
                              )}
                            </td>
                          ))}
                          <td className="w-8 px-1 text-center">
                            <button onClick={() => removeRow(list.id, row.id)} className="text-gray-600 hover:text-red-500 opacity-60 hover:opacity-100" title="Zeile löschen"><Trash2 className="w-3 h-3" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Zeile hinzufügen */}
                <button onClick={() => addRow(list.id)} className="flex items-center gap-1 px-3 py-2 text-xs text-gray-400 hover:text-blue-400 border-t border-[#2d2d2d] w-full">
                  <Plus className="w-3.5 h-3.5" /> Zeile hinzufügen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
