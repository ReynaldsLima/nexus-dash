---
phase: 2
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (existente da Fase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | SYNC-04, SYNC-05 | T-2-01 | Schema constraints enforced (attribution_window NOT NULL, UNIQUE key) | unit | `npm test -- --grep "campaign_metrics"` | ❌ Wave 0 | ⬜ pending |
| 2-01-02 | 01 | 0 | SYNC-04 | T-2-02 | sync_jobs RLS: tenant só vê próprios jobs | integration | `npm test -- --grep "sync_jobs"` | ❌ Wave 0 | ⬜ pending |
| 2-01-03 | 01 | 0 | SYNC-04 | T-2-03 | read_vault_secret rejeita chamadas sem service_role | integration | `npm test -- --grep "vault"` | ❌ Wave 0 | ⬜ pending |
| 2-01-04 | 01 | 0 | SYNC-05 | — | daily_rollups UNIQUE(tenant_id, channel, date) enforced | unit | `npm test -- --grep "daily_rollups"` | ❌ Wave 0 | ⬜ pending |
| 2-02-01 | 02 | 1 | SYNC-01, SYNC-06 | — | Google Ads workflow JSON exportável (não credenciais literais) | Manual | Verificar n8n-workflows/google-ads-sync.json | N/A | ⬜ pending |
| 2-02-02 | 02 | 1 | SYNC-02, SYNC-06 | — | Meta Ads workflow JSON exportável | Manual | Verificar n8n-workflows/meta-ads-sync.json | N/A | ⬜ pending |
| 2-03-01 | 03 | 2 | SYNC-03 | — | Sync status visível na /tenants page | Manual | Browser smoke test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/campaign-metrics-schema.test.ts` — testa constraints da tabela (NOT NULL, UNIQUE, CHECK em channel e attribution_window)
- [ ] `tests/unit/daily-rollups-schema.test.ts` — testa schema daily_rollups + constraint UNIQUE(tenant_id, channel, date)
- [ ] `tests/integration/sync-jobs-rls.test.ts` — testa RLS: tenant_admin só vê sync_jobs do próprio tenant; cross-tenant query retorna zero rows
- [ ] `tests/integration/vault-rpc.test.ts` — testa que `read_vault_secret` rejeita chamadas sem service_role

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Ads workflow busca e grava métricas | SYNC-01 | Requer Developer Token + credenciais OAuth2 reais (bloqueado) | Após token aprovado: ativar workflow no N8N, verificar sync_jobs status=success e campaign_metrics com dados |
| Meta Ads workflow busca e grava métricas | SYNC-02 | Requer System User Token real + ad_account_id | Inserir token no Vault, ativar workflow, verificar sync_jobs e campaign_metrics |
| Último sync timestamp visível na UI | SYNC-03 | Requer dados reais em sync_jobs | Após SYNC-01/02 rodarem: verificar /tenants page mostra timestamp por tenant/channel |
| API version não hardcoded nos workflows | SYNC-06 | Code review do JSON exportado | Grep em google-ads-sync.json e meta-ads-sync.json: nenhuma ocorrência de "v21" ou "v24.0" fora da constante do topo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
