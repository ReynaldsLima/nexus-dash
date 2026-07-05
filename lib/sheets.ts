import { JWT } from 'google-auth-library'

export interface ServiceAccountCreds {
  client_email: string
  private_key: string
}

// Lead.id (rota GET) é o índice 0-based do array `values`; a leitura começa em A2.
// Logo a linha real na planilha = id + 2. Ver 03.1-RESEARCH.md Pattern 3.
export function rowForId(id: number): number {
  return id + 2
}

// Coluna F = status (r[5] na rota GET). Range A1 de escrita.
export function statusRange(id: number): string {
  return `Leads!F${rowForId(id)}`
}

export interface SheetsWriteError {
  status: number // status HTTP a retornar ao client
  message: string // mensagem pt-BR (D-07)
}

// Mapeia GaxiosError → resposta HTTP. Ver 03.1-RESEARCH.md Pitfall 3.
// SEM retry automático (D-07) — apenas classifica e devolve mensagem.
export function mapSheetsError(e: unknown): SheetsWriteError {
  const err = e as { response?: { status?: number; data?: { error?: { status?: string } } } }
  const httpStatus = err?.response?.status
  const apiStatus = err?.response?.data?.error?.status
  if (httpStatus === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    return { status: 429, message: 'Limite de escrita da planilha atingido. Tente novamente em 1 minuto.' }
  }
  if (httpStatus === 403 || apiStatus === 'PERMISSION_DENIED') {
    return { status: 403, message: 'Sem permissão para editar a planilha. Verifique o compartilhamento da Service Account como Editor.' }
  }
  if (httpStatus === 401) {
    return { status: 401, message: 'Credencial da planilha inválida ou expirada.' }
  }
  return { status: 502, message: 'Falha ao gravar na planilha.' }
}

// Escreve statusValue na célula de status do lead. NUNCA loga serviceAccount.
export async function updateLeadStatus(
  sheetId: string,
  serviceAccount: ServiceAccountCreds,
  id: number,
  statusValue: string,
): Promise<void> {
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // escopo mínimo — NUNCA 'drive' completo
  })
  const range = statusRange(id)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
  await client.fetch(url, {
    method: 'PUT',
    data: { range, majorDimension: 'ROWS', values: [[statusValue]] },
  })
}
