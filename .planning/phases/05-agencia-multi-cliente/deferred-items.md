# Deferred Items — Phase 05 (agencia-multi-cliente)

Out-of-scope issues discovered during plan execution but not fixed (per scope boundary rule — only auto-fix issues directly caused by the current task's changes).

## Plan 05-01

- **Pre-existing `tsc --noEmit` errors, unrelated to this plan's files:**
  - `tests/integration/vault-rpc.test.ts:124,135` — `TS2345: Argument of type '{ p_secret_name: string; }' is not assignable to parameter of type 'undefined'` (likely a Supabase generated-types drift for the `read_vault_secret` RPC signature)
  - `tests/tenants.test.ts:119,122` — `TS2578: Unused '@ts-expect-error' directive` + `TS2322: Type '"super_admin"' is not assignable to type '"tenant_admin" | "viewer"'` (role union type probably needs updating, or the `@ts-expect-error` above it is now stale)
  - Confirmed via `npx tsc --noEmit`: these errors exist in files not touched by Plan 05-01's tasks (`tests/agency-rls.test.ts`, `tests/integration/tenant-role-migration.test.ts`, `tests/agencies.test.ts`, `tests/unit/leads-status-route.test.ts` — none appear in the tsc output). Full test suite (`npm test`) still exits 0 since these are type-only errors, not runtime test failures.
  - Recommend a follow-up plan or quick task to fix both before Phase 5's role-collapse migration (Plan 03) lands, since `tests/tenants.test.ts`'s stale `@ts-expect-error` may mask a real type regression once `tenant_users.role` is collapsed to a single value.
