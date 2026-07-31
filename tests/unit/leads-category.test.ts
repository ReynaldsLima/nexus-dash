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

describe('lib/leads cat() — 4 novas categorias de desqualificação', () => {
  it('classifica "Desqualificado por região" como desq_regiao', () => {
    expect(cat('Desqualificado por região')).toBe('desq_regiao')
  })

  it('classifica "Fora da região" como desq_regiao (variação de texto)', () => {
    expect(cat('Fora da região')).toBe('desq_regiao')
  })

  it('classifica "Quantidade de Vidas" como qtd_vidas', () => {
    expect(cat('Quantidade de Vidas')).toBe('qtd_vidas')
  })

  it('classifica "Vidas fora do perfil" como qtd_vidas (variação de texto)', () => {
    expect(cat('Vidas fora do perfil')).toBe('qtd_vidas')
  })

  it('classifica "Pessoa Física" como pessoa_fisica', () => {
    expect(cat('Pessoa Física')).toBe('pessoa_fisica')
  })

  it('classifica "Engano" como engano', () => {
    expect(cat('Engano')).toBe('engano')
  })

  it('classifica "Contato errado" como engano (variação de texto)', () => {
    expect(cat('Contato errado')).toBe('engano')
  })

  it('regressão: "Fechado" continua "fechado" (adicionada na task anterior, não pode quebrar)', () => {
    expect(cat('Fechado')).toBe('fechado')
  })

  it('regressão: "Sem Resposta" continua "fim" (nenhuma keyword nova colide)', () => {
    expect(cat('Sem Resposta')).toBe('fim')
  })

  it('regressão: "Negociando" continua "negoc"', () => {
    expect(cat('Negociando')).toBe('negoc')
  })

  it('regressão: string vazia continua "novo"', () => {
    expect(cat('')).toBe('novo')
  })

  it('CATEGORY_LABELS.desq_regiao é "Desqualificado por região"', () => {
    expect(CATEGORY_LABELS.desq_regiao).toBe('Desqualificado por região')
  })

  it('CATEGORY_LABELS.qtd_vidas é "Quantidade de Vidas"', () => {
    expect(CATEGORY_LABELS.qtd_vidas).toBe('Quantidade de Vidas')
  })

  it('CATEGORY_LABELS.pessoa_fisica é "Pessoa Física"', () => {
    expect(CATEGORY_LABELS.pessoa_fisica).toBe('Pessoa Física')
  })

  it('CATEGORY_LABELS.engano é "Engano"', () => {
    expect(CATEGORY_LABELS.engano).toBe('Engano')
  })

  it('CATEGORY_BG das 4 novas categorias são todas IGUAIS entre si (cor única compartilhada)', () => {
    expect(CATEGORY_BG.desq_regiao).toBe(CATEGORY_BG.qtd_vidas)
    expect(CATEGORY_BG.qtd_vidas).toBe(CATEGORY_BG.pessoa_fisica)
    expect(CATEGORY_BG.pessoa_fisica).toBe(CATEGORY_BG.engano)
  })

  it('CATEGORY_BG.desq_regiao é diferente das categorias pré-existentes (cor nova, não reaproveitada)', () => {
    expect(CATEGORY_BG.desq_regiao).not.toBe(CATEGORY_BG.negoc)
    expect(CATEGORY_BG.desq_regiao).not.toBe(CATEGORY_BG.quente)
    expect(CATEGORY_BG.desq_regiao).not.toBe(CATEGORY_BG.novo)
    expect(CATEGORY_BG.desq_regiao).not.toBe(CATEGORY_BG.fim)
    expect(CATEGORY_BG.desq_regiao).not.toBe(CATEGORY_BG.fechado)
  })
})
