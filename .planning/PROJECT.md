# NEXUS-DASH

## What This Is

NEXUS-DASH é uma plataforma de marketing analytics multi-tenant construída sobre Next.js, Supabase e N8N. Consolida métricas de Google Ads e Meta Ads em um dashboard unificado, com sincronização automática via N8N e recomendações de otimização de campanhas geradas por IA (Claude). Começa como ferramenta interna para gerenciar 1-3 clientes, com arquitetura projetada para evoluir para SaaS público.

## Core Value

O Super Admin consegue ver e otimizar campanhas de todos os clientes em um único lugar, com recomendações de IA acionáveis — sem precisar entrar em múltiplas plataformas de anúncios.

## Requirements

### Validated

- [x] Autenticação com isolamento total por tenant (Supabase Auth + RLS) — Validated in Phase 1: Foundation
- [x] Três roles: Super Admin (plataforma), Tenant Admin, Viewer — Validated in Phase 1: Foundation
- [x] Super Admin cria tenants manualmente, sem self-service no v1 — Validated in Phase 1: Foundation
- [x] Sincronização automática de métricas Google Ads via N8N (agendado) — Validated in Phase 2: Data Pipeline (workflow pronto; ativação aguarda Developer Token)
- [x] Sincronização automática de métricas Meta Ads via N8N (agendado) — Validated in Phase 2: Data Pipeline (workflow pronto; ativação aguarda System User tokens)
- [x] Schema de dados de campanha (campaign_metrics, ad_accounts, sync_jobs, daily_rollups) com RLS — Validated in Phase 2: Data Pipeline
- [x] Último sync timestamp por tenant/channel visível ao Super Admin — Validated in Phase 2: Data Pipeline (SyncStatusSection em /tenants)
- [x] Gestão de leads com status editável, escrito de volta na planilha Google Sheets de origem (Super Admin/Tenant Admin) — Validated in Phase 03.1: Leads Management via Google Sheets Integration
- [x] Geração de insights de IA sob demanda (botão no dashboard), apenas Super Admin — Validated in Phase 4: AI Insights (streaming via Vercel AI SDK, código completo; ativação N8N/UAT ao vivo pendente em 04-HUMAN-UAT.md)
- [x] Análise automática de IA diária via N8N, apenas Super Admin visualiza — Validated in Phase 4: AI Insights (rota + workflow N8N completos; import/ativação em produção pendente)
- [x] Página Insights de IA com histórico de recomendações e alertas de anomalia de ROAS in-app — Validated in Phase 4: AI Insights

### Active

- [ ] Janela de histórico retroativo configurável por tenant ao conectar conta
- [ ] Dashboard Overview com KPIs consolidados (ROAS, CPA, CTR, Spend) de todos os canais
- [ ] Drill-down por canal e campanha a partir do Overview
- [ ] Página Campanhas com lista filtrável por período e canal
- [ ] Página Configurações do tenant: conexão de contas Google/Meta, tokens, sync

### Out of Scope

- ~~Google Sheets como data source~~ — Superado: já era usado em produção antes do fluxo GSD (leitura de leads); Phase 03.1 formalizou o path de leitura existente e adicionou escrita (status write-back). Decisão original assumia partir do zero — não se aplicava a código já em produção.
- Self-service de cadastro de tenants — admin cria manualmente no v1
- Integrações TikTok/LinkedIn/outros canais — apenas Google Ads e Meta no v1
- ~~Roles adicionais ou permissões granulares além de Super Admin / Tenant Admin / Viewer~~ — Superado: Phase 5 introduziu o módulo Agência (grant N:N via agency_tenants) e colapsou Tenant Admin/Viewer em um papel único (Cliente).

## Context

- Arquivos de estratégia existentes no diretório: `estrategia-seo-ads.html`, `estrategia_trafego_completa.xlsx`, `n8n_flows_importaveis.json` — podem alimentar contexto inicial de campanhas ou servir como referência para flows N8N
- N8N será self-hosted em VPS (não N8N Cloud) — flexibilidade total de execuções e webhooks
- Deploy na Vercel com branch strategy simples: push em `main` → deploy automático em produção
- Plataforma começa como uso interno, roadmap considera evolução para SaaS público futuro

## Constraints

- **Tech Stack**: Next.js (App Router) + Supabase + N8N self-hosted + Vercel — definido e não negociável no v1
- **AI Provider**: Claude (Anthropic) — claude-sonnet-4-6 para análise de campanhas
- **Budget**: Free/Hobby tiers — Vercel Hobby, Supabase Free, VPS de custo mínimo para N8N
- **Tenants v1**: 1-3 clientes máximo, admin gerencia manualmente — sem UI de onboarding
- **CI/CD**: main → Vercel prod automático — sem PR review gates no v1
- **Segurança**: Row Level Security no Supabase obrigatório — isolamento total entre tenants

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| N8N self-hosted em VPS | Execuções ilimitadas vs limitação do free tier N8N Cloud (2.500/mês) | — Pending |
| Claude como AI provider | Melhor raciocínio analítico para dados de campanha; já é o modelo da sessão | — Pending |
| RLS como camada de segurança primária | Isolamento garantido no banco, não apenas na aplicação | — Pending |
| Google Sheets fora do v1 | Complexidade de sincronização sem benefício claro com base pequena de tenants | Revertida — já em uso em produção pré-GSD; formalizada e estendida (escrita) na Phase 03.1 |
| Insights de IA apenas para Super Admin | Centraliza custo de API e controle de qualidade das recomendações | Validado na Phase 4 — RLS super_admin-only em `ai_insights`/`anomaly_alerts`, UI/nav ocultos para outros papéis |
| main → prod direto | Projeto interno v1, overhead de PR review não justificado agora | — Pending |
| Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) em vez de `@anthropic-ai/sdk` direto | Streaming token-a-token (`streamText`) e prompt/tool abstractions prontas, mesma API Messages da Claude por baixo | Adotado na Phase 4 (04-CONTEXT.md D-01) — desvio documentado da tabela de bibliotecas do CLAUDE.md, ambos chamam `claude-sonnet-4-6` |

## Evolution

Este documento evolui em transições de fase e marcos de milestone.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requirements invalidados? → Mover para Out of Scope com motivo
2. Requirements validados? → Mover para Validated com referência da fase
3. Novos requirements emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se divergiu

**Após cada milestone** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value check — ainda a prioridade certa?
3. Auditoria Out of Scope — motivos ainda válidos?
4. Atualizar Context com estado atual

---
*Last updated: 2026-07-11 after Phase 4: AI Insights*
