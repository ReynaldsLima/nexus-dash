---
phase: 3
slug: dashboard-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

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
| 03-01-01 | 01 | 0 | DASH-01 | — | N/A | unit | `npm test -- tests/unit/dashboard-kpis.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | DASH-04 | — | N/A | unit | `npm test -- tests/unit/date-range-store.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | CAMP-01 | — | N/A | unit | `npm test -- tests/unit/campaign-aggregation.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | DASH-03 | — | N/A | unit | `npm test -- tests/unit/channel-split.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | TBD | TBD | SET-02 | T-03-01 | Token Meta nunca armazenado em texto plano; Route Handler verifica autenticação antes de qualquer acesso | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/dashboard-kpis.test.ts` — stubs para DASH-01 (calcDelta, aggregateRollups, period-over-period)
- [ ] `tests/unit/date-range-store.test.ts` — stubs para DASH-04 (getPresetRange, default state, last30 = 30 dias)
- [ ] `tests/unit/campaign-aggregation.test.ts` — stubs para CAMP-01 (groupCampaignMetrics, sum de métricas)
- [ ] `tests/unit/channel-split.test.ts` — stubs para DASH-03 (percentage calculation, google+meta=100%)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Meta Ads token validation e conexão | SET-02 | Requer token Meta real e conta de Ads válida | 1) Acessar /[tenant]/settings 2) Inserir Account ID e token válido 3) Verificar badge "Conectado ✓" 4) Inserir token inválido 5) Verificar mensagem de erro |
| Date range picker — calendário dual | DASH-04 | Interação visual + mouse | 1) Clicar no DateRangePicker no header 2) Verificar presets na esquerda 3) Selecionar range custom no calendário 4) Verificar que KPIs atualizam |
| Sheet drill-down — não fecha ao clicar fora | CAMP-04 | Comportamento de pointer event | 1) Clicar em campanha 2) Sheet abre 3) Clicar fora do Sheet 4) Verificar que Sheet permanece aberto |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
