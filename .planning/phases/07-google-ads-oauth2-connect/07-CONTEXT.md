# Phase 7: Google Ads OAuth2 Connect - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenant Admin (ou Super Admin) conecta uma conta Google Ads ao tenant via fluxo OAuth2 completo (redirect de consentimento no Google), espelhando a UX do fluxo Meta Ads (System User token) já existente na página de Configurações (`SET-02`). O `refresh_token` resultante é armazenado no Supabase Vault (nunca em texto plano, nunca logado), e uma linha `google_ads` é criada/atualizada em `ad_accounts`, consistente com o shape já usado pela linha `meta_ads`.

A sincronização real de dados via Google Ads API (chamadas autenticadas, sync jobs) **não** faz parte desta fase — está fora do escopo e continua bloqueada pelo Google Ads Developer Token (Basic Access), que ainda não foi aprovado. Esta fase entrega apenas o fluxo de conexão/credencial; o código de conexão deve funcionar e ser testável independentemente da aprovação do token.

</domain>

<decisions>
## Implementation Decisions

### Captura do Customer ID
- **D-01:** O Google Ads Customer ID é digitado pelo usuário **antes** do redirect OAuth, no mesmo card/form da Settings page. Ao clicar "Conectar", o Customer ID (junto com o `tenantId`) é embutido no parâmetro `state` do OAuth (assinado — ver D-07), não em sessão server-side. Não há um segundo formulário pós-callback pedindo o Customer ID.

### Validação pós-consentimento (sem Developer Token)
- **D-02:** Nenhuma chamada à Google Ads API (ex: `ListAccessibleCustomers`) é feita para validar o Customer ID ou o token — impossível sem Developer Token aprovado. O fluxo confia inteiramente no sucesso da troca do `authorization code` por `refresh_token`/`access_token` no callback: se a troca funcionar, `ad_accounts.active = true` é setado imediatamente. Isso satisfaz literalmente o critério de sucesso da fase ("ver a conexão refletida como ativa imediatamente").
- Diferença explícita em relação ao Meta: o fluxo Meta valida o token contra a Graph API (`/me` + verificação de permissão na conta de Ads) antes de persistir; o fluxo Google **não tem** esse passo de validação nesta fase, por impossibilidade técnica, não por escolha de design.

### Credencial OAuth Client (Google Cloud)
- **D-03:** Não existe hoje nenhum Google Cloud OAuth Client (tipo Web application, escopo `https://www.googleapis.com/auth/adwords`) para este projeto — confirmado por grep em `.env.local`, código e docs. Isso é tratado como **bloqueio de infraestrutura**, na mesma classe do Google Ads Developer Token (Fase 2) e do N8N System User (Fase 2/3): o código desta fase deve ficar pronto e correto, mas só funciona ao vivo depois que o usuário criar o OAuth Client e configurar `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` como env vars no Vercel (Production + Preview + Development), com a redirect URI exata cadastrada no Console. O planner deve registrar esse item como um Deferred/Blocker explícito, não como uma task bloqueante do plano.
- Nota de research: o Google OAuth App do projeto já está em modo "Production" (não "Testing") segundo `STATE.md` § Resolved Questions — isso evita o bug de refresh_token expirando em 7 dias (Pitfall A6 em `02-RESEARCH.md`), mas essa configuração de projeto é distinta de ter um OAuth Client específico para Ads — confirmar que o Client novo herda esse status de produção do projeto Google Cloud.

### Erros e reconexão
- **D-04:** Consentimento negado no Google, ou callback com erro (`state` inválido/expirado/adulterado), redireciona de volta para `/[tenant-slug]/settings?google_error=...` — a mensagem de erro aparece inline no card do Google Ads, no mesmo estilo visual do bloco de erro (`role="alert"`, fundo `destructive/10`) já usado em `MetaAdsForm`. Sem toast, sem página de erro dedicada.
- **D-05:** Reconectar (trocar a conta Google Ads vinculada ao tenant) **sobrescreve** a linha existente via `upsert` com `onConflict: 'tenant_id,channel'` — mesmo padrão exato do Meta. Sem diálogo de confirmação antes de substituir.
- **D-06:** O campo Customer ID vem **pré-preenchido** com o `account_id` atualmente conectado quando o status é `connected` — espelha o `MetaAdsForm`, que mantém o `accountId` visível após conectar (só o campo de token/segredo é limpo). Isso deixa claro para o usuário o que será substituído ao reconectar.

### Segurança do parâmetro `state`
- **D-07:** O `state` do OAuth (que carrega `tenantId` + `customerId` + proteção CSRF entre o redirect e o callback) é assinado usando uma **nova env var dedicada** (ex: `GOOGLE_OAUTH_STATE_SECRET`) — não reaproveita `SUPABASE_SERVICE_ROLE_KEY` nem nenhum outro segredo existente. Essa env var deve ser adicionada ao Vercel junto com `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`.

### Claude's Discretion
- Formato exato do payload do `state` (JWT assinado vs HMAC simples + base64) e mecanismo de expiração/nonce anti-replay
- Nomenclatura exata das rotas — sugestão já antecipada em `03-CONTEXT.md` D-15: `/api/google-ads/connect` (inicia o redirect) e `/api/google-ads/callback` (troca o code)
- Validação client-side do formato do Customer ID (regex `\d{3}-\d{3}-\d{4}` vs apenas dígitos, normalização de traços antes de enviar)
- Parâmetros exatos da authorization URL do Google (`access_type=offline`, `prompt=consent` — necessários para garantir `refresh_token` em toda reconexão, não só na primeira)
- Estrutura exata do form (React Hook Form + Zod), reaproveitando `Card`/`Input`/`Label`/`Button` já usados no `MetaAdsForm`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/ROADMAP.md` § Phase 7 — goal, success criteria, origem do gap (SET-01)
- `.planning/REQUIREMENTS.md` § Settings — SET-01
- `.planning/v1.0-MILESTONE-AUDIT.md` — confirma que SET-01 é o único requisito não satisfeito do milestone v1.0; Phase 7 existe especificamente para fechá-lo

### Padrão de referência (Meta Ads — SET-02, a ser espelhado)
- `app/api/meta-ads/connect/route.ts` — padrão de auth (getUser → get_user_role RPC → getClaims para escopo de tenant_admin), validação, escrita no Vault (`create_or_update_vault_secret` RPC), upsert em `ad_accounts` com `onConflict: 'tenant_id,channel'`
- `components/settings/meta-ads-form.tsx` — padrão de form (React Hook Form + Zod), badge de status, pré-preenchimento do campo após conectar, bloco de erro inline
- `app/[tenant-slug]/settings/page.tsx` — página onde o card "Google Ads" (atualmente placeholder estático, linhas 159-181) deve ser substituído pelo fluxo real; `ChannelStatusBadge`/`deriveStatus` já leem `ad_accounts.channel = 'google_ads'` e já suportam os 3 estados (`connected`/`not_configured`/`invalid`)
- `.planning/phases/03-dashboard-ui/03-CONTEXT.md` § Settings Page (D-12 a D-16) — decisões já locked: rota acessível por `tenant_admin` E `super_admin`; D-15 antecipa literalmente o redirect para `/api/google-ads/callback`, agora sendo implementado

### Schema e research prévia
- `supabase/migrations/0006_create_ad_accounts.sql` — `ad_accounts.channel` já tem `CHECK IN ('google_ads', 'meta_ads')`; `UNIQUE(tenant_id, channel)`; coluna `refresh_token` (texto plano) é legado e **não deve ser usada** — o comentário do arquivo já instrui mover para Vault, seguir esse padrão (só `vault_secret_id`)
- `.planning/phases/02-data-pipeline/02-RESEARCH.md` — § Padrão de OAuth2 token refresh do Google Ads (linhas ~87-127); § Pitfall A6 (linha 735) sobre modo Testing vs Production do OAuth App

### Env vars e segredos
- `.env.local` — confirmar ausência atual de `GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`/`GOOGLE_OAUTH_STATE_SECRET` (nenhuma existe hoje); adicionar aos exemplos/documentação do projeto quando criadas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/button.tsx` — usados por `MetaAdsForm`, reaproveitar identicamente
- `lib/supabase/server.ts` (`createClient`) e `lib/supabase/service.ts` (`createServiceClient`) — mesmos clients usados pela rota Meta
- `create_or_update_vault_secret` RPC — já existe e testado pelo fluxo Meta; reaproveitar sem alteração
- `get_user_role()` RPC e `getClaims()` (não `getUser().app_metadata`!) — padrão de auth/escopo já estabelecido e obrigatório (ver nota em `app/api/meta-ads/connect/route.ts` linhas 79-88 sobre o bug já documentado de `app_metadata` vs claims)

### Established Patterns
- Node runtime obrigatório (`export const runtime = 'nodejs'`) em rotas que usam `createServiceClient()` ou (agora) `getClaims()`/crypto para assinar o `state`
- Erros nunca expõem detalhes internos ao cliente (mensagens genéricas em pt-BR, detalhe completo só em `console.error` server-side)
- `tenant_admin` só pode agir no próprio tenant (`tenantId` resolvido via `getClaims()`, nunca confiado do body) — `super_admin` pode targetar qualquer tenant

### Integration Points
- `app/[tenant-slug]/settings/page.tsx` — substituir o card estático do Google Ads (linhas 159-181) por um novo componente `GoogleAdsForm` (mirror de `MetaAdsForm`) mais um botão que dispara o redirect OAuth
- Duas novas rotas: `app/api/google-ads/connect/route.ts` (GET, inicia o redirect com `state` assinado) e `app/api/google-ads/callback/route.ts` (GET, troca o code, grava Vault + `ad_accounts`, redireciona de volta)

</code_context>

<specifics>
## Specific Ideas

- "Ver a conexão refletida como ativa imediatamente" (texto literal do critério de sucesso do ROADMAP) — confirma D-02: sem passo de validação bloqueante pós-consentimento
- Tratar a ausência do OAuth Client do Google Cloud como bloqueio de infraestrutura igual ao Developer Token da Fase 2 — não tentar contornar ou mockar

</specifics>

<deferred>
## Deferred Ideas

- Sincronização real de dados via Google Ads API (chamadas autenticadas, sync jobs, workflows N8N) — depende da aprovação do Developer Token, fora do escopo desta fase (é o trabalho da Fase 2, já implementado em código e aguardando o token)
- Validação ativa do Customer ID via `ListAccessibleCustomers` ou qualquer chamada à Google Ads API — impossível sem Developer Token; revisitar quando o token for aprovado
- Botão de "Desconectar" — o fluxo Meta não tem essa funcionalidade hoje; não adicionar assimetricamente só para Google Ads nesta fase
- Suporte a contas MCC (Manager Customer ID / hierarquia de contas Google Ads, header `login-customer-id`) — fora de escopo; v1 assume uma única conta Google Ads por tenant, mesma limitação do Meta (`UNIQUE(tenant_id, channel)`)

### Reviewed Todos (not folded)
Nenhum todo pendente relevante encontrado (`gsd-tools todo match-phase 7` retornou 0 matches).

</deferred>

---

*Phase: 07-google-ads-oauth2-connect*
*Context gathered: 2026-07-11*
