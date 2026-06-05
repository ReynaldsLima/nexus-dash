# Phase 4: AI Insights - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 04-ai-insights
**Areas discussed:** Streaming vs resposta completa, Alertas de anomalia, Escopo N8N, Insights page wiring

---

## Streaming vs resposta completa

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming token-a-token | Vercel AI SDK streamText. Elimina risco de timeout. | ✓ |
| Resposta completa de uma vez | Mais simples, risco real de timeout em 60s Vercel Hobby. | |

**Botão "Analisar agora" onde?**

| Option | Description | Selected |
|--------|-------------|----------|
| Na página de Insights | Só na /insights. | |
| No dashboard principal | Atalho no /dashboard. | |
| Em ambos | Primário em Insights + atalho no dashboard. | ✓ |

**Persistência:**

| Option | Description | Selected |
|--------|-------------|----------|
| Salvo automaticamente ao término | Sem friccão, histórico imediato. | ✓ |
| Botão de "Salvar" explícito | Controle manual, friccão extra. | |

---

## Alertas de anomalia

**Mecanismo de entrega:**

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Realtime | WebSocket, zero polling, já usado no projeto. | ✓ |
| Polling TanStack Query (30s) | Simples, delay máx 30s. | |
| N8N webhook → Supabase → Realtime | Combina os dois padrões. | |

**UI do alerta:**

| Option | Description | Selected |
|--------|-------------|----------|
| Toast no canto superior | Aparece e desaparece. | |
| Badge no sidebar "Insights" | Persiste até visualizar. | |
| Ambos: toast + badge persistente | Garante que não passe despercebido. | ✓ |

**Quem detecta a anomalia:**

| Option | Description | Selected |
|--------|-------------|----------|
| N8N | Cron compara ROAS 24h vs 24h anteriores, insere na tabela. | ✓ |
| Supabase Trigger SQL | Trigger automático ao inserir dados, mais complexo. | |

---

## Escopo da análise diária N8N

**Quais tenants:**

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os tenants com ad_accounts, 30 dias | Um job, todos os clientes configurados. | ✓ |
| Apenas tenant ativo | Só tenants com Meta conectado. | |

**Escopo do job:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ambos: insights gerais + detecção de anomalia | Um único job, mais eficiente. | ✓ |
| Apenas insights gerais (anomalia em job separado) | Dois crons N8N distintos. | |

**Input para Claude:**

| Option | Description | Selected |
|--------|-------------|----------|
| JSON agregado de métricas | Totais/médias por canal e campanha. Menos tokens. | ✓ |
| Tabela completa raw | Todas as linhas brutas. Muito mais tokens, risco de context overflow. | |

---

## Insights page — wiring dos dados reais

**O que fazer com a página existente:**

| Option | Description | Selected |
|--------|-------------|----------|
| Manter UI, substituir mock por dados reais | Planner substitui MOCK_INSIGHTS por TanStack Query. | ✓ |
| Reescrever do zero | Mais trabalho, sem dependência do mock. | |

**Filtro de tenant:**

| Option | Description | Selected |
|--------|-------------|----------|
| Filtrado pelo tenant ativo | /[tenant-slug]/insights — contexto do tenant. | ✓ |
| Todos os tenants consolidados | Nova rota global, mais complexo. | |

**UX do streaming:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline na página de Insights | Card no topo com texto gerando. Mescla ao histórico. | ✓ |
| Sheet lateral direito | Consistente com CampaignSheet/ChannelSheet. | |

---

## Claude's Discretion

- Prompt template para análise on-demand vs diária
- Schema exato das tabelas `ai_insights` e `anomaly_alerts`
- N8N → Claude: direto via HTTP node ou proxy via Route Handler
- Configuração do canal Supabase Realtime
- Mecanismo de "clear" do badge (visitou a página = viu os alertas)

## Deferred Ideas

- Cross-tenant consolidated view — nova rota/página, fora do escopo
- Email/push notifications — v2, in-app apenas por agora
- Feedback de qualidade do insight (thumbs up/down)
- Drill-down por campanha a partir de um card de insight
