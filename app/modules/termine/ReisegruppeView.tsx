'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Loader2, Paperclip, Mail, Phone } from 'lucide-react'
import { useIsMobile } from '@/app/hooks/useIsMobile'
import {
  getTravelPartyWithExcluded,
  updateTravelPartyMember,
  deleteTravelPartyMember,
  excludeArtistMemberFromTermin,
  restoreArtistMemberToTermin,
  type TravelPartyMember,
} from '@/lib/api-client'
import ReisegruppePicker from './ReisegruppePicker'
import ColumnToggle from '@/app/components/shared/ColumnToggle'
import { useColumnVisibility } from '@/app/components/shared/useColumnVisibility'

const REISEGRUPPE_COLUMNS = [
  { id: 'avail',      label: 'Verfügbarkeit',  defaultVisible: true,  alwaysVisible: true },
  { id: 'lastName',   label: 'Nachname',        defaultVisible: true,  alwaysVisible: true },
  { id: 'firstName',  label: 'Vorname',         defaultVisible: true },
  { id: 'role1',      label: 'Funktion 1',      defaultVisible: true },
  { id: 'role2',      label: 'Funktion 2',      defaultVisible: true },
  { id: 'role3',      label: 'Funktion 3',      defaultVisible: false },
  { id: 'email',      label: 'E-Mail',          defaultVisible: true },
  { id: 'phone',      label: 'Telefon',         defaultVisible: true },
  { id: 'postalCode', label: 'PLZ',             defaultVisible: false },
  { id: 'residence',  label: 'Ort',             defaultVisible: true },
  { id: 'files',      label: 'Dateien',         defaultVisible: false },
]

type SortKey = 'availabilityStatus' | 'lastName' | 'firstName' | 'role1' | 'role2' | 'role3' | 'email' | 'phone' | 'postalCode' | 'residence'

const AVAIL_ORDER: Record<string, number> = { available: 0, maybe: 1, unknown: 2, unavailable: 3 }

function AvailCell({ status }: { status: TravelPartyMember['availabilityStatus'] }) {
  if (status === 'available')   return <span className="pt-travel-avail pt-travel-avail--available"  title="verfügbar">✓</span>
  if (status === 'maybe')       return <span className="pt-travel-avail pt-travel-avail--maybe"      title="vielleicht">?</span>
  if (status === 'unavailable') return <span className="pt-travel-avail pt-travel-avail--unavailable" title="nicht verfügbar">✗</span>
  return <span className="pt-travel-avail pt-travel-avail--unknown" title="keine Angabe">–</span>
}

function RolleDropdown({ value, options, saving, onChange }: {
  value: string
  options: string[]
  saving: boolean
  onChange: (v: string) => void
}) {
  const optionSet = new Set(options)
  const showLegacy = value && !optionSet.has(value)
  return (
    <select
      className="pt-travel-role-select"
      value={value}
      disabled={saving}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">–</option>
      {showLegacy && (
        <option value={value}>{value}</option>
      )}
      {options.map(fn => (
        <option key={fn} value={fn}>{fn}</option>
      ))}
    </select>
  )
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`sort-indicator${active ? ' active' : ''}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )
}

const EMPTY = <span className="text-gray-400">–</span>

function BandBlock({
  members, excludedMembers, isMobile, isAdmin, terminId,
  onExclude, onRestore,
}: {
  members: TravelPartyMember[]
  excludedMembers: TravelPartyMember[]
  isMobile: boolean
  isAdmin: boolean
  terminId: number
  onExclude: (m: TravelPartyMember) => void
  onRestore: (m: TravelPartyMember) => void
}) {
  const active = members
  const excluded = excludedMembers

  if (active.length === 0 && excluded.length === 0) return null

  const renderCard = (m: TravelPartyMember, isExcluded: boolean) => (
    <div key={m.id} className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${isExcluded ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-100'}`}>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {m.firstName} {m.lastName}
        </div>
        {(m.role1 || m.function1) && (
          <div className="text-xs text-gray-500 mt-0.5">
            {[m.role1 || m.function1, m.role2 || m.function2, m.role3 || m.function3].filter(Boolean).join(' · ')}
          </div>
        )}
        {!isExcluded && (
          <div className="flex flex-wrap gap-3 mt-1.5">
            {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-blue-600"><Mail size={11} /> {m.email}</a>}
            {m.phone && <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-xs text-blue-600"><Phone size={11} /> {m.phone}</a>}
          </div>
        )}
      </div>
      {isAdmin && (
        isExcluded
          ? <button onClick={() => onRestore(m)} className="text-xs text-blue-600 hover:underline flex-shrink-0 mt-0.5">Wieder dabei</button>
          : <button onClick={() => onExclude(m)} className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
      )}
    </div>
  )

  const renderRow = (m: TravelPartyMember, isExcluded: boolean) => (
    <tr key={m.id} className={isExcluded ? 'opacity-40' : 'bg-blue-50/40'}>
      <td style={{ width: '2.5rem' }}>
        {isExcluded
          ? <span className="pt-travel-avail pt-travel-avail--unavailable" title="abwesend bei diesem Termin">✗</span>
          : <span className="pt-travel-avail pt-travel-avail--available" title="immer dabei">✓</span>
        }
      </td>
      <td className={`font-medium ${isExcluded ? 'line-through text-gray-400' : ''}`}>{m.lastName || <span className="text-gray-400">–</span>}</td>
      <td className={isExcluded ? 'text-gray-400' : ''}>{m.firstName || <span className="text-gray-400">–</span>}</td>
      <td>{m.role1 || m.function1 || <span className="text-gray-400">–</span>}</td>
      <td>{m.role2 || m.function2 || <span className="text-gray-400">–</span>}</td>
      <td>{m.role3 || m.function3 || <span className="text-gray-400">–</span>}</td>
      <td>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : <span className="text-gray-400">–</span>}</td>
      <td>{m.phone ? <a href={`tel:${m.phone}`}>{m.phone}</a> : <span className="text-gray-400">–</span>}</td>
      <td /><td /><td />
      <td>
        {isAdmin && (
          isExcluded
            ? <button onClick={() => onRestore(m)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">Wieder dabei</button>
            : <button onClick={() => onExclude(m)} className="pt-travel-action-btn pt-travel-action-btn--danger" title="Für diesen Termin entfernen"><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  )

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Band</span>
        {excluded.length > 0 && <span className="text-xs text-orange-400">{excluded.length} abwesend</span>}
      </div>
      {isMobile ? (
        <div className="flex flex-col gap-2">
          {active.map(m => renderCard(m, false))}
          {excluded.map(m => renderCard(m, true))}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table data-table--compact">
            <tbody>
              {active.map(m => renderRow(m, false))}
              {excluded.map(m => renderRow(m, true))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ReisegruppeView({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  const [members, setMembers] = useState<TravelPartyMember[]>([])
  const [excludedBandMembers, setExcludedBandMembers] = useState<TravelPartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TravelPartyMember | null>(null)
  const [editRoles, setEditRoles] = useState<{ role1: string; role2: string; role3: string }>({ role1: '', role2: '', role3: '' })
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { isVisible, toggle, columns } = useColumnVisibility('reisegruppe', REISEGRUPPE_COLUMNS)

  useEffect(() => {
    getTravelPartyWithExcluded(terminId)
      .then(({ members, excludedBandMembers }) => {
        setMembers(members)
        setExcludedBandMembers(excludedBandMembers)
      })
      .catch(() => { setMembers([]); setExcludedBandMembers([]) })
      .finally(() => setLoading(false))
  }, [terminId])

  const bandMembers = members.filter(m => m.isArtistMember)
  const crewMembers = members.filter(m => !m.isArtistMember)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedMembers = useMemo(() => {
    return members.filter(m => !m.isArtistMember).sort((a, b) => {
      let cmp = 0
      if (sortKey === 'availabilityStatus') {
        cmp = (AVAIL_ORDER[a.availabilityStatus ?? 'unknown'] ?? 2) - (AVAIL_ORDER[b.availabilityStatus ?? 'unknown'] ?? 2)
      } else {
        const av = (a[sortKey] ?? '').toLowerCase()
        const bv = (b[sortKey] ?? '').toLowerCase()
        cmp = av.localeCompare(bv, 'de')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [members, sortKey, sortDir])

  const isMobile = useIsMobile()

  const openEditModal = (m: TravelPartyMember) => {
    setEditingMember(m)
    setEditRoles({ role1: m.role1 || '', role2: m.role2 || '', role3: m.role3 || '' })
  }

  const handleSaveRoles = async () => {
    if (!editingMember) return
    setSavingId(editingMember.id)
    try {
      const updated = await updateTravelPartyMember(editingMember.terminId, editingMember.id, editRoles)
      handleUpdated(updated)
      setEditingMember(null)
    } finally {
      setSavingId(null)
    }
  }

  const handleAdded = (m: TravelPartyMember) => setMembers(prev => [...prev, m])
  const handleUpdated = (m: TravelPartyMember) => setMembers(prev => prev.map(x => x.id === m.id ? m : x))

  const handleRemove = async (m: TravelPartyMember) => {
    if (!confirm(`${m.firstName} ${m.lastName} aus der Reisegruppe entfernen?`)) return
    await deleteTravelPartyMember(m.terminId, m.id)
    setMembers(prev => prev.filter(x => x.id !== m.id))
  }

  const handleExcludeArtist = async (m: TravelPartyMember) => {
    if (!confirm(`${m.firstName} ${m.lastName} für diesen Termin als abwesend markieren?`)) return
    await excludeArtistMemberFromTermin(m.terminId, m.id)
    setMembers(prev => prev.filter(x => x.id !== m.id))
    setExcludedBandMembers(prev => [...prev, { ...m, excluded: true }])
  }

  const handleRestoreArtist = async (m: TravelPartyMember) => {
    await restoreArtistMemberToTermin(m.terminId, m.id)
    setExcludedBandMembers(prev => prev.filter(x => x.id !== m.id))
    setMembers(prev => [...prev, { ...m, excluded: false }])
  }

  const updateRole = async (m: TravelPartyMember, field: 'role1' | 'role2' | 'role3', value: string) => {
    setSavingId(m.id)
    try {
      const updated = await updateTravelPartyMember(m.terminId, m.id, {
        role1: field === 'role1' ? value : m.role1,
        role2: field === 'role2' ? value : m.role2,
        role3: field === 'role3' ? value : m.role3,
      })
      handleUpdated(updated)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const totalActive = crewMembers.length + bandMembers.length

  return (
    <div>
      <div className="pt-travel-header">
        {isAdmin ? (
          <div className="flex gap-2">
            <button onClick={() => setPickerOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Hinzufügen
            </button>
          </div>
        ) : <div />}
        <div className="pt-travel-count">
          <strong>{totalActive}</strong> {totalActive === 1 ? 'Person' : 'Personen'} in der Reisegruppe
        </div>
      </div>

      {crewMembers.length === 0 ? (
        <div className="data-table-wrapper">
          <div className="pt-travel-empty">
            Noch niemand in der Crew. Mit „+ Hinzufügen" Kontakte auswählen.
          </div>
        </div>
      ) : isMobile ? (
        /* ── Mobile Card List ── */
        <>
        <div className="flex flex-col gap-2 mt-2">
          {sortedMembers.map(m => {
            const functions = [m.role1, m.role2, m.role3].filter(Boolean).join(' · ')
            return (
              <div
                key={m.id}
                className={`bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 ${isAdmin ? 'cursor-pointer active:bg-gray-50' : ''}`}
                onClick={() => isAdmin && openEditModal(m)}
              >
                {/* Availability */}
                <div className="flex-shrink-0 pt-1">
                  <AvailCell status={m.availabilityStatus} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {m.firstName} {m.lastName}
                    </span>
                    {m.contactType === 'guest' && (
                      <span className="pt-guest-badge">Gast</span>
                    )}
                  </div>
                  {functions ? (
                    <div className="text-xs text-gray-500 mt-0.5">{functions}</div>
                  ) : isAdmin ? (
                    <div className="text-xs text-gray-300 mt-0.5 italic">Funktion tippen zum Bearbeiten</div>
                  ) : null}
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-blue-600"
                        onClick={e => e.stopPropagation()}>
                        <Mail size={11} /> {m.email}
                      </a>
                    )}
                    {(m.phone || m.mobile) && (
                      <a href={`tel:${m.phone || m.mobile}`} className="flex items-center gap-1 text-xs text-blue-600"
                        onClick={e => e.stopPropagation()}>
                        <Phone size={11} /> {m.phone || m.mobile}
                      </a>
                    )}
                  </div>
                </div>
                {/* Actions */}
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(m) }}
                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Bottom Sheet: Funktionen bearbeiten ── */}
        {editingMember && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setEditingMember(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative bg-white rounded-t-2xl px-5 pt-4 pb-8 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-900 mb-4">
                {editingMember.firstName} {editingMember.lastName}
              </p>
              {(['role1', 'role2', 'role3'] as const).map((field, i) => {
                const allOpts = [editingMember.function1, editingMember.function2, editingMember.function3].filter(Boolean) as string[]
                const otherFields = (['role1', 'role2', 'role3'] as const).filter(f => f !== field)
                const usedElsewhere = new Set(otherFields.map(f => editRoles[f]).filter(Boolean))
                const opts = allOpts.filter(fn => !usedElsewhere.has(fn) || fn === editRoles[field])
                return (
                  <div key={field} className="mb-3">
                    <label className="block text-xs text-gray-400 mb-1">Funktion {i + 1}</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white"
                      value={editRoles[field]}
                      onChange={e => setEditRoles(prev => ({ ...prev, [field]: e.target.value }))}
                    >
                      <option value="">–</option>
                      {opts.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                  </div>
                )
              })}
              <button
                onClick={handleSaveRoles}
                disabled={savingId === editingMember.id}
                className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
              >
                {savingId === editingMember.id ? 'Wird gespeichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        )}
        </>
      ) : (
        /* ── Desktop Table ── */
        <div className="data-table-wrapper">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                {isVisible('avail')      && <th className="sortable" style={{ width: '2.5rem' }} onClick={() => toggleSort('availabilityStatus')}><SortIndicator active={sortKey === 'availabilityStatus'} dir={sortDir} /></th>}
                {isVisible('lastName')   && <th className="sortable" onClick={() => toggleSort('lastName')}>Nachname <SortIndicator active={sortKey === 'lastName'} dir={sortDir} /></th>}
                {isVisible('firstName')  && <th className="sortable" onClick={() => toggleSort('firstName')}>Vorname <SortIndicator active={sortKey === 'firstName'} dir={sortDir} /></th>}
                {isVisible('role1')      && <th className="sortable" onClick={() => toggleSort('role1')}>Funktion 1 <SortIndicator active={sortKey === 'role1'} dir={sortDir} /></th>}
                {isVisible('role2')      && <th className="sortable" onClick={() => toggleSort('role2')}>Funktion 2 <SortIndicator active={sortKey === 'role2'} dir={sortDir} /></th>}
                {isVisible('role3')      && <th className="sortable" onClick={() => toggleSort('role3')}>Funktion 3 <SortIndicator active={sortKey === 'role3'} dir={sortDir} /></th>}
                {isVisible('email')      && <th className="sortable" onClick={() => toggleSort('email')}>E-Mail <SortIndicator active={sortKey === 'email'} dir={sortDir} /></th>}
                {isVisible('phone')      && <th className="sortable" onClick={() => toggleSort('phone')}>Telefon <SortIndicator active={sortKey === 'phone'} dir={sortDir} /></th>}
                {isVisible('postalCode') && <th className="sortable" onClick={() => toggleSort('postalCode')}>PLZ <SortIndicator active={sortKey === 'postalCode'} dir={sortDir} /></th>}
                {isVisible('residence')  && <th className="sortable" onClick={() => toggleSort('residence')}>Ort <SortIndicator active={sortKey === 'residence'} dir={sortDir} /></th>}
                {isVisible('files')      && <th style={{ width: '4rem' }}>Dateien</th>}
                <th style={{ width: '3rem', textAlign: 'right' }}>
                  <ColumnToggle columns={columns} isVisible={isVisible} toggle={toggle} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map(m => {
                const allOpts = [m.function1, m.function2, m.function3].filter(Boolean) as string[]
                const saving = savingId === m.id
                const optsFor = (field: 'role1'|'role2'|'role3') => {
                  const others = (['role1','role2','role3'] as const).filter(f => f !== field)
                  const used = new Set(others.map(f => m[f]).filter(Boolean))
                  return allOpts.filter(fn => !used.has(fn) || fn === m[field])
                }
                return (
                  <tr key={m.id}>
                    {isVisible('avail')      && <td><AvailCell status={m.availabilityStatus} /></td>}
                    {isVisible('lastName')   && <td>{m.lastName || EMPTY}{m.contactType === 'guest' && <span className="pt-guest-badge">Gast</span>}</td>}
                    {isVisible('firstName')  && <td>{m.firstName || EMPTY}</td>}
                    {isVisible('role1')      && <td>{isAdmin ? <RolleDropdown value={m.role1} options={optsFor('role1')} saving={saving} onChange={v => updateRole(m, 'role1', v)} /> : (m.role1 || EMPTY)}</td>}
                    {isVisible('role2')      && <td>{isAdmin ? <RolleDropdown value={m.role2} options={optsFor('role2')} saving={saving} onChange={v => updateRole(m, 'role2', v)} /> : (m.role2 || EMPTY)}</td>}
                    {isVisible('role3')      && <td>{isAdmin ? <RolleDropdown value={m.role3} options={optsFor('role3')} saving={saving} onChange={v => updateRole(m, 'role3', v)} /> : (m.role3 || EMPTY)}</td>}
                    {isVisible('email')      && <td>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : EMPTY}</td>}
                    {isVisible('phone')      && <td>{(m.phone || m.mobile) ? <a href={`tel:${m.phone || m.mobile}`}>{m.phone || m.mobile}</a> : EMPTY}</td>}
                    {isVisible('postalCode') && <td>{m.postalCode || EMPTY}</td>}
                    {isVisible('residence')  && <td>{m.residence || EMPTY}</td>}
                    {isVisible('files')      && <td><button className="pt-travel-action-btn" title="Dateien (kommt in Phase 1b)" disabled><Paperclip size={13} /></button></td>}
                    <td>
                      <div className="pt-travel-actions">
                        {isAdmin && (
                          <button className="pt-travel-action-btn pt-travel-action-btn--danger" onClick={() => handleRemove(m)} title="Entfernen">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <BandBlock
        members={bandMembers}
        excludedMembers={excludedBandMembers}
        isMobile={isMobile}
        isAdmin={isAdmin}
        terminId={terminId}
        onExclude={handleExcludeArtist}
        onRestore={handleRestoreArtist}
      />

      {pickerOpen && (
        <ReisegruppePicker
          terminId={terminId}
          onClose={() => setPickerOpen(false)}
          onAdded={handleAdded}
        />
      )}

    </div>
  )
}
