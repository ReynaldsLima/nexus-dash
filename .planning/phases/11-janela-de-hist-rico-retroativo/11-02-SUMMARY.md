---
phase: 11-janela-de-hist-rico-retroativo
plan: 02
subsystem: api
tags: [oauth, google-ads, react-hook-form, zod, hmac]

# Dependency graph
requires:
  - phase: 11-janela-de-hist-rico-retroativo
    provides: "signState/StatePayload extended with backfillDays (4-arg signature), ad_accounts.backfill_days column (Plan 01)"
provides:
  - "GoogleAdsForm number input (7-365, default 90) feeding the connect route's query string"
  - "GET /api/google-ads/connect validates+signs backfillDays into the OAuth state (T-11-03 mitigated)"
  - "GET /api/google-ads/callback destructures backfillDays from verified state and upserts it into ad_accounts.backfill_days"
affects: [11-03-meta-ads-route, 11-04-post-connect-edit, 11-05-n8n-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "z.coerce.number()...catch(default) for resilient query-param validation on OAuth connect routes — malformed/out-of-range input silently falls back to a safe default rather than blocking the redirect flow, with the DB CHECK constraint as the hard gate"
    - "Split RHF generics (useForm<TInput, TContext, TOutput>) required whenever a Zod schema field uses z.coerce — the schema's input type (pre-coercion, e.g. unknown for coerce.number()) differs from its output type (post-coercion, e.g. number), and zodResolver's typing needs both"

key-files:
  created: []
  modified:
    - app/api/google-ads/connect/route.ts
    - app/api/google-ads/callback/route.ts
    - components/settings/google-ads-form.tsx
    - tests/unit/google-ads-connect-route.test.ts
    - tests/unit/google-ads-callback-route.test.ts

key-decisions:
  - "Split GoogleAdsForm's useForm generics into GoogleAdsFormInput (z.input) and GoogleAdsFormValues (z.output) to resolve a zodResolver/RHF type mismatch caused by z.coerce.number() on backfillDays — a blocking type error (Rule 3 auto-fix), not called out explicitly in the plan's literal code sketch"

patterns-established:
  - "Backfill window (7-365, default 90) now flows form -> connect route -> HMAC-signed state -> callback route -> ad_accounts.backfill_days upsert for the Google Ads channel"

requirements-completed: [SET-03, SET-04]

# Metrics
duration: 18min
completed: 2026-07-17
---

# Phase 11 Plan 02: Google Ads Connect/Callback Backfill Window Summary

**Google Ads OAuth2 connect/callback round-trip now carries and persists the Tenant Admin's chosen backfill window (7-365 days, default 90) end-to-end: form input -> validated+signed state -> `ad_accounts.backfill_days` upsert.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-17T22:43:00Z (approx)
- **Completed:** 2026-07-17T23:01:00Z (approx)
- **Tasks:** 3 completed (Tasks 1-2 as TDD RED→GREEN-equivalent, existing specs extended and verified green in one pass)
- **Files modified:** 5

## Accomplishments
- `app/api/google-ads/connect/route.ts` validates `backfillDays` via `BackfillDaysSchema` (`z.coerce.number().int().min(7).max(365).catch(90)`) and signs it into the OAuth state via the 4-arg `signState` (Plan 01's contract)
- `app/api/google-ads/callback/route.ts` destructures `backfillDays` from the HMAC-verified state payload and includes `backfill_days` in the `ad_accounts` upsert
- `components/settings/google-ads-form.tsx` gained a "Janela de histórico (dias)" number input (7-365, default 90) wired into the connect route's query string, with D-05 help text clarifying the window only applies to the next first sync
- All 20 unit tests across the two route spec files pass (12 connect + 8 callback), including 3 new connect-route tests proving the explicit/default/out-of-range round-trip through the real `verifyState`

## Task Commits

Each task was committed atomically:

1. **Task 1: Google connect route parses + signs backfillDays** - `beab5c0` (feat)
2. **Task 2: Google callback route persists backfill_days** - `c751e8e` (feat)
3. **Task 3: Add backfill window input to GoogleAdsForm** - `19add9e` (feat)

**Plan metadata:** (pending — final commit below)

_Note: Tasks 1-2 were marked `tdd="true"` in the plan; since both target files already had complete Wave-0 test scaffolds from Phase 7/11-01, the RED step was implicit (the new assertions failed against the unmodified route before the code change) rather than a separate committed RED phase — same single-commit-per-task pattern used when extending an existing spec file rather than creating a new one._

## Files Created/Modified
- `app/api/google-ads/connect/route.ts` - Added `BackfillDaysSchema`, parses `backfillDays` from the query string after `customerId`, passes it as the 4th arg to `signState`
- `app/api/google-ads/callback/route.ts` - Destructures `backfillDays` from `payload`, adds `backfill_days: backfillDays` to the `ad_accounts` upsert
- `components/settings/google-ads-form.tsx` - Added `backfillDays` to `GoogleAdsSchema` (`z.coerce.number().int().min(7).max(365)`), a new number input field, default value 90, and wired it into `onSubmit`'s `URLSearchParams`; split `useForm` generics into input/output types to satisfy `zodResolver` typing with a `z.coerce` field
- `tests/unit/google-ads-connect-route.test.ts` - Added 3 tests asserting `payload.backfillDays` is 30 (explicit), 90 (default), 90 (out-of-range 400), each via the real `verifyState` on the redirect's `state` param
- `tests/unit/google-ads-callback-route.test.ts` - All 7 `signState(...)` fixture calls updated to the 4-arg form; happy-path test now signs with `backfillDays=45` and asserts `backfill_days: 45` in the upsert payload assertion

## Decisions Made
- **Split RHF generics for the coerced field:** `z.coerce.number()` gives the schema an `unknown` input type and `number` output type. `GoogleAdsFormValues = z.infer<...>` (the output type) used directly as `useForm`'s sole generic produced a `Resolver<...>` type mismatch (`Type '{backfillDays: unknown}' is not assignable to type '{backfillDays: number}'`). Fixed by introducing `GoogleAdsFormInput = z.input<typeof GoogleAdsSchema>` and calling `useForm<GoogleAdsFormInput, unknown, GoogleAdsFormValues>(...)` — RHF 7.75's three-generic form (input/context/transformed-output) is designed exactly for this resolver-transform case. No behavior change; `handleSubmit`'s callback still receives the coerced `number`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useForm` generic mismatch from `z.coerce.number()` on `backfillDays`**
- **Found during:** Task 3 (Add backfill window input to GoogleAdsForm) — verification step (`npx tsc --noEmit`)
- **Issue:** The plan's literal action list didn't call out that adding a `z.coerce` field changes the schema's input/output type split; using the existing single-generic `useForm<GoogleAdsFormValues>(...)` pattern produced 2 new `tsc` errors (`TS2322`, `TS2345`) beyond the 2 pre-existing unrelated `vault-rpc.test.ts` errors, which the plan's own acceptance criteria explicitly says must not appear
- **Fix:** Introduced `GoogleAdsFormInput = z.input<typeof GoogleAdsSchema>` alongside the existing `GoogleAdsFormValues = z.output<typeof GoogleAdsSchema>`, and changed `useForm<GoogleAdsFormValues>` to `useForm<GoogleAdsFormInput, unknown, GoogleAdsFormValues>`
- **Files modified:** components/settings/google-ads-form.tsx
- **Verification:** `npx tsc --noEmit` back to exactly the 2 pre-existing `vault-rpc.test.ts` errors, zero new errors
- **Committed in:** `19add9e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking type error)
**Impact on plan:** No scope creep — purely a TypeScript typing fix required to satisfy the plan's own literal acceptance criterion ("no new errors beyond the 2 pre-existing vault-rpc.test.ts errors"). No behavior change to the form's runtime validation or submission.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Google Ads channel's backfill window flow (form -> connect -> state -> callback -> `ad_accounts.backfill_days`) is fully code-complete and unit-verified (20/20 tests green across both route specs)
- Plan 11-03 (Meta Ads route) can follow the same pattern: add a `BackfillDaysSchema`-style validated query param and persist to the same `backfill_days` column, without touching the Google-specific `signState`/`verifyState` HMAC helper (Meta's connect flow doesn't use signed OAuth state)
- Live end-to-end verification (real Google OAuth consent screen) remains blocked on the same external dependency documented since Phase 7 (D-03, user's Google Cloud OAuth Client) — not a gap introduced by this plan
- No blockers for 11-03/11-04/11-05

---
*Phase: 11-janela-de-hist-rico-retroativo*
*Completed: 2026-07-17*

## Self-Check: PASSED

All modified files confirmed present on disk. All 3 task commit hashes (`beab5c0`, `c751e8e`, `19add9e`) confirmed present in `git log --oneline`.
