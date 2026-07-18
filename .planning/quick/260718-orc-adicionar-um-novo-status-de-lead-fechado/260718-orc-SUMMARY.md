---
phase: quick
plan: 260718-orc
subsystem: ui
tags: [leads, google-sheets, kpi, ai-agent, tdd]

# Dependency graph
requires:
  - phase: 03.1-leads-management-via-google-sheets-integration
    provides: "lib/leads.ts classifier (cat/CATEGORY_LABELS/CATEGORY_BG), editable Status dropdown, PATCH /api/leads/[id]/status with dynamic Zod enum"
provides:
  - "5th LeadCategory 'fechado' (Fechado) end-to-end: classifier, dropdown, filter tab, KPI card, funnel bar, distribution list, AI agent summary"
affects: [leads, dashboard-kpis, ai-agent-leads]

# Tech tracking
tech-stack:
  added: []
  patterns: ["New LeadCategory values require touching lib/leads.ts (LeadCategory/cat/CATEGORY_LABELS/CATEGORY_COLORS/CATEGORY_BG) plus every consumer that hardcodes the category list — grep for `LeadCategory\\[\\]` and `cat(l.status) ===` to find them all"]

key-files:
  created:
    - tests/unit/leads-category.test.ts
  modified:
    - lib/leads.ts
    - "app/[tenant-slug]/leads/page.tsx"
    - "app/[tenant-slug]/leads/agente/page.tsx"

key-decisions:
  - "'fechado' classification keywords checked FIRST in cat() (before negoc/quente/fim) to make the new 'closed-won' outcome explicit and distinct from 'fim' (no-response); confirmed zero keyword collisions via regression tests"
  - "Violet (text-violet-400 / bg-violet-500) chosen as the 5th category color — the only Tailwind hue not already used by novo (blue)/quente (emerald)/negoc (orange)/fim (muted)"
  - "PATCH /api/leads/[id]/status required zero code changes — its Zod enum is derived dynamically via Object.values(CATEGORY_LABELS), so adding 'Fechado' to CATEGORY_LABELS was sufficient"
  - "No Supabase migration needed — leads live 100% in Google Sheets (plain string column), confirmed via existing route code, no CHECK constraint or leads table exists"

patterns-established: []

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-07-18
---

# Phase quick Plan 260718-orc: Adicionar status de lead "Fechado" Summary

**Added a 5th `LeadCategory` ('fechado') across the classifier, leads management table (dropdown/tab/KPI/funnel/distribution), and the AI leads-agent context summary — zero backend/route changes required since the PATCH validation and Sheets write path were already dynamic.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-18T20:59:04Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `lib/leads.ts` classifier recognizes "Fechado"/"Venda Fechada"/"Convertido"/"Ganho" as the new `'fechado'` category, with zero regressions on existing categories (TDD RED→GREEN, 8/8 tests passing)
- Gestão de Leads table (`/[tenant-slug]/leads`) now treats "Fechado" as a first-class category: dropdown option, filter tab ("Fechados"), 6th KPI card, 3rd funnel bar, and distribution list entry — all using the new violet color token
- AI leads agent (`/[tenant-slug]/leads/agente`) system prompt now reports the Fechados count and a "Taxa de conversão (fechados)" percentage alongside the existing funnel metrics
- Confirmed (and left untouched, as designed) that `PATCH /api/leads/[id]/status` accepts `status: 'Fechado'` automatically via its pre-existing `Object.values(CATEGORY_LABELS)` dynamic enum — no route code change needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar categoria 'fechado' em lib/leads.ts** - `2e4d032` (feat, TDD)
2. **Task 2: Expor 'Fechado' na tabela de Gestão de Leads** - `d7903a8` (feat)
3. **Task 3: Incluir contagem de 'Fechado' no resumo do Agente IA** - `1bdd638` (feat)

_Note: Task 1 used TDD — the test file (`tests/unit/leads-category.test.ts`) was written first and confirmed RED (5/8 failing) against the pre-change `lib/leads.ts`, then `lib/leads.ts` was edited and the same test run confirmed GREEN (8/8 passing) before committing both files together in a single `feat` commit._

## Files Created/Modified
- `lib/leads.ts` - `LeadCategory` union gains `'fechado'`; `cat()` classifies "fechado"/"fechada"/"venda fechada"/"convertido"/"ganho" as `'fechado'` (checked first); `CATEGORY_LABELS`/`CATEGORY_COLORS`/`CATEGORY_BG` gain `fechado` entries (violet)
- `tests/unit/leads-category.test.ts` - New: 8 tests covering the new category classification + label/color entries + regression of the 4 pre-existing categories and the empty-string fallback
- `app/[tenant-slug]/leads/page.tsx` - `StatusDropdown` OPTIONS, `stats` useMemo (`fechado`/`pFechado`), `TABS` ("Fechados"), KPI row (6th `CheckCircle2` card, `grid-cols-6`), Funil de Conversão (3rd bar), Distribuição list (violet entry, listed first) all updated
- `app/[tenant-slug]/leads/agente/page.tsx` - `buildSystem()` computes `fechado` count, adds it to the summary line, and adds a "Taxa de conversão (fechados)" percentage line to the Claude system prompt

## Decisions Made
- 'fechado' keywords checked before negoc/quente/fim in `cat()` to make it an explicit, distinct funnel outcome from "Sem Resposta" — verified no keyword collisions via regression tests
- Violet color token used (unused by the other 4 categories) for visual consistency
- No database migration — leads data is 100% Google Sheets-backed, no `leads` table/CHECK constraint exists in Supabase

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks, all edit points, and all verification commands matched the plan's literal instructions with no Rule 1-4 triggers.

## Verification Results

- `npx vitest run tests/unit/leads-category.test.ts` — 8/8 passed (RED confirmed pre-fix, GREEN confirmed post-fix)
- `npm test` (full suite) — 35 test files, 269 passed / 1 skipped / 5 todo, zero regressions
- `npx tsc --noEmit` — clean, only the 2 pre-existing unrelated `vault-rpc.test.ts` errors documented since Phase 04 remain
- `npm run build` — compiles cleanly, all 21 routes generated successfully

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/leads.ts (fechado entries present)
- FOUND: tests/unit/leads-category.test.ts
- FOUND: app/[tenant-slug]/leads/page.tsx (fechado wired)
- FOUND: app/[tenant-slug]/leads/agente/page.tsx (fechado wired)
- FOUND commit 2e4d032
- FOUND commit d7903a8
- FOUND commit 1bdd638
