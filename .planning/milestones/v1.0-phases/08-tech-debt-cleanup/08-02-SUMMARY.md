---
phase: 08-tech-debt-cleanup
plan: 02
subsystem: infra
tags: [repo-hygiene, migrations, ops-tracking, supabase]

# Dependency graph
requires:
  - phase: 08-tech-debt-cleanup (Plan 01)
    provides: v1.0 re-audit findings (tech_debt items) that scoped this plan's two tasks
provides:
  - Removal of the stray, never-applied migration 0012_add_google_sheets_to_tenants.sql
  - .planning/OPS-FOLLOWUPS.md — durable checklist of manual/ops follow-ups outside code scope
affects: [08-tech-debt-cleanup (Plan 03), v1.0 milestone archival]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: [.planning/OPS-FOLLOWUPS.md]
  modified: []

key-decisions:
  - "Deleted supabase/migrations/0012_add_google_sheets_to_tenants.sql via plain filesystem delete (not git rm) since it was untracked scratch, never applied to any Supabase environment, and superseded by the shipped sheets_service_account JSONB approach from Phase 03.1"
  - "No git commit exists for Task 1 — deleting an untracked file produces zero git diff, so there is nothing to stage or commit for that task; verified via git status before/after"

patterns-established: []

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-07-11
---

# Phase 08 Plan 02: Repo Hygiene — Dead Migration Removal + Ops Follow-ups Doc Summary

**Deleted the untracked, never-applied migration 0012 and created `.planning/OPS-FOLLOWUPS.md` as the durable home for the two remaining manual/ops follow-ups (N8N daily-insights activation, Phase 0 VPS security check) plus other known external blockers.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-07-11T23:04:17Z
- **Completed:** 2026-07-11T23:05:07Z
- **Tasks:** 2 completed
- **Files modified:** 1 created (.planning/OPS-FOLLOWUPS.md), 1 deleted (supabase/migrations/0012_add_google_sheets_to_tenants.sql, untracked)

## Accomplishments
- Removed the dead, superseded migration scratch file from the working tree — confirmed gone from both the filesystem and `git status`
- Created a single durable ops-tracking doc consolidating scattered follow-up prose from STATE.md, so these items survive v1.0 milestone archival

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the dead, never-applied migration file 0012** — no commit (file was untracked; deletion produces zero git diff, nothing to stage). Verified via `git status --short` before (`?? supabase/migrations/0012_add_google_sheets_to_tenants.sql`) and after (entry absent).
2. **Task 2: Record remaining external/ops follow-ups in .planning/OPS-FOLLOWUPS.md** — `77e67d3` (chore)

**Plan metadata:** (final commit, below)

## Files Created/Modified
- `.planning/OPS-FOLLOWUPS.md` - New durable checklist: N8N daily-insights activation, Phase 0 VPS security check, plus other known external blockers (ANTHROPIC_API_KEY, Google Ads Developer Token, Google Cloud OAuth Client, per-tenant Meta System User tokens)
- `supabase/migrations/0012_add_google_sheets_to_tenants.sql` - Deleted (was untracked scratch, never applied, superseded by `sheets_service_account`)

## Decisions Made
- Confirmed via `git ls-files` that migration 0012 was genuinely untracked before deleting — a plain `rm` was correct, `git rm` would not have applied
- No schema-push/migration-apply command was run against any Supabase environment; the file-absence check alone satisfies the acceptance criteria without risking side effects on the live schema

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. One clarifying note: Task 1 has no associated git commit because the file being removed was untracked — this is expected behavior per the plan's own framing ("git rm is not applicable to an untracked file"), not an execution gap. `git show --stat HEAD` on Task 2's commit confirms only `.planning/OPS-FOLLOWUPS.md` changed, verifying no ops action was actually performed against N8N, the VPS, or Vercel.

## User Setup Required

None - no external service configuration required by this plan. (The follow-ups it documents in OPS-FOLLOWUPS.md are pre-existing external blockers, tracked but not actioned here.)

## Next Phase Readiness
- Phase 08 now 2/3 plans complete; Plan 03 (live Supabase test-fixture cleanup) remains
- OPS-FOLLOWUPS.md is now the single source of truth for post-v1.0 manual/ops actions — future milestone archival can reference it directly instead of STATE.md prose

---
*Phase: 08-tech-debt-cleanup*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: .planning/OPS-FOLLOWUPS.md
- FOUND: 0012 file absent (correct — deleted as expected)
- FOUND: 77e67d3 (Task 2 commit)
