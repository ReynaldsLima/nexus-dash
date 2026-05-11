---
phase: "01"
plan: "03"
subsystem: foundation/plumbing
tags: [supabase, shadcn, middleware, auth, zustand, zod]
dependency_graph:
  requires: [01-02]
  provides: [supabase-clients, middleware, auth-actions, shadcn-ui, tenant-store]
  affects: [01-04, 01-05]
tech_stack:
  added:
    - "@supabase/ssr@0.10.3"
    - "@supabase/supabase-js@2.105.4"
    - "zustand@5.0.13"
    - "react-hook-form@7.75.0"
    - "zod@4.4.3"
    - "@hookform/resolvers@5.2.2"
    - "lucide-react@1.14.0"
    - "server-only@0.0.1"
    - "shadcn@4.7.0 (CLI, base-nova style, @base-ui/react)"
    - "supabase@2.98.2 (CLI, devDep)"
  patterns:
    - "createServerClient with await cookies() for RSC/Server Actions"
    - "singleton createBrowserClient for client components"
    - "service role client guarded by server-only import"
    - "Zustand store with Context provider (React 19 pattern)"
    - "JWT app_metadata decode in middleware for role-based routing"
    - "Zod v4 z.email() top-level validator"
key_files:
  created:
    - lib/supabase/server.ts
    - lib/supabase/client.ts
    - lib/supabase/service.ts
    - lib/stores/tenant-store.tsx
    - lib/actions/auth.ts
    - middleware.ts
    - types/database.types.ts
    - components/ui/form.tsx
    - components/ui/ (12 shadcn components via CLI)
    - lib/utils.ts
    - components.json
  modified:
    - app/globals.css (shadcn CSS variables added)
    - package.json (production deps added)
    - tests/middleware.test.ts (it.todo stubs replaced with real assertions)
decisions:
  - "Used React 19 context syntax <TenantStoreContext value={...}> instead of deprecated <Context.Provider> — required by @types/react@19"
  - "Renamed tenant-store.ts to tenant-store.tsx — file uses JSX and must have .tsx extension"
  - "Created form.tsx manually — shadcn CLI 4.7.0 base-nova style does not include form component in registry"
  - "Stripped <claude-code-hint> tag injected by supabase CLI into database.types.ts — caused TypeScript parse error"
  - "request.cookies.set() in middleware accepts only (name, value) — options not supported on RequestCookies, only ResponseCookies"
metrics:
  duration_minutes: 30
  completed_date: "2026-05-11"
  tasks_completed: 3
  files_created: 26
  files_modified: 4
---

# Phase 01 Plan 03: Next.js Plumbing — Supabase Clients, Middleware, Auth Actions, shadcn Summary

**One-liner:** Supabase SSR clients (server/client/service), Zustand tenant store, JWT-based route guards in middleware, signIn/signOut Server Actions with Zod v4, and shadcn/ui base-nova component library installed.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install deps + init shadcn + generate types | c1887c1 | package.json, components.json, types/database.types.ts, components/ui/ |
| 2 | Supabase clients + tenant store | c1887c1 | lib/supabase/{server,client,service}.ts, lib/stores/tenant-store.tsx |
| 3 | Middleware + auth Server Actions | c1887c1 | middleware.ts, lib/actions/auth.ts, tests/middleware.test.ts |

## Dependency Versions

```
@hookform/resolvers@5.2.2
@supabase/ssr@0.10.3
@supabase/supabase-js@2.105.4
react-hook-form@7.75.0
supabase@2.98.2 (devDep)
zod@4.4.3
zustand@5.0.13
```

## shadcn Components Installed

```
alert-dialog.tsx  badge.tsx   button.tsx   card.tsx
dialog.tsx        dropdown-menu.tsx  form.tsx  input.tsx
label.tsx         select.tsx  separator.tsx  skeleton.tsx
table.tsx
```

13 components total. `form.tsx` was created manually (not available in CLI base-nova registry).

## Key Verification

- `import 'server-only'` is first import in `lib/supabase/service.ts` ✓
- `types/database.types.ts` contains `tenants:` and `tenant_users:` ✓
- No `@supabase/auth-helpers-nextjs` in codebase ✓
- All middleware tests pass (7/7) ✓
- `npm run build` exits 0 ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripped `<claude-code-hint>` tag from generated types file**
- **Found during:** Task 1 — npm run build TypeScript check
- **Issue:** `supabase gen types` CLI injected a `<claude-code-hint>` XML tag at EOF, causing TS parse error: `Operator '<' cannot be applied to types`
- **Fix:** Removed the tag from `types/database.types.ts`
- **Files modified:** types/database.types.ts
- **Commit:** c1887c1

**2. [Rule 1 - Bug] Renamed tenant-store.ts to tenant-store.tsx**
- **Found during:** Task 2 — npm run build TypeScript check
- **Issue:** File uses JSX syntax (`<TenantStoreContext>`) but had `.ts` extension — TypeScript rejects JSX in `.ts` files
- **Fix:** Renamed to `tenant-store.tsx`
- **Files modified:** lib/stores/tenant-store.tsx
- **Commit:** c1887c1

**3. [Rule 1 - Bug] React 19 Context JSX syntax update in tenant-store.tsx**
- **Found during:** Task 2 — npm run build after .tsx rename
- **Issue:** `<TenantStoreContext.Provider>` not recognised as valid JSX by @types/react@19 — React 19 uses `<Context value={...}>` directly
- **Fix:** Changed to `<TenantStoreContext value={ref.current}>` (React 19 pattern)
- **Files modified:** lib/stores/tenant-store.tsx
- **Commit:** c1887c1

**4. [Rule 1 - Bug] middleware.ts RequestCookies.set() signature**
- **Found during:** Task 3 — npm run build TypeScript check
- **Issue:** `request.cookies.set(name, value, options)` — `RequestCookies` only supports `(name, value)`, options are `ResponseCookies`-only
- **Fix:** Changed to `request.cookies.set(name, value)` (no options) for the request mutation; `supabaseResponse.cookies.set(name, value, options)` unchanged
- **Files modified:** middleware.ts
- **Commit:** c1887c1

**5. [Rule 3 - Blocking] form.tsx created manually**
- **Found during:** Task 1 — shadcn CLI add form returned no output
- **Issue:** shadcn CLI 4.7.0 with base-nova style does not include `form` in its registry; the component was silently skipped
- **Fix:** Created `components/ui/form.tsx` manually using react-hook-form FormProvider pattern, without @radix-ui/react-slot (not installed — new shadcn uses @base-ui/react)
- **Files modified:** components/ui/form.tsx
- **Commit:** c1887c1

## Known Stubs

None — all files are wired to real implementations.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan specified.

## Self-Check

All created files verified present on disk. Commit c1887c1 confirmed in git log.
