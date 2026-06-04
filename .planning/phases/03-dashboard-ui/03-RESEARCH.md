# Phase 3: Dashboard UI — Research

**Researched:** 2026-06-04
**Domain:** Next.js 15 Client Components + TanStack Query v5 + Zustand v5 + shadcn/ui + Supabase data layer
**Confidence:** HIGH (stack verified against npm registry; patterns verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Páginas permanecem como Client Components (`'use client'`). Substituir imports de `lib/mock-data` por TanStack Query chamando `createBrowserClient` do `@supabase/ssr` diretamente. RLS garante isolamento por tenant no DB.
- **D-02:** Dashboard e Campanhas mostram dados do **tenant ativo no TenantSwitcher** (context do `[tenant-slug]` na URL). Não há visão consolidada cross-tenant.
- **D-03:** Zustand store `useDateRangeStore` expõe `{ from: Date, to: Date }` e os helpers de preset. TanStack Query usa `queryKey: ['dashboard', tenantSlug, from, to]` — quando o date range muda no Zustand, o query key muda e os dados são re-fetched automaticamente.
- **D-04:** Queries primárias para o dashboard consomem a tabela `daily_rollups` (pré-agregada por day/channel). Queries de campanha consomem `campaign_metrics` diretamente com GROUP BY.
- **D-05:** Componente `DateRangePicker` no header global (`app/[tenant-slug]/layout.tsx`), ao lado do `TenantSwitcher`.
- **D-06:** Popover com dois painéis: (1) lista de presets clicáveis, (2) `<Calendar>` do shadcn com seleção de range. Presets: "Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Este mês", "Mês passado", "Custom".
- **D-07:** Default ao carregar: **Last 30 days**. Persiste apenas na sessão (Zustand in-memory sem `persist` middleware).
- **D-08:** Zustand store único `useDateRangeStore` — não usar React Context para isto.
- **D-09:** Clicar em uma linha da tabela de Campanhas abre um `<Sheet>` do shadcn (drawer lateral direito). Não muda a URL.
- **D-10:** Conteúdo do Sheet: cabeçalho, trend lines (Spend + ROAS + CTR via AreaChart), totais agregados.
- **D-11:** Sheet não fecha ao clicar fora — apenas botão X ou Esc.
- **D-12:** Rota `/[tenant-slug]/settings`. Acessível por `tenant_admin` E `super_admin`.
- **D-13:** Adicionar "Configurações" ao `SidebarNav` com ícone `Settings` do lucide-react.
- **D-14:** SET-02 — Meta Ads: formulário Account ID + System User Token, valida via Meta Graph API `/me?access_token={token}` antes de persistir; salva account_id em `ad_accounts` e token no Vault.
- **D-15:** SET-01 — Google Ads OAuth2: **DEFERIDO**. Settings page mostra seção "Google Ads" com status "Não configurado" e nota explicativa.
- **D-16:** Status de conexão exibido por canal: badge "Conectado" / "Não configurado" / "Token inválido". Dados lidos da tabela `ad_accounts`.

### Claude's Discretion

- Estrutura exata do Zustand store (`useDateRangeStore`) — campos, helpers de preset, tipagem
- Layout de 7 KPI cards (possível: row de 4 + row de 3, ou grid responsivo 2/3/4 colunas)
- Quais 3 métricas mostrar nos trend lines do drill-down (sugestão: Spend, ROAS, CTR)
- Estrutura de queries TanStack Query (keys, funções de fetch, error/loading states)
- Estrutura CSS/layout do Sheet de drill-down
- Adicionar shadcn `Sheet` ao projeto se não estiver instalado

### Deferred Ideas (OUT OF SCOPE)

- SET-01 Google Ads OAuth2 completo — redirect flow para `/api/google-ads/callback`
- Visão consolidada cross-tenant
- Persistência do date range no localStorage
- Rota dedicada `/campanhas/[id]`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | KPI cards para ROAS, CPA, CTR, Spend, Impressions, Clicks, Conversions com delta period-over-period (absoluto + %, color-coded) | Query de `daily_rollups` + período anterior; cálculo de deltas no frontend |
| DASH-02 | Trend charts (line, time-series) por KPI para o período selecionado | `daily_rollups` filtrado por date range; Recharts AreaChart (já instalado) |
| DASH-03 | Channel breakdown mostrando Google Ads vs Meta Ads em valores absolutos e % | `daily_rollups` filtrado por `channel IN ('google_ads','meta_ads')` + `'all'`; Recharts PieChart |
| DASH-04 | Date range picker global com presets — Last 7/14/30; This Month; Last Month; Custom — default Last 30 days, persiste across navigation | Zustand store + shadcn Calendar mode="range" + shadcn Popover |
| CAMP-01 | Tabela de campanhas: Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions | `campaign_metrics` GROUP BY `campaign_id`; cálculos derivados no JS |
| CAMP-02 | Filtro por canal (Google Ads / Meta / All) | Filtro local em estado React sobre resultado TanStack Query |
| CAMP-03 | Campanhas respeitam o date range picker global | `queryKey` inclui `from` e `to` do Zustand store |
| CAMP-04 | Drill-down de campanha: trend lines para o período selecionado | shadcn Sheet + `campaign_metrics` filtrado por `campaign_id` + date range |
| SET-01 | Tenant Admin conecta conta Google Ads (DEFERIDO em v1) | Settings page mostra seção inativa com status "Não configurado" |
| SET-02 | Tenant Admin conecta conta Meta Ads via System User token | Formulário + validação Meta Graph API `/me` + Supabase Vault write via Route Handler |
</phase_requirements>

---

## Summary

A Fase 3 é principalmente uma operação de "wiring" de dados reais sobre uma shell de UI já existente. A maior parte dos componentes visuais (Cards, Recharts, Badge, Skeleton, Table) já está no código base com mock data. O trabalho principal envolve: (1) instalar TanStack Query v5 e criar o QueryClientProvider; (2) criar o Zustand store `useDateRangeStore`; (3) substituir imports de `lib/mock-data` por `useQuery` hooks chamando `createBrowserClient` do Supabase; (4) instalar e implementar o `DateRangePicker` com shadcn Calendar + Popover; (5) instalar e implementar o Sheet de drill-down; (6) criar a página de Settings com formulário Meta Ads + Route Handler de validação.

O maior risco técnico é o cálculo de period-over-period delta para DASH-01: requer duas queries independentes (período atual e período anterior de mesmo tamanho) e mesclagem no frontend. A tabela `daily_rollups` está disponível conforme TypeScript types confirmados — o schema foi criado na Fase 2.

**Primary recommendation:** Instalar `@tanstack/react-query@^5.101.0` e configurar `QueryClientProvider` em `app/providers.tsx`. Criar `lib/stores/date-range.ts` com Zustand v5. Usar `npx shadcn add calendar popover sheet` para adicionar os 3 componentes faltantes. O layout.tsx deve ser convertido para Client Component apenas na parte do header (via wrapper component `HeaderActions`) para suportar o DateRangePicker que lê do Zustand store.

---

## Standard Stack

### Core (já instalado — verificado em package.json)
| Library | Version Instalada | Purpose | Status |
|---------|---------|---------|--------|
| zustand | ^5.0.13 | `useDateRangeStore` — date range global state | Instalado |
| recharts | ^3.8.0 | AreaChart, PieChart (trend lines, channel split) | Instalado |
| @supabase/ssr | ^0.10.3 | `createBrowserClient` em Client Components | Instalado |
| @supabase/supabase-js | ^2.105.4 | Supabase client base | Instalado |
| zod | ^4.4.3 | Validação do formulário Meta Ads | Instalado |
| react-hook-form | ^7.75.0 | Formulário Settings Meta Ads | Instalado |
| lucide-react | ^1.14.0 | Ícones (Settings, CalendarIcon, etc.) | Instalado |

### A Instalar
| Library | Version Recomendada | Purpose | Motivo |
|---------|---------|---------|--------|
| @tanstack/react-query | ^5.101.0 | Data fetching + caching com queryKey reativo | NÃO INSTALADO — necessário para D-03 |
| react-day-picker | ^9.14.0 | Calendar range mode (peer dep do shadcn Calendar) | NÃO INSTALADO — shadcn add calendar instala automaticamente |

**Version verification:** [VERIFIED: npm registry] — `@tanstack/react-query` latest: 5.101.0, peer deps `react: '^18 || ^19'` — compatível com React 19.2.4 do projeto. `react-day-picker` latest v9: 9.14.0, peer dep `react: '>=16.8.0'`.

### shadcn Components — Status
| Componente | Instalado | Comando para instalar |
|-----------|-----------|----------------------|
| button, card, badge, skeleton, select, form, input, label, dialog, dropdown-menu, separator, alert-dialog, table, chart | Sim | — |
| popover | **NÃO** | `npx shadcn add popover` |
| calendar | **NÃO** | `npx shadcn add calendar` (instala react-day-picker@^9) |
| sheet | **NÃO** | `npx shadcn add sheet` |

[VERIFIED: codebase grep — `components/ui/` listing] [CITED: ui.shadcn.com/docs/components/radix/date-picker]

**Installation:**
```bash
npm install @tanstack/react-query
npx shadcn add popover calendar sheet
```
(react-day-picker é instalado automaticamente como peer dep do calendar)

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── providers.tsx               # QueryClientProvider (novo — 'use client')
├── [tenant-slug]/
│   ├── layout.tsx              # Servidor (existente) — adicionar HeaderActions wrapper
│   ├── dashboard/page.tsx      # Client Component — substituir mock por useQuery
│   ├── campanhas/page.tsx      # Client Component — substituir mock + adicionar Sheet
│   ├── settings/page.tsx       # Client Component (novo)
│   └── api/
│       └── meta-ads/
│           └── connect/route.ts  # Route Handler (novo) — valida token + escreve Vault
components/
├── layout/
│   ├── sidebar-nav.tsx         # Existente — adicionar Settings link
│   └── header-actions.tsx      # Novo 'use client' wrapper — DateRangePicker + TenantSwitcher
├── dashboard/
│   ├── kpi-card.tsx            # Extraído de dashboard/page.tsx
│   └── date-range-picker.tsx   # Novo componente
├── campanhas/
│   └── campaign-sheet.tsx      # Novo componente — Sheet de drill-down
├── settings/
│   └── meta-ads-form.tsx       # Novo componente — formulário Meta Ads
lib/
├── stores/
│   └── date-range.ts           # Zustand store useDateRangeStore (novo)
├── hooks/
│   ├── use-dashboard-data.ts   # useQuery para daily_rollups (novo)
│   └── use-campaigns-data.ts   # useQuery para campaign_metrics (novo)
├── formatters.ts               # Extrair brl() e num() de page files (novo)
└── supabase/
    ├── client.ts               # Existente (createBrowserClient)
    ├── server.ts               # Existente (createServerClient)
    └── service.ts              # Existente (createServiceClient)
```

### Pattern 1: TanStack Query v5 — Setup com QueryClientProvider

**O que é:** Singleton `QueryClient` criado fora do componente React (evita recriação a cada render), wrapeado em `QueryClientProvider` no `app/providers.tsx`.

**Quando usar:** Obrigatório — qualquer `useQuery` no app requer este provider.

```tsx
// app/providers.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Singleton — criado uma vez, reutilizado durante toda a sessão
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — dados de dashboard não precisam de real-time
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

```tsx
// app/layout.tsx — wrappear <body> com <Providers>
import { Providers } from './providers'
// ...
<Providers>{children}</Providers>
```

[CITED: ihsaninh.com/blog/the-complete-guide-to-tanstack-query-next.js-app-router] [VERIFIED: npm registry peerDeps `react: '^18 || ^19'`]

### Pattern 2: useQuery com queryKey reativo a dateRange + tenantSlug

**O que é:** `queryKey` que inclui `tenantSlug`, `from.toISOString()` e `to.toISOString()`. Quando o Zustand store muda, o componente re-renderiza, o queryKey muda, e TanStack Query faz novo fetch automaticamente.

```tsx
// lib/hooks/use-dashboard-data.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDateRangeStore } from '@/lib/stores/date-range'

export function useDashboardData(tenantSlug: string) {
  const { from, to } = useDateRangeStore()
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const fromStr = from.toISOString().split('T')[0]
      const toStr = to.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('daily_rollups')
        .select('*')
        .gte('date', fromStr)
        .lte('date', toStr)
      // Nota: RLS filtra automaticamente por tenant_id via get_tenant_id()

      if (error) throw error
      return data
    },
    enabled: !!tenantSlug,
  })
}
```

[CITED: ihsaninh.com — dynamic queryKey example] [ASSUMED: RLS filtra por tenant via JWT — precisa de confirmação de que o `createBrowserClient` singleton reutiliza corretamente a sessão do usuário logado]

### Pattern 3: Zustand v5 Store sem Provider (in-memory)

**O que é:** Zustand v5 não requer Provider para stores globais in-memory. O módulo é um singleton. Para Next.js App Router com Client Components, basta exportar o hook diretamente.

**Quando requer Provider:** Apenas quando múltiplas instâncias do store são necessárias (ex: SSR com isolamento por request). Para estado de sessão puramente client-side (como este date range), o padrão de módulo singleton é o correto.

```tsx
// lib/stores/date-range.ts
import { create } from 'zustand'

type DateRange = { from: Date; to: Date }

type DateRangeStore = {
  from: Date
  to: Date
  setRange: (range: DateRange) => void
  applyPreset: (preset: PresetKey) => void
}

export type PresetKey = 'last7' | 'last14' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'

function getPresetRange(preset: Exclude<PresetKey, 'custom'>): DateRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'last7':
      return { from: new Date(today.getTime() - 6 * 86400000), to: today }
    case 'last14':
      return { from: new Date(today.getTime() - 13 * 86400000), to: today }
    case 'last30':
      return { from: new Date(today.getTime() - 29 * 86400000), to: today }
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today }
    case 'lastMonth': {
      const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLast = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: firstOfLast, to: lastOfLast }
    }
  }
}

export const useDateRangeStore = create<DateRangeStore>((set) => ({
  ...getPresetRange('last30'), // default: Last 30 days
  setRange: (range) => set(range),
  applyPreset: (preset) => {
    if (preset !== 'custom') set(getPresetRange(preset))
  },
}))
```

[CITED: pmndrs/zustand discussions/3202 — Provider pattern não obrigatório para stores in-memory em Next.js 15 App Router] [VERIFIED: zustand ^5.0.13 instalado no projeto]

### Pattern 4: shadcn Calendar modo range + Popover

**O que é:** shadcn Calendar wrappea `react-day-picker` com `mode="range"`. O componente recebe `selected: DateRange` (onde `DateRange = { from: Date | undefined; to?: Date }`) e `onSelect: (range: DateRange | undefined) => void`.

```tsx
// components/dashboard/date-range-picker.tsx
'use client'
import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDateRangeStore, type PresetKey } from '@/lib/stores/date-range'

const PRESETS: { label: string; key: PresetKey }[] = [
  { label: 'Últimos 7 dias',  key: 'last7' },
  { label: 'Últimos 14 dias', key: 'last14' },
  { label: 'Últimos 30 dias', key: 'last30' },
  { label: 'Este mês',        key: 'thisMonth' },
  { label: 'Mês passado',     key: 'lastMonth' },
]

export function DateRangePicker() {
  const { from, to, setRange, applyPreset } = useDateRangeStore()
  const [open, setOpen] = useState(false)

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setRange({ from: range.from, to: range.to })
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-xs">
          <CalendarIcon className="size-3.5" />
          {format(from, 'dd/MM', { locale: ptBR })} – {format(to, 'dd/MM', { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex gap-0 p-0 w-auto" align="end">
        <div className="flex flex-col border-r border-border p-2 gap-1 min-w-[140px]">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className="text-xs text-left px-3 py-1.5 rounded hover:bg-accent"
              onClick={() => { applyPreset(p.key); setOpen(false) }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={{ from, to }}
          onSelect={handleSelect}
          numberOfMonths={2}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  )
}
```

**Nota crítica:** shadcn `Calendar` usa `mode="range"` do react-day-picker v9. O tipo `DateRange` de `react-day-picker` é `{ from?: Date; to?: Date }`, ambos opcionais durante seleção em andamento. O Zustand store armazena `{ from: Date; to: Date }` (ambos required) — converter apenas quando ambos estiverem definidos.

[CITED: daypicker.dev/selections/range-mode — mode="range" API] [CITED: ui.shadcn.com/docs/components/radix/date-picker — composição Popover + Calendar]

### Pattern 5: shadcn Sheet — prevenir fechar ao clicar fora

**O que é:** `SheetContent` herda de Radix UI `Dialog.Content`. Para prevenir fechamento ao clicar fora, passar `onPointerDownOutside` e `onInteractOutside` com `e.preventDefault()`.

```tsx
// components/campanhas/campaign-sheet.tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'

<Sheet open={!!selectedCampaign} onOpenChange={(open) => { if (!open) setSelectedCampaign(null) }}>
  <SheetContent
    side="right"
    className="w-[520px] sm:max-w-[520px]"
    onPointerDownOutside={(e) => e.preventDefault()}
    onInteractOutside={(e) => e.preventDefault()}
  >
    {/* conteúdo do drill-down */}
  </SheetContent>
</Sheet>
```

[CITED: radix-ui.com/primitives/docs/components/dialog#api-reference — onPointerDownOutside, onInteractOutside] [CITED: github.com/shadcn-ui/ui/discussions/1317 — padrão confirmado pela comunidade]

### Pattern 6: Period-over-Period Delta (DASH-01)

**O que é:** Para exibir deltas (absoluto + %) nos KPI cards, buscar dois períodos: (1) período atual `[from, to]` e (2) período anterior de mesmo tamanho. Calcular no frontend.

```typescript
// lib/hooks/use-dashboard-kpis.ts — padrão de cálculo
function computePriorRange(from: Date, to: Date): { priorFrom: Date; priorTo: Date } {
  const durationMs = to.getTime() - from.getTime()
  const priorTo = new Date(from.getTime() - 86400000) // dia antes do período atual
  const priorFrom = new Date(priorTo.getTime() - durationMs)
  return { priorFrom, priorTo }
}

// Delta calculation
function calcDelta(current: number, prior: number) {
  const absolute = current - prior
  const pct = prior > 0 ? ((current - prior) / prior) * 100 : 0
  return { absolute, pct }
}

// Computed KPIs from daily_rollups rows
function aggregateRollups(rows: DailyRollupRow[]) {
  const totalSpend = rows.reduce((s, r) => s + Number(r.total_spend), 0)
  const totalConv = rows.reduce((s, r) => s + Number(r.total_conversions), 0)
  const totalConvValue = rows.reduce((s, r) => s + Number(r.total_conv_value), 0)
  const totalClicks = rows.reduce((s, r) => s + Number(r.total_clicks), 0)
  const totalImpressions = rows.reduce((s, r) => s + Number(r.total_impressions), 0)
  return {
    spend: totalSpend,
    roas: totalSpend > 0 ? totalConvValue / totalSpend : 0,
    cpa: totalConv > 0 ? totalSpend / totalConv : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    conversions: totalConv,
    clicks: totalClicks,
    impressions: totalImpressions,
  }
}
```

[ASSUMED: `daily_rollups` channel='all' agrega cross-channel. Verificar no schema se existe linha `channel='all'` ou se deve somar `channel='google_ads'` + `channel='meta_ads'`]

### Pattern 7: Settings — Meta Ads Vault Write via Route Handler

**O que é:** O formulário de Settings chama um Route Handler em `/api/meta-ads/connect`. O Route Handler usa `createServiceClient` (já existe em `lib/supabase/service.ts`) para escrever no Supabase Vault.

```typescript
// app/api/meta-ads/connect/route.ts
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  // 1. Autenticar o usuário (verificar role)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId, token, tenantId } = await req.json()

  // 2. Validar token via Meta Graph API
  const metaRes = await fetch(`https://graph.facebook.com/me?access_token=${token}`)
  if (!metaRes.ok) {
    const err = await metaRes.json()
    return Response.json({ error: `Token inválido: ${err?.error?.message ?? 'Meta API error'}` }, { status: 400 })
  }

  // 3. Salvar secret no Vault (service role)
  const service = createServiceClient()
  const secretName = `meta_ads_token_${tenantId}`

  // Inserir ou atualizar secret no Vault
  const { data: vaultData, error: vaultError } = await service.rpc('create_or_update_vault_secret', {
    p_name: secretName,
    p_secret: token,
  })
  if (vaultError) return Response.json({ error: 'Vault write failed' }, { status: 500 })

  // 4. Upsert em ad_accounts
  const { error: adError } = await service
    .from('ad_accounts')
    .upsert({
      tenant_id: tenantId,
      channel: 'meta_ads',
      account_id: accountId,
      vault_secret_id: vaultData, // UUID retornado pelo Vault
      active: true,
    }, { onConflict: 'tenant_id,channel' })

  if (adError) return Response.json({ error: 'DB write failed' }, { status: 500 })
  return Response.json({ success: true })
}
```

[CITED: makerkit.dev/blog/tutorials/supabase-vault — padrão service role + Vault] [ASSUMED: função `create_or_update_vault_secret` existe ou precisa ser criada; verificar migrations da Fase 2]

### Pattern 8: Layout Header com DateRangePicker (layout.tsx é Server Component)

**Problema:** `app/[tenant-slug]/layout.tsx` é um Server Component (sem `'use client'`). O `DateRangePicker` usa Zustand (client-only). Solução: mover os elementos interativos do header para um wrapper `'use client'` separado.

```tsx
// components/layout/header-actions.tsx — NOVO 'use client' wrapper
'use client'
import { TenantSwitcher } from '@/components/tenants/tenant-switcher'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { LogoutButton } from '@/components/auth/logout-button'

export function HeaderActions({ role, tenants, activeSlug }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <DateRangePicker />
      <TenantSwitcher role={role} tenants={tenants} activeSlug={activeSlug} />
      <LogoutButton />
    </div>
  )
}
```

```tsx
// app/[tenant-slug]/layout.tsx — substituir div de actions no header
// Remover: <TenantSwitcher /> e <LogoutButton /> direto
// Adicionar: <HeaderActions role={role} tenants={tenants} activeSlug={urlSlug} />
```

[ASSUMED: `TenantSwitcher` e `LogoutButton` já são Client Components — verificar se precisam de refactoring]

### Anti-Patterns a Evitar

- **Não usar `useEffect` + `useState` para fetch de dados:** Use `useQuery` do TanStack Query — trata loading/error/cache automaticamente.
- **Não criar `QueryClient` dentro de componente React:** Causa recriação do cache a cada render. Criar fora do componente (singleton de módulo).
- **Não usar `React Context` para o date range:** Causa re-render de toda a árvore. Zustand evita isso.
- **Não passar token Meta Ads do formulário diretamente para o banco via client Supabase:** Usar Route Handler com `createServiceClient` — o cliente browser não tem permissão para escrever no Vault.
- **Não armazenar tokens em colunas de texto planas:** Tokens vão para Supabase Vault — `ad_accounts.vault_secret_id` referencia o secret encriptado.
- **Não usar o node nativo Supabase no N8N:** Confirmado de Fase 2 — HTTP Request + PostgREST apenas (bug #17020).

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Ao Invés | Motivo |
|---------|-------------|-------------|-----|
| Data fetching + cache invalidation | Fetch manual + useState + useEffect | TanStack Query `useQuery` | Cache automático, dedup, staleTime, loading/error states built-in |
| Calendar com range selection | Input de texto ou date nativo | shadcn Calendar mode="range" (react-day-picker) | Navegação de meses, teclado, accessibilidade, localização pt-BR |
| Drawer lateral | `position: fixed` manual com overlay | shadcn Sheet | Focus trap, Esc key, ARIA attributes, animação |
| Validação de formulário | Checks manuais em `onSubmit` | React Hook Form + Zod (já instalado) | Parse tipado, mensagens de erro, UX de validação |
| Cálculo de períodos de datas | `new Date()` ad-hoc | Funções puras em `lib/stores/date-range.ts` | Encapsulamento, testável, consistência |

---

## Common Pitfalls

### Pitfall 1: QueryClient recriado a cada render
**O que vai errado:** Declarar `const queryClient = new QueryClient()` dentro de um componente React ou sem `useRef` → o cache é destruído a cada render, cada page navigation faz refetch completo.
**Por que acontece:** Em Next.js App Router, Server Components rerenderizam no servidor a cada request; Client Components podem rerenderizar no cliente.
**Como evitar:** Criar `queryClient` como singleton de módulo em `lib/query-client.ts` ou em `app/providers.tsx` fora do componente. [CITED: ihsaninh.com — singleton pattern]

### Pitfall 2: `daily_rollups` channel='all' pode não existir
**O que vai errado:** Query para KPI cross-channel faz `WHERE channel='all'` mas a tabela só tem `'google_ads'` e `'meta_ads'`.
**Por que acontece:** Schema da Fase 2 (CONTEXT.md D-11) menciona que o campo `channel` pode ser `'all'` para cross-channel — mas depende de como `refresh_daily_rollups()` foi implementado.
**Como evitar:** Verificar nas migrations se há rows com `channel='all'`. Se não houver, agregar somando `google_ads` + `meta_ads` no frontend (GROUP BY date, somar métricas).

### Pitfall 3: React 19 + react-day-picker peerDep
**O que vai errado:** `react-day-picker@9` declara `peerDependencies: { react: '>=16.8.0' }` — compatível com React 19. Porém shadcn CLI pode instalar uma versão mais antiga.
**Como evitar:** Usar `npx shadcn add calendar` (instala react-day-picker@^9 automaticamente). Confirmar versão instalada após.

### Pitfall 4: Layout Server Component + Zustand
**O que vai errado:** Tentar importar `useDateRangeStore` diretamente em `app/[tenant-slug]/layout.tsx` (Server Component) → erro de compilação ("useState cannot be called in server component").
**Por que acontece:** `layout.tsx` não tem `'use client'`.
**Como evitar:** Criar `components/layout/header-actions.tsx` com `'use client'` que contém o `DateRangePicker`. Importar esse wrapper no layout.

### Pitfall 5: Meta Graph API — token válido mas sem permissão de Ads
**O que vai errado:** Token passa na validação `/me` (retorna `id` e `name`) mas não tem acesso à conta de Ads.
**Por que acontece:** System User tokens podem ser criados sem permissão de `ads_read`.
**Como evitar:** Validar também chamando `/act_{accountId}?fields=id&access_token={token}` após a validação básica de `/me`. Se retornar erro 190 ou 100, exibir mensagem específica.

### Pitfall 6: Vault — RPC `create_or_update_vault_secret` pode não existir
**O que vai errado:** O código do Route Handler chama um RPC que não foi criado na Fase 2.
**Por que acontece:** A Fase 2 criou `read_vault_secret` mas não necessariamente `create_or_update_vault_secret`.
**Como evitar:** Wave 0 da Fase 3 deve verificar migrations existentes. Se a função não existir, criar migration para ela antes do Route Handler.

### Pitfall 7: Period-over-period — divisão por zero em ROAS/CPA
**O que vai errado:** Se o período anterior não tem dados (tenant novo, primeiro sync), `prior.spend === 0` → ROAS e CPA lançam `Infinity` ou `NaN`.
**Como evitar:** Guard com `prior > 0 ? ... : null`. Exibir `—` quando não há dados de período anterior.

---

## Code Examples

### Query para Campaign Metrics com GROUP BY (CAMP-01)

```typescript
// lib/hooks/use-campaigns-data.ts
const { data } = useQuery({
  queryKey: ['campaigns', tenantSlug, from.toISOString(), to.toISOString()],
  queryFn: async () => {
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('campaign_metrics')
      .select(`
        campaign_id,
        campaign_name,
        channel,
        status,
        spend.sum(),
        impressions.sum(),
        clicks.sum(),
        conversions.sum(),
        conversion_value.sum()
      `)
      .gte('date', fromStr)
      .lte('date', toStr)
    // Nota: PostgREST não suporta GROUP BY diretamente
    // Alternativa: buscar all rows e agrupar no JS (funciona para v1 com 1-3 tenants)

    if (error) throw error
    return data
  }
})
```

**Nota importante:** PostgREST (Supabase) não suporta GROUP BY nativo via `.from().select()`. Para agregações, as opções são: (1) criar uma Postgres View ou Function, ou (2) buscar todas as linhas do período e agregar no JavaScript. Para v1 com 1-3 tenants e 90 dias de dados, a opção 2 é viável — uma campanha com sync diário terá ~90 linhas.

[ASSUMED: Para v1, buscar todas as linhas do período e agrupar no JS é aceitável em performance. Rever se o número de linhas por tenant ultrapassar 5.000]

### Sheet de Drill-down — Estrutura

```tsx
// Controle de estado — na página campanhas
const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

// Na tabela — substituir ExternalLink por click handler
<tr
  onClick={() => setSelectedCampaignId(c.campaign_id)}
  className="cursor-pointer ..."
>

// Sheet
<CampaignSheet
  campaignId={selectedCampaignId}
  onClose={() => setSelectedCampaignId(null)}
/>
```

### Meta Graph API — Validação de Token

```typescript
// app/api/meta-ads/connect/route.ts
const metaRes = await fetch(
  `https://graph.facebook.com/v22.0/me?access_token=${encodeURIComponent(token)}&fields=id,name`
)
if (!metaRes.ok) {
  const body = await metaRes.json().catch(() => ({}))
  const msg = body?.error?.message ?? 'Token inválido'
  return Response.json({ error: msg }, { status: 400 })
}
// Token válido — continuar com validação de permissão de Ads
const accountRes = await fetch(
  `https://graph.facebook.com/v22.0/act_${accountId}?fields=id&access_token=${encodeURIComponent(token)}`
)
if (!accountRes.ok) {
  return Response.json({ error: 'Token não tem permissão para esta conta de Ads' }, { status: 400 })
}
```

[CITED: developers.facebook.com/docs/graph-api/reference/user — GET /me returns id, name by default] [CITED: developers.facebook.com/docs/graph-api/reference/debug_token — error code 190 = Invalid OAuth 2.0 Access Token]

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|---|---|---|---|
| `useEffect` + `fetch` + `useState` para data fetching | TanStack Query `useQuery` | ~2020-2021 | Cache, dedup, background refetch automáticos |
| React Context para estado global de UI | Zustand (store de módulo) | ~2021-2022 | Sem re-render excessivo em árvore |
| `react-day-picker` v7/v8 API | v9 — API breaking change (DateRange type, callbacks) | 2024 | Renomeação de `selected`, `onSelect` tipado |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 (deprecated) | Suporte a Next.js App Router, cookies() |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2024 (Supabase Vercel Integration) | Já configurado neste projeto |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated — já não instalado neste projeto (correto)
- `react-day-picker` v7/v8: Não usar — sintaxe de `mode` e tipos mudaram em v9

---

## Assumptions Log

| # | Claim | Section | Risco se Errado |
|---|-------|---------|-----------------|
| A1 | `daily_rollups` possui rows com `channel='all'` para totais cross-channel | Patterns 6, Code Examples | Planner deve verificar migrations; se não existir, agregar no JS somando google_ads + meta_ads |
| A2 | `create_or_update_vault_secret` RPC existe no Supabase (criado na Fase 2) | Pattern 7 | Precisaria de nova migration antes do Route Handler |
| A3 | `TenantSwitcher` já é um Client Component — pode ser movido para `header-actions.tsx` sem refactoring | Pattern 8 | Checar imports/exports do componente |
| A4 | Para v1 com 1-3 tenants, buscar todas as linhas de `campaign_metrics` do período e agrupar no JS é aceitável em performance | Code Examples (CAMP-01) | Se cada tenant tiver >5.000 linhas no período, criar Postgres View para agregação |
| A5 | Meta Graph API v22.0 está ativa e aceita `/me?access_token=` GET requests | Pattern 7, Code Examples | Verificar se Meta depreciou esta forma de validação em 2026 |
| A6 | `useDateRangeStore` como módulo singleton (sem Provider) funciona corretamente em Next.js 15 App Router para estado puramente client-side | Pattern 3 | Se houver hidration mismatch, usar `useRef` + `useState` com lazy init |

---

## Open Questions

1. **`daily_rollups` possui row com `channel='all'`?**
   - O que sabemos: Schema de Fase 2 (D-11) menciona `channel='all'` como possível valor.
   - O que está impreciso: Se `refresh_daily_rollups()` cria de fato essa row ou se é responsabilidade do frontend somar.
   - Recomendação: Planner deve incluir task Wave 0 para verificar a migration `refresh_daily_rollups` e confirmar se cria row `channel='all'`.

2. **`create_or_update_vault_secret` RPC existe?**
   - O que sabemos: Fase 2 criou `read_vault_secret` (confirmado em `types/database.types.ts`).
   - O que está impreciso: Se existe função de escrita/atualização de secrets.
   - Recomendação: Planner deve incluir task para criar migration com a função se não existir.

3. **`TenantSwitcher` e `LogoutButton` — são Client Components?**
   - O que sabemos: São importados no layout Server Component sem erro de compilação.
   - O que está impreciso: Se ambos têm `'use client'` ou usam callbacks do Server Component.
   - Recomendação: Verificar source antes de mover para `header-actions.tsx`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm installs | Verificado implicitamente | — | — |
| @tanstack/react-query | TanStack Query hooks | Não instalado | — | Instalar via npm |
| react-day-picker@^9 | shadcn Calendar | Não instalado | — | Instalar via `npx shadcn add calendar` |
| shadcn popover | DateRangePicker | Não instalado | — | Instalar via `npx shadcn add popover` |
| shadcn sheet | CampaignSheet | Não instalado | — | Instalar via `npx shadcn add sheet` |
| Meta Graph API | Token validation | Não verificado localmente | v22.0 | N/A — validação online |

[VERIFIED: npm registry] [VERIFIED: package.json — zustand, recharts, react-hook-form, zod já instalados]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | KPI delta calculation (aggregateRollups + calcDelta) | unit | `npm test -- tests/unit/dashboard-kpis.test.ts` | ❌ Wave 0 |
| DASH-04 | Zustand store presets — getPresetRange() returns correct dates | unit | `npm test -- tests/unit/date-range-store.test.ts` | ❌ Wave 0 |
| CAMP-01 | groupCampaignMetrics() aggregation function | unit | `npm test -- tests/unit/campaign-aggregation.test.ts` | ❌ Wave 0 |
| SET-02 | Meta Ads Route Handler — valida token e retorna erro correto | manual-only | N/A (requer token Meta real) | N/A — manual UAT |
| DASH-03 | Channel split percentage calculation | unit | `npm test -- tests/unit/channel-split.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (todos os unit tests existentes + novos)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/dashboard-kpis.test.ts` — cobre DASH-01 (calcDelta, aggregateRollups, period-over-period)
- [ ] `tests/unit/date-range-store.test.ts` — cobre DASH-04 (presets, getPresetRange, default state)
- [ ] `tests/unit/campaign-aggregation.test.ts` — cobre CAMP-01 (groupCampaignMetrics)
- [ ] `tests/unit/channel-split.test.ts` — cobre DASH-03 (channel percentage calculation)

*(Lógica de UI, Sheet, DateRangePicker: manual-only — não testável com Vitest/node environment. RLS e queries: já cobertos pelos integration tests existentes da Fase 2)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim | Supabase session via `createServerClient` — verificado no Route Handler |
| V3 Session Management | Sim | Supabase SSR — cookies gerenciados pelo middleware existente |
| V4 Access Control | Sim | RLS no DB + role check no Route Handler (`tenant_admin` ou `super_admin`) |
| V5 Input Validation | Sim | Zod schema para formulário Meta Ads (account_id + token) |
| V6 Cryptography | Sim | Supabase Vault (AES-256) para System User Token — nunca armazenar em texto plano |

### Known Threat Patterns para este Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token exposição no client | Information Disclosure | Token Meta enviado via POST para Route Handler; nunca exposto em queryString ou log |
| Cross-tenant data leakage | Tampering | RLS com `(SELECT get_tenant_id())` — já estabelecido em Fase 1 |
| SSRF via Meta API URL | Tampering | URL hardcoded (`graph.facebook.com`) — não usar input do usuário na URL base |
| Service role key no client | Elevation of Privilege | `lib/supabase/service.ts` importa `server-only` — não pode ser bundled no client |
| Vault secret ID exposição | Information Disclosure | `vault_secret_id` é UUID opaco — não expor o conteúdo do secret em responses de API |

---

## Sources

### Primary (HIGH confidence)
- npm registry — versões verificadas: `@tanstack/react-query@5.101.0`, `react-day-picker@9.14.0`, `zustand@5.0.14`
- `types/database.types.ts` — schema de `daily_rollups`, `campaign_metrics`, `ad_accounts`, `sync_jobs` confirmados
- `package.json` — dependências instaladas confirmadas
- `components/ui/` listing — componentes shadcn instalados confirmados
- Radix UI Dialog API — `onPointerDownOutside`, `onInteractOutside` props

### Secondary (MEDIUM confidence)
- [ihsaninh.com — TanStack Query v5 Next.js App Router](https://ihsaninh.com/blog/the-complete-guide-to-tanstack-query-next.js-app-router) — padrão QueryClient singleton + providers.tsx
- [daypicker.dev — Range Mode](https://daypicker.dev/selections/range-mode) — mode="range", DateRange type
- [ui.shadcn.com — Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker) — composição Popover + Calendar
- [ui.shadcn.com — Sheet](https://ui.shadcn.com/docs/components/radix/sheet) — `npx shadcn add sheet`
- [makerkit.dev — Supabase Vault](https://makerkit.dev/blog/tutorials/supabase-vault) — padrão service role + Vault
- [developers.facebook.com — Graph API User](https://developers.facebook.com/docs/graph-api/reference/user/) — GET /me response fields

### Tertiary (LOW confidence)
- [pmndrs/zustand discussions/3202](https://github.com/pmndrs/zustand/discussions/3202) — Provider não obrigatório para in-memory stores (discussão da comunidade)
- [github.com/shadcn-ui/ui/discussions/1317](https://github.com/shadcn-ui/ui/discussions/1317) — onInteractOutside pattern para Sheet

---

## Project Constraints (from CLAUDE.md)

Diretivas obrigatórias a respeitar em todos os planos e implementações:

| Categoria | Restrição |
|-----------|-----------|
| UI Components | Usar shadcn/ui — NÃO usar Chakra UI, Tremor, MUI |
| Data Visualization | Recharts via shadcn/ui Chart — NÃO usar Nivo, Victory, TanStack Charts |
| Data Fetching | TanStack Query ^5 (client) + Next.js fetch (server) — NÃO usar SWR |
| State Management | Zustand ^5 — NÃO usar Redux Toolkit, Jotai, React Context para estado frequente |
| Form Handling | React Hook Form ^7 + Zod ^4 — NÃO usar Formik, Zod v3 |
| Supabase Client | @supabase/ssr APENAS — NÃO instalar @supabase/auth-helpers-nextjs |
| AI Provider | Claude API (claude-sonnet-4-6) — não relevante para Fase 3 |
| Segurança | RLS obrigatório — isolamento total entre tenants via `(SELECT get_tenant_id())` |
| Budget | Vercel Hobby — evitar bundle size desnecessário |
| N8N | HTTP Request + PostgREST APENAS — nunca node nativo Supabase (bug #17020) |
| Env Vars | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (não `ANON_KEY`) — já configurado |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verificado contra npm registry e package.json do projeto
- Architecture patterns: HIGH (core) / MEDIUM (Vault write pattern) — pattern de Vault assume RPC que pode não existir
- Pitfalls: HIGH — baseado em leitura do código existente + docs oficiais
- Meta Graph API validation: MEDIUM — endpoint confirmado mas comportamento de v22.0 em 2026 não testado

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (estável — exceto Meta Graph API versão, revisar se mudanças em v24+)
