---
phase: 02-data-pipeline
plan: "02"
subsystem: schema-migrations
tags: [supabase, migrations, rls, vault, postgres-functions, vitest, sync-04, sync-05]
dependency_graph:
  requires:
    - "02-01 (test scaffolds)"
    - "01-foundation (tenants table, RLS helpers)"
  provides:
    - supabase/migrations/0006_create_ad_accounts.sql
    - supabase/migrations/0007_create_campaign_metrics.sql
    - supabase/migrations/0008_create_sync_jobs.sql
    - supabase/migrations/0009_create_daily_rollups.sql
    - supabase/migrations/0010_create_pipeline_functions.sql
    - supabase/migrations/0011_fix_vault_function_grants.sql
    - types/database.types.ts
    - tests/unit/campaign-metrics-schema.test.ts
    - tests/unit/daily-rollups-schema.test.ts
    - tests/integration/sync-jobs-rls.test.ts
    - tests/integration/vault-rpc.test.ts
  affects:
    - "Plan 03 (Google Ads N8N workflow): ad_accounts, campaign_metrics, sync_jobs, daily_rollups prontos"
    - "Plan 04 (Meta Ads N8N workflow): mesmas tabelas"
    - "Plan 05 (Sync Status UI): sync_jobs disponível para query"
tech_stack:
  added: []
  patterns:
    - "SECURITY DEFINER + GRANT authenticator (PostgREST intermediário) para funções vault"
    - "Lazy createClient em beforeAll para evitar session contamination em testes Vitest"
    - "supabase migration repair para sincronizar histórico de migrations aplicadas manualmente"
key_files:
  created:
    - supabase/migrations/0006_create_ad_accounts.sql
    - supabase/migrations/0007_create_campaign_metrics.sql
    - supabase/migrations/0008_create_sync_jobs.sql
    - supabase/migrations/0009_create_daily_rollups.sql
    - supabase/migrations/0010_create_pipeline_functions.sql
    - supabase/migrations/0011_fix_vault_function_grants.sql
  modified:
    - types/database.types.ts
    - tests/unit/campaign-metrics-schema.test.ts
    - tests/unit/daily-rollups-schema.test.ts
    - tests/integration/sync-jobs-rls.test.ts
    - tests/integration/vault-rpc.test.ts
decisions:
  - "GRANT EXECUTE TO authenticator necessário para funções SECURITY DEFINER chamadas via PostgREST com service_role JWT"
  - "Lazy createClient em beforeAll: criar clients Supabase dentro de beforeAll/it, nunca no escopo do describe"
  - "supabase migration repair usado para reconciliar histórico quando migrations foram aplicadas manualmente antes do CLI"
metrics:
  duration_seconds: 1830
  completed_date: "2026-05-16"
  tasks_completed: 6
  tasks_total: 6
  files_created: 8
  files_modified: 4
---

# Phase 02 Plan 02: Schema Migrations + Tests Summary

**One-liner:** 5 migrations SQL aplicadas em rvkkvjitfddtbdpkupok (4 tabelas + 2 funções SECURITY DEFINER) com RLS completo, types regenerados e 18 testes reais Vitest verdes contra staging.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migration 0006 — ad_accounts + RLS | `ad95d50` | `supabase/migrations/0006_create_ad_accounts.sql` |
| 2 | Migration 0007 — campaign_metrics + RLS + indexes | `91ddbcb` | `supabase/migrations/0007_create_campaign_metrics.sql` |
| 3 | Migration 0008 sync_jobs + 0009 daily_rollups + RLS | `0a64f75` | `supabase/migrations/0008_create_sync_jobs.sql`, `supabase/migrations/0009_create_daily_rollups.sql` |
| 4 | Migration 0010 — funções read_vault_secret + refresh_daily_rollups | `75ddc61` | `supabase/migrations/0010_create_pipeline_functions.sql` |
| 5 | supabase db push — 5 migrations aplicadas + PostgREST schema reload | `f5f7a82` | — |
| 6 | Types regenerados + 18 testes reais + fix grants | `b3c185c` | `types/database.types.ts`, 4 arquivos de teste, `0011_fix_vault_function_grants.sql` |

---

## Verificação supabase migration list --linked

```
 Local | Remote | Time (UTC)
 ------|--------|-----------
 0001  | 0001   | 0001
 0002  | 0002   | 0002
 0003  | 0003   | 0003
 0004  | 0004   | 0004
 0005  | 0005   | 0005
 0006  | 0006   | 0006
 0007  | 0007   | 0007
 0008  | 0008   | 0008
 0009  | 0009   | 0009
 0010  | 0010   | 0010
 0011  | 0011   | 0011
```

Todas as 11 migrations (6 da Fase 1 + 5 novas + 1 fix) aplicadas em `rvkkvjitfddtbdpkupok`.

---

## Resultado npm test

```
Test Files  7 passed (7)
Tests       41 passed | 5 todo (46)
Duration    2.82s
```

- 7 arquivos de teste, todos passando
- 41 testes reais passando (18 novos desta plan + 23 existentes)
- 5 `todo` restantes são dos scaffolds da Fase 1 (`tests/rls.test.ts`)
- Exit code: 0

---

## Tabelas e Funções Criadas

### ad_accounts
- `UNIQUE(tenant_id, channel)` — uma conta por plataforma por tenant em v1
- `vault_secret_id UUID NOT NULL` — referência ao Supabase Vault
- Index parcial `WHERE active = TRUE`
- RLS: super_admin_all + tenant_select FOR SELECT
- `REVOKE ALL FROM anon`

### campaign_metrics
- `attribution_window TEXT NOT NULL DEFAULT '7d_click'` (SYNC-05 — nunca NULL)
- `UNIQUE(tenant_id, campaign_id, channel, date)` — chave de upsert para N8N
- 3 indexes para queries de dashboard (Fase 3): tenant_date, tenant_channel_date, campaign_date
- RLS: super_admin_all + tenant_select FOR SELECT

### sync_jobs
- `status CHECK IN ('running', 'success', 'failed')` — SQLSTATE 23514 em violação
- 2 indexes: `idx_sync_jobs_tenant_channel_completed` (último sync) + `idx_sync_jobs_tenant_channel_status` (detecção primeira execução)
- RLS: super_admin_all + tenant_select FOR SELECT

### daily_rollups
- `channel CHECK IN ('google_ads', 'meta_ads', 'all')` — 'all' = cross-channel rollup
- `UNIQUE(tenant_id, channel, date)` — alvo do ON CONFLICT em refresh_daily_rollups
- RLS: super_admin_all + tenant_select FOR SELECT

### read_vault_secret(TEXT)
- `SECURITY DEFINER SET search_path = public, vault`
- `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_secret_name LIMIT 1`
- GRANT: postgres, service_role, authenticator | REVOKE: PUBLIC, anon, authenticated

### refresh_daily_rollups(UUID, DATE, DATE)
- `SECURITY DEFINER` — INSERT...SELECT...UNION ALL...ON CONFLICT DO UPDATE
- Per-channel + cross-channel 'all' em uma única chamada
- GRANT: postgres, service_role, authenticator | REVOKE: PUBLIC, anon, authenticated

---

## Snippet types/database.types.ts (4 novas tabelas)

```typescript
// Antes da Plan 02: apenas tenants, tenant_users
// Após regeneração:
Database['public']['Tables'] = {
  ad_accounts: { Row: { id, tenant_id, channel, account_id, vault_secret_id, ... } }
  campaign_metrics: { Row: { id, tenant_id, campaign_id, attribution_window, ... } }
  daily_rollups: { Row: { id, tenant_id, channel, date, total_spend, ... } }
  sync_jobs: { Row: { id, tenant_id, channel, status, error_message, ... } }
  tenants: { ... }           // existente
  tenant_users: { ... }      // existente
}
Database['public']['Functions'] = {
  read_vault_secret: { Args: { p_secret_name: string }, Returns: string | null }
  refresh_daily_rollups: { Args: { p_tenant_id, p_date_from, p_date_to }, Returns: undefined }
  // + helpers da Fase 1
}
```

---

## Próximo Passo

Plans 03 e 04 (Google Ads Sync e Meta Ads Sync — workflows N8N) podem rodar em paralelo (Wave 2).
Plan 05 (Sync Status UI) depende de 03/04 para ter dados reais mas o schema `sync_jobs` já está disponível.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GRANT EXECUTE TO authenticator necessário para PostgREST**
- **Found during:** Task 6 — npm test failing com `42501 permission denied for function read_vault_secret`
- **Issue:** Migration 0010 fez `REVOKE EXECUTE FROM PUBLIC`, removendo o role `authenticator` (intermediário do PostgREST) do ACL. O PostgREST conecta como `authenticator` e faz `SET ROLE service_role` — sem EXECUTE no `authenticator`, a transição falha antes mesmo de chegar ao `service_role`.
- **Fix:** Criada migration 0011 com `GRANT EXECUTE ON FUNCTION ... TO authenticator` para ambas as funções.
- **Segurança preservada:** `authenticated` e `anon` continuam sem EXECUTE. O `authenticator` apenas inicia a transição de role; a lógica executa como `service_role` via SECURITY DEFINER.
- **Files modified:** `supabase/migrations/0011_fix_vault_function_grants.sql`
- **Commit:** `b3c185c`

**2. [Rule 1 - Bug] Session contamination no serviceClient do Vitest**
- **Found during:** Task 6 — testes 3 e 4 de vault-rpc falhando após teste 2
- **Issue:** `serviceClient.auth.signInWithPassword(...)` armazena o JWT do tenant_admin na instância, fazendo chamadas subsequentes usarem o role `authenticated` ao invés de `service_role`.
- **Fix:** Substituído por `signInClient` separado — um novo `createClient(url, serviceKey)` usado exclusivamente para o sign-in, sem compartilhar estado com `serviceClient`.
- **Files modified:** `tests/integration/vault-rpc.test.ts`
- **Commit:** `b3c185c`

**3. [Rule 3 - Blocking] supabase migration repair para reconciliar histórico**
- **Found during:** Task 5 — `supabase db push` tentou reaplicar migrations 0001-0005 já existentes no banco
- **Issue:** Migrations da Fase 1 foram aplicadas manualmente (não via Supabase CLI), então a tabela `supabase_migrations` no banco remoto não tinha registros para 0001-0005.
- **Fix:** `npx supabase migration repair --linked --status applied 0001 0002 0003 0004 0005` — marca as migrations como aplicadas sem reexecutar o SQL.
- **Files modified:** nenhum (operação de estado no banco remoto)
- **Commit:** `f5f7a82`

---

## Known Stubs

Nenhum stub de dados. As migrations criam schema real; os testes usam dados efêmeros com cleanup via CASCADE.

---

## Threat Flags

Nenhuma nova superfície de segurança além do já documentado no `<threat_model>` do plano.

Mitigações confirmadas por testes:
- **T-2-02:** sync_jobs.error_message isolado por tenant — `sync-jobs-rls.test.ts` prova 0 rows cross-tenant
- **T-2-03:** read_vault_secret rejeitada para authenticated/anon — `vault-rpc.test.ts` prova permission denied

---

## Self-Check: PASSED

```
FOUND: supabase/migrations/0006_create_ad_accounts.sql
FOUND: supabase/migrations/0007_create_campaign_metrics.sql
FOUND: supabase/migrations/0008_create_sync_jobs.sql
FOUND: supabase/migrations/0009_create_daily_rollups.sql
FOUND: supabase/migrations/0010_create_pipeline_functions.sql
FOUND: supabase/migrations/0011_fix_vault_function_grants.sql
FOUND: types/database.types.ts (428 linhas)
FOUND: tests/unit/campaign-metrics-schema.test.ts
FOUND: tests/unit/daily-rollups-schema.test.ts
FOUND: tests/integration/sync-jobs-rls.test.ts
FOUND: tests/integration/vault-rpc.test.ts
FOUND commit: ad95d50
FOUND commit: 91ddbcb
FOUND commit: 0a64f75
FOUND commit: 75ddc61
FOUND commit: f5f7a82
FOUND commit: b3c185c
npm test: 7 files, 41 passed, 5 todo — exit 0
supabase migration list: 0006-0011 todos no Remote
4 tabelas confirmadas: ad_accounts, campaign_metrics, sync_jobs, daily_rollups
2 funções confirmadas: read_vault_secret, refresh_daily_rollups
```
