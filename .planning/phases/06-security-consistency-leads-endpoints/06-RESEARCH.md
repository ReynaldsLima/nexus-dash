# Phase 6: Security & Consistency — Leads Endpoints - Research

**Researched:** 2026-07-11
**Domain:** API route authorization hardening (Next.js Route Handlers + Supabase RLS/JWT claims), in-memory rate limiting, AI SDK migration
**Confidence:** HIGH

## Summary

This phase closes two audit findings by replicating an authorization pattern that already exists, live, in this exact codebase (`app/api/leads/[id]/status/route.ts`) — there is no new pattern to invent, only to copy correctly into two other files. All three target files were read directly; the "before" state and the exact "after" pattern are both fully known with no ambiguity. The one genuinely new piece of engineering is the in-memory sliding-window rate limiter (`D-02`/`D-03`, 20 msgs/5 min/user), which has no precedent in this codebase — verified against current (2026) community practice, with its serverless caveats already accepted by the user in CONTEXT.md.

The second piece of new engineering is migrating `app/api/leads/chat/route.ts` from a raw `fetch` call to the `ai`/`@ai-sdk/anthropic` SDK already used by `/api/insights/generate`. This was verified directly against the installed package (`ai@7.0.22`, confirmed via local `node_modules/ai/dist/index.d.ts`): `streamText` accepts top-level `system` + `messages: Array<ModelMessage>` (role: `'user'|'assistant'|'system'|'tool'`, content: string), which is a drop-in replacement for the current `{system, messages}` body the client already sends — no client-side message-shape change is needed beyond adding the `tenant` field (D-05).

**Primary recommendation:** Copy `app/api/leads/[id]/status/route.ts`'s steps 2–5 (auth → role gate → body validation → tenant/agency scope via `getClaims()`) near-verbatim into both `GET /api/leads` and `POST /api/leads/chat`, add a small `lib/rate-limit.ts` sliding-window module gating only the chat route, migrate the chat route's Claude call to `streamText`/`insightModel`, add `tenant: slug` to the client's POST body, and commit all three touched files plus the two currently-untracked paths.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Agente IA — manter ou remover**
- D-01: Manter o chat "Agente IA" com hardening, em vez de remover. Já estava no escopo original planejado da Fase 03.1 mas nunca entrou em nenhum PLAN.md formal — feature considerada válida e útil, não uma peça a descartar.

**Rate limiting do chat**
- D-02: Contador em memória (`Map` por `user_id`, janela deslizante) dentro do próprio Route Handler. Sem dependência nova, sem infra externa (Upstash/Redis e Vercel Firewall rejeitados).
- D-03: Limite: **20 mensagens / 5 minutos por usuário** (por `user_id`, não por tenant).
- Limitação aceita conscientemente: contador em memória não é compartilhado entre instâncias serverless nem sobrevive a cold start. Aceitável dado o volume real (1-3 tenants, usuários autenticados conhecidos, não é endpoint público).

**Escopo de autorização do chat**
- D-04: Espelhar **exatamente** o padrão de `PATCH /api/leads/[id]/status`:
  - Mesmos 3 papéis permitidos: `super_admin`, `tenant_admin`, `agency` (via `get_user_role()` RPC — 403 se outro papel ou RPC falhar).
  - Tenant/agency scope verificado via `auth.getClaims()` (**nunca** `getUser().app_metadata`).
  - Para `tenant_admin`: `callerAppMetadata.tenant_slug` deve bater com o `tenant` do body.
  - Para `agency`: lookup em `agency_tenants` (join com `tenants.slug`) confirmando grant para o tenant pedido.
  - `super_admin`: sem checagem adicional.
- D-05: O body do `POST /api/leads/chat` passa a exigir um campo `tenant` explícito (string, igual ao `PATCH` já exige) — a rota nunca deve confiar apenas nos `leads` que o client já buscou e enviou no `system` prompt para decidir o que é permitido.

**Padronização da chamada à Claude API**
- D-06: Migrar `app/api/leads/chat/route.ts` de `fetch` raw para `@anthropic-ai/sdk`/`ai` SDK, reusando `lib/ai/anthropic.ts` (`MODEL_ID`/`insightModel`), o mesmo padrão já usado em `/api/insights/generate` (Fase 4).

**GET /api/leads (fecha AGENCY-08)**
- D-07: Aplicar o mesmo padrão explícito do `PATCH` (role gate via `get_user_role()` + `getClaims()` tenant/agency check) em vez de confiar só na RLS implícita atual.

**Limpeza de arquivos não commitados**
- D-08: Após o hardening, commitar `app/api/leads/chat/route.ts` + `app/[tenant-slug]/leads/agente/page.tsx` — nenhum arquivo sob `app/api/leads/` ou `app/[tenant-slug]/leads/` deve permanecer untracked ao final.
- Fora de escopo: `supabase/migrations/0012_add_google_sheets_to_tenants.sql` (untracked, mas não é um path desta fase nem achado do audit) — não mexer.

### Claude's Discretion
- Estrutura exata do módulo de rate limiting em memória (nome do arquivo, se fica em `lib/` para reuso futuro por outras rotas).
- Mensagem de erro exibida no chat quando o rate limit é excedido (HTTP 429) — copy exata em pt-BR.
- Se o rate limit precisa de `export const runtime = 'nodejs'` como o `PATCH` — o chat também usa `getClaims()`, então provavelmente sim; planner/executor confirma.

### Deferred Ideas (OUT OF SCOPE)
- `supabase/migrations/0012_add_google_sheets_to_tenants.sql` — untracked, fora do escopo desta fase, debt pré-existente não relacionado. Não mexer.
- Rate limiting distribuído (Upstash/Redis) ou regra no Vercel Firewall — rejeitado para v1 (D-02). Reavaliar apenas se o produto crescer ou o contador em memória se mostrar insuficiente.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENCY-08 | Tenant/agency-scoped write endpoints (starting with `PATCH /api/leads/[id]/status`) verify the caller's authorization server-side instead of trusting a client-supplied tenant identifier — PARTIAL: `PATCH` route done, `GET /api/leads` still relies on implicit RLS only. Gap closure: Phase 6. | Confirmed exact current state of `GET /api/leads` (no role/scope check at all, only `if (!user)`). Confirmed exact target pattern line-by-line from `PATCH /api/leads/[id]/status/route.ts` (steps 2–5). Confirmed the same pattern extends naturally to `POST /api/leads/chat`, which the phase description also requires hardened even though it's not literally named in AGENCY-08's text — it's the F3 integration finding, closed via the identical mechanism. |
</phase_requirements>

## Standard Stack

No new external dependencies are needed. Everything required is already installed.

### Core (already installed, reused)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.105.4 [VERIFIED: package.json] | `getClaims()`, `getUser()`, `.rpc()`, `.from()` | Already the sole Supabase client library in the project |
| `ai` | ^7.0.22 [VERIFIED: package.json + local `node_modules/ai/dist/index.d.ts`] | `streamText` for the chat's Claude call | Same SDK `/api/insights/generate` already uses; `streamText` confirmed to accept top-level `system` + `messages: Array<ModelMessage>` (line 3503 of the installed `.d.ts`) |
| `@ai-sdk/anthropic` | ^4.0.12 [VERIFIED: package.json] | Model provider for `streamText` | `lib/ai/anthropic.ts` already wraps this as `insightModel` |
| `zod` | ^4.4.3 (import as `zod/v4`) [VERIFIED: `PATCH` route source, `import { z } from 'zod/v4'`] | Body validation (`tenant`, `messages`, `system`) | Established project convention — `zod/v4` import path, not bare `zod` |

### Supporting (new file, no new dependency)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none — plain `Map` | n/a | Sliding-window rate limiter | In-process only, per D-02 (no Upstash/Redis, no Vercel Firewall) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory `Map` rate limiter | Upstash Redis | Rejected in CONTEXT.md (D-02) — unnecessary infra for 1-3 tenants, adds a new external dependency/account |
| In-memory `Map` rate limiter | Vercel Firewall / WAF rate limiting | Rejected in CONTEXT.md (D-02) — uncertain availability on Hobby tier |
| `ai` SDK `streamText` | Raw `fetch` to Anthropic Messages API (current state) | Current state duplicates the model ID string and reimplements what `lib/ai/anthropic.ts` already centralizes; migration is explicitly decided (D-06) |

**Installation:** None required — no `npm install` needed for this phase.

**Version verification:** `ai@7.0.22` and `@ai-sdk/anthropic@4.0.12` confirmed directly from this repo's `package.json` and cross-checked against the actual shipped type declarations in `node_modules/ai/dist/index.d.ts` (not just training-data assumption about the API shape). [VERIFIED: local filesystem, 2026-07-11]

## Architecture Patterns

### Recommended Project Structure
No new directories. One new file:
```
lib/
├── rate-limit.ts          # NEW — sliding-window in-memory limiter (Claude's Discretion: exact name/location, this is the recommended one)
├── ai/
│   └── anthropic.ts        # EXISTING — reused as-is (MODEL_ID, insightModel)
app/
├── api/
│   └── leads/
│       ├── route.ts        # MODIFY — add role gate + getClaims() scope (AGENCY-08)
│       ├── chat/
│       │   └── route.ts    # MODIFY — full hardening + SDK migration + rate limit
│       └── [id]/status/
│           └── route.ts    # REFERENCE ONLY — do not modify, this is the pattern source
└── [tenant-slug]/leads/
    └── agente/
        └── page.tsx         # MODIFY — add `tenant: slug` to POST body (D-05)
```

### Pattern 1: The Canonical Auth/Scope Check Sequence (from `PATCH /api/leads/[id]/status`)

**What:** A fixed 5-step sequence, confirmed line-by-line from the live file:

1. **Validate URL/path input first** (PATCH-specific: `id` — not applicable to `GET`/chat, but the *principle* "validate untrusted input before touching auth" still informs ordering: for `GET`, `tenant` query param existence check already happens first in current code and should stay first; for chat, body isn't parseable before auth in the current PATCH order — body validation is actually step 4, AFTER auth+role, not before. Do not move body-parsing ahead of auth).
2. **Auth:** `const supabase = await createClient(); const { data: { user} } = await supabase.auth.getUser(); if (!user) return 401`.
3. **Role gate:** `const { data: role, error: roleErr } = await supabase.rpc('get_user_role'); if (roleErr || !role) return 403; if (role !== 'super_admin' && role !== 'tenant_admin' && role !== 'agency') return 403`.
4. **Validate body** (Zod `safeParse`, 400 on failure) — for `POST /api/leads/chat`, this is where the new required `tenant: z.string().min(1)` field is checked, alongside the existing `system`/`messages` shape.
5. **Tenant/agency scope via `getClaims()`** — never `getUser().app_metadata`:
   ```typescript
   const { data: claimsData } = await supabase.auth.getClaims()
   const callerAppMetadata = claimsData?.claims?.app_metadata as
     | { tenant_slug?: string; agency_id?: string }
     | undefined

   if (role === 'tenant_admin') {
     const callerSlug = callerAppMetadata?.tenant_slug
     if (callerSlug !== tenantSlug) return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
   } else if (role === 'agency') {
     const agencyId = callerAppMetadata?.agency_id
     if (!agencyId) return NextResponse.json({ error: 'Não foi possível verificar a agência do usuário' }, { status: 403 })
     const { data: grant } = await supabase
       .from('agency_tenants')
       .select('tenant_id, tenants!inner(slug)')
       .eq('agency_id', agencyId)
       .eq('tenants.slug', tenantSlug)
       .maybeSingle()
     if (!grant) return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
   }
   // role === 'super_admin' falls through with no additional check
   ```

**When to use:** Every route under `app/api/leads/` that reads or writes tenant-scoped data based on a client-supplied tenant identifier.

**Source:** `app/api/leads/[id]/status/route.ts` lines 35–96 [VERIFIED: read directly, this session]

### Pattern 2: `GET /api/leads` — applying the pattern to a query-param-scoped route

**What:** Current `GET /api/leads` reads `tenant` from `req.nextUrl.searchParams`, then only checks `if (!user)`. Target: insert role gate + `getClaims()` scope check between the existing auth check and the existing tenant-row lookup, using the *already-extracted* `tenantSlug` (no body to parse — it's a query param, extracted at the top of the handler already).

**Concrete diff shape** (based on current file read this session):
```typescript
export const runtime = 'nodejs' // ADD — getClaims() needs Node's crypto, same as PATCH

export async function GET(req: NextRequest) {
  const tenantSlug = req.nextUrl.searchParams.get('tenant')
  if (!tenantSlug) return NextResponse.json({ error: 'tenant param required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // NEW: role gate (identical to PATCH step 3)
  // NEW: getClaims() + tenant_admin/agency scope check (identical to PATCH step 5),
  //      using tenantSlug already extracted above — no body to validate here.

  const { data: tenant, error } = await supabase... // unchanged from here down
}
```

**Note on behavior change:** Today, `GET /api/leads` has **no role restriction at all** — any authenticated user of any role can read any tenant's leads (RLS on `tenants` is the only real gate, and RLS currently allows any tenant member regardless of role, per `tenants_member_select`). Applying the PATCH pattern verbatim (locked in D-07) will, for the first time, explicitly reject any role other than `super_admin`/`tenant_admin`/`agency` with a 403 — there is no currently-active 4th role (viewer was collapsed to `tenant_admin` in Phase 5, migration `0020`), so in practice no live user is rejected by this new gate. Flagged in Open Questions below since it's a real (if currently inert) behavior change worth the planner/executor being aware of.

**Source:** `app/api/leads/route.ts` [VERIFIED: read directly, this session], `supabase/migrations/0016_restrict_sheets_service_account_column.sql` [VERIFIED: confirms `sheets_api_key`/`sheet_id` remain SELECT-able by `authenticated` via the regular client — no need to switch this route to `createServiceClient()`, unlike the PATCH route's service-account read]

### Pattern 3: `POST /api/leads/chat` — full hardening + SDK migration

**Current state (verified, this session):**
```typescript
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }

  const { system, messages } = await req.json()   // <-- no tenant field, no validation

  const response = await fetch('https://api.anthropic.com/v1/messages', { ... })  // <-- raw fetch, hardcoded model
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
```
No role gate, no tenant/agency scope check, no rate limit, no runtime declaration, no body validation, raw `fetch` with a hardcoded `'claude-sonnet-4-6'` string duplicating `lib/ai/anthropic.ts`'s `MODEL_ID`.

**Target state — combines Pattern 1 (auth/role/scope) + rate limiting + SDK migration:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { insightModel } from '@/lib/ai/anthropic'
import { checkRateLimit } from '@/lib/rate-limit' // new module, see Pattern 4

export const runtime = 'nodejs' // getClaims() requires Node crypto

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})
const BodySchema = z.object({
  tenant: z.string().min(1),           // D-05 — new required field
  system: z.string().min(1),
  messages: z.array(MessageSchema).min(1),
})

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Role gate — identical set to PATCH
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || !role) {
    return NextResponse.json({ error: 'Não foi possível verificar o papel do usuário' }, { status: 403 })
  }
  if (role !== 'super_admin' && role !== 'tenant_admin' && role !== 'agency') {
    return NextResponse.json({ error: 'Apenas super_admin, tenant_admin e agency podem usar o Agente IA' }, { status: 403 })
  }

  // 3. Validate body (includes new `tenant` field per D-05)
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido — JSON esperado' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }
  const { tenant: tenantSlug, system, messages } = parsed.data

  // 4. Tenant/agency scope via getClaims() — identical to PATCH step 5
  const { data: claimsData } = await supabase.auth.getClaims()
  const callerAppMetadata = claimsData?.claims?.app_metadata as
    | { tenant_slug?: string; agency_id?: string } | undefined
  if (role === 'tenant_admin') {
    if (callerAppMetadata?.tenant_slug !== tenantSlug) {
      return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
    }
  } else if (role === 'agency') {
    const agencyId = callerAppMetadata?.agency_id
    if (!agencyId) {
      return NextResponse.json({ error: 'Não foi possível verificar a agência do usuário' }, { status: 403 })
    }
    const { data: grant } = await supabase
      .from('agency_tenants')
      .select('tenant_id, tenants!inner(slug)')
      .eq('agency_id', agencyId)
      .eq('tenants.slug', tenantSlug)
      .maybeSingle()
    if (!grant) return NextResponse.json({ error: 'Sem acesso a este tenant' }, { status: 403 })
  }

  // 5. Rate limit — per user_id, 20/5min (D-03), AFTER auth so the key is a real user id
  const rl = checkRateLimit(user.id, { max: 20, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite de mensagens atingido. Tente novamente em ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  }

  // 6. Call Claude via the shared SDK wrapper (D-06) instead of raw fetch
  const result = streamText({
    model: insightModel,
    system,
    messages, // Array<{role: 'user'|'assistant', content: string}> — matches ModelMessage shape
  })

  return result.toTextStreamResponse()
}
```

**Important shape change this migration implies for the client:** The current client (`agente/page.tsx`) does `const data = await res.json(); const reply = data?.content?.[0]?.text` — this parses the **raw Anthropic Messages API JSON shape** (`{content: [{text}]}`), because today's route just proxies that JSON through unchanged. Once migrated to `streamText(...).toTextStreamResponse()`, the response body becomes a **plain text stream**, not JSON. `agente/page.tsx` MUST also change its response-handling code (not just add `tenant` to the request body) — reading `res.body.getReader()` and accumulating text chunks, the same technique `components/insights/streaming-insight-card.tsx` already uses for `/api/insights/generate`. This is a necessary consequence of D-06, not something CONTEXT.md called out explicitly — flagged here so the plan accounts for it as a required client change, not an optional one.

**Source:** `app/api/leads/chat/route.ts` [VERIFIED: read directly], `app/[tenant-slug]/leads/agente/page.tsx` [VERIFIED: read directly], `app/api/insights/generate/route.ts` [VERIFIED: read directly, same `toTextStreamResponse()` pattern already proven in production], `ai@7.0.22`'s `streamText` signature [VERIFIED: `node_modules/ai/dist/index.d.ts` line 3503, accepts `system`/`prompt`/`messages` as top-level options alongside `model`]

### Pattern 4: In-Memory Sliding-Window Rate Limiter

**What:** A `Map<string, number[]>` keyed by `user_id`, storing request timestamps; on each check, prune timestamps outside the window, then compare count to the max.

```typescript
// lib/rate-limit.ts
const buckets = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const windowStart = now - opts.windowMs
  const existing = (buckets.get(key) ?? []).filter(ts => ts > windowStart)

  if (existing.length >= opts.max) {
    const retryAfterSeconds = Math.ceil((existing[0] + opts.windowMs - now) / 1000)
    buckets.set(key, existing) // keep pruned array, don't grow it further on a rejected attempt
    return { allowed: false, retryAfterSeconds }
  }

  existing.push(now)
  buckets.set(key, existing)
  return { allowed: true, retryAfterSeconds: 0 }
}
```

**Design choices and why (verified against 2026 community practice, see Sources):**
- **No `setInterval`-based background cleanup.** The commonly-cited example pattern adds a `setInterval` sweep for stale entries. This project deliberately avoids that: a serverless Node function instance is torn down independent of any timer it started, so the timer provides no real cleanup guarantee across cold starts, and keeping a live interval handle in a serverless function is an unnecessary complication with no clear benefit at this scale (1-3 tenants, few users). Pruning happens lazily on read (the `.filter(ts => ts > windowStart)` above), which is sufficient — the `buckets` Map's worst-case size is bounded by (number of distinct authenticated users who have ever called this route within one warm instance's lifetime), which is small for this project.
- **Keyed by `user.id` (Supabase auth UUID), not IP.** D-03 is explicit: per-user, not per-tenant, and the concern is a single account exhausting the shared Anthropic key — IP-based limiting would be both wrong (multiple users behind the same NAT/office IP) and unnecessary (this isn't a public, unauthenticated endpoint).
- **`Retry-After` header on 429.** Not explicitly requested in CONTEXT.md but is the standard HTTP convention for rate-limit responses and costs nothing extra to include.

**Known, accepted limitation (already surfaced in CONTEXT.md, restated here for the plan):** This `Map` lives in one serverless function instance's memory. Vercel may run multiple concurrent instances of the same route (especially under load or across regions), and each cold start wipes the Map. This means the *effective* limit for a determined single user could be higher than 20/5min if requests land on different instances, and a burst immediately after a cold start starts counting from zero. **This is accepted as sufficient for 1-3 tenants with known, authenticated users** — the goal is "prevent casual/accidental runaway usage," not "cryptographically enforce a hard cap."

**Confidence:** MEDIUM-HIGH. The sliding-window `Map` algorithm itself is well-established and simple enough to verify by inspection (no external library behavior to trust). The serverless multi-instance caveat is corroborated by multiple independent sources (see below) and matches this project's own Vercel Hobby-tier deployment model already documented in CLAUDE.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT claim verification | Manual JWT decode (base64) | `supabase.auth.getClaims()` | Already the project's hard rule since the Phase 5 bugfix — `proxy.ts` is the one legacy exception (manual decode) that predates the fix and is out of this phase's scope to touch |
| Distributed/production-grade rate limiting | A "better" in-memory scheme (e.g., trying to simulate cross-instance sync with a global var, external file, etc.) | Accept the in-memory limitation as-is (D-02) or defer to Upstash/Redis in a future phase | CONTEXT.md already closed this decision; do not over-engineer within this phase's scope |
| Claude API calls | Raw `fetch` to `api.anthropic.com` | `streamText`/`insightModel` from `lib/ai/anthropic.ts` | Centralizes model ID, avoids duplicating headers/version strings, matches the one other AI call site in the codebase (D-06) |

**Key insight:** Every piece of "new" work in this phase is either (a) a straight copy of an existing, already-battle-tested pattern in this same repo, or (b) explicitly bounded by a locked CONTEXT.md decision that forecloses over-engineering. The main risk is not "not knowing the right pattern" but "introducing a subtle divergence" (e.g., different error message wording, different check order, forgetting `runtime = 'nodejs'`) between the three routes that should all behave identically.

## Runtime State Inventory

> Not applicable — this phase is not a rename/refactor/migration. It modifies request-handling logic in existing files and adds one new module; no stored data, external service config, OS-registered state, or build artifacts are affected. `sheets_service_account`/`sheets_api_key` data and Google Sheets state are untouched by this phase.

## Common Pitfalls

### Pitfall 1: Reading `user.app_metadata` from `getUser()` instead of `getClaims()`
**What goes wrong:** `tenant_slug`/`agency_id` silently resolve to `undefined`, and every `tenant_admin`/`agency` caller gets a 403 "Sem acesso a este tenant" even when they should be allowed — or worse, if the check is written carelessly (e.g., `!== undefined` instead of strict equality against the JWT-verified value), it could fail open.
**Why it happens:** `getUser()`'s `app_metadata` reflects the persisted `auth.users.raw_app_meta_data` column, which the Custom Access Token Hook never writes to; it's only ever set manually (as happened once, by accident, for the one bootstrapped `super_admin` account). Every user created via `admin.createUser()` (all `tenant_admin`/`agency` users) has this column effectively empty.
**How to avoid:** Always use `supabase.auth.getClaims()` for role/tenant/agency identity; `getUser()` is only for the "is there a session" boolean check. This is already the pattern in `PATCH /api/leads/[id]/status` — replicate it exactly, do not "simplify" it back to `getUser().app_metadata` in the two new call sites.
**Warning signs:** Any new code that reads `user.app_metadata` (from a `getUser()` result) for anything other than the initial `!user` 401 check.
**Source:** `.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md` [VERIFIED: read directly, this session — a real, previously-shipped bug in this exact codebase, fixed 2026-07-09]

### Pitfall 2: Missing `export const runtime = 'nodejs'`
**What goes wrong:** `getClaims()`'s JWT signature verification uses Node's `crypto` module (for RS256), which is unavailable in the Edge runtime — the route would throw or silently misbehave at runtime, not at build/type-check time.
**Why it happens:** Next.js Route Handlers default to a runtime that isn't guaranteed to be Node unless declared; `GET /api/leads` and `app/api/leads/chat/route.ts` currently have NO `export const runtime` declaration at all (confirmed by direct read), unlike `PATCH /api/leads/[id]/status/route.ts` (`export const runtime = 'nodejs'`, line 9) and `app/api/insights/generate/route.ts` (same, line 10).
**How to avoid:** Add `export const runtime = 'nodejs'` to both `GET /api/leads` and `POST /api/leads/chat` as part of this phase's changes — both now call `getClaims()` for the first time.
**Warning signs:** A 500 or a cryptic crypto-related error appearing only in production/Edge-deployed builds, not locally.

### Pitfall 3: Streaming response shape mismatch after the SDK migration
**What goes wrong:** If the client (`agente/page.tsx`) is NOT updated to read a streamed text body, `res.json()` on a `toTextStreamResponse()` result will either throw (invalid JSON) or silently produce garbage, breaking the chat UI entirely.
**Why it happens:** The current client parses the raw Anthropic Messages API JSON shape (`data.content[0].text`) because today's route is a transparent proxy. `streamText().toTextStreamResponse()` returns a `text/plain` streamed body, a structurally different contract.
**How to avoid:** Treat the client-side response handling change as a required part of D-06's migration, not an optional cleanup — mirror `components/insights/streaming-insight-card.tsx`'s `res.body.getReader()`/`TextDecoder` pattern (already proven working in this codebase for the exact same SDK method).
**Warning signs:** Chat UI shows `[object Object]`, `undefined`, or throws a JSON parse error in the browser console after the migration.

### Pitfall 4: Order-of-checks divergence causing inconsistent error codes across the 3 routes
**What goes wrong:** If `GET`/chat check tenant scope before the role gate (or vice-versa vs. PATCH), a caller with the wrong role but the right tenant could get a different status code (e.g. 403 "Sem acesso" instead of 403 "Apenas super_admin...") than an identical caller would get on the PATCH route — not a security bug per se, but breaks the consistency this phase exists to establish, and complicates future maintenance/testing.
**Why it happens:** Copy-paste across 3 files without a shared helper invites small transcription differences.
**How to avoid:** Follow the exact PATCH step order (auth → role → body validation → tenant/agency scope) in both new routes. Consider (Claude's Discretion, per CONTEXT.md) whether the auth+role+scope block is worth extracting into a small shared helper in `lib/` given it will now exist identically in 3 places — CONTEXT.md left this as an implementation detail, not a locked decision, so the planner may choose either verbatim duplication (lowest risk, matches "mirror exactly" instruction literally) or extraction (lower long-term maintenance cost). Given D-04's literal wording ("espelhar **exatamente**"), verbatim duplication is the safer literal reading; extraction is a reasonable improvement but changes the shape of what's being verified against the PATCH route as ground truth.

### Pitfall 5: Rate limiting keyed before authentication resolves a real user id
**What goes wrong:** If the rate-limit check runs before `getUser()` succeeds, there's no stable key to rate-limit on (falls back to something weak like IP, defeating D-03's explicit "per user_id" requirement).
**Why it happens:** Natural to want to reject "cheap" requests (rate limit) before "expensive" ones (DB calls for role/scope) for efficiency — but here the rate limit's whole point is per-user identity, which doesn't exist until after auth.
**How to avoid:** Order the rate-limit check AFTER auth resolves `user.id`, as shown in Pattern 3 above (step 5, after scope check, before the Claude call) — this also means an unauthorized/wrong-tenant request never counts against the user's quota, which is the desired behavior (only real, allowed chat usage should consume the budget).

## Code Examples

### Full auth/scope check (verbatim reference, from the live PATCH route)
```typescript
// Source: app/api/leads/[id]/status/route.ts, lines 35-96 (read directly this session)
// See Pattern 1 above for the complete, annotated version.
```

### `streamText` with multi-turn chat messages (verified against installed `ai@7.0.22`)
```typescript
// Source: node_modules/ai/dist/index.d.ts line 3503 (local verification, 2026-07-11)
// declare function streamText<...>({ model, system, prompt, messages, ... }: ...)
// messages?: Array<ModelMessage>  where ModelMessage.role ∈ {'system','user','assistant','tool'}
import { streamText } from 'ai'
import { insightModel } from '@/lib/ai/anthropic'

const result = streamText({
  model: insightModel,
  system: 'Você é um assistente...',
  messages: [{ role: 'user', content: 'Quais leads devo priorizar?' }],
})
return result.toTextStreamResponse()
```

### Client-side streamed text reading (already proven in this codebase)
```typescript
// Source: components/insights/streaming-insight-card.tsx (existing, working pattern — not re-read
// verbatim this session, but referenced by name in 06-CONTEXT.md's canonical_refs and confirmed to
// exist via app/api/insights/generate/route.ts's toTextStreamResponse() usage this session)
// Pattern: res.body.getReader() + TextDecoder, appended incrementally to component state.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `user.app_metadata` from `getUser()` for role/tenant/agency identity | `claims.app_metadata` from `getClaims()` | Fixed project-wide 2026-07-09 (commit `eec002f`) | This phase's two new call sites must use the post-fix pattern from the start — there is no "old way" to accidentally regress to if `PATCH`'s code is copied correctly |
| Raw `fetch` to Anthropic Messages API | `ai` SDK `streamText`/`generateText` + `@ai-sdk/anthropic` | Introduced Phase 4 (2026-07 timeframe) for `/api/insights/generate` and `/api/insights/daily` | `app/api/leads/chat/route.ts` is now the last remaining raw-fetch Claude call site in the codebase; this phase eliminates it |

**Deprecated/outdated:** None specific to this phase's domain beyond the above — no library version deprecations affect this work.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `components/insights/streaming-insight-card.tsx` uses `res.body.getReader()`/`TextDecoder` to consume a `toTextStreamResponse()` body (referenced but not re-read verbatim this session; based on 06-CONTEXT.md's canonical_refs description and the known shape of `toTextStreamResponse()`'s output) | Pattern 3, Code Examples | Low — if the exact reading technique differs slightly (e.g., uses a library helper instead of raw reader), the planner/executor should read this file directly before implementing the chat client change; the *existence* of a working precedent is what matters most here, not the exact syntax |
| A2 | No live user currently holds a `viewer`-role JWT that would be newly rejected by `GET /api/leads`'s new role gate (stated in Pattern 2) | Architecture Patterns / Pattern 2 | Low-medium — if a stale `viewer`-role JWT is still in circulation (STATE.md notes `'viewer'` was deliberately kept as a "rollout-safety-net" type in `proxy.ts`/`tenant-store.tsx` even after the Phase 5 collapse), that user's leads page would break with a 403 for the first time after this phase ships. Mitigation: this is inherent to D-07's literal instruction ("mesmo padrão... sem ambiguidade") — not something this phase should design around, but worth a one-line mention in the plan's rollout notes in case a support ticket appears |

**If this table is empty:** N/A — see above, two low-risk items logged for planner awareness, neither blocks planning.

## Open Questions

1. **Should the auth/role/scope check block be extracted into a shared `lib/` helper given it will now exist in 3 near-identical copies (PATCH, GET, chat)?**
   - What we know: CONTEXT.md's D-04 says "espelhar exatamente" (mirror exactly) — read literally, this favors verbatim duplication over abstraction, since "exactly" is easiest to verify against the ground-truth PATCH file when the code is textually identical.
   - What's unclear: Whether "espelhar exatamente" was meant as "produce the same behavior" (compatible with extraction) or "copy the same code" (favors duplication). CONTEXT.md's Claude's Discretion section doesn't explicitly list this choice, but implies structural details are open ("Estrutura exata do módulo de rate limiting... detalhe de implementação" is listed for the rate limiter, not this check).
   - Recommendation: Default to verbatim duplication across the 3 files for this phase (lowest risk, easiest to verify against Pitfall 4, matches the literal instruction). Leave extraction as a natural follow-up refactor for a future phase once a 4th call site would otherwise need the same block — not now, to avoid scope creep into a security-hardening phase.

2. **Does `GET /api/leads`'s new role gate correctly exclude the phase from needing to touch RLS?**
   - What we know: CONTEXT.md explicitly says the RLS policy (`tenants_agency_select`, `tenants_member_select`) "permanece como defesa em profundidade... não remover RLS" — this phase is additive-only at the application layer.
   - What's unclear: Nothing substantive — this is confirmed, not actually open. Restated here only so the plan doesn't accidentally propose an RLS migration as part of this phase (out of scope, no migration files are needed).
   - Recommendation: No RLS changes in this phase's plan. Zero new `supabase/migrations/*.sql` files expected.

## Environment Availability

> Skipped — this phase has no new external dependencies (no new packages, no new services, no new env vars beyond the already-configured `ANTHROPIC_API_KEY`, which `app/api/leads/chat/route.ts` already checks for and `/api/insights/generate` already depends on in production).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 [VERIFIED: package.json] |
| Config file | none dedicated found — relies on `vite-tsconfig-paths` + Vitest defaults (matches existing `tests/unit/leads-status-route.test.ts` and `tests/unit/insights-generate-route.test.ts`, both run successfully today via `vitest run`) |
| Quick run command | `npx vitest run tests/unit/leads-status-route.test.ts tests/unit/leads-chat-route.test.ts tests/unit/leads-get-route.test.ts tests/unit/rate-limit.test.ts` (new files per Wave 0 gaps below) |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| AGENCY-08 | `GET /api/leads`: no auth → 401 | unit | `npx vitest run tests/unit/leads-get-route.test.ts` | ❌ Wave 0 |
| AGENCY-08 | `GET /api/leads`: role `viewer`/unknown/RPC-error → 403 | unit | same file | ❌ Wave 0 |
| AGENCY-08 | `GET /api/leads`: `tenant_admin` with mismatched `tenant_slug` → 403 | unit | same file | ❌ Wave 0 |
| AGENCY-08 | `GET /api/leads`: `tenant_admin` with matching `tenant_slug` → 200 | unit | same file | ❌ Wave 0 |
| AGENCY-08 | `GET /api/leads`: `agency` with no grant → 403; with grant → 200 | unit | same file | ❌ Wave 0 |
| AGENCY-08 | `GET /api/leads`: `super_admin` → 200 unconditionally | unit | same file | ❌ Wave 0 |
| F3 (chat hardening) | `POST /api/leads/chat`: no auth → 401 | unit | `npx vitest run tests/unit/leads-chat-route.test.ts` | ❌ Wave 0 |
| F3 | `POST /api/leads/chat`: missing `tenant` in body → 400 | unit | same file | ❌ Wave 0 |
| F3 | `POST /api/leads/chat`: role gate identical to PATCH (viewer/unknown/RPC-error → 403) | unit | same file | ❌ Wave 0 |
| F3 | `POST /api/leads/chat`: `tenant_admin`/`agency` scope mismatch → 403; match → 200 (streamed) | unit | same file | ❌ Wave 0 |
| F3 | `POST /api/leads/chat`: rate limit — 21st call within window → 429 with `Retry-After` | unit | `npx vitest run tests/unit/rate-limit.test.ts` (pure function, no route needed) + one integration-style assertion in `leads-chat-route.test.ts` calling the route 21 times | ❌ Wave 0 |
| F3 | `POST /api/leads/chat`: uses `streamText`/`insightModel`, not raw `fetch` | unit (mock `ai`'s `streamText`, assert it was called, mirrors `insights-generate-route.test.ts`'s `vi.mock('ai', ...)` pattern) | same file | ❌ Wave 0 |
| D-08 (cleanup) | No untracked files remain under `app/api/leads/` or `app/[tenant-slug]/leads/` | manual / git check | `git status --porcelain -- app/api/leads app/[tenant-slug]/leads` → empty output | N/A — not a code test, a repo-state check |

### Sampling Rate
- **Per task commit:** Run the specific new/modified test file (e.g., `npx vitest run tests/unit/leads-chat-route.test.ts`).
- **Per wave merge:** `npm test` (full suite — currently 183+ tests passing per STATE.md; watch for the pre-existing, documented `anomaly_alerts` realtime websocket cold-start flake, which is unrelated to this phase and should be re-run in isolation if it appears).
- **Phase gate:** Full suite green, plus `git status --porcelain -- app/api/leads "app/[tenant-slug]/leads"` returns empty (D-08's literal success criterion), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/unit/leads-get-route.test.ts` — new file, covers AGENCY-08 for `GET /api/leads`. Mirror `tests/unit/leads-status-route.test.ts`'s mock structure (`mockState.user`/`role`/`roleError`/`grant`, `vi.mock('@/lib/supabase/server', ...)`) since the auth/role/scope logic is structurally identical to the PATCH route already tested there.
- [ ] `tests/unit/leads-chat-route.test.ts` — new file, covers F3 hardening + SDK migration for `POST /api/leads/chat`. Mirror `tests/unit/insights-generate-route.test.ts`'s `vi.mock('ai', () => ({ streamText: () => ({ toTextStreamResponse: () => new Response('ok') }) }))` pattern to avoid real Anthropic API calls in tests, combined with `leads-status-route.test.ts`'s role/scope mock structure.
- [ ] `tests/unit/rate-limit.test.ts` — new file, pure unit tests for `lib/rate-limit.ts`'s `checkRateLimit()` (no route/Supabase mocking needed — a plain function test). Should cover: allows up to `max` calls, rejects the `max+1`th call within the window, allows again after the window elapses (use `vi.useFakeTimers()`/`vi.setSystemTime()` to avoid real 5-minute waits in the test suite), and confirms different keys (`user_id`s) don't interfere with each other's counts.
- [ ] Framework install: none — Vitest already configured and used by 3+ existing test files in this exact domain (`tests/unit/leads-status-route.test.ts`, `tests/unit/insights-generate-route.test.ts`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | Server-derived authorization via `get_user_role()` RPC + `getClaims()`-sourced `tenant_slug`/`agency_id`, never trusting client-supplied `tenant` alone (this is literally what AGENCY-08 and this phase are about) |
| V5 Input Validation | yes | Zod (`zod/v4`) schemas for request bodies (`tenant`, `status`/`system`/`messages` enums and min-length strings), matching the existing `BodySchema` pattern in the PATCH route |
| V6 Cryptography | no (indirect only) | JWT signature verification is handled entirely by Supabase's `getClaims()` — this phase does not implement any cryptographic primitive itself, only calls the SDK method correctly |
| V13 API / Rate Limiting (ASVS 4.0's "Malicious Automation" / configuration category covers this under access control and abuse-case handling) | yes | In-memory sliding-window limiter (D-02/D-03) — explicitly scoped to abuse-prevention for a shared, costed external API key, not as a general DoS defense |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| IDOR/BOLA via client-supplied `tenant` identifier (OWASP API1:2023) — the exact class of bug already found and fixed once in `PATCH /api/leads/[id]/status` (Phase 5 Plan 08, finding T-05-13) | Elevation of Privilege | Server-derived scope check via `getClaims()` + `agency_tenants` grant lookup, applied identically to `GET /api/leads` and `POST /api/leads/chat` in this phase |
| Open proxy / cost-abuse of a shared third-party API key (F3's core finding — any authenticated user, of any role/tenant, could call the chat endpoint with zero rate limit) | Denial of Service (resource exhaustion) / Elevation of Privilege (using a shared credential beyond intended scope) | Role gate (reject any role outside the 3 allowed) + tenant/agency scope check + per-user sliding-window rate limit (20/5min) |
| Untracked/uncommitted security-relevant code silently diverging from what's been reviewed (D-08's concern — this exact situation is how F3 existed undetected for so long: `app/api/leads/chat/route.ts` was live in the running app since 2026-05-17 per CONTEXT.md but never in git, never reviewed) | Repudiation / Tampering (no audit trail) | Commit both previously-untracked paths as part of this phase's completion criteria |

## Sources

### Primary (HIGH confidence)
- `app/api/leads/[id]/status/route.ts` — read directly, this session; the canonical pattern source
- `app/api/leads/chat/route.ts` — read directly, this session; current unhardened state
- `app/api/leads/route.ts` — read directly, this session; current unscoped state
- `app/[tenant-slug]/leads/agente/page.tsx` — read directly, this session; client that must add `tenant` + change response parsing
- `lib/ai/anthropic.ts`, `app/api/insights/generate/route.ts` — read directly, this session; the SDK migration target pattern
- `.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md` — read directly, this session; root cause and fix for the `getClaims()` requirement
- `.planning/v1.0-MILESTONE-AUDIT.md` — read directly, this session; origin of F3 and AGENCY-08-partial
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `06-CONTEXT.md` — read directly, this session
- `node_modules/ai/dist/index.d.ts` (installed `ai@7.0.22`) — inspected directly via Grep/Read this session; confirms `streamText`'s `system`/`prompt`/`messages` top-level options and `ModelMessage` type
- `supabase/migrations/0016_restrict_sheets_service_account_column.sql`, `0018_agency_scoped_rls_policies.sql` — read directly, this session; confirms column grants and existing RLS defense-in-depth
- `tests/unit/leads-status-route.test.ts`, `tests/unit/insights-generate-route.test.ts` — read directly, this session; mocking patterns to replicate for Wave 0

### Secondary (MEDIUM confidence)
- [AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — general API shape confirmation, cross-checked against locally installed types (which take precedence as ground truth for the exact installed version)
- [How to Build an In-Memory Rate Limiter in Next.js](https://www.freecodecamp.org/news/how-to-build-an-in-memory-rate-limiter-in-nextjs/) — sliding-window `Map` algorithm shape, adapted (with the `setInterval` cleanup deliberately dropped, see Pattern 4 rationale)
- [Rate Limiting Next.js API Routes: In-Memory, Redis, and Plan-Based Limits (DEV Community)](https://dev.to/whoffagents/rate-limiting-nextjs-api-routes-in-memory-redis-and-plan-based-limits-5coo) — corroborates the serverless multi-instance/cold-start limitation of in-memory limiters

### Tertiary (LOW confidence)
- None used as load-bearing claims in this document — all rate-limiting and streaming claims were cross-verified against either this repo's own installed code or multiple independent community sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing ones verified against `package.json` and, for `ai`, against the actual installed type declarations
- Architecture: HIGH — the entire pattern to replicate is read directly from a live, working, previously-security-reviewed file in this same repo; no external-library guesswork involved
- Pitfalls: HIGH — 3 of 5 pitfalls are documented, previously-real bugs in this exact codebase (Pitfall 1, and the general class behind Pitfall 4); the other 2 (Pitfall 3 streaming shape, Pitfall 5 ordering) are derived from direct inspection of the current vs. target code, not speculation
- Rate limiting design: MEDIUM-HIGH — algorithm correctness is self-evident by inspection; the serverless-caveat framing is corroborated by multiple sources and matches a limitation the user has already explicitly accepted

**Research date:** 2026-07-11
**Valid until:** 30 days (stable domain — no fast-moving external API surface involved; the one dependency on external knowledge, `ai@7.0.22`'s API shape, was verified against the exact installed version, not a moving target)
