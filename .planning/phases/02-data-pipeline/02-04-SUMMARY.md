---
phase: 02-data-pipeline
plan: "04"
subsystem: infra
tags: [n8n, meta-ads, marketing-api, workflow, supabase, vault, pagination]

# Dependency graph
requires:
  - phase: 02-data-pipeline
    provides: "Schema campaign_metrics, sync_jobs, daily_rollups, rpc/read_vault_secret, rpc/refresh_daily_rollups (Plan 02)"
  - phase: 02-data-pipeline
    provides: "Padrão estrutural google-ads-sync.json: Set Constants, sync_jobs lifecycle, error handling (Plan 03)"
provides:
  - "n8n-workflows/meta-ads-sync.json — workflow N8N exportável, multi-tenant Meta Ads sync agendado a cada 6h"
  - "Paginação cursor-based Meta Marketing API v24.0"
  - "System User token lookup via Supabase Vault (rpc/read_vault_secret)"
  - "Backfill 90d na primeira execução, incremental 2d nas seguintes"
  - "SYNC-02 (pipeline Meta Ads), SYNC-04 (upsert campaign_metrics), SYNC-05 (attribution_window 7d_click), SYNC-06 (API version como constante)"
affects: [02-data-pipeline, 03-dashboard-ui, 04-ai-insights]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "META_ADS_API_VERSION definida em Set Constants — expressão referenciada em todos os nodes HTTP Meta (SYNC-06)"
    - "action_attribution_windows ATTRIBUTION_WINDOWS_JSON como constante única ('7d_click','1d_view') — Pitfall 3 (7d_view removido jan/2026)"
    - "act_ prefix guard: String(rawAcc).startsWith('act_') ? rawAcc : `act_${rawAcc}`"
    - "Paginação cursor: Code 'Accumulate page + extract next' + IF 'More pages?' loop"
    - "Error sanitization: regex remove access_token=[A-Za-z0-9._-]+ do error_message antes de PATCH sync_jobs (T-2-04-01)"
    - "Isolamento multi-tenant: tenant_id lido de ad_accounts.tenant_id por linha do loop, nunca inferido"

key-files:
  created:
    - n8n-workflows/meta-ads-sync.json
  modified: []

key-decisions:
  - "Import manual no N8N adiado: JSON validado estruturalmente — import será feito quando System User token de cada tenant for configurado no Supabase Vault (aprovado pelo usuário)"
  - "attribution_window fixado como '7d_click' (nunca '7d_view') — remoção por Meta em jan/2026 (Pitfall 3 do RESEARCH.md)"
  - "META_ADS_API_VERSION como constante única em Set Constants — zero hardcodes inline (SYNC-06)"
  - "Paginação cursor-based acumula todas as páginas antes do map/upsert — simplicidade sobre streaming por lote"
  - "Token de Sistema do Usuário sanitizado no error_message antes de gravar em sync_jobs (threat T-2-04-01)"

patterns-established:
  - "Meta Ads sync: mesmo lifecycle de sync_jobs do Google Ads (open running → success/failed)"
  - "Vault lookup: POST /rpc/read_vault_secret com p_secret_name = 'tenant_<slug>_meta_system_token'"
  - "Backfill detection: ausência de sync_jobs.status='success' para o canal → today - 90d"

requirements-completed: [SYNC-02, SYNC-04, SYNC-05, SYNC-06]

# Metrics
duration: 45min
completed: 2026-05-16
---

# Phase 02 Plan 04: Meta Ads Sync Summary

**Workflow N8N multi-tenant Meta Ads Sync com 18 nodes: paginação cursor-based, System User token via Supabase Vault, constante META_ADS_API_VERSION v24.0, backfill 90d, atribuição '7d_click'**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-16
- **Completed:** 2026-05-16
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Criado `n8n-workflows/meta-ads-sync.json` com 18 nodes completos, JSON válido e importável via N8N UI
- Implementada paginação cursor-based completa: Code "Accumulate page + extract next" + IF "More pages?" — cobre Pitfall 10 do RESEARCH.md
- Segurança: token de Sistema do Usuário nunca em texto plano no JSON; sanitização via regex no error_message antes de gravar em sync_jobs (threat T-2-04-01)
- Checkpoint humano aprovado pelo usuário: JSON validado estruturalmente; import no N8N adiado para quando tokens forem provisionados

## Task Commits

1. **Task 1: Criar n8n-workflows/meta-ads-sync.json (18 nodes)** - `1c702bf` (feat)
2. **Task 2: human-verify checkpoint** - aprovado sem commit adicional (import adiado — decisão do usuário)

**Plan metadata:** (este SUMMARY — docs)

## Files Created/Modified

- `n8n-workflows/meta-ads-sync.json` — Workflow N8N exportável "Meta Ads Sync": Schedule Trigger (0 */6 * * *), Set Constants (META_ADS_API_VERSION='v24.0', BACKFILL_DAYS=90, INCREMENTAL_DAYS=2, ATTRIBUTION_WINDOWS_JSON='["7d_click","1d_view"]'), List ad_accounts, Loop tenants, Check first sync, Compute date range, Open sync_job, Read vault secret, Init pagination cursor, Meta Insights paged, Accumulate page + extract next, More pages? (IF), Map Meta results (parser actions/action_values), Upsert campaign_metrics, Refresh daily_rollups, Close sync_job (success), Error: Close sync_job (failed), Continue loop

## Decisions Made

- **Import N8N adiado:** Usuário aprovou pular o import manual; o JSON foi validado automaticamente. Import no N8N será feito quando o System User token for configurado para cada tenant no Supabase Vault.
- **attribution_window = '7d_click':** Meta removeu suporte a '7d_view' em jan/2026 (Pitfall 3) — fixado como literal no Code node "Map Meta results" e como constante ATTRIBUTION_WINDOWS_JSON em Set Constants.
- **Paginação acumulada (não streaming):** Todas as páginas acumuladas em `all_rows` antes do map — simplicidade e compatibilidade com o padrão google-ads-sync.json.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito. Checkpoint Task 2 aprovado pelo usuário com decisão de adiar o import para quando os tokens estiverem prontos.

## Issues Encountered

Nenhum problema técnico. O único ponto de atenção é operacional: o workflow está estruturalmente completo mas permanecerá `active: false` até que:
1. System User token de cada tenant seja inserido no Supabase Vault
2. Credencial "Supabase Service Role" seja atribuída nos nodes HTTP que falam com Supabase
3. UUID do vault_secret seja registrado em `ad_accounts.vault_secret_id`

## User Setup Required

Antes de ativar o workflow no N8N:

1. **Gerar System User token** em https://business.facebook.com → Business Settings → System Users → Generate Token (permissão `ads_read` em cada Ad Account de cada tenant)

2. **Inserir token no Supabase Vault** (SQL Editor):
   ```sql
   SELECT vault.create_secret('<TOKEN>', 'tenant_<slug>_meta_system_token', 'Meta System User token');
   -- anotar o UUID retornado
   ```

3. **Registrar ad_account** (SQL Editor):
   ```sql
   INSERT INTO public.ad_accounts (tenant_id, channel, account_id, vault_secret_id, active)
   VALUES ('<tenant_uuid>', 'meta_ads', 'act_<ad_account_id>', '<vault_secret_uuid>', true);
   ```

4. **Importar workflow** no N8N: https://evo.wrdigitalgroup.com.br → Workflows → Import from File → `n8n-workflows/meta-ads-sync.json`

5. **Atribuir credential** "Supabase Service Role" nos nodes HTTP que falam com Supabase

6. **Ativar workflow** — primeira execução detectará ausência de sync_jobs e fará backfill de 90 dias

## Known Stubs

Nenhum stub — o workflow não tem dados fictícios nem placeholders. Todos os campos são lidos de Supabase (ad_accounts, vault) em runtime.

## Next Phase Readiness

- Plan 05 (Wave 3) — UI Sync Status: pode ser iniciado. Depende de `sync_jobs` (criado no Plan 02) e da pipeline de dados desta plan. O workflow JSON está pronto para ser ativado assim que os tokens forem provisionados.
- Plans 03 e 04 completos — ambas as pipelines (Google Ads e Meta Ads) têm seus workflows JSON criados e prontos.
- Bloqueador remanescente: Google Ads Developer Token ainda pendente (Phase 2 blocker geral).

---
*Phase: 02-data-pipeline*
*Completed: 2026-05-16*
