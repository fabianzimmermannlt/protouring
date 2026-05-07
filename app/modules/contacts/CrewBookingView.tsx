'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useT } from '@/app/lib/i18n/LanguageContext'
import {
  getContacts, getTermine, getActiveFunctions, getTravelParty,
  addTravelPartyRole, removeTravelPartyRole,
  getBookingRejections, addBookingRejection, removeBookingRejection,
  type Contact, type Termin, type ActiveFunction,
} from '@/lib/api-client'

type BookedStatus = 'confirmed' | 'rejected' | null

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const AVAIL_CFG: Record<string, { color: string; symbol: string; label: string }> = {
  available:   { color: '#22c55e', symbol: '✓', label: 'Verfügbar' },
  maybe:       { color: '#eab308', symbol: '?', label: 'Vielleicht' },
  unavailable: { color: '#ef4444', symbol: '✗', label: 'Nicht verfügbar' },
  null:        { color: '#d1d5db', symbol: '–', label: 'Keine Angabe' },
}

function availIcon(status: 'available' | 'maybe' | 'unavailable' | null | undefined) {
  const cfg = AVAIL_CFG[status ?? 'null']
  return (
    <span
      title={cfg.label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: '50%',
        background: cfg.color, color: 'white',
        fontSize: 9, fontWeight: 700, flexShrink: 0,
      }}
    >
      {cfg.symbol}
    </span>
  )
}

function BookedToggle({
  status, onChange, disabled,
}: {
  status: BookedStatus
  onChange: (v: BookedStatus) => void
  disabled: boolean
}) {
  const buttons: { value: BookedStatus; label: string; activeColor: string; title: string }[] = [
    { value: 'confirmed', label: '✓', activeColor: '#3b82f6', title: 'Gebucht' },
    { value: null,        label: '–', activeColor: '#9ca3af', title: 'Offen / Zurücksetzen' },
    { value: 'rejected',  label: '✗', activeColor: '#ef4444', title: 'Abgesagt' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {buttons.map(btn => {
        const active = status === btn.value
        return (
          <button
            key={String(btn.value)}
            onClick={() => !disabled && onChange(btn.value)}
            disabled={disabled}
            title={disabled ? '' : btn.title}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: active ? btn.activeColor : '#e5e7eb',
              color: active ? 'white' : '#9ca3af',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function CrewBookingView({ isAdmin }: { isAdmin: boolean }) {
  const translate = useT()
  const [functions, setFunctions]   = useState<ActiveFunction[]>([])
  const [contacts, setContacts]     = useState<Contact[]>([])
  const [termine, setTermine]       = useState<Termin[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedFn, setSelectedFn] = useState<string>('')

  // Wer ist in der Reisegruppe: { `${terminId}:${contactId}:${role}`: 'confirmed' | null }
  const [bookingOverrides, setBookingOverrides] = useState<Record<string, BookedStatus>>({})

  useEffect(() => {
    Promise.all([getActiveFunctions(), getContacts(), getTermine()])
      .then(async ([fns, ctcts, trm]) => {
        setFunctions(fns)
        setContacts(ctcts.filter(c => c.contactType !== 'artist'))
        const today = new Date().toISOString().slice(0, 10)
        const upcoming = trm.filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))
        setTermine(upcoming)
        if (fns.length > 0) setSelectedFn(fns[0].name)

        // Reisegruppen + Rejections laden → Status pro Kontakt/Rolle initialisieren
        const [parties, rejectionSets] = await Promise.all([
          Promise.all(upcoming.map(t => getTravelParty(t.id).catch(() => []))),
          Promise.all(upcoming.map(t => getBookingRejections(t.id).catch(() => []))),
        ])

        const overrides: Record<string, BookedStatus> = {}
        // confirmed: in Reisegruppe mit einer Rolle
        upcoming.forEach((t, i) => {
          parties[i].forEach(m => {
            ;[m.role1, m.role2, m.role3].forEach(r => {
              if (r) overrides[`${t.id}:${m.contactId}:${r}`] = 'confirmed'
            })
          })
        })
        // rejected: explicit rejection (rolle-unabhängig → alle Rollen dieses Kontakts markieren)
        upcoming.forEach((t, i) => {
          rejectionSets[i].forEach(contactId => {
            // Beim ersten Laden kennen wir die Rollen noch nicht → wir merken rejection per contactId
            overrides[`${t.id}:${contactId}:__rejected__`] = 'rejected'
          })
        })
        setBookingOverrides(overrides)
      })
      .finally(() => setLoading(false))
  }, [])

  // Alle Kontakte mit gewählter Funktion — inkl. manuell angelegte Gäste (kein Login)
  const crewMembers = useMemo(() =>
    contacts.filter(c =>
      [c.function1, c.function2, c.function3].some(f => f === selectedFn)
    ),
    [contacts, selectedFn]
  )

  async function handleBookingChange(
    terminId: number,
    contactId: number,
    status: BookedStatus,
    role: string,
  ) {
    const roleKey     = `${terminId}:${contactId}:${role}`
    const rejectKey   = `${terminId}:${contactId}:__rejected__`
    const prevRoleStatus   = bookingOverrides[roleKey] ?? null
    const prevRejectStatus = bookingOverrides[rejectKey] ?? null

    // Optimistisch
    setBookingOverrides(prev => {
      const next = { ...prev }
      if (status === 'confirmed') {
        next[roleKey]   = 'confirmed'
        delete next[rejectKey]
      } else if (status === 'rejected') {
        delete next[roleKey]
        next[rejectKey] = 'rejected'
      } else {
        delete next[roleKey]
        delete next[rejectKey]
      }
      return next
    })

    try {
      if (status === 'confirmed') {
        await addTravelPartyRole(terminId, contactId, role)
        await removeBookingRejection(terminId, contactId)
      } else if (status === 'rejected') {
        await removeTravelPartyRole(terminId, contactId, role)
        await addBookingRejection(terminId, contactId)
      } else {
        await removeTravelPartyRole(terminId, contactId, role)
        await removeBookingRejection(terminId, contactId)
      }
    } catch {
      // Rollback
      setBookingOverrides(prev => {
        const next = { ...prev }
        if (prevRoleStatus) next[roleKey] = prevRoleStatus; else delete next[roleKey]
        if (prevRejectStatus) next[rejectKey] = prevRejectStatus; else delete next[rejectKey]
        return next
      })
    }
  }

  function getBookedStatus(terminId: number, contactId: number, role: string): BookedStatus {
    if (bookingOverrides[`${terminId}:${contactId}:${role}`] === 'confirmed') return 'confirmed'
    if (bookingOverrides[`${terminId}:${contactId}:__rejected__`] === 'rejected') return 'rejected'
    return null
  }

  function getAvailStatus(termin: Termin, userId?: number | null) {
    if (!userId) return null
    return termin.availability?.find(a => a.userId === userId)?.status ?? null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Funktions-Dropdown */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
          {translate('contacts.form.function')}
        </label>
        <select
          value={selectedFn}
          onChange={e => setSelectedFn(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {functions.map(f => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </select>
        {crewMembers.length === 0 && selectedFn && (
          <span className="text-xs text-gray-400 italic">
            {translate('contacts.booking.noCrewForFunction')}
          </span>
        )}
      </div>

      {termine.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">{translate('appointments.empty')}</p>
      ) : (
        // Zwei separate Tabellen nebeneinander – fixe Zeilenhöhe synchronisiert sie
        <div style={{ display: 'flex', width: 'fit-content', maxWidth: '100%', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>

          {/* ── Linke Tabelle: Termine (fix) ── */}
          <div style={{ flexShrink: 0, borderRight: '2px solid #c7d2fe' }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12, width: 432 }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{ height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    Termine
                  </th>
                </tr>
                <tr>
                  <th style={{ width: 80,  height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>{translate('table.date')}</th>
                  <th style={{ width: 144, height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>{translate('table.title')}</th>
                  <th style={{ width: 112, height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>{translate('appointments.card.venue')}</th>
                  <th style={{ width: 96,  height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>{translate('table.city')}</th>
                </tr>
              </thead>
              <tbody>
                {termine.map((t, i) => {
                  const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb'
                  return (
                    <tr key={t.id} style={{ height: 32 }}>
                      <td style={{ width: 80,  height: 32, padding: '0 12px', background: bg, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', color: '#4b5563' }}>
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td style={{ width: 144, height: 32, padding: '0 12px', background: bg, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: '#111827' }} title={t.title || ''}>
                        {t.title || <span style={{ color: '#9ca3af', fontStyle: 'italic', fontWeight: 400 }}>–</span>}
                      </td>
                      <td style={{ width: 112, height: 32, padding: '0 12px', background: bg, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#4b5563' }}>
                        {t.venueName || '–'}
                      </td>
                      <td style={{ width: 96,  height: 32, padding: '0 12px', background: bg, borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#4b5563' }}>
                        {t.city || '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Rechte Tabelle: Crew (scrollbar) ── */}
          <div style={{ overflowX: 'auto', flexShrink: 1 }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {crewMembers.length > 0 ? (
                    <th colSpan={crewMembers.length * 2} style={{ height: 30, padding: '0 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0f4ff', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {translate('contacts.booking.crewFunction').replace('{function}', selectedFn)}
                    </th>
                  ) : (
                    <th style={{ height: 30, background: '#f0f4ff', borderBottom: '1px solid #e5e7eb' }} />
                  )}
                </tr>
                <tr>
                  {crewMembers.map((c, ci) => (
                    <React.Fragment key={c.id}>
                      <th style={{ width: 40, height: 30, padding: '0 4px', textAlign: 'center', fontWeight: 500, fontSize: 11, color: '#818cf8', textTransform: 'uppercase', background: '#f0f4ff', borderBottom: '2px solid #c7d2fe', borderLeft: ci > 0 ? '1px solid #e0e7ff' : undefined }}>{translate('table.availability')}</th>
                      <th style={{ width: 84, minHeight: 30, padding: '2px 8px', textAlign: 'center', background: '#f0f4ff', borderBottom: '2px solid #c7d2fe', borderRight: '1px solid #e0e7ff', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 11, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName} {c.lastName}</div>
                        {c.specification && <div style={{ fontWeight: 400, fontSize: 10, color: '#818cf8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.specification}</div>}
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {termine.map((t, i) => {
                  const bgC = i % 2 === 0 ? '#f8f9ff' : '#f0f4ff'
                  return (
                    <tr key={t.id} style={{ height: 32 }}>
                      {crewMembers.map((c, ci) => {
                        const uid = c.userId ?? null
                        const cid = Number(c.id)
                        return (
                          <React.Fragment key={c.id}>
                            <td style={{ width: 40, height: 32, background: bgC, borderBottom: '1px solid #e0e7ff', borderLeft: ci > 0 ? '1px solid #e0e7ff' : undefined, textAlign: 'center', padding: '0 4px' }}>
                              {c.contactType === 'guest'
                                ? <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'#22c55e', color:'white', fontSize:8, fontWeight:700, letterSpacing:'-0.02em' }} title={translate('contacts.tooltip.manualNoLogin')}>M</span>
                                : availIcon(getAvailStatus(t, uid))}
                            </td>
                            <td style={{ width: 84, height: 32, background: bgC, borderBottom: '1px solid #e0e7ff', borderRight: '1px solid #e0e7ff', textAlign: 'center', padding: '0 4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <BookedToggle
                                  status={getBookedStatus(t.id, cid, selectedFn)}
                                  onChange={s => handleBookingChange(t.id, cid, s, selectedFn)}
                                  disabled={!isAdmin}
                                />
                              </div>
                            </td>
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
        <span className="font-medium text-gray-500">{translate('contacts.booking.legend')}:</span>
        <span className="flex items-center gap-1.5">{translate('table.availability')}: {(['available','maybe','unavailable','null'] as const).map(s => { const c = AVAIL_CFG[s]; return <span key={s} className="flex items-center gap-0.5"><span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:c.color, color:'white', fontSize:8, fontWeight:700 }}>{c.symbol}</span> {c.label}</span> })}</span>
        <span>{translate('contacts.booking.bookingLegend')}: <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'#3b82f6', color:'white', fontSize:9, fontWeight:700 }}>✓</span> gebucht · <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'#ef4444', color:'white', fontSize:9, fontWeight:700 }}>✗</span> abgesagt · <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'#e5e7eb', color:'#9ca3af', fontSize:9, fontWeight:700 }}>–</span> offen</span>
      </div>
    </div>
  )
}
