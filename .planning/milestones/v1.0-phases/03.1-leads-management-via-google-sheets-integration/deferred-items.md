# Deferred Items — Phase 03.1

Items discovered during plan execution that are out of scope for the current task/plan (SCOPE BOUNDARY rule — not caused by this plan's changes, not fixed automatically).

## From 03.1-01 execution

**1. LEADS-01 through LEADS-05 not present in `.planning/REQUIREMENTS.md`**
- **Found during:** Task "state updates" step, running `requirements mark-complete LEADS-02`
- **Issue:** `.planning/ROADMAP.md` (Phase 03.1 section) and all three 03.1 PLAN.md files reference requirement IDs `LEADS-01`..`LEADS-05`, but `.planning/REQUIREMENTS.md` was never updated to add these IDs (neither in the v1 Requirements sections nor in the Traceability table at the bottom). `03.1-RESEARCH.md` explicitly flagged this as a planner decision that was not resolved: "Nota para o planner: se for necessário rastrear esta fase em REQUIREMENTS.md/Traceability, sugere-se criar IDs novos (ex. LEADS-01..LEADS-0N)... decisão do planner, não desta pesquisa."
- **Why deferred, not fixed:** Defining LEADS-01, LEADS-03, LEADS-04, LEADS-05 accurately requires authoring requirement text that spans Plans 02 and 03 (not yet executed) — doing this now from Plan 01 would mean guessing at scope/wording for work not yet done, which is out of this plan's scope boundary.
- **Effect on this plan:** `node gsd-tools.cjs requirements mark-complete LEADS-02` returned `not_found` — LEADS-02 completion could not be checked off in REQUIREMENTS.md's Traceability table because the row doesn't exist.
- **Recommended fix:** Before or during execution of 03.1-02-PLAN.md, add a new "### Leads Management (Google Sheets Write-Back)" section to `.planning/REQUIREMENTS.md` with LEADS-01..LEADS-05 (using the Phase 03.1 Goal statement in ROADMAP.md as source text) and add corresponding rows to the Traceability table, then re-run `requirements mark-complete LEADS-02` (and others as they complete).

## From 03.1-02 execution

**2. LEADS-01, LEADS-04, LEADS-05 still not_found — confirmed unchanged from Plan 01**
- **Found during:** state updates step, running `requirements mark-complete LEADS-01 LEADS-04 LEADS-05` after completing Plan 02 (03.1-02-PLAN.md frontmatter lists `requirements: [LEADS-01, LEADS-02, LEADS-04, LEADS-05]`)
- **Issue:** Same root cause as item 1 above — `.planning/REQUIREMENTS.md` still has no `LEADS-*` section or traceability rows. `mark-complete` returned `not_found` for all three IDs.
- **Why deferred, not fixed:** Same as item 1 — authoring accurate requirement text for LEADS-03 (Plan 03's UI, not yet executed) from within Plan 02 would mean guessing at scope not yet built. Recommended fix remains: add all five LEADS-01..LEADS-05 requirement entries once Plan 03 is complete (or before it, using the Phase 03.1 ROADMAP.md Goal as source text), then re-run `requirements mark-complete` for all completed IDs at once.
- **Effect on this plan:** Requirements checkboxes/traceability table not updated for LEADS-01, LEADS-04, LEADS-05 despite being functionally delivered by this plan's route implementation.

## From 03.1-03 execution

**3. Pre-existing "written outside GSD flow" files remain untracked in git**
- **Found during:** Task 1 pre-commit `git status` check
- **Issue:** `app/[tenant-slug]/leads/page.tsx` (before this plan's edit), `lib/leads.ts`, `app/api/leads/route.ts`, and `app/[tenant-slug]/leads/agente/` show as untracked (`??`) in git, confirming STATE.md's Roadmap Evolution note that this code was "escrito fora do fluxo GSD... formalizado em 2026-07-04" and never committed by any prior GSD plan.
- **Why deferred, not fixed:** Committing these pre-existing files is not part of this plan's declared scope (`files_modified: [app/[tenant-slug]/leads/page.tsx]`) and doing so would mix unrelated, unreviewed history into this plan's atomic commit. This plan's Task 1 commit (`26a7cc3`) stages only `app/[tenant-slug]/leads/page.tsx` (the full current file, since there was no prior tracked version to diff against).
- **Effect on this plan:** None — build and full test suite pass with these files present in the working tree regardless of git tracking status. Purely a repo-hygiene gap.
- **Recommended fix:** In a future housekeeping task (or the phase's closing plan), `git add lib/leads.ts app/api/leads/route.ts app/[tenant-slug]/leads/agente/` and commit them as a `chore` so the full leads feature has proper commit history.
- **STATUS: PARTIALLY RESOLVED (during Task 2 checkpoint verification).** `lib/leads.ts` and `app/api/leads/route.ts` were committed via `572b5ed` after the Vercel production build broke — Turbopack could not resolve `@/lib/leads` because these files had never been committed, and this plan's `page.tsx` change was the first to be pushed that (transitively) depended on the build succeeding. This was not a scope choice; it was required to make the plan's own feature deployable. `app/[tenant-slug]/leads/agente/` and `app/api/leads/chat/` remain untracked — out of scope for this plan (unrelated feature, not touched or depended on by the status dropdown). Recommended fix for the remainder is unchanged: commit them as a `chore` in a future housekeeping pass.
