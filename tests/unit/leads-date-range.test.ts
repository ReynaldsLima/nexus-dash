import { describe, it, expect } from 'vitest'
import { type Lead, filterLeadsByDateRange } from '@/lib/leads'

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

describe('filterLeadsByDateRange', () => {
  it('includes a lead whose date falls in the middle of the range', () => {
    const leads = [makeLead({ id: 0, nome: 'Meio', criado_em: '02/08/2026' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['Meio'])
  })

  it('is inclusive at the lower bound (lead dated exactly on `from`)', () => {
    const leads = [makeLead({ id: 0, nome: 'Inicio', criado_em: '01/08/2026' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['Inicio'])
  })

  it('is inclusive at the upper bound with no time component (lead dated exactly on `to` at midnight)', () => {
    const leads = [makeLead({ id: 0, nome: 'Fim', criado_em: '04/08/2026' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['Fim'])
  })

  it('is inclusive at the upper bound WITH a time component (critical case — "today\'s leads" must not disappear)', () => {
    const leads = [makeLead({ id: 0, nome: 'HojeComHora', criado_em: '04/08/2026 14:30' })]
    // `to` arrives at midnight (00:00) from the date-range store — without normalizing to
    // end-of-day, this lead would be wrongly excluded.
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['HojeComHora'])
  })

  it('excludes a lead before `from`', () => {
    const leads = [makeLead({ id: 0, nome: 'Antes', criado_em: '31/07/2026' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result).toEqual([])
  })

  it('excludes a lead after `to`', () => {
    const leads = [makeLead({ id: 0, nome: 'Depois', criado_em: '05/08/2026' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result).toEqual([])
  })

  it('excludes leads with unparseable `criado_em`', () => {
    const leads = [
      makeLead({ id: 0, nome: 'Vazio', criado_em: '' }),
      makeLead({ id: 1, nome: 'Espaco', criado_em: '   ' }),
      makeLead({ id: 2, nome: 'Lixo', criado_em: 'lixo' }),
      makeLead({ id: 3, nome: 'Invalido', criado_em: '99/99/2026' }),
    ]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result).toEqual([])
  })

  it('accepts ISO date format within the range', () => {
    const leads = [makeLead({ id: 0, nome: 'ISO', criado_em: '2026-08-02' })]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['ISO'])
  })

  it('preserves the relative order of the input array', () => {
    const leads = [
      makeLead({ id: 0, nome: 'A', criado_em: '02/08/2026' }),
      makeLead({ id: 1, nome: 'B', criado_em: '03/08/2026' }),
      makeLead({ id: 2, nome: 'C', criado_em: '01/08/2026' }),
    ]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result.map(l => l.nome)).toEqual(['A', 'B', 'C'])
  })

  it('does not mutate the input array and returns a new array', () => {
    const leads = [makeLead({ id: 0, nome: 'A', criado_em: '02/08/2026' })]
    const original = [...leads]
    const result = filterLeadsByDateRange(leads, new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(leads).toEqual(original)
    expect(result).not.toBe(leads)
  })

  it('returns an empty array for an empty input array', () => {
    const result = filterLeadsByDateRange([], new Date(2026, 7, 1), new Date(2026, 7, 4))
    expect(result).toEqual([])
  })
})
