# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-12
**Phases:** 10 | **Plans:** 46 | **Timeline:** 63 dias (2026-05-10 → 2026-07-11)

### What Was Built
- Autenticação multi-tenant com RLS total (Super Admin / Cliente / Agência)
- Sincronização automática Google Ads + Meta Ads via N8N
- Dashboard com KPIs, trends, breakdown por canal e drill-down, campanhas filtráveis
- Gestão de Leads com escrita bidirecional no Google Sheets
- Insights de IA (Claude) sob demanda, diários (N8N) e detecção de anomalias de ROAS
- Módulo Agência multi-cliente (grant N:N) + hardening de segurança nos endpoints de leads + conexão Google Ads via OAuth2

### What Worked
- Padrão Wave 0 (TDD RED com `it.todo()` scaffolds) antes da implementação real reduziu retrabalho e deixou o contrato executável explícito antes do código de produção existir (usado nas Fases 4, 5, 6, 7).
- UAT manual ao vivo via Playwright MCP contra produção (não só `npm run dev` local) pegou um bug bloqueante real na Fase 5 (`getUser().app_metadata` vs `getClaims()`) que testes automatizados sozinhos não capturariam — virou padrão para fases subsequentes.
- Reuso de padrões entre módulos similares (Agência espelhando Tenant, Google Ads OAuth2 espelhando Meta Ads System User) manteve a velocidade de execução alta sem perder consistência de código.
- Threat models por fase (`<threat_model>` nos PLAN.md) pegaram riscos reais antes da execução — especialmente valioso na Fase 8, onde a limpeza de dados de produção teve checkpoint humano + delete escopado por PK congelada, evitando perda de dados real.

### What Was Inefficient
- Bookkeeping (REQUIREMENTS.md, PROJECT.md) ficou defasado em relação ao código real por várias fases — Fases 3 (DASH/CAMP) e 1 (AUTH) foram implementadas e verificadas mas nunca tiveam os checkboxes/traceability corrigidos até a Fase 8 (tech debt) fechar isso retroativamente. Lição: corrigir REQUIREMENTS.md no momento da conclusão da fase, não deixar acumular.
- Descoberta tardia de que o Auth Hook do Supabase estava ligado à Edge Function errada (não à função Postgres que as migrations mantinham) — só apareceu na Fase 5 via debug, apesar de estar "errado" desde antes. Lição: verificar configuração de infraestrutura externa (Dashboard settings) explicitamente na Fase 0/1, não assumir que migrations sozinhas garantem o estado runtime.
- Múltiplos blockers externos (Google Ads Developer Token, ANTHROPIC_API_KEY na Vercel, Google Cloud OAuth Client) ficaram represados até o fim do milestone ao invés de serem resolvidos no momento em que bloquearam a fase original — fizeram vários itens ficarem "código-completo mas não verificado ao vivo".

### Patterns Established
- `getClaims()` é a única fonte confiável de role/tenant/agency — `getUser().app_metadata` é proibido para qualquer papel não-super_admin (regra gravada em STATE.md, violação real encontrada e corrigida na Fase 5).
- Column-level Postgres grants importam tanto quanto RLS — uma coluna sensível nova numa tabela com RLS permissiva de linha ainda vaza por padrão a menos que seja revogada por coluna (achado da Fase 03.1, código review).
- Server Actions seguem sempre o mesmo esqueleto (Zod validation → `createServiceClient()` → operação → `revalidatePath`) — replicado em tenants, agencies, leads sem desvio.
- N8N nunca usa o node nativo `n8n-nodes-base.supabase` (bug conhecido #17020) — sempre HTTP Request + PostgREST.

### Key Lessons
1. Rodar `/gsd-audit-milestone` perto do fim do milestone pega bookkeeping drift que nenhuma fase individual notaria sozinha — foi o que originou a Fase 8.
2. Checkpoints humanos bloqueantes (`autonomous: false`) valem o atrito quando a ação é destrutiva e irreversível (delete em produção) — o padrão enumerar→congelar→confirmar→deletar por PK evitou qualquer risco real na Fase 8.
3. Threat models por fase, mesmo em fases de "só documentação", têm valor — a Fase 8 tinha 2 de 7 threats sobre acurácia de bookkeeping, não sobre segurança tradicional, e ainda assim valeram a auditoria.

### Cost Observations
- Model mix: planner em `opus`, executor/checker/verifier em `sonnet` (perfil `balanced`)
- Notable: fases de "gap closure" (6, 7, 8) tiveram ciclos de plan→check→execute mais rápidos que fases greenfield (1-5), já que o escopo já vinha isolado por auditorias anteriores

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 10 | 46 | Primeiro milestone — estabeleceu padrões de Wave 0 TDD, UAT ao vivo via Playwright, threat models por fase, e o ciclo audit-milestone → gap-closure-phases |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.0 | 231 passed / 1 skipped / 5 todo (29 arquivos) | Não medido formalmente (sem cobertura de linha configurada) | `google-auth-library` (Sheets write-back), `ai`/`@ai-sdk/anthropic` (streaming), Sonner (toasts), `@base-ui/react/checkbox` |

### Top Lessons (Verified Across Milestones)

1. `getClaims()` > `getUser().app_metadata` para qualquer decisão de autorização não-super_admin — regressão real encontrada e corrigida, deve ser checada em qualquer fase futura que toque autenticação/roles.
2. Bookkeeping de REQUIREMENTS.md/PROJECT.md precisa ser corrigido no momento da conclusão de cada fase — deixar acumular gera uma fase de tech-debt inteira só para bookkeeping.
