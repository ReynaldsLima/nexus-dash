import { describe, it, expect } from 'vitest'
import { rowForId, statusRange, mapSheetsError } from '@/lib/sheets'

describe('rowForId', () => {
  it('rowForId(0) === 2', () => {
    expect(rowForId(0)).toBe(2)
  })

  it('rowForId(1) === 3', () => {
    expect(rowForId(1)).toBe(3)
  })

  it('rowForId(498) === 500', () => {
    expect(rowForId(498)).toBe(500)
  })
})

describe('statusRange', () => {
  it("statusRange(0) === 'Leads!F2'", () => {
    expect(statusRange(0)).toBe('Leads!F2')
  })

  it("statusRange(5) === 'Leads!F7'", () => {
    expect(statusRange(5)).toBe('Leads!F7')
  })
})

describe('mapSheetsError', () => {
  it('status 429 → status 429, mensagem de rate limit', () => {
    const result = mapSheetsError({ response: { status: 429 } })
    expect(result.status).toBe(429)
    expect(result.message).toContain('Limite de escrita')
  })

  it("apiStatus RESOURCE_EXHAUSTED → status 429", () => {
    const result = mapSheetsError({ response: { data: { error: { status: 'RESOURCE_EXHAUSTED' } } } })
    expect(result.status).toBe(429)
  })

  it('status 403 → status 403, mensagem de permissão', () => {
    const result = mapSheetsError({ response: { status: 403 } })
    expect(result.status).toBe(403)
    expect(result.message).toContain('permissão')
  })

  it("apiStatus PERMISSION_DENIED → status 403", () => {
    const result = mapSheetsError({ response: { data: { error: { status: 'PERMISSION_DENIED' } } } })
    expect(result.status).toBe(403)
  })

  it('status 401 → status 401, mensagem de credencial inválida', () => {
    const result = mapSheetsError({ response: { status: 401 } })
    expect(result.status).toBe(401)
    expect(result.message).toContain('inválida')
  })

  it('erro desconhecido (rede/5xx) → status 502, mensagem genérica', () => {
    const result = mapSheetsError(new Error('network failure'))
    expect(result.status).toBe(502)
    expect(result.message).toBe('Falha ao gravar na planilha.')
  })
})
