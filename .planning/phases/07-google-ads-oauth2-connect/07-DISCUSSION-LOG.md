# Phase 7: Google Ads OAuth2 Connect - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 07-google-ads-oauth2-connect
**Areas discussed:** Captura do Customer ID, Validação sem Developer Token, Credencial OAuth Client, Erros e reconexão, Pré-preenchimento do Customer ID, Segurança do state OAuth

---

## Captura do Customer ID

| Option | Description | Selected |
|--------|-------------|----------|
| Antes do redirect | Form pede o Customer ID primeiro; embutido no `state` assinado do OAuth; um único passo visível ao usuário | ✓ |
| Depois do callback | Consentimento primeiro, depois um segundo form pós-callback pede o Customer ID | |

**User's choice:** Antes do redirect (recomendado)
**Notes:** Nenhum passo extra de sessão server-side necessário para carregar o Customer ID entre redirect e callback.

---

## Validação pós-consentimento (sem Developer Token)

| Option | Description | Selected |
|--------|-------------|----------|
| Confiar no sucesso do OAuth | `ad_accounts.active = true` imediatamente após troca bem-sucedida do code — nenhuma chamada à Google Ads API | ✓ |
| Tentar validar mesmo assim | Chamada leve à API (ex: ListAccessibleCustomers) tratando erro de dev token ausente como não-bloqueante | |

**User's choice:** Confiar no sucesso do OAuth (recomendado)
**Notes:** Bate com o texto literal do critério de sucesso do ROADMAP ("ver a conexão refletida como ativa imediatamente").

---

## Credencial OAuth Client (Google Cloud)

| Option | Description | Selected |
|--------|-------------|----------|
| Já existe, fornecerei as credenciais | Client já criado/será criado antes da execução; plano assume env vars existirão | |
| Preciso criar agora — bloqueio | Nenhum Client existe hoje; vira item de infraestrutura pendente, como o Developer Token | ✓ |

**User's choice:** Preciso criar agora — tratar como bloqueio
**Notes:** Grep confirmou ausência de `GOOGLE_ADS_CLIENT_ID`/`SECRET` em `.env.local`, código e docs.

---

## Erros e reconexão

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect com erro inline | Volta para `/[tenant-slug]/settings?google_error=...`, mensagem inline no card (mesmo estilo do MetaAdsForm) | ✓ |
| Página de erro dedicada | Rota `/oauth-error` separada | |

**User's choice:** Redirect de volta com erro inline (recomendado)

| Option | Description | Selected |
|--------|-------------|----------|
| Upsert (sobrescreve automaticamente) | `onConflict: 'tenant_id,channel'`, mesmo padrão do Meta, sem confirmação | ✓ |
| Pedir confirmação antes de substituir | Diálogo "Isso vai substituir..." antes do upsert | |

**User's choice:** Sim, upsert (recomendado)

---

## Pré-preenchimento do Customer ID

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, pré-preencher | Campo mostra o `account_id` atual quando status = connected, mirror do MetaAdsForm | ✓ |
| Não, sempre em branco | Campo sempre vazio | |

**User's choice:** Sim, pré-preencher (recomendado)

---

## Segurança do state OAuth

| Option | Description | Selected |
|--------|-------------|----------|
| Nova env var dedicada | `GOOGLE_OAUTH_STATE_SECRET`, isolado de outros segredos | ✓ |
| Deixar a cargo do planner/executor | Reaproveitar segredo existente (ex: SUPABASE_SERVICE_ROLE_KEY) para HMAC | |

**User's choice:** Sim, nova env var dedicada (recomendado)

---

## Claude's Discretion

- Formato exato do payload do `state` (JWT vs HMAC+base64) e mecanismo anti-replay
- Nomenclatura exata das rotas (`/api/google-ads/connect`, `/api/google-ads/callback`)
- Validação client-side do formato do Customer ID
- Parâmetros da authorization URL (`access_type=offline`, `prompt=consent`)
- Estrutura exata do form React Hook Form + Zod

## Deferred Ideas

- Sincronização real via Google Ads API — depende do Developer Token, já é escopo da Fase 2
- Validação ativa do Customer ID via API — impossível sem Developer Token
- Botão de "Desconectar" — não existe no fluxo Meta, não adicionar assimetricamente
- Suporte a contas MCC / hierarquia de contas — fora de escopo, v1 é uma conta por tenant
