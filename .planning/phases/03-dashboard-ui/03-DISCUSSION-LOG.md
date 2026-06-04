# Phase 3: Dashboard UI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 03-dashboard-ui
**Areas discussed:** Arquitetura de dados, Date range picker, Campaign drill-down, Settings page

---

## Arquitetura de dados

| Option | Description | Selected |
|--------|-------------|----------|
| Client + TanStack Query direto no Supabase | createBrowserClient direto; RLS garante isolamento | ✓ |
| Client + TanStack Query via Route Handlers | Mais camadas de boilerplate | |
| Híbrido: Server Component + TanStack Query | Mais complexo por incompatibilidade com Zustand | |

**User's choice:** Client + TanStack Query direto no Supabase
**Notes:** Simples e alinhado com o padrão já existente de Client Components.

| Option | Description | Selected |
|--------|-------------|----------|
| Tenant ativo no switcher | Dashboard por tenant selecionado no header | ✓ |
| Consolidado cross-tenant para Super Admin | Visão somada de todos os tenants | |

**User's choice:** Tenant ativo no switcher
**Notes:** Alinhado com a rota /[tenant-slug]/dashboard já existente.

---

## Date range picker

| Option | Description | Selected |
|--------|-------------|----------|
| Presets + calendário para range custom | Popover com lista de presets + shadcn Calendar | ✓ |
| Somente presets (dropdown simples) | Select com 5 presets fixos | |
| Presets + input de texto para custom | Sem calendário visual | |

**User's choice:** Presets + calendário para range custom

| Option | Description | Selected |
|--------|-------------|----------|
| No header global (ao lado do TenantSwitcher) | Visível em todas as páginas | ✓ |
| No topo de cada página | Duplica o componente | |

**User's choice:** No header global

| Option | Description | Selected |
|--------|-------------|----------|
| Somente na sessão (Zustand na memória) | Fecha browser → reseta para Last 30 dias | ✓ |
| Persistir no localStorage | Range persiste entre sessões | |

**User's choice:** Somente na sessão

---

## Campaign drill-down

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet lateral (overlay, sem mudar URL) | shadcn Sheet desliza da direita | ✓ |
| Rota dedicada /campanhas/[id] | Página separada, URL bookmarkável | |
| Modal (dialog central) | shadcn Dialog no centro | |

**User's choice:** Sheet lateral

| Option | Description | Selected |
|--------|-------------|----------|
| Trend lines das métricas principais + tabela de totais | Gráficos de linha + tabela agregada | ✓ |
| Somente tabela de métricas day-by-day | Sem gráficos | |
| Você decide a estrutura | Claude decide conteúdo | |

**User's choice:** Trend lines + tabela de totais
**Notes:** Sheet não fecha ao clicar fora — apenas X ou Esc.

---

## Settings page

| Option | Description | Selected |
|--------|-------------|----------|
| tenant_admin + super_admin | Conforme requirements SET-01, SET-02 | ✓ |
| Somente super_admin | Simplifica controle de acesso | |

**User's choice:** tenant_admin + super_admin

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth2 completo (redirect flow) | Rota de callback, salva refresh_token no Vault | |
| Manual: colar refresh_token | Mais simples, menos UX profissional | |
| Deferir para Fase futura | Settings v1 só implementa Meta | ✓ |

**User's choice:** Deferir SET-01 (Google Ads OAuth2) para fase futura
**Notes:** Developer Token ainda não aprovado — faz sentido deferir completamente.

| Option | Description | Selected |
|--------|-------------|----------|
| Formulário com validação prévia via API | Valida token na Meta antes de salvar no Vault | ✓ |
| Formulário simples sem validação | Salva direto, sem feedback de validade | |

**User's choice:** Formulário com Account ID + System User Token + validação via Meta Graph API

---

## Claude's Discretion

- Layout de 7 KPI cards (grid responsivo)
- Estrutura exata do Zustand store `useDateRangeStore`
- Quais métricas nos trend lines do drill-down
- Estrutura de queries TanStack Query

## Deferred Ideas

- SET-01 Google Ads OAuth2 — fase futura, pós-aprovação do Developer Token
- Visão consolidada cross-tenant
- Persistência do date range no localStorage
- Rota dedicada /campanhas/[id] para drill-down bookmarkável
