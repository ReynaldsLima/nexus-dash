export interface Lead {
  id: number
  nome: string
  telefone: string
  email: string
  empresa: string
  criado_em: string
  status: string
  hora_resposta: string
  tipo_seguro: string
}

export type LeadCategory = 'negoc' | 'quente' | 'novo' | 'fim' | 'fechado' | 'desq_regiao' | 'qtd_vidas' | 'pessoa_fisica' | 'engano'

export function cat(s: string): LeadCategory {
  if (!s) return 'novo'
  const v = s.toLowerCase().trim()
  if (['fechado', 'fechada', 'venda fechada', 'convertido', 'ganho'].some(k => v.includes(k))) return 'fechado'
  if (['desqualificado por região', 'desqualificado por regiao', 'fora da região', 'fora da regiao', 'fora de área', 'fora de area', 'sem cobertura na região'].some(k => v.includes(k))) return 'desq_regiao'
  if (['quantidade de vidas', 'vidas fora do perfil', 'poucas vidas', 'número de vidas', 'numero de vidas'].some(k => v.includes(k))) return 'qtd_vidas'
  if (['pessoa física', 'pessoa fisica'].some(k => v.includes(k))) return 'pessoa_fisica'
  if (['engano', 'número errado', 'numero errado', 'contato errado', 'ligação errada', 'ligacao errada'].some(k => v.includes(k))) return 'engano'
  if (['negociando', 'em negociação', 'negoc', 'proposta'].some(k => v.includes(k))) return 'negoc'
  if (['quente', 'interessado', 'agendado', 'reunião'].some(k => v.includes(k))) return 'quente'
  if (['sem resposta', 'encerrado', 'perdido', 'inativo', 'desistiu', 'não tem interesse', 'fim'].some(k => v.includes(k))) return 'fim'
  return 'novo'
}

export const CATEGORY_LABELS: Record<LeadCategory, string> = {
  negoc: 'Negociando',
  quente: 'Quente',
  novo: 'Novo Lead',
  fim: 'Sem Resposta',
  fechado: 'Fechado',
  desq_regiao: 'Desqualificado por região',
  qtd_vidas: 'Quantidade de Vidas',
  pessoa_fisica: 'Pessoa Física',
  engano: 'Engano',
}

export const CATEGORY_COLORS: Record<LeadCategory, string> = {
  negoc: 'text-orange-400',
  quente: 'text-emerald-400',
  novo: 'text-blue-400',
  fim: 'text-muted-foreground',
  fechado: 'text-[#B5E701]',
  desq_regiao: 'text-rose-400',
  qtd_vidas: 'text-rose-400',
  pessoa_fisica: 'text-rose-400',
  engano: 'text-rose-400',
}

export const CATEGORY_BG: Record<LeadCategory, string> = {
  negoc: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  quente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  novo: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  fim: 'bg-muted/40 text-muted-foreground border-border',
  fechado: 'bg-[#B5E701]/15 text-[#B5E701] border-[#B5E701]/25',
  desq_regiao: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  qtd_vidas: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  pessoa_fisica: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  engano: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
}

// A coluna E ("Criado em") da planilha do Google Sheets chega como string crua no
// formato pt-BR (DD/MM/YYYY, com ou sem hora). O `Date.parse` nativo do JS interpreta
// esse formato como US (MM/DD/YYYY) — "02/08/2026" viraria 8 de fevereiro em vez de
// 2 de agosto. Por isso usamos um parser explícito em vez de `new Date(string)`.
export function parseLeadDate(s: string): number | null {
  if (!s) return null
  const v = s.trim()
  if (!v) return null

  // ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS) — Date.parse lida corretamente com isso.
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }

  // pt-BR: DD/MM/YYYY ou DD-MM-YYYY, com hora opcional HH:MM ou HH:MM:SS.
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null

  const dia = Number(m[1])
  const mes = Number(m[2])
  const ano = Number(m[3])
  const hora = m[4] ? Number(m[4]) : 0
  const min = m[5] ? Number(m[5]) : 0
  const seg = m[6] ? Number(m[6]) : 0

  if (mes < 1 || mes > 12) return null
  if (dia < 1 || dia > 31) return null
  if (hora > 23 || min > 59 || seg > 59) return null

  const d = new Date(ano, mes - 1, dia, hora, min, seg)
  // Rejeita datas que "transbordaram" (ex.: 31/02 vira 3 de março) — Date normaliza
  // silenciosamente em vez de lançar, então validamos o round-trip.
  if (d.getDate() !== dia || d.getMonth() !== mes - 1) return null

  return d.getTime()
}

// Compara dois leads pela data de criação (cronologicamente, não alfabeticamente).
// Leads sem data parseável (null) sempre vão para o FIM, independente de `asc`.
export function compareByCriadoEm(a: Lead, b: Lead, asc: boolean): number {
  const ta = parseLeadDate(a.criado_em)
  const tb = parseLeadDate(b.criado_em)
  if (ta === null && tb === null) return 0
  if (ta === null) return 1
  if (tb === null) return -1
  return asc ? ta - tb : tb - ta
}

// Ordena leads do mais novo para o mais antigo. NÃO reatribui `id` — `id` é o índice
// 0-based da linha da planilha (ver lib/sheets.ts, Leads!F{id + 2}); ordenar aqui move
// os objetos, não os índices.
export function sortLeadsByCriadoEmDesc(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => compareByCriadoEm(a, b, false))
}
