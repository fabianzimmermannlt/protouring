'use client'

// Read-only Abrechnung einer gesperrten Show – Soll/Ist/Differenz, druckoptimiert (→ PDF).
import Decimal from 'decimal.js'
import { formatMoney } from '@/lib/calculation/format'
import type { AbrechnungSnapshot, AbrechnungCategory } from '@/lib/calculation/abrechnung'

const D = (s: string) => { try { return new Decimal(s || '0') } catch { return new Decimal(0) } }
const M = (s: string) => formatMoney(D(s))
const Mopt = (s: string) => { const d = D(s); return d.isZero() ? '' : formatMoney(d) }
// Differenz Ist − Soll; nur wenn ein (nicht-null) Ist vorliegt.
// Differenz Ist − Soll: sobald ein (auch 0-)Ist erfasst ist und ≠ Soll. Leer nur bei leerem Ist.
const diffStr = (soll: string, ist: string): string => { if (ist === '') return ''; const d = D(ist).minus(D(soll)); return d.isZero() ? '' : d.toString() }
const diffColor = (s: string) => (s === '' ? undefined : (D(s).isNegative() ? '#f87171' : '#4ade80'))
const diffCell = (s: string) => (s === '' || D(s).isZero() ? '' : (D(s).isNegative() ? '' : '+') + M(s))

function Row({ label, soll, ist, indent, bold, headBg }: { label: string; soll: string; ist: string; indent?: boolean; bold?: boolean; headBg?: string }) {
  const df = diffStr(soll, ist)
  return (
    <tr style={{ fontWeight: bold ? 600 : 400, background: headBg }}>
      <td style={{ paddingLeft: indent ? 24 : undefined, color: indent ? '#cbd5e1' : undefined }}>{label}</td>
      <td className="text-right ab-num">{indent ? Mopt(soll) : M(soll)}</td>
      <td className="text-right ab-num ab-ist">{Mopt(ist)}</td>
      <td className="text-right ab-num" style={{ color: diffColor(df) }}>{diffCell(df)}</td>
    </tr>
  )
}

// Spezifikation/Person an den Namen hängen (Alt-Snapshots haben sie noch im Namen → leer).
const posLabel = (p: AbrechnungCategory['positions'][number]): string => {
  const suffix = [p.spec, p.person].filter(Boolean).join(' · ')
  return p.name + (suffix ? ' · ' + suffix : '')
}

function CatBlock({ c }: { c: AbrechnungCategory }) {
  return (
    <>
      <Row label={c.name} soll={c.total} ist={c.totalIst} bold />
      {c.positions.map((p, i) => <Row key={i} label={posLabel(p)} soll={p.soll} ist={p.ist} indent />)}
    </>
  )
}

export default function AbrechnungView({ snap }: { snap: AbrechnungSnapshot }) {
  const income = snap.categories.filter(c => c.kind === 'income')
  const expense = snap.categories.filter(c => c.kind === 'expense')
  const dErg = diffStr(snap.ergebnis, snap.ergebnisIst)

  return (
    <div className="abrechnung-print" style={{ maxWidth: 820 }}>
      <style>{`
        .ab-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
        @media print {
          body * { visibility: hidden !important; }
          .abrechnung-print, .abrechnung-print * { visibility: visible !important; }
          .abrechnung-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none !important; padding: 0 !important; }
          .abrechnung-print, .abrechnung-print * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
          .abrechnung-print table { border-collapse: collapse; width: 100%; }
          .abrechnung-print th, .abrechnung-print td { border-bottom: 1px solid #bbb !important; padding: 4px 8px; font-size: 11pt; }
          .abrechnung-print .ab-sec td { border-top: 2px solid #000 !important; font-weight: 700; }
          @page { margin: 16mm; }
        }
      `}</style>

      <div className="pt-card">
        <div className="pt-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span className="pt-card-title" style={{ fontSize: '0.95rem', color: '#e5e7eb', textTransform: 'none', letterSpacing: 0 }}>Abrechnung</span>
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{snap.showLabel}</span>
          <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
            Variante: {snap.variantName} · {snap.memberCount} Bandmitglieder{snap.lockedAt ? ` · abgerechnet am ${new Date(snap.lockedAt).toLocaleDateString('de-DE')}` : ''}
          </span>
        </div>
        <div className="pt-card-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Position</th>
                <th className="text-right" style={{ minWidth: 110 }}>Soll</th>
                <th className="text-right" style={{ minWidth: 110 }}>Ist</th>
                <th className="text-right" style={{ minWidth: 100 }}>Differenz</th>
              </tr>
            </thead>
            <tbody>
              <tr className="ab-sec"><td colSpan={4} style={{ fontWeight: 700, background: '#173a28', color: '#e5e7eb' }}>EINNAHMEN</td></tr>
              {snap.gageFix != null ? (
                <>
                  <Row label="Fixgage (Garantie)" soll={snap.gageFix} ist={snap.gageFix} indent />
                  <Row label="Deal (Beteiligung)" soll={snap.gageDeal ?? '0'} ist={snap.gageDeal ?? '0'} indent />
                  <Row label="Provision (Agentur)" soll={D(snap.gageProvision ?? '0').negated().toString()} ist={D(snap.gageProvision ?? '0').negated().toString()} indent />
                  <Row label="Gage netto" soll={snap.gageNet} ist={snap.gageNet} bold />
                </>
              ) : (
                <Row label="Gage (abzgl. Provision)" soll={snap.gageNet} ist={snap.gageNet} />
              )}
              {income.map((c, i) => <CatBlock key={'i' + i} c={c} />)}
              <Row label="Summe Einnahmen" soll={snap.sumEinnahmen} ist={snap.sumEinnahmenIst} bold headBg="#1a1a1a" />

              <tr className="ab-sec"><td colSpan={4} style={{ fontWeight: 700, background: '#26313f', color: '#e5e7eb' }}>AUSGABEN</td></tr>
              {expense.map((c, i) => <CatBlock key={'e' + i} c={c} />)}
              <Row label="Summe Ausgaben" soll={snap.sumAusgaben} ist={snap.sumAusgabenIst} bold headBg="#1a1a1a" />

              <tr className="ab-sec" style={{ fontWeight: 700, background: '#2f2f2f' }}>
                <td>ERGEBNIS</td>
                <td className="text-right ab-num" style={{ color: D(snap.ergebnis).isNegative() ? '#f87171' : '#4ade80' }}>{M(snap.ergebnis)}</td>
                <td className="text-right ab-num" style={{ color: D(snap.ergebnisIst).isNegative() ? '#f87171' : '#4ade80' }}>{M(snap.ergebnisIst)}</td>
                <td className="text-right ab-num" style={{ color: diffColor(dErg) }}>{diffCell(dErg)}</td>
              </tr>
              <tr style={{ color: '#9ca3af' }}>
                <td>je Bandmitglied ({snap.memberCount})</td>
                <td className="text-right ab-num">{M(snap.jeBandmitglied)}</td>
                <td className="text-right ab-num">{M(snap.jeBandmitgliedIst)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
