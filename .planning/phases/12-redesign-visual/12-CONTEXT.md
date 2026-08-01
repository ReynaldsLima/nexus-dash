# Phase 12: Redesign Visual - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

As telas principais do dashboard (Overview, Campanhas, Insights, Settings) e o chrome compartilhado (header/sidebar) recebem a nova identidade visual, preservando 100% dos dados, hooks e comportamento existentes (DESIGN-01 a DESIGN-05). É um redesign majoritariamente visual — mudanças de comportamento além de pequenos ajustes de UX são explicitamente fora de escopo (ver REQUIREMENTS.md "Out of Scope").

</domain>

<decisions>
## Implementation Decisions

### Fonte de verdade visual
- **D-01:** `prototipos/nexus-dash.html` é a referência oficial do redesign — não os arquivos separados mais antigos (`dashboard.html`, `campanhas.html`, `insights.html`, `style.css`, todos de 2026-05-17). `nexus-dash.html` é um dia mais recente (2026-05-18), é um arquivo único cobrindo Dashboard + Campanhas + Insights + Leads + Agente num só app shell, e usa a paleta lime (`#c8ff00`) que já é exatamente a `--primary` em produção hoje (`app/globals.css`) — os 4 arquivos antigos usam uma paleta azul/roxo (`#5b8df6`/`#a78bfa`) abandonada. O header/sidebar do `nexus-dash.html` já bate quase exatamente com a estrutura atual do app (mesmas seções "Marketing" e "Leads", mesmos itens de navegação) — confirma que é a iteração que efetivamente "venceu" e chegou a produção.
- Os 4 arquivos antigos (`dashboard.html`, `campanhas.html`, `insights.html`, `style.css`) NÃO devem ser usados como referência de cor/tipografia — só olhar `nexus-dash.html`.

### Configurações (DESIGN-04) — sem protótipo
- **D-02:** Nenhuma das duas gerações de protótipo cobre a tela de Configurações (nenhum item de nav "Configurações"/"Settings" existe em `nexus-dash.html`). Extrapolar os mesmos tokens visuais aplicados a Dashboard/Campanhas/Insights (cores, tipografia, cards, espaçamento, cantos arredondados) para a estrutura atual de `app/[tenant-slug]/settings/page.tsx` — sem protótipo pixel-a-pixel específico para essa tela. Isso inclui restilizar o `BackfillWindowControl` (Phase 11) e os cards de conexão Google/Meta Ads dentro do mesmo sistema visual.

### Estratégia de implementação
- **D-03:** Reskin incremental — manter os componentes shadcn/ui e a estrutura de dados/hooks atuais (`use-dashboard-data.ts`, filtros de Campanhas, streaming de Insights, `fetchTenantSettings`), trocando apenas tokens visuais (cores, fontes, espaçamento, raio de borda, sombras) para bater com `nexus-dash.html`. NÃO reescrever o HTML/CSS de cada tela do zero espelhando o protótipo pixel-a-pixel — risco de regressão maior e contraria a exigência do REQUIREMENTS.md de preservar comportamento/dados existentes.

### Claude's Discretion
- Mapeamento exato de tokens: como os design tokens do `nexus-dash.html` (cores `--bg`/`--card`/`--sidebar`/`--text`/`--accent` inline, fonte, raios `--r-sm`) se traduzem para as CSS variables já existentes em `app/globals.css` (`--background`, `--card`, `--sidebar`, `--primary`, `--radius`) — o app já usa `--primary: #c8ff00` no tema dark, então o trabalho real é auditar onde a paleta/tipografia atual diverge do protótipo (ex: fontes — protótipo usa Plus Jakarta Sans/JetBrains Mono, app atual usa Bricolage/Syne/DM Mono) e decidir manter as fontes já em produção ou adotar as do protótipo.
- Se a página `/tenants` e `/agencies` (fora do escopo de DESIGN-01..05, mas parte do chrome compartilhado via `layout.tsx`) herdam os mesmos tokens de header/sidebar por consequência do reskin, ou ficam intocadas — a fase só exige consistência nas 4 telas listadas em DESIGN-05, mas mudar o chrome compartilhado necessariamente afeta todas as rotas que o usam.
- Ordem de execução entre as 4 telas + chrome — pesquisa/planejamento decide waves.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Protótipo de referência (fonte de verdade)
- `prototipos/nexus-dash.html` — ÚNICA referência visual autoritativa (paleta lime, estrutura de nav, layout das 4 telas + leads/agente). Ler o `<style>` inline completo para os design tokens exatos antes de planejar.

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` §"Redesign Visual" (DESIGN-01 a DESIGN-05) e §"Out of Scope" (linha "Mudanças de comportamento/dados além de pequenos ajustes de UX no redesign")
- `.planning/ROADMAP.md` §"Phase 12: Redesign Visual" — goal e success criteria
- `.planning/PROJECT.md` §"Current Milestone" e §"Context" — menciona que o usuário poderia fornecer prints adicionais; nenhum foi fornecido até o momento desta discussão, `nexus-dash.html` é a referência disponível

### Design tokens atuais do app (para comparação/gap analysis)
- `app/globals.css` — CSS variables atuais (`--primary: #c8ff00` no tema `.dark`, já alinhado com o protótipo; fontes `--font-bricolage`/`--font-dm-mono`/`--font-syne`)
- `app/[tenant-slug]/layout.tsx` — contrato de props (`role`/`tenants`/`tenantId`) para `HeaderActions`/`SidebarNav` que DESIGN-05 exige preservar
- `components/layout/header-actions.tsx`, `components/layout/sidebar-nav.tsx` — componentes atuais do chrome compartilhado a restilizar

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Componentes shadcn/ui já em uso: `Card`, `Badge`, `Button`, `Table`, `Input`, `Select`, `Skeleton`, `Sonner` (toast) — a base estrutural do reskin, não são substituídos.
- `app/globals.css` já tem `--primary: #c8ff00` (tema dark) — a cor de marca do protótipo já está parcialmente adotada; o gap real está em outros tokens (raios, sombras, densidade, talvez tipografia).

### Established Patterns
- 4 telas-alvo: `app/[tenant-slug]/dashboard/page.tsx`, `app/[tenant-slug]/campanhas/page.tsx`, `app/[tenant-slug]/insights/page.tsx`, `app/[tenant-slug]/settings/page.tsx`.
- Chrome compartilhado: `app/[tenant-slug]/layout.tsx` (header + sidebar), consumido por TODAS as rotas sob `[tenant-slug]`, incluindo Leads (fora do escopo formal de DESIGN-01..05 mas visualmente afetado pelo reskin do chrome).
- Settings já recebeu funcionalidade nova na Phase 11 (`BackfillWindowControl`, campo de janela de histórico nos forms de conexão) que ainda está "funcional apenas, sem polimento visual" por design — Phase 12 é explicitamente onde isso é resolvido.

### Integration Points
- `nexus-dash.html`'s sidebar structure (`nav-section` "Marketing": Dashboard/Campanhas/AI Insights; "Leads": Gestão de Leads/Agente IA) já corresponde à estrutura real de `sidebar-nav.tsx` — não precisa de reestruturação de navegação, só de retoque visual.
- `nexus-dash.html` não tem entrada de nav para "Configurações" — ao restilizar o chrome, a entrada "Configurações" (grupo "Conta") já existente em `sidebar-nav.tsx` precisa continuar existindo, só seguindo os mesmos tokens visuais aplicados ao resto.

</code_context>

<specifics>
## Specific Ideas

- A paleta lime (`#c8ff00`) do protótipo `nexus-dash.html` já é a `--primary` real em produção — usada hoje no status "Fechado" dos leads, no botão ativo da aba "Todos", e nos botões "Conectar Google Ads"/"Conectar Meta Ads". O redesign deve reforçar essa identidade já estabelecida, não introduzir uma paleta nova.
- Nenhuma referência visual adicional (prints) foi fornecida pelo usuário nesta discussão, apesar do `PROJECT.md` mencionar essa possibilidade — `nexus-dash.html` é a única fonte visual disponível no momento.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia de escopo novo surgiu durante a discussão — a conversa ficou inteiramente dentro do domínio da fase (qual protótipo seguir, como tratar Settings sem protótipo específico, e a estratégia de implementação).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado com relevância para esta fase (`todo match-phase 12` retornou 0 matches).

</deferred>

---

*Phase: 12-redesign-visual*
*Context gathered: 2026-08-01*
