---
phase: quick
plan: 260802-w2g
subsystem: leads
tags: [leads, sorting, dates, api, ui, google-sheets]

# Dependency graph
requires: []
provides:
  - "lib/leads.ts: parseLeadDate, compareByCriadoEm, sortLeadsByCriadoEmDesc pure helpers"
  - "GET /api/leads returns leads pre-sorted newest-first"
  - "Leads table 'Criado em' column sorts chronologically instead of alphabetically"
affects: [leads-agente-ia, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date parsing for pt-BR spreadsheet strings done via explicit regex parser (lib/leads.ts), never native Date.parse (which misreads DD/MM as MM/DD)"

key-files:
  created:
    - tests/unit/leads-sort.test.ts
  modified:
    - lib/leads.ts
    - app/api/leads/route.ts
    - tests/unit/leads-get-route.test.ts
    - "app/[tenant-slug]/leads/page.tsx"

key-decisions:
  - "Sorting applied at both the API layer (GET /api/leads, so the AI agent gets the true 50 most recent leads) and the UI layer (page.tsx comparator, so manual header-click sorting is chronologically correct)"
  - "Null/unparseable dates always sort to the end regardless of asc/desc toggle, with stable relative order preserved among themselves"
  - "No new dependency installed — date-fns exists in the project but the pt-BR parser is ~15 lines of validated regex, not worth coupling to a locale library"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-08-02
---

# Quick Task 260802-w2g: Ordenação Cronológica de Leads Summary

**Corrigido bug de ordenação alfabética (não cronológica) na coluna "Criado em" da lista de leads, tanto na tabela quanto na resposta da API `GET /api/leads`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T23:09:00Z
- **Completed:** 2026-08-02T23:21:00Z
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- Novo parser puro `parseLeadDate()` interpreta corretamente datas pt-BR (`DD/MM/YYYY`, com/sem hora) e ISO, com validação de faixa e rejeição de overflow (ex.: `31/02`), retornando `null` para entradas ilegíveis
- `GET /api/leads` agora devolve os leads já ordenados do mais novo para o mais antigo — corrige o Agente IA, que usa `leads.slice(0, 50)` e antes recebia os 50 primeiros da planilha em vez dos 50 mais recentes
- Comparador da tabela (`app/[tenant-slug]/leads/page.tsx`) trocou `String.localeCompare` (alfabético, quebrava em virada de mês: `31/07` > `02/08`) por `compareByCriadoEm` (cronológico real) apenas para a coluna `criado_em` — as outras 5 colunas continuam ordenando alfabeticamente como antes
- `lead.id` (índice 0-based da linha da planilha, usado por `PATCH /api/leads/[id]/status` como `Leads!F{id+2}`) provadamente preservado após qualquer reordenação, com asserção automatizada explícita (`[1,0,2]`) tanto no helper puro quanto na rota

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar parser de data e comparadores puros em lib/leads.ts** — `b8dd96e` (test, RED) + `80ded4f` (feat, GREEN)
2. **Task 2: Aplicar a ordem padrão na origem — GET /api/leads** - `43f0ba4` (feat)
3. **Task 3: Corrigir o comparador cronológico na tabela de leads** - `7e4613b` (fix)

**Plan metadata:** committed separately by the orchestrator (docs commit, not part of this agent's per-task commits)

_Note: Task 1 used TDD (RED → GREEN); no REFACTOR commit was needed since the initial implementation passed cleanly._

## Files Created/Modified
- `lib/leads.ts` - Added `parseLeadDate`, `compareByCriadoEm`, `sortLeadsByCriadoEmDesc` pure helpers (no existing exports touched)
- `tests/unit/leads-sort.test.ts` - New: 13 tests covering pt-BR/ISO parsing, range validation, overflow rejection, null-last stable sort, id preservation, non-mutation
- `app/api/leads/route.ts` - Import widened to value import; `sortLeadsByCriadoEmDesc(leads)` applied after `id` assignment, before `NextResponse.json`
- `tests/unit/leads-get-route.test.ts` - New `describe` block proving order `['Bruno','Ana','Carla']` and id `[1,0,2]`, without touching the 10 pre-existing auth/role/scope tests
- `app/[tenant-slug]/leads/page.tsx` - `.sort()` callback in the `filtered` `useMemo` branches to `compareByCriadoEm` when `sortKey === 'criado_em'`; all other columns, `toggleSort`, and default state (`criado_em`/`desc`) untouched

## Decisions Made
- Applied ordering at both the API route and the page component rather than only one layer — the plan's `<must_haves>` explicitly required both the AI agent's data source and the interactive table to be correctly ordered, and these are two separate code paths with no shared runtime state (SSR route vs client-side `useMemo`).
- Used native regex instead of `date-fns` per the plan's explicit constraint (no new dependency, ~15 lines is simpler than coupling to a locale parser).

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>` specs precisely (regex pattern, threshold validations, comment content, sort semantics, import changes).

## Verification Results

1. `npx vitest run tests/unit/leads-sort.test.ts` — 13/13 passed
2. `npx vitest run tests/unit/leads-get-route.test.ts tests/unit/leads-sort.test.ts` — 24/24 passed (11 pre-existing + 13 new)
3. `npm test` (full suite) — 36 test files, 300 passed, 1 skipped, 5 todo — all green, no regressions
4. `npx tsc --noEmit` — no errors in any of the 3 files touched by this plan. Two pre-existing errors remain in `tests/integration/vault-rpc.test.ts` (unrelated to this plan's scope, logged below)
5. `npx eslint "app/[tenant-slug]/leads/page.tsx" "app/api/leads/route.ts" "lib/leads.ts"` — clean, zero warnings/errors

## Out-of-Scope Items (not fixed, logged only)

- `tests/integration/vault-rpc.test.ts:124` and `:135` — pre-existing `tsc --noEmit` errors (`p_secret_name` argument type mismatch against a Supabase RPC typed as taking no arguments). Unrelated to leads sorting; not touched per scope boundary rules.

## Manual Verification Still Pending (per plan's `<verification>` section)

The plan's automated verification (items 1-2 above) is fully green. Items 3-4 of the plan's `<verification>` section require live manual checks in the browser against a real tenant's Google Sheets data:
- Open `/[tenant-slug]/leads` and confirm "Criado em" descends newest→oldest across a month boundary (an August date above a July date, chronologically, despite the smaller day-of-month digit)
- Click "Criado em" to invert to oldest-first; click "Nome" to confirm alphabetical sort still works
- Edit the status of a lead that is NOT first in the list, reload, and confirm the status persisted on the correct row (proves `id → sheet row` mapping survived reordering)

These require a live tenant with configured `sheet_id`/`sheets_api_key` and were not executed as part of this automated quick-task run.

## Known Stubs

None.

## Threat Flags

None — this plan's changes stay strictly within the boundaries and dispositions already declared in its own `<threat_model>` (T-w2g-01 through T-w2g-04); no new endpoints, auth paths, or trust boundaries were introduced.

## Self-Check: PASSED
