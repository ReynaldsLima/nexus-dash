export type Channel = 'google_ads' | 'meta_ads'

export type SpendPoint = {
  date: string
  google: number
  meta: number
}

export type Campaign = {
  id: string
  name: string
  channel: Channel
  status: 'active' | 'paused'
  impressions: number
  clicks: number
  ctr: number
  spend: number
  conversions: number
  convValue: number
  cpa: number
  roas: number
}

export type AiInsight = {
  id: string
  createdAt: string
  type: 'optimization' | 'alert' | 'opportunity'
  title: string
  summary: string
  metrics: { label: string; value: string; delta?: string }[]
  recommendations: string[]
  impact: 'high' | 'medium' | 'low'
}

function pseudo(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453
  return x - Math.floor(x)
}

// 30 days: Apr 17 → May 16 2026
export const MOCK_SPEND_HISTORY: SpendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const isWeekend = (i + 2) % 7 === 0 || (i + 2) % 7 === 6
  const wf = isWeekend ? 0.62 : 1.0
  const google = Math.round((860 + pseudo(i * 13 + 7) * 420) * wf)
  const meta = Math.round((540 + pseudo(i * 7 + 3) * 270) * wf)
  const day = new Date(2026, 3, 17 + i)
  const date = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`
  return { date, google, meta }
})

export const MOCK_KPIS = {
  spend:  { value: 42_480, prev: 38_210, change: +11.2, betterWhenHigher: false },
  roas:   { value: 3.82,   prev: 3.51,   change: +8.8,  betterWhenHigher: true },
  cpa:    { value: 47.50,  prev: 51.80,  change: -8.3,  betterWhenHigher: false },
  ctr:    { value: 2.84,   prev: 2.47,   change: +15.0, betterWhenHigher: true },
}

export const MOCK_CHANNEL_SPLIT = [
  { name: 'Google Ads', value: 26_300, pct: 61.9 },
  { name: 'Meta Ads',   value: 16_180, pct: 38.1 },
]

export type AccountBalance = {
  channel: Channel
  name: string
  accountId: string
  balance: number
  dailyBudget: number
  currency: 'BRL'
}

export const MOCK_ACCOUNT_BALANCES: AccountBalance[] = [
  {
    channel: 'google_ads',
    name: 'Google Ads',
    accountId: '123-456-7890',
    balance: 8_420,
    dailyBudget: 920,
    currency: 'BRL',
  },
  {
    channel: 'meta_ads',
    name: 'Meta Ads',
    accountId: 'act_987654321',
    balance: 3_180,
    dailyBudget: 540,
    currency: 'BRL',
  },
]

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: 'Busca — Marca',
    channel: 'google_ads',
    status: 'active',
    impressions: 28_400,
    clicks: 2_047,
    ctr: 7.21,
    spend: 8_240,
    conversions: 82,
    convValue: 56_032,
    cpa: 100.49,
    roas: 6.80,
  },
  {
    id: '2',
    name: 'Shopping',
    channel: 'google_ads',
    status: 'active',
    impressions: 186_300,
    clicks: 2_235,
    ctr: 1.20,
    spend: 5_890,
    conversions: 98,
    convValue: 28_861,
    cpa: 60.10,
    roas: 4.90,
  },
  {
    id: '3',
    name: 'Conversão — Retargeting',
    channel: 'meta_ads',
    status: 'active',
    impressions: 142_800,
    clicks: 2_999,
    ctr: 2.10,
    spend: 5_820,
    conversions: 89,
    convValue: 30_264,
    cpa: 65.39,
    roas: 5.20,
  },
  {
    id: '4',
    name: 'Busca — Não Marca',
    channel: 'google_ads',
    status: 'active',
    impressions: 67_200,
    clicks: 2_554,
    ctr: 3.80,
    spend: 6_410,
    conversions: 62,
    convValue: 19_871,
    cpa: 103.39,
    roas: 3.10,
  },
  {
    id: '5',
    name: 'Conversão — Prospecting',
    channel: 'meta_ads',
    status: 'active',
    impressions: 298_400,
    clicks: 4_177,
    ctr: 1.40,
    spend: 4_920,
    conversions: 68,
    convValue: 13_776,
    cpa: 72.35,
    roas: 2.80,
  },
  {
    id: '6',
    name: 'Lead Generation',
    channel: 'meta_ads',
    status: 'active',
    impressions: 98_200,
    clicks: 1_768,
    ctr: 1.80,
    spend: 3_380,
    conversions: 52,
    convValue: 12_168,
    cpa: 65.00,
    roas: 3.60,
  },
  {
    id: '7',
    name: 'Display — Remarketing',
    channel: 'google_ads',
    status: 'active',
    impressions: 524_000,
    clicks: 3_144,
    ctr: 0.60,
    spend: 3_180,
    conversions: 18,
    convValue: 7_632,
    cpa: 176.67,
    roas: 2.40,
  },
  {
    id: '8',
    name: 'Tráfego — Awareness',
    channel: 'meta_ads',
    status: 'paused',
    impressions: 412_000,
    clicks: 4_532,
    ctr: 1.10,
    spend: 2_060,
    conversions: 12,
    convValue: 2_472,
    cpa: 171.67,
    roas: 1.20,
  },
]

export const MOCK_INSIGHTS: AiInsight[] = [
  {
    id: '1',
    createdAt: '2026-05-15T09:30:00Z',
    type: 'opportunity',
    title: 'Google Shopping com ROAS acima da meta — potencial de escala',
    summary:
      'A campanha Shopping mantém ROAS 4.9× nas últimas 2 semanas, superando a meta de 3.5×. Aumentar o orçamento pode capturar demanda reprimida sem deteriorar eficiência.',
    metrics: [
      { label: 'ROAS atual', value: '4.9×', delta: '+40% vs meta' },
      { label: 'Gasto/mês', value: 'R$&nbsp;5.890' },
      { label: 'Budget headroom', value: '+R$&nbsp;3.200' },
    ],
    recommendations: [
      'Aumentar orçamento diário de R$ 196 para R$ 303 (+55%)',
      'Monitorar CPA por 7 dias antes de nova expansão',
      'Revisar bid strategy para tROAS 4.0× e maximizar volume',
    ],
    impact: 'high',
  },
  {
    id: '2',
    createdAt: '2026-05-12T14:20:00Z',
    type: 'alert',
    title: 'Frequência elevada em Meta Prospecting — risco de fadiga criativa',
    summary:
      'A campanha Conversão — Prospecting atingiu frequência média de 4.2× nos últimos 14 dias. Histórico indica queda de CTR acima de 3.5× de frequência.',
    metrics: [
      { label: 'Frequência', value: '4.2×', delta: '+0.7× vs semana' },
      { label: 'CTR', value: '1.4%', delta: '−0.3pp vs mês' },
      { label: 'CPM', value: 'R$&nbsp;48,20', delta: '+12% vs mês' },
    ],
    recommendations: [
      'Inserir 3–4 novos criativos (vídeo 15 s e carrossel) até sexta-feira',
      'Reduzir frequência-alvo para máximo 3× por semana no ad set',
      'Criar A/B test: criativo atual vs. novo por 7 dias',
    ],
    impact: 'high',
  },
  {
    id: '3',
    createdAt: '2026-05-08T11:05:00Z',
    type: 'optimization',
    title: 'CTR de Busca Não Marca abaixo do benchmark — oportunidade em copy',
    summary:
      'A campanha Busca — Não Marca tem CTR de 3.8%, abaixo do benchmark do setor (5.2%) para termos de intenção de compra. Testes de headline podem recuperar 30–40% do volume.',
    metrics: [
      { label: 'CTR atual', value: '3.8%', delta: '−1.4pp vs benchmark' },
      { label: 'Impressões/dia', value: '2.240' },
      { label: 'Clicks perdidos', value: '~32/dia' },
    ],
    recommendations: [
      'Criar 3 variações de headline RSA destacando benefício único',
      'Adicionar extensões de promoção e preço para termos de compra',
      'Pausar termos genéricos com CPC > R$ 8 no search terms report',
    ],
    impact: 'medium',
  },
]
