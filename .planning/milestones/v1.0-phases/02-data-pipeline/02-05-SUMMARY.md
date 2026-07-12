---
phase: 02-data-pipeline
plan: "05"
subsystem: sync-status-ui
tags: [supabase, nextjs, rsc, server-component, sync-status, vitest, sync-03, sync-04]
dependency_graph:
  requires:
    - "02-02 (sync_jobs table + RLS)"
    - "01-foundation (tenants page, middleware, auth)"
  provides:
    - lib/sync-status.ts
    - components/tenants/sync-status-section.tsx
    - app/tenants/page.tsx (updated)
  affects:
    - "/tenants page: Super Admin now sees last sync per tenant+channel"
    - "Phase 3 dashboard: sync visibility baseline established"
tech_stack:
  added: []
  patterns:
    - "Server Component data fetching via createClient() from lib/supabase/server.ts — no TanStack Query"
    - "server-only import guard with vi.mock('server-only', () => ({})) in Vitest unit tests"
    - "In-memory dedupe by composite key (tenant_id::channel) after ordered PostgREST query"
    - "Suspense boundary wrapping async Server Component in page.tsx"
key_files:
  created:
    - lib/sync-status.ts
    - components/tenants/sync-status-section.tsx
    - tests/unit/sync-status.test.ts
  modified:
    - app/tenants/page.tsx
    - types/database.types.ts (removed MCP-injected <claude-code-hint> artifact)
decisions:
  - "Test file placed in tests/unit/ (not lib/) to match vitest.config.mts include pattern tests/**/*.test.ts"
  - "server-only mock added in test file (vi.mock) rather than global setup — isolates the concern to sync-status tests only"
  - "Dedupe via in-memory Set<string> (not DISTINCT ON RPC) — adequate for v1 scale of ≤6 final rows"
  - "SyncStatusSection groups by tenant and always renders both channels (google_ads + meta_ads) per tenant — even without sync data"
metrics:
  duration_seconds: 900
  completed_date: "2026-05-16"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 2
---

# Phase 02 Plan 05: Sync Status UI Summary

**One-liner:** Server Component SyncStatusSection with in-memory dedupe fetches last sync_job per (tenant, channel) and renders status badges, timestamps, and error snippets on the /tenants page.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Criar lib/sync-status.ts (data fetcher + 4 testes TDD) | `6d7d799` | `lib/sync-status.ts`, `tests/unit/sync-status.test.ts` |
| 2 | Criar components/tenants/sync-status-section.tsx | `2990de6` | `components/tenants/sync-status-section.tsx` |
| 3 | Integrar SyncStatusSection em app/tenants/page.tsx | `47fb731` | `app/tenants/page.tsx`, `types/database.types.ts` |
| 4 | Human verification — testar /tenants com dados reais | APROVADO | `app/tenants/page.tsx`, `components/tenants/sync-status-section.tsx` |

---

## Resultado npm test

```
Test Files  8 passed (8)
Tests       45 passed | 5 todo (50)
Duration    3.19s
```

- 8 arquivos de teste, todos passando
- 45 testes reais passando (4 novos da Task 1 + 41 existentes)
- 5 `todo` restantes são dos scaffolds da Fase 1 (`tests/rls.test.ts`)
- Exit code: 0

---

## Resultado npm run build

```
Route (app)
├ ƒ /tenants          ← Dynamic (Server Component com auth)
└ ƒ /tenants/[slug]
```

Build exit code: 0. Todos os 6 routes compilados sem erro TypeScript.

---

## Arquivos Criados / Modificados

### lib/sync-status.ts
- `import 'server-only'` — previne uso acidental em Client Components
- `interface SyncStatusRow` com campos: `tenant_id, tenant_name, tenant_slug, channel, status, completed_at, started_at, records_synced, error_message`
- `loadLastSyncByTenantChannel()` — query `sync_jobs` com embed `tenants:tenant_id (name, slug)`, ordered por `completed_at DESC NULLS LAST`, limit 500
- Dedupe in-memory via `Set<string>` com chave `${tenant_id}::${channel}`
- Erro: `console.error` + retorna `[]`, nunca lança exceção

### components/tenants/sync-status-section.tsx
- `export async function SyncStatusSection()` — Server Component async
- `StatusBadge` interno: success=verde, failed=vermelho, running=secondary, null=outline "Sem sync"
- `formatTimestamp()` — `toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })`
- Exibe AMBOS os channels (`google_ads`, `meta_ads`) por tenant — mesmo sem sync
- Empty state: "Nenhum sync registrado ainda..." quando `rows.length === 0`
- error_message truncado para 80 chars + `…`

### app/tenants/page.tsx
- Importa `SyncStatusSection` de `@/components/tenants/sync-status-section`
- Renderiza `<SyncStatusSection />` abaixo de `<TenantsTable />` envolto em `<Suspense>`
- Skeleton fallback com h-8 + h-32 para o carregamento da seção sync
- Estrutura existente preservada: CreateTenantForm, TenantsTable, header "Tenants"

---

## Human Verification (Task 4) — APROVADO

**Status:** Aprovado pelo Super Admin em 2026-05-16.

**Resultado da verificação:**
- Seção "Status de Sync" aparece corretamente abaixo da tabela de tenants
- Dedupe funciona: google_ads exibe records_synced=155 (mais recente), não 142 (anterior)
- Badge de falha (vermelho) visível na linha meta_ads
- Tabela de tenants original não foi quebrada
- URL verificada: https://nexusdash-chi.vercel.app/tenants

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file path: tests/unit/ em vez de lib/**
- **Found during:** Task 1 (RED phase)
- **Issue:** `vitest.config.mts` inclui apenas `tests/**/*.test.ts`. O plano especificava `lib/sync-status.test.ts`, que ficaria fora do glob e nunca seria executado.
- **Fix:** Arquivo de teste criado em `tests/unit/sync-status.test.ts` seguindo o padrão existente do projeto (`tests/unit/campaign-metrics-schema.test.ts`).
- **Files modified:** `tests/unit/sync-status.test.ts` (path ajustado)
- **Commit:** `6d7d799`

**2. [Rule 3 - Blocking] Mock de server-only em testes Vitest**
- **Found during:** Task 1 (GREEN phase) — testes falhavam com "This module cannot be imported from a Client Component module"
- **Issue:** O módulo `server-only` lança erro em ambientes não-RSC como Vitest/Node. O plano não mencionava esse requisito.
- **Fix:** Adicionado `vi.mock('server-only', () => ({}))` no arquivo de teste antes dos outros mocks.
- **Files modified:** `tests/unit/sync-status.test.ts`
- **Commit:** `6d7d799`

**3. [Rule 1 - Bug] Remoção do artefato <claude-code-hint> de database.types.ts**
- **Found during:** Task 3 — `npm run build` falhava com "Type error: Operator '<' cannot be applied..."
- **Issue:** O MCP Supabase injetou um tag `<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />` na última linha de `types/database.types.ts`, corrompendo o arquivo TypeScript. Erro pré-existente não causado por esta plan.
- **Fix:** Remoção do tag na linha 428.
- **Files modified:** `types/database.types.ts`
- **Commit:** `47fb731`

---

## Known Stubs

Nenhum stub de dados. A seção "Status de Sync" exibe:
- Empty state quando `sync_jobs` não tem registros (estado real da maioria dos tenants pré-workflow)
- "Sem sync" (Badge outline) para channels sem sync — esse é comportamento correto, não stub

---

## Threat Flags

Mitigações do threat_model verificadas na implementação:

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-2-05-01 | Mitigado | /tenants protegido pelo middleware Fase 1; RLS sync_jobs_tenant_select restringe por tenant_id mesmo se middleware falhasse |
| T-2-05-02 | Mitigado | error_message truncado para 80 chars em `sync-status-section.tsx` linha de exibição |
| T-2-05-03 | Mitigado | React JSX faz escape automático; nenhum `dangerouslySetInnerHTML` usado |
| T-2-05-04 | Aceito | `.limit(500)` + dedupe in-memory mantém ≤6 linhas finais para v1 |

Nenhuma nova superfície de segurança além do documentado no threat_model do plano.

---

## Self-Check: PASSED

```
FOUND: lib/sync-status.ts
FOUND: components/tenants/sync-status-section.tsx
FOUND: tests/unit/sync-status.test.ts
FOUND: app/tenants/page.tsx (modified — contains SyncStatusSection)
FOUND commit: 6d7d799
FOUND commit: 2990de6
FOUND commit: 47fb731
npm test: 8 files, 45 passed, 5 todo — exit 0
npm run build: exit 0 — /tenants dynamic route compiled
lib/sync-status.ts contains: import 'server-only'
lib/sync-status.ts exports: interface SyncStatusRow
lib/sync-status.ts exports: async function loadLastSyncByTenantChannel()
components/tenants/sync-status-section.tsx exports: async function SyncStatusSection()
app/tenants/page.tsx contains: import { SyncStatusSection }
app/tenants/page.tsx contains: <SyncStatusSection />
Task 4: APROVADO — checkpoint:human-verify confirmado pelo Super Admin (dedupe 155 correto, badge falha visível)
```
