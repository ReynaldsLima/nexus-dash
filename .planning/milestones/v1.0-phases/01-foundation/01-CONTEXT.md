# Phase 1: Foundation — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar autenticação com email+senha, controle de acesso baseado em roles (super_admin, tenant_admin, viewer), e isolamento completo de tenants via Row Level Security no Supabase. Esta fase entrega o esqueleto de rotas do app e as telas mínimas de auth e gestão de tenants — sem dados de campanhas, sem N8N, sem AI.

</domain>

<decisions>
## Implementation Decisions

### Tenant Switcher e Navegação (AUTH-04)
- **D-01:** Tenant switcher = dropdown persistente no header — visível em todas as páginas autenticadas. Super Admin vê todos os tenants na lista, tenant_admin/viewer não veem o switcher.
- **D-02:** Tenant ativo aparece na URL — rotas no formato `/[tenant-slug]/[page]` (ex: `/acme/dashboard`, `/acme/campanhas`). Permite múltiplos tenants abertos em abas e URLs compartilháveis/bookmarkáveis.
- **D-03:** Estrutura de rotas do app:
  - `/login` — página de login (pública)
  - `/tenants` — visão geral de todos os tenants (Super Admin only)
  - `/tenants/[slug]` — detalhes do tenant + criação de usuários (Super Admin only)
  - `/[tenant-slug]/dashboard` — dashboard de campanhas (tenant_admin, viewer, super_admin)
  - Rotas de Fase 3+: `/[tenant-slug]/campanhas`, `/[tenant-slug]/insights` (scaffolded, não implementadas em Fase 1)

### Redirect Pós-Login (AUTH-01, AUTH-05)
- **D-04:** Super Admin após login → `/tenants` (escolhe com qual tenant trabalhar)
- **D-05:** tenant_admin e viewer após login → `/[seu-tenant-slug]/dashboard` (têm apenas um tenant)
- **D-06:** Middleware Next.js (middleware.ts) responsável por:
  - Redirecionar requisições não autenticadas para `/login`
  - Redirecionar `/` para a rota correta por role
  - Bloquear tenant_admin/viewer de rotas `/tenants/*` (Super Admin only)
  - Bloquear viewer de rotas de admin dentro do tenant

### Modelo de Dados do Tenant (AUTH-03)
- **D-07:** Tabela `tenants` mínima em v1:
  ```sql
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name       text NOT NULL        -- nome de exibição (ex: "Acme Corp")
  slug       text NOT NULL UNIQUE -- usado na URL (ex: "acme")
  active     boolean NOT NULL DEFAULT true
  created_at timestamptz NOT NULL DEFAULT now()
  ```
  Logo, timezone e moeda ficam para quando o produto evoluir para SaaS.
- **D-08:** Desativar tenant = soft delete — `active = false`. RLS Policy inclui `AND tenants.active = true` para bloquear automaticamente todo acesso a dados. Tenant não é deletado do banco.
- **D-09:** Tabela `tenant_users` para associar usuários a tenants com roles:
  ```sql
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id  uuid NOT NULL REFERENCES tenants(id)
  user_id    uuid NOT NULL REFERENCES auth.users(id)
  role       text NOT NULL CHECK (role IN ('tenant_admin', 'viewer'))
  created_at timestamptz NOT NULL DEFAULT now()
  UNIQUE(tenant_id, user_id)
  ```
  `super_admin` não aparece em `tenant_users` — está em `auth.users.app_metadata.role`.

### Criação de Usuários em v1 (AUTH-05)
- **D-10:** Interface mínima de criação de usuários na página de detalhes do tenant (`/tenants/[slug]`). Botão "+ Adicionar usuário" abre modal com: email, role (tenant_admin / viewer), senha inicial. Chama Supabase Admin API via Server Action (usa service_role key — nunca exposto ao client).
- **D-11:** Sem página separada de gestão/listagem de usuários em v1. Listar usuários existentes por tenant pode ser feito via Supabase Dashboard. Foco da Fase 1 é auth e RLS, não admin UI completa.

### Arquitetura de Auth (travado de pesquisa anterior)
- **D-12:** `super_admin` armazenado em `auth.users.app_metadata.role` — não em `tenant_users`. Isso permite que o Super Admin acesse todos os tenants sem um registro por tenant.
- **D-13:** Custom Access Token Hook (Supabase) injeta `tenant_id` e `role` no JWT em cada requisição. Nenhuma consulta ao banco por request para determinar contexto do tenant.
- **D-14:** RLS: SEMPRE usar `(SELECT get_tenant_id())` como wrapper — nunca chamar a função diretamente no USING clause (causa 100-1000x slowdown por ausência de inlining).
- **D-15:** Supabase client: `@supabase/ssr` APENAS. `@supabase/auth-helpers-nextjs` está deprecated e não deve ser instalado.
- **D-16:** `createServerClient` para Server Components, Server Actions e Route Handlers. `createBrowserClient` para Client Components.

### Claude's Discretion
- Nomes exatos das funções Postgres (`get_tenant_id`, `get_user_role`, etc.)
- Estrutura interna das RLS policies (ORDER of conditions, index hints)
- Estrutura de loading states e error boundaries nas páginas de auth
- Implementação exata do middleware (cookie names, session refresh logic)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Supabase Auth + Next.js App Router
- `.planning/research/STACK.md` §"Supabase + Next.js App Router" — padrão createServerClient vs createBrowserClient, factory por contexto
- `.planning/research/STACK.md` §"RLS Multi-Tenant Isolation Pattern" — tabela de roles e JWT claims
- `.planning/research/PITFALLS.md` §"Supabase RLS" — armadilhas críticas: bare function call vs wrapper, performance
- `.planning/research/ARCHITECTURE.md` §"Multi-tenancy / RLS" — schema shared + RLS, padrão completo

### Referências externas (leitura obrigatória antes de implementar)
- Supabase SSR package: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase Custom Claims RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac

### Requirements
- `.planning/REQUIREMENTS.md` §"Authentication & Access Control" — AUTH-01 a AUTH-06 (todos desta fase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/layout.tsx` — root layout existente (criar providers de auth e tenant context aqui)
- `app/globals.css` — estilos globais Tailwind (já configurado)
- `vercel.json` — região gru1 já configurada (não alterar)

### Established Patterns
- Next.js 15 App Router com `app/` directory (sem `src/`) — estabelecido na Fase 0
- Tailwind CSS — configurado via `create-next-app`
- TypeScript strict — via `tsconfig.json` da Fase 0

### Integration Points
- `middleware.ts` na raiz do projeto — ponto de entrada para auth check e redirect por role
- `app/[tenant-slug]/` — route group dinâmico para todas as páginas autenticadas de tenant
- Supabase `rvkkvjitfddtbdpkupok` (sa-east-1) — projeto já provisionado, staging schema criado

</code_context>

<specifics>
## Specific Ideas

- O dropdown de tenant switcher no header deve mostrar apenas o nome do tenant ativo + uma seta. Ao clicar, lista os outros tenants disponíveis. Para v1 com 1-3 tenants, não precisa de busca.
- A página `/tenants` do Super Admin pode ser simples: cards ou tabela com name, slug, status (active/inactive), e botão "Entrar" que navega para `/[slug]/dashboard`.
- O modal de criação de usuário na página de tenant detalhes deve gerar uma senha temporária forte e exibi-la UMA VEZ para o Super Admin copiar — o usuário precisará trocar no primeiro acesso (ou o Super Admin comunica a senha por outro canal).

</specifics>

<deferred>
## Deferred Ideas

- Logo do tenant no switcher — adicionar quando o campo `logo_url` for adicionado à tabela `tenants` (pós-v1)
- Timezone por tenant — relevante quando houver clientes em fusos diferentes
- Página de gestão/listagem de usuários por tenant — usar Supabase Dashboard em v1
- Trocar senha no primeiro acesso (força troca) — adicionar em v1.1 se necessário
- 2FA/MFA — deferred conforme REQUIREMENTS.md
- Magic link / Google OAuth — deferred conforme REQUIREMENTS.md
- Invite por email — deferred conforme REQUIREMENTS.md

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-05-10*
