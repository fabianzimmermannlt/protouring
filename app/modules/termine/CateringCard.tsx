'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Pencil, Save, X, Plus, Trash2, UtensilsCrossed, Building2, Banknote, ShoppingBag, CalendarClock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { RichTextEditor } from '@/app/components/shared/RichTextEditor'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import {
  getCatering, createCateringBlock, updateCateringBlock, deleteCateringBlock,
  createCateringOrder, updateCateringOrder, deleteCateringOrder,
  getMyContact,
  type Catering, type CateringType, type CateringMember, type CateringOrder,
} from '@/lib/api-client'
import { formatMoney } from '@/lib/format'
import { NumericInput } from '@/app/components/shared/NumericInput'

// App ist fest Dark-Mode
const dark = true

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: CateringType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'none',    label: 'Kein Catering', icon: <UtensilsCrossed size={14} />, color: 'var(--text-subtle)' },
  { value: 'inhouse', label: 'Inhouse',        icon: <Building2 size={14} />,       color: 'var(--primary)' },
  { value: 'buyout',  label: 'Buy Out',         icon: <Banknote size={14} />,        color: '#10b981' },
  { value: 'order',   label: 'Auf Bestellung',  icon: <ShoppingBag size={14} />,     color: '#f59e0b' },
]

function typeCfg(t: CateringType) {
  return TYPE_OPTIONS.find(o => o.value === t) ?? TYPE_OPTIONS[0]
}

function getCurrency(): string {
  try {
    const d = JSON.parse(localStorage.getItem('protouring_artist_data') ?? '{}')
    return d.currency ?? 'EUR'
  } catch { return 'EUR' }
}

function getCurrencySymbol(c: string): string {
  return c === 'USD' ? '$' : c === 'GBP' ? '£' : '€'
}

function fmtDeadline(d: string): string {
  try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return d }
}

// ── DietOverview (termin-weit) ────────────────────────────────────────────────

function DietOverview({ members }: { members: CateringMember[] }) {
  if (members.length === 0) return null

  const isVeg   = (d: string) => d === 'vegetarian' || d === 'vegetarisch'
  const isVegan = (d: string) => d === 'vegan'

  const groups = [
    { key: 'omnivor',     label: 'omnivor',     members: members.filter(m => !m.diet || (!isVeg(m.diet) && !isVegan(m.diet))) },
    { key: 'vegetarisch', label: 'vegetarisch', members: members.filter(m => isVeg(m.diet)) },
    { key: 'vegan',       label: 'vegan',       members: members.filter(m => isVegan(m.diet)) },
  ].filter(g => g.members.length > 0)

  function intolerances(group: CateringMember[]) {
    const counts: Record<string, number> = {}
    group.forEach(m => {
      const tags: string[] = []
      if (m.glutenFree)  tags.push('glutenfrei')
      if (m.lactoseFree) tags.push('laktosefrei')
      if (m.allergies)   tags.push(m.allergies)
      if (tags.length > 0) {
        const key = tags.join(', ')
        counts[key] = (counts[key] || 0) + 1
      }
    })
    return Object.entries(counts)
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Insg. {members.length} {members.length === 1 ? 'Person' : 'Personen'}, davon ernähren sich:
      </div>
      <div className="space-y-1.5 text-xs text-gray-300">
        {groups.map(g => (
          <div key={g.key}>
            <span className="font-semibold">{g.members.length}× {g.label}</span>
            {intolerances(g.members).map(([label, count]) => (
              <div key={label} className="pl-3 text-gray-500">– {count}× {label}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OrderEditRow ──────────────────────────────────────────────────────────────

function OrderEditRow({
  text, contactName, memberOptions, orderedNames, isAdmin, saving,
  onTextChange, onContactChange, onSave, onCancel,
}: {
  text: string; contactName: string; memberOptions: string[]
  orderedNames: Set<string>
  isAdmin: boolean; saving: boolean
  onTextChange: (v: string) => void
  onContactChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-1">
      {isAdmin ? (
        <select
          className="form-select text-xs py-0.5"
          value={contactName}
          onChange={e => onContactChange(e.target.value)}
        >
          <option value="">– Person –</option>
          {memberOptions.map(n => (
            <option key={n} value={n} disabled={orderedNames.has(n)} style={orderedNames.has(n) ? { color: 'var(--text-muted)' } : undefined}>
              {n}{orderedNames.has(n) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      ) : contactName ? (
        <div className="text-xs font-medium text-gray-400 px-0.5">{contactName}</div>
      ) : null}
      <div className="flex gap-1 items-start">
        <input
          className="form-input text-xs py-0.5 flex-1"
          placeholder="Bestellung eingeben…"
          value={text}
          onChange={e => onTextChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
          autoFocus
        />
        <button onClick={onSave} disabled={saving || !text.trim()} className="btn btn-primary py-0.5 px-2 text-xs">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
        </button>
        <button onClick={onCancel} className="btn btn-secondary py-0.5 px-2 text-xs">
          <X size={11} />
        </button>
      </div>
    </div>
  )
}

// ── OrderList (pro Block) ─────────────────────────────────────────────────────

function OrderList({
  blockId, members, isAdmin, myContactId, deadline,
  orders, onAdd, onEdit, onRemove,
}: {
  blockId: number
  members: CateringMember[]
  isAdmin: boolean
  myContactId: number | null
  deadline: string | null
  orders: CateringOrder[]
  onAdd: (data: { contactId?: number | null; contactName?: string; orderText: string }) => Promise<void>
  onEdit: (orderId: number, text: string) => Promise<void>
  onRemove: (orderId: number) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [editText, setEditText]   = useState('')
  const [editContact, setEditContact] = useState('')
  const [saving, setSaving]       = useState(false)

  const startNew = () => { setEditingId('new'); setEditText(''); setEditContact('') }
  const startEdit = (o: CateringOrder) => { setEditingId(o.id); setEditText(o.orderText); setEditContact(o.contactName ?? '') }
  const cancel = () => { setEditingId(null); setEditText(''); setEditContact('') }

  const save = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        await onAdd({
          contactId:   isAdmin ? undefined : (myContactId ?? undefined),
          contactName: editContact.trim() || undefined,
          orderText:   editText.trim(),
        })
      } else if (editingId != null) {
        await onEdit(editingId as number, editText.trim())
      }
      cancel()
    } finally { setSaving(false) }
  }

  const canEdit = (o: CateringOrder) => isAdmin || (myContactId !== null && o.contactId === myContactId)

  const memberOptions = members.map(m => `${m.firstName} ${m.lastName}`.trim())
  const orderedNamesFor = (exclude: number | 'new' | null) =>
    new Set(orders.filter(o => o.id !== exclude).map(o => o.contactName).filter(Boolean) as string[])

  // Fehlende-Übersicht
  const orderedContactIds = new Set(orders.map(o => o.contactId).filter((v): v is number => v != null))
  const orderedNameSet = new Set(orders.map(o => o.contactName).filter(Boolean) as string[])
  const missing = members.filter(m =>
    !orderedContactIds.has(m.contactId) && !orderedNameSet.has(`${m.firstName} ${m.lastName}`.trim())
  )
  const orderedCount = members.length - missing.length

  return (
    <div className="border-t border-gray-700 pt-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bestellliste</div>
        {isAdmin && editingId === null && (
          <button onClick={startNew} className="text-gray-400 hover:text-gray-200 transition-colors">
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Deadline + Fehlende-Übersicht */}
      {(deadline || members.length > 0) && (
        <div className="mb-2 space-y-1">
          {deadline && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <CalendarClock size={12} className="text-gray-500" />
              Deadline: <span className="font-medium text-gray-300">{fmtDeadline(deadline)}</span>
            </div>
          )}
          {members.length > 0 && (
            <div className="text-xs text-gray-500">
              {orderedCount} von {members.length} haben bestellt
              {missing.length > 0 && (
                <span className="flex items-start gap-1 mt-0.5 text-amber-500/90">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                  <span>fehlt noch: {missing.map(m => `${m.firstName} ${m.lastName}`.trim()).join(', ')}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {orders.length === 0 && editingId === null && (
        <div className="text-xs text-gray-500 text-center py-2">
          {isAdmin ? 'Noch keine Einträge' : 'Kein Eintrag für dich vorhanden'}
        </div>
      )}

      <div className="space-y-1">
        {orders.map(o => (
          <div key={o.id} className="flex items-start gap-2 group">
            <div className="flex-1 min-w-0">
              {editingId === o.id ? (
                <OrderEditRow
                  text={editText}
                  contactName={editContact}
                  memberOptions={memberOptions}
                  orderedNames={orderedNamesFor(o.id)}
                  isAdmin={isAdmin}
                  saving={saving}
                  onTextChange={setEditText}
                  onContactChange={setEditContact}
                  onSave={save}
                  onCancel={cancel}
                />
              ) : (
                <div className="text-xs text-gray-300">
                  {o.contactName && <span className="font-medium text-gray-500">{o.contactName}: </span>}
                  {o.orderText}
                </div>
              )}
            </div>
            {editingId !== o.id && canEdit(o) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(o)} className="text-gray-500 hover:text-gray-300">
                  <Pencil size={11} />
                </button>
                {isAdmin && (
                  <button onClick={() => onRemove(o.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {editingId === 'new' && (
          <OrderEditRow
            text={editText}
            contactName={editContact}
            memberOptions={memberOptions}
            orderedNames={orderedNamesFor('new')}
            isAdmin={isAdmin}
            saving={saving}
            onTextChange={setEditText}
            onContactChange={setEditContact}
            onSave={save}
            onCancel={cancel}
          />
        )}
      </div>

      {/* Crew: eigene Zeile hinzufügen — nur wenn in der Reisegruppe und noch ohne Bestellung in diesem Block */}
      {!isAdmin && myContactId !== null && editingId === null &&
        members.some(m => m.contactId === myContactId) &&
        !orders.some(o => o.contactId === myContactId) && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            {(() => {
              const me = members.find(m => m.contactId === myContactId)
              const myName = me ? `${me.firstName} ${me.lastName}`.trim() : ''
              return (
                <button
                  onClick={() => { setEditContact(myName); setEditingId('new'); setEditText('') }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-gray-600 hover:border-indigo-400 hover:bg-indigo-500/10 text-xs text-gray-400 hover:text-indigo-300 transition-colors"
                >
                  <Plus size={11} className="flex-shrink-0" />
                  <span className="truncate">
                    {myName ? <><span className="font-medium">{myName}</span> — Bestellung eintragen</> : 'Meine Bestellung eintragen'}
                  </span>
                </button>
              )
            })()}
          </div>
      )}
    </div>
  )
}

// ── CateringBlock ─────────────────────────────────────────────────────────────

function CateringBlock({
  terminId, block, members, isAdmin, myContactId, totalPersons, onChanged, onDeleted,
}: {
  terminId: number
  block: Catering
  members: CateringMember[]
  isAdmin: boolean
  myContactId: number | null
  totalPersons: number
  onChanged: (b: Catering) => void
  onDeleted: () => void
}) {
  const [type, setType]                 = useState<CateringType>(block.type)
  const [label, setLabel]               = useState(block.label ?? '')
  const [notes, setNotes]               = useState<string | null>(block.notes)
  const [buyoutAmount, setBuyoutAmount] = useState(block.buyoutAmount != null ? String(block.buyoutAmount) : '')
  const [deadline, setDeadline]         = useState(block.deadline ?? '')
  const [contactName, setContactName]   = useState(block.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(block.contactPhone ?? '')
  const [orders, setOrders]             = useState<CateringOrder[]>(block.orders ?? [])
  const [notesOpen, setNotesOpen]       = useState(false)
  const [editingMeta, setEditingMeta]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [open, setOpen]                 = useState(true)  // mobil einklappbar; Desktop immer offen

  const currency = getCurrency()
  const currSymbol = getCurrencySymbol(currency)

  const persist = useCallback(async (over: Partial<{
    type: CateringType; label: string; notes: string | null; buyoutAmount: number | null
    contactName: string; contactPhone: string; deadline: string
  }> = {}) => {
    setSaving(true)
    try {
      const updated = await updateCateringBlock(terminId, block.id, {
        type:         over.type ?? type,
        label:        (over.label ?? label) || null,
        notes:        over.notes !== undefined ? over.notes : notes,
        buyoutAmount: over.buyoutAmount !== undefined ? over.buyoutAmount : (buyoutAmount ? parseFloat(buyoutAmount) : null),
        contactName:  (over.contactName ?? contactName) || null,
        contactPhone: (over.contactPhone ?? contactPhone) || null,
        deadline:     (over.deadline ?? deadline) || null,
      })
      onChanged({ ...updated, orders })
    } finally { setSaving(false) }
  }, [terminId, block.id, type, label, notes, buyoutAmount, contactName, contactPhone, deadline, orders, onChanged])

  const changeType = (t: CateringType) => { setType(t); persist({ type: t }) }
  const handleNotesSave = async (_title: string, html: string) => { setNotes(html); await persist({ notes: html }); setNotesOpen(false) }
  const handleMetaSave = async () => { await persist({ contactName, contactPhone }); setEditingMeta(false) }
  const handleDeadlineSave = () => persist({ deadline })

  const handleDelete = async () => {
    if (!confirm(`Catering-Block${label ? ` „${label}"` : ''} löschen?`)) return
    await deleteCateringBlock(terminId, block.id)
    onDeleted()
  }

  // Order-Handler (block-scoped)
  const addOrder = async (data: { contactId?: number | null; contactName?: string; orderText: string }) => {
    const created = await createCateringOrder(terminId, block.id, data)
    setOrders(prev => [...prev, created])
  }
  const editOrder = async (orderId: number, text: string) => {
    const updated = await updateCateringOrder(terminId, block.id, orderId, text)
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }
  const removeOrder = async (orderId: number) => {
    await deleteCateringOrder(terminId, block.id, orderId)
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const cfg = typeCfg(type)
  const headerTitle = label || (type === 'none' ? 'Neuer Catering-Block' : cfg.label)
  const totalBuyout = buyoutAmount && totalPersons > 0 ? parseFloat(buyoutAmount) * totalPersons : null

  return (
    <div className="pt-card">
      {/* Block-Header (mobil zum Ein-/Ausklappen) */}
      <div className="pt-card-header cursor-pointer md:cursor-default" onClick={() => setOpen(o => !o)}>
        <span className="pt-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          <span className="md:hidden inline-flex items-center">
            {open ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          </span>
          <span className="truncate">{headerTitle}</span>
          {type !== 'none' && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white whitespace-nowrap" style={{ background: cfg.color }}>
              {cfg.label}
            </span>
          )}
        </span>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          {saving && <Loader2 size={12} className="animate-spin text-gray-500" />}
          {isAdmin && (
            <button onClick={handleDelete} className="text-gray-500 hover:text-red-400 transition-colors" title="Block löschen">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className={`pt-card-body space-y-3 ${open ? '' : 'hidden md:block'}`}>

      {/* Bezeichnung (Admin) */}
      {isAdmin && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bezeichnung</label>
          <input
            className="form-input text-sm py-0.5 mt-1"
            placeholder="z.B. Hauptcatering / Aftershow"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => persist({ label })}
          />
        </div>
      )}

      {/* Typ-Auswahl (Admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-1.5">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => changeType(opt.value)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all"
              style={{
                borderColor: type === opt.value ? opt.color : 'var(--border)',
                background:  type === opt.value ? `${opt.color}18` : 'var(--surface)',
                color:       type === opt.value ? opt.color : 'var(--text-muted)',
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Buyout-Betrag */}
      {type === 'buyout' && (
        <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ background: '#0d2318', borderColor: '#14532d' }}>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-xs text-gray-400 whitespace-nowrap">Pro Person</span>
            {isAdmin ? (
              <div className="flex items-center gap-1">
                <NumericInput
                  value={buyoutAmount === '' ? null : parseFloat(buyoutAmount)}
                  decimals={2}
                  className="form-input text-sm py-0.5 w-24"
                  onCommit={n => { setBuyoutAmount(n === null ? '' : String(n)); persist({ buyoutAmount: n }) }}
                />
                <span className="text-xs text-gray-400">{currency}</span>
              </div>
            ) : (
              <span className="text-sm font-medium text-green-400">{buyoutAmount ? formatMoney(buyoutAmount, currency) : '–'}</span>
            )}
          </div>
          {totalBuyout != null && (
            <div className="text-xs text-green-400 font-semibold whitespace-nowrap">= {currSymbol}{formatMoney(totalBuyout)} gesamt</div>
          )}
        </div>
      )}

      {/* Deadline (für Bestell-Blöcke, Admin editierbar) */}
      {type === 'order' && isAdmin && (
        <div className="flex items-center gap-2">
          <CalendarClock size={13} className="text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-400 whitespace-nowrap">Bestell-Deadline</span>
          <input
            type="date"
            className="form-input text-xs py-0.5"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            onBlur={handleDeadlineSave}
          />
          {deadline && (
            <button onClick={() => { setDeadline(''); persist({ deadline: '' }) }} className="text-gray-500 hover:text-gray-300" title="Deadline entfernen">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Bestellliste */}
      {type === 'order' && (
        <OrderList
          blockId={block.id}
          members={members}
          isAdmin={isAdmin}
          myContactId={myContactId}
          deadline={isAdmin ? null : deadline || null}
          orders={orders}
          onAdd={addOrder}
          onEdit={editOrder}
          onRemove={removeOrder}
        />
      )}

      {/* Notizen */}
      {type !== 'none' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Infos</div>
            {isAdmin && (
              <button onClick={() => setNotesOpen(true)} className="text-gray-400 hover:text-gray-200 transition-colors">
                <Pencil size={11} />
              </button>
            )}
          </div>
          {notes ? (
            <div className="rich-content text-sm text-gray-300 space-y-0.5 cursor-pointer" onClick={() => isAdmin && setNotesOpen(true)}>
              {renderBoardContent(notes)}
            </div>
          ) : (
            isAdmin ? (
              <button onClick={() => setNotesOpen(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                + Notiz hinzufügen
              </button>
            ) : (
              <span className="text-xs text-gray-500">Keine Notizen</span>
            )
          )}
        </div>
      )}

      <RichTextEditor
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
        title="Catering-Notizen"
        content={notes ?? ''}
        onSave={handleNotesSave}
      />

      {/* Kontakt */}
      {type !== 'none' && isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt</div>
            {!editingMeta ? (
              <button onClick={() => setEditingMeta(true)} className="text-gray-400 hover:text-gray-200 transition-colors">
                <Pencil size={11} />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={handleMetaSave} className="text-green-400 hover:text-green-300"><Save size={11} /></button>
                <button onClick={() => setEditingMeta(false)} className="text-gray-400 hover:text-gray-200"><X size={11} /></button>
              </div>
            )}
          </div>
          {editingMeta ? (
            <div className="flex gap-2">
              <input className="form-input text-xs py-0.5 flex-1" placeholder="Name" value={contactName} onChange={e => setContactName(e.target.value)} />
              <input className="form-input text-xs py-0.5 flex-1" placeholder="Telefon" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>
          ) : (contactName || contactPhone) ? (
            <div className="text-xs text-gray-400">
              {contactName && <span className="font-medium">{contactName}</span>}
              {contactName && contactPhone && ' · '}
              {contactPhone && <span>{contactPhone}</span>}
            </div>
          ) : (
            <div className="text-xs text-gray-500">Kein Kontakt hinterlegt</div>
          )}
        </div>
      )}

      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CateringCard({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  const [blocks, setBlocks]     = useState<Catering[]>([])
  const [members, setMembers]   = useState<CateringMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [myContactId, setMyContactId] = useState<number | null>(null)

  useEffect(() => {
    const fetches: Promise<void>[] = [
      getCatering(terminId).then(data => {
        setBlocks(data.blocks)
        setMembers(data.members)
      }).catch(() => {}),
    ]
    if (!isAdmin) {
      fetches.push(getMyContact().then(c => setMyContactId(Number(c.id))).catch(() => {}))
    }
    Promise.all(fetches).finally(() => setLoading(false))
  }, [terminId]) // eslint-disable-line react-hooks/exhaustive-deps

  const addBlock = async (type: CateringType = 'none') => {
    setAdding(true)
    try {
      const created = await createCateringBlock(terminId, { type, label: '' })
      setBlocks(prev => [...prev, created])
    } finally { setAdding(false) }
  }

  const updateBlock = (b: Catering) => setBlocks(prev => prev.map(x => x.id === b.id ? b : x))
  const removeBlock = (id: number) => setBlocks(prev => prev.filter(x => x.id !== id))

  const totalPersons = members.length

  if (loading) return (
    <div className="pt-card flex items-center justify-center" style={{ minHeight: '120px' }}>
      <Loader2 size={16} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="space-y-4">

      {blocks.map(block => (
        <CateringBlock
          key={block.id}
          terminId={terminId}
          block={block}
          members={members}
          isAdmin={isAdmin}
          myContactId={myContactId}
          totalPersons={totalPersons}
          onChanged={updateBlock}
          onDeleted={() => removeBlock(block.id)}
        />
      ))}

      {/* Leerzustand (Nicht-Admin) */}
      {blocks.length === 0 && !isAdmin && (
        <div className="pt-card">
          <div className="pt-card-body text-sm text-gray-500 text-center py-4">Kein Catering geplant</div>
        </div>
      )}

      {/* Hinzufügen */}
      {isAdmin && (
        blocks.length === 0 ? (
          <div className="pt-card">
            <div className="pt-card-header"><span className="pt-card-title">CATERING HINZUFÜGEN</span></div>
            <div className="pt-card-body">
              <div className="grid grid-cols-2 gap-1.5">
                {TYPE_OPTIONS.filter(o => o.value !== 'none').map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => addBlock(opt.value)}
                    disabled={adding}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => addBlock('order')}
            disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Weiterer Catering-Block
          </button>
        )
      )}

      {/* Diät-Übersicht (termin-weit) */}
      {members.length > 0 && (
        <div className="pt-card">
          <div className="pt-card-header"><span className="pt-card-title">DIÄT-ÜBERSICHT</span></div>
          <div className="pt-card-body">
            <DietOverview members={members} />
          </div>
        </div>
      )}

    </div>
  )
}
