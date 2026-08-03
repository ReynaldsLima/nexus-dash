---
phase: quick
plan: 260802-wde
type: execute
wave: 1
depends_on: []
files_modified: [lib/leads.ts, tests/unit/leads-sort.test.ts]
autonomous: true
requirements: []
must_haves:
  truths:
    - "Quando vários leads têm a MESMA data em 'Criado em' (mesmo dia, sem hora), o mais recentemente adicionado à planilha aparece PRIMEIRO na ordem padrão (desc) — hoje aparece por último"
    - "Leads com datas diferentes continuam ordenados cronologicamente — o desempate por id só entra quando as datas parseadas são exatamente iguais, nunca sobrepondo a data"
    - "Clicar em 'Criado em' para inverter para ascendente inverte TAMBÉM o desempate: dentro do mesmo dia, o mais antigo (menor id) passa a vir primeiro — o comparador permanece um único comparador consistente nos dois sentidos"
    - "Leads com 'criado_em' vazio ou não-parseável continuam indo para o FIM da lista, independente de asc/desc"
    - "Entre os próprios leads sem data, o desempate por id também se aplica (mesma semântica: mais recente primeiro em desc)"
    - "O campo lead.id continua intocado — a ordenação apenas reordena objetos, então editar o status de qualquer lead continua escrevendo na linha correta da planilha (id + 2)"
    - "A correção mora só em compareByCriadoEm, então tanto a tabela (app/[tenant-slug]/leads/page.tsx) quanto GET /api/leads (via sortLeadsByCriadoEmDesc) herdam o desempate sem precisar de mudança própria"
  artifacts:
    - path: "lib/leads.ts"
      provides: "compareByCriadoEm com desempate por id respeitando a direção de `asc`; parseLeadDate e sortLeadsByCriadoEmDesc inalterados"
      exports: ["parseLeadDate", "compareByCriadoEm", "sortLeadsByCriadoEmDesc"]
      contains: "compareByCriadoEm"
    - path: "tests/unit/leads-sort.test.ts"
      provides: "Cobertura do desempate por id (mesma data, ambos null, direção asc/desc) somada à cobertura pré-existente de parseLeadDate e ordenação"
      contains: "desempate"
  key_links:
    - from: "lib/leads.ts (sortLeadsByCriadoEmDesc)"
      to: "lib/leads.ts (compareByCriadoEm)"
      via: "chamada com asc=false — herda o desempate automaticamente"
      pattern: "compareByCriadoEm\\(a, b, false\\)"
    - from: "app/[tenant-slug]/leads/page.tsx (useMemo filtered)"
      to: "lib/leads.ts (compareByCriadoEm)"
      via: "branch sortKey === 'criado_em', passando sortAsc — por isso o desempate PRECISA respeitar a direção"
      pattern: "compareByCriadoEm\\(a, b, sortAsc\\)"
    - from: "app/api/leads/route.ts"
      to: "lib/leads.ts (sortLeadsByCriadoEmDesc)"
      via: "ordenação aplicada após o map que atribui id — nenhuma mudança necessária neste arquivo"
      pattern: "sortLeadsByCriadoEmDesc"
---

<objective>
Corrigir o desempate na ordenação de leads: quando dois leads têm a mesma data em `criado_em`, desempatar por `id` decrescente (linha mais recente da planilha primeiro), respeitando a direção do parâmetro `asc`.

Purpose: A quick task anterior (`260802-w2g`) corrigiu a ordenação de **alfabética** para **cronológica**, mas a coluna `criado_em` da planilha é uma string **somente-data, sem componente de hora**. Logo, todos os leads criados no mesmo dia parseiam para o mesmíssimo timestamp (meia-noite local) e `compareByCriadoEm` devolve `0`. Como `Array.prototype.sort` é estável no V8, a ordem original do array é preservada — e a ordem original é `id` **ascendente** (ordem de inserção das linhas do Google Sheet, mais antigo primeiro). Resultado confirmado por screenshot: dentro de um mesmo dia, os leads aparecem do mais antigo para o mais novo, exatamente o inverso do que o usuário pediu. A correção é adicionar um desempate por `id` no único comparador compartilhado.

Output: `lib/leads.ts` com `compareByCriadoEm` desempatando por `id`; `tests/unit/leads-sort.test.ts` estendido com os casos de empate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260802-w2g-sempre-ordenar-a-lista-de-leads-por-cria/260802-w2g-SUMMARY.md

<interfaces>
<!-- Contratos exatos extraídos do código atual. NÃO explore o repositório para redescobrir isto. -->

`lib/leads.ts` (estado atual, linhas 103-119 — o ÚNICO ponto de mudança deste plano):
```ts
// Compara dois leads pela data de criação (cronologicamente, não alfabeticamente).
// Leads sem data parseável (null) sempre vão para o FIM, independente de `asc`.
export function compareByCriadoEm(a: Lead, b: Lead, asc: boolean): number {
  const ta = parseLeadDate(a.criado_em)
  const tb = parseLeadDate(b.criado_em)
  if (ta === null && tb === null) return 0        // <-- empate: cai na estabilidade do sort
  if (ta === null) return 1
  if (tb === null) return -1
  return asc ? ta - tb : tb - ta                  // <-- retorna 0 quando ta === tb
}

// Ordena leads do mais novo para o mais antigo. NÃO reatribui `id` — `id` é o índice
// 0-based da linha da planilha (ver lib/sheets.ts, Leads!F{id + 2}); ordenar aqui move
// os objetos, não os índices.
export function sortLeadsByCriadoEmDesc(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => compareByCriadoEm(a, b, false))
}
```

`Lead.id` — de onde vem (app/api/leads/route.ts, linhas 74-85):
```ts
const rows: string[][] = json.values ?? []      // linhas cruas de Leads!A2:H500, em ordem de planilha
const leads: Lead[] = rows.map((r, i) => ({
  id: i,                                        // <-- 0-based, ASCENDENTE = ordem de inserção
  // ...
  criado_em: r[4] ?? '',                        // <-- coluna E, string somente-data no caso real
}))
```
Portanto: **id maior = linha mais abaixo na planilha = adicionado mais recentemente.**

Os DOIS consumidores de `compareByCriadoEm` (nenhum precisa mudar — herdam a correção):
```ts
// app/api/leads/route.ts:91 — via sortLeadsByCriadoEmDesc (asc = false)
const sorted = sortLeadsByCriadoEmDesc(leads)

// app/[tenant-slug]/leads/page.tsx:137 — direto, com a direção do toggle do usuário
if (sortKey === 'criado_em') return compareByCriadoEm(a, b, sortAsc)
```
É por isso que o desempate **precisa** respeitar `asc`: o mesmo comparador serve o default desc da rota e o toggle asc/desc do cabeçalho da tabela.
</interfaces>

<constraints>
- **`lead.id` é sagrado.** É o índice 0-based da linha da planilha e o `PATCH /api/leads/[id]/status` o converte em `Leads!F{id + 2}`. Este plano apenas **lê** `id` para comparar. Nunca reatribua, nunca faça `.map((l, i) => ({ ...l, id: i }))`.
- **Não regredir o comportamento de datas nulas indo para o fim.** As guardas `if (ta === null) return 1` / `if (tb === null) return -1` são independentes de `asc` e devem continuar exatamente assim, ANTES de qualquer lógica de desempate.
- **Não regredir a ordenação cronológica.** O desempate só pode entrar quando `ta === tb`. Datas diferentes nunca podem ser influenciadas por `id`.
- **Estender, não substituir, `tests/unit/leads-sort.test.ts`.** Nenhum teste existente de `parseLeadDate` pode ser removido ou alterado.
- **Não alterar** `app/api/leads/route.ts` nem `app/[tenant-slug]/leads/page.tsx` — eles já chamam o comparador corretamente e herdam a correção de graça. Se você sentir vontade de tocá-los, a correção está no lugar errado.
- **Não instalar dependência nova.** A mudança é de ~2 linhas.
</constraints>

<decision_note>
**Decisão explícita sobre o empate `null` vs `null`:** o desempate por `id` TAMBÉM se aplica quando ambas as datas são nulas.

Racional: um lead sem data legível é, hoje, ordenado por ordem de inserção crescente — que é exatamente o bug sendo corrigido, só que na cauda da lista. Aplicar a mesma semântica ("adicionado mais recentemente primeiro em desc") mantém o comparador coerente e evita uma regra especial não-óbvia.

**Consequência que o executor PRECISA conhecer:** isso altera a expectativa de UM teste pré-existente, `'puts leads with null date at the end, preserving relative order (stable)'` (linhas 82-91). Os fixtures `SemData1` (id 0) e `SemData2` (id 2) hoje esperam `['Bruno', 'Ana', 'SemData1', 'SemData2']`; com o desempate passam a esperar `['Bruno', 'Ana', 'SemData2', 'SemData1']`. Essa mudança é **deliberada**, e a Task 1 a trata de forma cirúrgica (atualiza a asserção e o nome do teste para refletir a nova regra).

Os outros dois testes pré-existentes de `compareByCriadoEm` continuam passando SEM alteração:
- `'returns 0 when both dates are null'` — ambos os fixtures usam o `id: 0` default do `makeLead`, então o desempate calcula `0 - 0 = 0`. Continua verde.
- `'sends null date to the end regardless of asc/desc'` — um lado tem data e o outro não, então as guardas de null retornam antes do desempate. Continua verde.
</decision_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — cobrir o desempate por id em tests/unit/leads-sort.test.ts</name>
  <files>tests/unit/leads-sort.test.ts</files>
  <behavior>
    Estenda o arquivo existente (o helper `makeLead` e os imports já existem — reutilize, não duplique).

    **A) Adicione ao `describe('compareByCriadoEm', ...)` existente:**
    - `'desempata datas iguais por id decrescente quando desc'`: `a = makeLead({ id: 1, criado_em: '02/08/2026' })`, `b = makeLead({ id: 5, criado_em: '02/08/2026' })`. `compareByCriadoEm(a, b, false)` deve ser **> 0** (a, de id menor, vai depois). E `compareByCriadoEm(b, a, false)` deve ser **< 0**.
    - `'desempata datas iguais por id crescente quando asc'`: mesmos fixtures. `compareByCriadoEm(a, b, true)` deve ser **< 0** e `compareByCriadoEm(b, a, true)` deve ser **> 0**.
    - `'a data tem precedência sobre o id'`: `a = makeLead({ id: 0, criado_em: '03/08/2026' })` (id menor, data MAIS NOVA), `b = makeLead({ id: 9, criado_em: '02/08/2026' })`. Em desc, `compareByCriadoEm(a, b, false)` deve ser **< 0** — prova que o id NÃO sobrepõe a data.
    - `'desempata por id também quando ambas as datas são null'`: `a = makeLead({ id: 1, criado_em: '' })`, `b = makeLead({ id: 4, criado_em: 'lixo' })`. Em desc (`false`) o resultado deve ser **> 0**; em asc (`true`) deve ser **< 0**.

    **B) Adicione ao `describe('sortLeadsByCriadoEmDesc', ...)` existente:**
    - `'dentro do mesmo dia, ordena do mais recentemente adicionado para o mais antigo'`: três leads TODOS com `criado_em: '02/08/2026'`, no array na ordem `id 0 (Ana), id 1 (Bruno), id 2 (Carla)`. Espere `sorted.map(l => l.nome)` igual a `['Carla', 'Bruno', 'Ana']` e `sorted.map(l => l.id)` igual a `[2, 1, 0]`.
    - `'cruza dias diferentes cronologicamente e desempata dentro de cada dia'`: fixture misto, na ordem de planilha (id ascendente):
      - `id 0, 'Ana',   '31/07/2026'`
      - `id 1, 'Bruno', '02/08/2026'`
      - `id 2, 'Carla', '31/07/2026'`
      - `id 3, 'Diego', '02/08/2026'`
      - `id 4, 'Elza',  '15/06/2026'`
      Espere `['Diego', 'Bruno', 'Carla', 'Ana', 'Elza']` e ids `[3, 1, 2, 0, 4]` — dias em ordem decrescente (02/08 → 31/07 → 15/06) e, dentro de cada dia, id decrescente.

    **C) Atualize (não remova) o teste pré-existente `'puts leads with null date at the end, preserving relative order (stable)'`:**
    - Renomeie para `'puts leads with null date at the end, desempatando entre eles por id desc'`
    - Mantenha os MESMOS fixtures (SemData1 id 0, Bruno id 1, SemData2 id 2, Ana id 3)
    - Troque a asserção de `['Bruno', 'Ana', 'SemData1', 'SemData2']` para `['Bruno', 'Ana', 'SemData2', 'SemData1']`
    - Adicione um comentário de uma linha acima do teste explicando que os sem-data seguem a mesma regra de desempate dos com-data (ver `<decision_note>` deste plano)
    - **Não** mexa nos outros testes.
  </behavior>
  <action>
Escreva SOMENTE os testes nesta task — `lib/leads.ts` permanece intocado. Rode a suíte do arquivo e confirme o estado RED esperado:

- Os 4 novos casos de `compareByCriadoEm` FALHAM (a implementação atual devolve `0` em todos os empates)
- Os 2 novos casos de `sortLeadsByCriadoEmDesc` FALHAM (hoje devolvem a ordem de inserção: `['Ana','Bruno','Carla']` / ids `[0,1,2]`)
- O teste C atualizado FALHA (hoje devolve `SemData1` antes de `SemData2`)
- **Todos** os testes de `parseLeadDate` e os demais de ordenação/imutabilidade continuam VERDES — se algum deles quebrar, você alterou algo que não devia.

Registre no output da task quais testes falharam, para que a Task 2 possa provar a transição RED → GREEN.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/leads-sort.test.ts</automated>
  </verify>
  <done>7 testes falhando (4 de `compareByCriadoEm`, 2 novos de `sortLeadsByCriadoEmDesc`, 1 atualizado de null-tiebreak); todos os testes de `parseLeadDate`, o de preservação de `id` e o de não-mutação continuam passando; `lib/leads.ts` não foi modificado.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — desempate por id em compareByCriadoEm</name>
  <files>lib/leads.ts</files>
  <behavior>
    Após a mudança, `npx vitest run tests/unit/leads-sort.test.ts` fica 100% verde, incluindo os 7 casos que a Task 1 deixou vermelhos, e `npm test` (suíte inteira) permanece verde — nenhum outro arquivo de teste de leads pode regredir.
  </behavior>
  <action>
Em `lib/leads.ts`, substitua APENAS o corpo de `compareByCriadoEm` (linhas 105-112). Nada mais no arquivo muda — `parseLeadDate` e `sortLeadsByCriadoEmDesc` ficam idênticos.

```ts
// Compara dois leads pela data de criação (cronologicamente, não alfabeticamente).
// Leads sem data parseável (null) sempre vão para o FIM, independente de `asc`.
//
// Desempate: a coluna "Criado em" da planilha é somente-data (sem hora), então todos
// os leads do mesmo dia parseiam para o MESMO timestamp. Sem desempate, o sort estável
// do V8 preservava a ordem original do array — que é `id` ascendente (ordem de inserção
// das linhas do Sheet, mais ANTIGO primeiro), o inverso do esperado em desc.
// Como `id` é o índice 0-based da linha (id maior = linha mais abaixo = adicionado
// depois), desempatamos por `id` seguindo a MESMA direção de `asc`, para que o
// comparador continue coerente nos dois sentidos (default desc da rota e toggle da
// tabela). O desempate só entra quando as datas são exatamente iguais — nunca sobrepõe
// a comparação cronológica.
export function compareByCriadoEm(a: Lead, b: Lead, asc: boolean): number {
  const ta = parseLeadDate(a.criado_em)
  const tb = parseLeadDate(b.criado_em)
  const desempate = asc ? a.id - b.id : b.id - a.id
  if (ta === null && tb === null) return desempate
  if (ta === null) return 1
  if (tb === null) return -1
  if (ta !== tb) return asc ? ta - tb : tb - ta
  return desempate
}
```

Pontos de atenção ao aplicar:
1. As duas guardas de `null` continuam retornando `1` / `-1` literais, **antes** de qualquer uso de `desempate` — datas ilegíveis vão para o fim em asc E em desc.
2. `if (ta !== tb)` precisa vir antes do `return desempate` — sem essa guarda o desempate sobreporia datas diferentes.
3. Não toque em `sortLeadsByCriadoEmDesc`: ele já chama `compareByCriadoEm(a, b, false)` e herda o desempate.
4. Não toque em `app/api/leads/route.ts` nem em `app/[tenant-slug]/leads/page.tsx` — ambos já consomem este comparador.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/leads-sort.test.ts && npm test && npx tsc --noEmit && npx eslint lib/leads.ts tests/unit/leads-sort.test.ts</automated>
  </verify>
  <done>`tests/unit/leads-sort.test.ts` 100% verde (RED → GREEN nos 7 casos da Task 1); `npm test` inteiro verde incluindo `leads-get-route.test.ts` e `leads-status-route.test.ts`; `npx tsc --noEmit` sem erros novos; eslint limpo; `git diff` mostra mudança APENAS em `lib/leads.ts` (corpo de `compareByCriadoEm` + comentário) e `tests/unit/leads-sort.test.ts`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Google Sheets → GET /api/leads | Conteúdo da planilha é dado externo não confiável; `criado_em` chega como string crua |
| Browser → PATCH /api/leads/[id]/status | `lead.id` enviado pelo cliente vira endereço de escrita na planilha (`Leads!F{id+2}`) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wde-01 | Tampering | `lead.id` usado como chave de desempate | mitigate | `id` é apenas **lido** na comparação; nenhuma reatribuição em nenhum caminho. O teste pré-existente `'does not change lead.id'` permanece na suíte e é executado na verificação da Task 2, provando que o mapeamento `id → linha da planilha` do PATCH de status continua íntegro |
| T-wde-02 | Tampering | `criado_em` vindo do Sheets alimentando o comparador | accept | `parseLeadDate` não é alterado por este plano; segue regex-only, com validação de faixa e checagem de overflow, retornando `null` para entrada não reconhecida em vez de lançar. Entradas nulas agora caem no desempate numérico por `id`, que não toca a string |
| T-wde-03 | Denial of Service | Comparador chamado O(n log n) sobre até 499 linhas | accept | O desempate adiciona duas subtrações inteiras por comparação; custo desprezível e o volume é limitado pelo range fixo `Leads!A2:H500` da rota |
| T-wde-04 | Information Disclosure | Ordem de exibição dos leads | accept | Este plano não toca em auth, role gate nem escopo tenant/agency de `GET /api/leads` — a ordenação ocorre estritamente depois de todos os gates, sobre dados já autorizados para o chamador |
</threat_model>

<verification>
1. `npx vitest run tests/unit/leads-sort.test.ts` — 100% verde após a Task 2, com transição RED → GREEN documentada entre as tasks.
2. `npm test` — suíte inteira verde, com atenção especial a `tests/unit/leads-get-route.test.ts`, cuja asserção de ids `[1, 0, 2]` usa datas **distintas** e portanto não é afetada pelo desempate.
3. `npx tsc --noEmit` — sem erros novos.
4. `git diff --stat` — exatamente 2 arquivos alterados: `lib/leads.ts` e `tests/unit/leads-sort.test.ts`. Qualquer outro arquivo no diff indica que a correção foi aplicada no lugar errado.
5. Verificação manual (pós-execução, na UI): abrir `/[tenant-slug]/leads` e localizar um grupo de leads com a mesma data em "Criado em" — dentro do grupo, o lead que está mais abaixo na planilha do cliente deve aparecer no TOPO do grupo. Comparar com o screenshot original que motivou esta correção.
6. Verificação manual do toggle: clicar em "Criado em" para inverter para ascendente — dentro do mesmo dia a ordem do grupo deve inverter também (mais antigo primeiro), não permanecer igual.
7. Verificação manual de regressão crítica: alterar o status de um lead que esteja no MEIO de um grupo de mesma data e recarregar — o status deve persistir no lead correto (prova de que o desempate não quebrou o mapeamento `id → linha`).
</verification>

<success_criteria>
- [ ] Dentro de um grupo de leads com a mesma data, a ordem padrão (desc) mostra o adicionado mais recentemente primeiro
- [ ] Datas diferentes continuam ordenadas cronologicamente — `id` nunca sobrepõe a data
- [ ] O toggle ascendente inverte também o desempate (mais antigo primeiro dentro do dia)
- [ ] Leads sem data continuam no fim em asc e desc, e entre si seguem a mesma regra de desempate
- [ ] `lead.id` preservado — nenhuma reatribuição, coberto pelo teste automatizado pré-existente
- [ ] `tests/unit/leads-sort.test.ts` estendido (não substituído); todos os testes de `parseLeadDate` intactos
- [ ] `npm test`, `npx tsc --noEmit` e `eslint` limpos
- [ ] Diff restrito a `lib/leads.ts` + `tests/unit/leads-sort.test.ts`
</success_criteria>

<output>
Ao concluir, crie `.planning/quick/260802-wde-corrigir-desempate-na-ordenacao-de-leads/260802-wde-SUMMARY.md`
</output>
</content>
</invoke>
