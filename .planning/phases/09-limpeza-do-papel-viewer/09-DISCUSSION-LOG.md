# Phase 9: Limpeza do Papel Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 09-limpeza-do-papel-viewer
**Areas discussed:** Testes de "papel rejeitado"

---

## Seleção de áreas cinzentas

Apresentadas 3 áreas candidatas (geradas a partir de inventário completo de `grep -ri viewer` no repo, cruzado com ROADMAP.md/REQUIREMENTS.md):

| Área | Descrição | Selecionada |
|------|-----------|-------------|
| Testes de "papel rejeitado" | 6 testes usam `role: 'viewer'` só como exemplo de papel rejeitado (403/redirect) | ✓ |
| Teste de migration do banco | `tenant-role-migration.test.ts` usa `'viewer'` de propósito p/ provar rejeição pela CHECK constraint | |
| Duplicação do tipo Role | `proxy.ts`/`tenant-switcher.tsx` duplicam a union type ao invés de importar `Role` | |

**Usuário selecionou:** Testes de "papel rejeitado"

As outras duas áreas não foram levadas para discussão — capturadas em CONTEXT.md como Claude's Discretion (não são features novas, são detalhes de implementação de baixo risco).

---

## Testes de "papel rejeitado"

| Option | Description | Selected |
|--------|-------------|----------|
| Sentinel genérico `'invalid_role'` | Troca `'viewer'` por um valor claramente inválido/desconhecido em cada caso. Mantém a cobertura de "papel não reconhecido é rejeitado" sem reintroduzir semântica de papel morto. | ✓ |
| Usar `'none'` (já existe no Role type) | Reaproveita o valor `'none'` já presente na union type. Reduz necessidade de novo sentinel, mas mistura o significado de "sem membership" com "papel desconhecido". | |
| Remover os casos de teste | Deleta os 6 casos que assumiam `'viewer'`. Mais simples, mas perde cobertura explícita de "papel não reconhecido é rejeitado". | |

**User's choice:** Sentinel genérico `'invalid_role'` (recomendado)

**Notes:** Decisão se estende também ao teste de decodificação de JWT em `tests/middleware.test.ts` (`describe('JWT claim extraction ...')`) que usa `'viewer'` apenas como valor de exemplo num payload, sem testar rejeição — aplicado o mesmo sentinel por consistência (Claude inferiu, não foi uma pergunta separada ao usuário).

---

## Claude's Discretion

- `tests/integration/tenant-role-migration.test.ts` — fica a critério do Claude durante o planejamento se está dentro ou fora do escopo de AUTH-07 (é teste de camada de banco/histórica, não de aplicação).
- Duplicação do `Role` type em `proxy.ts` e `tenant-switcher.tsx` — fica a critério do Claude consolidar numa fonte única ou apenas remover `'viewer'` de cada local.
- Comentário obsoleto em `app/api/meta-ads/connect/route.ts:43` — correção mecânica, sem decisão de design envolvida.

## Deferred Ideas

Nenhuma — discussão ficou inteiramente dentro do escopo da phase.
