import { describe, it, expect } from 'vitest'
import type { Lead } from '@/lib/leads'
import {
  LEADS_CSV_HEADERS,
  escapeCsvField,
  leadsToCsv,
  buildLeadsCsvFilename,
} from '@/lib/leads-csv'

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

describe('escapeCsvField', () => {
  it('returns a plain string with no special characters unquoted', () => {
    expect(escapeCsvField('Ana')).toBe('Ana')
  })

  it('wraps a field containing ; in double quotes', () => {
    expect(escapeCsvField('A;B')).toBe('"A;B"')
  })

  it('wraps a field containing , in double quotes', () => {
    expect(escapeCsvField('A,B')).toBe('"A,B"')
  })

  it('duplicates internal quotes and wraps the field', () => {
    expect(escapeCsvField('Diz "oi"')).toBe('"Diz ""oi"""')
  })

  it('wraps a field containing \\n in double quotes, preserving the line break', () => {
    expect(escapeCsvField('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('returns empty string for empty, null, and undefined', () => {
    expect(escapeCsvField('')).toBe('')
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('prefixes formula-injection-prone fields with a single quote and wraps them', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(escapeCsvField('+1234')).toBe('"\'+1234"')
    expect(escapeCsvField('-1234')).toBe('"\'-1234"')
    expect(escapeCsvField('@cmd')).toBe('"\'@cmd"')
  })
})

describe('leadsToCsv', () => {
  it('first line is exactly the header row', () => {
    const csv = leadsToCsv([])
    const firstLine = csv.replace(/^﻿/, '').split('\r\n')[0]
    expect(firstLine).toBe('Nome;Empresa;Produto;Status;Criado em;Resp.;Telefone')
  })

  it('starts with a UTF-8 BOM', () => {
    const csv = leadsToCsv([])
    expect(csv.charAt(0)).toBe('﻿')
  })

  it('separates rows with CRLF; empty array produces only BOM + header', () => {
    const csv = leadsToCsv([])
    expect(csv).toBe('﻿Nome;Empresa;Produto;Status;Criado em;Resp.;Telefone')
  })

  it('exports the normalized category label for Status, not the raw sheet text', () => {
    const lead = makeLead({ nome: 'Ana', status: 'em negociação' })
    const csv = leadsToCsv([lead])
    const dataLine = csv.replace(/^﻿/, '').split('\r\n')[1]
    expect(dataLine).toBe('Ana;;;Negociando;;;')
  })

  it('exports empty fields as empty string, not the — UI placeholder', () => {
    const lead = makeLead({ nome: 'Ana' })
    const csv = leadsToCsv([lead])
    const dataLine = csv.replace(/^﻿/, '').split('\r\n')[1]
    expect(dataLine).not.toContain('—')
  })

  it('preserves the received order — does not reorder', () => {
    const leadA = makeLead({ id: 0, nome: 'Ana' })
    const leadB = makeLead({ id: 1, nome: 'Bruno' })
    const csv = leadsToCsv([leadB, leadA])
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[1].startsWith('Bruno')).toBe(true)
    expect(lines[2].startsWith('Ana')).toBe(true)
  })

  it('emits the 7 columns in header order, mapped per the interfaces table', () => {
    const lead = makeLead({
      nome: 'Ana',
      empresa: 'Acme',
      tipo_seguro: 'Vida',
      status: 'quente',
      criado_em: '02/08/2026',
      hora_resposta: '10:00',
      telefone: '11999999999',
    })
    const csv = leadsToCsv([lead])
    const dataLine = csv.replace(/^﻿/, '').split('\r\n')[1]
    expect(dataLine).toBe('Ana;Acme;Vida;Quente;02/08/2026;10:00;11999999999')
  })
})

describe('buildLeadsCsvFilename', () => {
  it('builds a local-date, zero-padded filename', () => {
    expect(buildLeadsCsvFilename('acme', new Date(2026, 7, 4))).toBe('leads-acme-2026-08-04.csv')
  })
})

describe('LEADS_CSV_HEADERS', () => {
  it('has the 7 expected headers in order', () => {
    expect(LEADS_CSV_HEADERS).toEqual([
      'Nome', 'Empresa', 'Produto', 'Status', 'Criado em', 'Resp.', 'Telefone',
    ])
  })
})
