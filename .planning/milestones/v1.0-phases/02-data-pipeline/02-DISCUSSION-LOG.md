# Phase 2: Data Pipeline — Discussion Log

**Session:** 2026-05-16
**Format:** Gray area selection → deep-dive per área

---

## Gray Areas Identificadas

6 gray areas identificadas; 4 selecionadas para discussão:
1. Schema de campaign_metrics — selecionada
2. Credenciais de API por tenant — selecionada
3. Configuração de tenants no N8N — selecionada
4. Backfill retroativo — selecionada
5. Retry/resiliência (não selecionada — coberta indiretamente em N8N)
6. SYNC-03 sync status na UI (não selecionada — capturado em D-18 como Claude's Discretion)

---

## Discussão: Schema de campaign_metrics

**Q: Granularidade — day-level vs hour-level?**
R: Day-level. Suficiente para todos os presets de date range da Fase 3.

**Q: Tabela unificada vs separadas por plataforma?**
R: Tabela única com coluna `channel`. Queries cross-channel mais simples.

**Q: Campos adicionais?**
R: Incluir conversion_value (para ROAS), status da campanha, e ad_group_id/adset_id (para eventual drill-down).

---

## Discussão: Credenciais de API por tenant

**Q: Onde armazenar tokens?**
R: Tabela `ad_accounts` no banco. Em v1, Super Admin insere via Supabase Dashboard. Settings UI da Fase 3 usa a mesma tabela.

**Q: Criptografia dos tokens?**
R: Supabase Vault (AES-256). Mesmo v1 interno, prática correta para futuro SaaS.

---

## Discussão: Configuração de tenants no N8N

**Q: Um workflow por tenant ou workflow multi-tenant?**
R: Workflow multi-tenant. Um workflow Google Ads e um Meta Ads, iterando sobre ad_accounts ativos.

**Q: Comportamento em falha de sync de um tenant?**
R: Registra status=failed em sync_jobs com error_message e continua para o próximo tenant.

---

## Discussão: Backfill Retroativo

**Q: Quantos dias de histórico?**
R: 90 dias fixo.

**Q: Trigger automático ou manual?**
R: Automático na primeira execução — workflow detecta ausência de sync_jobs para o tenant.

---

## Decisão Extra: daily_rollups

**Q: Como popular daily_rollups?**
R: Função Postgres chamada pelo N8N via PostgREST RPC após cada sync. Abordagem simples, atomic, sem infra extra.
