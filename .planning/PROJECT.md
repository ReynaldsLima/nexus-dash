# NEXUS-DASH

## What This Is

NEXUS-DASH é uma plataforma de marketing analytics multi-tenant construída sobre Next.js, Supabase e N8N. Consolida métricas de Google Ads e Meta Ads em um dashboard unificado, com sincronização automática via N8N, gestão de leads com escrita bidirecional no Google Sheets, e recomendações de otimização de campanhas geradas por IA (Claude). Suporta hoje três perfis de acesso — Super Admin, Cliente (tenant) e Agência (gerencia N clientes via grant) — com RLS garantindo isolamento total entre tenants. Começou como ferramenta interna para gerenciar 1-3 clientes, com arquitetura projetada para evoluir para SaaS público.

## Core Value

O Super Admin consegue ver e otimizar campanhas de todos os clientes em um único lugar, com recomendações de IA acionáveis — sem precisar entrar em múltiplas plataformas de anúncios.

## Requirements

### Validated

- [x] Autenticação com isolamento total por tenant (Supabase Auth + RLS) — Validated in Phase 1: Foundation
- [x] Três roles: Super Admin (plataforma), Tenant Admin, Viewer — Validated in Phase 1: Foundation. Superado na Phase 5: "Viewer" foi descontinuado (banco não aceita mais esse valor desde a migration 0020) e um novo papel "Agência" foi introduzido — o conjunto real hoje é Super Admin / Cliente (ex-Tenant Admin) / Agência.
- [x] Super Admin cria tenants manualmente, sem self-service no v1 — Validated in Phase 1: Foundation
- [x] Sincronização automática de métricas Google Ads via N8N (agendado) — Validated in Phase 2: Data Pipeline (workflow pronto; ativação aguarda Developer Token)
- [x] Sincronização automática de métricas Meta Ads via N8N (agendado) — Validated in Phase 2: Data Pipeline (workflow pronto; ativação aguarda System User tokens)
- [x] Schema de dados de campanha (campaign_metrics, ad_accounts, sync_jobs, daily_rollups) com RLS — Validated in Phase 2: Data Pipeline
- [x] Último sync timestamp por tenant/channel visível ao Super Admin — Validated in Phase 2: Data Pipeline (SyncStatusSection em /tenants)
- [x] Gestão de leads com status editável, escrito de volta na planilha Google Sheets de origem (Super Admin/Tenant Admin) — Validated in Phase 03.1: Leads Management via Google Sheets Integration
- [x] Geração de insights de IA sob demanda (botão no dashboard), apenas Super Admin — Validated in Phase 4: AI Insights (streaming via Vercel AI SDK, código completo; ativação N8N/UAT ao vivo pendente em 04-HUMAN-UAT.md)
- [x] Análise automática de IA diária via N8N, apenas Super Admin visualiza — Validated in Phase 4: AI Insights (rota + workflow N8N completos; import/ativação em produção pendente)
- [x] Página Insights de IA com histórico de recomendações e alertas de anomalia de ROAS in-app — Validated in Phase 4: AI Insights
- [x] Endpoints de leads (GET/PATCH/POST chat) verificam autorização server-side via `get_user_role()` + `getClaims()`, nunca confiando em tenant/agency vindo do client — Validated in Phase 6: Security & Consistency — Leads Endpoints (fecha o gap AGENCY-08 e o achado de auditoria F3: chat de IA não comitado e sem rate limit)
- [x] Página Configurações do tenant: conexão de contas Google/Meta, tokens, sync — Validated in Phase 7: Google Ads OAuth2 Connect (SET-01, gap closure). Meta Ads (SET-02, System User token) já validado na Phase 3; Google Ads via OAuth2 completo — fluxo de conexão e armazenamento de credencial no Vault código-completo e unit-verificado. Verificação manual end-to-end ao vivo ainda pendente da criação do Google Cloud OAuth Client pelo usuário (D-03), mesma classe de bloqueio externo do Developer Token da Phase 2.
- [x] Dashboard Overview com KPIs consolidados (ROAS, CPA, CTR, Spend) de todos os canais — Validated in Phase 3: Dashboard UI (DASH-01/02/03, `03-VERIFICATION.md`); bookkeeping corrigido na Phase 8 (estava marcado como Active por atraso de documentação, não por trabalho pendente)
- [x] Drill-down por canal e campanha a partir do Overview — Validated in Phase 3: Dashboard UI (DASH-03-ext via ChannelSheet + CAMP-04 via CampaignSheet, `03-VERIFICATION.md`); bookkeeping corrigido na Phase 8
- [x] Página Campanhas com lista filtrável por período e canal — Validated in Phase 3: Dashboard UI (CAMP-01/02/03, `03-VERIFICATION.md`); bookkeeping corrigido na Phase 8

### Active

- [ ] Janela de histórico retroativo configurável por tenant ao conectar conta
- [ ] Gestão completa de usuários (listar, editar, remover) para tenants e agências — hoje só existe criação; edição/remoção de usuário só é possível via Supabase Dashboard direto
- [ ] Limpar o papel "viewer" morto do código (`Role` type, `proxy.ts`) — banco não aceita mais esse valor desde a migration `0020` (Phase 5), mantido hoje só como fallback de rollout-safety
- [ ] Redesign visual das telas (dashboard, campanhas, insights, settings) — usuário vai fornecer referências visuais (prints) e há protótipos HTML soltos em `prototipos/` como ponto de partida

### Out of Scope

- ~~Google Sheets como data source~~ — Superado: já era usado em produção antes do fluxo GSD (leitura de leads); Phase 03.1 formalizou o path de leitura existente e adicionou escrita (status write-back). Decisão original assumia partir do zero — não se aplicava a código já em produção.
- Self-service de cadastro de tenants — admin cria manualmente no v1
- Integrações TikTok/LinkedIn/outros canais — apenas Google Ads e Meta no v1
- ~~Roles adicionais ou permissões granulares além de Super Admin / Tenant Admin / Viewer~~ — Superado: Phase 5 introduziu o módulo Agência (grant N:N via agency_tenants) e colapsou Tenant Admin/Viewer em um papel único (Cliente).

## Context

- Arquivos de estratégia existentes no diretório: `estrategia-seo-ads.html`, `estrategia_trafego_completa.xlsx`, `n8n_flows_importaveis.json` — podem alimentar contexto inicial de campanhas ou servir como referência para flows N8N
- N8N self-hosted em VPS (não N8N Cloud) — flexibilidade total de execuções e webhooks; rodando em Queue Mode, checagem de segurança da VPS (CVE-2025-68613, encryption key, process manager) ainda pendente — ver `.planning/OPS-FOLLOWUPS.md`
- Deploy na Vercel com branch strategy simples: push em `main` → deploy automático em produção
- Plataforma começa como uso interno, roadmap considera evolução para SaaS público futuro
- **Estado pós-v1.0 (2026-07-12):** ~14.500 linhas TypeScript/TSX, 10 fases/46 planos entregues, 231 testes automatizados passando. Protótipos HTML soltos em `prototipos/` (dashboard/campanhas/insights, pré-GSD) servem de referência para o redesign visual planejado no v1.1.
- **Feedback do usuário (início v1.1):** dois pontos levantados antes de qualquer trabalho de design — (1) falta gestão completa de usuários no app (só criação existe, edição/remoção é manual via Supabase Dashboard), (2) papel "viewer" morto no código deve ser removido. Ambos priorizados para entrar antes ou junto do redesign visual de telas.
- **Bloqueios externos/ops carregados do v1.0** (não são gaps de código, rastreados em `.planning/OPS-FOLLOWUPS.md`): Google Ads Developer Token (aprovação pendente), `ANTHROPIC_API_KEY`/`N8N_INSIGHTS_SECRET` na Vercel Prod + import/ativação do workflow N8N de insights diários, Google Cloud OAuth Client do usuário (verificação end-to-end do SET-01)

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
| N8N self-hosted em VPS | Execuções ilimitadas vs limitação do free tier N8N Cloud (2.500/mês) | ✓ Bom — Queue Mode rodando desde a Phase 0; checagem de segurança da VPS ainda pendente (ops, não código) |
| Claude como AI provider | Melhor raciocínio analítico para dados de campanha; já é o modelo da sessão | ✓ Bom — Phase 4 implementou insights sob demanda + diários + detecção de anomalias sem retrabalho de provider |
| RLS como camada de segurança primária | Isolamento garantido no banco, não apenas na aplicação | ✓ Bom — comprovado em Foundation, Agência (grant N:N) e no hardening dos endpoints de leads; nenhum vazamento cross-tenant encontrado nas auditorias |
| Google Sheets fora do v1 | Complexidade de sincronização sem benefício claro com base pequena de tenants | Revertida — já em uso em produção pré-GSD; formalizada e estendida (escrita) na Phase 03.1 |
| Insights de IA apenas para Super Admin | Centraliza custo de API e controle de qualidade das recomendações | ✓ Bom — RLS super_admin-only em `ai_insights`/`anomaly_alerts`, UI/nav ocultos para outros papéis, validado na Phase 4 |
| main → prod direto | Projeto interno v1, overhead de PR review não justificado agora | ✓ Bom — sem incidentes de deploy ao longo das 10 fases; mantido no v1.1 |
| Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) em vez de `@anthropic-ai/sdk` direto | Streaming token-a-token (`streamText`) e prompt/tool abstractions prontas, mesma API Messages da Claude por baixo | ✓ Bom — adotado na Phase 4 (04-CONTEXT.md D-01), reutilizado no rate-limited chat da Phase 6 sem atrito |
| Papéis Tenant Admin/Viewer colapsados em "Cliente" único; novo papel "Agência" (grant N:N) | Fase 5 revelou que múltiplos clientes precisavam de um gerente externo com acesso a N tenants, e que Viewer nunca era usado | ✓ Bom, mas com débito — RLS/roteamento colapsados corretamente; código ainda tem referências residuais ao "viewer" morto, cleanup planejado pro v1.1 |

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
*Last updated: 2026-07-12 after v1.0 MVP milestone shipped (10/10 phases, 46 planos) — planejamento do v1.1 iniciado*
