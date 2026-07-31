---
phase: quick
plan: 260731-qzz
type: execute
wave: 1
depends_on: []
files_modified: [lib/leads.ts, tests/unit/leads-category.test.ts, "app/[tenant-slug]/leads/page.tsx", "app/[tenant-slug]/leads/agente/page.tsx"]
autonomous: true
requirements: []
must_haves:
  truths:
    - "O dropdown de Status na tabela de Gestão de Leads inclui as 4 novas opções (Desqualificado por região, Quantidade de Vidas, Pessoa Física, Engano) junto às 5 já existentes (Novo Lead, Quente, Negociando, Fechado, Sem Resposta)"
    - "Selecionar qualquer uma das 4 novas opções persiste via PATCH /api/leads/[id]/status sem erro 400 — a rota já valida o enum dinamicamente a partir de CATEGORY_LABELS, sem exigir mudança na rota"
    - "KPIs mostram um card dedicado para cada uma das 4 novas categorias, com a mesma cor neutra compartilhada (rose) entre elas"
    - "O funil de conversão mostra uma barra dedicada para cada uma das 4 novas categorias"
    - "A lista de Distribuição mostra uma entrada para cada uma das 4 novas categorias"
    - "Nenhuma nova aba foi criada na barra de filtro do topo (Todos/Novos/Quentes/Negociando/Fechados/Sem Resposta permanece inalterada)"
    - "O Agente IA (chat de leads) inclui a contagem das 4 novas categorias no resumo enviado ao Claude"
  artifacts:
    - path: "lib/leads.ts"
      provides: "LeadCategory com 4 novos valores (desq_regiao, qtd_vidas, pessoa_fisica, engano) + classificador cat() com novas keywords + entradas em CATEGORY_LABELS/CATEGORY_COLORS/CATEGORY_BG usando uma única cor rose compartilhada"
      contains: "desq_regiao"
    - path: "tests/unit/leads-category.test.ts"
      provides: "Cobertura automatizada das 4 novas categorias + regressão das 5 categorias existentes (incluindo 'fechado', adicionada na task anterior)"
    - path: "app/[tenant-slug]/leads/page.tsx"
      provides: "Dropdown, KPI (10 cards), funil (7 barras) e distribuição atualizados com as 4 novas categorias — TABS inalterado por decisão do usuário"
      contains: "desq_regiao"
    - path: "app/[tenant-slug]/leads/agente/page.tsx"
      provides: "Resumo enviado ao Agente IA inclui contagem das 4 novas categorias de desqualificação"
      contains: "desq_regiao"
  key_links:
    - from: "app/[tenant-slug]/leads/page.tsx (StatusDropdown OPTIONS)"
      to: "lib/leads.ts (CATEGORY_LABELS)"
      via: "import { CATEGORY_LABELS } from '@/lib/leads'"
      pattern: "desq_regiao"
    - from: "app/api/leads/[id]/status/route.ts (VALID_STATUSES)"
      to: "lib/leads.ts (CATEGORY_LABELS)"
      via: "Object.values(CATEGORY_LABELS) — já dinâmico, nenhuma mudança de código necessária nesta rota (mesma descoberta da task anterior)"
      pattern: "CATEGORY_LABELS"
---

<objective>
Adicionar 4 novos status de lead — "Desqualificado por região" (`desq_regiao`), "Quantidade de Vidas" (`qtd_vidas`), "Pessoa Física" (`pessoa_fisica`) e "Engano" (`engano`) — como 4 novas `LeadCategory` de topo completas (cada uma com seu próprio card KPI e sua própria barra de funil), compartilhando uma única cor neutra (rose) para sinalizar visualmente "não vai converter" sem exigir 4 cores novas — seguindo exatamente o mesmo padrão de integração usado quando "Fechado" foi adicionado anteriormente (`.planning/quick/260718-orc-adicionar-um-novo-status-de-lead-fechado/260718-orc-SUMMARY.md`).

Purpose: O usuário precisa distinguir os motivos específicos pelos quais um lead não avança (fora da área atendida, número de vidas fora do perfil, pessoa física em produto B2B, ou contato feito por engano) em vez de agrupá-los todos no genérico "Sem Resposta".

Output: `lib/leads.ts` com as 4 novas categorias; `tests/unit/leads-category.test.ts` estendido; `app/[tenant-slug]/leads/page.tsx` com dropdown/KPI/funil/distribuição atualizados (SEM nova aba de filtro); `app/[tenant-slug]/leads/agente/page.tsx` com o resumo de contexto do chat atualizado.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260731-qzz-adicionar-4-novos-status-de-lead-desqual/260731-qzz-CONTEXT.md

<interfaces>
Estado ATUAL de `lib/leads.ts` (arquivo inteiro — contrato central que todo o resto consome; já inclui `fechado` de uma task anterior):

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

export function cat(s: string): LeadCategory {
  if (!s) return 'novo'
  const v = s.toLowerCase().trim()
  if (['fechado', 'fechada', 'venda fechada', 'convertido', 'ganho'].some(k => v.includes(k))) return 'fechado'
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
  fechado: 'Fechado',
}

export const CATEGORY_COLORS: Record<LeadCategory, string> = {
  negoc: 'text-orange-400',
  quente: 'text-emerald-400',
  novo: 'text-blue-400',
  fim: 'text-muted-foreground',
  fechado: 'text-[#B5E701]',
}

export const CATEGORY_BG: Record<LeadCategory, string> = {
  negoc: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  quente: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  novo: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  fim: 'bg-muted/40 text-muted-foreground border-border',
  fechado: 'bg-[#B5E701]/15 text-[#B5E701] border-[#B5E701]/25',
}
```

**Descoberta chave, confirmada na task anterior (não é preciso mexer na rota de escrita):** `app/api/leads/[id]/status/route.ts` deriva o enum de validação dinamicamente via `Object.values(CATEGORY_LABELS)`. Ao adicionar as 4 novas entradas em `CATEGORY_LABELS`, seus labels passam a ser automaticamente aceitos pela rota PATCH — zero mudança de código nessa rota. Leads vêm 100% do Google Sheets (sem tabela `leads`/CHECK constraint no Supabase) — nenhuma migration necessária.

**Único outro consumidor de `LeadCategory`/`cat()`/`CATEGORY_LABELS`/`CATEGORY_BG` no projeto** (mesma descoberta via grep da task anterior — nenhum outro arquivo de produção referencia essas exportações): `app/[tenant-slug]/leads/agente/page.tsx`.

Trechos ATUAIS relevantes de `app/[tenant-slug]/leads/page.tsx` (o que precisa mudar):
```typescript
function StatusDropdown({ lead, disabled, onChange }: { ... }) {
  const current = cat(lead.status)
  const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fechado', 'fim']
  // ...
}

// stats useMemo (linha ~104):
const stats = useMemo(() => {
  const total = leads.length
  const novo  = leads.filter(l => cat(l.status) === 'novo').length
  const quente = leads.filter(l => cat(l.status) === 'quente').length
  const negoc  = leads.filter(l => cat(l.status) === 'negoc').length
  const fim    = leads.filter(l => cat(l.status) === 'fim').length
  const fechado = leads.filter(l => cat(l.status) === 'fechado').length
  const pQuente = total ? Math.round(quente / total * 100) : 0
  const pNegoc  = total ? Math.round(negoc / total * 100) : 0
  const pFechado = total ? Math.round(fechado / total * 100) : 0
  return { total, novo, quente, negoc, fim, fechado, pQuente, pNegoc, pFechado }
}, [leads])

// TABS (NÃO MEXER — decisão do usuário: sem novas abas):
const TABS: { key: LeadCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'novo', label: 'Novos' },
  { key: 'quente', label: 'Quentes' },
  { key: 'negoc', label: 'Negociando' },
  { key: 'fechado', label: 'Fechados' },
  { key: 'fim', label: 'Sem Resposta' },
]

// KPI row (linha ~229):
<div className="grid grid-cols-2 md:grid-cols-6 gap-3">
  <KpiCard label="Total" value={stats.total} icon={Users} color="bg-blue-500/15 text-blue-400" />
  <KpiCard label="Novos" value={stats.novo} icon={TrendingUp} color="bg-sky-500/15 text-sky-400" />
  <KpiCard label="Quentes" value={stats.quente} icon={Flame} color="bg-emerald-500/15 text-emerald-400" />
  <KpiCard label="Negociando" value={stats.negoc} icon={Handshake} color="bg-orange-500/15 text-orange-400" />
  <KpiCard label="Fechados" value={stats.fechado} icon={CheckCircle2} color="bg-[#B5E701]/15 text-[#B5E701]" />
  <KpiCard label="Sem Resposta" value={stats.fim} icon={PhoneOff} color="bg-muted/60 text-muted-foreground" />
</div>

// Funil (linha ~326):
<FunnelBar label="Leads Quentes" count={stats.quente} pct={stats.pQuente} color="bg-emerald-500" />
<FunnelBar label="Em Negociação" count={stats.negoc} pct={stats.pNegoc} color="bg-orange-500" />
<FunnelBar label="Fechados" count={stats.fechado} pct={stats.pFechado} color="bg-[#B5E701]" />

// Distribuição (linha ~335):
{(['fechado', 'negoc', 'quente', 'novo', 'fim'] as LeadCategory[]).map(c => {
  const count = leads.filter(l => cat(l.status) === c).length
  return (
    <div key={c} ...>
      <span ...>{CATEGORY_LABELS[c]}</span>
      <span className={cn('text-xs font-semibold font-mono', {
        'text-[#B5E701]': c === 'fechado',
        'text-orange-400': c === 'negoc',
        'text-emerald-400': c === 'quente',
        'text-blue-400': c === 'novo',
        'text-muted-foreground': c === 'fim',
      })}>{count}</span>
    </div>
  )
})}
```

Trecho ATUAL relevante de `app/[tenant-slug]/leads/agente/page.tsx`:
```typescript
function buildSystem(leads: Lead[]): string {
  const total = leads.length
  const novo   = leads.filter(l => cat(l.status) === 'novo').length
  const quente = leads.filter(l => cat(l.status) === 'quente').length
  const negoc  = leads.filter(l => cat(l.status) === 'negoc').length
  const fim    = leads.filter(l => cat(l.status) === 'fim').length
  const fechado = leads.filter(l => cat(l.status) === 'fechado').length
  // ...
  return `...
- Novos: ${novo} | Quentes: ${quente} | Negociando: ${negoc} | Fechados: ${fechado} | Sem Resposta: ${fim}
- Taxa de aquecimento: ...
- Taxa de negociação: ...
- Taxa de conversão (fechados): ...
...`
}
```
A linha por-lead da amostra (`CATEGORY_LABELS[cat(l.status)]`) já é dinâmica e não precisa de mudança.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Adicionar as 4 novas categorias em lib/leads.ts</name>
  <files>lib/leads.ts, tests/unit/leads-category.test.ts</files>
  <behavior>
    - `cat('Desqualificado por região')` retorna `'desq_regiao'`
    - `cat('Fora da região')` retorna `'desq_regiao'` (variação de texto)
    - `cat('Quantidade de Vidas')` retorna `'qtd_vidas'`
    - `cat('Vidas fora do perfil')` retorna `'qtd_vidas'` (variação de texto)
    - `cat('Pessoa Física')` retorna `'pessoa_fisica'`
    - `cat('Engano')` retorna `'engano'`
    - `cat('Contato errado')` retorna `'engano'` (variação de texto)
    - regressão: `cat('Fechado')` continua retornando `'fechado'` (adicionada na task anterior, não pode quebrar)
    - regressão: `cat('Sem Resposta')` continua retornando `'fim'` (nenhuma keyword nova colide)
    - regressão: `cat('Negociando')` continua retornando `'negoc'`
    - regressão: `cat('')` continua retornando `'novo'`
    - `CATEGORY_LABELS.desq_regiao` é exatamente `'Desqualificado por região'`
    - `CATEGORY_LABELS.qtd_vidas` é exatamente `'Quantidade de Vidas'`
    - `CATEGORY_LABELS.pessoa_fisica` é exatamente `'Pessoa Física'`
    - `CATEGORY_LABELS.engano` é exatamente `'Engano'`
    - `CATEGORY_BG.desq_regiao`, `CATEGORY_BG.qtd_vidas`, `CATEGORY_BG.pessoa_fisica` e `CATEGORY_BG.engano` são todos IGUAIS entre si (as 4 compartilham a MESMA cor — decisão travada do usuário: uma única cor neutra, não 4 distintas)
    - `CATEGORY_BG.desq_regiao` é diferente de `CATEGORY_BG.negoc`, `CATEGORY_BG.quente`, `CATEGORY_BG.novo`, `CATEGORY_BG.fim` e `CATEGORY_BG.fechado` (cor nova, não reaproveitada)
  </behavior>
  <action>
Estender `tests/unit/leads-category.test.ts` primeiro (RED) com um novo bloco `describe('lib/leads cat() — 4 novas categorias de desqualificação', ...)` cobrindo todos os casos do bloco behavior acima. Rodar `npx vitest run tests/unit/leads-category.test.ts` e confirmar falha (as 4 categorias ainda não existem).

Depois (GREEN), editar `lib/leads.ts`:

1. `LeadCategory`: adicionar os 4 novos valores à union, resultando em: `'negoc' | 'quente' | 'novo' | 'fim' | 'fechado' | 'desq_regiao' | 'qtd_vidas' | 'pessoa_fisica' | 'engano'`

2. `cat()`: adicionar 4 novos `if` de classificação, inseridos logo após o check de `'fechado'` (antes de `negoc`/`quente`/`fim`) — nenhuma dessas keywords colide com as já existentes:
   - `desq_regiao`: keywords `['desqualificado por região', 'desqualificado por regiao', 'fora da região', 'fora da regiao', 'fora de área', 'fora de area', 'sem cobertura na região']`
   - `qtd_vidas`: keywords `['quantidade de vidas', 'vidas fora do perfil', 'poucas vidas', 'número de vidas', 'numero de vidas']`
   - `pessoa_fisica`: keywords `['pessoa física', 'pessoa fisica']`
   - `engano`: keywords `['engano', 'número errado', 'numero errado', 'contato errado', 'ligação errada', 'ligacao errada']`
   Cada bloco segue o padrão já existente: `if ([...].some(k => v.includes(k))) return 'categoria'`. As linhas de `negoc`/`quente`/`fim`/fallback `novo` permanecem inalteradas, apenas deslocadas para depois dos 4 novos checks.

3. `CATEGORY_LABELS`: adicionar as 4 entradas com os labels EXATOS fornecidos pelo usuário: `desq_regiao: 'Desqualificado por região'`, `qtd_vidas: 'Quantidade de Vidas'`, `pessoa_fisica: 'Pessoa Física'`, `engano: 'Engano'`.

4. `CATEGORY_COLORS`: adicionar as 4 entradas, TODAS com a mesma cor — `text-rose-400` (família rose ainda não usada: negoc=orange, quente=emerald, novo=blue, fim=muted, fechado=lime).

5. `CATEGORY_BG`: adicionar as 4 entradas, TODAS com o mesmo valor — `bg-rose-500/15 text-rose-400 border-rose-500/25` (mesmo padrão `bg-{cor}-500/15 text-{cor}-400 border-{cor}-500/25` das demais categorias coloridas).

Rodar os testes novamente e confirmar GREEN.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/leads-category.test.ts</automated>
  </verify>
  <done>Todos os casos do bloco behavior passam (novos + regressão, incluindo regressão de 'fechado'). npx tsc --noEmit não introduz nenhum erro novo relacionado a lib/leads.ts.</done>
</task>

<task type="auto">
  <name>Task 2: Expor as 4 novas categorias na tabela de Gestão de Leads (dropdown, KPI, funil, distribuição — sem nova aba)</name>
  <files>app/[tenant-slug]/leads/page.tsx</files>
  <action>
Editar app/[tenant-slug]/leads/page.tsx em 6 pontos. NÃO mexer no array TABS — decisão travada do usuário é que os 4 novos status NÃO viram abas de filtro no topo.

1. Imports: adicionar ao import de lucide-react os 4 ícones novos: MapPinOff (desq_regiao), Users2 (qtd_vidas), IdCard (pessoa_fisica), AlertTriangle (engano) — junto aos já importados (Search, Users, Flame, Handshake, PhoneOff, TrendingUp, Bot, CheckCircle2).

2. StatusDropdown: mudar `const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fechado', 'fim']` para `const OPTIONS: LeadCategory[] = ['novo', 'quente', 'negoc', 'fechado', 'desq_regiao', 'qtd_vidas', 'pessoa_fisica', 'engano', 'fim']` (insere as 4 novas entre 'fechado' e 'fim').

3. stats useMemo: adicionar as 4 novas contagens (desqRegiao, qtdVidas, pessoaFisica, engano, cada uma via leads.filter(l => cat(l.status) === '...').length) e os 4 percentuais correspondentes (pDesqRegiao, pQtdVidas, pPessoaFisica, pEngano, mesmo padrão total ? Math.round(x / total * 100) : 0), incluindo todos os 8 novos campos no objeto retornado junto aos já existentes.

4. KPI row: mudar a grid de `grid grid-cols-2 md:grid-cols-6 gap-3` para `grid grid-cols-2 md:grid-cols-5 gap-3` (agora 10 cards no total — duas fileiras de 5 fica mais equilibrado que 6+4) e inserir 4 novos KpiCard após o card "Fechados" e antes de "Sem Resposta", todos usando a mesma cor compartilhada bg-rose-500/15 text-rose-400: label "Desqualif. por Região" (icon MapPinOff, value stats.desqRegiao), label "Qtd. de Vidas" (icon Users2, value stats.qtdVidas), label "Pessoa Física" (icon IdCard, value stats.pessoaFisica), label "Engano" (icon AlertTriangle, value stats.engano).

5. Funil de Conversão: adicionar 4 novas FunnelBar após a barra "Fechados", todas com color="bg-rose-500": "Desqualif. por Região" (count stats.desqRegiao, pct stats.pDesqRegiao), "Qtd. de Vidas" (count stats.qtdVidas, pct stats.pQtdVidas), "Pessoa Física" (count stats.pessoaFisica, pct stats.pPessoaFisica), "Engano" (count stats.engano, pct stats.pEngano).

6. Distribuição (lista lateral): mudar o array (['fechado', 'negoc', 'quente', 'novo', 'fim'] as LeadCategory[]) para (['fechado', 'negoc', 'quente', 'novo', 'desq_regiao', 'qtd_vidas', 'pessoa_fisica', 'engano', 'fim'] as LeadCategory[]), e no objeto de classe condicional (cn()) adicionar uma entrada cobrindo as 4 novas categorias com a mesma cor compartilhada: 'text-rose-400': c === 'desq_regiao' || c === 'qtd_vidas' || c === 'pessoa_fisica' || c === 'engano', junto às já existentes.

NÃO alterar TABS, COLS, nem a lógica de changeStatus/fetch — já funcionam de forma genérica via CATEGORY_LABELS[nextCat] e não são hardcoded por categoria.
  </action>
  <verify>
    <automated>node scripts/verify-task2.js</automated>
  </verify>
  <done>Dropdown (9 opções), KPI (10 cards), funil (7 barras) e distribuição (9 entradas) exibem as 4 novas categorias de forma consistente com as demais, todas com a cor rose compartilhada. TABS permanece com as mesmas 6 entradas de antes (nenhuma nova aba). npx tsc --noEmit clean. npm run build compila sem erros.</done>
</task>

<task type="auto">
  <name>Task 3: Incluir contagem das 4 novas categorias no resumo do Agente IA</name>
  <files>app/[tenant-slug]/leads/agente/page.tsx</files>
  <action>
Editar buildSystem() em app/[tenant-slug]/leads/agente/page.tsx:

1. Adicionar as 4 novas contagens junto às demais (novo, quente, negoc, fim, fechado): const desqRegiao = leads.filter(l => cat(l.status) === 'desq_regiao').length, const qtdVidas = leads.filter(l => cat(l.status) === 'qtd_vidas').length, const pessoaFisica = leads.filter(l => cat(l.status) === 'pessoa_fisica').length, const engano = leads.filter(l => cat(l.status) === 'engano').length.

2. Adicionar uma nova linha ao template string do system prompt, logo após a linha "Taxa de conversão (fechados)" existente, resumindo as 4 novas categorias de desqualificação em uma única linha: - Desqualificados: ${desqRegiao + qtdVidas + pessoaFisica + engano} (Região: ${desqRegiao}, Qtd. Vidas: ${qtdVidas}, Pessoa Física: ${pessoaFisica}, Engano: ${engano}).

Não alterar a linha por-lead da amostra (CATEGORY_LABELS[cat(l.status)]) — já é dinâmica e vai exibir os novos labels automaticamente para leads classificados assim, sem mudança de código.
  </action>
  <verify>
    <automated>node scripts/verify-task3.js</automated>
  </verify>
  <done>O system prompt enviado ao Claude no chat de leads inclui a contagem das 4 novas categorias de desqualificação. npx tsc --noEmit clean.</done>
</task>

</tasks>

<verification>
- Antes da Task 2, o executor deve criar `scripts/verify-task2.js` (script Node temporário, não precisa ser commitado) com o seguinte conteúdo, e rodá-lo via `node scripts/verify-task2.js`:
  ```javascript
  const fs = require('fs')
  const s = fs.readFileSync('app/[tenant-slug]/leads/page.tsx', 'utf8')
  const need = ['desq_regiao', 'qtd_vidas', 'pessoa_fisica', 'engano', 'MapPinOff', 'Users2', 'IdCard', 'AlertTriangle', 'md:grid-cols-5']
  const missing = need.filter(k => !s.includes(k))
  if (missing.length) throw new Error('Faltando em page.tsx: ' + missing.join(', '))
  const m = s.match(/const TABS[\s\S]*?\]\r?\n/)
  if (m && m[0].includes('desq_regiao')) throw new Error('TABS foi alterado - decisao do usuario e NAO criar novas abas')
  console.log('OK: page.tsx wired for the 4 new categories, TABS untouched')
  ```
- Antes da Task 3, o executor deve criar `scripts/verify-task3.js` com o seguinte conteúdo, e rodá-lo via `node scripts/verify-task3.js`:
  ```javascript
  const fs = require('fs')
  const s = fs.readFileSync('app/[tenant-slug]/leads/agente/page.tsx', 'utf8')
  const need = ["=== 'desq_regiao'", "=== 'qtd_vidas'", "=== 'pessoa_fisica'", "=== 'engano'", 'Desqualificados: ']
  const missing = need.filter(k => !s.includes(k))
  if (missing.length) throw new Error('Faltando em agente/page.tsx: ' + missing.join(', '))
  console.log('OK: agente/page.tsx wired for the 4 new categories')
  ```
- Ambos os scripts devem ser apagados (`rm scripts/verify-task2.js scripts/verify-task3.js`) antes do commit final da fase — são apenas ferramentas de verificação local, não fazem parte do código de produção.
- `npx vitest run tests/unit/leads-category.test.ts` — todos os casos (novos + regressão) passam.
- `npm test` (suíte completa) — zero regressões nos arquivos de teste de rotas de leads existentes.
- `npx tsc --noEmit` clean (nenhum erro novo introduzido).
- `npm run build` compila sem erros.
- Inspeção manual (opcional, não bloqueante): abrir `/[tenant-slug]/leads`, confirmar que o dropdown de Status de qualquer linha mostra as 4 novas opções, selecionar cada uma persiste (PATCH 200), e os cards KPI/funil/distribuição refletem as contagens — todos com a mesma cor rose.
</verification>

<success_criteria>
- `lib/leads.ts` exporta `LeadCategory` com 9 valores (`novo`, `quente`, `negoc`, `fechado`, `desq_regiao`, `qtd_vidas`, `pessoa_fisica`, `engano`, `fim`), `cat()` classifica texto contendo as novas keywords corretamente, e `CATEGORY_LABELS`/`CATEGORY_COLORS`/`CATEGORY_BG` têm entradas para as 4 novas categorias, com `CATEGORY_COLORS`/`CATEGORY_BG` idênticos entre as 4 (cor única compartilhada, per decisão do usuário).
- `PATCH /api/leads/[id]/status` aceita os 4 novos labels sem nenhuma mudança de código na rota (validação dinâmica via `Object.values(CATEGORY_LABELS)`).
- A tabela de Gestão de Leads (dropdown, KPI, funil, distribuição) trata as 4 novas categorias como categorias de primeira classe, idênticas em tratamento estrutural às categorias pré-existentes — mas SEM nova aba de filtro (decisão travada do usuário).
- O Agente IA de leads inclui as 4 novas categorias no contexto que envia ao Claude.
- Nenhuma migration de banco de dados foi necessária (leads continuam 100% Google Sheets, sem tabela/CHECK constraint no Supabase).
</success_criteria>

<output>
After completion, create `.planning/quick/260731-qzz-adicionar-4-novos-status-de-lead-desqual/260731-qzz-SUMMARY.md`
</output>
