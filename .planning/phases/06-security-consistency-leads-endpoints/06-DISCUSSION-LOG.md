# Phase 6: Security & Consistency — Leads Endpoints - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 06-security-consistency-leads-endpoints
**Areas discussed:** Agente IA (manter ou remover), Rate limiting do chat, Escopo de autorização do chat, Padronização SDK

---

## Agente IA — manter ou remover

| Option | Description | Selected |
|--------|-------------|----------|
| Manter e endurecer | Já estava no escopo original da Fase 03.1; feature funcional e útil; aplicar padrão de segurança do PATCH + rate limit e commitar | ✓ |
| Remover completamente | Apagar route.ts + página agente/, sem nav; reconsiderar depois como fase própria | |

**User's choice:** Manter e endurecer.
**Notes:** Motivação central: o chat já estava listado no domain boundary da Fase 03.1 (`03.1-CONTEXT.md`), mas nunca entrou em um PLAN.md formal — não é scope creep, é formalização de algo já pretendido.

---

## Rate limiting do chat — mecanismo

| Option | Description | Selected |
|--------|-------------|----------|
| Contador em memória | Map por user_id, janela deslizante, zero dependência nova, zero infra externa; imprecisão entre instâncias serverless aceitável dado o volume (1-3 tenants) | ✓ |
| Upstash Redis (@upstash/ratelimit) | Rate limit distribuído correto; custo: nova dependência + serviço externo a provisionar | |
| Vercel Firewall (regra no dashboard) | Sem código; risco de exigir plano Pro (Hobby tier hoje) | |

**User's choice:** Contador em memória.
**Notes:** Sem infra de rate limit existente no projeto hoje (confirmado via grep). Free/Hobby tier é constraint do CLAUDE.md.

---

## Rate limiting do chat — limite específico

| Option | Description | Selected |
|--------|-------------|----------|
| 20 mensagens / 5 minutos por usuário | Generoso para conversa real, corta abuso/loop rapidamente; por user_id não por tenant | ✓ |
| 10 mensagens / minuto por usuário | Mais restritivo | |
| Outro valor | Usuário descreveria valor exato | |

**User's choice:** 20 mensagens / 5 minutos por usuário.

---

## Escopo de autorização do chat

| Option | Description | Selected |
|--------|-------------|----------|
| Espelhar o PATCH exatamente | Mesmos 3 papéis (super_admin/tenant_admin/agency) via get_user_role(), getClaims() para tenant/agency scope, agency_tenants lookup; body passa a exigir campo `tenant` | ✓ |
| Só checar autenticação (manter como está) | if(!user) apenas; não fecha o Finding F3 | |

**User's choice:** Espelhar o PATCH exatamente.

---

## Padronização da chamada à Claude API

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, padronizar com @anthropic-ai/sdk | Reusa lib/ai/anthropic.ts (MODEL_ID/insightModel), consistente com /api/insights/generate; dependência já instalada | ✓ |
| Não, manter fetch raw | Já estava marcado "Claude decide" na Fase 03.1; opção de não mexer além do hardening | |

**User's choice:** Sim, padronizar com o SDK.

---

## Claude's Discretion

- Estrutura exata do módulo de rate limiting em memória (nome/localização do arquivo).
- Copy exata da mensagem de erro 429 do chat.
- Se `export const runtime = 'nodejs'` é necessário no chat (provavelmente sim, dado uso de `getClaims()`).

## Deferred Ideas

- Rate limiting distribuído (Upstash/Vercel Firewall) — reavaliar se o volume crescer.
- `supabase/migrations/0012_add_google_sheets_to_tenants.sql` untracked — fora de escopo desta fase, debt pré-existente não relacionado.
