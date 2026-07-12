# Phase 10: Gestão de Usuários - Research

**Researched:** 2026-07-12
**Domain:** Supabase Auth Admin API (email/password update, session revocation) + Server Action authorization + shadcn/base-ui dropdown-in-table pattern
**Confidence:** MEDIUM — one locked assumption (D-05) is contradicted by verified platform behavior; session-revocation mechanism requires a NEW Postgres function not yet in the codebase or CONTEXT.md's canonical refs

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tabela e ações por linha**
- **D-01:** As 3 ações (editar email, resetar senha, remover acesso) ficam atrás de um dropdown de ações (⋮) por linha, usando o componente `dropdown-menu.tsx` já existente no design system (nunca usado até agora) — evita poluir a linha com 3 botões lado a lado.
- **D-02:** Os formulários de editar email, resetar senha e confirmar remoção vivem em Modal/Dialog — mesmo padrão do `AddUserModal`/`AddAgencyUserModal` já existentes, não um Sheet/drawer lateral.
- **D-03:** A tabela mostra apenas email + coluna de ações. Sem data de vinculação, sem "último login" (exigiria chamada admin extra por usuário, fora de escopo).

**Fluxo de reset de senha**
- **D-04:** Resetar senha gera uma nova senha temporária via `generateTempPassword()` + `supabase.auth.admin.updateUserById`, exibida uma vez num Dialog com botão "copiar" — mesmo padrão/UX do `AddUserModal` (Phase 5), não um email de recuperação do Supabase.
- **D-05:** Resetar senha NÃO revoga sessões ativas do usuário — ele continua logado normalmente, só precisa da senha nova no próximo login. Diferente do comportamento de USER-05 (remoção de acesso), que é explícito sobre revogação imediata.
  **⚠️ See "Critical Finding — D-05" below: this is a factual claim about platform behavior, verified in this research to be at odds with current hosted-Supabase GoTrue behavior. Not re-litigating the decision — flagging that the underlying assumption needs the planner/user's attention.**

**Consequência da edição de email**
- **D-06:** A troca de email é imediata, sem exigir confirmação do novo endereço pelo usuário — `supabase.auth.admin.updateUserById({email, email_confirm:true})`, mesmo padrão de `email_confirm` usado na criação de usuário (Phase 5).
- **D-07:** Editar o email NÃO revoga a sessão ativa do usuário — consistente com D-05 (reset de senha também não revoga).

**UX de remoção de acesso**
- **D-08:** Confirmação via `AlertDialog` simples ("tem certeza?") com botão destrutivo — sem fricção extra de digitar nome/email para confirmar. A ação é soft-delete reversível (conta Auth preservada) numa tela já restrita a Super Admin.
- **D-09:** Depois de remover o acesso, a linha desaparece da tabela (`router.refresh()`) e um toast confirma "Acesso removido e sessão encerrada" — usando `sonner`.

### Claude's Discretion

- **Checagem de autorização server-side em cada nova Server Action.** Nenhuma Server Action existente reverifica `role` no servidor hoje. As novas actions desta phase incluem checagem explícita `role === 'super_admin'` dentro de cada action.
  **⚠️ See "Architecture Patterns → Authorization pattern" below: CONTEXT.md's literal reference is to `proxy.ts` (middleware, Edge-runtime JWT-atob-decode). Research recommends the safer, already-established Route Handler idiom (`getUser()` + `rpc('get_user_role')`) instead of literally re-implementing middleware's manual decode — same outcome, avoids reintroducing the `app_metadata` bug class documented in STATE.md.**
- **Estrutura exata dos novos Server Actions** segue `lib/actions/tenants.ts`/`agencies.ts` — `'use server'`, Zod schema, retorno `{ok:true,...} | {error}`, `revalidatePath` após sucesso.
- **Diferenciação tenant vs agência** — a UI/rota já sabe o contexto pela página onde está, não precisa de seletor extra.

### Deferred Ideas (OUT OF SCOPE)

- **USER-06** (mover usuário entre tenant/agência sem recriar a conta) — Future Requirement, confirmado fora do escopo desta phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USER-01 | Listar usuários de um tenant em `/tenants/[slug]` | Query pattern below (`tenant_users` join `auth.users` via service client — PostgREST cannot join `auth.users` directly, see Pitfall 1) |
| USER-02 | Listar usuários de uma agência em `/agencies/[id]` | Same pattern as USER-01, `agency_users` |
| USER-03 | Editar email de usuário existente | `admin.updateUserById(userId, {email, email_confirm:true})` — verified semantics below |
| USER-04 | Resetar senha de usuário existente | `admin.updateUserById(userId, {password})` — verified semantics below, **contradicts D-05 assumption** |
| USER-05 | Remover acesso (soft-delete do vínculo) + revogação de sessão imediata | Hard-delete `tenant_users`/`agency_users` row + custom session-revocation RPC (no built-in SDK method targets an arbitrary user by ID — see Critical Finding) |

</phase_requirements>

## Summary

This phase adds zero new npm dependencies — everything needed (Dialog, AlertDialog, DropdownMenu, Table, sonner, Zod, service-role Supabase client) is already installed and has an established usage pattern in `lib/actions/tenants.ts`/`agencies.ts` and their consuming modals. The real technical risk is not "which library" but **whether the Supabase Admin API actually behaves the way CONTEXT.md's locked decisions (D-05, USER-05) assume it does**.

Two verified findings materially affect implementation:

1. **`admin.updateUserById(userId, {password})` may itself kill the target user's current session** on Supabase's hosted platform (not just on next login) — this is the opposite of D-05's stated assumption ("resetar senha NÃO revoga sessões"). This is a documented, closed-as-not-planned GoTrue behavior change (post-v2.149), reproducible on hosted Supabase but not on older self-hosted/CLI builds. **This needs live verification against this project's actual Supabase instance before the plan can assert D-05's premise as fact.**
2. **There is no supabase-js Admin API method that revokes an arbitrary OTHER user's sessions by user ID.** `supabase.auth.admin.signOut(jwt, scope)` takes the TARGET user's own JWT as its first argument — a Super Admin removing someone else's access never has that JWT. The only way to achieve "revoke this specific user's ability to keep using the app" server-side, without their JWT, is a **new Postgres `SECURITY DEFINER` function** that deletes rows from `auth.sessions` (cascades to `auth.refresh_tokens`), called via RPC from the service-role client. This function does not exist yet anywhere in `supabase/migrations/`. Even then, **an already-issued, unexpired access token remains valid** — Supabase JWTs are stateless and are checked only for signature+expiry, never against a sessions table, on every request. "Revogação imediata" is therefore best understood as "revoke the ability to get a new access token" (immediate for anything after the current token's `exp`), not "invalidate a token that's already sitting in the browser's memory this second." This is a platform-level limitation, not an implementation gap.

**Primary recommendation:** Build a new migration adding `public.revoke_user_sessions(target_user_id uuid)` (SECURITY DEFINER, deletes from `auth.sessions`), call it from the "remover acesso" Server Action via `createServiceClient().rpc('revoke_user_sessions', {...})` right after deleting the `tenant_users`/`agency_users` row, and treat `admin.signOut()` as **not applicable** to this use case despite USER-05's literal wording. Author the reset-password and edit-email Server Actions using the already-established `getUser()` + `rpc('get_user_role')` authorization gate (not `proxy.ts`'s middleware-specific manual JWT decode), and open confirmation/edit Dialogs from `DropdownMenuItem.onClick` with dialog `open` state controlled outside the menu (per Base UI's own documented pattern) to avoid focus/portal conflicts.

## Critical Finding — D-05 assumption needs live verification

CONTEXT.md's D-05 states: *"Resetar senha NÃO revoga sessões ativas do usuário — ele continua logado normalmente."* This is presented as a description of `supabase.auth.admin.updateUserById(id, {password})`'s behavior, not as a design choice the team is free to implement either way — the team cannot make a hosted Supabase Auth server not terminate a session if that's what it does.

**What was found `[CITED: GitHub issue supabase/auth#1579]`:** GoTrue used to leave the user's session untouched after an admin password update (confirmed reproducible on self-hosted GoTrue v2.149). On Supabase's **hosted** platform, in more recent Auth server builds, the same call **immediately kills the user's existing session**, forcing re-authentication. The issue was closed "not planned" — i.e., Supabase does not consider this a bug to fix, implying it may now be the platform's stable, intended behavior for hosted projects.

**Why this matters for planning:** if the live project's Auth server exhibits this behavior, then D-05/D-07's premise ("user stays logged in after password reset / email edit") is simply false on this stack, regardless of what the app's code does — no code change can prevent GoTrue-side session termination on a password update. This doesn't block building the feature (the Dialog/temp-password UX is unaffected either way), but it changes what UI copy and QA expectations should be, and it means the "manual" verification step for USER-04 (Validation Architecture, below) must explicitly check whether the reset user's existing session survives — do not assume the answer.

**Confidence:** MEDIUM — based on a GitHub issue and community discussion (`[CITED]`), not an official changelog entry with a version number, and not verified against this project's specific hosted instance (no direct DB/Auth-settings access in this research session). Recommend the planner add "confirm live" as an explicit verification task rather than asserting either behavior as fact in the plan.

## Standard Stack

### Core (all already installed — zero new dependencies for this phase)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.105.4 (latest on npm: **2.110.2** `[VERIFIED: npm registry]`) | `createServiceClient()` for `auth.admin.*` calls | Already the project's only Supabase Admin API surface |
| `@base-ui/react` | ^1.4.1 (latest: **1.6.0** `[VERIFIED: npm registry]`) | Underlies `dropdown-menu.tsx`, `dialog.tsx`, `alert-dialog.tsx` | Already the project's headless-UI primitive layer (not Radix) |
| `zod` | ^4.4.3 (latest: **4.4.3** `[VERIFIED: npm registry]`, current) | Server Action input validation | Established pattern in `lib/actions/*.ts` |
| `sonner` | ^2.0.7 | Toast on removal ("Acesso removido e sessão encerrada") | Already configured, D-09 |

No installation step needed for this phase. Minor available bumps (`@supabase/supabase-js` 2.105.4→2.110.2, `@base-ui/react` 1.4.1→1.6.0) are optional housekeeping, not required — do not bundle an unrelated dependency bump into this phase's plan unless the planner has a specific reason tied to a bug fix relevant here.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `revoke_user_sessions()` Postgres RPC | `supabase.auth.admin.signOut(jwt, scope)` | Not viable — requires the TARGET user's own JWT, which the caller (Super Admin) never has for another user's account. Confirmed via `auth-js` source (`GoTrueAdminApi.signOut(jwt: string, scope)`). |
| Custom `revoke_user_sessions()` Postgres RPC | Shortening JWT expiry project-wide | Out of scope — a global config change affecting every session in the app, not a per-action revocation; also not something this phase's Server Actions can control (Auth server setting, not code) |

## Architecture Patterns

### Recommended file additions
```
lib/actions/
├── tenants.ts          # existing — add editTenantUserEmail / resetTenantUserPassword / removeTenantUser
├── agencies.ts          # existing — add editAgencyUserEmail / resetAgencyUserPassword / removeAgencyUser
components/
├── tenants/
│   ├── tenant-users-table.tsx       # new — table + dropdown, mirrors tenants-table.tsx structure
│   ├── edit-user-email-dialog.tsx   # new — mirrors add-user-modal.tsx's Dialog shape
│   ├── reset-user-password-dialog.tsx # new — mirrors add-user-modal.tsx's "show once" success state
│   └── remove-user-access-dialog.tsx  # new — AlertDialog, mirrors deactivate-tenant-button.tsx
├── agencies/
│   └── (parallel agency-scoped versions of the four above)
supabase/migrations/
└── 0023_revoke_user_sessions_function.sql   # NEW — not in CONTEXT.md's canonical_refs, required for USER-05
```

### Pattern 1: Fetching `tenant_users`/`agency_users` joined with `auth.users.email`

**What:** PostgREST (the `public`-schema client used everywhere else in this codebase) cannot join across schema boundaries into `auth.users` — that schema is not exposed to PostgREST at all (confirmed by this codebase's own precedent: Phase 4 Plan 02 found `pg_catalog` unreachable via `.from()`; `auth.*` is the same class of restriction, arguably even more locked down since it holds credentials). The existing `lib/actions/*.ts` `admin.createUser()` calls already prove the ONLY way to touch `auth.users` is `createServiceClient().auth.admin.*` methods, never `.from('auth.users')`.

**When to use:** any read of user email for the new tables.

**Recommended approach:** query `tenant_users`/`agency_users` (public schema, `service_role` — same client already used for the create-user flow) for `user_id`s scoped to the tenant/agency, then call `supabase.auth.admin.getUserById(userId)` per row (or `listUsers()` + filter, if row counts stay small — v1.1 tenants remain 1-3 per D-03 scope, so N+1 admin calls per page load is acceptable at this scale; do not over-engineer a bulk lookup for 1-3 tenants × a handful of users each).

```typescript
// Server Component (page.tsx) — read path, mirrors existing tenant/agency detail page pattern
const service = createServiceClient()
const { data: links } = await supabase // public client is fine for tenant_users/agency_users (RLS: super_admin_all)
  .from('tenant_users')
  .select('user_id')
  .eq('tenant_id', tenant.id)

const users = await Promise.all(
  (links ?? []).map(async (l) => {
    const { data } = await service.auth.admin.getUserById(l.user_id)
    return { id: l.user_id, email: data?.user?.email ?? '(desconhecido)' }
  })
)
```
`[ASSUMED]` — no official Supabase doc explicitly states PostgREST cannot reach `auth.users`; this is inferred from (a) `auth` schema not being in PostgREST's exposed-schemas default/config, and (b) every existing write to `auth.users` in this codebase going exclusively through `auth.admin.*`. High-confidence inference, not independently confirmed against this project's `db-schemas` PostgREST setting.

### Pattern 2: Server Action authorization gate (supersedes literal `proxy.ts` reference)

CONTEXT.md's discretion note points at `proxy.ts` lines 79-93 as "the pattern to replicate." `proxy.ts`'s actual mechanism is a manual `atob()`-decode of the JWT payload — this exists ONLY because Next.js Middleware historically ran on the Edge runtime (no Node `crypto`, so `getClaims()`'s RS256 verification wasn't available there). Server Actions run in the Node.js runtime by default — they do not have that constraint, and the codebase already has a safer, tested idiom for exactly this "is caller X role" check, used in every hardened Route Handler since Phase 5's `getUser().app_metadata` bug (`STATE.md` "Key Decisions Locked" — that bug shipped from trusting a manually-read metadata field that the Custom Access Token Hook never populates for non-super_admin roles created via `admin.createUser()`).

**Recommended pattern (verified against `app/api/google-ads/connect/route.ts` and `app/api/leads/[id]/status/route.ts`, both post-bug-fix):**

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' as const }
  const { data: role, error: roleErr } = await supabase.rpc('get_user_role')
  if (roleErr || role !== 'super_admin') {
    return { error: 'Apenas super_admin pode executar esta ação.' as const }
  }
  return { ok: true as const }
}

export async function editTenantUserEmail(input: { userId: string; email: string; tenantId: string }) {
  const gate = await requireSuperAdmin()
  if ('error' in gate) return gate
  const parsed = editUserEmailSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const service = createServiceClient()
  const { error } = await service.auth.admin.updateUserById(parsed.data.userId, {
    email: parsed.data.email,
    email_confirm: true,
  })
  if (error) return { error: error.message }

  revalidatePath(`/tenants/${parsed.data.tenantId}`)
  return { ok: true as const }
}
```
`get_user_role()` MUST be called through the **user-session-bound** client (`createClient()`), never the service-role client — the function reads `current_setting('request.jwt.claims')`, which PostgREST only populates from the caller's own JWT (`[VERIFIED: codebase]` `supabase/migrations/0003_create_helper_functions.sql`). Calling it via `createServiceClient()` will silently return `NULL`.

### Pattern 3: Opening a Dialog/AlertDialog from a DropdownMenuItem (Base UI)

Base UI's own docs (`[CITED: base-ui.com/react/components/menu]`) explicitly warn against nesting a `Dialog.Trigger`/`AlertDialog.Trigger` inside a `Menu.Item` — control the dialog's `open` state externally and set it imperatively from the item's `onClick`:

```tsx
'use client'
function UserRowActions({ userId, email, tenantId }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar e-mail</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)}>Resetar senha</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>
            Remover acesso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserEmailDialog open={editOpen} onOpenChange={setEditOpen} userId={userId} email={email} tenantId={tenantId} />
      <ResetUserPasswordDialog open={resetOpen} onOpenChange={setResetOpen} userId={userId} tenantId={tenantId} />
      <RemoveUserAccessDialog open={removeOpen} onOpenChange={setRemoveOpen} userId={userId} tenantId={tenantId} />
    </>
  )
}
```
Each `*Dialog`/`AlertDialog` component takes `open`/`onOpenChange` as controlled props (rather than owning its own trigger internally, unlike `AddUserModal`'s self-contained `DialogTrigger` pattern) — this is a deliberate deviation from `AddUserModal`'s shape, required specifically because the trigger now lives inside a `DropdownMenuItem`, not a standalone button. `[VERIFIED: base-ui.com official docs]`

### Anti-Patterns to Avoid
- **Nesting `DialogTrigger`/`AlertDialogTrigger` inside `DropdownMenuItem`:** causes focus-trap/portal races per Base UI's own documented guidance — control dialog `open` state outside the menu instead (Pattern 3).
- **Calling `get_user_role()` via the service-role client:** returns `NULL` silently (no error thrown), which would make the authorization gate always reject with the generic 403 message rather than actually checking the caller's role — looks like it "works" (fails closed) in casual testing but never actually distinguishes super_admin from anyone else if the wrong client is used by mistake.
- **Blind `DELETE FROM tenant_users WHERE user_id = X`** (no `tenant_id` filter): `tenant_users` has `UNIQUE(tenant_id, user_id)` but **no** `UNIQUE(user_id)` constraint (unlike `agency_users`, which does have `UNIQUE(user_id)`) — a single `auth.users` row can legitimately belong to more than one tenant's `tenant_users`. Always scope the remove-access delete by BOTH `tenant_id` AND `user_id` `[VERIFIED: supabase/migrations/0002_create_tenants.sql]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp password generation | New random-string logic | `generateTempPassword()` already defined in `lib/actions/tenants.ts`/`agencies.ts` | Exact function exists twice already (duplicated, not shared) — extracting to a shared `lib/actions/shared.ts` is a reasonable in-scope refactor but not required; do not write a third copy with different entropy/charset |
| Detecting "is this email already registered" error | String-matching a different substring | Reuse the existing `authError.message?.toLowerCase().includes('already')` check already used in both `createTenantUser`/`createAgencyUser` | `admin.updateUserById({email})` can return the same "email already registered" class of error if the new email collides with another account — same error-message convention applies |
| Revoking a user's ability to keep using the app | A client-side `signOut()` call, or trying to pass a `userId` into `admin.signOut()` | New `revoke_user_sessions(uuid)` Postgres RPC (deletes `auth.sessions` rows) | `admin.signOut(jwt, scope)` requires the TARGET user's JWT, never available to an admin acting on someone else's account — see Critical Finding above |

**Key insight:** every session-related assumption in this phase must be checked against "does the admin actually possess the material (JWT) this API needs," not just "does a method with a plausible name exist."

## Common Pitfalls

### Pitfall 1: `admin.signOut()` cannot target an arbitrary user by ID
**What goes wrong:** Writing `supabase.auth.admin.signOut(targetUserId, 'global')` compiles as valid JS (loose typing on the string param) but is semantically wrong — GoTrue's underlying `/logout` behavior keys off the JWT's own `session_id` claim, not a lookup of "whichever session belongs to this user ID." Passing a raw UUID where a JWT is expected will fail (malformed JWT) or, worse, silently no-op depending on how the error is (not) handled.
**Why it happens:** USER-05's own requirement text literally says `signOut('global')`, which reads as if it's a drop-in call — the JS SDK method of the same name has a completely different parameter contract than what the requirement's phrasing implies.
**How to avoid:** Build `revoke_user_sessions(target_user_id uuid)` as a migration (SECURITY DEFINER, `DELETE FROM auth.sessions WHERE user_id = target_user_id`), call it via `createServiceClient().rpc('revoke_user_sessions', { target_user_id: userId })`.
**Warning signs:** any Server Action code that passes a `userId` variable directly as the first arg to `admin.signOut`.

### Pitfall 2: "Immediate" session revocation has a hard platform ceiling
**What goes wrong:** Assuming the remove-access flow makes the target user's browser tab instantly unable to make another request.
**Why it happens:** Supabase access tokens are stateless JWTs, checked only for signature+expiry on every request — never against a live sessions table `[CITED: github.com/orgs/supabase/discussions/13941]`. Revoking the session (however it's done) prevents minting a NEW access token; it does not invalidate one already issued and sitting in the browser.
**How to avoid:** Set correct expectations in the plan/UI copy — "revogado imediatamente" should be understood/communicated as "cannot get a new session," with the residual exposure window bounded by the project's configured JWT expiry (commonly a default of 3600s/1h on Supabase, **not verified against this specific project's Auth settings in this research session** — flagged as an Open Question below).
**Warning signs:** a plan or verification step that asserts "user is logged out within N seconds" without checking the actual JWT expiry configured for this project.

### Pitfall 3: `admin.updateUserById({password})` may itself kill the session it's supposedly not touching (D-05)
**What goes wrong:** the reset-password flow is planned/tested assuming the user stays logged in (D-05), but the platform silently ends their session as a side effect of the password change itself, before the "remover acesso" flow (USER-05) ever runs.
**Why it happens:** documented hosted-GoTrue behavior change (see Critical Finding above) — closed as "not planned" by Supabase, meaning it is not being reverted.
**How to avoid:** treat this as an explicit, callable-out manual verification item (see Validation Architecture) rather than asserting the D-05 premise as settled fact in the plan.
**Warning signs:** a UAT script that fails because a test user is unexpectedly logged out after a password reset, with the plan's acceptance criteria written as if that shouldn't happen.

### Pitfall 4: Editing email changes it for every tenant/agency the user belongs to
**What goes wrong:** `auth.users.email` is a single global value. If a user happens to belong to more than one tenant (schema allows this — no `UNIQUE(user_id)` on `tenant_users`), editing their email from one tenant's page changes it everywhere that user has access, not just "within this tenant."
**Why it happens:** email lives on `auth.users`, not on the `tenant_users`/`agency_users` join row.
**How to avoid:** no code fix needed — this is expected, correct behavior for a single Auth identity — but the plan should not phrase UI copy as if the edit is tenant-scoped ("editar e-mail deste usuário" is accurate; "editar e-mail deste usuário neste tenant" would be misleading).
**Warning signs:** none functionally — a documentation/copy-accuracy concern only, worth a one-line note in the plan.

### Pitfall 5: reusing `dropdown-menu.tsx` as the first real consumer
**What goes wrong:** the component (`components/ui/dropdown-menu.tsx`) has never been rendered in this app — any Base UI `Menu` API mismatch (e.g., prop name drift between the installed `1.4.1` and what the component file's types expect) would surface for the first time in this phase, not caught by any existing test or manual smoke-check.
**Why it happens:** shadcn-generated primitives are typically installed and never revisited until a real feature needs them; Phase 10 is that first real feature per CONTEXT.md's own canonical_refs note.
**How to avoid:** the plan's Wave 0/manual verification should include an explicit "does the dropdown open/close and keyboard-navigate correctly in a real table row" check, not just a Server Action unit test — this component has zero prior production exposure.
**Warning signs:** any TypeScript error inside `dropdown-menu.tsx` itself surfacing only once Phase 10's table is written (would indicate the component was never type-checked against real usage before).

## Code Examples

### Postgres session-revocation function (new migration required)
```sql
-- supabase/migrations/0023_revoke_user_sessions_function.sql
-- Phase 10 (USER-05): admin.signOut(jwt, scope) requires the TARGET user's own JWT, which a
-- Super Admin removing someone else's access never has. This function lets service_role revoke
-- a specific user's sessions by ID instead. Deleting auth.sessions cascades to
-- auth.refresh_tokens (session_id FK), preventing that user from minting a new access token.
-- Does NOT invalidate an already-issued, unexpired access token (stateless JWT — see 10-RESEARCH.md
-- "Pitfall 2").
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(target_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
$$;

-- Only service_role should ever call this — never expose to authenticated/anon.
REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(UUID) TO service_role;
```
`[ASSUMED]` — the exact FK/cascade relationship between `auth.sessions` and `auth.refresh_tokens` in the CURRENT version of Supabase's Auth schema was not independently confirmed against this project's live schema in this research session (no direct DB access available to this research agent). Community reports (`[CITED: github.com/orgs/supabase/discussions/13941]`) describe `auth.sessions`/`auth.refresh_tokens` as the relevant tables, and Supabase's own architecture docs describe refresh tokens as FK'd to `session_id`, but the planner/executor should confirm via `supabase db query "\d auth.sessions"` (Supabase CLI — the established precedent from Phase 4 Plan 02 for inspecting anything outside PostgREST's exposed schemas) before relying on cascade delete rather than deleting from both tables explicitly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Admin password update leaves existing session untouched (self-hosted GoTrue ≤ v2.149) | Admin password update kills the session on hosted Supabase | Undated, discovered via user reports, closed "not planned" by Supabase | D-05's premise may not hold on this project's live instance — verify, don't assume |

**Deprecated/outdated:** none specific to this phase's stack — no libraries here are being replaced or sunset.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `admin.updateUserById({password})` does NOT revoke sessions on THIS project's hosted Supabase instance (D-05's premise) | Critical Finding, Pitfall 3 | If wrong, D-05/D-07's UI copy ("continua logado normalmente") is inaccurate; low functional risk (feature still works either way), but a UAT script written assuming D-05 could be misread as a bug |
| A2 | PostgREST cannot join/select from `auth.users` directly, requiring per-row `admin.getUserById()` calls to read email | Architecture Pattern 1 | If wrong (i.e., a `auth_users` view or FDW exists), the recommended N+1 admin-call pattern is unnecessarily slow — though still functionally correct at v1.1's 1-3 tenant scale |
| A3 | `auth.sessions` DELETE cascades to `auth.refresh_tokens` via FK, so a single `DELETE FROM auth.sessions` fully revokes refresh capability | Code Examples | If wrong, refresh tokens could survive session deletion, meaning the "remover acesso" flow does not actually revoke re-authentication ability as intended — this would be a real security gap, not just a UX inaccuracy, and should be verified with a live integration test (see Validation Architecture) before treating USER-05 as satisfied |
| A4 | Default Supabase access token (JWT) expiry is ~3600s (1 hour) for this project | Pitfall 2 | If the project's actual configured expiry is much longer, the "residual exposure window" after revocation is larger than expected — worth an explicit human-verify checkpoint, not a blocking assumption |

## Open Questions

1. **Does this project's live Supabase Auth server actually revoke sessions on `admin.updateUserById({password})`?**
   - What we know: hosted Supabase (post some undated GoTrue update) does this on other people's reported projects; self-hosted/older CLI builds don't.
   - What's unclear: whether THIS project's specific hosted instance (which Auth server build it runs) exhibits the behavior.
   - Recommendation: add as an explicit manual verification step in the phase's validation, not an assumption baked into the plan's acceptance criteria.

2. **Exact schema of `auth.sessions`/`auth.refresh_tokens` and whether cascade delete is sufficient.**
   - What we know: community-documented as the two relevant tables, FK'd via `session_id`.
   - What's unclear: exact column names/constraints on THIS project's Supabase version (Auth schema is described by Supabase as subject to change without notice).
   - Recommendation: run `supabase db query "\d auth.sessions" "\d auth.refresh_tokens"` (CLI, per the established Phase 4 precedent for inspecting non-PostgREST-exposed schema) as a Wave 0 step before writing the migration, and adjust the `DELETE` statement to also explicitly target `auth.refresh_tokens` if no cascade FK is found.

3. **What is this project's configured JWT (access token) expiry?**
   - What we know: Supabase Dashboard default is commonly 3600s; not confirmed for this project.
   - What's unclear: whether it was changed during Phase 0/1 setup.
   - Recommendation: check Supabase Dashboard → Authentication → Sessions/JWT settings as part of execution; this bounds how "immediate" USER-05's revocation actually is in practice and should be reflected in any user-facing copy about the removal action.

## Environment Availability

No new external dependencies for this phase — it uses only the already-provisioned Supabase project (service-role key, Admin API) and already-installed npm packages.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (service_role key) | All 5 requirements | ✓ (already used by `lib/actions/tenants.ts`) | — | — |
| Supabase CLI (`supabase`) | New migration `0023` (Open Question 2) | ✓ (`^2.98.2` in devDependencies) | — | — |
| `@base-ui/react` Menu primitive | USER-03/04/05 UI (D-01) | ✓ installed, never yet rendered (Pitfall 5) | 1.4.1 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 |
| Config file | `vitest.config.ts` (environment: node, setupFiles: `tests/setup.ts`) |
| Quick run command | `npx vitest run tests/unit/tenant-user-management-actions.test.ts tests/unit/agency-user-management-actions.test.ts` (files to be created, see Wave 0 Gaps) |
| Full suite command | `npm test` |

This project has **no component-rendering test tooling** (`@testing-library/react` is not a dependency) — all existing coverage is mock-based unit tests against Server Actions/Route Handlers (`tests/tenants.test.ts`, `tests/agencies.test.ts` pattern) plus skip-if-no-env live integration tests (`tests/agency-rls.test.ts`, `tests/integration/*`). This phase should follow the SAME split, not introduce a new UI-testing framework:
- **Automated:** Server Action logic (auth gate, Zod validation, `admin.updateUserById`/RPC calls, rollback/error paths) via mocked `@/lib/supabase/server` + `@/lib/supabase/service`.
- **Manual-only (Playwright MCP against Vercel prod, per this project's established preference — Phase 6 Plan 04 precedent):** dropdown opens the correct Dialog for the correct row; the table refreshes and the toast appears after removal; the reset/edit Dialogs are unreachable/blocked for a non-super_admin session.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| USER-01 | Tenant users list renders (email + actions column, no extra fields per D-03) | manual-only | Playwright MCP: navigate `/tenants/[slug]`, assert table rows | ❌ no automated equivalent (Server Component read path, no RTL) |
| USER-02 | Agency users list renders | manual-only | Playwright MCP: navigate `/agencies/[id]` | ❌ same as USER-01 |
| USER-03 | `editTenantUserEmail`/`editAgencyUserEmail` calls `admin.updateUserById` with `email_confirm:true`; rejects non-super_admin caller | unit | `npx vitest run tests/unit/tenant-user-management-actions.test.ts` | ❌ Wave 0 |
| USER-04 | `resetTenantUserPassword`/`resetAgencyUserPassword` calls `admin.updateUserById` with a ≥16-char generated password; rejects non-super_admin caller | unit | same file as USER-03 | ❌ Wave 0 |
| USER-05 | `removeTenantUserAccess`/`removeAgencyUserAccess` deletes the correct scoped join row (tenant_id+user_id, not just user_id — Anti-Pattern above) AND calls `revoke_user_sessions` RPC; rejects non-super_admin caller | unit | same file | ❌ Wave 0 |
| USER-05 (session revocation actually takes effect) | after revocation, the target user's refresh token can no longer mint a new access token | integration (skip-if-no-env, live Supabase) | `npx vitest run tests/integration/user-session-revocation.test.ts` | ❌ Wave 0 — see below |

### Wave 0 Gaps
- [ ] `tests/unit/tenant-user-management-actions.test.ts` — mock-based, mirrors `tests/agencies.test.ts`'s shape (`vi.mock('@/lib/supabase/service')` + `vi.mock('@/lib/supabase/server')` for the new auth gate); covers USER-03/04/05 for tenants, including the non-super_admin-rejected case and the scoped-delete case.
- [ ] `tests/unit/agency-user-management-actions.test.ts` — same, agency-scoped.
- [ ] `tests/integration/user-session-revocation.test.ts` — skip-if-no-env (mirrors `tests/agency-rls.test.ts`/`tests/rls.test.ts` pattern): create a real test user via `admin.createUser`, `signInWithPassword` to obtain a real refresh token, call the remove-access action (or the `revoke_user_sessions` RPC directly), then attempt `supabase.auth.refreshSession({ refresh_token })` (or `setSession`) with the pre-revocation refresh token and assert it now errors. This is the ONLY way to prove USER-05's revocation actually took effect server-side rather than merely "the API was called without throwing" — a mocked unit test cannot prove this, since the mock would just assert the RPC was invoked, not that it worked.
- [ ] Migration `supabase/migrations/0023_revoke_user_sessions_function.sql` — does not exist yet; required before the integration test above can run against a real project.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `admin.updateUserById` for email/password changes — server-side only, service-role key, never exposed to browser (already the established pattern) |
| V3 Session Management | yes | New `revoke_user_sessions` RPC (session/refresh-token invalidation) — this phase's core new security surface |
| V4 Access Control | yes | `getUser()` + `rpc('get_user_role') === 'super_admin'` gate in every new Server Action (Claude's Discretion, Pattern 2 above) |
| V5 Input Validation | yes | Zod schemas for `userId` (uuid), `email` (Zod `.email()`), `tenantId`/`agencyId` (uuid) — same convention as existing `lib/actions/*.ts` |
| V6 Cryptography | yes | Temp password generation reuses existing `generateTempPassword()` (`randomBytes` from `node:crypto`) — never hand-roll a new RNG |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing server-side role re-check on sensitive Server Actions (pre-existing gap this phase closes) | Elevation of Privilege | `requireSuperAdmin()` gate in every new action (Pattern 2) — this class of bug already caused a real production incident in this codebase (Phase 5 Plan 09, `app_metadata` vs `getClaims()`) |
| Cross-tenant delete via unscoped `WHERE user_id = X` | Tampering | Always scope the remove-access `DELETE` by BOTH `tenant_id`/`agency_id` AND `user_id` (Anti-Pattern above — `tenant_users` allows one user in multiple tenants) |
| Calling a privileged RPC/admin API from the wrong client (service-role vs user-session) | Information Disclosure / auth bypass | `get_user_role()` must be called via `createClient()` (user session), never `createServiceClient()` — silently returns NULL otherwise (Anti-Pattern above) |
| Assuming API call success = security effect achieved (session revocation) | Repudiation / false sense of security | Live integration test (Wave 0 gap above), not just a mocked "RPC was called" assertion |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0002_create_tenants.sql`, `0003_create_helper_functions.sql`, `0005_custom_access_token_hook.sql`, `0017_create_agencies_schema.sql` — schema, RLS, JWT-claims helper functions (this codebase)
- `lib/actions/tenants.ts`, `lib/actions/agencies.ts`, `lib/supabase/service.ts`, `lib/supabase/server.ts` — established Server Action / client patterns (this codebase)
- `app/api/leads/[id]/status/route.ts`, `app/api/google-ads/connect/route.ts` — established `getUser()` + `rpc('get_user_role')` + `getClaims()` authorization pattern (this codebase, post-bug-fix)
- `components/ui/dropdown-menu.tsx`, `components/tenants/add-user-modal.tsx`, `components/tenants/deactivate-tenant-button.tsx`, `components/tenants/tenants-table.tsx` — UI patterns to mirror (this codebase)
- npm registry — `@supabase/supabase-js@2.110.2`, `@base-ui/react@1.6.0`, `zod@4.4.3` current versions `[VERIFIED: npm view]`
- [base-ui.com/react/components/menu](https://base-ui.com/react/components/menu) — official "opening a dialog from a menu item" pattern

### Secondary (MEDIUM confidence)
- [GitHub supabase/auth#1579](https://github.com/supabase/auth/issues/1579) — admin password update killing sessions on hosted platform, closed not-planned
- [GitHub discussion supabase/discussions/13941](https://github.com/orgs/supabase/discussions/13941) — session/refresh-token DB structure, stateless JWT validation confirmation
- [supabase.com/docs/guides/auth/sessions](https://supabase.com/docs/guides/auth/sessions) — session termination triggers, access token validation model
- [supabase.com/docs/guides/auth/signout](https://supabase.com/docs/guides/auth/signout) — `signOut` scope semantics (global/local/others)
- `auth-js` `GoTrueAdminApi.signOut(jwt: string, scope)` signature (via WebFetch of GitHub source) — confirms JWT-not-userId parameter

### Tertiary (LOW confidence)
- Exact `auth.sessions`/`auth.refresh_tokens` cascade FK behavior — inferred from community discussion, not independently confirmed against this project's live schema (Open Question 2)
- This project's specific configured JWT expiry — not verified (Open Question 3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions verified against npm registry
- Architecture (authorization pattern, dialog-from-menu pattern): HIGH — verified against this codebase's own established, post-bug-fix idiom and Base UI's official docs
- Session revocation mechanism (Critical Finding, Pitfall 1/2): MEDIUM — verified via official SDK source + GitHub issues/discussions, but not against this project's live Supabase instance (no DB access in this research session)
- D-05 assumption validity: MEDIUM — contradicting evidence found, not confirmed either way for THIS project

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (30 days — Supabase Auth server behavior changes without version-pinned announcements; re-verify D-05/session-revocation findings if this phase's execution is delayed past that window)
