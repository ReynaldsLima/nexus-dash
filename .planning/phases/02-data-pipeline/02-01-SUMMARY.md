---
phase: 02-data-pipeline
plan: "01"
subsystem: test-scaffolds
tags: [vitest, rls, schema, scaffold, sync-04, sync-05]
dependency_graph:
  requires: []
  provides:
    - tests/unit/campaign-metrics-schema.test.ts
    - tests/unit/daily-rollups-schema.test.ts
    - tests/integration/sync-jobs-rls.test.ts
    - tests/integration/vault-rpc.test.ts
  affects:
    - "Plan 02 (schema migrations): todos os it.todo() serão preenchidos contra Supabase staging"
tech_stack:
  added: []
  patterns:
    - "hasTestEnv auto-skip pattern (SUPABASE_TEST_URL + SUPABASE_TEST_SERVICE_KEY)"
    - "describeIfEnv = hasTestEnv ? describe : describe.skip"
    - "it.todo() como placeholder de asserção documentada"
key_files:
  created:
    - tests/unit/campaign-metrics-schema.test.ts
    - tests/unit/daily-rollups-schema.test.ts
    - tests/integration/sync-jobs-rls.test.ts
    - tests/integration/vault-rpc.test.ts
  modified: []
decisions:
  - "vitest 2.1.9 usa -t (--testNamePattern) não --grep — os comandos do plano foram adaptados automaticamente"
metrics:
  duration_seconds: 109
  completed_date: "2026-05-16"
  tasks_completed: 4
  tasks_total: 4
  files_created: 4
  files_modified: 0
---

# Phase 02 Plan 01: Test Scaffolds (Wave 0) Summary

**One-liner:** 4 scaffolds vitest com auto-skip hasTestEnv replicando padrão rls.test.ts — 23 it.todo() prontos para Plan 02 preencher contra Supabase staging.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Scaffold campaign_metrics schema (SYNC-05) | `ef153f6` | `tests/unit/campaign-metrics-schema.test.ts` |
| 2 | Scaffold daily_rollups schema | `dccc0f3` | `tests/unit/daily-rollups-schema.test.ts` |
| 3 | Scaffold sync_jobs RLS (SYNC-04) | `6c54124` | `tests/integration/sync-jobs-rls.test.ts` |
| 4 | Scaffold read_vault_secret RPC (T-2-03) | `3c41aa3` | `tests/integration/vault-rpc.test.ts` |

---

## Arquivos Criados

| Caminho | Describe | it.todo count | Sanity test |
|---------|---------|---------------|-------------|
| `tests/unit/campaign-metrics-schema.test.ts` | `campaign_metrics schema (SYNC-05, SYNC-04)` | 5 | sim |
| `tests/unit/daily-rollups-schema.test.ts` | `daily_rollups schema` | 4 | sim |
| `tests/integration/sync-jobs-rls.test.ts` | `sync_jobs RLS (SYNC-04)` | 5 | sim |
| `tests/integration/vault-rpc.test.ts` | `read_vault_secret RPC (Threat T-2-03)` | 4 | sim |

**Total it.todo():** 18 placeholders que a Plan 02 deve preencher contra Supabase staging.

---

## Verificação npm test

```
Test Files  7 passed (7)
Tests       23 passed | 23 todo (46)
```

- `npm test` exit 0 sem SUPABASE_TEST_URL (auto-skip ativo)
- `-t "campaign_metrics"` → 1 passing + 5 todo
- `-t "daily_rollups"` → 1 passing + 4 todo
- `-t "sync_jobs"` → 1 passing + 5 todo
- `-t "vault"` → 1 passing + 4 todo

---

## Lista dos 18 it.todo() para Plan 02

### campaign_metrics (5)
1. `attribution_window NOT NULL com DEFAULT '7d_click' — INSERT sem coluna grava '7d_click'`
2. `channel CHECK constraint rejeita valores fora de ('google_ads','meta_ads') com SQLSTATE 23514`
3. `UNIQUE(tenant_id, campaign_id, channel, date) — inserir duplicata retorna SQLSTATE 23505`
4. `spend, conversions, conversion_value default to 0 quando omitidos`
5. `tenant_id FK ON DELETE CASCADE remove métricas órfãs`

### daily_rollups (4)
6. `UNIQUE(tenant_id, channel, date) — inserir duplicata retorna SQLSTATE 23505`
7. `channel aceita 'google_ads', 'meta_ads', e 'all' (cross-channel rollup)`
8. `Defaults: total_spend=0, total_impressions=0, total_clicks=0, total_conversions=0, total_conv_value=0, campaign_count=0`
9. `tenant_id FK ON DELETE CASCADE remove rollups órfãos`

### sync_jobs RLS (5)
10. `tenant_admin do tenant A vê 0 rows ao SELECT sync_jobs WHERE tenant_id = <tenant B>`
11. `super_admin vê todos os sync_jobs de todos os tenants`
12. `anon role recebe 0 rows (REVOKE ALL ON sync_jobs FROM anon)`
13. `status CHECK rejeita valores fora de ('running','success','failed') com SQLSTATE 23514`
14. `tenant_admin não consegue INSERT em sync_jobs (apenas service_role/super_admin)`

### vault RPC (4)
15. `anon client recebe 401/permission denied ao POST /rest/v1/rpc/read_vault_secret`
16. `authenticated client (tenant_admin) recebe permission denied (REVOKE EXECUTE FROM authenticated)`
17. `service_role client recebe o decrypted_secret quando passa um secret_name válido`
18. `service_role com secret_name inexistente recebe NULL (não exception)`

---

## Deviations from Plan

### Auto-adapted Issues

**1. [Rule 3 - Blocking] Flag --grep não suportado no vitest 2.1.9**
- **Found during:** Task 1 verification
- **Issue:** O plano especifica `npm test -- --grep "campaign_metrics"` mas vitest 2.1.9 retorna `Unknown option '--grep'`
- **Fix:** Substituído por `-t "campaign_metrics"` (equivalente a `--testNamePattern`) que é o flag correto desta versão
- **Impact:** Nenhum — os scaffolds casam com os mesmos padrões. O comando do VALIDATION.md deve ser atualizado para usar `-t` ao invés de `--grep`
- **Files modified:** nenhum arquivo modificado (apenas adaptação do comando de verificação)

---

## Known Stubs

Nenhum stub de dados. Todos os `it.todo()` são placeholders explícitos de teste — não há lógica de dados falsa fluindo para UI.

---

## Threat Flags

Nenhuma nova superfície de segurança introduzida. Os scaffolds são arquivos de teste somente-leitura que não criam endpoints, rotas ou acesso a banco. As variáveis de ambiente (`SUPABASE_TEST_SERVICE_KEY`) são consumidas apenas via `process.env` nunca commitadas (`.env.test.local` já está no `.gitignore` da Fase 1).

---

## Self-Check: PASSED

```
FOUND: tests/unit/campaign-metrics-schema.test.ts
FOUND: tests/unit/daily-rollups-schema.test.ts
FOUND: tests/integration/sync-jobs-rls.test.ts
FOUND: tests/integration/vault-rpc.test.ts
FOUND commit: ef153f6
FOUND commit: dccc0f3
FOUND commit: 6c54124
FOUND commit: 3c41aa3
npm test exit 0 — 7 files, 23 passed, 23 todo
```
