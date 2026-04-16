'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Loader2, Paperclip } from 'lucide-react'
import {
  getTravelParty,
  updateTravelPartyMember,
  deleteTravelPartyMember,
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

export default function ReisegruppeView({ terminId, isAdmin }: { terminId: number; isAdmin: boolean }) {
  const [members, setMembers] = useState<TravelPartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { isVisible, toggle, columns } = useColumnVisibility('reisegruppe', REISEGRUPPE_COLUMNS)

  useEffect(() => {
    getTravelParty(terminId)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [terminId])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
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

  const handleAdded = (m: TravelPartyMember) => setMembers(prev => [...prev, m])
  const handleUpdated = (m: TravelPartyMember) => setMembers(prev => prev.map(x => x.id === m.id ? m : x))

  const handleRemove = async (m: TravelPartyMember) => {
    if (!confirm(`${m.firstName} ${m.lastName} aus der Reisegruppe entfernen?`)) return
    await deleteTravelPartyMember(m.terminId, m.id)
    setMembers(prev => prev.filter(x => x.id !== m.id))
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
          <strong>{members.length}</strong> {members.length === 1 ? 'Person' : 'Personen'} in der Reisegruppe
        </div>
      </div>

      {members.length === 0 ? (
        <div className="data-table-wrapper">
          <div className="pt-travel-empty">
            Noch niemand in der Reisegruppe. Mit „+ Hinzufügen" Kontakte auswählen.
          </div>
        </div>
      ) : (
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
                const opts = [m.function1, m.function2, m.function3].filter(Boolean)
                const saving = savingId === m.id
                return (
                  <tr key={m.id}>
                    {isVisible('avail')      && <td><AvailCell status={m.availabilityStatus} /></td>}
                    {isVisible('lastName')   && <td>{m.lastName || EMPTY}{m.contactType === 'guest' && <span className="pt-guest-badge">Gast</span>}</td>}
                    {isVisible('firstName')  && <td>{m.firstName || EMPTY}</td>}
                    {isVisible('role1')      && <td>{isAdmin ? <RolleDropdown value={m.role1} options={opts} saving={saving} onChange={v => updateRole(m, 'role1', v)} /> : (m.role1 || EMPTY)}</td>}
                    {isVisible('role2')      && <td>{isAdmin ? <RolleDropdown value={m.role2} options={opts} saving={saving} onChange={v => updateRole(m, 'role2', v)} /> : (m.role2 || EMPTY)}</td>}
                    {isVisible('role3')      && <td>{isAdmin ? <RolleDropdown value={m.role3} options={opts} saving={saving} onChange={v => updateRole(m, 'role3', v)} /> : (m.role3 || EMPTY)}</td>}
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
