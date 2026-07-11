# Phase 6: Security & Consistency — Leads Endpoints - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar dois achados do audit do milestone v1.0 (`.planning/v1.0-MILESTONE-AUDIT.md`, 2026-07-10):

1. **Finding F3 (integração):** `app/api/leads/chat/route.ts` + `app/[tenant-slug]/leads/agente/page.tsx` ("Agente IA") estão totalmente funcionais e wireados, mas **não commitados** (untracked no git) e **sem nenhum escopo de segurança** — só checam `if (!user)`, sem papel, sem tenant/agency scope, sem rate limit. Proxy aberto para a Claude API na chave compartilhada do projeto.
2. **AGENCY-08 parcial:** `GET /api/leads` depende só de RLS implícita; não segue o padrão explícito (`getClaims()` + checagem de papel/tenant/agency) que `PATCH /api/leads/[id]/status` já estabeleceu na Fase 5.

Esta discussão cobre COMO fechar esses dois achados — não adiciona capacidades novas ao produto.

</domain>

<decisions>
## Implementation Decisions

### Agente IA — manter ou remover
- **D-01:** Manter o chat "Agente IA" com hardening, em vez de remover. Já estava no escopo original planejado da Fase 03.1 (`03.1-CONTEXT.md` linha 11: "Agente de IA em chat... para análise dos leads carregados") mas nunca entrou em nenhum `PLAN.md` formal daquela fase — por isso ficou implementado (2026-05-17, fora do fluxo GSD) e nunca commitado nem protegido. Feature considerada válida e útil pelo usuário, não uma peça a descartar.

### Rate limiting do chat
- **D-02:** Contador em memória (ex.: `Map` por `user_id`, janela deslizante) dentro do próprio Route Handler. Sem dependência nova, sem infra externa (Upstash/Redis rejeitado — overhead desnecessário para 1-3 tenants com poucos usuários autenticados; Vercel Firewall rejeitado — incerteza sobre disponibilidade no Hobby tier).
- **D-03:** Limite: **20 mensagens / 5 minutos por usuário** (por `user_id`, não por tenant — o objetivo é impedir um único usuário de esgotar a chave compartilhada da Anthropic, não limitar um tenant inteiro).
- **Limitação aceita conscientemente:** contador em memória não é compartilhado entre instâncias serverless nem sobrevive a cold start. Aceitável dado o volume real (1-3 tenants, usuários autenticados conhecidos, não é endpoint público) — não é o padrão para um rate limiter "correto" em escala, é o padrão pragmático para este projeto.

### Escopo de autorização do chat
- **D-04:** Espelhar **exatamente** o padrão de `PATCH /api/leads/[id]/status` (`app/api/leads/[id]/status/route.ts`):
  - Mesmos 3 papéis permitidos: `super_admin`, `tenant_admin`, `agency` (via `get_user_role()` RPC — 403 se outro papel ou RPC falhar).
  - Tenant/agency scope verificado via `auth.getClaims()` (**nunca** `getUser().app_metadata`, que fica vazio para usuários criados via `admin.createUser()` — bug já documentado e corrigido em `.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md`).
  - Para `tenant_admin`: `callerAppMetadata.tenant_slug` deve bater com o `tenant` do body.
  - Para `agency`: lookup em `agency_tenants` (join com `tenants.slug`) confirmando grant para o tenant pedido.
  - `super_admin`: sem checagem adicional.
- **D-05:** O body do `POST /api/leads/chat` passa a exigir um campo `tenant` explícito (string, igual ao `PATCH` já exige) — a rota nunca deve confiar apenas nos `leads` que o client já buscou e enviou no `system` prompt para decidir o que é permitido.

### Padronização da chamada à Claude API
- **D-06:** Migrar `app/api/leads/chat/route.ts` de `fetch` raw para `@anthropic-ai/sdk`/`ai` SDK, reusando `lib/ai/anthropic.ts` (`MODEL_ID`/`insightModel`), o mesmo padrão já usado em `/api/insights/generate` (Fase 4). Aproveitando que o arquivo já será tocado para o hardening — sem custo extra, já que a dependência já está instalada (`@ai-sdk/anthropic@^4.0.12`, `ai@^7.0.22`).

### GET /api/leads (fecha AGENCY-08)
- **D-07:** Aplicar o mesmo padrão explícito do `PATCH` (role gate via `get_user_role()` + `getClaims()` tenant/agency check) em vez de confiar só na RLS implícita atual. Prescrito literalmente pelo próprio `ROADMAP.md` ("matching the pattern PATCH already uses") — sem ambiguidade real, usuário confirmou que não precisa de mais discussão sobre este ponto.

### Limpeza de arquivos não commitados
- **D-08:** Após o hardening, commitar `app/api/leads/chat/route.ts` + `app/[tenant-slug]/leads/agente/page.tsx` como parte do trabalho desta fase — nenhum arquivo sob `app/api/leads/` ou `app/[tenant-slug]/leads/` deve permanecer untracked ao final (critério de sucesso 3 do ROADMAP).
- **Fora de escopo (não mexer nesta fase):** `supabase/migrations/0012_add_google_sheets_to_tenants.sql` também aparece como untracked no `git status`, mas está fora dos paths que o ROADMAP desta fase cobre (`app/api/leads/`, `app/[tenant-slug]/leads/`). Não é um achado do audit desta fase — deixar como está, é debt pré-existente não relacionado.

### Claude's Discretion
- Estrutura exata do módulo de rate limiting em memória (nome do arquivo, se fica em `lib/` para reuso futuro por outras rotas) — detalhe de implementação.
- Mensagem de erro exibida no chat quando o rate limit é excedido (HTTP 429) — copy exata em pt-BR, seguindo o tom já usado no resto do app (ex.: mensagens de erro de `PATCH /api/leads/[id]/status`).
- Se o rate limit precisa de `export const runtime = 'nodejs'` como o `PATCH` (que precisa por causa da assinatura RS256 do JWT) — o chat também usa `getClaims()`, então provavelmente sim; planner/executor confirma.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Origem do gap (audit)
- `.planning/v1.0-MILESTONE-AUDIT.md` — Finding F3 (linhas 55-56, 169) e AGENCY-08 parcial (linhas 47-53, 137, 161-163) são a origem literal desta fase.
- `.planning/REQUIREMENTS.md` (linha com `AGENCY-08`) — texto exato do requirement e status "Partial".

### Padrão a espelhar (fonte de verdade para a implementação)
- `app/api/leads/[id]/status/route.ts` — a rota `PATCH` inteira é o modelo: ordem dos checks (validar input → auth → role gate → validar body → tenant/agency scope via `getClaims()` → service client para credencial sensível → ação → resposta). Replicar a mesma estrutura de checks (steps 2-5) em `POST /api/leads/chat` e `GET /api/leads`.
- `.planning/debug/resolved/agency-app-metadata-getuser-mismatch.md` — por que `getClaims()` e não `getUser().app_metadata`. Erro já cometido uma vez no projeto; não repetir.

### Arquivos a modificar (não commitados / a proteger)
- `app/api/leads/chat/route.ts` — POST, hoje proxy aberto (`fetch` raw + `if (!user)` apenas). Precisa: role gate, tenant/agency scope, rate limit, migração para SDK.
- `app/[tenant-slug]/leads/agente/page.tsx` — client component do chat. Precisa passar `tenant: slug` no body do POST (D-05).
- `app/api/leads/route.ts` — GET, hoje só valida `tenant` param + `if (!user)`, sem role/tenant-scope explícito. Precisa: role gate + `getClaims()` scope, mesmo padrão do PATCH.

### Padrão de SDK (Fase 4)
- `lib/ai/anthropic.ts` — `MODEL_ID = 'claude-sonnet-4-6'` e `insightModel` (instância `@ai-sdk/anthropic`), a reusar em vez de `fetch` raw.
- `app/api/insights/generate/route.ts` — exemplo de rota que já usa `streamText` do `ai` SDK com esse mesmo model — referência de estilo para a migração do chat (D-06).

### Escopo original da feature (contexto histórico)
- `.planning/phases/03.1-leads-management-via-google-sheets-integration/03.1-CONTEXT.md` — linha 11 (chat estava no domain boundary original), linha 36 (fetch raw vs SDK ficou "Claude's Discretion", agora resolvido por D-06), linhas 53-58 (lista de arquivos "já implementados, formalizar e estender" — inclui o chat).

### Schema/RLS relevante (sem mudança nesta fase, só leitura)
- `supabase/migrations/0018_*` (ou equivalente) — política `tenants_agency_select` que hoje protege `GET /api/leads` implicitamente; permanece como defesa em profundidade mesmo depois do check explícito ser adicionado (não remover RLS).
- `agency_tenants` — tabela de grant N:N usada no lookup do papel `agency` (mesma já usada pelo PATCH).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Todo o bloco de auth/scope do `PATCH /api/leads/[id]/status` (steps 2-5, linhas 35-96) é copiável quase literalmente para `GET /api/leads` e `POST /api/leads/chat` — mesma lógica de papel + `getClaims()` + `agency_tenants` lookup, só muda o que vem depois (ação de leitura/chat em vez de escrita na planilha).
- `lib/ai/anthropic.ts` (`MODEL_ID`, `insightModel`) — pronto para reuso no chat, elimina a duplicação do model id hardcoded (`'claude-sonnet-4-6'` hoje está duplicado em `app/api/leads/chat/route.ts` linha 23).

### Established Patterns
- Toda rota de API sob `app/api/` que faz check de tenant/agency usa `auth.getClaims()`, nunca `getUser().app_metadata` — regra dura do projeto desde o bugfix de Fase 5.
- Rotas que precisam de `getClaims()` (assinatura RS256) declaram `export const runtime = 'nodejs'` no topo (ver `status/route.ts` linha 9) — Edge runtime não roda o módulo `crypto` necessário.
- Erros de negócio retornam `NextResponse.json({ error: '...' }, { status: N })` com mensagens em pt-BR — manter esse tom no chat e no GET também.

### Integration Points
- `app/[tenant-slug]/leads/agente/page.tsx` já busca `leads` via `GET /api/leads?tenant=${slug}` antes de montar o chat — nenhuma mudança de fluxo de dados necessária, só adicionar `tenant: slug` no body do POST para `/api/leads/chat`.
- Nenhuma migration de banco necessária nesta fase — só mudanças de código nos 3 arquivos listados acima.

</code_context>

<specifics>
## Specific Ideas

- O rate limit é por usuário (`user_id`), não por tenant — a preocupação real é abuso da chave compartilhada da Anthropic por uma única conta, não limitar volume de uso de um tenant inteiro.
- 20 mensagens / 5 minutos por usuário é o valor concreto escolhido (não "genérico, ajustar depois").

</specifics>

<deferred>
## Deferred Ideas

- `supabase/migrations/0012_add_google_sheets_to_tenants.sql` está untracked no git, mas fora do escopo desta fase (não é sob `app/api/leads/` nem `app/[tenant-slug]/leads/`, e não é um achado do audit desta fase). Não mexer aqui — se virar um problema, é uma fase/tarefa própria.
- Rate limiting distribuído (Upstash/Redis) ou regra no Vercel Firewall — considerado e rejeitado para v1 (D-02) por overhead desnecessário dado o volume real. Reavaliar se o produto crescer além de poucos tenants/usuários ou se o contador em memória se mostrar insuficiente na prática.

### Reviewed Todos (not folded)
Nenhum todo pendente relacionado a esta fase (`todo match-phase 6` retornou 0 matches).

</deferred>

---

*Phase: 06-security-consistency-leads-endpoints*
*Context gathered: 2026-07-11*
