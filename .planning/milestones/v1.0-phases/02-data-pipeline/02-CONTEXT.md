# Phase 2: Data Pipeline — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir o pipeline completo de dados de campanhas: schema do banco de dados (campaign_metrics, ad_accounts, sync_jobs, daily_rollups), workflows N8N para Google Ads e Meta Ads com sync agendado e multi-tenant, e visibilidade mínima do status de sync na UI. Esta fase NÃO inclui a dashboard UI de visualização (Fase 3) nem a Settings UI para conectar contas (Fase 3) — mas o schema criado aqui deve suportar ambas.

</domain>

<decisions>
## Implementation Decisions

### Schema: campaign_metrics (SYNC-01, SYNC-02, SYNC-05)

- **D-01:** Granularidade **day-level** — um registro por dia por campanha. Suficiente para todos os date presets da Fase 3 (Last 7/14/30, This Month, Last Month). Chave única: `(tenant_id, campaign_id, channel, date)`.
- **D-02:** **Tabela única unificada** — Google Ads e Meta Ads na mesma tabela `campaign_metrics`, diferenciados pela coluna `channel` (enum: `google_ads`, `meta_ads`). Queries cross-channel sem UNION ALL.
- **D-03:** Campos da tabela:
  ```sql
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id          uuid NOT NULL REFERENCES tenants(id)
  campaign_id        text NOT NULL          -- external ID da plataforma
  campaign_name      text NOT NULL
  channel            text NOT NULL CHECK (channel IN ('google_ads', 'meta_ads'))
  date               date NOT NULL
  impressions        bigint NOT NULL DEFAULT 0
  clicks             bigint NOT NULL DEFAULT 0
  spend              numeric(12,2) NOT NULL DEFAULT 0
  conversions        numeric(12,4) NOT NULL DEFAULT 0
  conversion_value   numeric(12,2) NOT NULL DEFAULT 0  -- para ROAS
  status             text                               -- ENABLED / PAUSED / REMOVED
  ad_group_id        text                               -- Google: ad group, Meta: adset
  attribution_window text NOT NULL DEFAULT '7d_click'  -- SYNC-05: nunca NULL
  synced_at          timestamptz NOT NULL DEFAULT now()
  created_at         timestamptz NOT NULL DEFAULT now()
  UNIQUE(tenant_id, campaign_id, channel, date)
  ```
  ROAS, CPA e CTR são **calculados nas queries** (não armazenados), mas `conversion_value` e `spend` devem sempre estar presentes.

### Schema: ad_accounts (credenciais de API por tenant)

- **D-04:** Tabela `ad_accounts` armazena credenciais de API por tenant. Em v1, Super Admin insere diretamente via Supabase Dashboard. A Settings UI (SET-01/SET-02) da Fase 3 irá popular essa mesma tabela.
- **D-05:** Tokens sensíveis armazenados no **Supabase Vault** (AES-256 em repouso). O N8N lê o token via `vault.decrypted_secrets()` antes de chamar a API.
- **D-06:** Estrutura da tabela:
  ```sql
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id        uuid NOT NULL REFERENCES tenants(id)
  channel          text NOT NULL CHECK (channel IN ('google_ads', 'meta_ads'))
  account_id       text NOT NULL   -- Google: customer_id (123-456-7890), Meta: ad_account_id
  vault_secret_id  uuid NOT NULL   -- referência ao secret no Supabase Vault
  refresh_token    text            -- Google Ads only (OAuth2 refresh token)
  token_expires_at timestamptz     -- Google Ads only
  active           boolean NOT NULL DEFAULT true
  created_at       timestamptz NOT NULL DEFAULT now()
  UNIQUE(tenant_id, channel)       -- um tenant tem uma conta por plataforma em v1
  ```

### Schema: sync_jobs (SYNC-04)

- **D-07:** Tabela `sync_jobs` registra cada execução de sync (sucesso e falha). Super Admin inspeciona via UI de Fase 2 (mínima) e Fase 3.
- **D-08:** Estrutura da tabela:
  ```sql
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       uuid NOT NULL REFERENCES tenants(id)
  channel         text NOT NULL CHECK (channel IN ('google_ads', 'meta_ads'))
  status          text NOT NULL CHECK (status IN ('running', 'success', 'failed'))
  started_at      timestamptz NOT NULL DEFAULT now()
  completed_at    timestamptz
  records_synced  integer DEFAULT 0
  date_from       date    -- período sincronizado
  date_to         date
  error_message   text    -- preenchido apenas em status='failed'
  created_at      timestamptz NOT NULL DEFAULT now()
  ```

### Schema: daily_rollups (pré-requisito para Fase 3)

- **D-09:** Tabela `daily_rollups` agrega `campaign_metrics` por `(tenant_id, channel, date)` — base das queries de KPI cards e trend lines da Fase 3.
- **D-10:** **Função Postgres chamada pelo N8N via PostgREST RPC** (`refresh_daily_rollups(tenant_id, date_from, date_to)`) após cada sync bem-sucedido. N8N chama via `POST /rest/v1/rpc/refresh_daily_rollups`.
- **D-11:** Estrutura da tabela:
  ```sql
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id           uuid NOT NULL REFERENCES tenants(id)
  channel             text NOT NULL  -- 'google_ads', 'meta_ads', ou 'all' para cross-channel
  date                date NOT NULL
  total_spend         numeric(12,2) NOT NULL DEFAULT 0
  total_impressions   bigint NOT NULL DEFAULT 0
  total_clicks        bigint NOT NULL DEFAULT 0
  total_conversions   numeric(12,4) NOT NULL DEFAULT 0
  total_conv_value    numeric(12,2) NOT NULL DEFAULT 0
  campaign_count      integer NOT NULL DEFAULT 0
  updated_at          timestamptz NOT NULL DEFAULT now()
  UNIQUE(tenant_id, channel, date)
  ```

### N8N: Arquitetura de Workflows (SYNC-01, SYNC-02, SYNC-06)

- **D-12:** **Um único workflow por plataforma** (não um por tenant). Dois workflows: "Google Ads Sync" e "Meta Ads Sync". Cada workflow itera sobre todos os tenants ativos em `ad_accounts`.
- **D-13:** Fluxo de cada workflow:
  1. Schedule trigger (Google: a cada 3h, Meta: a cada 6h)
  2. HTTP GET `ad_accounts?channel=google_ads&active=true` via PostgREST
  3. Loop por cada tenant — para cada um:
     a. Lê token do Vault via `rpc/read_vault_secret`
     b. Detecta se é primeira execução (backfill) ou sync incremental
     c. Chama API da plataforma
     d. Upsert em `campaign_metrics` via PostgREST
     e. Chama `rpc/refresh_daily_rollups`
     f. Grava resultado em `sync_jobs`
  4. Falha de um tenant → registra `status=failed` em `sync_jobs` + continua para próximo
- **D-14:** **API version como constante** no topo de cada workflow — uma só variável, nunca hardcoded inline (SYNC-06).
- **D-15:** N8N usa **HTTP Request node + PostgREST** exclusivamente para escrever no Supabase — nunca o node nativo Supabase (bug #17020).

### Backfill Retroativo

- **D-16:** **90 dias** de dados históricos no backfill inicial (cobre todos os presets de date range da Fase 3).
- **D-17:** **Automático na primeira execução** — workflow detecta que não há registros em `sync_jobs` para `(tenant_id, channel)` e executa backfill. Syncs subsequentes buscam apenas os últimos 2 dias (overlap para dados atrasados das plataformas).

### SYNC-03: Visibilidade do último sync na UI

- **D-18:** Em Fase 2, exibir **último sync por tenant por channel** numa seção mínima de status — pode ser na página `/tenants` (lista de tenants) ou numa rota dedicada `/sync-status` acessível apenas ao Super Admin. A decisão exata de componente/localização fica a critério do planner.

### Claude's Discretion

- Localização exata do componente de sync status na UI (dentro de `/tenants` ou rota separada)
- Estrutura dos campos calculados ROAS/CPA/CTR nas queries (view Postgres ou calculado no frontend)
- Nomes exatos das funções Postgres (refresh_daily_rollups, read_vault_secret, etc.)
- Estratégia de rate limiting das chamadas à API (Google Ads: 15k ops/dia, Meta: depende do tier)
- Estrutura exata do loop N8N (Split In Batches vs forEach manual)

</decisions>

<constraints>
## Constraints Locked from Prior Phases

Estes não são gray areas — estão bloqueados:

- **N8N → Supabase:** HTTP Request node + PostgREST REST API ONLY. Nunca usar o node nativo Supabase (GitHub bug #17020).
- **RLS:** Sempre `(SELECT get_tenant_id())` como wrapper — nunca chamada direta no USING clause.
- **`daily_rollups`:** Deve ser criada E populada nesta fase — Fase 3 depende dela para KPI cards.
- **`attribution_window`:** Coluna na tabela `campaign_metrics` desde o dia 1, nunca NULL — nenhuma migration posterior.
- **API version:** Constante por workflow, nunca hardcoded inline.
- **`super_admin`:** Stored in `auth.users.app_metadata`, não em `tenant_users`.

</constraints>

<canonical_refs>
## Canonical References

**Downstream agents MUST read before planning:**

### Supabase
- `.planning/phases/01-foundation/01-CONTEXT.md` — padrões RLS, helper functions, get_tenant_id()
- `supabase/migrations/` — schema existente (tenants, tenant_users, RLS policies)
- Supabase Vault docs: https://supabase.com/docs/guides/database/vault

### N8N
- STATE.md §"Key Decisions Locked" — restrição PostgREST + HTTP Request node
- N8N Supabase bug: https://github.com/n8n-io/n8n/issues/17020
- N8N self-hosted: https://evo.wrdigitalgroup.com.br (Queue Mode)

### Google Ads API
- API version: constante por workflow (ex: `v19`)
- Google Ads API docs: https://developers.google.com/google-ads/api/docs/start
- **Blocker:** Developer Token com Basic Access necessário — status desconhecido

### Meta Ads API
- API version: constante por workflow (ex: `v22.0`)
- Meta Ads API docs: https://developers.facebook.com/docs/marketing-api

### Requirements
- `.planning/REQUIREMENTS.md` §"Data Sync (N8N Integration)" — SYNC-01 a SYNC-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/` — 5 migrations existentes (Phase 1). Novas migrations para Phase 2 seguem o mesmo padrão de numeração.
- `lib/supabase/server.ts`, `lib/supabase/client.ts` — clientes Supabase já configurados
- `proxy.ts` — middleware de auth já lida com tenant context via JWT claims
- RLS helper `get_tenant_id()` — disponível para usar nas policies de `campaign_metrics`, `ad_accounts`, `sync_jobs`, `daily_rollups`

### New Tables Required
1. `campaign_metrics` — dados de campanha day-level
2. `ad_accounts` — credenciais de API por tenant (tokens no Vault)
3. `sync_jobs` — log de execuções de sync
4. `daily_rollups` — agregados por dia para Fase 3

### New N8N Workflows Required
1. Google Ads Sync (schedule: a cada 3h)
2. Meta Ads Sync (schedule: a cada 6h)

### Blocker Crítico
- **Google Ads Developer Token** não existe — Phase 2 NÃO pode ser executada até o Basic Access ser aprovado (2-10+ dias úteis). Submeter em: https://ads.google.com/aw/apicenter

</code_context>

<deferred>
## Deferred Ideas

- Granularidade por hora (hour-level) — over-engineering para v1, adicionar se análise intraday for necessária
- Múltiplos ad accounts por tenant — v1 assume uma conta Google e uma Meta por tenant
- Webhook de callback do N8N para o Next.js após sync — notificação em tempo real; polling de sync_jobs é suficiente para v1
- Cache layer (Redis/Upstash) para queries de daily_rollups — avaliar se latência de Postgres for inaceitável
- Retry automático com backoff exponencial em falha de API — N8N Community Edition tem retries nativos básicos

</deferred>

---

*Phase: 02-data-pipeline*
*Context gathered: 2026-05-16*
