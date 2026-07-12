---
phase: 09-limpeza-do-papel-viewer
plan: 01
subsystem: auth
tags: [typescript, middleware, rbac, dead-code-removal, vitest]

# Dependency graph
requires:
  - phase: 05-agencia-multi-cliente
    provides: "Plan 03 colapsou tenant_users.role em 'tenant_admin' via migration 0020 (CHECK constraint), tornando 'viewer' impossível no banco; Plan 04 manteve 'viewer' na camada de aplicação como rollout-safety net"
provides:
  - "Role type (lib/stores/tenant-store.tsx) sem o literal 'viewer'"
  - "proxy.ts sem branch condicional para 'viewer' — redirect trata apenas tenant_admin/agency/super_admin"
  - "components/tenants/tenant-switcher.tsx sem 'viewer' na union da prop role"
  - "comentário do RPC em app/api/meta-ads/connect/route.ts corrigido"
  - "6 arquivos de teste usando sentinel 'invalid_role' em vez de 'viewer' para cobrir o caso de papel desconhecido"
affects: [10-gestao-de-usuarios]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentinel 'invalid_role' para testes de papel desconhecido/rejeitado, em vez de reutilizar um papel morto do sistema"

key-files:
  created: []
  modified:
    - lib/stores/tenant-store.tsx
    - proxy.ts
    - components/tenants/tenant-switcher.tsx
    - app/api/meta-ads/connect/route.ts
    - tests/middleware.test.ts
    - tests/unit/google-ads-connect-route.test.ts
    - tests/unit/insights-generate-route.test.ts
    - tests/unit/leads-status-route.test.ts
    - tests/unit/leads-get-route.test.ts
    - tests/unit/leads-chat-route.test.ts

key-decisions:
  - "Remoção mínima do literal 'viewer' em cada cópia local da union (proxy.ts, tenant-switcher.tsx), sem consolidar num import único de lib/stores/tenant-store.tsx — diff mínimo, duplicação pré-existente fora de escopo"
  - "tests/integration/tenant-role-migration.test.ts deliberadamente NÃO tocado — prova a CHECK constraint da migration 0020, remover 'viewer' ali destruiria o próprio teste"
  - "Sentinel 'invalid_role' usado em todas as 8 substituições de teste (nomes it(...) e valores mockados), preservando a cobertura de 'papel desconhecido é rejeitado' sem reintroduzir semântica de papel morto"

patterns-established:
  - "Sentinel de papel inválido em testes: usar um valor claramente não-válido ('invalid_role') em vez de um papel legado, para não acoplar testes a histórico do sistema"

requirements-completed: [AUTH-07]

# Metrics
duration: 10min
completed: 2026-07-12
---

# Phase 09 Plan 01: Limpeza do Papel Viewer Summary

**Removido o literal `'viewer'` de 4 arquivos de aplicação (Role type, middleware, componente, comentário RPC) e substituído por sentinel `'invalid_role'` em 6 arquivos de teste — fecha AUTH-07 sem nenhuma mudança de comportamento observável além de um fail-closed estritamente mais restritivo em `proxy.ts`.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 completed
- **Files modified:** 10

## Accomplishments
- `Role` type em `lib/stores/tenant-store.tsx` não inclui mais `'viewer'`
- `proxy.ts`: `AppMetadata.role` e o branch de redirect por papel não mencionam mais `'viewer'` — apenas `tenant_admin` cai no branch de dashboard do tenant
- `components/tenants/tenant-switcher.tsx`: prop `role` sem `'viewer'` na union (escape hatch `| string` preservado)
- Comentário obsoleto do RPC em `app/api/meta-ads/connect/route.ts` corrigido
- 6 arquivos de teste migrados para o sentinel `'invalid_role'` (nomes de teste e valores mockados), preservando 100% da cobertura de "papel desconhecido é rejeitado"
- `tests/integration/tenant-role-migration.test.ts` (fora de escopo) permanece intocado, com `'viewer'` intacto para provar a CHECK constraint da migration 0020

## Task Commits

Each task was committed atomically:

1. **Task 1: Remover 'viewer' da camada de aplicação (tipos, middleware, componente, comentário)** - `e8f6379` (feat)
2. **Task 2: Substituir 'viewer' por sentinel 'invalid_role' nos 6 arquivos de teste** - `09a3c96` (test)

_Note: Sem tasks TDD nesta plan — todas as edições foram diffs mínimos em código/testes já existentes._

## Files Created/Modified
- `lib/stores/tenant-store.tsx` - `Role` type simplificado, sem `'viewer'`
- `proxy.ts` - `AppMetadata.role` e branch de redirect sem `'viewer'`
- `components/tenants/tenant-switcher.tsx` - prop `role` sem `'viewer'`
- `app/api/meta-ads/connect/route.ts` - comentário do RPC corrigido
- `tests/middleware.test.ts` - 4 substituições (nome de teste + token + payload + asserção)
- `tests/unit/google-ads-connect-route.test.ts` - nome de teste + `mockState.role`
- `tests/unit/insights-generate-route.test.ts` - nome de teste + `mockState.role`
- `tests/unit/leads-status-route.test.ts` - nome de teste + `mockState.role`
- `tests/unit/leads-get-route.test.ts` - nome de teste + `mockState.role`
- `tests/unit/leads-chat-route.test.ts` - nome de teste + `mockState.role`

## Decisions Made
Nenhuma decisão nova além das já resolvidas no planejamento (documentadas em `09-01-PLAN.md` `<decisoes_de_discricao_do_claude>`):
- Remoção mínima das unions duplicadas, sem consolidação
- `tests/integration/tenant-role-migration.test.ts` fora de escopo
- `| string` escape hatch em `tenant-switcher.tsx` preservado
- `CLAUDE.md` não tocado (menção a "viewer" é documentação, não código de aplicação)

## Deviations from Plan

None - plan executado exatamente como escrito. Todas as 4 edições da Task 1 e as 8 substituições da Task 2 seguiram os diffs literais especificados no plano.

## Issues Encountered
Nenhum problema na execução das tasks em si. Durante a verificação da suíte completa (`npx vitest run`), `tests/unit/anomaly-alerts-schema.test.ts` falhou uma asserção de delivery via Realtime (`postgres_changes`) — confirmado como o flake de cold-start de websocket já documentado desde a Phase 4 Plan 02 (não relacionado a esta plan, que não toca `anomaly_alerts` nem código de realtime). Reconfirmado não-regressão via re-execução isolada do arquivo: 7/7 testes passaram.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
AUTH-07 satisfeito. `Role` type simplificado (`'super_admin' | 'tenant_admin' | 'agency' | 'none' | null`) está pronto para a Phase 10 (Gestão de Usuários) construir sobre ele sem carregar um valor morto do sistema. Nenhum bloqueio identificado.

---
*Phase: 09-limpeza-do-papel-viewer*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 10 modified files and the SUMMARY.md confirmed present on disk; both task commits (`e8f6379`, `09a3c96`) confirmed present in git history.
