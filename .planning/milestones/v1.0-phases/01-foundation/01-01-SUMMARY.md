---
phase: 01-foundation
plan: 01
subsystem: test-infrastructure
tags: [vitest, testing, scaffold, wave-0]
dependency_graph:
  requires: []
  provides: [test-runner, test-scaffold-middleware, test-scaffold-rls, test-scaffold-tenants]
  affects: [01-02, 01-03, 01-04]
tech_stack:
  added: [vitest@2.1.9, "@vitest/ui@2.1.9", vite-tsconfig-paths@5.1.4, dotenv@16.6.1]
  patterns: [node-test-environment, dotenv-setup-file, conditional-describe-skip]
key_files:
  created:
    - vitest.config.mts
    - tests/setup.ts
    - tests/middleware.test.ts
    - tests/rls.test.ts
    - tests/tenants.test.ts
    - .env.test.example
  modified:
    - package.json
    - .gitignore
decisions:
  - "vitest.config.mts used instead of .ts because vite-tsconfig-paths v5 is ESM-only and cannot be loaded via require() in a CJS project"
metrics:
  duration: ~8 minutes
  completed: 2026-05-10
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 01 Plan 01: Wave 0 Test Infrastructure Summary

Installed Vitest 2.1.9 and scaffolded three test files (middleware, RLS, tenants) with
it.todo() markers and passing sanity tests — all three files exit code 0 without any env setup.

## What Was Built

- **Vitest runner**: `vitest.config.mts` with `tsconfigPaths()` plugin (replicates `@/*` alias from tsconfig.json), node environment, 10s timeout, `tests/**/*.test.ts` glob
- **Setup file**: `tests/setup.ts` loads `.env.test.local` via dotenv and warns if staging credentials are absent
- **Env template**: `.env.test.example` committed as reference — `.env.test.local` excluded via `.gitignore`
- **package.json scripts**: `test`, `test:watch`, `test:ui` added
- **Three scaffold files** with sanity assertions that run immediately and `it.todo()` markers for downstream plans

## Test File Summary

| File | Sanity Tests | it.todo() Count | Downstream Plan |
|------|-------------|-----------------|-----------------|
| tests/middleware.test.ts | 1 (JWT decode) | 6 | Plan 03 |
| tests/rls.test.ts | 1 (env detection) | 5 (self-skips without env) | Plan 02 |
| tests/tenants.test.ts | 1 (vi.fn mock) | 9 | Plan 04 |

## it.todo() Markers to Replace

**middleware.test.ts (Plan 03 must replace):**
- redirects unauthenticated requests to /login
- redirects super_admin from / to /tenants
- redirects tenant_admin from / to /[tenant_slug]/dashboard
- blocks tenant_admin from /tenants (returns 307 redirect to /)
- blocks viewer from /tenants (returns 307 redirect to /)
- allows super_admin to access /tenants

**rls.test.ts (Plan 02 must replace):**
- tenant A user sees only tenant A rows when SELECTing tenants table
- tenant A user sees 0 rows when SELECTing tenant_users WHERE tenant_id = <tenant B id>
- super_admin sees all tenants and all tenant_users rows
- deactivated tenant (active=false) returns 0 rows even to its own members
- JWT without app_metadata.role returns 0 rows from tenants table (fail-closed)

**tenants.test.ts (Plan 04 must replace):**
- inserts a row into public.tenants with active=true
- rejects duplicate slug with a validation error (UNIQUE constraint)
- rejects slug that fails ^[a-z0-9-]+$ regex
- returns { success: true, tenantId } on success
- sets active=false on the matching tenant (does NOT delete the row)
- returns { error } when caller role is not super_admin
- calls supabase.auth.admin.createUser with email_confirm=true
- inserts the new user into tenant_users with role tenant_admin or viewer
- rejects role super_admin (not allowed in tenant_users per D-09 CHECK constraint)
- generates a 16-char temporary password when none is supplied

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest.config.ts renamed to vitest.config.mts**
- **Found during:** Task 1 verification (npm test)
- **Issue:** `vite-tsconfig-paths` v5 is ESM-only. Loading it via `require()` in a CJS-default project (no `"type":"module"` in package.json) caused a startup error: `ESM file cannot be loaded by require`
- **Fix:** Created `vitest.config.mts` instead of `vitest.config.ts`. The `.mts` extension forces Node to treat the file as ESM, resolving the import correctly. `"type":"module"` was deliberately NOT added to package.json to avoid breaking Next.js build tooling.
- **Files modified:** vitest.config.mts (new), vitest.config.ts (deleted)
- **Commit:** 6cc3baa

## Self-Check: PASSED

- [x] vitest.config.mts exists at project root
- [x] tests/setup.ts exists with dotenv import
- [x] tests/middleware.test.ts exists (6 todos + 1 sanity)
- [x] tests/rls.test.ts exists (5 todos + 1 sanity, skips without env)
- [x] tests/tenants.test.ts exists (9 todos + 1 sanity)
- [x] .env.test.example committed as template
- [x] .env.test.local covered in .gitignore (via .env*.local pattern)
- [x] coverage/ added to .gitignore
- [x] package.json scripts contain "test": "vitest run"
- [x] node_modules/.bin/vitest exists
- [x] npm test exits code 0 (3 passed, 21 todo)
- [x] Commit 6cc3baa confirmed in git log
