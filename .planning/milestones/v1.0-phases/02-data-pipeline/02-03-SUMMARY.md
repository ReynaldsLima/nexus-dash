---
phase: 02-data-pipeline
plan: "03"
subsystem: infra
tags: [n8n, google-ads, oauth2, postgrest, supabase, workflow, sync]

# Dependency graph
requires:
  - phase: 02-data-pipeline/02-02
    provides: "schema campaign_metrics, sync_jobs, ad_accounts, funções read_vault_secret e refresh_daily_rollups"
provides:
  - "Workflow N8N 'Google Ads Sync' em n8n-workflows/google-ads-sync.json — importável via N8N UI"
  - "Pipeline multi-tenant: OAuth2 refresh → SearchStream → upsert campaign_metrics → refresh_daily_rollups → sync_jobs"
  - "Schedule Trigger cron 0 */3 * * * configurado"
  - "Constante GOOGLE_ADS_API_VERSION=v21 centralizada em Set Constants node (SYNC-06)"
  - "Backfill 90d na primeira execução, incremental 2d nas subsequentes"
affects: [03-dashboard-ui, 04-ai-insights]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "N8N workflow: API version centralizada em Set Constants node — nunca hardcoded inline (SYNC-06)"
    - "N8N workflow: credentials referenciadas por nome ($credentials) — nunca literais no JSON exportado"
    - "N8N workflow: loop multi-tenant via Split In Batches + detecção first sync via sync_jobs"
    - "N8N workflow: error handler sanitiza Bearer token antes de gravar error_message em sync_jobs"

key-files:
  created:
    - n8n-workflows/google-ads-sync.json
  modified: []

key-decisions:
  - "Workflow entregue como JSON inativo (active: false) — ativação manual após Developer Token aprovado"
  - "Import manual no N8N adiado: validação estrutural automática aprovada, import físico fica para quando Developer Token (Basic Access) chegar"
  - "Workflow usa Split In Batches (batchSize:1) para loop multi-tenant — garante isolamento e error recovery por tenant"
  - "error_message em sync_jobs sanitizado via regex replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer ***') — T-2-03-06"

patterns-established:
  - "Pattern: N8N HTTP Request nodes com autenticação sempre via N8N Credential — nunca apikey/token literal no workflow JSON"
  - "Pattern: backfill detection via ausência de sync_jobs com status=success para o tenant+channel"

requirements-completed: [SYNC-01, SYNC-04, SYNC-05, SYNC-06]

# Metrics
duration: ~30min
completed: "2026-05-16"
---

# Phase 02 Plan 03: Google Ads Sync Workflow Summary

**Workflow N8N "Google Ads Sync" com 16 nodes — OAuth2 refresh flow, Google Ads SearchStream v21, upsert multi-tenant em campaign_metrics via PostgREST, backfill 90d + incremental 2d, sem nenhuma credencial em texto plano no JSON exportado**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-16T22:20:00Z
- **Completed:** 2026-05-16T22:52:09Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify aprovado)
- **Files modified:** 1

## Accomplishments

- Workflow JSON completo com 16 nodes cobrindo todo o fluxo: Schedule Trigger → fetch ad_accounts → loop tenants → first-sync detection → open sync_job → read Vault → OAuth2 refresh → SearchStream → map results → upsert campaign_metrics → refresh_daily_rollups → close sync_job (success/failed paths)
- Constante `GOOGLE_ADS_API_VERSION = 'v21'` em nó único "Set Constants" — todas as chamadas à Google Ads API referenciam via expressão `={{$('Set Constants').item.json.GOOGLE_ADS_API_VERSION}}` (SYNC-06)
- Threat mitigations aplicadas: credentials referenciadas por nome, Bearer tokens sanitizados no error handler antes de gravar em sync_jobs (T-2-03-01, T-2-03-06)
- Checkpoint human-verify aprovado pelo operador com validação estrutural automática; import físico no N8N adiado para quando Developer Token (Basic Access) for aprovado

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Criar n8n-workflows/google-ads-sync.json (16 nodes)** - `d53dd11` (feat)
2. **Task 2: Human-verify checkpoint** - aprovado sem commit adicional (nenhuma mudança de código)

**Plan metadata:** a ser gerado pelo commit final deste SUMMARY

## Files Created/Modified

- `n8n-workflows/google-ads-sync.json` — Workflow N8N exportável com 16 nodes, Schedule Trigger cron `0 */3 * * *`, multi-tenant loop, OAuth2 refresh flow, Google Ads SearchStream, upsert PostgREST com `on_conflict`, backfill/incremental detection, sync_jobs lifecycle

## Decisions Made

- **Workflow inativo por padrão:** `"active": false` no JSON exportado — operador ativa manualmente após importar, atribuir credentials e confirmar Developer Token
- **Import manual adiado:** Usuário aprovou pular o import físico no N8N por ora — workflow será importado quando o Developer Token Google Ads (Basic Access) chegar (prazo 2-10+ dias úteis)
- **Backfill logic:** detecção de first sync via ausência de `sync_jobs` com `status='success'` para o par `tenant_id + channel` — robusto a restarts parciais
- **Error isolation:** falha de um tenant grava `sync_jobs.status='failed' + error_message` (com sanitização de Bearer tokens) e continua para o próximo tenant via Split In Batches

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito.

O checkpoint human-verify foi aprovado com nota do operador: "aprovado — pular import manual por ora. Workflow JSON validado automaticamente. Import no N8N será feito quando o Developer Token chegar."

## Issues Encountered

Nenhum problema durante a execução. O BLOCKER pré-existente (Google Ads Developer Token pendente de aprovação) foi documentado na STATE.md e não bloqueia a entrega deste plano — o workflow é entregue como artefato inativo.

## User Setup Required

Quando o Google Ads Developer Token (Basic Access) for aprovado:

1. **N8N → Credentials** — criar (nomes obrigatórios para que as expressões do workflow resolvam):
   - `Supabase Service Role` (Header Auth: `apikey` + `Authorization Bearer {{SERVICE_ROLE_KEY}}`)
   - `Google OAuth Credentials` (client_id + client_secret do Google Cloud Console)
   - `Google Ads Dev Token` (developer-token header value após aprovação)

2. **N8N → Workflows → Import from File** — importar `n8n-workflows/google-ads-sync.json`, atribuir credentials nos nodes

3. **Supabase Vault** — inserir refresh_token de cada tenant:
   ```sql
   SELECT vault.create_secret('<refresh_token>', 'tenant_<slug>_google_refresh_token', 'Google Ads refresh token');
   ```
   Copiar o UUID retornado e atualizar `ad_accounts.vault_secret_id` para o tenant correspondente.

4. **Ativar workflow** — toggle "Active" no N8N após credentials e Vault configurados

## Next Phase Readiness

- `n8n-workflows/google-ads-sync.json` está pronto para import
- Tabelas `campaign_metrics`, `sync_jobs`, `ad_accounts` e funções `read_vault_secret` / `refresh_daily_rollups` já existem (criadas em 02-02)
- **Bloqueador pendente:** Workflow não pode ser ativado contra Google Ads real até Developer Token aprovado — Phase 3 (Dashboard UI) pode ser desenvolvida em paralelo com dados mock/seed

### Blocker Status

| Blocker | Status | Próximo passo |
|---------|--------|--------------|
| Google Ads Developer Token (Basic Access) | PENDENTE — aguardando aprovação | Submeter em https://ads.google.com/aw/apicenter se ainda não submetido |
| N8N CVE-2025-68613 | UNVERIFIED | SSH na VPS — verificar versão >= 1.88.0 |
| Meta Business Manager System User | UNVERIFIED | Confirmar acesso por tenant antes de Phase 2 Plan 04 |

---
*Phase: 02-data-pipeline*
*Completed: 2026-05-16*
