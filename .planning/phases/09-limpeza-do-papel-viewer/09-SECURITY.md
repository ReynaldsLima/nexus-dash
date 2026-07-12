---
phase: 09
slug: limpeza-do-papel-viewer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client JWT → middleware (`proxy.ts`) | Client presents an access token whose `app_metadata.role` is decoded and used for role-based routing. The only trust boundary touched by this phase. | Role claim (`super_admin` \| `tenant_admin` \| `agency` \| `none` \| `null`) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-09-01 | Elevation of Privilege | `proxy.ts` role-redirect branch (removal of `\|\| role === 'viewer'`) | accept | Change is strictly more restrictive: a JWT with `role: 'viewer'` — unissuable since migration `0020` and the current Custom Access Token Hook — no longer matches the `tenant_admin` branch and falls through to `else`, redirecting to `/login?error=no_membership` (fail-closed) instead of a tenant dashboard. Confirmed in code: `proxy.ts:64-77` — unmatched roles hit the `else` branch, no new access path created. | closed |
| T-09-02 | Tampering | Removal of `'viewer'` from TypeScript union types (`Role`, `AppMetadata.role`, `TenantSwitcherProps.role`) | accept | TypeScript types are erased at build time and are not a runtime security control. Real authorization is enforced by Supabase RLS and the `get_user_role()` RPC, neither of which this phase touches. | closed |
| T-09-03 | Spoofing / auth bypass | Test sentinel `'invalid_role'` replacing `'viewer'` in 6 test files | accept | The sentinel only renames the example value for "unrecognized role"; the assertion remains "unknown role → 403/redirect". Coverage for rejecting invalid roles is preserved, not reduced. Confirmed: 60/60 tests pass across the 6 affected files (`09-VERIFICATION.md`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-01, T-09-02, T-09-03 | This is a dead-code removal phase — no new route, table, RLS policy, RPC, or auth flow is introduced. The single behavioral change (T-09-01) is an additional restriction (fail-closed) on a role the database can no longer issue. No new attack surface; risk accepted as documented in `09-01-PLAN.md`'s `<threat_model>` block and reconfirmed against live code during this audit. | Claude (gsd-secure-phase, orchestrator-classified — all evidence code-verifiable, no auditor escalation needed) | 2026-07-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-12 | 3 | 3 | 0 | /gsd-secure-phase orchestrator (State B — derived from `09-01-PLAN.md` threat model + `09-VERIFICATION.md` evidence; no new threats found during audit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-12
