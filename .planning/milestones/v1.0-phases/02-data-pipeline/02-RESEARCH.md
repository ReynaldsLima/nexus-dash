# Phase 2: Data Pipeline — Research

**Researched:** 2026-05-16
**Domain:** Google Ads API REST, Meta Marketing API, N8N workflows, Supabase PostgREST/Vault, Postgres RLS
**Confidence:** MEDIUM-HIGH (APIs verificados via docs oficiais; padrões N8N verificados via community + docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Granularidade day-level — chave única `(tenant_id, campaign_id, channel, date)`.
- **D-02:** Tabela única `campaign_metrics` com coluna `channel` enum (`google_ads`, `meta_ads`).
- **D-03:** Schema completo de `campaign_metrics` definido (ver CONTEXT.md §D-03).
- **D-04/D-05/D-06:** Tabela `ad_accounts` com tokens sensíveis no Supabase Vault.
- **D-07/D-08:** Tabela `sync_jobs` registra execuções de sync (sucesso e falha).
- **D-09/D-10/D-11:** Tabela `daily_rollups` populada via RPC Postgres chamado pelo N8N.
- **D-12:** Um workflow por plataforma (não um por tenant); itera sobre tenants via loop.
- **D-13:** Fluxo completo de cada workflow definido (ver CONTEXT.md §D-13).
- **D-14:** API version como constante por workflow — nunca hardcoded inline.
- **D-15:** N8N usa HTTP Request node + PostgREST EXCLUSIVAMENTE — nunca node nativo Supabase (bug #17020).
- **D-16:** Backfill de 90 dias de dados históricos.
- **D-17:** Backfill automático na primeira execução; syncs subsequentes buscam últimos 2 dias.
- **D-18:** Último sync por tenant por channel exibido numa seção mínima de status na UI.

### Claude's Discretion

- Localização exata do componente de sync status na UI (dentro de `/tenants` ou rota separada `/sync-status`).
- Estrutura dos campos calculados ROAS/CPA/CTR nas queries (view Postgres ou calculado no frontend).
- Nomes exatos das funções Postgres (`refresh_daily_rollups`, `read_vault_secret`, etc.).
- Estratégia de rate limiting das chamadas à API.
- Estrutura exata do loop N8N (Split In Batches vs forEach manual).

### Deferred Ideas (OUT OF SCOPE)

- Granularidade por hora (hour-level).
- Múltiplos ad accounts por tenant.
- Webhook de callback do N8N para o Next.js após sync.
- Cache layer (Redis/Upstash) para queries de `daily_rollups`.
- Retry automático com backoff exponencial em falha de API.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | N8N sincroniza Google Ads automaticamente a cada 3-4h | Google Ads API REST v21+, Schedule Trigger cron, OAuth2 refresh flow documentados |
| SYNC-02 | N8N sincroniza Meta Ads automaticamente a cada 6h | Meta Marketing API v24+, System User token (sem expiração fixa), Insights endpoint documentado |
| SYNC-03 | Último sync timestamp visível na UI por tenant/channel | Query Server Component em `sync_jobs` — padrão já estabelecido em `/tenants` page |
| SYNC-04 | Status e erros de sync gravados em `sync_jobs` e visíveis ao Super Admin | Schema da tabela + RLS + query definidos |
| SYNC-05 | `attribution_window` armazenado por linha de métrica desde o dia 1 | Meta mudou attribution API em Jan 2026 — detalhes documentados em Pitfall 6 |
| SYNC-06 | API version abstraída via constante única por workflow | Padrão documentado em §Architecture Patterns — Constant Pattern |
</phase_requirements>

---

## Summary

A Fase 2 envolve três domínios técnicos distintos: (1) chamadas às APIs do Google Ads e Meta Ads para buscar métricas de campanha, (2) pipelines N8N com schedule trigger, loop multi-tenant, e upserts PostgREST no Supabase, e (3) migrations Postgres para quatro novas tabelas com RLS adequado.

O blocker crítico permanece: **Google Ads Developer Token com Basic Access ainda não existe**. Sem ele, nenhuma chamada ao Google Ads API pode ser feita. O plano deve separar as tarefas de Google Ads das de Meta Ads para permitir progresso independente. A N8N usa Queue Mode (main = triggers + editor, workers = execuções), o que é compatível com o uso de Schedule Trigger sem alterações especiais.

Duas mudanças de API descobertas na pesquisa afetam diretamente esta fase: (1) **Google Ads API v19 foi descontinuada em fev/2026** — o código deve ser escrito para v21 ou superior; (2) **Meta Marketing API v22 será descontinuada em junho/2026** — o código deve usar v24 ou superior.

**Recomendação primária:** Usar Google Ads API v21 (constante `GOOGLE_ADS_API_VERSION = 'v21'`) e Meta Marketing API v24 (constante `META_ADS_API_VERSION = 'v24.0'`). Os schemas de banco de dados e os workflows N8N são os deliverables principais desta fase; as chamadas às APIs externas dependem de credenciais que ainda precisam ser provisionadas.

---

## Standard Stack

### Core (para esta fase)

| Componente | Versão/Spec | Propósito | Justificativa |
|------------|-------------|-----------|---------------|
| Google Ads API REST | v21 | Buscar métricas de campanha (Search/SearchStream) | v19 descontinuada fev/2026; v21 suportada até ~jan/2027 [VERIFIED: ppc.land] |
| Meta Marketing API | v24.0 | Buscar insights de campanha | v22 descontinuada jun/2026; v24 é mínimo seguro [VERIFIED: developers.facebook.com changelog] |
| N8N Schedule Trigger | nativo | Cron `0 */3 * * *` (Google) e `0 */6 * * *` (Meta) | Node nativo do N8N, sem dependência externa [VERIFIED: docs.n8n.io] |
| N8N HTTP Request node | nativo | Todas as chamadas ao Supabase PostgREST | Mandatório — bug #17020 proíbe node nativo Supabase [LOCKED DECISION] |
| N8N Loop Over Items (Split In Batches) | nativo | Iteração por tenant no loop principal | Padrão oficial N8N para processar arrays de itens [VERIFIED: docs.n8n.io] |
| Supabase PostgREST | REST API /rest/v1/ | Upsert de métricas, leitura de ad_accounts, chamadas RPC | Único canal autorizado para N8N → Supabase [LOCKED DECISION] |
| Supabase Vault | extensão pgsodium | Armazenamento AES-256 de tokens OAuth2 e System User | Encrypted at rest, decrypted apenas em query time [VERIFIED: supabase.com/docs] |
| OAuth2 token refresh | Google token endpoint | Renovar access_token Google Ads a cada hora | Access tokens expiram em 3600s; refresh_token é persistente [VERIFIED: developers.google.com] |

### Sem novas dependências npm necessárias para esta fase

Esta fase é predominantemente Postgres migrations + N8N workflow JSON. Nenhum novo pacote npm é necessário para o Next.js — apenas a query `sync_jobs` no Server Component existente em `/tenants`.

---

## Architecture Patterns

### Recomended Project Structure (novos arquivos)

```
supabase/
└── migrations/
    ├── 0006_create_ad_accounts.sql         # tabela ad_accounts + RLS
    ├── 0007_create_campaign_metrics.sql     # tabela campaign_metrics + RLS + indexes
    ├── 0008_create_sync_jobs.sql            # tabela sync_jobs + RLS
    ├── 0009_create_daily_rollups.sql        # tabela daily_rollups + RLS
    └── 0010_create_pipeline_functions.sql   # read_vault_secret() + refresh_daily_rollups()

n8n-workflows/
├── google-ads-sync.json                     # workflow exportado do N8N
└── meta-ads-sync.json                       # workflow exportado do N8N

app/
└── tenants/
    └── page.tsx                             # adicionar seção SyncStatusSection (Server Component)
```

### Padrão 1: Google Ads API — Refresh Token Flow (não-interativo)

**O que é:** A cada execução do workflow, o N8N primeiro troca o `refresh_token` por um novo `access_token`, depois usa o `access_token` (válido por 1h) para chamar a API.

**Por que necessário:** O Google Ads API usa OAuth2 — não há token eterno. O `refresh_token` é persistente (salvo no Vault), mas o `access_token` expira em 3600s.

**Fluxo no workflow N8N:**
```
[Ler refresh_token do Vault via RPC]
  → [POST https://oauth2.googleapis.com/token]
      Body: grant_type=refresh_token&client_id=...&client_secret=...&refresh_token=...
      Content-Type: application/x-www-form-urlencoded
  → [Extrair access_token da resposta]
  → [Usar access_token nas chamadas subsequentes à Google Ads API]
```

**Resposta do token endpoint:** [VERIFIED: developers.google.com/identity/protocols/oauth2]
```json
{
  "access_token": "ya29.new_token_value",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Cabeçalhos para chamadas Google Ads API:** [VERIFIED: developers.google.com/google-ads/api/rest/auth]
```
Authorization: Bearer {access_token}
developer-token: {DEVELOPER_TOKEN}
login-customer-id: {MANAGER_ACCOUNT_ID}   ← obrigatório se usar MCC (Manager Account)
Content-Type: application/json
```

### Padrão 2: Google Ads API — GAQL Query via SearchStream

**Endpoint:** `POST https://googleads.googleapis.com/v21/customers/{customer_id}/googleAds:searchStream`

**Request body:** [VERIFIED: developers.google.com/google-ads/api/rest/common/search]
```json
{
  "query": "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, segments.date FROM campaign WHERE segments.date BETWEEN '2026-04-01' AND '2026-05-01' AND campaign.status != 'REMOVED' ORDER BY segments.date ASC"
}
```

**Campos exatos disponíveis:** [VERIFIED: developers.google.com/google-ads/api/fields/v19/metrics + query cookbook]

| Campo GAQL | Tipo | Notas |
|-----------|------|-------|
| `campaign.id` | string | ID numérico como string |
| `campaign.name` | string | Nome da campanha |
| `campaign.status` | enum | `ENABLED`, `PAUSED`, `REMOVED` |
| `metrics.impressions` | int64 | Impressões brutas |
| `metrics.clicks` | int64 | Cliques |
| `metrics.cost_micros` | int64 | Custo em micros (÷1.000.000 = valor real) |
| `metrics.conversions` | double | Conversões (inclui modeladas) |
| `metrics.conversions_value` | double | Valor das conversões para ROAS |
| `metrics.all_conversions_value` | double | Alternativa mais ampla — inclui cross-device |
| `segments.date` | date (YYYY-MM-DD) | Data do segmento — obrigatório para day-level |
| `ad_group.id` | string | ID do Ad Group (para coluna `ad_group_id`) |

**Resposta SearchStream:** Array JSON (sem paginação necessária — retorna tudo de uma vez).
```json
[
  {
    "results": [
      {
        "campaign": { "id": "123456789", "name": "Campanha Teste", "status": "ENABLED" },
        "metrics": {
          "impressions": "15000",
          "clicks": "450",
          "costMicros": "12500000",
          "conversions": 12.5,
          "conversionsValue": 3750.0
        },
        "segments": { "date": "2026-05-15" }
      }
    ]
  }
]
```

**Nota importante:** Os campos na resposta JSON são camelCase (ex: `costMicros`), mas os campos na query GAQL são snake_case com ponto (ex: `metrics.cost_micros`). O N8N precisa fazer a conversão ao montar o upsert.

### Padrão 3: Meta Marketing API — Insights via GET

**Endpoint (account-level com level=campaign):**
```
GET https://graph.facebook.com/v24.0/act_{AD_ACCOUNT_ID}/insights
  ?level=campaign
  &fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values,reach,date_start,date_stop
  &time_range={"since":"2026-04-01","until":"2026-05-01"}
  &time_increment=1
  &limit=100
  &access_token={SYSTEM_USER_TOKEN}
```

**Campos disponíveis (Insights API):** [VERIFIED: get-ryze.ai + developers.facebook.com/docs/marketing-api/insights]

| Campo Meta | Tipo | Mapeia para |
|-----------|------|------------|
| `campaign_id` | string | `campaign_id` |
| `campaign_name` | string | `campaign_name` |
| `impressions` | string (número) | `impressions` |
| `clicks` | string (número) | `clicks` |
| `spend` | string (decimal) | `spend` |
| `actions` | array de objetos | filtrar por `action_type: "purchase"` para `conversions` |
| `action_values` | array de objetos | filtrar por `action_type: "purchase"` para `conversion_value` |
| `date_start` | string YYYY-MM-DD | `date` |
| `date_stop` | string YYYY-MM-DD | ignorar (igual a date_start com time_increment=1) |

**Estrutura de `actions` / `action_values`:**
```json
{
  "actions": [
    { "action_type": "purchase", "value": "45" },
    { "action_type": "lead", "value": "120" }
  ],
  "action_values": [
    { "action_type": "purchase", "value": "12500.00" }
  ]
}
```
O N8N precisa extrair o objeto com `action_type == "purchase"` para obter conversions e conversion_value.

**Token Meta — System User (sem expiração por tempo):** [VERIFIED: developers.facebook.com/documentation/facebook-login/guides/access-tokens]
> "apps with access standard to the Marketing API receive long-lived tokens that do not expire based on time, although they remain subject to invalidation for other reasons."

System User tokens são gerados em Business Settings → System Users → Generate token. Não requerem refresh periódico — mas podem ser invalidados se as permissões forem alteradas ou se a app for removida do Business Manager.

**Rate limits Meta API (Insights):** [VERIFIED: get-ryze.ai docs]
- 5 requisições síncronas de insights por minuto por ad account
- Para 1-3 tenants e uma chamada de backfill de 90 dias: chamar com `time_increment=1` retorna todos os dias em uma única chamada (response paginada por cursor)

**Paginação Meta:** O response inclui `paging.cursors.after`. Quando há mais páginas, o N8N precisa seguir o cursor até que `paging.next` não exista.

### Padrão 4: Supabase PostgREST — Upsert via HTTP Request node

**URL:** `https://{SUPABASE_PROJECT_ID}.supabase.co/rest/v1/campaign_metrics?on_conflict=tenant_id,campaign_id,channel,date`

**Método:** `POST`

**Cabeçalhos obrigatórios:** [VERIFIED: docs.postgrest.org/en/v12/references/api/tables_views.html]
```
Content-Type: application/json
apikey: {SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Prefer: resolution=merge-duplicates
```

**Body:** Array JSON com os registros a fazer upsert:
```json
[
  {
    "tenant_id": "uuid-do-tenant",
    "campaign_id": "123456789",
    "campaign_name": "Campanha Teste",
    "channel": "google_ads",
    "date": "2026-05-15",
    "impressions": 15000,
    "clicks": 450,
    "spend": 12.50,
    "conversions": 12.5,
    "conversion_value": 3750.00,
    "status": "ENABLED",
    "ad_group_id": "987654321",
    "attribution_window": "7d_click",
    "synced_at": "2026-05-16T10:30:00Z"
  }
]
```

**Nota sobre service_role:** A chave service_role **bypassa RLS completamente**. [VERIFIED: supabase.com/docs/guides/database/postgres/row-level-security]
Isso é seguro para N8N server-side porque: (1) a chave está no Vault ou nas env vars do N8N VPS, (2) o N8N está em rede privada, (3) nunca é exposta ao client browser.

### Padrão 5: PostgREST RPC — Chamar funções Postgres

**URL:** `https://{SUPABASE_PROJECT_ID}.supabase.co/rest/v1/rpc/{function_name}`

**Método:** `POST`

**Cabeçalhos:**
```
Content-Type: application/json
apikey: {SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Body (parâmetros da função como JSON):** [VERIFIED: docs.postgrest.org/en/latest/references/api/functions.html]
```json
{ "p_tenant_id": "uuid-do-tenant", "p_date_from": "2026-04-01", "p_date_to": "2026-05-15" }
```

**Exemplo — chamar `refresh_daily_rollups`:**
```
POST /rest/v1/rpc/refresh_daily_rollups
Body: { "p_tenant_id": "...", "p_date_from": "2026-04-01", "p_date_to": "2026-05-16" }
```

**Exemplo — chamar `read_vault_secret`:**
```
POST /rest/v1/rpc/read_vault_secret
Body: { "p_secret_name": "tenant_acme_google_ads_token" }
```

### Padrão 6: Supabase Vault — Armazenamento e leitura de tokens

**Inserir secret (via SQL, feito manualmente pelo Super Admin no Supabase Dashboard):** [VERIFIED: supabase.com/docs/guides/database/vault]
```sql
SELECT vault.create_secret(
  'ya29.google_refresh_token_value',  -- o valor do secret
  'tenant_acme_google_refresh_token', -- nome único (para lookup pelo N8N)
  'Google Ads refresh token para tenant Acme Corp'
);
-- Retorna: uuid do secret (armazenar em ad_accounts.vault_secret_id)
```

**Leitura via função RPC (chamada pelo N8N):**
```sql
-- Função a criar na migration:
CREATE OR REPLACE FUNCTION public.read_vault_secret(p_secret_name TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = p_secret_name
  LIMIT 1;
$$;

-- GRANTS: apenas service_role pode chamar
GRANT EXECUTE ON FUNCTION public.read_vault_secret TO service_role;
REVOKE EXECUTE ON FUNCTION public.read_vault_secret FROM authenticated, anon;
```

**Alternativa via vault_secret_id (UUID lookup):**
```sql
CREATE OR REPLACE FUNCTION public.read_vault_secret_by_id(p_vault_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE id = p_vault_id
  LIMIT 1;
$$;
```

**Nota de segurança:** A view `vault.decrypted_secrets` não está acessível via PostgREST diretamente. O acesso deve ser encapsulado em uma função `SECURITY DEFINER` que o N8N chama via RPC com service_role. [VERIFIED: supabase.com/docs/guides/database/vault]

### Padrão 7: Função `refresh_daily_rollups` (Postgres UPSERT agregado)

O ON CONFLICT DO UPDATE no Postgres não suporta agregações diretas. O padrão correto usa CTE:

```sql
CREATE OR REPLACE FUNCTION public.refresh_daily_rollups(
  p_tenant_id UUID,
  p_date_from DATE,
  p_date_to   DATE
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  -- Per channel (google_ads, meta_ads)
  INSERT INTO daily_rollups (
    tenant_id, channel, date,
    total_spend, total_impressions, total_clicks,
    total_conversions, total_conv_value, campaign_count,
    updated_at
  )
  SELECT
    p_tenant_id,
    channel,
    date,
    SUM(spend),
    SUM(impressions),
    SUM(clicks),
    SUM(conversions),
    SUM(conversion_value),
    COUNT(DISTINCT campaign_id),
    NOW()
  FROM campaign_metrics
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_date_from AND p_date_to
  GROUP BY channel, date

  UNION ALL

  -- Cross-channel total ('all')
  SELECT
    p_tenant_id,
    'all',
    date,
    SUM(spend),
    SUM(impressions),
    SUM(clicks),
    SUM(conversions),
    SUM(conversion_value),
    COUNT(DISTINCT campaign_id),
    NOW()
  FROM campaign_metrics
  WHERE tenant_id = p_tenant_id
    AND date BETWEEN p_date_from AND p_date_to
  GROUP BY date

  ON CONFLICT (tenant_id, channel, date) DO UPDATE SET
    total_spend       = EXCLUDED.total_spend,
    total_impressions = EXCLUDED.total_impressions,
    total_clicks      = EXCLUDED.total_clicks,
    total_conversions = EXCLUDED.total_conversions,
    total_conv_value  = EXCLUDED.total_conv_value,
    campaign_count    = EXCLUDED.campaign_count,
    updated_at        = EXCLUDED.updated_at;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_daily_rollups TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_daily_rollups FROM authenticated, anon;
```

### Padrão 8: RLS para novas tabelas (usando padrão estabelecido na Fase 1)

Todas as novas tabelas seguem o mesmo padrão das políticas existentes em `0004_create_rls_policies.sql`:

```sql
-- campaign_metrics: Super Admin vê tudo; tenant members veem apenas o próprio tenant
CREATE POLICY campaign_metrics_super_admin_all ON public.campaign_metrics
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY campaign_metrics_tenant_select ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- N8N usa service_role → bypassa RLS automaticamente (sem política necessária para service_role)
-- CRÍTICO: o service_role key NUNCA pode ser exposto ao client browser
```

O mesmo padrão aplica-se a `ad_accounts`, `sync_jobs`, e `daily_rollups`.

**Política adicional para `ad_accounts`:** Apenas Super Admin pode INSERT/UPDATE (credenciais sensíveis). Tenant members não devem poder gerenciar suas próprias credenciais em v1 (isso vem na Settings UI da Fase 3).

### Padrão 9: N8N Schedule Trigger — Cron expressions

[VERIFIED: community.n8n.io + n8nautomation.cloud]

| Workflow | Frequência | Cron Expression |
|----------|-----------|----------------|
| Google Ads Sync | A cada 3 horas | `0 */3 * * *` |
| Meta Ads Sync | A cada 6 horas | `0 */6 * * *` |

**Queue Mode:** O main process (PID 3168309) gerencia os triggers de schedule. Os workers (PID 3164219+) executam os workflows. Não há configuração especial necessária — os Schedule Triggers funcionam nativamente em Queue Mode. [VERIFIED: docs.n8n.io/hosting/scaling/queue-mode]

**Importante:** Mudanças no Schedule Trigger só têm efeito após republicar o workflow (stop → publish nova versão). [VERIFIED: community.n8n.io/issues/23711]

### Padrão 10: Detecção de primeira execução (backfill vs. incremental)

O workflow N8N detecta se é a primeira execução verificando se existe algum registro em `sync_jobs` para `(tenant_id, channel)`:

```
GET /rest/v1/sync_jobs
  ?tenant_id=eq.{UUID}&channel=eq.google_ads&status=eq.success
  &select=id
  &limit=1
Headers: apikey + Authorization (service_role)
```

Se `data` é array vazio → backfill (date_from = hoje - 90 dias).
Se `data` tem resultado → incremental (date_from = hoje - 2 dias).

### Padrão 11: SYNC-03 — Sync Status Section na UI (Server Component)

**Localização recomendada:** Adicionar seção `SyncStatusSection` na página `/tenants` existente (evita criar nova rota, fica visível ao Super Admin no mesmo contexto).

**Query Server Component (sem TanStack Query — dados estáticos via RSC):**
```typescript
// Dentro de app/tenants/page.tsx — nova função loadSyncStatus()
async function loadSyncStatus() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sync_jobs')
    .select('tenant_id, channel, status, completed_at, error_message, tenants(name)')
    .order('completed_at', { ascending: false })
    // Busca o último job por tenant+channel (Postgres DISTINCT ON equivalente via limit+order)
  return data ?? []
}
```

**Display mínimo:** Tabela ou lista com: Tenant Name | Channel | Last Sync | Status | Error (se houver).

### Anti-Patterns a Evitar

- **Nunca usar o node nativo Supabase no N8N** — bug #17020 causa falhas silenciosas em inserções.
- **Nunca chamar `get_tenant_id()` sem wrapper `(SELECT ...)` em RLS policies** — causa 100-1000x slowdown (padrão estabelecido na Fase 1).
- **Nunca hardcodar API version inline** — sempre usar constante no topo do workflow (SYNC-06).
- **Não usar `searchStream` paginado** — SearchStream retorna tudo de uma vez (sem `pageToken`). [VERIFIED: developers.google.com]
- **Não assumir Meta tokens expiram como tokens de usuário regular** — System User tokens com Marketing API Standard Access não expiram por tempo. [VERIFIED: developers.facebook.com]
- **Não usar `metrics.all_conversions_value` como padrão** — inclui conversões cross-device e estimadas; para ROAS conservador usar `metrics.conversions_value`. [ASSUMED — distinção de negócio, confirmar com usuário]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|----------|---------------|-------------------|---------|
| Token refresh OAuth2 Google | Lógica custom de refresh | HTTP Request node para `https://oauth2.googleapis.com/token` | Endpoint padrão OAuth2 [VERIFIED] |
| Armazenamento seguro de tokens | Coluna criptografada manual | Supabase Vault (`vault.create_secret`) | AES-256, decryption em query-time, sem lógica custom [VERIFIED] |
| Upsert com conflito composto | INSERT manual + SELECT para verificar | PostgREST `?on_conflict=` + `Prefer: resolution=merge-duplicates` | Uma chamada HTTP, atômico [VERIFIED] |
| Agregação de daily_rollups | Calcular no N8N e enviar | Postgres function `refresh_daily_rollups` via RPC | Agregação acontece no banco, mais eficiente |
| Iteração multi-tenant | forEach manual com Set Node | Loop Over Items (Split in Batches) node do N8N | Padrão oficial, lida com erros por item [VERIFIED] |
| Paginação Meta Insights | Lógica de cursor manual | N8N HTTP Request com follow-through de `paging.next` | O N8N pode seguir paginação com IF node + loop |

---

## Common Pitfalls

### Pitfall 1: Google Ads API v19 já foi descontinuada
**O que vai errado:** Código escrito para v19 (ou v20, que expira jun/2026) falha silenciosamente ou retorna 404.
**Por que acontece:** v19 foi sunset em fevereiro de 2026. [VERIFIED: ppc.land/google-preparing-to-shut-down-ads-api-v19-in-february-2026]
**Como evitar:** Usar v21 como versão mínima. Constante `GOOGLE_ADS_API_VERSION = 'v21'` no topo do workflow.
**Sinal de alerta:** HTTP 400 com mensagem "API version not supported".

### Pitfall 2: Meta Marketing API v22 também expira em junho/2026
**O que vai errado:** Código com `v22.0` para de funcionar em 09/jun/2026.
**Por que acontece:** Meta depreca versões com ~1 ano de ciclo de vida. [VERIFIED: developers.facebook.com changelog]
**Como evitar:** Usar v24 como versão mínima. Constante `META_ADS_API_VERSION = 'v24.0'`.

### Pitfall 3: Meta attribution window — mudanças de jan/2026
**O que vai errado:** Requisições com `action_attribution_windows=['7d_view']` ou `28d_view` retornam dados vazios após jan/2026.
**Por que acontece:** Meta removeu as janelas de view de 7 e 28 dias em 12/jan/2026. [VERIFIED: ppc.land/meta-restricts-attribution-windows]
**Como evitar:** Usar `action_attribution_windows=['7d_click','1d_view']` (padrão atual). Para `attribution_window` na tabela, armazenar `'7d_click'` como default.
**Impacto no SYNC-05:** O valor do campo `attribution_window` que representa o default correto atual é `'7d_click'` (não `'7d_click_1d_view'` ou outro valor).

### Pitfall 4: SearchStream vs Search — resposta envolve array
**O que vai errado:** N8N tenta parsear a resposta como objeto JSON único → erro de parsing.
**Por que acontece:** SearchStream retorna JSON array (não objeto único). [VERIFIED: developers.google.com/google-ads/api/rest/common/search]
**Como evitar:** No N8N, usar o nó Code para iterar sobre `$response.body` como array. A resposta vem como: `[{"results": [...]}, {"results": [...]}]`.

### Pitfall 5: cost_micros precisa de divisão por 1.000.000
**O que vai errado:** Gravar `12500000` como `spend` em vez de `12.50`.
**Por que acontece:** Google Ads retorna custo em micros (millionths of currency unit). [VERIFIED: developers.google.com GAQL docs]
**Como evitar:** No N8N Code node: `spend = parseInt(metrics.costMicros || '0') / 1_000_000`.

### Pitfall 6: camelCase vs snake_case na resposta Google Ads
**O que vai errado:** Código tenta acessar `metrics.cost_micros` na resposta JSON mas o campo se chama `costMicros`.
**Por que acontece:** GAQL usa snake_case com pontos, mas a resposta REST JSON usa camelCase. [VERIFIED: GAQL query cookbook]
**Como evitar:** Mapear explicitamente: `result.metrics.costMicros → spend`, `result.metrics.conversionsValue → conversion_value`, etc.

### Pitfall 7: `ad_accounts` UNIQUE constraint `(tenant_id, channel)` — um tenant, uma conta
**O que vai errado:** Tentar inserir duas contas Google Ads para o mesmo tenant → constraint violation.
**Por que acontece:** Decision D-06 limita a uma conta por canal por tenant em v1.
**Como evitar:** Super Admin insere manualmente via Supabase Dashboard; a constraint protege contra duplicatas acidentais.

### Pitfall 8: N8N Schedule Trigger não atualiza sem republicar o workflow
**O que vai errado:** Editar o Schedule Trigger e salvar não muda o schedule de execução.
**Por que acontece:** N8N mantém o schedule anterior até o workflow ser republicado (stop + novo publish). [VERIFIED: community.n8n.io/issues/23711]
**Como evitar:** Ao mudar o cron, sempre: Deactivate → Edit → Activate.

### Pitfall 9: Supabase PostgREST schema cache desatualizado após migrations
**O que vai errado:** Chamadas N8N a funções RPC novas retornam 404 mesmo após a migration rodar.
**Por que acontece:** PostgREST mantém cache do schema e precisa ser recarregado após criar/alterar funções. [VERIFIED: docs.postgrest.org]
**Como evitar:** Após cada migration que adiciona funções ou tabelas, fazer NOTIFY no Supabase Dashboard: `NOTIFY pgrst, 'reload schema'` — ou aguardar o reload automático (pode levar até 1 min no Supabase managed).

### Pitfall 10: Meta Insights API — paginação obrigatória para backfill de 90 dias
**O que vai errado:** Apenas a primeira página de resultados é processada → dados incompletos para tenants com muitas campanhas.
**Por que acontece:** Meta retorna max 100 itens por página (configurável via `limit`). Para 90 dias com muitas campanhas, haverá múltiplas páginas.
**Como evitar:** No workflow N8N, após cada chamada à Meta API, verificar se `response.paging.next` existe e seguir o cursor com `after=CURSOR_VALUE` até que não haja mais páginas.

---

## Code Examples

### Google Ads — Montar data range para backfill vs incremental (N8N Code Node)

```javascript
// Source: padrão N8N Code Node + lógica D-17
const today = new Date();
const isFirstSync = $input.first().json.syncJobsCount === 0;

let dateFrom, dateTo;
if (isFirstSync) {
  // Backfill: 90 dias
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  dateFrom = ninetyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
} else {
  // Incremental: últimos 2 dias (overlap para dados atrasados)
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  dateFrom = twoDaysAgo.toISOString().split('T')[0];
}
dateTo = today.toISOString().split('T')[0];

return [{ json: { dateFrom, dateTo, isFirstSync } }];
```

### Google Ads — Parsear resposta SearchStream e mapear para campaign_metrics

```javascript
// Source: padrão documentado para resposta SearchStream [VERIFIED: developers.google.com]
// Input: $input.all() — array de chunks da resposta SearchStream
const tenantId = $('Get tenant from ad_accounts').first().json.tenant_id;
const rows = [];

for (const chunk of $input.all()) {
  const results = chunk.json.results || [];
  for (const result of results) {
    const campaign = result.campaign || {};
    const metrics = result.metrics || {};
    const segments = result.segments || {};

    rows.push({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      channel: 'google_ads',
      date: segments.date,
      impressions: parseInt(metrics.impressions || '0'),
      clicks: parseInt(metrics.clicks || '0'),
      spend: parseInt(metrics.costMicros || '0') / 1_000_000,
      conversions: parseFloat(metrics.conversions || '0'),
      conversion_value: parseFloat(metrics.conversionsValue || '0'),
      status: campaign.status,
      ad_group_id: result.adGroup?.id || null,
      attribution_window: '7d_click',  // Google Ads default (SYNC-05)
      synced_at: new Date().toISOString()
    });
  }
}

return rows.map(row => ({ json: row }));
```

### Meta Ads — Parsear actions array para extrair conversions

```javascript
// Source: documentação Meta Insights API [VERIFIED: get-ryze.ai + developers.facebook.com]
function extractActionValue(actionsArray, actionType) {
  if (!Array.isArray(actionsArray)) return 0;
  const action = actionsArray.find(a => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

const rows = [];
for (const item of $input.all()) {
  const d = item.json;
  rows.push({
    tenant_id: $('Get tenant').first().json.tenant_id,
    campaign_id: d.campaign_id,
    campaign_name: d.campaign_name,
    channel: 'meta_ads',
    date: d.date_start,
    impressions: parseInt(d.impressions || '0'),
    clicks: parseInt(d.clicks || '0'),
    spend: parseFloat(d.spend || '0'),
    conversions: extractActionValue(d.actions, 'purchase'),
    conversion_value: extractActionValue(d.action_values, 'purchase'),
    status: null,  // Meta não retorna status de campanha no insights endpoint
    ad_group_id: null,  // adset_id disponível com level=adset — não usado em v1
    attribution_window: '7d_click',  // Meta default pós-jan/2026 (SYNC-05)
    synced_at: new Date().toISOString()
  });
}
return rows.map(row => ({ json: row }));
```

### Supabase — RLS policy para campaign_metrics (migration)

```sql
-- Source: padrão estabelecido em 0004_create_rls_policies.sql (Fase 1)
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_metrics_super_admin_all ON public.campaign_metrics
  FOR ALL TO authenticated
  USING ((SELECT public.get_user_role()) = 'super_admin')
  WITH CHECK ((SELECT public.get_user_role()) = 'super_admin');

CREATE POLICY campaign_metrics_tenant_select ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- Indexes para performance das queries de Fase 3
CREATE INDEX idx_campaign_metrics_tenant_date
  ON public.campaign_metrics(tenant_id, date DESC);
CREATE INDEX idx_campaign_metrics_tenant_channel_date
  ON public.campaign_metrics(tenant_id, channel, date DESC);
CREATE INDEX idx_campaign_metrics_campaign_date
  ON public.campaign_metrics(campaign_id, date DESC);
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| Google Ads API v17/v18/v19 | v21+ obrigatório | Fev/2026 (v19 sunset) | Código escrito para v19 falha desde fev/2026 |
| Meta API v20/v22 | v24+ mínimo seguro | Jun/2026 (v22 sunset) | v22 para de funcionar em 09/jun/2026 |
| Meta `action_attribution_windows=7d_view` | Removido — retorna dados vazios | Jan/2026 | attribution_window default: `7d_click` + `1d_view` |
| N8N node nativo Supabase | HTTP Request + PostgREST | Ativo (bug #17020) | Workaround mandatório neste projeto |
| Supabase `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Vercel Integration | Env var name correta confirmada em STATE.md |

---

## Assumptions Log

| # | Claim | Section | Risco se errado |
|---|-------|---------|----------------|
| A1 | `metrics.conversions_value` é o campo correto para ROAS (não `all_conversions_value`) | Standard Stack / Code Examples | ROAS calculado com métrica errada — confirmar com usuário qual métrica usa internamente |
| A2 | Tenant Acme (e outros) rastreiam conversões de "purchase" no Meta Ads | Code Examples | `extractActionValue(actions, 'purchase')` retorna 0 se o evento configurado for diferente |
| A3 | O Manager Account (MCC) do Google Ads é o mesmo para todos os tenants | Padrão 2 | `login-customer-id` incorreto causa `PERMISSION_DENIED` na API |
| A4 | Sistema User Meta já tem permissão `ads_read` em todos os Ad Accounts dos tenants | Environment Availability | Chamadas à Meta API retornam `#200 - The user hasn't authorized the application` |
| A5 | N8N VPS tem acesso HTTP de saída para `googleads.googleapis.com` e `graph.facebook.com` | Environment Availability | Workflows falham com timeout sem mensagem clara |
| A6 | Google Ads App OAuth está em modo "Production" (não "Testing") | Padrão 1 — OAuth | Em modo Testing, refresh_tokens expiram em 7 dias |

---

## Open Questions

1. **Google Ads Customer ID e estrutura MCC**
   - O que sabemos: O Developer Token não existe ainda (blocker crítico).
   - O que é incerto: A estrutura de MCC (Manager Account) — há um MCC para todos os clientes ou cada cliente tem conta independente? Isso determina se `login-customer-id` é necessário.
   - Recomendação: Quando o Developer Token for aprovado, documentar: (1) MCC ID, (2) Customer IDs de cada cliente.

2. **Meta Ad Account IDs por tenant**
   - O que sabemos: Meta Business Manager configurado com System User. [STATE.md]
   - O que é incerto: IDs específicos das Ad Accounts (`act_XXXXXXXXXX`) para inserir em `ad_accounts`.
   - Recomendação: Listar os Ad Account IDs no Business Manager antes de iniciar a fase.

3. **Qual action_type usar para conversions no Meta**
   - O que sabemos: `actions` é um array de objetos com `action_type`.
   - O que é incerto: Os tenants usam `purchase`, `lead`, ou outro evento como conversão principal?
   - Recomendação: Confirmar com usuário qual `action_type` representa "conversão" para cada tenant.

4. **Confirmação de que N8N está em versão >= 1.88.0 (CVE-2025-68613)**
   - O que sabemos: N8N rodando em Queue Mode confirmado (STATE.md), mas versão UNVERIFIED.
   - O que é incerto: Versão exata e se o CVE foi corrigido.
   - Recomendação: SSH no VPS antes de criar workflows com dados sensíveis de clientes.

---

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|------------|--------------|-----------|--------|---------|
| N8N self-hosted | SYNC-01, SYNC-02 | Confirmado | UNVERIFIED (>=1.88 necessário) | Sem fallback — N8N é o engine de sync |
| Supabase Vault (pgsodium) | D-05 (tokens) | Sim (managed Supabase inclui pgsodium) [ASSUMED] | — | Sem fallback — decisão locked |
| Google Ads Developer Token | SYNC-01 | **NÃO** | — | Sem fallback — blocker crítico |
| Google OAuth2 App (Production) | SYNC-01 | Sim [STATE.md: "already in Production"] | — | — |
| Meta System User Token | SYNC-02 | Parcialmente (Business Manager configurado, tokens por confirmar) | — | Sem fallback |
| SSH access para VPS N8N | Deploy de workflows | Não verificado | — | N8N UI web (https://evo.wrdigitalgroup.com.br) |

**Dependências bloqueantes sem fallback:**
- Google Ads Developer Token — CRÍTICO: Phase 2 Google Ads workflow NÃO pode ser executado sem aprovação de Basic Access.

**Dependências com workaround:**
- N8N version: verificar via SSH; se < 1.88.0, atualizar antes de criar workflows com dados de produção.
- Meta tokens individuais por tenant: se não configurados, criar via Business Manager antes de ativar o workflow Meta.

---

## Validation Architecture

> Baseado em `.planning/config.json` — nyquist_validation não encontrado, tratado como enabled.

### Test Framework

| Propriedade | Valor |
|------------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (existente da Fase 1) |
| Quick run | `npm test` |
| Full suite | `npm test` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Comando | Arquivo existe? |
|--------|---------------|--------------|---------|----------------|
| SYNC-01 | Google Ads workflow busca e grava métricas | Manual (requer credenciais reais) | N/A — validação manual via sync_jobs | N/A |
| SYNC-02 | Meta Ads workflow busca e grava métricas | Manual (requer System User Token real) | N/A | N/A |
| SYNC-03 | Timestamp de último sync visível na UI | Manual (browser smoke test) | N/A | N/A |
| SYNC-04 | sync_jobs registra sucesso e falha corretamente | Integration (RLS + schema) | `npm test -- --grep "sync_jobs"` | ❌ Wave 0 |
| SYNC-05 | attribution_window NOT NULL em campaign_metrics | Unit (schema constraint) | `npm test -- --grep "campaign_metrics"` | ❌ Wave 0 |
| SYNC-06 | API version constante no workflow (não hardcoded) | Manual code review — não automatizável | N/A | N/A |

### Wave 0 Gaps

- [ ] `tests/unit/campaign-metrics-schema.test.ts` — testa constraints da tabela (NOT NULL, UNIQUE, CHECK)
- [ ] `tests/unit/daily-rollups-schema.test.ts` — testa schema daily_rollups + constraint UNIQUE(tenant_id, channel, date)
- [ ] `tests/integration/sync-jobs-rls.test.ts` — testa RLS: tenant_admin só vê sync_jobs do próprio tenant
- [ ] `tests/integration/vault-rpc.test.ts` — testa que `read_vault_secret` rejeita chamadas sem service_role

---

## Security Domain

### Applicable ASVS Categories

| Categoria ASVS | Aplica | Controle Padrão |
|----------------|--------|-----------------|
| V2 Authentication | Sim (API tokens de terceiros) | Supabase Vault para armazenamento; OAuth2 flow para Google |
| V3 Session Management | Não (N8N é server-side, sem sessão de usuário) | — |
| V4 Access Control | Sim (service_role bypassa RLS — restringir acesso à chave) | Chave service_role NUNCA no client; apenas em N8N env vars (VPS) |
| V5 Input Validation | Sim (dados de API externos → banco) | Tipos Postgres + CHECK constraints fazem validação de schema |
| V6 Cryptography | Sim (tokens OAuth2 e System User em repouso) | Supabase Vault (AES-256 via pgsodium) — nunca hand-roll |

### Known Threat Patterns

| Padrão | STRIDE | Mitigação Padrão |
|--------|--------|-----------------|
| service_role key exposta em workflow N8N exportado | Information Disclosure | Armazenar como N8N Credential (criptografada), não como literal no workflow JSON |
| Cross-tenant data write (N8N escreve sem tenant isolation) | Tampering | Workflow N8N lê `tenant_id` de `ad_accounts` e associa explicitamente a cada upsert |
| Vault secret acessível via PostgREST sem autenticação | Elevation of Privilege | Função `read_vault_secret` com SECURITY DEFINER + GRANT apenas a service_role |
| Tokens Google/Meta em texto plano em logs do N8N | Information Disclosure | Usar N8N Credential para armazenar chaves, não variáveis de workflow; limitar log retention |

---

## Sources

### Primary (HIGH confidence)
- [developers.google.com/google-ads/api/rest/common/search](https://developers.google.com/google-ads/api/rest/common/search) — SearchStream endpoint, request/response format
- [developers.google.com/google-ads/api/rest/auth](https://developers.google.com/google-ads/api/rest/auth) — Headers obrigatórios (developer-token, login-customer-id)
- [developers.google.com/google-ads/api/docs/query/structure](https://developers.google.com/google-ads/api/docs/query/structure) — GAQL syntax, cláusulas, date filtering
- [developers.google.com/google-ads/api/docs/query/cookbook](https://developers.google.com/google-ads/api/docs/query/cookbook) — Query examples com segments.date
- [developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2) — OAuth2 refresh token flow, token endpoint
- [developers.facebook.com/documentation/facebook-login/guides/access-tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens) — System User token lifecycle
- [docs.postgrest.org/en/v12/references/api/tables_views.html](https://docs.postgrest.org/en/v12/references/api/tables_views.html) — Upsert via POST + on_conflict
- [docs.postgrest.org/en/latest/references/api/functions.html](https://docs.postgrest.org/en/latest/references/api/functions.html) — RPC via /rpc/function_name
- [supabase.com/docs/guides/database/vault](https://supabase.com/docs/guides/database/vault) — vault.create_secret(), vault.decrypted_secrets

### Secondary (MEDIUM confidence)
- [ppc.land — Google Ads API v19 sunset](https://ppc.land/google-preparing-to-shut-down-ads-api-v19-in-february-2026) — Confirmação do sunset de v19 em fev/2026
- [ppc.land — Meta attribution window changes](https://ppc.land/meta-restricts-attribution-windows-and-data-retention-in-ads-insights-api) — Remoção de 7d_view em jan/2026
- [get-ryze.ai — Meta Insights endpoint guide](https://www.get-ryze.ai/blog/meta-ads-api-insights-endpoint-campaigns-impressions-clicks-spend-leads) — Estrutura de fields e response Meta API
- [docs.n8n.io/hosting/scaling/queue-mode](https://docs.n8n.io/hosting/scaling/queue-mode) — Queue Mode: main process gerencia triggers, workers executam
- [community.n8n.io — Schedule trigger issues #23711](https://community.n8n.io/t/cron-trigger-executing-multiple-times-after-updates-due-to-ghost-triggers-in-queue-mode-with-multiple-workers/244687) — Precisa republicar após mudar schedule

### Tertiary (LOW confidence — verificar antes de implementar)
- [skuanalyzer.com — Google Ads Metrics guide](https://skuanalyzer.com/guides/google-ads-api/metrics/) — Lista de campos metrics disponíveis; pode estar desatualizado

---

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM-HIGH — Versões de API verificadas via changelogs oficiais; padrões PostgREST verificados via docs oficiais
- Architecture: MEDIUM-HIGH — Padrões N8N verificados via docs + community; Vault pattern verificado via Supabase docs
- Pitfalls: HIGH — Versão API e attribution window changes verificados em fontes primárias
- Code Examples: MEDIUM — Estruturas de response verificadas; parsing exato de campos pode precisar ajuste com dados reais

**Research date:** 2026-05-16
**Valid until:** 2026-07-01 (Meta API tem ciclo de mudanças mensal — verificar changelogs antes de iniciar implementação)
