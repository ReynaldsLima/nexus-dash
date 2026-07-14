# Phase 11: Janela de Histórico Retroativo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisões são capturadas em CONTEXT.md — este log preserva as alternativas consideradas.

**Date:** 2026-07-14
**Phase:** 11-janela-de-hist-rico-retroativo
**Areas discussed:** Tipo de campo de input, Mecânica da edição pós-conexão, Comunicação do "não é retroativo", Campo depois do primeiro sync já ter ocorrido, Padrão de salvamento, Feedback de sucesso/erro ao salvar

---

## Tipo de campo de input

| Option | Description | Selected |
|--------|-------------|----------|
| Number input livre | Input type=number simples, min=7 max=365, default 90 pré-preenchido — mesma UX dos campos existentes | ✓ |
| Select com presets + "outro" | Dropdown com opções comuns (7/30/90/180/365) + "Personalizado" | |
| Slider | Slider de 7 a 365 dias, componente shadcn novo | |

**User's choice:** Number input livre
**Notes:** Mantém consistência com os campos Customer ID / Account ID já existentes nos forms de settings.

---

## Mecânica da edição pós-conexão

| Option | Description | Selected |
|--------|-------------|----------|
| Inline sempre editável | Campo já visível ao lado do ChannelStatusBadge, sempre editável, botão "Salvar" só aparece quando o valor muda | ✓ |
| Botão "Editar" que revela o campo | Card mostra valor como texto + botão editar; clicar revela input | |
| Dialog separado | Bot��o abre modal dedicado com o aviso de não-retroatividade dentro | |

**User's choice:** Inline sempre editável
**Notes:** Menos cliques, prioriza fricção baixa sobre limpeza visual do card.

---

## Comunicação do "não é retroativo"

| Option | Description | Selected |
|--------|-------------|----------|
| Texto de ajuda sempre visível | Linha de texto pequeno abaixo do campo, sempre presente (mesmo estilo do texto já usado em GoogleAdsForm) | ✓ |
| Só aparece ao salvar uma mudança | Toast/nota inline só no momento de salvar edição em conta já conectada | |
| Tooltip/ícone de informação | Ícone (i) que revela a explicação ao interagir | |

**User's choice:** Texto de ajuda sempre visível
**Notes:** Prioriza clareza permanente sobre economia de espaço visual.

---

## Campo depois do primeiro sync já ter ocorrido

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar editável sem diferenciar | Não verifica sync_jobs; campo sempre editável, texto de ajuda genérico já cobre a explicação | ✓ |
| Avisar quando for no-op | Consulta sync_jobs; mostra nota adicional quando a edição não teria efeito prático | |

**User's choice:** Deixar editável sem diferenciar
**Notes:** Evita query/join extra na página de settings; simplicidade sobre precisão.

---

## Padrão de salvamento

| Option | Description | Selected |
|--------|-------------|----------|
| Otimista com revert | Atualiza a UI na hora, reverte se falhar — mesmo padrão de leads/agency grants | ✓ |
| Bloqueante | Loading state, só atualiza após confirmação do servidor | |

**User's choice:** Otimista com revert
**Notes:** Consistência com padrões já estabelecidos no app (lib/leads.ts, agency-tenant-grants.tsx).

---

## Feedback de sucesso/erro ao salvar

| Option | Description | Selected |
|--------|-------------|----------|
| Mensagem inline no card | Mesmo padrão dos erros OAuth do GoogleAdsForm; sucesso sem mensagem adicional | ✓ |
| Toast (Sonner) | Já instalado (Insights/anomalias), mas nunca usado em Settings | |
| Sem feedback explícito | Só o valor do campo (revertido se falhar) comunica o resultado | |

**User's choice:** Mensagem inline no card
**Notes:** Mantém Settings sem introduzir um padrão de feedback novo (toast) que hoje só existe em Insights.

---

## Claude's Discretion

- Local exato da Server Action (`lib/actions/ad-accounts.ts` novo vs. arquivo existente)
- Texto pt-BR exato do helper text e das mensagens de erro
- Guard de quando exibir o controle de edição (`not_configured` vs. `connected`/`invalid`)
- Validação client-side exata (Zod inline vs. HTML min/max)

## Deferred Ideas

Nenhuma — a discussão ficou inteiramente dentro do domínio da fase (SET-03/04/05).
