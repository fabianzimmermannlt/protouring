'use client'

// Read-only Abrechnung einer (gesperrten) Show – Soll/Ist-Vergleich aus einem Snapshot.
import Decimal from 'decimal.js'
import { formatMoney } from '@/lib/calculation/format'
import type { AbrechnungSnapshot, AbrechnungCategory } from '@/lib/calculation/abrechnung'

const M = (s: string) => { try { return formatMoney(new Decimal(s || '0')) } catch { return s } }
const Mopt = (s: string) => { try { const d = new Decimal(s || '0'); return d.isZero() ? '' : formatMoney(d) } catch { return '' } }

function CatBlock({ c }: { c: AbrechnungCategory }) {
  return (
    <>
      <tr style={{ fontWeight: 600 }}>
        <td>{c.name}</td>
        <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(c.total)}</td>
        <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#facc15' }}>{Mopt(c.totalIst)}</td>
      </tr>
      {c.positions.map((p, i) => (
        <tr key={i}>
          <td style={{ paddingLeft: 24, color: '#cbd5e1' }}>{p.name}</td>
          <td className="text-right" style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{p.soll ? M(p.soll) : ''}</td>
          <td className="text-right" style={{ color: '#facc15', fontVariantNumeric: 'tabular-nums' }}>{p.ist ? M(p.ist) : ''}</td>
        </tr>
      ))}
    </>
  )
}

export default function AbrechnungView({ snap }: { snap: AbrechnungSnapshot }) {
  const income = snap.categories.filter(c => c.kind === 'income')
  const expense = snap.categories.filter(c => c.kind === 'expense')
  const negS = (() => { try { return new Decimal(snap.ergebnis || '0').isNegative() } catch { return false } })()
  const negI = (() => { try { return new Decimal(snap.ergebnisIst || '0').isNegative() } catch { return false } })()
  return (
    <div className="pt-card" style={{ maxWidth: 760 }}>
      <div className="pt-card-header"><span className="pt-card-title">Abrechnung · {snap.variantName}</span></div>
      <div className="pt-card-body">
        <div className="text-sm mb-3" style={{ color: '#9ca3af' }}>
          {snap.showLabel}{snap.lockedAt ? ` · gesperrt am ${new Date(snap.lockedAt).toLocaleString('de-DE')}` : ''}
        </div>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Position</th>
              <th className="text-right" style={{ minWidth: 120 }}>Soll</th>
              <th className="text-right" style={{ minWidth: 120, color: '#facc15' }}>Ist</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={3} style={{ fontWeight: 700, background: '#173a28', color: '#e5e7eb' }}>EINNAHMEN</td></tr>
            <tr>
              <td>Gage (abzgl. Provision)</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(snap.gageNet)}</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#facc15' }}>{Mopt(snap.gageNet)}</td>
            </tr>
            {income.map((c, i) => <CatBlock key={'i' + i} c={c} />)}
            <tr style={{ fontWeight: 600 }}>
              <td>Summe Einnahmen</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(snap.sumEinnahmen)}</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#facc15' }}>{M(snap.sumEinnahmenIst)}</td>
            </tr>

            <tr><td colSpan={3} style={{ fontWeight: 700, background: '#26313f', color: '#e5e7eb' }}>AUSGABEN</td></tr>
            {expense.map((c, i) => <CatBlock key={'e' + i} c={c} />)}
            <tr style={{ fontWeight: 600 }}>
              <td>Summe Ausgaben</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(snap.sumAusgaben)}</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: '#facc15' }}>{M(snap.sumAusgabenIst)}</td>
            </tr>

            <tr style={{ fontWeight: 700, background: '#2f2f2f' }}>
              <td>ERGEBNIS</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: negS ? '#f87171' : '#4ade80' }}>{M(snap.ergebnis)}</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: negI ? '#f87171' : '#4ade80' }}>{M(snap.ergebnisIst)}</td>
            </tr>
            <tr style={{ color: '#9ca3af' }}>
              <td>je Bandmitglied ({snap.memberCount})</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(snap.jeBandmitglied)}</td>
              <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{M(snap.jeBandmitgliedIst)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
