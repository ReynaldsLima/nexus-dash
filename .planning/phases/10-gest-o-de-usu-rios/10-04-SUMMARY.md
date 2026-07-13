---
phase: 10-gest-o-de-usu-rios
plan: 04
subsystem: verification
tags: [human-verify, playwright-mcp, production, dialog-state-bug]

# Dependency graph
requires:
  - phase: 10-gest-o-de-usu-rios
    plan: 03
    provides: "users table + row-actions dropdown + three dialogs on /tenants/[slug] and /agencies/[id]"
provides:
  - "Live confirmation of USER-01..05 against production"
  - "D-05 empirical answer: password reset invalidates the existing session immediately (not just new-token blocking)"
  - "Bug fix: dialog state not reset on close (components/users/*-dialog.tsx)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dialog close handlers must route through a single handleOpenChange wrapper that clears local state — a raw onOpenChange(false) call from a footer button bypasses the Dialog's own onOpenChange wrapper and leaves stale state (tempPassword, error, unsaved input) for the next open"

key-files:
  created:
    - .planning/phases/10-gest-o-de-usu-rios/10-04-SUMMARY.md
  modified:
    - components/users/reset-user-password-dialog.tsx
    - components/users/edit-user-email-dialog.tsx
    - components/users/remove-user-access-dialog.tsx

key-decisions:
  - "Production was found 29 commits behind origin/main (all of Phase 9 + Phase 10 never deployed) — pushed master to main (clean fast-forward) before verification could proceed at all"
  - "D-05 tested via direct Supabase Auth REST API calls (password grant to get access+refresh tokens, then re-check after reset) instead of two browser tabs, since Playwright tabs share the same origin storage and would have clobbered the super_admin session"
  - "Bug found live (stale dialog state) was fixed inline during the checkpoint rather than deferred to a gap-closure cycle, given the small, well-understood scope and that it directly blocked D-05 verification"

patterns-established:
  - "Any controlled Dialog/AlertDialog with local reveal-once or error state must reset that state through the same onOpenChange path used for Escape/overlay-click closes — footer buttons should never call the raw prop directly"

requirements-completed: [USER-01, USER-02, USER-03, USER-04, USER-05]

duration: ~2h (including production deploy gap investigation and bug fix cycle)
completed: 2026-07-13
---

# Phase 10 Plan 04: Human Verification Checkpoint Summary

**Live-verified all of USER-01..05 against production, found and fixed a real dialog-state bug along the way, and empirically resolved D-05: Supabase invalidates a user's existing session immediately on password reset (not just future tokens).**

## Performance

- **Duration:** ~2h (mostly waiting on Vercel builds and diagnosing why production showed stale UI)
- **Task 1 (automated):** `npm test` — 32 files, 249 passed / 1 skipped / 5 todo, zero failures
- **Task 2 (human-verify checkpoint):** all 8 steps executed via Playwright MCP against `https://nexusdash-chi.vercel.app`

## Pre-verification blocker: production was undeployed

Before any verification could run, `/tenants/beta-test` on production still showed the Phase-9-era "gerenciado via Supabase Dashboard" placeholder. Root cause: local `master` was 29 commits ahead of `origin/main` (the branch Vercel auto-deploys from) — all of Phase 9 and Phase 10 had never been pushed. Confirmed a clean fast-forward (`git merge-base --is-ancestor origin/main HEAD`) and pushed `master:main` with user approval. Redeployed successfully; the new users table appeared.

## Bug found and fixed: stale dialog state on close

Live testing surfaced a real defect, not anticipated by the plan's "dropdown/portal glitch" framing (Pitfall 5): closing "Resetar senha" via **Fechar** and reopening it on the same row **redisplayed the previous temp password** instead of showing the confirmation step — and confirmed via network log that no second Server Action POST fired. Root cause: the Fechar button called the raw `onOpenChange(false)` prop directly, bypassing the `<Dialog onOpenChange={...}>` wrapper that cleared `tempPassword`/`error`/`copied` state. The same bypass pattern existed in `edit-user-email-dialog.tsx` (stale `error` + stale unsaved email input) and `remove-user-access-dialog.tsx` (stale `error`).

**Fix (commit `dd9b75d`):** introduced a `handleOpenChange` wrapper in each of the three dialogs and routed every close path (Fechar/Cancelar buttons, and the AlertDialog's own `onOpenChange`) through it. Also keyed the edit-email `Input` on `open`/`user.id` so a stale unsaved value can't survive a reopen. Verified live post-redeploy: reset → close → reopen now correctly shows the confirmation step and generates a genuinely new password each time (confirmed three distinct passwords across three resets in this session).

## Verification Results (8 steps, all passed)

1. **USER-01** — `/tenants/beta-test` renders the users table with exactly E-mail + Ações columns. Confirmed.
2. **USER-02** — `/agencies/[id]` (VIROMIDIA) renders the same table structure in place of the old placeholder. Confirmed (did not run destructive actions on this agency's real user, `viromidia@viromidia.com.br` — used the Beta Test tenant's throwaway users for steps 3-8 instead).
3. **Dropdown (Pitfall 5)** — ⋮ menu opens, shows all three items, `ArrowDown` moves focus to "Editar e-mail", `Escape` closes and returns focus to the trigger button. No portal/focus-trap issue. Confirmed.
4. **USER-03** — Edited `test-betaadmin@wrdigitalgroup.com.br` → `test-betaadmin2@wrdigitalgroup.com.br`; dialog closed, "E-mail atualizado" toast shown, listing reflected the new email immediately. Confirmed.
5. **USER-04** — Reset password produced a 20-character temp password (`Aa1!` suffix pattern, ≥16 chars required) shown once with a working "Copiar senha" button. Confirmed (and re-confirmed post-fix with two more distinct passwords).
6. **D-05 LIVE CHECK** — Captured the test user's access+refresh tokens via the Supabase Auth REST API (password grant) before a reset, then re-checked both immediately after: access token → `403 session_not_found`; refresh token → `400 refresh_token_not_found`. **Empirical answer: password reset terminates the existing session immediately** — stronger than 10-RESEARCH.md's assumption that an already-issued access token would remain valid until natural JWT expiry (3600s, captured in Task 1). This is Supabase's own `admin.updateUserById` behavior, independent of the project's `revoke_user_sessions` RPC (which is only invoked by "Remover acesso").
7. **USER-05** — "Remover acesso" on `test-betaadmin2`: row disappeared, "Acesso removido e sessão encerrada" toast shown, re-navigation confirmed the table now shows "Nenhum usuário com acesso ainda." A session captured immediately before removal failed the same way as step 6 (403/400) right after. Confirmed.
8. **Access gate (V4)** — Created a throwaway `tenant_admin` (`test-nonadmin@wrdigitalgroup.com.br`, via the existing "+ Adicionar usuário" flow). As that user: navigating to `/tenants` and `/tenants/beta-test` both redirected to `/beta-test/dashboard` (route guard in `app/tenants/layout.tsx`). Independently confirmed the Server Action-level guard: calling `get_user_role()` with this user's own access token returned `"tenant_admin"` (not `super_admin`), which is exactly what `requireSuperAdmin()` checks — defense in depth confirmed at both layers.

## Cleanup

Removed the `test-nonadmin` throwaway user's tenant access after verification (account preserved per the soft-delete design, consistent with USER-05's behavior). `test-betaadmin2` was already removed from Beta Test during step 7's live test of the remove-access flow — no further cleanup needed; both accounts remain in `auth.users` with no tenant/agency links, harmless leftover fixtures.

## Files Modified

- `components/users/reset-user-password-dialog.tsx` — added `handleOpenChange`, routed Fechar/Cancelar through it
- `components/users/edit-user-email-dialog.tsx` — Cancelar now clears `error` before closing; email `Input` keyed on `open`/`user.id` to prevent stale unsaved value
- `components/users/remove-user-access-dialog.tsx` — `AlertDialog` now uses a `handleOpenChange` wrapper that clears `error` on close

## Decisions Made

- **Pushed `master` → `main` before verification, with explicit user approval** — required because Vercel deploys from `main` and production was a full day/29 commits stale; confirmed fast-forward-only (no divergence) before pushing.
- **Used direct Supabase Auth REST API calls for D-05 instead of a second browser context** — Playwright's `browser_tabs` shares localStorage/cookies within one browser context, so logging into a second session as the test user would have clobbered the super_admin session used for the admin actions. Fetching tokens via `grant_type=password` against `/auth/v1/token` sidesteps this entirely and is arguably a cleaner test of the actual question (does the issued token survive, not does the browser tab survive).
- **Fixed the dialog-state bug inline rather than deferring to gap-closure** — small, well-understood, three-file change; deferring it would have left D-05 unverifiable in this same session (the second reset needed to actually hit the server to produce a fresh, comparable token pair).

## Deviations from Plan

- Task 2's `<how-to-verify>` assumed the app was already live on production; in practice a production deployment gap had to be discovered and resolved first (see "Pre-verification blocker" above) — not anticipated by the plan, but squarely within the checkpoint's purpose of catching what automated tests can't.
- A real bug (stale dialog state) was found and fixed mid-checkpoint, which was not anticipated by the plan's specific pitfall list (Pitfall 5 named portal/focus-trap issues, not stale React state) — see "Bug found and fixed" above. This required a second production push and redeploy cycle before D-05 could be verified.
- Step 2 (USER-02) intentionally avoided running destructive edit/reset/remove actions against the agency's only real user; the structural check (table renders, correct columns) was confirmed there, while the destructive-action steps (3-8) all ran against the Beta Test tenant's throwaway users instead.

## Issues Encountered

None outstanding — the one issue found (stale dialog state) was fixed and re-verified within this same session.

## User Setup Required

None — no external service configuration required. (Super-admin credentials for live testing were provided directly by the user in-session.)

## Next Phase Readiness

- All five requirements (USER-01..05) are now both automated-tested (Plans 01-03) and live-verified against production (this plan).
- No blockers carried forward. Phase 10 is ready for code review, regression/schema-drift gates, and final phase-goal verification.

---
*Phase: 10-gest-o-de-usu-rios*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 3 modified dialog files verified present on disk with the `handleOpenChange` pattern; fix commit `dd9b75d` verified present in git history via `git log --oneline`; live re-verification post-redeploy confirmed three distinct temp passwords across three resets in this session (bug fix validated, not just code-reviewed).
