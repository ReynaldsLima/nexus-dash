# Quick Task 260731-qzz: Adicionar 4 novos status de lead - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Task Boundary

Adicionar 4 novos status de lead — "Desqualificado por região", "Quantidade de Vidas", "Pessoa Física", "Engano" — ao sistema de categorização de leads (`lib/leads.ts`), seguindo o mesmo padrão de integração usado quando o status "Fechado" foi adicionado anteriormente (commits `2e4d032`, `d7903a8`, `1bdd638` — ver `.planning/quick/260718-orc-adicionar-um-novo-status-de-lead-fechado/260718-orc-SUMMARY.md` como referência de pontos de integração).

</domain>

<decisions>
## Implementation Decisions

### Categorização (KPI / Funil)
- Os 4 novos status viram **4 LeadCategory de topo completas**, cada uma com seu próprio card KPI e sua própria barra no funil de conversão — mesmo tratamento dado ao "Fechado". Não são agrupados num bucket único "Desqualificado".

### Cor dos badges
- Os 4 compartilham **uma única cor neutra** (não uma cor distinta cada) para sinalizar visualmente "não vai converter" sem exigir 4 cores novas de memorizar. Sugestão de implementação: uma família de cor ainda não usada pelas categorias existentes (negoc=orange, quente=emerald, novo=blue, fim=muted-gray, fechado=lime #B5E701) — ex. rose/red, aplicada às 4 (`text-rose-400` / `bg-rose-500/15 text-rose-400 border-rose-500/25` ou equivalente). O executor pode ajustar o tom exato desde que seja uma única cor neutra compartilhada pelas 4.

### Abas de filtro
- **Não** criar novas abas na barra de filtro do topo (Todos, Novos, Quentes, Negociando, Sem Resposta). Os 4 novos status aparecem apenas no dropdown de Status, nos KPI cards, na barra de funil e na lista de distribuição — mesmo tratamento que "Fechado" recebeu (que também não virou aba).

### Claude's Discretion
- Nomes exatos das chaves internas (`LeadCategory` slugs) para os 4 novos valores — ex. algo como `desq_regiao`, `qtd_vidas`, `pessoa_fisica`, `engano` — desde que a classificação por palavra-chave em `cat()` reconheça variações razoáveis do texto vindo da planilha (mesmo padrão de `.some(k => v.includes(k))` já usado).
- Se `cat()` precisa de novas palavras-chave de match para cada um (provavelmente sim, já que essas strings não existem nas regras atuais).
- Ordem de exibição no dropdown/funil/distribuição relativa às categorias existentes.

</decisions>

<specifics>
## Specific Ideas

Os 4 novos valores literais fornecidos pelo usuário (labels exibidas, devem bater exatamente):
- "Desqualificado por região"
- "Quantidade de Vidas"
- "Pessoa Física"
- "Engano"

Estes soam como contexto de seguros de saúde (o mock mostrado pelo usuário era da coluna "Produto: Plano de Saúde") — motivos pelos quais um lead não avança: fora da região atendida, número de vidas (funcionários/dependentes) fora do perfil, é pessoa física quando o produto é B2B (ou vice-versa), ou contato feito por engano/número errado.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260718-orc-adicionar-um-novo-status-de-lead-fechado/260718-orc-SUMMARY.md` — resumo do padrão de integração usado pro "Fechado": todos os pontos de código que precisam mudar (lib/leads.ts, app/[tenant-slug]/leads/page.tsx, app/[tenant-slug]/leads/agente/page.tsx)
- `.planning/quick/260731-...` (este mesmo diretório) — fast task subsequente que trocou a cor do "Fechado" para `#B5E701`, ilustrando como cores são aplicadas via Tailwind arbitrary values (`text-[#HEX]`, `bg-[#HEX]/15`, `border-[#HEX]/25`)

</canonical_refs>
