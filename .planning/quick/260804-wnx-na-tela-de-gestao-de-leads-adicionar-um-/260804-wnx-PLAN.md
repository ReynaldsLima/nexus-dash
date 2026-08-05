---
phase: quick-260804-wnx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/leads-csv.ts
  - tests/unit/leads-csv.test.ts
  - app/[tenant-slug]/leads/page.tsx
autonomous: true
requirements: [QUICK-260804-wnx]

must_haves:
  truths:
    - "Um botão 'Exportar CSV' aparece na barra de filtros da tela de Gestão de Leads"
    - "Clicar no botão baixa um arquivo .csv com os leads atualmente visíveis (filtro de categoria + busca aplicados)"
    - "O CSV tem as mesmas 7 colunas da tabela (Nome, Empresa, Produto, Status, Criado em, Resp., Telefone) e a mesma ordenação da tela"
    - "Nomes/empresas com vírgula, ponto-e-vírgula, aspas ou quebra de linha não corrompem o arquivo"
    - "O arquivo abre corretamente no Excel pt-BR e no Google Sheets, com acentos íntegros"
    - "O botão fica desabilitado quando a lista filtrada está vazia"
  artifacts:
    - path: "lib/leads-csv.ts"
      provides: "Funções puras de geração de CSV a partir de Lead[]"
      exports: ["LEADS_CSV_HEADERS", "escapeCsvField", "leadsToCsv", "buildLeadsCsvFilename"]
      min_lines: 40
    - path: "tests/unit/leads-csv.test.ts"
      provides: "Cobertura unitária de escaping, colunas, ordem e nome do arquivo"
      min_lines: 60
    - path: "app/[tenant-slug]/leads/page.tsx"
      provides: "Botão de exportação + download via Blob"
      contains: "leadsToCsv"
  key_links:
    - from: "app/[tenant-slug]/leads/page.tsx"
      to: "lib/leads-csv.ts"
      via: "import { leadsToCsv, buildLeadsCsvFilename }"
      pattern: "from '@/lib/leads-csv'"
    - from: "handleExport em page.tsx"
      to: "o array `filtered` (não `leads`)"
      via: "leadsToCsv(filtered)"
      pattern: "leadsToCsv\\(filtered\\)"
---

<objective>
Adicionar um botão de exportação CSV na tela de Gestão de Leads que baixa exatamente os leads
visíveis na tabela no momento do clique.

Purpose: hoje não há como tirar os leads da tela para trabalhar em planilha. O usuário filtra
por categoria/busca e precisa levar aquele recorte para o Excel/Sheets.
Output: `lib/leads-csv.ts` (lógica pura testada), `tests/unit/leads-csv.test.ts`, e o botão
"Exportar CSV" na barra de filtros de `app/[tenant-slug]/leads/page.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260804-wnx-na-tela-de-gestao-de-leads-adicionar-um-/260804-wnx-CONTEXT.md
@lib/leads.ts
@app/[tenant-slug]/leads/page.tsx
@tests/unit/leads-sort.test.ts
</context>

<interfaces>
<!-- Contratos que o executor precisa. Extraídos do código atual — não explorar o repo. -->

De `lib/leads.ts` (já existe, NÃO modificar):
```typescript
export interface Lead {
  id: number
  nome: string
  telefone: string
  email: string
  empresa: string
  criado_em: string
  status: string
  hora_resposta: string
  tipo_seguro: string
}
export type LeadCategory = 'negoc' | 'quente' | 'novo' | 'fim' | 'fechado'
  | 'desq_regiao' | 'qtd_vidas' | 'pessoa_fisica' | 'engano'
export function cat(s: string): LeadCategory
export const CATEGORY_LABELS: Record<LeadCategory, string>
export function compareByCriadoEm(a: Lead, b: Lead, asc: boolean): number
```

De `app/[tenant-slug]/leads/page.tsx` (estado já existente no componente):
```typescript
const slug = params['tenant-slug'] as string
const [search, setSearch] = useState('')
const [filter, setFilter] = useState<LeadCategory | 'all'>('all')
const [sortKey, setSortKey] = useState<keyof Lead>('criado_em')
const [sortAsc, setSortAsc] = useState(false)
// `filtered` é o useMemo que já aplica filtro + busca + ordenação (linhas ~129-142).
// É EXATAMENTE o array renderizado na tabela — é ele que deve ser exportado.
const filtered = useMemo(() => { /* ... */ }, [leads, search, filter, sortKey, sortAsc])
```

Mapeamento coluna da tabela -> campo do Lead (linhas 194-201 e 326-338 de page.tsx):
| Cabeçalho CSV | Origem |
|---------------|--------|
| Nome      | `lead.nome` |
| Empresa   | `lead.empresa` |
| Produto   | `lead.tipo_seguro` |
| Status    | `CATEGORY_LABELS[cat(lead.status)]` (a tabela mostra o rótulo normalizado do dropdown, não o texto cru da planilha) |
| Criado em | `lead.criado_em` |
| Resp.     | `lead.hora_resposta` |
| Telefone  | `lead.telefone` |

Ambiente de teste: vitest, `environment: 'node'`, `globals: true`, alias `@/` ativo
(vite-tsconfig-paths). Funções puras — nenhum mock/DOM necessário.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Criar lib/leads-csv.ts com geração e escaping de CSV (TDD)</name>
  <files>lib/leads-csv.ts, tests/unit/leads-csv.test.ts</files>

  <behavior>
Escrever `tests/unit/leads-csv.test.ts` PRIMEIRO (deve falhar), reusando o helper
`makeLead(overrides: Partial<Lead>): Lead` no mesmo formato de `tests/unit/leads-sort.test.ts`.

`escapeCsvField(value: string): string`
  - Test 1: string simples sem caracteres especiais -> retornada sem aspas (`'Ana'` -> `'Ana'`)
  - Test 2: campo com `;` -> envolvido em aspas duplas (`'A;B'` -> `'"A;B"'`)
  - Test 3: campo com `,` -> envolvido em aspas duplas
  - Test 4: campo com `"` -> aspas internas duplicadas E campo envolvido (`'Diz "oi"'` -> `'"Diz ""oi"""'`)
  - Test 5: campo com `\n` -> envolvido em aspas duplas, quebra preservada dentro do campo
  - Test 6: `''`, `null`, `undefined` -> retornam `''` (string vazia, sem aspas)
  - Test 7 (formula injection): campo começando com `=`, `+`, `-` ou `@` recebe prefixo `'`
    e é envolvido em aspas (`'=SUM(A1)'` -> `'"\'=SUM(A1)"'`)

`leadsToCsv(leads: Lead[]): string`
  - Test 8: primeira linha é exatamente `Nome;Empresa;Produto;Status;Criado em;Resp.;Telefone`
  - Test 9: começa com BOM UTF-8 (`﻿`) — sem ele o Excel corrompe acentos (José -> JosÃ©)
  - Test 10: linhas separadas por `\r\n` (RFC 4180); array vazio produz só BOM + cabeçalho
  - Test 11: a coluna Status traz o rótulo normalizado — um lead com `status: 'em negociação'`
    exporta `Negociando` (via `CATEGORY_LABELS[cat(status)]`), não o texto cru
  - Test 12: campos vazios exportam string vazia, NÃO o `—` que a UI usa como placeholder
  - Test 13 (ordem preservada): dado `[leadB, leadA]` na ordem recebida, o CSV mantém
    exatamente essa ordem — a função NÃO reordena (quem ordena é a tela)
  - Test 14: as 7 colunas saem na ordem do cabeçalho, mapeadas conforme a tabela de
    `<interfaces>` (Produto = `tipo_seguro`, Resp. = `hora_resposta`)

`buildLeadsCsvFilename(slug: string, date: Date): string`
  - Test 15: `buildLeadsCsvFilename('acme', new Date(2026, 7, 4))` -> `'leads-acme-2026-08-04.csv'`
    (data LOCAL, não UTC — usar getFullYear/getMonth/getDate, com zero-padding)
  </behavior>

  <action>
Depois que os testes falharem (RED), criar `lib/leads-csv.ts` com:

1. `export const CSV_DELIMITER = ';'` — Excel em locale pt-BR interpreta `,` como separador
   decimal e joga a linha inteira numa única coluna. O `;` é o separador que o Excel pt-BR e o
   Google Sheets (auto-detect) abrem corretamente. A decisão do usuário foi "CSV que abre em
   Excel/Sheets"; delimitador ficou na discricionariedade do Claude (ver CONTEXT.md).

2. `export const LEADS_CSV_HEADERS = ['Nome','Empresa','Produto','Status','Criado em','Resp.','Telefone'] as const`

3. `export function escapeCsvField(value: string | null | undefined): string`
   - normaliza null/undefined para `''`
   - se o primeiro caractere for `= + - @ \t \r`, prefixa com `'` (mitigação T-wnx-01,
     CSV formula injection; o Excel/Sheets tratam a aspa simples inicial como marcador de
     texto e NÃO a exibem na célula)
   - duplica cada `"` interna
   - envolve em `"` se o valor contiver `;`, `,`, `"`, `\n`, `\r` OU se recebeu o prefixo `'`
   - caso contrário devolve o valor cru

4. `export function leadsToCsv(leads: Lead[]): string`
   - importa `cat` e `CATEGORY_LABELS` de `@/lib/leads`
   - monta as linhas na ordem recebida (SEM reordenar), aplicando `escapeCsvField` em cada célula
   - junta células com `CSV_DELIMITER` e linhas com `\r\n`
   - prefixa o resultado com `'﻿'`

5. `export function buildLeadsCsvFilename(slug: string, date: Date): string`
   - `leads-${slug}-${YYYY}-${MM}-${DD}.csv` com componentes locais zero-padded

Sem dependências novas — apenas string manipulation. Rodar os testes até GREEN.
  </action>

  <verify>
    <automated>npm test -- tests/unit/leads-csv.test.ts</automated>
  </verify>

  <done>
`npm test -- tests/unit/leads-csv.test.ts` passa com os 15 casos verdes. `lib/leads-csv.ts`
exporta `LEADS_CSV_HEADERS`, `escapeCsvField`, `leadsToCsv`, `buildLeadsCsvFilename`.
`lib/leads.ts` permanece intocado.
  </done>
</task>

<task type="auto">
  <name>Task 2: Adicionar o botão "Exportar CSV" na barra de filtros da tela de leads</name>
  <files>app/[tenant-slug]/leads/page.tsx</files>

  <action>
1. Imports:
   - adicionar `Download` à lista existente de ícones de `lucide-react` (linha 5)
   - nova linha: `import { leadsToCsv, buildLeadsCsvFilename } from '@/lib/leads-csv'`

2. Dentro do componente `LeadsPage`, logo após o `useMemo` de `filtered` (por volta da linha 142),
   adicionar o handler de download:

```tsx
function handleExport() {
  if (filtered.length === 0) return
  const csv = leadsToCsv(filtered)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = buildLeadsCsvFilename(slug, new Date())
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

   `filtered` (não `leads`) é o array exportado — ele já carrega o filtro de categoria, a busca
   e a ordenação exibidas, satisfazendo a decisão travada do CONTEXT.md.

3. Inserir o botão na barra de filtros, DENTRO do
   `<div className="flex items-center gap-2 ml-auto min-w-0">` (linha ~283), imediatamente APÓS
   o `<span>{filtered.length} result.</span>`:

```tsx
<button
  type="button"
  onClick={handleExport}
  disabled={filtered.length === 0}
  title="Baixar os leads visíveis em CSV"
  aria-label="Exportar leads filtrados em CSV"
  className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary disabled:hover:text-muted-foreground"
>
  <Download className="size-3.5" aria-hidden="true" />
  Exportar CSV
</button>
```

   Nota de design: esta tela ainda NÃO recebeu o redesign do Phase 12 (usa `bg-sidebar-primary`,
   `rounded-xl`, tokens antigos). O estilo acima segue a linguagem visual JÁ presente neste
   arquivo (botões pequenos `rounded-md`, `text-muted-foreground` -> `hover:text-foreground`)
   somada à convenção mono dos controles secundários de `app/[tenant-slug]/campanhas/page.tsx`
   (`font-mono text-[11px]`, `border border-border bg-secondary`). NÃO usar `.btn-accent` — é a
   classe de CTA primária, e este é um controle secundário; usá-la competiria visualmente com o
   botão "Agente IA" do cabeçalho.

4. Não alterar mais nada: `filtered`, `toggleSort`, `changeStatus` e a tabela ficam intactos.
  </action>

  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "leads/page|leads-csv" || echo "OK: nenhum erro de tipo nos arquivos tocados"</automated>
  </verify>

  <done>
`app/[tenant-slug]/leads/page.tsx` importa de `@/lib/leads-csv`, chama `leadsToCsv(filtered)`, e
renderiza o botão "Exportar CSV" na barra de filtros. `npx tsc --noEmit` não reporta erro novo em
`app/[tenant-slug]/leads/page.tsx` nem em `lib/leads-csv.ts` (o repo tem erros pré-existentes em
outros arquivos — ver `deferred-items.md` do Phase 05; ignorar os que não são destes dois arquivos).
`npm run lint` sem novos warnings.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Google Sheets -> API -> browser -> arquivo CSV | Os campos do lead (nome, empresa, telefone) são texto livre digitado por terceiros na planilha; atravessam a app sem sanitização e acabam num arquivo que o usuário abre numa aplicação de planilha (Excel/Sheets), que é um motor de execução de fórmulas. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wnx-01 | Tampering / Elevation | `escapeCsvField` em `lib/leads-csv.ts` | mitigate | CSV formula injection: um lead com `nome = "=HYPERLINK(...)"` viraria fórmula executável ao abrir no Excel. Prefixar com `'` todo campo iniciado por `= + - @ \t \r` e envolvê-lo em aspas (Task 1, item 3). Mesma classe de risco já tratada no code review do Phase 03.1 (WR-01, Sheets formula injection). |
| T-wnx-02 | Information Disclosure | `handleExport` em `page.tsx` | accept | O CSV só contém dados que o usuário já vê renderizados na tabela, servidos pela rota `/api/leads` que já aplica o gate de auth/tenant do Phase 06 (AGENCY-08). A exportação não amplia o escopo de leitura — nenhuma coluna nova (e-mail continua fora, por decisão do CONTEXT.md). |
| T-wnx-03 | Denial of Service | geração client-side do CSV | accept | A rota retorna no máximo 500 leads (limite já documentado no cabeçalho da tela). Concatenar ~500 linhas de string na thread principal é instantâneo; não justifica Web Worker nem streaming. |
</threat_model>

<verification>
1. `npm test -- tests/unit/leads-csv.test.ts` — 15 casos verdes.
2. `npm test` — suíte completa sem regressão (em especial `tests/unit/leads-sort.test.ts` e
   `tests/unit/leads-category.test.ts`, que compartilham `lib/leads.ts`).
3. `npm run lint` — sem novos warnings.
4. `npx tsc --noEmit` — sem erros novos em `lib/leads-csv.ts` ou `app/[tenant-slug]/leads/page.tsx`.
5. Verificação manual (opcional, não bloqueante): `npm run dev`, abrir `/{tenant}/leads`, filtrar
   por "Quentes", buscar um termo, clicar em "Exportar CSV" — o arquivo baixado deve conter apenas
   as linhas visíveis, na mesma ordem, e abrir com colunas separadas e acentos corretos.
</verification>

<success_criteria>
- [ ] `lib/leads-csv.ts` existe com as 4 exportações e zero dependências novas
- [ ] `tests/unit/leads-csv.test.ts` cobre escaping (`; , " \n`), BOM, CRLF, ordem preservada,
      Status normalizado, campos vazios, formula injection e nome do arquivo — todos verdes
- [ ] Botão "Exportar CSV" visível na barra de filtros, desabilitado com lista vazia
- [ ] O download usa `filtered` (respeita filtro de categoria + busca + ordenação da tela)
- [ ] Colunas exatamente: Nome, Empresa, Produto, Status, Criado em, Resp., Telefone (sem e-mail)
- [ ] `npm test` e `npm run lint` sem regressão
</success_criteria>

<output>
Ao concluir, criar `.planning/quick/260804-wnx-na-tela-de-gestao-de-leads-adicionar-um-/260804-wnx-SUMMARY.md`
</output>
