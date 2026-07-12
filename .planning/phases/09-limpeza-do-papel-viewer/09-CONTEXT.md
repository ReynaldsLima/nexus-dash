# Phase 9: Limpeza do Papel Viewer - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

O papel `"viewer"` — já impossível de existir no banco desde a migration `0020` (Phase 5), mantido hoje só como fallback de rollout-safety — deixa de existir também na camada de aplicação: tipos TypeScript, middleware, componentes e testes. Escopo é remoção de código morto e simplificação do `Role` type, não introdução de comportamento novo.

</domain>

<decisions>
## Implementation Decisions

### Testes de "papel rejeitado"

6 casos de teste usam `role: 'viewer'` apenas como exemplo de um papel que deve ser rejeitado (403 / redirect), não como teste de um papel real do sistema:
- `tests/middleware.test.ts` — `'blocks viewer from /tenants'`
- `tests/unit/google-ads-connect-route.test.ts` — `"role 'viewer' → redirect ?google_error=forbidden"`
- `tests/unit/insights-generate-route.test.ts` — `"role 'viewer' → 403"`
- `tests/unit/leads-status-route.test.ts` — `"role 'viewer' → 403"`
- `tests/unit/leads-get-route.test.ts` — `"role 'viewer' → 403"`
- `tests/unit/leads-chat-route.test.ts` — `"role 'viewer' → 403"`

- **D-01:** Substituir `'viewer'` por um sentinel genérico de papel inválido/desconhecido (ex.: `'invalid_role'`) em todos os 6 casos acima. Preserva a cobertura de "papel não reconhecido é rejeitado" sem reintroduzir semântica de um papel morto do sistema. Atualizar também as descrições dos testes (`it(...)`) para refletir o novo valor, não deixar strings `'viewer'` residuais em nomes de teste.
- **D-02:** O teste de decodificação de JWT em `tests/middleware.test.ts` (`describe('JWT claim extraction ...')`, linha ~56-65) usa `role: 'viewer'` apenas como valor de exemplo num payload — não testa autorização/rejeição. Aplicar o mesmo sentinel (`'invalid_role'`) por consistência, já que o valor em si é arbitrário para esse teste.

### Claude's Discretion

- **`tests/integration/tenant-role-migration.test.ts`** — teste de integração que usa o literal `'viewer'` de propósito, para provar que a CHECK constraint do banco rejeita esse valor (valida a migration `0020` da Phase 5, camada de banco/histórica, não camada de aplicação). Usuário não elegeu esta área para discussão — Claude decide durante o planejamento se este teste fica fora do escopo de AUTH-07 (por não ser "camada de aplicação") ou se precisa de ajuste. Ao decidir, considerar que o propósito do teste é exatamente provar que `'viewer'` é rejeitado pelo banco — não que é um papel válido.
- **Duplicação do `Role` type** — `proxy.ts:5` e `components/tenants/tenant-switcher.tsx:13` duplicam localmente a union type ao invés de importar `Role` de `lib/stores/tenant-store.tsx`. Usuário não elegeu esta área para discussão — Claude decide se consolida numa fonte única ou apenas remove `'viewer'` de cada local (diff mínimo), guiado pelo objetivo do phase goal de "simplificar o `Role` type".
- **Comentário obsoleto** em `app/api/meta-ads/connect/route.ts:43` (`// Uses get_user_role() RPC (returns 'super_admin' | 'tenant_admin' | 'viewer')`) — corrigir como parte natural da limpeza, não é uma decisão de design.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` §Limpeza de Papel Morto (AUTH-07) — texto completo do requirement
- `.planning/ROADMAP.md` §Phase 9 — goal e success criteria (4 critérios, todos verificáveis por grep/teste)

### Histórico do papel viewer
- `.planning/PROJECT.md` §Key Decisions — linha "Papéis Tenant Admin/Viewer colapsados em 'Cliente' único" — contexto de por que 'viewer' virou código morto
- `.planning/milestones/v1.0-phases/05-agencia-multi-cliente/05-CONTEXT.md` §D-03 — decisão original de colapsar `tenant_admin`/`viewer` num papel único; menciona que a migration precisaria mudar o CHECK constraint
- `supabase/migrations/0020_collapse_tenant_role.sql` — migration que já removeu `'viewer'` como valor aceito no banco (não tocar — histórico/aplicado)

No external specs além dos acima — requirements totalmente capturados nas decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Inventário completo de referências a `'viewer'` (fora de `.planning/` e migrations históricas)

**Tipos / lógica de aplicação:**
- `lib/stores/tenant-store.tsx:13` — `export type Role = 'super_admin' | 'tenant_admin' | 'viewer' | 'agency' | 'none' | null` (fonte canônica do tipo)
- `proxy.ts:5` — `AppMetadata.role` duplica a union type localmente, inclui `'viewer'`
- `proxy.ts:68` — branch `(role === 'tenant_admin' || role === 'viewer') && tenantSlug` — remover `|| role === 'viewer'`, mantendo só `tenant_admin`
- `components/tenants/tenant-switcher.tsx:13` — `TenantSwitcherProps.role` duplica a union type localmente (com fallback solto `| string`), inclui `'viewer'`. Componente já ignora `'viewer'` na lógica (`if (role !== 'super_admin' && role !== 'agency') return null` — só early-returns; sem branch dedicado a viewer)

**Comentário obsoleto:**
- `app/api/meta-ads/connect/route.ts:43` — comentário cita `'viewer'` como retorno possível de `get_user_role()` RPC

**Testes (ver D-01/D-02 acima para tratamento):**
- `tests/middleware.test.ts` (linhas 43-47, 58-63)
- `tests/unit/google-ads-connect-route.test.ts` (linha 59-60)
- `tests/unit/insights-generate-route.test.ts` (linha 81-82)
- `tests/unit/leads-status-route.test.ts` (linha 113-114)
- `tests/unit/leads-get-route.test.ts` (linha 67-68)
- `tests/unit/leads-chat-route.test.ts` (linha 71-72)

**Fora do escopo direto de AUTH-07 (ver Claude's Discretion):**
- `tests/integration/tenant-role-migration.test.ts` — self-skips sem `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_KEY`; usa `'viewer'` intencionalmente para provar rejeição pelo banco
- `supabase/migrations/0020_collapse_tenant_role.sql` e `0006_create_ad_accounts.sql`, `0003_create_helper_functions.sql`, `0002_create_tenants.sql` — migrations históricas já aplicadas, não tocar

### Established Patterns
- `Role` type tem uma fonte canônica em `lib/stores/tenant-store.tsx`, mas `proxy.ts` e `tenant-switcher.tsx` mantêm cópias locais da union — padrão de duplicação já existente no código, não introduzido por esta phase.
- Testes de rota usam um padrão consistente `mockState.role = '<valor>'` seguido de assert de status/redirect — o sentinel `'invalid_role'` (D-01) se encaixa nesse padrão sem mudança estrutural.

### Integration Points
- Nenhum — esta phase não adiciona rotas, componentes ou tabelas novas. Todas as mudanças são edições em arquivos existentes já listados acima.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual ou de exemplo externo — decisão foi puramente sobre estratégia de teste (D-01/D-02).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da phase. As duas áreas não selecionadas pelo usuário (teste de migration do banco, duplicação do `Role` type) não são features novas — foram deixadas como Claude's Discretion acima, não como itens adiados para outra phase.

</deferred>

---

*Phase: 09-limpeza-do-papel-viewer*
*Context gathered: 2026-07-11*
