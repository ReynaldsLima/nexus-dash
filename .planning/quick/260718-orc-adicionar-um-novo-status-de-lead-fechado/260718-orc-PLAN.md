---
phase: quick
plan: 260718-orc
type: execute
wave: 1
depends_on: []
files_modified: [lib/leads.ts, tests/unit/leads-category.test.ts, "app/[tenant-slug]/leads/page.tsx", "app/[tenant-slug]/leads/agente/page.tsx"]
autonomous: true
requirements: []
must_haves:
  truths:
    - "O dropdown de Status na tabela de Gestão de Leads inclui a opção 'Fechado' junto às opções existentes (Novo Lead, Quente, Negociando, Sem Resposta)"
    - "Selecionar 'Fechado' persiste via PATCH /api/leads/[id]/status sem erro 400 — a rota já valida o enum dinamicamente a partir de CATEGORY_LABELS, sem exigir mudança na rota"
    - "A aba de filtro 'Fechados' na tabela mostra somente leads classificados como fechado"
    - "KPIs, funil de conversão e distribuição contam leads 'Fechado' corretamente (deixam de ficar ausentes das somas assim que a categoria existe)"
    - "O Agente IA (chat de leads) inclui a contagem de leads 'Fechado' no resumo enviado ao Claude"
  artifacts:
    - path: "lib/leads.ts"
      provides: "LeadCategory 'fechado' + classificador cat() + entradas em CATEGORY_LABELS/CATEGORY_COLORS/CATEGORY_BG"
      contains: "fechado"
    - path: "tests/unit/leads-category.test.ts"
      provides: "Cobertura automatizada da nova categoria 'fechado' e regressão das categorias existentes"
    - path: "app/[tenant-slug]/leads/page.tsx"
      provides: "Dropdown, aba de filtro, KPI, funil e distribuição atualizados com 'Fechado'"
      contains: "fechado"
    - path: "app/[tenant-slug]/leads/agente/page.tsx"
      provides: "Resumo enviado ao Agente IA inclui contagem de leads 'Fechado'"
      contains: "fechado"
  key_links:
    - from: "app/[tenant-slug]/leads/page.tsx (StatusDropdown OPTIONS)"
      to: "lib/leads.ts (CATEGORY_LABELS)"
      via: "import { CATEGORY_LABELS } from '@/lib/leads'"
      pattern: "fechado"
    - from: "app/api/leads/[id]/status/route.ts (VALID_STATUSES)"
      to: "lib/leads.ts (CATEGORY_LABELS)"
      via: "Object.values(CATEGORY_LABELS) — já dinâmico, nenhuma mudança de código necessária nesta rota"
      pattern: "CATEGORY_LABELS"
---

<objective>
Adicionar um novo status de lead "Fechado" como quinta categoria de `LeadCategory`, disponível no dropdown de Status da tabela de Gestão de Leads (`/[tenant-slug]/leads`), com classificação automática, contagens de KPI/funil/distribuição e resumo do Agente IA todos consistentes com a nova categoria — seguindo exatamente o mesmo padrão visual/arquitetural das 4 categorias existentes (`novo`, `quente`, `negoc`, `fim`).

Purpose: O usuário precisa marcar leads como "Fechado" (venda concluída) para diferenciar esse desfecho positivo de "Sem Resposta" (desfecho neutro/negativo), que hoje é o único status de "fim de funil" disponível.

Output: `lib/leads.ts` com a nova categoria; `app/[tenant-slug]/leads/page.tsx` com dropdown/aba/KPI/funil/distribuição atualizados; `app/[tenant-slug]/leads/agente/page.tsx` com o resumo de contexto do chat atualizado; teste unitário cobrindo o classificador.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
Estado atual de `lib/leads.ts` (arquivo INTEIRO — é pequeno, é o contrato central que todo o resto consome):

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

export type LeadCategory = 'negoc' | 'quente' | 'novo' | 'fim'

export function cat(s: string): LeadCategory {
  if (!s) return 'novo'
  const v = s.toLowerCase().trim()
  if (['negociando', 'em negociação', 'negoc', 'proposta'].some(k => v.includes(k))) return 'negoc'
  if (['quente', 'interessado', 'agendado', 'reunião'].some(k => v.includes(k))) return 'quente'
  if (['sem resposta', 'encerrado', 'perdido', 'inativo', 'desistiu', 'não tem interesse', 'fim'].some(k => v.includes(k))) return 'fim'
  return 'novo'
}

export const CATEGORY_LABELS: Record<LeadCategory, string> = {
  negoc: 'Negociando',
  quente: 'Quente',
  novo: 'Novo Lead',
  fim: 'Sem Resposta',
}

export const CATEGORY_COLORS: Record<LeadCategory, string> = {
  negoc: 'text-orange-400',
  quente: 'text-emerald-400',
  novo: 'text-blue-400',
  fim: 'text-muted-foreground',
}

export const CATEGORY_BG: Record<LeadCategory, string> = {
  negoc: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  quente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  novo: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  fim: 'bg-muted/40 text-muted-foreground border-border',
}
```

**Descoberta chave (não é preciso mexer na rota de escrita):** `app/api/leads/[id]/status/route.ts` já deriva o enum de validação dinamicamente:
```typescript
const VALID_STATUSES = Object.values(CATEGORY_LABELS) as [string, ...string[]]
const BodySchema = z.object({ tenant: z.string().min(1), status: z.enum(VALID_STATUSES) })
```
Ao adicionar `fechado: 'Fechado'` em `CATEGORY_LABELS`, o valor `'Fechado'` passa a ser automaticamente aceito pela rota PATCH — zero mudança de código nessa rota. Confirmado também que os dados de leads vêm 100% do Google Sheets (sem tabela `leads` no Supabase, sem CHECK constraint, sem migration necessária) — `GET /api/leads` lê a coluna F bruta da planilha e `PATCH .../status` escreve na mesma coluna via `lib/sheets.ts#updateLeadStatus`, que aceita qualquer string.

**Único outro consumidor de `LeadCategory`/`cat()`/`CATEGORY_LABELS` no projeto** (confirmado via grep — nenhum outro arquivo de produção referencia essas exportações): `app/[tenant-slug]/leads/agente/page.tsx`, que monta o system prompt do chat de IA usando as mesmas 4 categorias hardcoded.

Trecho relevante de `app/[tenant-slug]/leads/page.tsx` (o que precisa mudar):
```typescript
function StatusDropdown({ lead, disabled, onChange }: { ... }) {
  const current = cat(lead.status)
  const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fim']
  // ...
}
// stats useMemo: const novo/quente/negoc/fim = leads.filter(l => cat(l.status) === X).length
// TABS: [{key:'all',...}, {key:'novo',...}, {key:'quente',...}, {key:'negoc',...}, {key:'fim',label:'Sem Resposta'}]
// KPI row: grid-cols-2 md:grid-cols-5, 5x <KpiCard> (Total, Novos, Quentes, Negociando, Sem Resposta)
// Funil: 2x <FunnelBar> (Leads Quentes, Em Negociação)
// Distribuição: (['negoc', 'quente', 'novo', 'fim'] as LeadCategory[]).map(...)
```

Trecho relevante de `app/[tenant-slug]/leads/agente/page.tsx` (o que precisa mudar):
```typescript
function buildSystem(leads: Lead[]): string {
  const total = leads.length
  const novo   = leads.filter(l => cat(l.status) === 'novo').length
  const quente = leads.filter(l => cat(l.status) === 'quente').length
  const negoc  = leads.filter(l => cat(l.status) === 'negoc').length
  const fim    = leads.filter(l => cat(l.status) === 'fim').length
  // ...
  return `...
- Novos: ${novo} | Quentes: ${quente} | Negociando: ${negoc} | Sem Resposta: ${fim}
- Taxa de aquecimento: ...
- Taxa de negociação: ...
...`
}
```
A linha por-lead da amostra (`CATEGORY_LABELS[cat(l.status)]`) já é dinâmica e não precisa de mudança — qualquer lead classificado como `'fechado'` já aparecerá como "Fechado" nessa amostra automaticamente assim que Task 1 estiver feita.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Adicionar categoria 'fechado' em lib/leads.ts</name>
  <files>lib/leads.ts, tests/unit/leads-category.test.ts</files>
  <behavior>
    - `cat('Fechado')` → `'fechado'`
    - `cat('Venda Fechada')` → `'fechado'` (variação de texto que a planilha pode conter)
    - `cat('Convertido')` → `'fechado'`
    - `cat('')` → `'novo'` (regressão — fallback padrão inalterado)
    - `cat('Sem Resposta')` → `'fim'` (regressão — nenhuma keyword de 'fechado' colide com as de 'fim')
    - `cat('Negociando')` → `'negoc'` (regressão)
    - `CATEGORY_LABELS.fechado === 'Fechado'`
    - `CATEGORY_BG.fechado` é uma string não-vazia e diferente das outras 4 (nova cor, não reaproveitar orange/emerald/blue/muted já usados)
  </behavior>
  <action>
Criar `tests/unit/leads-category.test.ts` primeiro (RED) com os casos do bloco `<behavior>` acima, importando `cat`, `CATEGORY_LABELS`, `CATEGORY_BG` de `@/lib/leads`. Rodar `npx vitest run tests/unit/leads-category.test.ts` e confirmar falha (categoria 'fechado' ainda não existe).

Depois (GREEN), editar `lib/leads.ts`:
1. `LeadCategory`: adicionar `'fechado'` à union → `'negoc' | 'quente' | 'novo' | 'fim' | 'fechado'`
2. `cat()`: adicionar um novo `if` de classificação para 'fechado' — colocar como PRIMEIRO check (antes de negoc/quente/fim), usando keywords `['fechado', 'fechada', 'venda fechada', 'convertido', 'ganho']`. Nenhuma dessas palavras colide com as keywords já existentes de negoc/quente/fim, então a ordem não quebra nenhum caso de regressão, mas colocar primeiro deixa explícito que "fechado" é um desfecho distinto de "fim" (sem resposta).
3. `CATEGORY_LABELS`: adicionar `fechado: 'Fechado'`
4. `CATEGORY_COLORS`: adicionar `fechado: 'text-violet-400'` (única cor ainda não usada pelas outras 4 categorias)
5. `CATEGORY_BG`: adicionar `fechado: 'bg-violet-500/15 text-violet-400 border-violet-500/25'` (mesmo padrão `bg-{cor}-500/15 text-{cor}-400 border-{cor}-500/25` das outras 3 categorias coloridas)

Rodar os testes novamente e confirmar GREEN.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/leads-category.test.ts</automated>
  </verify>
  <done>Todos os casos do bloco `<behavior>` passam (novos + regressão). `npx tsc --noEmit` não introduz nenhum erro novo relacionado a `lib/leads.ts`.</done>
</task>

<task type="auto">
  <name>Task 2: Expor 'Fechado' na tabela de Gestão de Leads (dropdown, aba, KPI, funil, distribuição)</name>
  <files>app/[tenant-slug]/leads/page.tsx</files>
  <action>
Editar `app/[tenant-slug]/leads/page.tsx` em 6 pontos, todos usando a mesma convenção visual/estrutural já existente para as outras categorias:

1. **`StatusDropdown`**: `const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fechado', 'fim']` (insere 'fechado' entre 'negoc' e 'fim', refletindo a progressão natural do funil: Novo → Quente → Negociando → Fechado, com Sem Resposta como desfecho paralelo).

2. **`stats` useMemo**: adicionar `const fechado = leads.filter(l => cat(l.status) === 'fechado').length` e `const pFechado = total ? Math.round(fechado / total * 100) : 0`, incluindo ambos no objeto retornado (`return { total, novo, quente, negoc, fim, fechado, pQuente, pNegoc, pFechado }`).

3. **`TABS`**: inserir `{ key: 'fechado', label: 'Fechados' }` entre a entrada `negoc` (Negociando) e a entrada `fim` (Sem Resposta).

4. **KPI row**: importar `CheckCircle2` de `lucide-react` (já usado em `app/[tenant-slug]/insights/page.tsx` — ícone da mesma família já presente no bundle). Mudar a grid de `grid grid-cols-2 md:grid-cols-5 gap-3` para `grid grid-cols-2 md:grid-cols-6 gap-3` e adicionar um 6º `<KpiCard label="Fechados" value={stats.fechado} icon={CheckCircle2} color="bg-violet-500/15 text-violet-400" />` após o card "Negociando" e antes de "Sem Resposta".

5. **Funil de Conversão**: adicionar um 3º `<FunnelBar label="Fechados" count={stats.fechado} pct={stats.pFechado} color="bg-violet-500" />` após "Em Negociação".

6. **Distribuição** (lista lateral): mudar `(['negoc', 'quente', 'novo', 'fim'] as LeadCategory[])` para `(['fechado', 'negoc', 'quente', 'novo', 'fim'] as LeadCategory[])`, e no objeto de classe condicional adicionar `'text-violet-400': c === 'fechado'` junto às demais entradas (`'text-orange-400': c === 'negoc'`, etc.).

Não alterar `COLS` (colunas da tabela) nem a lógica de `changeStatus`/`fetch` — já funcionam de forma genérica via `CATEGORY_LABELS[nextCat]` e não são hardcoded por categoria.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('app/[tenant-slug]/leads/page.tsx','utf8'); const need=['fechado','Fechados','CheckCircle2','md:grid-cols-6','pFechado']; const missing=need.filter(k=>!s.includes(k)); if(missing.length) throw new Error('Faltando em page.tsx: '+missing.join(', ')); console.log('OK: page.tsx wired for fechado');"</automated>
  </verify>
  <done>Dropdown, aba, KPI (6 cards), funil (3 barras) e distribuição exibem "Fechado" de forma consistente com as demais categorias. `npx tsc --noEmit` clean. `npm run build` compila sem erros.</done>
</task>

<task type="auto">
  <name>Task 3: Incluir contagem de 'Fechado' no resumo do Agente IA</name>
  <files>app/[tenant-slug]/leads/agente/page.tsx</files>
  <action>
Editar `buildSystem()` em `app/[tenant-slug]/leads/agente/page.tsx`:
1. Adicionar `const fechado = leads.filter(l => cat(l.status) === 'fechado').length` junto às demais contagens (`novo`, `quente`, `negoc`, `fim`).
2. Atualizar a linha de resumo no template string de `- Novos: ${novo} | Quentes: ${quente} | Negociando: ${negoc} | Sem Resposta: ${fim}` para `- Novos: ${novo} | Quentes: ${quente} | Negociando: ${negoc} | Fechados: ${fechado} | Sem Resposta: ${fim}`.
3. Adicionar uma nova linha de taxa logo após "Taxa de negociação": `- Taxa de conversão (fechados): ${total ? Math.round(fechado / total * 100) : 0}%`.

Não alterar a linha por-lead da amostra (`CATEGORY_LABELS[cat(l.status)]`) — já é dinâmica e vai exibir "Fechado" automaticamente para leads classificados assim, sem mudança de código.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('app/[tenant-slug]/leads/agente/page.tsx','utf8'); const need=[\"=== 'fechado'\",'Fechados: ','Taxa de conversão']; const missing=need.filter(k=>!s.includes(k)); if(missing.length) throw new Error('Faltando em agente/page.tsx: '+missing.join(', ')); console.log('OK: agente/page.tsx wired for fechado');"</automated>
  </verify>
  <done>O system prompt enviado ao Claude no chat de leads inclui a contagem e a taxa de conversão de leads "Fechado". `npx tsc --noEmit` clean.</done>
</task>

</tasks>

<verification>
- `npx vitest run tests/unit/leads-category.test.ts` — todos os casos (novos + regressão) passam.
- `npm test` (suíte completa) — zero regressões nos 3 arquivos de teste de rotas de leads existentes (`leads-status-route.test.ts`, `leads-get-route.test.ts`, `leads-chat-route.test.ts`), que usam `'Quente'` como status de exemplo e não são afetados pela adição de `'fechado'`.
- `npx tsc --noEmit` clean (nenhum erro novo introduzido).
- `npm run build` compila sem erros.
- Inspeção manual (opcional, não bloqueante): abrir `/[tenant-slug]/leads`, confirmar que o dropdown de Status de qualquer linha mostra "Fechado" como opção, selecioná-la persiste (PATCH 200) e o card/aba/funil "Fechados" refletem a contagem.
</verification>

<success_criteria>
- `lib/leads.ts` exporta `LeadCategory` com 5 valores (`novo`, `quente`, `negoc`, `fechado`, `fim`), `cat()` classifica texto contendo "fechado"/"convertido"/"ganho" como `'fechado'`, e `CATEGORY_LABELS`/`CATEGORY_COLORS`/`CATEGORY_BG` têm entrada `fechado` seguindo a mesma convenção de nomenclatura/estilo das demais.
- `PATCH /api/leads/[id]/status` aceita `status: 'Fechado'` sem nenhuma mudança de código na rota (validação dinâmica via `Object.values(CATEGORY_LABELS)`).
- A tabela de Gestão de Leads (dropdown, aba de filtro, KPI, funil, distribuição) trata "Fechado" como uma categoria de primeira classe, idêntica em tratamento às 4 categorias pré-existentes.
- O Agente IA de leads inclui "Fechado" no contexto que envia ao Claude.
- Nenhuma migration de banco de dados foi necessária (confirmado: leads são 100% Google Sheets, sem tabela/CHECK constraint no Supabase).
</success_criteria>

<output>
After completion, create `.planning/quick/260718-orc-adicionar-um-novo-status-de-lead-fechado/260718-orc-SUMMARY.md`
</output>
