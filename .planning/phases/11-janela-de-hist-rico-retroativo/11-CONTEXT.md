# Phase 11: Janela de Histórico Retroativo - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenant Admin controla quantos dias de histórico (7–365, default 90) são puxados no primeiro sync de cada conta de anúncio conectada (Google Ads e Meta Ads, por canal, não por tenant), tanto no momento de conectar quanto depois — sem precisar reconectar a conta. A mudança pós-conexão afeta apenas futuros primeiros syncs, nunca é retroativa.

Fora do escopo desta fase (conforme REQUIREMENTS.md "Out of Scope"): re-sync retroativo automático ao mudar a janela, N8N tenant-aware via workflow separado, e qualquer redesign visual das telas de Settings (isso é Phase 12 — esta fase entrega o campo funcional, não a versão final estilizada).

</domain>

<decisions>
## Implementation Decisions

### Campo de input (conexão e edição)
- **D-01:** Number input livre (não select com presets, não slider) — `type="number"`, `min={7}`, `max={365}`, default 90 pré-preenchido. Mesma UX dos campos já existentes em `google-ads-form.tsx`/`meta-ads-form.tsx` (RHF + Zod resolver, `Input` do shadcn).

### Edição pós-conexão
- **D-02:** Controle inline sempre editável ao lado do `ChannelStatusBadge` em `app/[tenant-slug]/settings/page.tsx` — não é um botão "Editar" que revela o campo, nem um dialog separado. O campo de número fica sempre visível; um botão "Salvar" pequeno só aparece/habilita quando o valor muda em relação ao persistido.
- **D-03:** Salvamento otimista com revert — clicar "Salvar" atualiza o valor exibido imediatamente, chama a Server Action (`updateBackfillWindow`, sugerida em `ARCHITECTURE.md`) em background, e reverte para o valor anterior se a Server Action falhar. Mesmo padrão já usado em `lib/leads.ts` (status de leads) e em `components/agencies/agency-tenant-grants.tsx` (checkboxes de grant) — consistente com o resto do app, não introduz um padrão novo.
- **D-04:** Sem diferenciação de estado quando a conta já teve seu primeiro sync — o campo permanece sempre editável, sem consultar `sync_jobs` para saber se a edição seria um no-op. O texto de ajuda fixo (D-05) já cobre a explicação genérica. Evita uma query/join extra na página de settings.

### Comunicação do "não é retroativo"
- **D-05:** Texto de ajuda pequeno, sempre visível abaixo do campo (mesmo estilo do texto "Você será redirecionado ao Google para autorizar o acesso à conta." já usado em `google-ads-form.tsx`) — explica em linguagem simples que mudar a janela só vale para o próximo primeiro sync, não reprocessa dados já sincronizados. Não é tooltip, não aparece só ao salvar.

### Feedback de sucesso/erro ao salvar
- **D-06:** Mensagem inline no card em caso de erro — mesmo padrão visual dos erros OAuth já usados em `GoogleAdsForm` (`role="alert"`, `bg-destructive/10 border-destructive/20 text-destructive`). Em caso de sucesso, nenhuma mensagem adicional — o próprio valor do campo (que já reverteu se tivesse falhado, per D-03) comunica o resultado. Não usa Sonner/toast — mantém Settings sem introduzir um padrão de feedback que hoje só existe em Insights/anomalias.

### Claude's Discretion
- Nome exato do arquivo/local da Server Action (`lib/actions/ad-accounts.ts` novo vs. adicionar a um arquivo de actions existente) — `ARCHITECTURE.md` já sugere `lib/actions/ad-accounts.ts` como opção, pesquisa/planejamento decide.
- Exato texto pt-BR do helper text (D-05) e das mensagens de erro (D-06) — seguir o tom já estabelecido nos `ERROR_MESSAGES` maps existentes.
- Se o campo de edição pós-conexão aparece mesmo quando o canal está `not_configured` (sem conta conectada ainda) ou só quando `connected`/`invalid` — provavelmente só faz sentido quando já existe uma `ad_accounts` row; planner decide o guard exato.
- Validação client-side exata (Zod inline vs. apenas HTML `min`/`max`) — servidor sempre revalida (`backfill_days BETWEEN 7 AND 365` via CHECK constraint + Zod na Server Action/rotas connect), mesmo padrão dos outros campos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquitetura da feature (Feature 3)
- `.planning/research/ARCHITECTURE.md` §"Feature 3 — Configurable backfill window per tenant" (linhas ~150–207) — define o schema (`ad_accounts.backfill_days`, migration `ADD COLUMN ... CHECK (backfill_days BETWEEN 7 AND 365) DEFAULT 90`), o fluxo completo Settings UI → connect routes (`google-ads/connect`, `meta-ads/connect`) → `ad_accounts` → N8N (`google-ads-sync.json`/`meta-ads-sync.json`), e a recomendação de uma Server Action `updateBackfillWindow` para edição pós-conexão. Esta é a referência técnica primária desta fase — planner e researcher devem lê-la por completo antes de detalhar o plano.
- `.planning/research/ARCHITECTURE.md` §"Build Order Across the 4 Features" — confirma que Phase 11 roda antes da Phase 12 (redesign) justamente para o redesign capturar a forma final do campo de backfill em uma única passada.

### Requisitos formais
- `.planning/REQUIREMENTS.md` §"Janela de Histórico Retroativo" (SET-03, SET-04, SET-05) e §"Out of Scope" (linha sobre re-sync retroativo não ser automático)
- `.planning/ROADMAP.md` §"Phase 11: Janela de Histórico Retroativo" — goal e success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/settings/google-ads-form.tsx` e `components/settings/meta-ads-form.tsx` — padrão RHF + `zodResolver` + `zod/v4`, `Input` do shadcn, bloco de erro `role="alert"` com `bg-destructive/10 border-destructive/20 text-destructive`, texto de ajuda `text-xs text-muted-foreground` abaixo de campos. O novo campo `backfillDays` entra nesses mesmos forms para o momento de conexão.
- `app/[tenant-slug]/settings/page.tsx` — `ChannelStatusBadge`, `TenantSettingsData`/`AdAccountStatus` types, `fetchTenantSettings()` (TanStack Query, browser Supabase client). O controle inline de edição pós-conexão (D-02) entra aqui, ao lado do badge existente — precisa estender `AdAccountStatus`/o select de `ad_accounts` para incluir `backfill_days`.
- `lib/leads.ts` (status de leads) e `components/agencies/agency-tenant-grants.tsx` (checkboxes de grant) — padrão de escrita otimista com revert-on-failure a seguir para D-03.
- `lib/google-ads/oauth-state.ts` (`StatePayload`, `signState`/`verifyState`) — precisa ganhar `backfillDays: number` para carregar o valor através do redirect OAuth do Google (Meta não precisa disso, é um POST direto).

### Established Patterns
- Server Actions com `createServiceClient()` (service role) + Zod validation, mirando `lib/actions/tenants.ts`/`lib/actions/agencies.ts` — mesmo padrão para a nova `updateBackfillWindow`.
- Settings page é `'use client'` + TanStack Query com browser Supabase client, não Server Component — RLS garante o isolamento independente da origem client/server.
- Settings será restilizado na Phase 12 — esta fase não deve investir em polimento visual final, só funcional.

### Integration Points
- `app/api/google-ads/connect/route.ts` e `app/api/google-ads/callback/route.ts` — parse/sign/read de `backfillDays` no round-trip OAuth.
- `app/api/meta-ads/connect/route.ts` — parse direto de `backfillDays` no POST body.
- `n8n-workflows/google-ads-sync.json` e `meta-ads-sync.json` — nó `List active accounts` precisa selecionar `backfill_days`; nó `Compute date range` precisa usar o valor por conta em vez da constante global, mantendo a constante como fallback.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual ou exemplo externo específico foi trazido pelo usuário — a discussão focou inteiramente em decisões de UX/mecânica de edição, todas capturadas acima. `ARCHITECTURE.md` já havia resolvido praticamente todas as decisões técnicas (schema, fluxo de dados, arquivos a tocar) antes mesmo da discussão começar.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia de escopo novo surgiu durante a discussão — toda a conversa ficou dentro do domínio da fase (SET-03/04/05).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado com relevância para esta fase (`todo match-phase 11` retornou 0 matches).

</deferred>

---

*Phase: 11-janela-de-hist-rico-retroativo*
*Context gathered: 2026-07-14*
