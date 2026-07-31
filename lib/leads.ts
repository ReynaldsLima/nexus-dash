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
