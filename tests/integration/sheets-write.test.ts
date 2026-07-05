import { describe, it, expect } from 'vitest'
import { updateLeadStatus } from '@/lib/sheets'

/**
 * Teste de integração opcional: escreve um status real em uma planilha de teste
 * via Service Account, exercitando updateLeadStatus fim-a-fim (Pitfall 2).
 *
 * Self-skip se as env vars de teste não estiverem definidas — não bloqueia a
 * suíte local nem CI sem credenciais reais. Ver VALIDATION.md (Wave 0 opcional).
 */
const hasTestEnv =
  !!process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID &&
  !!process.env.GOOGLE_SHEETS_TEST_SERVICE_ACCOUNT
const describeIfEnv = hasTestEnv ? describe : describe.skip

describeIfEnv('sheets write (integração — Pitfall 2)', () => {
  it('escreve um status em uma planilha de teste sem lançar', async () => {
    const sa = JSON.parse(process.env.GOOGLE_SHEETS_TEST_SERVICE_ACCOUNT!)
    await expect(
      updateLeadStatus(process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID!, sa, 0, 'Novo Lead')
    ).resolves.not.toThrow()
  })
})

describe('sheets-write scaffold sanity', () => {
  it('detecção de env funciona', () => {
    expect(typeof hasTestEnv).toBe('boolean')
  })
})
