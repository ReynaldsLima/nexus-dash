<!-- GSD:project-start source:PROJECT.md -->
## Project

**NEXUS-DASH**

NEXUS-DASH é uma plataforma de marketing analytics multi-tenant construída sobre Next.js, Supabase e N8N. Consolida métricas de Google Ads e Meta Ads em um dashboard unificado, com sincronização automática via N8N e recomendações de otimização de campanhas geradas por IA (Claude). Começa como ferramenta interna para gerenciar 1-3 clientes, com arquitetura projetada para evoluir para SaaS público.

**Core Value:** O Super Admin consegue ver e otimizar campanhas de todos os clientes em um único lugar, com recomendações de IA acionáveis — sem precisar entrar em múltiplas plataformas de anúncios.

### Constraints

- **Tech Stack**: Next.js (App Router) + Supabase + N8N self-hosted + Vercel — definido e não negociável no v1
- **AI Provider**: Claude (Anthropic) — claude-sonnet-4-6 para análise de campanhas
- **Budget**: Free/Hobby tiers — Vercel Hobby, Supabase Free, VPS de custo mínimo para N8N
- **Tenants v1**: 1-3 clientes máximo, admin gerencia manualmente — sem UI de onboarding
- **CI/CD**: main → Vercel prod automático — sem PR review gates no v1
- **Segurança**: Row Level Security no Supabase obrigatório — isolamento total entre tenants
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Decided Stack (Non-negotiable)
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend / API | Next.js 15 (App Router) | Server Components, Server Actions, Route Handlers |
| Database | Supabase (PostgreSQL + Auth + RLS + Realtime) | Managed Postgres, built-in auth, row-level security |
| Automation | N8N self-hosted on VPS | Unlimited executions, full webhook control |
| Deployment | Vercel (Hobby tier initially) | Auto-deploy on push to main |
| AI | Claude API (claude-sonnet-4-6, Anthropic SDK) | Analytics insight generation |
## Library Recommendations
### 1. UI Component Library
- **Chakra UI** — v3 broke the API again, heavier runtime, doesn't compose well with Tailwind, not the direction the Next.js ecosystem is moving
- **Tremor** — built on top of Recharts and Tailwind but adds a second abstraction layer; since shadcn/ui already includes a Recharts-based Chart component, Tremor provides no net benefit and adds bundle weight (~200kB)
- **MUI (Material UI)** — CSS-in-JS runtime overhead, Google Material aesthetic doesn't fit analytics SaaS, poor Tailwind interop
### 2. Data Visualization (Charts)
- **Nivo** — excellent library for complex/custom visualizations, but 500kB+ bundle for full install is unacceptable for a Vercel Hobby deployment. Overkill for the chart types NEXUS-DASH needs (line, bar, area, KPI cards).
- **Victory** — smaller ecosystem, slower update cadence. Best asset (cross-platform web+mobile) is irrelevant here since there is no mobile app.
- **TanStack Charts** — as of May 2026, still in alpha/early stages. Not production-ready.
- **Standalone Tremor** — adds Recharts as a transitive dependency anyway; prefer direct Recharts via shadcn/ui.
### 3. Data Fetching and Caching
- **SWR** — Vercel's own library, but lacks mutation management depth, no DevTools, weaker TypeScript inference in v5 era. Fine for simple blogs; not enough for this dashboard.
- **Next.js native `fetch` cache** — Good for static/ISR content but does not solve client-side cache invalidation after mutations. Use it for Server Component data fetching only (e.g., initial tenant config load), not as the primary data layer.
### 4. State Management
- Active tenant context (Super Admin switching between tenants)
- Date range picker selection (shared across dashboard sections)
- Sidebar open/closed state
- **Jotai** — Atom-based approach is better suited for highly granular, frequently-updating UI state (think real-time collaborative editing). NEXUS-DASH's global state is coarse (tenant selection, date range) — Jotai's model is unnecessary complexity here.
- **Redux Toolkit** — Correct for large teams with complex shared domain state. The overhead (slices, reducers, middleware, DevTools setup) is unjustified for 1-2 developers on a focused dashboard app.
- **React Context alone** — Context re-renders the entire subtree on every state change. Acceptable for low-frequency updates (auth); not acceptable for a date range that drives every chart on the page.
### 5. Form Handling
- **Formik** — Slower than RHF due to controlled component model, smaller momentum in 2025.
- **Zod v3** — Superseded by v4. Migrate on project start; don't carry v3 debt into a greenfield project.
## Integration Patterns
### Supabase + Next.js App Router
| Context | Factory | Import |
|---------|---------|--------|
| Server Components, Server Actions, Route Handlers | `createServerClient` | `@supabase/ssr` + `cookies()` from `next/headers` |
| Client Components | `createBrowserClient` | `@supabase/ssr` |
### RLS Multi-Tenant Isolation Pattern
| Role | JWT `app_metadata.role` | Access |
|------|------------------------|--------|
| Super Admin | `super_admin` | All tenants, AI insights generation |
| Tenant Admin | `tenant_admin` | Own tenant data, settings |
| Viewer | `viewer` | Own tenant data, read-only |
### N8N to Supabase Write Strategy
### Claude API Integration (Anthropic SDK)
### TypeScript + Supabase Generated Types Workflow
### Vercel Deployment Optimization
| Limit | Value | Mitigation |
|-------|-------|------------|
| Serverless function timeout | 60s max (10s default) | Set `export const maxDuration = 60` on AI routes only |
| Fluid Compute timeout | 300s | Enable Fluid Compute for AI routes if 60s isn't enough |
| Bandwidth | 100 GB/month | Acceptable for 1-3 tenants |
| Serverless function regions | Single region | Configure `vercel.json` to match Supabase region |
- Use React Server Components for initial data loads (no client roundtrip, no bundle cost)
- Use `unstable_cache` or `revalidatePath` from `next/cache` for Server Component data that changes on sync completion
- TanStack Query handles client-side interactive state (drilldowns, filter changes)
- Avoid `export const dynamic = 'force-dynamic'` on the entire layout — scope it to only pages that require real-time freshness
## Summary Table
| Concern | Library | Version | Confidence |
|---------|---------|---------|-----------|
| UI Components | shadcn/ui | CLI 3.0 (no version pin) | HIGH |
| Data Visualization | Recharts (via shadcn/ui Chart) | ^3.8.1 | HIGH |
| Data Fetching / Cache | TanStack Query | ^5 | HIGH |
| Supabase Cache Helpers | @supabase-cache-helpers/postgrest-react-query | ^1 | MEDIUM |
| State Management | Zustand | ^5 | HIGH |
| Form Handling | React Hook Form | ^7.75.0 | HIGH |
| Schema Validation | Zod | ^4.4.3 | HIGH |
| Form Resolver | @hookform/resolvers | ^3 | HIGH |
| Supabase Client | @supabase/supabase-js | ^2.105.4 | HIGH |
| Supabase SSR Auth | @supabase/ssr | latest | HIGH |
| Claude API | @anthropic-ai/sdk | ^0.95.1 | HIGH |
## What NOT to Install (Explicit Rejections)
| Library | Reason |
|---------|--------|
| `@supabase/auth-helpers-nextjs` | Deprecated — replaced by `@supabase/ssr` |
| Chakra UI | Incompatible with Tailwind-first architecture, breaking v3 API |
| Tremor | Redundant — shadcn/ui Chart component covers the same use case |
| Nivo | 500kB+ bundle, overkill for ROAS/CTR line and bar charts |
| TanStack Charts | Alpha-stage as of mid-2026, not production-ready |
| SWR | Insufficient cache invalidation granularity for this domain |
| Redux Toolkit | Over-engineered for a 1-2 developer dashboard project |
| Formik | Slower than RHF (controlled components), smaller 2025 momentum |
| Zod v3 | Superseded by v4 — start greenfield on v4 |
| Victory | Smaller ecosystem, no advantage over Recharts for this use case |
## Sources
- Supabase Next.js Quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Supabase SSR package: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Custom Claims RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase TypeScript Types: https://supabase.com/docs/guides/api/rest/generating-types
- TanStack Query SSR: https://tanstack.com/query/v5/docs/react/guides/ssr
- Supabase Cache Helpers + React Query guide: https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers
- shadcn/ui Charts: https://ui.shadcn.com/charts
- shadcn/ui CLI 3.0 changelog: https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
- Recharts React 19 compatibility: https://ui.shadcn.com/docs/react-19
- Zustand v5 announcement: https://pmnd.rs/blog/announcing-zustand-v5
- Zustand Next.js setup: https://zustand.docs.pmnd.rs/learn/guides/nextjs
- Zod v4 release: https://zod.dev/v4
- N8N Supabase node 403 bug: https://github.com/n8n-io/n8n/issues/17020
- N8N Supabase credentials docs: https://docs.n8n.io/integrations/builtin/credentials/supabase/
- Anthropic SDK npm: https://www.npmjs.com/package/@anthropic-ai/sdk
- Vercel Function limits: https://vercel.com/docs/functions/limitations
- Vercel + Supabase integration: https://supabase.com/partners/integrations/vercel
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
