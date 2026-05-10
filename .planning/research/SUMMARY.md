# Research Summary — NEXUS-DASH

**Synthesized:** 2026-05-10
**Overall confidence:** HIGH

---

## Executive Summary

NEXUS-DASH é uma plataforma de marketing analytics multi-tenant para agências digitais que gerenciam Google Ads e Meta Ads para múltiplos clientes. O stack é Next.js 15 + Supabase + N8N self-hosted + Vercel + Claude Sonnet 4.6.

A ordem de build é estritamente baseada em dependências: fundação primeiro (auth + multi-tenancy + schema), depois pipeline de dados (N8N sync), depois UI do dashboard (só faz sentido com dados reais), e finalmente AI Insights (só valioso com 7-14+ dias de métricas acumuladas).

O maior risco arquitetural é má configuração de RLS levando a vazamento de dados entre tenants — deve ser validado com testes de isolamento explícitos antes de qualquer dado real entrar no sistema.

---

## Recommended Stack

| Concern | Library / Tool | Version |
|---------|---------------|---------|
| Frontend / API | Next.js (App Router) | 15 |
| Database + Auth | Supabase (PostgreSQL + Auth + RLS) | managed |
| Automation / Sync | N8N (self-hosted on VPS) | latest stable |
| Deployment | Vercel (Hobby tier) | — |
| AI Inference | Claude API / Anthropic SDK | claude-sonnet-4-6, ^0.95.1 |
| UI Components | shadcn/ui (code-gen) | CLI 3.0 |
| Data Visualization | Recharts via shadcn/ui Chart | ^3.8.1 |
| Data Fetching / Cache | TanStack Query | ^5 |
| Supabase Cache Helpers | @supabase-cache-helpers/postgrest-react-query | ^1 |
| State Management | Zustand | ^5 |
| Form Handling | React Hook Form | ^7.75.0 |
| Schema Validation | Zod | ^4.4.3 |
| Supabase Client | @supabase/supabase-js | ^2.105.4 |
| Supabase SSR Auth | @supabase/ssr | latest |

**Rejeições explícitas:** `@supabase/auth-helpers-nextjs` (deprecated), SWR, Chakra UI, Tremor, Nivo (500kB+), TanStack Charts (alpha), Zod v3, Formik.

---

## Table Stakes Features (Must Ship in V1)

- **Date range picker com presets** — Last 7/14/30 days, This month, Last month, Custom. Default: Last 30 days.
- **Period-over-period comparison** — Delta absoluto + % colorido por polaridade da métrica (CPA cair = verde; ROAS cair = vermelho).
- **7 métricas core** — ROAS, CPA, CTR, Spend, Impressions, Clicks, Conversions.
- **Visão unificada cross-channel** — Google Ads + Meta Ads com nomes de métricas normalizados.
- **Trend visualization** — Line charts de série temporal por KPI para o período selecionado.
- **Channel breakdown** — Google vs. Meta em valores absolutos e contribuição percentual.
- **Campaign-level drill-down** — Tabela ordenável/filtrável: Campaign Name, Channel, Status, Spend, ROAS, CPA, CTR, Clicks, Conversions.
- **Multi-tenant account management** — Super Admin alterna entre tenants sem logout.
- **Data auto-sync agendado** — Google Ads a cada 3-4h, Meta a cada 6h, refresh completo 02-04h.
- **Last sync timestamp** — Por tenant, por canal. "Data de X horas atrás" é obrigatório para calibração de confiança.
- **Empty states significativos** — CTAs para conectar contas, skeleton loaders durante sync.

---

## Key Architectural Decisions

**1. Shared schema + RLS (não schema-per-tenant)**
Correto para 1-3 tenants. O padrão `(SELECT get_tenant_id())` força avaliação única por query (não por linha), eliminando penalidade de performance do RLS ingênuo.

**2. Custom Access Token Hook injeta `tenant_id` + `role` no JWT**
Isolamento do tenant via JWT claims no login — sem DB lookup por request. `app_metadata` é setado apenas pelo servidor; usuários não podem adulterá-lo.

**3. Três roles: `super_admin` (plataforma), `tenant_admin`, `viewer`**
`super_admin` vive em `auth.users.app_metadata` (não em `tenant_users`), separando acesso à plataforma de membros do tenant.

**4. Tabela `daily_rollups` como camada de query do dashboard**
Agregados diários pré-computados por tenant/plataforma desacoplam performance do dashboard da tabela `campaign_metrics` crescente. Computado pelo N8N após cada sync.

**5. N8N escreve via HTTP Request node + PostgREST REST API**
O nó nativo N8N Supabase tem bug 403 não resolvido com service_role keys (GitHub #17020). Todas as escritas do N8N usam HTTP Request node diretamente.

**6. Claude API calls em Next.js Route Handlers, não no N8N**
Centraliza gerenciamento de chave, habilita streaming para o browser, co-localiza defesas contra prompt injection. N8N aciona via webhook.

**7. `campaign_metrics` particionada por mês**
Particionamento mensal mantém performance do query planner previsível. Índices compostos em `(tenant_id, date DESC)`.

---

## Critical Watch-Outs (Phase Assignments)

### Phase 0 — Infrastructure
| Pitfall | Risco | Prevenção |
|---------|-------|-----------|
| N8N encryption key não persistida | Reboot do VPS destrói todos os tokens permanentemente | `openssl rand -hex 32` → `N8N_ENCRYPTION_KEY` antes de qualquer credencial |
| N8N editor exposto à internet | CVE-2025-68613 CVSS 10.0 RCE | HTTP basic auth + IP allowlist ou Cloudflare Access |
| Env vars não separadas por ambiente | Erros de dev afetam dados de prod | Projetos Supabase separados para prod/staging |

### Phase 1 — Auth + Schema
| Pitfall | Risco | Prevenção |
|---------|-------|-----------|
| RLS ausente em alguma tabela | Vazamento cross-tenant | Migration sempre inclui `ENABLE ROW LEVEL SECURITY` + policy. Smoke test de isolamento. |
| service_role key em código client | Compromisso total do DB | Jamais prefixar com `NEXT_PUBLIC_`. Grep antes de cada deploy. |
| RLS sem wrapper `SELECT` | Slowdown 100-1000x | Sempre `(SELECT get_tenant_id())` em cláusulas USING |
| `attribution_window` não no schema | Dados incomparáveis após migração de API Meta | Coluna desde o dia 1 |

### Phase 2 — N8N Sync
| Pitfall | Risco | Prevenção |
|---------|-------|-----------|
| Versão Google Ads API hardcoded | Todos os syncs quebram a cada ~12 meses | Constante `GOOGLE_ADS_API_VERSION` única |
| Versão Meta API hardcoded | Todos os syncs quebram a cada ~6 meses | Constante `META_API_VERSION` única |
| Meta Insights como síncrono | Resultados vazios para grandes ranges | Sempre usar padrão async: POST job → poll status → paginate |

### Phase 4 — AI Insights
| Pitfall | Risco | Prevenção |
|---------|-------|-----------|
| Prompt injection via nomes de campanhas | Extração do system prompt | Envolver dados em tags XML; system prompt instrui Claude a ignorar instruções no payload |
| Timeout Vercel 60s | 504 em análises grandes | Usar streaming responses; análise agendada via N8N (sem timeout no VPS) |
| Enviar linhas raw ao Claude | Custo 10-50x maior | Sempre enviar dados `daily_rollups` pré-agregados; alvo < 8.000 tokens dinâmicos |

---

## Open Questions (Need Resolution Before Execution)

1. **Google OAuth App Publication Status** — Deve estar em "Production" antes de conectar contas reais. Tokens em modo "Testing" expiram em 7 dias. Review do Google leva 1-4 semanas. Já foi iniciado?
2. **Meta Business Manager + System User** — System User tokens não expiram; long-lived user tokens expiram em 60 dias. Quantos dos 3 tenants iniciais têm Business Manager configurado?
3. **Google Ads Standard Access developer token** — Deve ser solicitado antes da Phase 2. Quota Basic Access pode se esgotar mesmo com 3 tenants no sync retroativo. Está em andamento?
4. **Dados de receita para ROAS** — Platform-reported ROAS requer conversion tracking correto nas contas. Como tratar tenants sem conversion value data?
5. **Janela de histórico padrão** — 90 dias é configurável. Com Basic Access do Google, isso pode pressionar a quota. Usar 30/60/90 como opção ou fixar em 90?
6. **Região do projeto Supabase** — `vercel.json` deve setar `"regions"` para coincidir com a região AWS do Supabase para latência mínima. Qual região foi criada?

---

## Roadmap Sequencing Recommendations

### Phase 0 — Infrastructure (Pré-Código)
- VPS ≥ 2 GB RAM; N8N com Postgres backend; `N8N_ENCRYPTION_KEY` persistida imediatamente; segurança do editor
- Dois projetos Supabase (prod, staging); Vercel configurado com integração Supabase
- Solicitar Google Ads Standard Access developer token
- Confirmar Meta Business Manager + System User por cliente
- Confirmar Google OAuth App Publication Status

**Gate:** N8N rodando com encryption key persistida. Vercel deploya no push.

### Phase 1 — Foundation: Auth + Multi-tenancy + Schema
- Schema completo do DB com todas as RLS policies com padrão `(SELECT get_tenant_id())`
- Custom Access Token Hook para injeção de JWT claims
- Scaffold Next.js App Router com `@supabase/ssr`, `middleware.ts`, route guards
- Teste de isolamento de 2 tenants (leituras cross-tenant DEVEM falhar)

**Gate:** Auth funciona. 2 tenants de teste existem. Isolamento cross-tenant verificado.

### Phase 2 — Data Pipeline: N8N Sync
- Workflow Google Ads sync (abstração de versão, execução sequencial, backoff exponencial)
- Workflow Meta Ads sync (abstração de versão, padrão Insights async, monitoramento BUC quota)
- `sync_jobs` tracking; webhook N8N receiver no Next.js
- Spot-check dos dados contra interfaces nativas Google/Meta (±1-2%)

**Gate:** Métricas fluindo diariamente para ambas plataformas. Números batem com UIs nativas.

### Phase 3 — Dashboard UI
- Computação `daily_rollups` (workflow N8N pós-sync)
- Dashboard Overview: KPI cards, deltas período a período, channel charts, trend lines
- Date range picker global (Zustand, persiste na navegação)
- Lista de campanhas com tabela ordenável/filtrável e drill-down
- Tenant switcher do Super Admin
- Settings: conexão de contas, status do sync, avisos de reconexão

**Gate:** Super Admin vê dados de todos os tenants pela UI. Date filtering funciona.

### Phase 4 — AI Insights
- Route Handler `/api/insights/generate`: streaming, injeção de dados com tags XML, prompt caching, Batch API para runs agendados
- UI de Insights: trigger manual (Super Admin), exibição de recomendações com tipo/prioridade/ação/impacto, histórico
- Workflow N8N agendado diário (05:00 UTC após ambos os syncs)
- Circuit breaker (máx 10 chamadas Claude/hora), log de `token_usage`

**Gate:** Insights gerando recomendações acionáveis. Custo/dia dentro do estimado (~$0.04/tenant). Sem vetores de prompt injection.

### Phase 5 — Operations + Hardening
- Monitoramento tamanho banco Supabase; plano de upgrade para Pro antes de 400 MB
- Pruning histórico de execuções N8N
- `gen:types` automatizado no CI/CD
- Política de retenção de 18 meses em `campaign_metrics`
- Runbooks de upgrade de versão de API (Meta: a cada 5 meses; Google: anualmente)

---

## Confidence Assessment

| Área | Confiança | Notas |
|------|-----------|-------|
| Stack | HIGH | Todas as escolhas confirmadas por docs oficiais e npm registry |
| Features | MEDIUM-HIGH | Pesquisa competitiva cross-referenciada. Mudanças de attribution window Meta confirmadas no changelog oficial |
| Architecture | HIGH | Padrões RLS, JWT hook, particionamento sourced dos docs oficiais Supabase e documentação AWS PostgreSQL |
| Pitfalls | HIGH | Datas de deprecação de API de blogs oficiais Google/Meta. CVEs N8N de pesquisa Upwind Security |

**Lacunas primárias que precisam de validação:**
- `@supabase-cache-helpers/postgrest-react-query@^1` — spike recomendado antes de commitar como camada principal de cache
- Padrão de interação Claude Batch API + prompt caching — documentado mas com evidência limitada em produção nesta escala
