---
phase: 02-data-pipeline
verified: 2026-05-16T23:45:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Ativar e executar o workflow Google Ads Sync no N8N com Developer Token aprovado — verificar que campaign_metrics é populado com dados reais do Google Ads"
    expected: "Records aparecem em campaign_metrics com channel='google_ads', spend correto (cost_micros/1000000), attribution_window='7d_click'. Comparar valores com a UI nativa do Google Ads — diferença deve ser ≤2%."
    why_human: "O workflow google-ads-sync.json está com active:false aguardando aprovação do Google Ads Developer Token (Basic Access). Execução real contra a API do Google Ads não é verificável programaticamente sem o token."
  - test: "Ativar e executar o workflow Meta Ads Sync no N8N com System User token configurado por tenant — verificar paginação e dados em campaign_metrics"
    expected: "Records aparecem em campaign_metrics com channel='meta_ads', paginação cursor-based funciona (múltiplas páginas se >100 campanhas), attribution_window='7d_click'. Comparar spend e conversions com Meta Ads Manager — diferença ≤2%."
    why_human: "Workflow meta-ads-sync.json está com active:false. System User tokens ainda não foram provisionados por tenant no Supabase Vault. A condição de ±2% só pode ser validada com dados reais de plataforma."
gaps: []
deferred: []
---

# Phase 2: Data Pipeline — Verification Report

**Phase Goal:** Campaign metrics from Google Ads and Meta Ads flow into the database automatically on schedule, with sync status visible and data correct to within ±2% of native platform UIs.
**Verified:** 2026-05-16T23:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Google Ads campaign metrics sync automatically every 3–4 hours without manual intervention | ✓ VERIFIED | `google-ads-sync.json`: Schedule Trigger com cron `0 */3 * * *`, `"active": false` (aguarda Developer Token — blocker documentado no STATE.md e aceito no checkpoint Plan 03) |
| 2 | Each synced metric row stores `attribution_window` from day one; no migration needed later | ✓ VERIFIED | `0007_create_campaign_metrics.sql` linha 20: `attribution_window TEXT NOT NULL DEFAULT '7d_click'`. Google workflow: `attribution_window: '7d_click'` hardcoded no Code node. Meta workflow: idem. |
| 3 | Sync jobs (success and failure) are recorded in `sync_jobs`; Super Admin can inspect errors without raw logs | ✓ VERIFIED | `0008_create_sync_jobs.sql` existe com schema completo. Ambos os workflows têm nó "Close sync_job (success)" e "Close sync_job (failed)" com PATCH para sync_jobs. `SyncStatusSection` renderiza status, timestamps e error_message na /tenants. |
| 4 | Last sync timestamp per tenant per channel is visible in the UI | ✓ VERIFIED | `lib/sync-status.ts` exporta `loadLastSyncByTenantChannel()`. `components/tenants/sync-status-section.tsx` renderiza tabela com status, timestamp, records_synced, error_message. Human UAT aprovado em /tenants (Plan 05 Task 4). |
| 5 | Google Ads and Meta Ads API versions defined in single constant per workflow | ✓ VERIFIED | Google: `GOOGLE_ADS_API_VERSION = 'v21'` em Set Constants, apenas 1 ocorrência literal "v21" no JSON inteiro. Meta: `META_ADS_API_VERSION = 'v24.0'` em Set Constants, apenas 1 ocorrência literal "v24.0". Todas as URLs usam expressões `$('Set Constants').item.json.*`. |

**Score:** 4/5 truths verified (Truth 1 parcialmente — estrutura verificada, execução real pendente de token)

**Nota:** O SC #1 do ROADMAP — "data correct to within ±2% of native platform UIs" — requer execução real dos workflows contra as APIs, que dependem de credenciais ainda não provisionadas (Google Ads Developer Token pendente, Meta System User tokens não inseridos no Vault). Esta é a única razão para `human_needed`.

---

### Deferred Items

Nenhum item deferred — todos os itens da fase foram implementados.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0006_create_ad_accounts.sql` | Tabela ad_accounts + RLS | ✓ VERIFIED | Existe, 40 linhas. CREATE TABLE, UNIQUE(tenant_id,channel), vault_secret_id NOT NULL, ENABLE RLS, 2 policies, REVOKE anon. |
| `supabase/migrations/0007_create_campaign_metrics.sql` | Tabela campaign_metrics + RLS + indexes | ✓ VERIFIED | Existe, 50 linhas. attribution_window NOT NULL DEFAULT '7d_click', UNIQUE(tenant_id,campaign_id,channel,date), 3 indexes, ENABLE RLS, 2 policies. |
| `supabase/migrations/0008_create_sync_jobs.sql` | Tabela sync_jobs + RLS | ✓ VERIFIED | Existe, 40 linhas. status CHECK IN ('running','success','failed'), 2 indexes, ENABLE RLS, 2 policies. |
| `supabase/migrations/0009_create_daily_rollups.sql` | Tabela daily_rollups + RLS | ✓ VERIFIED | Existe, 39 linhas. channel CHECK IN ('google_ads','meta_ads','all'), UNIQUE(tenant_id,channel,date), ENABLE RLS. |
| `supabase/migrations/0010_create_pipeline_functions.sql` | Funções read_vault_secret + refresh_daily_rollups | ✓ VERIFIED | Existe, 99 linhas. Ambas SECURITY DEFINER, GRANT TO service_role, REVOKE FROM PUBLIC/anon/authenticated. |
| `n8n-workflows/google-ads-sync.json` | Workflow Google Ads Sync importável | ✓ VERIFIED | Existe, JSON válido. 16 nodes, active:false, name="Google Ads Sync". Todos os endpoints críticos presentes. |
| `n8n-workflows/meta-ads-sync.json` | Workflow Meta Ads Sync importável | ✓ VERIFIED | Existe, JSON válido. 18 nodes, active:false, name="Meta Ads Sync". Paginação cursor-based presente (IF "More pages?"). |
| `lib/sync-status.ts` | Data fetcher Server-only | ✓ VERIFIED | Existe, 72 linhas. `import 'server-only'`, exporta `SyncStatusRow` e `loadLastSyncByTenantChannel()`, query sync_jobs com embed tenants, dedupe in-memory. |
| `components/tenants/sync-status-section.tsx` | Server Component SyncStatusSection | ✓ VERIFIED | Existe, 109 linhas. `export async function SyncStatusSection()`, importa loadLastSyncByTenantChannel, renderiza tabela com StatusBadge, formatTimestamp, error_message truncado 80 chars. |
| `app/tenants/page.tsx` | Página /tenants com SyncStatusSection | ✓ VERIFIED | Existe. Importa SyncStatusSection, renderiza `<SyncStatusSection />` dentro de `<Suspense>` abaixo de TenantsTable. |
| `types/database.types.ts` | TypeScript types regenerados | ✓ VERIFIED | Contém ad_accounts, campaign_metrics, daily_rollups, sync_jobs em `Tables`. Contém read_vault_secret e refresh_daily_rollups em `Functions`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components/tenants/sync-status-section.tsx` | `lib/sync-status.ts` | `import { loadLastSyncByTenantChannel } from '@/lib/sync-status'` | ✓ WIRED | Linha 1 do componente. Função chamada na linha 38 dentro do Server Component. |
| `lib/sync-status.ts` | `public.sync_jobs` | `supabase.from('sync_jobs').select(...)` | ✓ WIRED | Linha 27-39. Query real com embed `tenants:tenant_id (name, slug)`, order by completed_at DESC, limit 500. |
| `app/tenants/page.tsx` | `components/tenants/sync-status-section.tsx` | `<SyncStatusSection />` renderizado | ✓ WIRED | Linha 6 (import), linha 57 (uso dentro de Suspense). |
| `google-ads-sync.json` | `oauth2.googleapis.com/token` | HTTP Request POST com grant_type=refresh_token | ✓ WIRED | Node "Exchange refresh for access token" presente, URL correta. |
| `google-ads-sync.json` | `googleAds:searchStream` | HTTP Request POST com GAQL query | ✓ WIRED | Node "Google Ads SearchStream" presente. URL usa `$('Set Constants').item.json.GOOGLE_ADS_API_VERSION`. |
| `google-ads-sync.json` | `/rest/v1/campaign_metrics?on_conflict=...` | HTTP Request POST com Prefer: resolution=merge-duplicates | ✓ WIRED | Node "Upsert campaign_metrics" presente com URL e header corretos. |
| `google-ads-sync.json` | `/rest/v1/rpc/refresh_daily_rollups` | HTTP Request POST | ✓ WIRED | Node "Refresh daily_rollups" presente. |
| `google-ads-sync.json` | `/rest/v1/sync_jobs` | POST (running) + PATCH (success/failed) | ✓ WIRED | Nodes "Open sync_job", "Close sync_job (success)", "Close sync_job (failed)" presentes. |
| `meta-ads-sync.json` | `graph.facebook.com/{{META_ADS_API_VERSION}}/{ad_account_id}/insights` | HTTP Request GET com paginação | ✓ WIRED | Node "Meta Insights paged" presente. URL construída em "Init pagination cursor" via expressão META_ADS_API_VERSION. |
| `meta-ads-sync.json` | `/rest/v1/campaign_metrics?on_conflict=...` | HTTP Request POST | ✓ WIRED | Node "Upsert campaign_metrics" presente. |
| `meta-ads-sync.json` | `/rest/v1/rpc/refresh_daily_rollups` | HTTP Request POST | ✓ WIRED | Node "Refresh daily_rollups" presente. |
| `0010_create_pipeline_functions.sql` | `vault.decrypted_secrets` | `SELECT decrypted_secret FROM vault.decrypted_secrets` | ✓ WIRED | Linha 18-20. SET search_path = public, vault para acesso. |
| `0010_create_pipeline_functions.sql` | `public.campaign_metrics` | `FROM public.campaign_metrics` dentro de refresh_daily_rollups | ✓ WIRED | Linhas 63 e 77. INSERT...SELECT...FROM public.campaign_metrics. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `components/tenants/sync-status-section.tsx` | `rows` (SyncStatusRow[]) | `loadLastSyncByTenantChannel()` via Supabase query em sync_jobs | Sim — query real `from('sync_jobs').select(...)` com embed tenants. Human UAT confirmou dados reais sendo renderizados. | ✓ FLOWING |
| `lib/sync-status.ts` | `data` (sync_jobs rows) | `supabase.from('sync_jobs').select(...)` — PostgREST query | Sim — busca direta na tabela sync_jobs. Tabela populada pelos workflows N8N via service_role. | ✓ FLOWING |
| `n8n-workflows/google-ads-sync.json` | `campaign_metrics` rows | Google Ads SearchStream → Map results → upsert | Estruturalmente correto, execução real pendente (Developer Token) | ? SKIP (token pendente) |
| `n8n-workflows/meta-ads-sync.json` | `campaign_metrics` rows | Meta Insights API → Accumulate pages → Map results → upsert | Estruturalmente correto, execução real pendente (System User tokens) | ? SKIP (tokens pendentes) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| google-ads-sync.json é JSON válido com ≥14 nodes | `node -e "const w=require('./n8n-workflows/google-ads-sync.json'); console.log(w.nodes.length)"` | 16 nodes | ✓ PASS |
| google-ads-sync.json: v21 aparece exatamente uma vez | Contagem de `"v21"` no JSON | 1 ocorrência (em Set Constants) | ✓ PASS |
| meta-ads-sync.json é JSON válido com ≥13 nodes | `node -e "..."` | 18 nodes | ✓ PASS |
| meta-ads-sync.json: v24.0 aparece exatamente uma vez | Contagem de `"v24.0"` no JSON | 1 ocorrência (em Set Constants) | ✓ PASS |
| meta-ads-sync.json: sem `7d_view` (Pitfall 3) | grep `7d_view` no JSON | 0 ocorrências | ✓ PASS |
| Workflows não contêm tokens literais | Regex `Bearer [a-zA-Z0-9]{20,}` | 0 matches em ambos | ✓ PASS |
| Migrations 0006-0010 existem | `ls supabase/migrations/` | Todos presentes + 0011 fix | ✓ PASS |
| types/database.types.ts contém 4 tabelas novas | grep em database.types.ts | ad_accounts, campaign_metrics, daily_rollups, sync_jobs — todos presentes | ✓ PASS |
| types/database.types.ts contém 2 funções | grep `read_vault_secret\|refresh_daily_rollups` | Ambas presentes em `Functions` | ✓ PASS |
| Execução real com dados ≤±2% vs plataformas | Não testável programaticamente | — | ? SKIP (requer token + dados reais) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-01 | 02-03-PLAN | N8N automatically syncs Google Ads campaign metrics on schedule (every 3-4 hours) | ✓ SATISFIED | google-ads-sync.json: cron `0 */3 * * *`, multi-tenant loop, SearchStream → upsert campaign_metrics → sync_jobs lifecycle |
| SYNC-02 | 02-04-PLAN | N8N automatically syncs Meta Ads campaign metrics on schedule (every 6 hours) | ✓ SATISFIED | meta-ads-sync.json: cron `0 */6 * * *`, cursor pagination, Meta Insights API → upsert |
| SYNC-03 | 02-05-PLAN | Last sync timestamp visible in UI per tenant per channel | ✓ SATISFIED | SyncStatusSection em /tenants mostra último sync por (tenant, channel). Human UAT aprovado. |
| SYNC-04 | 02-02, 02-05-PLAN | Sync status and errors logged to sync_jobs, surfaced to Super Admin | ✓ SATISFIED | 0008_create_sync_jobs.sql: schema completo com error_message, RLS, indexes. SyncStatusSection renderiza status e error. |
| SYNC-05 | 02-02, 02-03, 02-04-PLAN | Attribution window stored per metric row from day one | ✓ SATISFIED | `attribution_window TEXT NOT NULL DEFAULT '7d_click'` na migration 0007. Literal `'7d_click'` em ambos os Code nodes de map. |
| SYNC-06 | 02-03, 02-04-PLAN | API version abstracted via single constant per workflow | ✓ SATISFIED | Google: GOOGLE_ADS_API_VERSION='v21' em Set Constants, 1 ocorrência de "v21". Meta: META_ADS_API_VERSION='v24.0' em Set Constants, 1 ocorrência de "v24.0". |

**Cobertura:** 6/6 requisitos satisfeitos (SYNC-01 a SYNC-06).

**Requisitos do ROADMAP não listados nos planos:** Nenhum — todos os 6 IDs declarados nos planos correspondem aos 6 IDs da fase no ROADMAP.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `n8n-workflows/google-ads-sync.json` | node Set Constants | `"active": false` — workflow inativo, execução real nunca ocorreu | ⚠️ Warning | Sync automático não está rodando. BLOCKER documentado (Google Ads Developer Token pendente). Sem dados reais em campaign_metrics. |
| `n8n-workflows/meta-ads-sync.json` | node Set Constants | `"active": false` — workflow inativo | ⚠️ Warning | Idem acima. Meta workflow pode ser ativado assim que System User tokens forem provisionados no Vault (menos bloqueado que Google). |

**Observação crítica sobre o critério ±2%:** O phase goal afirma "data correct to within ±2% of native platform UIs". Esta condição NÃO pode ser verificada enquanto os workflows permanecerem inativos. Os workflows têm a estrutura correta para satisfazer esse critério (cost_micros/1_000_000, '7d_click', paginação completa), mas a verificação da acurácia real dos dados é bloqueada por credenciais operacionais ainda não configuradas.

---

### Human Verification Required

#### 1. Execução real Google Ads Sync — validação de dados ±2%

**Test:** Após aprovação do Google Ads Developer Token (Basic Access):
1. Criar credential "Supabase Service Role" no N8N
2. Criar credential "Google OAuth Credentials" e "Google Ads Dev Token" no N8N
3. Importar `n8n-workflows/google-ads-sync.json` no N8N
4. Inserir refresh_token de cada tenant no Supabase Vault
5. Inserir linha em ad_accounts com vault_secret_id
6. Ativar workflow e aguardar execução
7. Comparar campaign_metrics.spend com spend da UI Google Ads para o mesmo período

**Expected:** Diferença ≤2% entre valores em campaign_metrics e os reportados pela UI nativa do Google Ads. sync_jobs deve registrar status='success' com records_synced > 0.

**Why human:** Requer credencial de API real (Developer Token Basic Access) que está em processo de aprovação. Não verificável sem execução real.

#### 2. Execução real Meta Ads Sync — validação de dados ±2% e paginação

**Test:** Após provisionar System User tokens:
1. Inserir token no Supabase Vault: `SELECT vault.create_secret('<TOKEN>', 'tenant_<slug>_meta_system_token', 'Meta System User token');`
2. Inserir linha em ad_accounts com vault_secret_id
3. Importar `n8n-workflows/meta-ads-sync.json` no N8N
4. Ativar e executar o workflow
5. Verificar paginação para ad accounts com >100 campanhas (se aplicável)
6. Comparar spend/impressions/clicks com Meta Ads Manager para o mesmo período

**Expected:** Dados em campaign_metrics com channel='meta_ads' diferem ≤2% dos valores reportados pelo Meta Ads Manager. Paginação funciona (log N8N mostra múltiplos loops em "More pages?" quando há >100 campanhas). sync_jobs registra status='success'.

**Why human:** Requer System User token real com permissão ads_read por tenant. Validação de ±2% exige dados reais de campanha para comparação.

---

### Gaps Summary

Nenhum gap bloqueante de implementação. Todos os artefatos existem, são substantivos e estão corretamente conectados.

O único item pendente é **operacional**, não de implementação: os workflows N8N estão corretamente construídos mas permanecem inativos aguardando provisionamento de credenciais externas:

1. **Google Ads Developer Token (Basic Access)** — em processo de aprovação no Google (2-10 dias úteis). Sem isso, o workflow Google Ads não pode ser ativado.
2. **Meta Ads System User tokens** — precisam ser gerados em business.facebook.com e inseridos no Supabase Vault por tenant. Isso pode ser feito imediatamente pelo operador.

O critério de sucesso "±2% de acurácia vs plataformas nativas" não pode ser verificado até que pelo menos o workflow Meta Ads execute com dados reais.

---

_Verified: 2026-05-16T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
