---
status: partial
phase: 03-dashboard-ui
source: [03-VERIFICATION.md]
started: 2026-06-05T01:26:00Z
updated: 2026-06-05T18:35:00Z
---

## Current Test

[aguardando UAT visual do ChannelSheet]

## Tests

### 1. Apply migrations 0013 + 0014 ao Supabase remoto
expected: `create_or_update_vault_secret` RPC existe no banco; `authenticator` não tem execute permission.
result: PASSED — REVOKE aplicado via SQL Editor em 2026-06-05; HTTP 401 confirmado para callers anon/authenticated.

### 2. Decisão de produto — channel drill-down no PieChart (ROADMAP SC3)
expected: Decisão explícita: (a) display-only ou (b) gap closure.
result: RESOLVED — Opção (b) escolhida; GAP-03-01 implementado via Plan 06 (2026-06-05).

### 3. UAT visual do ChannelSheet — clicar em Google Ads e Meta Ads no PieChart
expected: Sheet lateral abre com (1) AreaChart de gasto diário do canal, (2) 6 métricas agregadas (Impressões, Cliques, CTR, Gasto, Conversões, ROAS), (3) top 5 campanhas ordenadas por spend desc. Sheet NÃO fecha ao clicar fora — apenas X ou Esc.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- GAP-03-01: Channel click drill-down no PieChart — status: closed (Plan 06 executado)
