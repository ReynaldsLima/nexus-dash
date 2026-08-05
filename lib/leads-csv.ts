import { type Lead, cat, CATEGORY_LABELS } from '@/lib/leads'

// Excel em locale pt-BR interpreta `,` como separador decimal e joga a linha
// inteira numa única coluna. `;` é o separador que Excel pt-BR e Google Sheets
// (auto-detect) abrem corretamente.
export const CSV_DELIMITER = ';'

export const LEADS_CSV_HEADERS = [
  'Nome', 'Empresa', 'Produto', 'Status', 'Criado em', 'Resp.', 'Telefone',
] as const

// Caracteres que, no início de uma célula, o Excel/Sheets interpretam como
// início de fórmula — mitigação T-wnx-01 (CSV formula injection).
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r']

export function escapeCsvField(value: string | null | undefined): string {
  let v = value ?? ''
  if (v === '') return ''

  let needsQuoting = false

  if (FORMULA_TRIGGER_CHARS.includes(v.charAt(0))) {
    // A aspa simples inicial marca o valor como texto no Excel/Sheets e não é
    // exibida na célula.
    v = `'${v}`
    needsQuoting = true
  }

  if (v.includes('"')) {
    v = v.replace(/"/g, '""')
    needsQuoting = true
  }

  if (v.includes(CSV_DELIMITER) || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    needsQuoting = true
  }

  return needsQuoting ? `"${v}"` : v
}

export function leadsToCsv(leads: Lead[]): string {
  const headerRow = LEADS_CSV_HEADERS.join(CSV_DELIMITER)

  const rows = leads.map(lead => {
    const cells = [
      lead.nome,
      lead.empresa,
      lead.tipo_seguro,
      CATEGORY_LABELS[cat(lead.status)],
      lead.criado_em,
      lead.hora_resposta,
      lead.telefone,
    ]
    return cells.map(escapeCsvField).join(CSV_DELIMITER)
  })

  // BOM UTF-8: sem ele o Excel corrompe acentos (José -> JosÃ©).
  return ['﻿' + headerRow, ...rows].join('\r\n')
}

export function buildLeadsCsvFilename(slug: string, date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `leads-${slug}-${yyyy}-${mm}-${dd}.csv`
}
