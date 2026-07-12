---
phase: 08-tech-debt-cleanup
audited: 2026-07-11
asvs_level: 1
block_on: high
threats_total: 7
threats_closed: 7
threats_open: 0
status: SECURED
---

# Phase 08: Security Audit — Tech Debt Cleanup

Independent verification of the 7-threat register (T-08-01 through T-08-07) spanning all three
plans (08-01 REQUIREMENTS.md/verification correction, 08-02 dead migration removal + ops
tracking, 08-03 live Supabase test-fixture cleanup). Implementation files were read-only during
this audit — no repo file or live database row was modified. Evidence is cited against the actual
artifacts (REQUIREMENTS.md, 01-VERIFICATION.md, 03-VERIFICATION.md, OPS-FOLLOWUPS.md, the
migrations directory listing, and 08-03-SUMMARY.md's delete transcript), not against plan
narrative claims alone.

## Threat Verification

| Threat ID | Category | Component | Disposition | Verdict | Evidence |
|-----------|----------|-----------|-------------|---------|----------|
| T-08-01 | Tampering (accuracy) | REQUIREMENTS.md checkbox flips | mitigate | CLOSED | `.planning/REQUIREMENTS.md` flips AUTH-01/02/06 to `[x]` and Traceability rows to `Complete`, matching `.planning/phases/01-foundation/01-VERIFICATION.md` which gives an explicit `✓ VERIFIED` verdict (frontmatter `status: passed`, `score: 6/6`) for all 6 AUTH-* rows including AUTH-01 (`lib/actions/auth.ts` signIn + `@supabase/ssr` cookie session), AUTH-02 (`signOut` + layout guard), and AUTH-06 (RLS migration 0004 + JWT hook migration 0005). DASH-01/02/03/04, CAMP-01/02/03/04, and SET-02 flips are independently backed by `.planning/phases/03-dashboard-ui/03-VERIFICATION.md`'s Requirements Coverage table, which marks every one of these IDs `✓ SATISFIED` with file-level evidence. No flipped checkbox in REQUIREMENTS.md lacks a corresponding verified row in one of the two verification artifacts. |
| T-08-02 | Information disclosure | `.planning` docs | accept | CLOSED | Accepted-risk rationale ("Planning docs are internal repo artifacts, no secrets written") is reasonable and confirmed by direct inspection: `REQUIREMENTS.md`, `01-VERIFICATION.md`, and `OPS-FOLLOWUPS.md` contain only requirement IDs, file paths, env-var *names* (`ANTHROPIC_API_KEY`, `N8N_INSIGHTS_SECRET`, `GOOGLE_ADS_CLIENT_ID/SECRET`), and public infra hostnames — no credential values, tokens, or secrets present in any of the three files read. |
| T-08-03 | Tampering (schema drift) | migration 0012 | mitigate | CLOSED | `supabase/migrations/` directory listing confirms the sequence jumps `0011_fix_vault_function_grants.sql` → `0013_create_vault_write_function.sql` — `0012_add_google_sheets_to_tenants.sql` is absent, and no replacement/renumbered migration reintroducing `sheet_id`/`sheets_api_key` columns exists anywhere in the 21 remaining migration files. 08-02-SUMMARY.md confirms the file was untracked (`git ls-files` empty) and removed via plain filesystem delete, not `git rm`, with no `supabase db push`/`apply_migration` command executed — consistent with the plan's explicit prohibition. |
| T-08-04 | Repudiation (lost ops items) | ops follow-ups | mitigate | CLOSED | `.planning/OPS-FOLLOWUPS.md` exists as a committed, durable doc (commit `77e67d3` per 08-02-SUMMARY.md) containing both required unchecked entries: N8N daily-insights workflow activation (with `ANTHROPIC_API_KEY`/`N8N_INSIGHTS_SECRET` env-var references) and the Phase 0 VPS security check (N8N version/CVE, editor auth, `N8N_ENCRYPTION_KEY` persistence) — replacing the scattered STATE.md prose these items previously lived in only. |
| T-08-05 | Tampering / DoS (accidental prod data loss) | live `agencies`/`agency_users`/`agency_tenants`/`auth.users` DELETEs | mitigate | CLOSED | 08-03-SUMMARY.md's transcript matches the plan's 3-step mitigation exactly: (1) Task 1 read-only enumeration produced a frozen id inventory in a prior session; (2) Task 2's blocking human checkpoint was completed in that prior session — corroborated externally by `.planning/STATE.md` line 28/218, which independently records "human-approved delete set" and "Fase 08 ... Plano 03 CONCLUÍDO" outside the SUMMARY's own self-report; (3) Task 3 executed DELETEs in strict children-before-parents order — `tenant_users`(1) → `agency_users`(1) → `agencies`(11) → `auth.users`(2, via `auth.admin.deleteUser`, cascading `identities`) — with every step's affected-row count verified against the frozen Task 1 count before proceeding, and a final re-query confirming the real `LUKSEG` tenant (`9f7e3c67-...`) was untouched. |
| T-08-06 | Tampering (TOCTOU) | broad LIKE/name filter matching a row created between enumerate and delete | mitigate | CLOSED | 08-03-SUMMARY.md's Decisions Made section states explicitly: "the actual DELETE statements ... used exact frozen ids throughout, never the `slug`/`name` filter" — the broad discovery filter (`name = 'Agência Teste' OR ... LIKE 'rls-test-%'`) was used only in Task 1's read-only SELECT and in post-delete re-verification, never re-run as a live DELETE predicate. Deletion scoping was by explicit primary-key/id list per the plan's Task 3 instruction, closing the TOCTOU window between enumeration and deletion. |
| T-08-07 | Repudiation | which rows were removed | accept | CLOSED | Accepted-risk rationale ("acceptable for internal fixture cleanup") is reasonable and satisfied: 08-03-SUMMARY.md records exact per-table row counts (1, 1, 11, 2) and the specific `auth.users` emails/ids deleted, plus which real tenant was confirmed untouched — sufficient audit trail for an internal, non-customer-facing fixture cleanup with no compliance retention requirement in play. |

## Cross-Check Note (T-08-05 / T-08-06 methodology)

The plan's stated mitigation for T-08-05 is a strict 3-task sequence (read-only enumerate →
blocking human gate → id-scoped delete). 08-03-SUMMARY.md documents a tooling deviation (no
Supabase MCP tool / CLI available in the executor's environment; substituted a temporary
`@supabase/supabase-js` Node script using the service-role key, deleted immediately after use with
`git status --short` confirming zero repo trace) and a verification-query bug (queried a
non-existent `agencies.slug` column, corrected to `name`). Neither deviation altered the approved
delete set, the FK-safe ordering, or the id-based (never broad-filter) delete scoping the threat
model requires — both are tooling/cosmetic fixes documented transparently in the SUMMARY's
Deviations section, not weakenings of the mitigation.

## Unregistered Flags

None. None of 08-01-SUMMARY.md, 08-02-SUMMARY.md, or 08-03-SUMMARY.md contain a `## Threat Flags`
section, so there is no executor-flagged attack surface outside the 7 registered threats to
reconcile.

## Notes / Observations (non-blocking, informational only — not new threats, not scored)

- 08-03-SUMMARY.md's tooling substitution (direct `@supabase/supabase-js` + service-role key
  instead of the plan-referenced Supabase MCP tool) is a reasonable, transparently-documented
  environment-driven deviation; it does not weaken any of the T-08-05/T-08-06 mitigations since
  the same id-scoped, FK-ordered, human-approved delete discipline was preserved.
- Per this audit's constraint (verify only the 7 registered threats; do not scan for new ones),
  no additional threats were surfaced during this review.
