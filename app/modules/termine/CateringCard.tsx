'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Pencil, Save, X, Plus, Trash2, UtensilsCrossed, Building2, Banknote, ShoppingBag } from 'lucide-react'
import { RichTextEditor } from '@/app/components/shared/RichTextEditor'
import { renderBoardContent } from '@/app/components/shared/ContentBoard'
import {
  getCatering, saveCatering, getCateringOrders, createCateringOrder, updateCateringOrder, deleteCateringOrder,
  getCurrentTenant, getMyContact,
  type Catering, type CateringType, type CateringMember, type CateringOrder,
} from '@/lib/api-client'

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: CateringType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'none',    label: 'Kein Catering', icon: <UtensilsCrossed size={14} />, color: '#6b7280' },
  { value: 'inhouse', label: 'Inhouse',        icon: <Building2 size={14} />,       color: '#3b82f6' },
  { value: 'buyout',  label: 'Buy Out',         icon: <Banknote size={14} />,        color: '#10b981' },
  { value: 'order',   label: 'Auf Bestellung',  icon: <ShoppingBag size={14} />,     color: '#f59e0b' },
]

function getCurrency(): string {
  try {
    const d = JSON.parse(localStorage.getItem('protouring_artist_data') ?? '{}')
    return d.currency ?? 'EUR'
  } catch { return 'EUR' }
}

function getCurrencySymbol(c: string): string {
  return c === 'USD' ? '$' : c === 'GBP' ? '£' : '€'
}

// ── DietOverview ─────────────────────────────────────────────────────────────

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
    <div className="border-t border-gray-100 pt-3 mt-1">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Insg. {members.length} {members.length === 1 ? 'Person' : 'Personen'}, davon ernähren sich:
      </div>
      <div className="space-y-1.5 text-xs text-gray-700">
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

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: color }}>
      {label}
    </span>
  )
}

// ── OrderList ─────────────────────────────────────────────────────────────────

function OrderList({
  terminId, members, isAdmin, myContactId,
}: {
  terminId: number
  members: CateringMember[]
  isAdmin: boolean
  myContactId: number | null
}) {
  const [orders, setOrders]       = useState<CateringOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [editText, setEditText]   = useState('')
  const [editContact, setEditContact] = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    getCateringOrders(terminId)
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [terminId])

  const startNew = () => {
    setEditingId('new')
    setEditText('')
    setEditContact('')
  }

  const startEdit = (o: CateringOrder) => {
    setEditingId(o.id)
    setEditText(o.orderText)
    setEditContact(o.contactName ?? '')
  }

  const cancel = () => { setEditingId(null); setEditText(''); setEditContact('') }

  const save = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const created = await createCateringOrder(terminId, {
          contactId:   isAdmin ? undefined : (myContactId ?? undefined),
          contactName: editContact.trim() || undefined,
          orderText:   editText.trim(),
        })
        setOrders(prev => [...prev, created])
      } else {
        const updated = await updateCateringOrder(terminId, editingId as number, editText.trim())
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
      }
      cancel()
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    await deleteCateringOrder(terminId, id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  // Crew kann nur eigene Zeile bearbeiten
  const canEdit = (o: CateringOrder) =>
    isAdmin || (myContactId !== null && o.contactId === myContactId)

  // Reisegruppe als Auswahl für Kontaktname
  const memberOptions = members.map(m => `${m.firstName} ${m.lastName}`.trim())

  // Namen die bereits eine Bestellung haben (für Ausgrauen im Dropdown)
  const orderedNames = (editingId: number | 'new' | null) =>
    new Set(orders.filter(o => o.id !== editingId).map(o => o.contactName).filter(Boolean) as string[])

  if (loading) return <div className="py-2 text-center"><Loader2 size={13} className="animate-spin text-gray-300 mx-auto" /></div>

  return (
    <div className="border-t border-gray-100 pt-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bestellliste</div>
        {isAdmin && editingId === null && (
          <button onClick={startNew} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Plus size={13} />
          </button>
        )}
      </div>

      {orders.length === 0 && editingId === null && (
        <div className="text-xs text-gray-400 text-center py-2">
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
                  orderedNames={orderedNames(o.id)}
                  isAdmin={isAdmin}
                  saving={saving}
                  onTextChange={setEditText}
                  onContactChange={setEditContact}
                  onSave={save}
                  onCancel={cancel}
                />
              ) : (
                <div className="text-xs text-gray-700">
                  {o.contactName && (
                    <span className="font-medium text-gray-500">{o.contactName}: </span>
                  )}
                  {o.orderText}
                </div>
              )}
            </div>
            {editingId !== o.id && canEdit(o) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(o)} className="text-gray-300 hover:text-gray-500">
                  <Pencil size={11} />
                </button>
                {isAdmin && (
                  <button onClick={() => remove(o.id)} className="text-gray-300 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Neue Zeile */}
        {editingId === 'new' && (
          <OrderEditRow
            text={editText}
            contactName={editContact}
            memberOptions={memberOptions}
            orderedNames={orderedNames('new')}
            isAdmin={isAdmin}
            saving={saving}
            onTextChange={setEditText}
            onContactChange={setEditContact}
            onSave={save}
            onCancel={cancel}
          />
        )}
      </div>

      {/* Crew: eigene Zeile hinzufügen — nur wenn in der Reisegruppe */}
      {!isAdmin && myContactId !== null && editingId === null &&
        members.some(m => m.contactId === myContactId) &&
        !orders.some(o => o.contactId === myContactId) && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            {(() => {
              const me = members.find(m => m.contactId === myContactId)
              const myName = me ? `${me.firstName} ${me.lastName}`.trim() : ''
              return (
                <button
                  onClick={() => {
                    setEditContact(myName)
                    setEditingId('new')
                    setEditText('')
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
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
            <option key={n} value={n} disabled={orderedNames.has(n)} style={orderedNames.has(n) ? { color: '#9ca3af' } : undefined}>
              {n}{orderedNames.has(n) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      ) : contactName ? (
        <div className="text-xs font-medium text-gray-500 px-0.5">{contactName}</div>
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

// ── Main component ───────────────────────────────────────────────────────────

export default function CateringCard({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  const [catering, setCatering]     = useState<Catering | null>(null)
  const [members, setMembers]       = useState<CateringMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [notesOpen, setNotesOpen]   = useState(false)
  const [myContactId, setMyContactId] = useState<number | null>(null)

  // Meta-Felder (Kontakt)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  // Buyout
  const [buyoutAmount, setBuyoutAmount] = useState('')

  const currency = getCurrency()
  const currSymbol = getCurrencySymbol(currency)

  const tenant  = getCurrentTenant()
  const isActualAdmin = !!tenant && ['owner', 'admin', 'manager'].includes(tenant.role)
  void isActualAdmin // fallback to prop

  useEffect(() => {
    const fetches: Promise<void>[] = [
      getCatering(terminId).then(data => {
        setCatering(data.catering)
        setMembers(data.members)
        setContactName(data.catering?.contactName ?? '')
        setContactPhone(data.catering?.contactPhone ?? '')
        setBuyoutAmount(data.catering?.buyoutAmount != null ? String(data.catering.buyoutAmount) : '')
      }).catch(() => {}),
    ]
    if (!isAdmin) {
      fetches.push(getMyContact().then(c => setMyContactId(Number(c.id))).catch(() => {}))
    }
    Promise.all(fetches).finally(() => setLoading(false))
  }, [terminId]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentType = catering?.type ?? 'none'

  const save = useCallback(async (patch: Partial<Omit<Catering, 'id' | 'terminId'>>) => {
    setSaving(true)
    try {
      const updated = await saveCatering(terminId, {
        type:         patch.type         ?? currentType,
        buyoutAmount: patch.buyoutAmount !== undefined ? patch.buyoutAmount : (buyoutAmount ? parseFloat(buyoutAmount) : null),
        notes:        patch.notes        !== undefined ? patch.notes        : (catering?.notes ?? null),
        contactName:  patch.contactName  !== undefined ? patch.contactName  : contactName,
        contactPhone: patch.contactPhone !== undefined ? patch.contactPhone : contactPhone,
      })
      setCatering(updated)
    } finally { setSaving(false) }
  }, [terminId, currentType, buyoutAmount, catering?.notes, contactName, contactPhone])

  const handleTypeChange = async (type: CateringType) => {
    await save({ type })
  }

  const handleNotesSave = async (_title: string, html: string) => {
    await save({ notes: html })
    setNotesOpen(false)
  }

  const handleMetaSave = async () => {
    await save({ contactName, contactPhone })
    setEditingMeta(false)
  }

  const handleBuyoutSave = async () => {
    await save({ buyoutAmount: buyoutAmount ? parseFloat(buyoutAmount) : null })
  }

  const totalPersons = members.length
  const totalBuyout = buyoutAmount && totalPersons > 0
    ? (parseFloat(buyoutAmount) * totalPersons).toFixed(2)
    : null

  if (loading) return (
    <div className="pt-card flex items-center justify-center" style={{ minHeight: '120px' }}>
      <Loader2 size={16} className="animate-spin text-gray-400" />
    </div>
  )

  const activeOption = TYPE_OPTIONS.find(o => o.value === currentType)

  return (
    <div className="pt-card">
      <div className="pt-card-header">
        <span className="pt-card-title">CATERING</span>
        {saving && <Loader2 size={12} className="animate-spin text-gray-300" />}
        {/* Aktiver Typ als Badge */}
        {currentType !== 'none' && activeOption && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
            style={{ background: activeOption.color }}
          >
            {activeOption.label}
          </span>
        )}
      </div>

      <div className="pt-card-body space-y-3">

        {/* ── Typ-Auswahl ── */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-1.5">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTypeChange(opt.value)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  borderColor: currentType === opt.value ? opt.color : '#e5e7eb',
                  background:  currentType === opt.value ? `${opt.color}18` : '#fff',
                  color:       currentType === opt.value ? opt.color : '#6b7280',
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {!isAdmin && currentType === 'none' && (
          <div className="text-sm text-gray-400 text-center py-2">Kein Catering geplant</div>
        )}

        {/* ── Buyout-Betrag ── */}
        {currentType === 'buyout' && (
          <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-gray-500 whitespace-nowrap">Pro Person</span>
              {isAdmin ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="form-input text-sm py-0.5 w-24"
                    value={buyoutAmount}
                    onChange={e => setBuyoutAmount(e.target.value)}
                    onBlur={handleBuyoutSave}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-xs text-gray-500">{currency}</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-green-700">
                  {buyoutAmount ? `${buyoutAmount} ${currency}` : '–'}
                </span>
              )}
            </div>
            {totalBuyout && (
              <div className="text-xs text-green-700 font-semibold whitespace-nowrap">
                = {currSymbol}{totalBuyout} gesamt
              </div>
            )}
          </div>
        )}

        {/* ── Bestellliste ── */}
        {currentType === 'order' && (
          <OrderList
            terminId={terminId}
            members={members}
            isAdmin={isAdmin}
            myContactId={myContactId}
          />
        )}

        {/* ── Notizen ── */}
        {currentType !== 'none' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Infos</div>
              {isAdmin && (
                <button onClick={() => setNotesOpen(true)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <Pencil size={11} />
                </button>
              )}
            </div>
            {catering?.notes ? (
              <div
                className="rich-content text-sm text-gray-700 space-y-0.5 cursor-pointer"
                onClick={() => isAdmin && setNotesOpen(true)}
              >
                {renderBoardContent(catering.notes)}
              </div>
            ) : (
              isAdmin ? (
                <button
                  onClick={() => setNotesOpen(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  + Notiz hinzufügen
                </button>
              ) : (
                <span className="text-xs text-gray-400">Keine Notizen</span>
              )
            )}
          </div>
        )}

        <RichTextEditor
          isOpen={notesOpen}
          onClose={() => setNotesOpen(false)}
          title="Catering-Notizen"
          content={catering?.notes ?? ''}
          onSave={handleNotesSave}
        />

        {/* ── Catering-Kontakt ── */}
        {currentType !== 'none' && isAdmin && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt</div>
              {!editingMeta ? (
                <button onClick={() => setEditingMeta(true)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <Pencil size={11} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={handleMetaSave} className="text-green-500 hover:text-green-700"><Save size={11} /></button>
                  <button onClick={() => setEditingMeta(false)} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
                </div>
              )}
            </div>
            {editingMeta ? (
              <div className="flex gap-2">
                <input
                  className="form-input text-xs py-0.5 flex-1"
                  placeholder="Name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                />
                <input
                  className="form-input text-xs py-0.5 flex-1"
                  placeholder="Telefon"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                />
              </div>
            ) : (contactName || contactPhone) ? (
              <div className="text-xs text-gray-600">
                {contactName && <span className="font-medium">{contactName}</span>}
                {contactName && contactPhone && ' · '}
                {contactPhone && <span>{contactPhone}</span>}
              </div>
            ) : (
              <div className="text-xs text-gray-400">Kein Kontakt hinterlegt</div>
            )}
          </div>
        )}

        {/* ── Diät-Übersicht ── */}
        <DietOverview members={members} />

      </div>
    </div>
  )
}
