---
phase: 03-dashboard-ui
verified: 2026-06-05T18:30:00Z
status: human_needed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/10 (13/15 truths)
  gaps_closed:
    - "Channel PieChart click drill-down (ROADMAP SC3 / DASH-03-ext / GAP-03-01) — ChannelSheet com 3 seções implementado e integrado"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirmar que as migrations 0013 e 0014 estão aplicadas ao Supabase remoto"
    expected: "Função create_or_update_vault_secret existe no DB com GRANT apenas para service_role; autenticator sem execute grant"
    why_human: "supabase db push requer SUPABASE_DB_PASSWORD não disponível no ambiente de dev. O Route Handler /api/meta-ads/connect falhará no passo 6 (Vault RPC) até a migration ser aplicada. Verificação anterior indicou RESOLVED via SQL Editor em 2026-06-05 — confirmar que o estado ainda está correto."
  - test: "UAT visual do ChannelSheet — clicar em Google Ads e Meta Ads no PieChart"
    expected: "Sheet lateral abre com (1) AreaChart de gasto diário do canal, (2) 6 métricas agregadas (Impressões, Cliques, CTR, Gasto, Conversões, ROAS), (3) top 5 campanhas do canal ordenadas por spend desc. Sheet NÃO fecha ao clicar fora — apenas botão X ou Esc."
    why_human: "Comportamento visual e interatividade do PieChart onClick não são verificáveis programaticamente. Clicar fora do Sheet é um comportamento de runtime que requer teste manual."
---

# Phase 3: Dashboard UI — Re-Verification Report (após fechamento GAP-03-01)

**Phase Goal:** Dashboard UI completo — KPI cards, trend charts, campanhas com drill-down, Settings Meta Ads, e channel drill-down via PieChart (ROADMAP SC3 — todos os critérios)
**Verified:** 2026-06-05T18:30:00Z
**Status:** human_needed
**Re-verificação:** Sim — após gap closure (Plan 06 fechou GAP-03-01)

---

## Resumo da Re-Verificação

A verificação anterior (2026-06-05T01:30:00Z) reportou `gaps_found` com GAP-03-01: ausência de channel click drill-down no PieChart do dashboard (ROADMAP SC3). A Plan 06 foi executada e o gap foi fechado:

- `components/dashboard/channel-sheet.tsx` criado com 3 seções (AreaChart de gasto, métricas agregadas, top campanhas)
- `app/[tenant-slug]/dashboard/page.tsx` modificado com `onClick` no `<Pie>`, `selectedChannel` state, `CHANNEL_KEY_MAP`, `channelRows` derivado e `<ChannelSheet>` integrado

**Todos os 15 must-haves verificados. Nenhum gap remanescente. Status: human_needed (2 itens de UAT).**

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pure date-range preset functions return correct from/to dates for all 5 presets | ✓ VERIFIED | `lib/stores/date-range.ts` exporta `getPresetRange`; 13 testes passam em `date-range-store.test.ts` |
| 2 | KPI aggregation sums daily_rollups rows and derives ROAS/CPA/CTR with zero-guards | ✓ VERIFIED | `lib/dashboard-kpis.ts` exporta `aggregateRollups`; 17 testes passam em `dashboard-kpis.test.ts` |
| 3 | Period-over-period delta returns absolute + pct and returns null when prior period has zero base | ✓ VERIFIED | `calcDelta` retorna `pct: null` (não 0) para base zero; testado em dashboard-kpis.test.ts |
| 4 | Campaign metrics rows grouped by campaign_id with summed metrics and derived ROAS/CPA/CTR | ✓ VERIFIED | `groupCampaignMetrics` em `lib/campaign-aggregation.ts`; 15 testes passam incluindo status ACTIVE/ENABLED |
| 5 | Channel split computes google vs meta percentage summing to 100 | ✓ VERIFIED | `computeChannelSplit` em `lib/dashboard-kpis.ts`; 5 testes passam em `channel-split.test.ts` |
| 6 | npm test (4 Phase 3 unit files) passes with all tests green | ✓ VERIFIED | 51 testes unitários passam (13+17+5+15+1 pré-existente) |
| 7 | App is wrapped in QueryClientProvider so useQuery works app-wide | ✓ VERIFIED | `app/providers.tsx` exporta `Providers` com `QueryClientProvider`; `app/layout.tsx` envolve children em `<Providers><TenantStoreProvider>` |
| 8 | Global date range picker in header on every authenticated page, default Last 30 days | ✓ VERIFIED | `components/dashboard/date-range-picker.tsx` importa `useDateRangeStore`; `app/[tenant-slug]/layout.tsx` usa `<HeaderActions>` com `<DateRangePicker>` |
| 9 | Dashboard shows 7 KPI cards from daily_rollups with period-over-period deltas, trend chart, channel split | ✓ VERIFIED | `dashboard/page.tsx` importa `useDashboardData`, `aggregateRollups`, `calcDelta`, `computeChannelSplit`; 7 invocações de `<KpiCard>` (grep count=7); sem `MOCK_` |
| 10 | Campaigns page lists real campaigns from campaign_metrics; channel filter; date-range reactive; CampaignSheet drill-down no outside close | ✓ VERIFIED | `use-campaigns-data.ts` faz query em `campaign_metrics`; `campanhas/page.tsx` usa `groupCampaignMetrics` + `CampaignSheet`; `disablePointerDismissal` no Sheet; guard `outside-press` |
| 11 | Settings page exists with Meta Ads form, Google Ads deferred section, and sidebar link | ✓ VERIFIED | `app/[tenant-slug]/settings/page.tsx` tem `MetaAdsForm` + card Google Ads deferido; `sidebar-nav.tsx` tem ícone Settings + href `/${slug}/settings` |
| 12 | Meta Ads Route Handler validates token, writes to Vault, upserts ad_accounts; token never logged or returned | ✓ VERIFIED | `app/api/meta-ads/connect/route.ts`: auth check → role check → Zod validation → tenant ownership → double Meta Graph API validation → Vault RPC → ad_accounts upsert; sem `console.log(token)` |
| 13 | Migration 0013 creates create_or_update_vault_secret RPC with correct SECURITY DEFINER and grants | ✓ VERIFIED | `supabase/migrations/0013_create_vault_write_function.sql` tem SECURITY DEFINER, REVOKE PUBLIC/anon/authenticated, GRANT service_role; migration 0014 revoga grant de authenticator |
| 14 | Clicking a channel (Google Ads or Meta Ads) in the PieChart opens a right-side Sheet drill-down with spend chart, 6 metrics, and top 5 campaigns (ROADMAP SC3 / DASH-03-ext) | ✓ VERIFIED | `dashboard/page.tsx` tem `onClick={(data) => setSelectedChannel(...)}` no `<Pie>`, `cursor: 'pointer'` nos `<Cell>`, `CHANNEL_KEY_MAP`, `channelRows` filtrado, `<ChannelSheet>` integrado. `components/dashboard/channel-sheet.tsx` exporta `ChannelSheet` com 3 seções: GASTO NO PERÍODO (AreaChart), MÉTRICAS DO CANAL (6 TotalsRow), TOP CAMPANHAS (via `useCampaignsData` + `groupCampaignMetrics` + filter + sort spend desc + slice(0,5)). `disablePointerDismissal` + guard `outside-press`. Verificação automatizada: todos os 13 checks passam |
| 15 | The drill-down Sheet (channel and campaign) does NOT close on outside click — only X or Esc | ✓ VERIFIED | `ChannelSheet`: `disablePointerDismissal` + `eventDetails?.reason === 'outside-press' → return`; `CampaignSheet`: mesmo padrão. Ambos confirmados via grep |

**Score:** 15/15 truths verificados

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/formatters.ts` | brl/num formatters | ✓ VERIFIED | Exporta `brl` e `num` com Intl pt-BR; assinatura idêntica às inline originais |
| `lib/stores/date-range.ts` | Zustand store + getPresetRange | ✓ VERIFIED | Exporta `PresetKey`, `DateRange`, `getPresetRange`, `useDateRangeStore`; default `last30` |
| `lib/dashboard-kpis.ts` | aggregateRollups, calcDelta, computePriorRange, computeChannelSplit | ✓ VERIFIED | 4 funções exportadas; zero-guards em ROAS/CPA/CTR; `pct: null` para prior zero |
| `lib/campaign-aggregation.ts` | groupCampaignMetrics | ✓ VERIFIED | Agrupa por campaign_id via Map; ENABLED+ACTIVE→active; campo `convValue` |
| `app/providers.tsx` | QueryClientProvider wrapper | ✓ VERIFIED | `'use client'`, factory `useState(() => makeQueryClient())` (SSR-safe) |
| `components/layout/header-actions.tsx` | Client wrapper com DateRangePicker | ✓ VERIFIED | Contém `DateRangePicker`, `TenantSwitcher`, `LogoutButton` |
| `components/dashboard/date-range-picker.tsx` | Popover + presets + Calendar wired ao store | ✓ VERIFIED | Contém `useDateRangeStore`, `mode="range"`, 5 presets, sem date-fns |
| `components/ui/sheet.tsx` | shadcn Sheet via @base-ui/react | ✓ VERIFIED | Arquivo existe; usado por CampaignSheet e ChannelSheet |
| `lib/hooks/use-dashboard-data.ts` | useDashboardData hook | ✓ VERIFIED | `useQuery`, `from('daily_rollups')`, `useDateRangeStore`, `computePriorRange`, `Promise.all`; sem `.eq('tenant_id')` |
| `app/[tenant-slug]/dashboard/page.tsx` | 7 KPI cards + trend + channel split + ChannelSheet | ✓ VERIFIED | `useDashboardData`, `aggregateRollups`, `calcDelta`, `computeChannelSplit`, `useState`, `ChannelSheet`; 7 invocações `<KpiCard>`; sem MOCK_ |
| `lib/hooks/use-campaigns-data.ts` | useCampaignsData + useCampaignTimeseries | ✓ VERIFIED | Ambos os hooks; `from('campaign_metrics')`; guard `enabled: !!tenantSlug && !!campaignId` |
| `components/campanhas/campaign-sheet.tsx` | Sheet drill-down com no-outside-close | ✓ VERIFIED | `Sheet`, `useCampaignTimeseries`, `disablePointerDismissal`, guard `outside-press` |
| `app/[tenant-slug]/campanhas/page.tsx` | Tabela real + filtro + date-range + CampaignSheet | ✓ VERIFIED | `useCampaignsData`, `groupCampaignMetrics`, `CampaignSheet`, `cursor-pointer`, tabs de filtro; sem MOCK_ |
| `supabase/migrations/0013_create_vault_write_function.sql` | create_or_update_vault_secret RPC | ✓ VERIFIED (committed) | SECURITY DEFINER, REVOKE, GRANT service_role; `RETURNS UUID` |
| `app/api/meta-ads/connect/route.ts` | POST handler com cadeia de segurança completa | ✓ VERIFIED | `graph.facebook.com/v22.0/me`, double validation, `createServiceClient`, `create_or_update_vault_secret`, `from('ad_accounts')`, `onConflict`, 401 path, 403 path, `runtime = 'nodejs'` |
| `components/settings/meta-ads-form.tsx` | RHF + Zod form | ✓ VERIFIED | `useForm`, `zodResolver`, `/api/meta-ads/connect`; token cleared via `reset()` após sucesso |
| `app/[tenant-slug]/settings/page.tsx` | Settings page com badges de status | ✓ VERIFIED | `MetaAdsForm`, `from('ad_accounts')`, seção Google Ads deferida com nota |
| `components/layout/sidebar-nav.tsx` | Link Configurações no sidebar | ✓ VERIFIED | Ícone `Settings`, link `/${slug}/settings`, grupo "Conta" |
| `components/dashboard/channel-sheet.tsx` | ChannelSheet com 3 seções | ✓ VERIFIED | Exporta `ChannelSheet`; `disablePointerDismissal`; 3 seções literais; `useCampaignsData`; `groupCampaignMetrics`; `aria-busy="true"` no loading; sem `font-semibold`; usa `py-1` no ChannelBadge e `pt-6` nos separadores |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/layout.tsx` | `app/providers.tsx` | `<Providers>` envolve children | ✓ WIRED | Linha 42-44: `<Providers><TenantStoreProvider>{children}</TenantStoreProvider></Providers>` |
| `app/[tenant-slug]/layout.tsx` | `components/layout/header-actions.tsx` | `<HeaderActions>` no header | ✓ WIRED | Import + `<HeaderActions role tenants activeSlug>` |
| `components/dashboard/date-range-picker.tsx` | `lib/stores/date-range.ts` | import `useDateRangeStore` | ✓ WIRED | `from '@/lib/stores/date-range'` |
| `lib/hooks/use-dashboard-data.ts` | `daily_rollups` | `supabase.from('daily_rollups').select` | ✓ WIRED | `from('daily_rollups')` no queryFn |
| `lib/hooks/use-dashboard-data.ts` | `lib/stores/date-range.ts` | `useDateRangeStore` no queryKey | ✓ WIRED | `queryKey: ['dashboard', tenantSlug, from.toISOString(), to.toISOString()]` |
| `app/[tenant-slug]/dashboard/page.tsx` | `lib/dashboard-kpis.ts` | `aggregateRollups`, `calcDelta`, `computeChannelSplit` | ✓ WIRED | Todos importados e usados no body do componente |
| `app/[tenant-slug]/dashboard/page.tsx` | `components/dashboard/channel-sheet.tsx` | `<ChannelSheet>` | ✓ WIRED | `<ChannelSheet channel={selectedChannel} channelRows={channelRows} tenantSlug={tenantSlug} onClose={...} />` |
| `app/[tenant-slug]/dashboard/page.tsx` | `selectedChannel` state | `onClick={(data) => setSelectedChannel(...)` no `<Pie>` | ✓ WIRED | `onClick={(data) => setSelectedChannel(data.name as 'Google Ads' \| 'Meta Ads')}` na linha 401 |
| `components/dashboard/channel-sheet.tsx` | `lib/hooks/use-campaigns-data.ts` | `useCampaignsData(tenantSlug)` | ✓ WIRED | Import + chamada no corpo do componente; filter por channel + sort + slice(0,5) |
| `lib/hooks/use-campaigns-data.ts` | `campaign_metrics` | `supabase.from('campaign_metrics').select` | ✓ WIRED | `from('campaign_metrics')` |
| `app/[tenant-slug]/campanhas/page.tsx` | `lib/campaign-aggregation.ts` | `groupCampaignMetrics` | ✓ WIRED | `groupCampaignMetrics(rawRows)` na linha 80 |
| `app/[tenant-slug]/campanhas/page.tsx` | `components/campanhas/campaign-sheet.tsx` | `<CampaignSheet>` | ✓ WIRED | `<CampaignSheet tenantSlug campaign={selected} onClose>` |
| `components/settings/meta-ads-form.tsx` | `/api/meta-ads/connect` | `fetch POST` | ✓ WIRED | `fetch('/api/meta-ads/connect', { method: 'POST', ... })` |
| `app/api/meta-ads/connect/route.ts` | `create_or_update_vault_secret` | `service.rpc(...)` | ✓ WIRED (pending DB apply) | `service.rpc('create_or_update_vault_secret', {...})` |
| `app/api/meta-ads/connect/route.ts` | `ad_accounts` | `service.from('ad_accounts').upsert` | ✓ WIRED | `service.from('ad_accounts').upsert({...}, { onConflict: 'tenant_id,channel' })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/[tenant-slug]/dashboard/page.tsx` | `data.current`, `data.prior` | `useDashboardData` → `daily_rollups` query | Sim — `from('daily_rollups').select(...).gte().lte()` + `Promise.all` | ✓ FLOWING |
| `components/dashboard/channel-sheet.tsx` (seção 1) | `channelRows` | Prop vinda de `data.current.filter(r => r.channel === channelKey)` no DashboardPage | Sim — derivado dos dados reais do useDashboardData, não hardcoded | ✓ FLOWING |
| `components/dashboard/channel-sheet.tsx` (seção 3) | `topCampaigns` | `useCampaignsData(tenantSlug)` → `campaign_metrics` → `groupCampaignMetrics` → filter + sort | Sim — query real em `campaign_metrics` + agregação JS | ✓ FLOWING |
| `app/[tenant-slug]/campanhas/page.tsx` | `campaigns` via `rawRows` | `useCampaignsData` → `campaign_metrics` | Sim — `from('campaign_metrics').select(...).gte().lte()` | ✓ FLOWING |
| `app/[tenant-slug]/settings/page.tsx` | `data.metaStatus`, `data.tenantId` | `useQuery` → `tenants` + `ad_accounts` queries | Sim — `from('ad_accounts').select('channel,active')` | ✓ FLOWING (write path pending migration apply) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 3 unit tests | `npm test -- date-range-store dashboard-kpis channel-split campaign-aggregation` | 51 passou | ✓ PASS |
| ChannelSheet critical checks | `node -e "...checks de strings críticas..."` no channel-sheet.tsx | OK — todos os 13 checks passaram | ✓ PASS |
| DashboardPage critical checks | `node -e "...checks de strings críticas..."` no dashboard/page.tsx | OK — todos os 8 checks passaram | ✓ PASS |
| KpiCard count = 7 | `grep '<KpiCard'` no dashboard/page.tsx | 7 invocações encontradas | ✓ PASS |
| Sem MOCK_ no dashboard | grep `MOCK_` em dashboard/page.tsx | Nenhum resultado | ✓ PASS |
| Sem MOCK_ nas campanhas | grep `MOCK_` em campanhas/page.tsx | Nenhum resultado (placeholder é só um atributo HTML) | ✓ PASS |
| disablePointerDismissal em ambos os Sheets | grep em campaign-sheet.tsx e channel-sheet.tsx | Encontrado em ambos | ✓ PASS |
| cursor pointer nos Cells do PieChart | grep `cursor` em dashboard/page.tsx | Linhas 403-404: ambos os `<Cell>` têm `style={{ cursor: 'pointer' }}` | ✓ PASS |
| Sem font-semibold no ChannelSheet | grep `font-semibold` em channel-sheet.tsx | Nenhum resultado | ✓ PASS |
| py-1 no ChannelBadge do ChannelSheet | grep `py-1` em channel-sheet.tsx | Linha 47: `px-2 py-1` | ✓ PASS |
| pt-6 nos separadores de seção | grep `pt-6` em channel-sheet.tsx | Linhas 219, 235: ambas as seções 2 e 3 usam `pt-6` | ✓ PASS |
| Sem token logging no route handler | grep `console.log.*token` em route.ts | Nenhum resultado | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Descrição | Status | Evidência |
|-------------|-------------|-----------|--------|-----------|
| DASH-01 | 03-03-PLAN | 7 KPI cards com deltas period-over-period | ✓ SATISFIED | 7 invocações `<KpiCard>` em dashboard/page.tsx; `calcDelta` usado para todos os 7; em-dash para pct null |
| DASH-02 | 03-03-PLAN | Trend charts (line, time-series) para o período selecionado | ✓ SATISFIED | AreaChart em dashboard/page.tsx com `trendData` pivotado de linhas google_ads/meta_ads |
| DASH-03 | 03-03-PLAN | Channel breakdown Google vs Meta em valores absolutos + % | ✓ SATISFIED | PieChart + legenda usando `computeChannelSplit`; mostra `brl(value)` e `pct%` |
| DASH-03-ext | 03-06-PLAN | Channel click drill-down via PieChart (ROADMAP SC3) | ✓ SATISFIED | `<ChannelSheet>` integrado; `onClick` no `<Pie>`; 3 seções implementadas; GAP-03-01 fechado |
| DASH-04 | 03-02-PLAN | Date range picker global com presets, default Last 30 dias | ✓ SATISFIED | `DateRangePicker` no header, 5 presets, store Zustand default `last30`, persiste via estado in-memory |
| CAMP-01 | 03-04-PLAN | Lista de campanhas com Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions | ✓ SATISFIED | campanhas/page.tsx renderiza todas as colunas de `AggregatedCampaign`; dados reais de `campaign_metrics` |
| CAMP-02 | 03-04-PLAN | Filtro por canal | ✓ SATISFIED | Tabs de filtro de canal (all/google_ads/meta_ads) operando sobre dados reais |
| CAMP-03 | 03-04-PLAN | Campanhas respeita o date range global | ✓ SATISFIED | queryKey do `useCampaignsData` inclui `from.toISOString()` + `to.toISOString()` — reativo ao store |
| CAMP-04 | 03-04-PLAN | Drill-down de campanha com trend lines | ✓ SATISFIED | `CampaignSheet` renderiza AreaChart por dia (Spend/ROAS/CTR) + tabela de totais; no-outside-close via `disablePointerDismissal` |
| SET-01 | 03-05-PLAN | Tenant Admin conecta Google Ads via OAuth2 | ✓ SATISFIED (deferido por plano) | Settings page mostra seção Google Ads como "Não configurado" com nota de deferimento conforme spec |
| SET-02 | 03-05-PLAN | Tenant Admin conecta Meta Ads via System User token | ✓ SATISFIED (UAT aprovado; migration pendente confirmar) | Route Handler valida token, grava no Vault, faz upsert em ad_accounts; UAT aprovado per 03-05-SUMMARY; migrations 0013+0014 committed |

### Anti-Patterns Found

| Arquivo | Linha | Pattern | Severidade | Impacto |
|---------|-------|---------|------------|---------|
| `app/[tenant-slug]/insights/page.tsx` | ~8, 162, 210 | `MOCK_INSIGHTS` ainda presente | ℹ Info | Escopo da Fase 4 — não é artefato da Fase 3 |

Nenhum anti-pattern encontrado nos artefatos da Fase 3 (dashboard, campanhas, settings, hooks, funções puras, ChannelSheet).

### Human Verification Required

#### 1. Confirmar estado das migrations 0013 e 0014 no Supabase remoto

**Teste:** Verificar no Supabase Dashboard (SQL Editor) se a função `create_or_update_vault_secret` existe com o grant correto.

```sql
-- Verificar existência da função
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_or_update_vault_secret';

-- Verificar grants (deve ter service_role, NÃO deve ter authenticated ou authenticator)
SELECT grantee, privilege_type FROM information_schema.routine_privileges
WHERE routine_name = 'create_or_update_vault_secret';
```

**Esperado:** Função existe; apenas `service_role` tem EXECUTE (migration 0014 revogou `authenticator`). A verificação anterior indicou que isso foi aplicado via SQL Editor em 2026-06-05 — confirmar que o estado persiste.

**Por que humano:** Acesso direto ao banco remoto requer credenciais; não é verificável programaticamente no ambiente de dev.

#### 2. UAT visual do ChannelSheet (GAP-03-01 closure)

**Teste:** Com `npm run dev`, logar como super_admin ou tenant_admin, navegar para `/[tenant-slug]/dashboard`, clicar no slice do PieChart de Google Ads e depois no de Meta Ads.

**Esperado:**
1. Clicar no slice abre Sheet lateral direito de 520px
2. Seção 1: AreaChart mostrando gasto diário do canal para o período selecionado
3. Seção 2: 6 métricas agregadas (Impressões, Cliques, CTR, Gasto, Conversões, ROAS)
4. Seção 3: Até 5 campanhas do canal ordenadas por spend (com skeleton enquanto carrega)
5. Clicar fora do Sheet: Sheet NÃO fecha
6. Pressionar Esc ou clicar no botão X: Sheet fecha
7. Empty state adequado quando canal não tem dados no período

**Por que humano:** Comportamento visual, interatividade do PieChart onClick, e comportamento de clique externo não são verificáveis programaticamente.

### Gaps Summary

Nenhum gap bloqueador remanescente. GAP-03-01 foi fechado pela Plan 06:

- `components/dashboard/channel-sheet.tsx` — criado com todas as 3 seções conforme spec
- `app/[tenant-slug]/dashboard/page.tsx` — modificado com onClick, selectedChannel state, CHANNEL_KEY_MAP, channelRows, e ChannelSheet integrado

Os únicos itens pendentes são verificações humanas de runtime (UAT visual e confirmação de estado do banco remoto), não gaps de implementação.

---

_Verified: 2026-06-05T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — após gap closure (Plan 06 / GAP-03-01)_
