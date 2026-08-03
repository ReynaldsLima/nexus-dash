import { describe, it, expect } from 'vitest'
import { type Lead, parseLeadDate, compareByCriadoEm, sortLeadsByCriadoEmDesc } from '@/lib/leads'

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: 0,
    nome: '',
    telefone: '',
    email: '',
    empresa: '',
    criado_em: '',
    status: '',
    hora_resposta: '',
    tipo_seguro: '',
    ...overrides,
  }
}

describe('parseLeadDate', () => {
  it('parses pt-BR dates chronologically, not alphabetically (31/07 < 02/08)', () => {
    const older = parseLeadDate('31/07/2026')
    const newer = parseLeadDate('02/08/2026')
    expect(older).not.toBeNull()
    expect(newer).not.toBeNull()
    expect(newer as number).toBeGreaterThan(older as number)
  })

  it('parses pt-BR date + time (HH:MM) and later time is greater', () => {
    const earlier = parseLeadDate('05/01/2026 14:30')
    const later = parseLeadDate('05/01/2026 15:30')
    expect(earlier).not.toBeNull()
    expect(later).not.toBeNull()
    expect(later as number).toBeGreaterThan(earlier as number)
  })

  it('parses pt-BR date + time with seconds (HH:MM:SS)', () => {
    const earlier = parseLeadDate('05/01/2026 14:30:00')
    const later = parseLeadDate('05/01/2026 14:30:59')
    expect(earlier).not.toBeNull()
    expect(later).not.toBeNull()
    expect(later as number).toBeGreaterThan(earlier as number)
  })

  it('parses day/month without leading zero (5/1/2026 as Jan 5)', () => {
    const t = parseLeadDate('5/1/2026')
    expect(t).not.toBeNull()
    const d = new Date(t as number)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
  })

  it('parses ISO date (YYYY-MM-DD)', () => {
    const t = parseLeadDate('2026-08-02')
    expect(t).not.toBeNull()
  })

  it('parses ISO date + time (YYYY-MM-DDTHH:MM:SS)', () => {
    const t = parseLeadDate('2026-08-02T14:30:00')
    expect(t).not.toBeNull()
  })

  it('returns null for empty, blank, garbage, and out-of-range strings', () => {
    expect(parseLeadDate('')).toBeNull()
    expect(parseLeadDate('   ')).toBeNull()
    expect(parseLeadDate('sem data')).toBeNull()
    expect(parseLeadDate('99/99/2026')).toBeNull()
  })
})

describe('sortLeadsByCriadoEmDesc', () => {
  it('sorts from newest to oldest', () => {
    const leads = [
      makeLead({ id: 0, nome: 'Ana', criado_em: '31/07/2026' }),
      makeLead({ id: 1, nome: 'Bruno', criado_em: '02/08/2026' }),
      makeLead({ id: 2, nome: 'Carla', criado_em: '15/06/2026' }),
    ]
    const sorted = sortLeadsByCriadoEmDesc(leads)
    expect(sorted.map(l => l.nome)).toEqual(['Bruno', 'Ana', 'Carla'])
  })

  it('puts leads with null date at the end, preserving relative order (stable)', () => {
    const leads = [
      makeLead({ id: 0, nome: 'SemData1', criado_em: '' }),
      makeLead({ id: 1, nome: 'Bruno', criado_em: '02/08/2026' }),
      makeLead({ id: 2, nome: 'SemData2', criado_em: 'lixo' }),
      makeLead({ id: 3, nome: 'Ana', criado_em: '31/07/2026' }),
    ]
    const sorted = sortLeadsByCriadoEmDesc(leads)
    expect(sorted.map(l => l.nome)).toEqual(['Bruno', 'Ana', 'SemData1', 'SemData2'])
  })

  it('does not change lead.id — same ids present, only reordered', () => {
    const leads = [
      makeLead({ id: 0, criado_em: '31/07/2026' }),
      makeLead({ id: 1, criado_em: '02/08/2026' }),
      makeLead({ id: 2, criado_em: '15/06/2026' }),
    ]
    const sorted = sortLeadsByCriadoEmDesc(leads)
    expect(sorted.map(l => l.id).sort()).toEqual([0, 1, 2])
    expect(sorted.map(l => l.id)).toEqual([1, 0, 2])
  })

  it('does not mutate the input array (returns a copy)', () => {
    const leads = [
      makeLead({ id: 0, criado_em: '31/07/2026' }),
      makeLead({ id: 1, criado_em: '02/08/2026' }),
    ]
    const original = [...leads]
    const sorted = sortLeadsByCriadoEmDesc(leads)
    expect(leads).toEqual(original)
    expect(sorted).not.toBe(leads)
  })
})

describe('compareByCriadoEm', () => {
  it('returns 0 when both dates are null', () => {
    const a = makeLead({ criado_em: '' })
    const b = makeLead({ criado_em: 'lixo' })
    expect(compareByCriadoEm(a, b, false)).toBe(0)
  })

  it('sends null date to the end regardless of asc/desc', () => {
    const withDate = makeLead({ criado_em: '02/08/2026' })
    const withoutDate = makeLead({ criado_em: '' })
    expect(compareByCriadoEm(withoutDate, withDate, false)).toBe(1)
    expect(compareByCriadoEm(withoutDate, withDate, true)).toBe(1)
    expect(compareByCriadoEm(withDate, withoutDate, false)).toBe(-1)
    expect(compareByCriadoEm(withDate, withoutDate, true)).toBe(-1)
  })
})
