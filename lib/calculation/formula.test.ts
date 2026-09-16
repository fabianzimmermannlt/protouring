// Regression: formulaNorm darf NIE einen String zurückgeben, an dem new Decimal(...)
// wirft. Genau das ließ früher die Kalkulation abstürzen (Eingabe von nur "," → ".").

import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { formulaNorm } from './formula-core'

describe('formulaNorm – kein crashender Rückgabewert', () => {
  const teilOderMuell = [',', '.', '-', ',,', '1,2,3', '1.2.3', 'abc', '€', '  ', '=', '=,', '-,']
  for (const c of teilOderMuell) {
    it(`"${c}" → null (und niemals ein werfender String)`, () => {
      const r = formulaNorm(c)
      expect(r).toBeNull()
      if (r != null) expect(() => new Decimal(r)).not.toThrow()
    })
  }

  it('gültige deutsche Zahlen → Punkt-Dezimal', () => {
    expect(formulaNorm('500,90')).toBe('500.90')
    expect(formulaNorm('42,06')).toBe('42.06')
    expect(formulaNorm('1000')).toBe('1000')
    expect(formulaNorm('-3,5')).toBe('-3.5')
    expect(formulaNorm('500,')).toBe('500.')      // decimal.js liest das als 500
    expect(formulaNorm(',5')).toBe('.5')          // → 0,5
  })

  it('leer → null', () => {
    expect(formulaNorm('')).toBeNull()
    expect(formulaNorm('   ')).toBeNull()
  })

  it('Formeln weiterhin ausgewertet (Komma erlaubt)', () => {
    expect(formulaNorm('=100+400')).toBe('500')
    expect(formulaNorm('=100*1,19')).toBe('119')
    expect(formulaNorm('=(10+2)*3')).toBe('36')
  })

  it('jeder gültige Rückgabewert ist Decimal-parsebar', () => {
    for (const c of ['500,90', '42,06', '1000', '-3,5', '500,', ',5', '=100*1,19']) {
      const r = formulaNorm(c)
      expect(r).not.toBeNull()
      expect(() => new Decimal(r as string)).not.toThrow()
    }
  })
})
