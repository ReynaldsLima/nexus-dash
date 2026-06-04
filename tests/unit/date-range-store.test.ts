import { describe, it, expect } from 'vitest'
import { getPresetRange, useDateRangeStore } from '@/lib/stores/date-range'

// Helper: dias de diferença entre duas datas (to - from) em dias inteiros
function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

// Helper: data de hoje sem horas (mesmo que getPresetRange usa internamente)
function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

describe('getPresetRange', () => {
  it('last7 retorna exatamente 7 dias inclusivos (diff = 6)', () => {
    const { from, to } = getPresetRange('last7')
    expect(diffDays(from, to)).toBe(6)
  })

  it('last14 retorna exatamente 14 dias inclusivos (diff = 13)', () => {
    const { from, to } = getPresetRange('last14')
    expect(diffDays(from, to)).toBe(13)
  })

  it('last30 retorna exatamente 30 dias inclusivos (diff = 29)', () => {
    const { from, to } = getPresetRange('last30')
    expect(diffDays(from, to)).toBe(29)
  })

  it('last7.to é hoje (sem horas)', () => {
    const { to } = getPresetRange('last7')
    const t = today()
    expect(to.getTime()).toBe(t.getTime())
  })

  it('last30.to é hoje (sem horas)', () => {
    const { to } = getPresetRange('last30')
    const t = today()
    expect(to.getTime()).toBe(t.getTime())
  })

  it('thisMonth.from é o dia 1 do mês corrente', () => {
    const { from } = getPresetRange('thisMonth')
    const now = new Date()
    expect(from.getFullYear()).toBe(now.getFullYear())
    expect(from.getMonth()).toBe(now.getMonth())
    expect(from.getDate()).toBe(1)
  })

  it('thisMonth.to é hoje', () => {
    const { to } = getPresetRange('thisMonth')
    const t = today()
    expect(to.getTime()).toBe(t.getTime())
  })

  it('lastMonth.from é o dia 1 do mês anterior', () => {
    const { from } = getPresetRange('lastMonth')
    const now = new Date()
    const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    expect(from.getDate()).toBe(1)
    expect(from.getMonth()).toBe(expectedMonth)
  })

  it('lastMonth.to é o último dia do mês anterior', () => {
    const { to } = getPresetRange('lastMonth')
    const now = new Date()
    // Último dia do mês anterior = dia 0 do mês atual
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    expect(to.getTime()).toBe(lastDay.getTime())
  })
})

describe('useDateRangeStore', () => {
  it('estado inicial usa last30 como default (diff = 29 dias)', () => {
    const state = useDateRangeStore.getState()
    expect(diffDays(state.from, state.to)).toBe(29)
  })

  it('setRange substitui o range no store', () => {
    const newFrom = new Date(2026, 0, 1)
    const newTo = new Date(2026, 0, 31)
    useDateRangeStore.getState().setRange({ from: newFrom, to: newTo })
    const state = useDateRangeStore.getState()
    expect(state.from.getTime()).toBe(newFrom.getTime())
    expect(state.to.getTime()).toBe(newTo.getTime())
  })

  it('applyPreset(last7) atualiza o store para 7 dias', () => {
    useDateRangeStore.getState().applyPreset('last7')
    const state = useDateRangeStore.getState()
    expect(diffDays(state.from, state.to)).toBe(6)
  })

  it('applyPreset(custom) NÃO altera o estado atual', () => {
    // definir um range conhecido primeiro
    const knownFrom = new Date(2026, 2, 1)
    const knownTo = new Date(2026, 2, 15)
    useDateRangeStore.getState().setRange({ from: knownFrom, to: knownTo })

    // chamar applyPreset('custom') — deve manter o range anterior
    useDateRangeStore.getState().applyPreset('custom')
    const state = useDateRangeStore.getState()
    expect(state.from.getTime()).toBe(knownFrom.getTime())
    expect(state.to.getTime()).toBe(knownTo.getTime())
  })
})
