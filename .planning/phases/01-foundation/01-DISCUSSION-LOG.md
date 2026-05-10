---
phase: 01-foundation
date: 2026-05-10
status: complete
---

# Phase 1 Foundation — Discussion Log

## Gray Areas Discussed

### 1. Tenant Switcher e Navegação

**Question:** Como o Super Admin navega entre tenants? Dropdown no header ou página dedicada?

**Decision:** Dropdown persistente no header (visível em todas as páginas autenticadas). Tenant ativo aparece na URL — rotas no formato `/[tenant-slug]/[page]`. Super Admin vê todos os tenants na lista; tenant_admin/viewer não veem o switcher.

**Rationale:** URLs com slug permitem múltiplas abas abertas e links compartilháveis. Para v1 com 1-3 tenants, não precisa de busca no dropdown.

---

### 2. Redirect Pós-Login

**Question:** Para onde cada role é redirecionado após login?

**Decision:**
- Super Admin → `/tenants` (escolhe com qual tenant trabalhar)
- tenant_admin / viewer → `/[seu-tenant-slug]/dashboard` (têm apenas um tenant, direto ao ponto)

**Rationale:** Fluxo mínimo — cada role aterrissa onde precisa sem fricção.

---

### 3. Modelo de Dados do Tenant

**Question:** Quais campos a tabela `tenants` precisa em v1? Como tratar tenants inativos?

**Decision:** Tabela mínima: `id`, `name`, `slug`, `active`, `created_at`. Desativar = soft delete (`active = false`). RLS policy inclui `AND tenants.active = true`.

**Rationale:** Logo, timezone e moeda são campos para quando o produto evoluir para SaaS público. Soft delete evita referenciar IDs quebrados em histórico de métricas.

---

### 4. Criação de Usuários

**Question:** Onde e como criar usuários em v1? Precisa de UI de listagem?

**Decision:** Botão "+ Adicionar usuário" na página de detalhes do tenant (`/tenants/[slug]`). Modal com email, role (tenant_admin / viewer), senha inicial gerada. Chama Supabase Admin API via Server Action. Sem página separada de gestão de usuários — Supabase Dashboard é suficiente em v1.

**Rationale:** Foco da Fase 1 é auth e RLS, não admin UI completa. Listar usuários por tenant é raro e pode ser feito via Supabase Dashboard enquanto o produto não valida necessidade de UI dedicada.

---

## Decisions Locked (see 01-CONTEXT.md)

D-01 through D-16 — all captured in `01-CONTEXT.md`.

## Deferred

- Logo do tenant no switcher (pós-v1, quando `logo_url` for adicionado)
- Timezone por tenant
- Página de listagem de usuários por tenant
- Trocar senha no primeiro acesso
- 2FA/MFA, magic link, Google OAuth, invite por email
