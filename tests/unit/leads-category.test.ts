import { describe, it, expect } from 'vitest'
import { cat, CATEGORY_LABELS, CATEGORY_BG } from '@/lib/leads'

describe('lib/leads cat() — categoria "fechado"', () => {
  it('classifica "Fechado" como fechado', () => {
    expect(cat('Fechado')).toBe('fechado')
  })

  it('classifica "Venda Fechada" como fechado', () => {
    expect(cat('Venda Fechada')).toBe('fechado')
  })

  it('classifica "Convertido" como fechado', () => {
    expect(cat('Convertido')).toBe('fechado')
  })

  it('regressão: string vazia cai no fallback "novo"', () => {
    expect(cat('')).toBe('novo')
  })

  it('regressão: "Sem Resposta" continua "fim" (sem colisão com keywords de fechado)', () => {
    expect(cat('Sem Resposta')).toBe('fim')
  })

  it('regressão: "Negociando" continua "negoc"', () => {
    expect(cat('Negociando')).toBe('negoc')
  })

  it('CATEGORY_LABELS.fechado é "Fechado"', () => {
    expect(CATEGORY_LABELS.fechado).toBe('Fechado')
  })

  it('CATEGORY_BG.fechado é uma string não-vazia e diferente das outras 4', () => {
    expect(typeof CATEGORY_BG.fechado).toBe('string')
    expect(CATEGORY_BG.fechado.length).toBeGreaterThan(0)
    expect(CATEGORY_BG.fechado).not.toBe(CATEGORY_BG.negoc)
    expect(CATEGORY_BG.fechado).not.toBe(CATEGORY_BG.quente)
    expect(CATEGORY_BG.fechado).not.toBe(CATEGORY_BG.novo)
    expect(CATEGORY_BG.fechado).not.toBe(CATEGORY_BG.fim)
  })
})
