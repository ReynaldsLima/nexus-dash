---
phase: quick-260805-0jj
plan: 01
subsystem: leads
tags: [nextjs, cleanup, dead-code, security]

# Dependency graph
requires: []
provides:
  - Módulo "Agente IA" (chat de leads) removido por completo do código-fonte
  - Endpoint proxy autenticado para a chave Anthropic compartilhada eliminado (superfície de ataque reduzida)
affects: [12-redesign-visual, leads]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - components/layout/sidebar-nav.tsx
    - app/[tenant-slug]/leads/page.tsx
    - app/api/leads/route.ts

key-decisions:
  - "Referências de UI removidas antes da deleção dos arquivos (Task 1 antes de Task 2), para que nenhum estado intermediário tivesse link vivo para rota removida"
  - "lib/rate-limit.ts deletado junto — único consumidor era o chat route removido"

requirements-completed: [QUICK-260805-0jj]

duration: 20min
completed: 2026-08-05
---

# Quick Task 260805-0jj: Remover completamente o módulo Agente IA Summary

**Módulo "Agente IA" (chat de leads) e seu endpoint proxy Anthropic removidos por completo — 5 arquivos deletados, 3 editados cirurgicamente, suíte com exatamente 14 testes a menos.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-05T00:29:00-03:00
- **Completed:** 2026-08-05T00:36:00-03:00
- **Tasks:** 3 (2 de código + 1 de verificação)
- **Files modified:** 3 edited, 5 deleted

## Accomplishments
- Removidas todas as referências de UI ao "Agente IA": item de sidebar, CTA no header da página de leads, imports órfãos (`Bot`, `Link`), caso especial de active-state
- Deletados os 5 arquivos do módulo: `app/[tenant-slug]/leads/agente/page.tsx`, `app/api/leads/chat/route.ts`, `lib/rate-limit.ts`, `tests/unit/leads-chat-route.test.ts`, `tests/unit/rate-limit.test.ts` (com os diretórios `agente/` e `chat/` removidos por consequência)
- Gate completo verde: `tsc --noEmit`, `lint`, `build`, `vitest run` — build não lista mais as rotas `/[tenant-slug]/leads/agente` nem `/api/leads/chat`
- AI Insights (`lib/ai/anthropic.ts`, `app/api/insights/*`) e a lista de leads (`lib/leads.ts`, `GET`/`PATCH /api/leads*`) confirmados intactos (`git status` não os lista como modificados)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Remover as referências de UI ao Agente IA** - `e371395` (feat)
2. **Task 2: Deletar os arquivos do módulo Agente IA** - `b24e9ce` (chore)
3. **Task 3: Gate de verificação completo** - sem commit (task somente de verificação, nenhum arquivo modificado)

_Note: docs metadata commit (SUMMARY/STATE) feito separadamente pelo orquestrador._

## Files Created/Modified
- `components/layout/sidebar-nav.tsx` - `LEADS_ITEMS` reduzido a um único item ("Gestão de Leads"), import `Bot` removido, caso especial de active-state para `leads/agente` removido
- `app/[tenant-slug]/leads/page.tsx` - CTA "Agente IA" removido do header, imports órfãos `Bot` e `Link` removidos
- `app/api/leads/route.ts` - comentário obsoleto que citava "Agente IA" atualizado (zero mudança de comportamento)
- `app/[tenant-slug]/leads/agente/page.tsx` - **deletado**
- `app/api/leads/chat/route.ts` - **deletado**
- `lib/rate-limit.ts` - **deletado** (único consumidor era o chat route)
- `tests/unit/leads-chat-route.test.ts` - **deletado** (10 testes)
- `tests/unit/rate-limit.test.ts` - **deletado** (4 testes)

## Decisions Made
- Ordem de execução (referências antes de arquivos) seguida exatamente conforme o plano, evitando qualquer janela com link morto
- Nenhuma decisão fora do plano foi necessária

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

- `.next/` (cache de build stale, gitignorado) continha tipos gerados referenciando as rotas deletadas, causando 2 erros temporários em `tsc --noEmit` logo após a Task 2. Resolvido removendo o diretório `.next/` (regenerado normalmente no próximo build); não é uma regressão de código-fonte.
- `tests/integration/vault-rpc.test.ts` apresenta 2 erros de tipo pré-existentes em `tsc --noEmit`, confirmados via `git stash` como não relacionados a esta tarefa (fora do escopo, não tocados).
- `npx vitest run` mostrou 1 falha na primeira execução da suíte completa: o flake conhecido de realtime em `tests/unit/anomaly-alerts-schema.test.ts`, documentado no `<context>` do plano como tolerado. Confirmado como flake (não regressão) reexecutando o arquivo isoladamente (7/7 passou) e a suíte completa novamente (resultado limpo: 35 arquivos, 308 passed | 1 skipped | 5 todo, zero falhas).

## Verificação da contagem de testes

Baseline medido antes da execução: `37 arquivos / 322 passed | 1 skipped | 5 todo (328)`.
Contagem pós-remoção (execução limpa): `35 arquivos / 308 passed | 1 skipped | 5 todo (314)`.
Delta: exatamente **-2 arquivos / -14 testes**, igual ao esperado no plano. `skipped` e `todo` inalterados.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- Módulo Agente IA totalmente removido; nenhuma referência remanescente em `app/`, `lib/`, `components/`, `tests/`
- AI Insights e lista de leads funcionando normalmente, sem impacto
- Fase 12 (Redesign Visual) pode prosseguir sem código morto deste módulo na base

---
*Phase: quick-260805-0jj*
*Completed: 2026-08-05*

## Self-Check: PASSED

- Commit `e371395` (Task 1): FOUND
- Commit `b24e9ce` (Task 2): FOUND
- Modified files present: `components/layout/sidebar-nav.tsx`, `app/[tenant-slug]/leads/page.tsx`, `app/api/leads/route.ts` — all FOUND
- Deleted files confirmed absent: `app/[tenant-slug]/leads/agente/page.tsx`, `app/api/leads/chat/route.ts`, `lib/rate-limit.ts`, `tests/unit/leads-chat-route.test.ts`, `tests/unit/rate-limit.test.ts` — all CONFIRMED DELETED
