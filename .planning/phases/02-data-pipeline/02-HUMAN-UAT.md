---
status: partial
phase: 02-data-pipeline
source: [02-VERIFICATION.md]
started: 2026-05-16T20:15:00.000Z
updated: 2026-05-16T20:15:00.000Z
---

## Current Test

[aguardando verificação humana dos workflows com dados reais]

## Tests

### 1. Execução real Meta Ads Sync (sem blocker externo)
expected: Após provisionar System User token e ativar workflow no N8N — sync_jobs.status='success', campaign_metrics com dados reais, diferença ≤2% em relação ao Meta Ads Manager
result: [pending]

### 2. Execução real Google Ads Sync (bloqueado por Developer Token)
expected: Após aprovação do Google Ads Basic Access Developer Token, provisionar credentials no N8N, ativar workflow — sync_jobs.status='success', records_synced > 0, valores em campaign_metrics com diferença ≤2% em relação ao Google Ads UI nativo
result: [blocked — Google Ads Developer Token pending approval]

## Summary

total: 2
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 1

## Gaps
