# Milestones

## v1.0 MVP (Shipped: 2026-07-12)

**Phases completed:** 10 phases, 46 plans, 78 tasks

**Key accomplishments:**

- Autenticação multi-tenant com isolamento total via RLS + 3 papéis (Super Admin, Cliente, Agência)
- Sincronização automática Google Ads + Meta Ads via N8N (OAuth2/token refresh, backfill 90d, sem credenciais em texto plano)
- Dashboard completo: KPIs com deltas period-over-period, trend charts, breakdown por canal com drill-down, campanhas filtráveis
- Gestão de Leads com escrita bidirecional no Google Sheets (status editável, optimistic update + revert-on-failure)
- IA (Claude) para insights: geração sob demanda + análise diária automática via N8N + detecção de anomalias de ROAS in-app
- Módulo Agência multi-cliente (grant N:N via RLS estendida) + hardening de segurança nos endpoints de leads (fechou IDOR/BOLA) + conexão Google Ads via OAuth2
- Fase 8 (tech debt): formalizou verificação retroativa da Fase 1, corrigiu bookkeeping de REQUIREMENTS.md, e limpou fixtures de teste remanescentes em produção

**Known gaps carried into v1.1 (external/ops, not code):** Google Ads Developer Token pendente de aprovação, ativação do N8N daily-insights (env vars Vercel), checagem de segurança da VPS, criação do Google Cloud OAuth Client pelo usuário — todos rastreados em `.planning/OPS-FOLLOWUPS.md`.

---
