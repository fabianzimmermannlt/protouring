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

// ── L2 Dark Palette ───────────────────────────────────────────────────────────
const C = {
  bgRow1:     '#1e1e1e',
  bgRow2:     '#232323',
  bgHead:     '#2d2d2d',
  bgCrewHead: '#222230',
  bgCrewRow1: '#1e1e28',
  bgCrewRow2: '#22222e',
  border:     '#333',
  borderCrew: '#3a3a55',
  borderSep:  '#5b5b8a',
  textPri:    '#e0e0e0',
  textSec:    '#9ca3af',
  textMuted:  '#555',
  textAccent: '#7c7cf8',
}

const AVAIL_CFG: Record<string, { color: string; symbol: string; label: string }> = {
  available:   { color: '#22c55e', symbol: '✓', label: 'Verfügbar' },
  maybe:       { color: '#eab308', symbol: '?', label: 'Vielleicht' },
  unavailable: { color: '#ef4444', symbol: '✗', label: 'Nicht verfügbar' },
  null:        { color: '#3a3a3a', symbol: '–', label: 'Keine Angabe' },
}

function AvailIcon({ status }: { status: 'available' | 'maybe' | 'unavailable' | null | undefined }) {
  const cfg = AVAIL_CFG[status ?? 'null']
  return (
    <span title={cfg.label} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: '50%',
      background: cfg.color, color: status ? 'white' : '#888',
      fontSize: 9, fontWeight: 700, flexShrink: 0,
    }}>{cfg.symbol}</span>
  )
}

function BookedToggle({ status, onChange, disabled }: {
  status: BookedStatus; onChange: (v: BookedStatus) => void; disabled: boolean
}) {
  const btns: { value: BookedStatus; label: string; active: string; title: string }[] = [
    { value: 'confirmed', label: '✓', active: '#3b82f6', title: 'Gebucht' },
    { value: null,        label: '–', active: '#555',    title: 'Offen' },
    { value: 'rejected',  label: '✗', active: '#ef4444', title: 'Abgesagt' },
  ]
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {btns.map(btn => {
        const on = status === btn.value
        return (
          <button key={String(btn.value)} onClick={() => !disabled && onChange(btn.value)}
            disabled={disabled} title={disabled ? '' : btn.title}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: on ? btn.active : '#2e2e2e',
              color: on ? 'white' : '#555',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: on ? 'none' : '1px solid #3a3a3a',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'background 0.15s',
            }}>{btn.label}</button>
        )
      })}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function CrewBookingView({ isAdmin }: { isAdmin: boolean }) {
  const t = useT()
  const [functions, setFunctions] = useState<ActiveFunction[]>([])
  const [contacts,  setContacts]  = useState<Contact[]>([])
  const [termine,   setTermine]   = useState<Termin[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selectedFn, setSelectedFn] = useState('')
  const [overrides,  setOverrides]  = useState<Record<string, BookedStatus>>({})

  useEffect(() => {
    Promise.all([getActiveFunctions(), getContacts(), getTermine()])
      .then(async ([fns, ctcts, trm]) => {
        setFunctions(fns)
        setContacts(ctcts.filter(c => c.contactType !== 'artist'))
        const today = new Date().toISOString().slice(0, 10)
        const upcoming = trm.filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))
        setTermine(upcoming)
        if (fns.length > 0) setSelectedFn(fns[0].name)

        const [parties, rejections] = await Promise.all([
          Promise.all(upcoming.map(x => getTravelParty(x.id).catch(() => []))),
          Promise.all(upcoming.map(x => getBookingRejections(x.id).catch(() => []))),
        ])
        const ov: Record<string, BookedStatus> = {}
        upcoming.forEach((x, i) => {
          parties[i].forEach(m => {
            ;[m.role1, m.role2, m.role3].forEach(r => { if (r) ov[`${x.id}:${m.contactId}:${r}`] = 'confirmed' })
          })
          rejections[i].forEach(cid => { ov[`${x.id}:${cid}:__rejected__`] = 'rejected' })
        })
        setOverrides(ov)
      })
      .finally(() => setLoading(false))
  }, [])

  const crew = useMemo(() =>
    contacts.filter(c => [c.function1, c.function2, c.function3].some(f => f === selectedFn)),
    [contacts, selectedFn]
  )

  async function handleChange(terminId: number, contactId: number, status: BookedStatus, role: string) {
    const rk = `${terminId}:${contactId}:${role}`
    const xk = `${terminId}:${contactId}:__rejected__`
    const pr = overrides[rk] ?? null
    const px = overrides[xk] ?? null

    setOverrides(prev => {
      const n = { ...prev }
      if (status === 'confirmed') { n[rk] = 'confirmed'; delete n[xk] }
      else if (status === 'rejected') { delete n[rk]; n[xk] = 'rejected' }
      else { delete n[rk]; delete n[xk] }
      return n
    })
    try {
      if (status === 'confirmed') { await addTravelPartyRole(terminId, contactId, role); await removeBookingRejection(terminId, contactId) }
      else if (status === 'rejected') { await removeTravelPartyRole(terminId, contactId, role); await addBookingRejection(terminId, contactId) }
      else { await removeTravelPartyRole(terminId, contactId, role); await removeBookingRejection(terminId, contactId) }
    } catch {
      setOverrides(prev => {
        const n = { ...prev }
        if (pr) n[rk] = pr; else delete n[rk]
        if (px) n[xk] = px; else delete n[xk]
        return n
      })
    }
  }

  function getBooked(terminId: number, contactId: number, role: string): BookedStatus {
    if (overrides[`${terminId}:${contactId}:${role}`] === 'confirmed') return 'confirmed'
    if (overrides[`${terminId}:${contactId}:__rejected__`] === 'rejected') return 'rejected'
    return null
  }

  function getAvail(termin: Termin, userId?: number | null) {
    if (!userId) return null
    return termin.availability?.find(a => a.userId === userId)?.status ?? null
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={18} className="animate-spin text-gray-400" />
    </div>
  )

  const TH: React.CSSProperties = {
    height: 30, padding: '0 10px', fontWeight: 500, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Funktion wählen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          {t('contacts.form.function')}
        </span>
        <select value={selectedFn} onChange={e => setSelectedFn(e.target.value)}
          className="detail-input" style={{ fontSize: 13, padding: '3px 8px', marginBottom: 0, width: 'auto', minWidth: 160 }}>
          {functions.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
        </select>
        {crew.length === 0 && selectedFn && (
          <span style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>
            {t('contacts.booking.noCrewForFunction')}
          </span>
        )}
      </div>

      {termine.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textSec, fontStyle: 'italic', padding: '16px 0' }}>{t('appointments.empty')}</p>
      ) : (
        <div style={{ display: 'flex', width: 'fit-content', maxWidth: '100%', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>

          {/* ── Linke Tabelle: Termine ── */}
          <div style={{ flexShrink: 0, borderRight: `2px solid ${C.borderSep}` }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12, width: 432 }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{ ...TH, textAlign: 'left', color: C.textSec, background: C.bgHead, borderBottom: `1px solid ${C.border}` }}>
                    Termine
                  </th>
                </tr>
                <tr>
                  {[
                    { label: t('table.date'),   w: 80 },
                    { label: t('table.title'),  w: 144 },
                    { label: t('appointments.card.venue'), w: 112 },
                    { label: t('table.city'),   w: 96 },
                  ].map(({ label, w }) => (
                    <th key={label} style={{ ...TH, width: w, textAlign: 'left', color: C.textMuted, background: C.bgHead, borderBottom: `2px solid ${C.border}` }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {termine.map((x, i) => {
                  const bg = i % 2 === 0 ? C.bgRow1 : C.bgRow2
                  const TD: React.CSSProperties = { height: 32, padding: '0 10px', background: bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                  return (
                    <tr key={x.id}>
                      <td style={{ ...TD, width: 80,  color: C.textSec }}>
                        {new Date(x.date + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td style={{ ...TD, width: 144, fontWeight: 500, color: C.textPri }} title={x.title || ''}>
                        {x.title || <span style={{ color: C.textMuted, fontStyle: 'italic', fontWeight: 400 }}>–</span>}
                      </td>
                      <td style={{ ...TD, width: 112, color: C.textSec }}>{x.venueName || '–'}</td>
                      <td style={{ ...TD, width: 96,  color: C.textSec }}>{x.city || '–'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Rechte Tabelle: Crew ── */}
          <div style={{ overflowX: 'auto', flexShrink: 1 }}>
            <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {crew.length > 0 ? (
                    <th colSpan={crew.length * 2} style={{ ...TH, textAlign: 'left', color: C.textAccent, background: C.bgCrewHead, borderBottom: `1px solid ${C.border}` }}>
                      {t('contacts.booking.crewFunction').replace('{function}', selectedFn)}
                    </th>
                  ) : (
                    <th style={{ height: 30, background: C.bgCrewHead, borderBottom: `1px solid ${C.border}` }} />
                  )}
                </tr>
                <tr>
                  {crew.map((c, ci) => (
                    <React.Fragment key={c.id}>
                      <th style={{ width: 40, ...TH, textAlign: 'center', color: C.textMuted, background: C.bgCrewHead, borderBottom: `2px solid ${C.borderCrew}`, borderLeft: ci > 0 ? `1px solid ${C.border}` : undefined }}>
                        {t('table.availability')}
                      </th>
                      <th style={{ width: 88, padding: '2px 8px', textAlign: 'center', background: C.bgCrewHead, borderBottom: `2px solid ${C.borderCrew}`, borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 11, color: C.textPri, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.firstName} {c.lastName}
                        </div>
                        {c.specification && (
                          <div style={{ fontWeight: 400, fontSize: 10, color: C.textAccent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.specification}
                          </div>
                        )}
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {termine.map((x, i) => {
                  const bg = i % 2 === 0 ? C.bgCrewRow1 : C.bgCrewRow2
                  return (
                    <tr key={x.id}>
                      {crew.map((c, ci) => {
                        const cid = Number(c.id)
                        return (
                          <React.Fragment key={c.id}>
                            <td style={{ width: 40, height: 32, background: bg, borderBottom: `1px solid ${C.border}`, borderLeft: ci > 0 ? `1px solid ${C.border}` : undefined, textAlign: 'center', padding: '0 4px' }}>
                              {c.contactType === 'guest'
                                ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#22c55e', color: 'white', fontSize: 8, fontWeight: 700 }} title={t('contacts.tooltip.manualNoLogin')}>M</span>
                                : <AvailIcon status={getAvail(x, c.userId ?? null)} />}
                            </td>
                            <td style={{ width: 88, height: 32, background: bg, borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, textAlign: 'center', padding: '0 4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <BookedToggle
                                  status={getBooked(x.id, cid, selectedFn)}
                                  onChange={s => handleChange(x.id, cid, s, selectedFn)}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: C.textSec, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500 }}>Legende:</span>
        {(['available', 'maybe', 'unavailable', 'null'] as const).map(s => {
          const cfg = AVAIL_CFG[s]
          return (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: cfg.color, color: s === 'null' ? '#888' : 'white', fontSize: 8, fontWeight: 700 }}>{cfg.symbol}</span>
              <span style={{ color: C.textMuted }}>{cfg.label}</span>
            </span>
          )
        })}
        <span style={{ color: C.border }}>·</span>
        {[
          { color: '#3b82f6', symbol: '✓', label: 'gebucht',  tc: 'white' },
          { color: '#ef4444', symbol: '✗', label: 'abgesagt', tc: 'white' },
          { color: '#2e2e2e', symbol: '–', label: 'offen',    tc: '#555', border: '1px solid #3a3a3a' },
        ].map(b => (
          <span key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: b.color, color: b.tc, fontSize: 8, fontWeight: 700, border: (b as any).border }}>{b.symbol}</span>
            <span style={{ color: C.textMuted }}>{b.label}</span>
          </span>
        ))}
      </div>

    </div>
  )
}
