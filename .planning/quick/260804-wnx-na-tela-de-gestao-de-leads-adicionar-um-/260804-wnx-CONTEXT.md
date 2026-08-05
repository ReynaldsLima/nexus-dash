# Quick Task 260804-wnx: Na tela de Gestão de Leads, adicionar um botão de download/exportação de todos os leads - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Task Boundary

Adicionar um botão na tela de Gestão de Leads (`app/[tenant-slug]/leads/page.tsx`) que baixa os leads atualmente visíveis como um arquivo CSV.

</domain>

<decisions>
## Implementation Decisions

### Formato do arquivo
- CSV. Sem dependência nova — geração client-side simples, abre em Excel/Sheets.

### Escopo dos dados exportados
- Respeita os filtros/busca ativos na tela no momento do clique (categoria selecionada na pill-track + texto de busca). Se o usuário filtrou por "Quentes" ou buscou um nome, o CSV reflete exatamente a lista visível — não o dataset completo não filtrado.

### Colunas incluídas
- Mesmas colunas já exibidas na tabela: Nome, Empresa, Produto, Status, Criado em, Resp., Telefone. Não inclui e-mail (não exibido na UI hoje, fora de escopo desta task).

### Claude's Discretion
- Nome do arquivo baixado (ex: `leads-{tenant}-{data}.csv`).
- Tratamento de escaping CSV (vírgulas/aspas em nomes de empresa, etc.) e ordenação do arquivo exportado (deve seguir a mesma ordenação — criado em, mais novo primeiro — já aplicada na tela, ver `compareByCriadoEm` em `lib/leads.ts`).
- Posição/estilo do botão na UI (deve seguir o design system do Phase 12 — mono/mesma linguagem visual dos outros controles da tela).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
