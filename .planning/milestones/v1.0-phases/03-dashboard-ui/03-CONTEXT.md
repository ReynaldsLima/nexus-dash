# Phase 3: Dashboard UI — Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Substituir mock data por dados reais do Supabase, adicionar date range picker global com presets, implementar drill-down de campanhas, e criar página de Settings para conexão de contas Meta Ads. A maior parte da UI shell já existe (dashboard, campanhas, insights pages com mock data) — esta fase é principalmente wiring de dados reais + features faltantes.

**O que esta fase entrega:**
- KPI cards com dados reais (7 KPIs: ROAS, CPA, CTR, Spend, Impressions, Clicks, Conversions)
- Trend charts por KPI com dados reais (DASH-02)
- Date range picker global no header com presets + calendário custom
- Channel breakdown com dados reais (DASH-03)
- Campaigns page com dados reais + respeitando date range global (CAMP-01–03)
- Campaign drill-down via Sheet lateral (CAMP-04)
- Página Settings: conexão Meta Ads por tenant (SET-02)
- Settings Google Ads: DEFERIDO (configuração manual via Supabase Dashboard até Developer Token ser aprovado)

</domain>

<decisions>
## Implementation Decisions

### Data Fetching Architecture (DASH-01–04, CAMP-01–03)

- **D-01:** Páginas permanecem como Client Components (`'use client'`). Substituir imports de `lib/mock-data` por TanStack Query chamando `createBrowserClient` do `@supabase/ssr` diretamente. RLS garante isolamento por tenant no DB.
- **D-02:** Dashboard e Campanhas mostram dados do **tenant ativo no TenantSwitcher** (context do `[tenant-slug]` na URL). Não há visão consolidada cross-tenant — o Super Admin usa o TenantSwitcher para alternar entre clientes.
- **D-03:** Zustand store `useDateRangeStore` expõe `{ from: Date, to: Date }` e os helpers de preset. TanStack Query usa `queryKey: ['dashboard', tenantSlug, from, to]` — quando o date range muda no Zustand, o query key muda e os dados são re-fetched automaticamente.
- **D-04:** Queries primárias para o dashboard consomem a tabela `daily_rollups` (pré-agregada por day/channel). Queries de campanha consomem `campaign_metrics` diretamente com GROUP BY.

### Date Range Picker (DASH-04)

- **D-05:** Componente `DateRangePicker` no header global (`app/[tenant-slug]/layout.tsx`), ao lado do `TenantSwitcher`. Visível em todas as páginas autenticadas.
- **D-06:** Popover com dois painéis: (1) lista de presets clicáveis, (2) `<Calendar>` do shadcn com seleção de range (react-day-picker já instalado). Presets: "Últimos 7 dias", "Últimos 14 dias", "Últimos 30 dias", "Este mês", "Mês passado", "Custom".
- **D-07:** Default ao carregar: **Last 30 days**. Persiste apenas na sessão (Zustand in-memory sem `persist` middleware). Fecha o browser → reseta para Last 30 days.
- **D-08:** Zustand store único `useDateRangeStore` — não usar React Context para isto (re-render excessivo). Importado nos hooks de query de cada página.

### Campaign Drill-Down (CAMP-04)

- **D-09:** Clicar em uma linha da tabela de Campanhas abre um `<Sheet>` do shadcn (drawer lateral direito). Não muda a URL. Não há rota `/campanhas/[id]` em v1.
- **D-10:** Conteúdo do Sheet:
  - Cabeçalho: nome da campanha + channel badge + status
  - Seção de trend lines: gráfico de área com Spend, ROAS e CTR ao longo do período selecionado (dados de `campaign_metrics` filtrados por `campaign_id`)
  - Seção de totais: tabela com Impressions, Clicks, Spend, Conversions, Conv. Value, CPA, ROAS agregados para o período
- **D-11:** Sheet não fecha ao clicar fora (previne fechamento acidental ao interagir com tooltips dos gráficos). Fecha apenas pelo botão X ou tecla Esc.

### Settings Page (SET-01, SET-02)

- **D-12:** Rota `/[tenant-slug]/settings`. Acessível por `tenant_admin` E `super_admin` (conforme requirements SET-01, SET-02: "Tenant Admin can connect").
- **D-13:** Adicionar "Configurações" ao `SidebarNav` com ícone `Settings` do lucide-react.
- **D-14:** **SET-02 — Meta Ads:** Formulário com dois campos: `Account ID` (ex: `act_123456789`) e `System User Token` (textarea). Ao salvar:
  1. Valida o token chamando a Meta Graph API (`/me?access_token={token}`) antes de persistir
  2. Se válido: salva `account_id` em `ad_accounts` e token no Supabase Vault
  3. Feedback inline: badge "Conectado ✓" ou mensagem de erro com o motivo
- **D-15:** **SET-01 — Google Ads OAuth2:** DEFERIDO. Em v1, a conta Google Ads é configurada manualmente via Supabase Dashboard pelo Super Admin. A Settings page mostra uma seção "Google Ads" com status "Não configurado" e uma nota explicativa. O OAuth2 flow completo será implementado após o Developer Token ser aprovado e em fase posterior.
- **D-16:** Status de conexão exibido por canal na Settings page: badge colorido "Conectado" / "Não configurado" / "Token inválido". Dados lidos da tabela `ad_accounts`.

### Claude's Discretion

- Estrutura exata do Zustand store (`useDateRangeStore`) — campos, helpers de preset, tipagem
- Layout de 7 KPI cards (possível: row de 4 + row de 3, ou grid responsivo 2/3/4 colunas)
- Quais 3 métricas mostrar nos trend lines do drill-down (sugestão: Spend, ROAS, CTR — mas planner pode ajustar)
- Estrutura de queries TanStack Query (keys, funções de fetch, error/loading states)
- Estrutura CSS/layout do Sheet de drill-down
- Adicionar shadcn `Sheet` ao projeto se não estiver instalado

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema e dados
- `.planning/phases/02-data-pipeline/02-CONTEXT.md` — schema completo de `campaign_metrics`, `daily_rollups`, `ad_accounts`, `sync_jobs`; decisões de arquitetura do pipeline
- `supabase/migrations/` — migrations existentes (schema atual do banco)
- `types/database.types.ts` — tipos TypeScript gerados do Supabase (se existir)

### Componentes e padrões existentes
- `app/[tenant-slug]/dashboard/page.tsx` — dashboard com mock data (substituir)
- `app/[tenant-slug]/campanhas/page.tsx` — campanhas com mock data (substituir + adicionar Sheet)
- `app/[tenant-slug]/layout.tsx` — layout com header/sidebar (adicionar DateRangePicker e link Settings)
- `components/layout/sidebar-nav.tsx` — navegação lateral (adicionar Settings)
- `components/ui/chart.tsx` — ChartContainer + ChartTooltip (padrão de charts)
- `lib/mock-data.ts` — tipos Campaign, AiInsight, SpendPoint (reusar tipos, substituir dados)

### Requirements desta fase
- `.planning/REQUIREMENTS.md` §"Dashboard — Overview" — DASH-01 a DASH-04
- `.planning/REQUIREMENTS.md` §"Campaigns" — CAMP-01 a CAMP-04
- `.planning/REQUIREMENTS.md` §"Settings" — SET-01, SET-02

### Supabase
- `.planning/phases/01-foundation/01-CONTEXT.md` — padrões RLS, `get_tenant_id()`, createServerClient vs createBrowserClient
- `lib/supabase/client.ts` — createBrowserClient para Client Components
- Meta Graph API validation: `GET https://graph.facebook.com/me?access_token={token}`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.tsx` — Card, CardHeader, CardTitle, CardContent (padrão estabelecido em todas as páginas)
- `components/ui/chart.tsx` — ChartContainer, ChartTooltip, ChartTooltipContent (wraps Recharts)
- `components/ui/badge.tsx` — Badge para channel labels e status (padrão estabelecido)
- `components/ui/skeleton.tsx` — Skeleton para loading states
- `components/ui/select.tsx` — Select component (pode ser base do preset dropdown)
- `components/tenants/tenant-switcher.tsx` — padrão de dropdown no header (referência para DateRangePicker)
- `app/[tenant-slug]/campanhas/page.tsx` — ChannelBadge, StatusDot, RoasValue já implementados (reusar)

### Established Patterns
- Formatadores `brl()` e `num()` definidos em cada page file — considerar extração para `lib/formatters.ts`
- ChartContainer com config object `{ label, color }` — padrão de chart na base de código
- Cores de canal estabelecidas: Google Ads `oklch(0.60 0.22 258)`, Meta Ads `oklch(0.68 0.20 305)`
- Cores de status: verde `oklch(0.75 0.18 155)`, âmbar `#f59e0b`, vermelho `oklch(0.65 0.20 15)`
- Pages são `'use client'` com estado local via `useState` para filtros

### Integration Points
- `app/[tenant-slug]/layout.tsx` — adicionar `DateRangePicker` no header e link Settings no sidebar
- `lib/supabase/client.ts` — `createBrowserClient()` para queries TanStack Query
- `components/layout/sidebar-nav.tsx` — adicionar item Settings com ícone `Settings2` ou `SlidersHorizontal`
- Nova Zustand store em `lib/stores/date-range.ts` (ou `store/date-range.ts` — seguir padrão existente de stores se houver)

</code_context>

<specifics>
## Specific Ideas

- O Sheet de drill-down não deve fechar ao clicar fora (comportamento explicitado pelo usuário) — apenas X ou Esc
- Settings page: Google Ads deve ter seção visível mas com estado "Não configurado" + nota sobre deferimento
- Meta Ads token: validar via Meta Graph API `/me` antes de persistir no Vault
- Date range picker: botão no header mostra o range ativo de forma compacta (ex: "30 dias" ou "01/05 – 31/05")

</specifics>

<deferred>
## Deferred Ideas

- **SET-01 Google Ads OAuth2 completo** — redirect flow para `/api/google-ads/callback`. Deferido até: (1) Developer Token aprovado, (2) fase posterior ao v1. Em v1: configuração manual via Supabase Dashboard.
- **Visão consolidada cross-tenant** — dashboard que soma todos os tenants. Deferido para quando houver demanda real de comparação entre clientes.
- **Persistência do date range no localStorage** — usuário pediu sessão apenas; adicionar se virar dor de cabeça operacional.
- **Rota dedicada /campanhas/[id]** — URL bookmarkável para drill-down. Deferido; Sheet é suficiente para v1.

</deferred>

---

*Phase: 03-dashboard-ui*
*Context gathered: 2026-06-04*
