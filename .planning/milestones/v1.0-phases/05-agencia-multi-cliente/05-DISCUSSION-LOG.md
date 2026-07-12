# Phase 5: Access Modules — Multi-Client Agency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 05-agencia-multi-cliente
**Areas discussed:** Visão da Agência, Gestão do grant, Papéis do Cliente, Identidade da Agência

---

## Visão da Agência

| Option | Description | Selected |
|--------|-------------|----------|
| Seletor entre clientes | Reaproveita o tenant-switcher existente, estendido pra agência — escolhe um cliente e vê o dashboard normal daquele tenant | ✓ |
| Dashboard consolidado | Tela nova somando métricas de todos os clientes da agência antes de entrar em um cliente específico | |

**User's choice:** Seletor entre clientes
**Notes:** Recomendado por reaproveitar `components/tenants/tenant-switcher.tsx` sem trabalho de agregação cross-tenant nova.

---

## Gestão do grant (Super Admin → Agência → Clientes)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual via Supabase Studio | Consistente com "sem UI de onboarding" já decidido para 1-3 tenants | |
| Tela simples no app | Página dentro do app onde o Super Admin atribui/remove clientes de uma agência | ✓ |

**User's choice:** Tela simples no app
**Notes:** Desvio deliberado do padrão "manual via Studio" — o usuário escolheu isso porque atribuir/remover clientes por agência é operação recorrente, diferente da criação pontual de tenant.

---

## Papéis dentro do Cliente

| Option | Description | Selected |
|--------|-------------|----------|
| Papel único | Cliente = quem acessa aquele tenant, ponto — vê e edita tudo | ✓ |
| Manter dois níveis (admin/viewer) | Preserva a distinção atual tenant_admin/viewer dentro do Cliente | |

**User's choice:** Papel único
**Notes:** Consistente com a regra já confirmada de que todos os três módulos podem alterar status de lead.

---

## Identidade da Agência

| Option | Description | Selected |
|--------|-------------|----------|
| Conta própria, sem tenant | Usuário de agência nunca pertence a `tenant_users`, só à tabela de agência | ✓ |
| Acesso extra sobre usuário existente | Um usuário Cliente também ganha visão de agência sobre outros tenants | |

**User's choice:** Conta própria, sem tenant
**Notes:** Mantém inequívoco qual "chapéu" o usuário está usando — nunca é Cliente e Agência ao mesmo tempo nesta fase.

---

## Claude's Discretion

- Schema exato (`agencies`, `agency_users`, `agency_tenants`) — não discutido, é território do researcher/planner.
- Exposição de `agency_id` via JWT custom claims (Custom Access Token Hook) — flagged como pergunta de pesquisa já registrada.
- UI/UX exata da tela de gestão do grant (D-02) — layout, navegação.
- Se o papel único de Cliente reaproveita o valor `tenant_admin` ou precisa de valor/migration novo.

## Deferred Ideas

- Dashboard consolidado cross-cliente para Agência (visão de portfólio agregado) — pode virar fase própria futura se demandado.
