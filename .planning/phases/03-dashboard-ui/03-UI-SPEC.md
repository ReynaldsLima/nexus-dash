---
phase: 03
slug: dashboard-ui
gap: GAP-03-01
status: draft
shadcn_initialized: true
preset: detected from components.json
created: 2026-06-05
scope: gap-closure-only
---

# Phase 03 — UI Design Contract (Gap Closure: GAP-03-01)

> Contrato visual e de interação para o channel click drill-down no PieChart do dashboard.
> Escopo restrito ao GAP-03-01 — os demais contratos da Fase 3 estão implementados e não são re-especificados aqui.

---

## Scope

**GAP-03-01:** O PieChart de channel split (Google Ads vs Meta Ads) no dashboard deve abrir um
drill-down ao clicar em um canal, mostrando métricas detalhadas do canal para o período selecionado.

**Componente afetado:** `app/[tenant-slug]/dashboard/page.tsx` (PieChart existente sem `onClick`)

**Novo componente a criar:** `components/dashboard/channel-sheet.tsx`

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | Detectado via `components.json` — dark theme customizado (neon accent #c8ff00) |
| Component library | Base UI (via shadcn — `components/ui/sheet.tsx` já usa `@base-ui/react/dialog`) |
| Icon library | lucide-react ^1.14.0 |
| Font — body | Bricolage Grotesque (`var(--font-bricolage)`) |
| Font — headings | Syne (`var(--font-syne)`) |
| Font — mono | DM Mono (`var(--font-dm-mono)`) |

**Source:** `app/globals.css` (verificado) + `components/campanhas/campaign-sheet.tsx` (padrão Sheet existente)

---

## Spacing Scale

Multiples of 4 — alinhados ao padrão Tailwind do projeto:

| Token | Value | Usage no channel drill-down |
|-------|-------|-----------------------------|
| xs | 4px | Gap entre ícone e label no badge de canal, `gap-1` |
| sm | 8px | Padding interno dos badges, `px-2 py-0.5` |
| md | 16px | Padding horizontal do SheetContent, `px-4` |
| lg | 24px | Padding de seção dentro do Sheet, `pt-4` a `pt-5` |
| xl | 32px | Não usado no Sheet |
| 2xl | 48px | Não usado no Sheet |
| 3xl | 64px | Não usado no Sheet |

Exceções: nenhuma.

**Source:** padrão de espaçamento de `components/campanhas/campaign-sheet.tsx` (replicar exatamente).

---

## Typography

Replicar exatamente o padrão do `CampaignSheet` existente:

| Role | Size | Weight | Line Height | Uso no ChannelSheet |
|------|------|--------|-------------|---------------------|
| Sheet title | 16px (text-base) | 600 (font-semibold) | 1.25 (leading-tight) | Nome do canal no SheetHeader |
| Section label | 10px (text-xs) | 500 (font-medium) | — | "MÉTRICAS DO CANAL", "CAMPANHAS DESTE CANAL", uppercase + tracking-wide |
| Body / data | 14px (text-sm) | 400 (normal) | 1.5 | Linhas da tabela de totais e lista de campanhas |
| Metric value | 14px (text-sm) | 500 (font-medium) | — | Valores numéricos (tabular-nums) |
| Muted label | 12px (text-xs) | 400 | — | Labels de métricas, subtextos |

**Nota:** `text-2xl font-bold` reservado para KPI cards do dashboard principal — não usar no Sheet.

---

## Color

| Role | Value | Uso |
|------|-------|-----|
| Dominant (60%) | `var(--background)` — `oklch(1 0 0)` light / `#060608` dark | Superfície do SheetContent |
| Secondary (30%) | `var(--card)` — `oklch(1 0 0)` light / `#0e0e12` dark | Card interno de totais (`rounded-lg border border-border`) |
| Accent (10%) | `var(--chart-1)` / `var(--chart-2)` | Badge colorido do canal; linha do AreaChart |
| Destructive | `var(--chart-5)` — `oklch(0.65 0.20 15)` | Não usado neste componente |

**Accent reservado para:**
- Badge de canal no SheetHeader (background 15% opacity, foreground full)
- Stroke e fill do AreaChart (linha de gasto do canal)
- Dot colorido na legenda inline

**Cores de canal (estabelecidas no codebase — não alterar):**

| Canal | Background badge | Foreground badge | Chart color |
|-------|-----------------|-----------------|-------------|
| Google Ads | `oklch(0.60 0.22 258 / 0.15)` | `oklch(0.72 0.16 258)` | `var(--chart-1)` |
| Meta Ads | `oklch(0.68 0.20 305 / 0.15)` | `oklch(0.75 0.16 305)` | `var(--chart-2)` |

**Source:** `components/campanhas/campaign-sheet.tsx` linha 33-36 (padrão ChannelBadge existente — reusar).

---

## Interaction Contract

### Trigger: PieChart slice click

**Elemento:** `<Pie>` em `app/[tenant-slug]/dashboard/page.tsx`

**Prop a adicionar:**
```tsx
onClick={(data) => setSelectedChannel(data.name as 'Google Ads' | 'Meta Ads')}
```

**Estado local** a adicionar em `DashboardPage`:
```tsx
const [selectedChannel, setSelectedChannel] = useState<'Google Ads' | 'Meta Ads' | null>(null)
```

**Cursor:** `cursor-pointer` na Pie via `className` ou `style={{ cursor: 'pointer' }}` nos Cells.

**Affordance visual:** Ao hover sobre um slice do Pie, o slice deve ter `opacity` reduzida para 80% para sinalizar interatividade. Usar `activeShape` ou `onMouseEnter`/`onMouseLeave` no `<Pie>`.

### Container do Drill-Down: Sheet lateral direito

**Componente:** `<Sheet>` (Base UI — `components/ui/sheet.tsx` existente) — mesmo padrão do `CampaignSheet`.

**Posição:** `side="right"`

**Largura:** `w-[520px] sm:max-w-[520px]` — idêntica ao `CampaignSheet`.

**Fechar:** Apenas botão X ou tecla Esc. Bloquear clique externo via `disablePointerDismissal` (prop Base UI) — idêntico ao `CampaignSheet` linha 123.

**Abertura:** `open={!!selectedChannel}` — abre ao clicar em qualquer slice do PieChart.

**Fechamento programático:** `onClose={() => setSelectedChannel(null)}`.

---

## Content Contract: ChannelSheet

### Estrutura do Sheet (de cima para baixo)

```
┌─────────────────────────────────────────┐
│ SheetHeader (pb-4, border-b)            │
│   SheetTitle — nome do canal            │
│   Badge do canal + total de gasto       │
├─────────────────────────────────────────┤
│ Seção: Gasto ao longo do período (pt-4) │
│   label uppercase: "GASTO NO PERÍODO"   │
│   AreaChart — spend diário do canal     │
├─────────────────────────────────────────┤
│ Seção: Métricas agregadas (pt-5)        │
│   label uppercase: "MÉTRICAS DO CANAL"  │
│   tabela TotalsRow: 6 métricas          │
├─────────────────────────────────────────┤
│ Seção: Top campanhas (pt-5)             │
│   label uppercase: "TOP CAMPANHAS"      │
│   lista de até 5 campanhas deste canal  │
│   com Spend, ROAS, Status               │
└─────────────────────────────────────────┘
```

### SheetHeader

- `SheetTitle` (text-base, font-semibold, leading-tight): nome do canal — "Google Ads" ou "Meta Ads"
- Badge de canal (reusar `ChannelBadge` de `campaign-sheet.tsx`)
- Subtexto: total de gasto no período — ex: `R$ 12.450,00 no período`

### Seção 1: Gasto ao Longo do Período

**Dados:** Filtrar `data.current` (já disponível em `DashboardPage`) por `channel === 'google_ads'` ou `channel === 'meta_ads'` — cada row é um dia.

**Chart:** `AreaChart` do Recharts — mesma configuração do CampaignSheet (h-44, margins {top:4, right:4, bottom:0, left:0}).

**DataKey:** `spend` (de `total_spend` da row de `daily_rollups`)

**Gradient:** igual ao padrão de dashboard — `var(--chart-1)` para Google Ads, `var(--chart-2)` para Meta Ads.

**X-axis:** datas no formato `dd/MM` via `formatDateLabel()` (helper existente no dashboard page).

**Y-axis:** oculto (`hide`).

**Tooltip:** `brl(Number(value))`.

### Seção 2: Métricas Agregadas do Canal

Reusar o componente `TotalsRow` do `CampaignSheet` (ou extrair para shared).

| Label | Cálculo | Formato |
|-------|---------|---------|
| Impressões | `sum(total_impressions)` do canal | `num()` |
| Cliques | `sum(total_clicks)` | `num()` |
| CTR | `sum(clicks) / sum(impressions) * 100` | `X.XX%` |
| Gasto | `sum(total_spend)` | `brl()` |
| Conversões | `sum(total_conversions)` | `num()` |
| ROAS | `sum(conv_value) / sum(spend)` | `X.XX×` (ou `—` se spend=0) |

**Source de dados:** `data.current` (já carregado pelo hook `useDashboardData` em `DashboardPage`) — filtrado por canal. Nenhuma query adicional necessária.

### Seção 3: Top Campanhas do Canal

**Dados:** reusar `useCampaignsData(tenantSlug)` (hook existente em `lib/hooks/use-campaigns-data.ts`) + `groupCampaignMetrics()` — filtrar por canal, ordenar por spend desc, exibir top 5.

**Layout:** lista vertical (não tabela) — cada item:
```
[dot status] Nome da campanha                  R$ 1.234,56
             badge canal | ROAS: 3.20×
```

- Padding vertical: `py-2`, separador `border-b border-border/50 last:border-0`
- Nome: text-sm font-medium, max-w truncado com `truncate`
- Spend: text-sm tabular-nums font-medium, alinhado à direita
- Sub-info: text-xs text-muted-foreground
- Status dot: verde `oklch(0.75 0.18 155)` ativa, cinza `oklch(0.556 0 0)` pausada

**Se 0 campanhas:** exibir empty state (ver Copywriting).

---

## States Contract

### Loading

**Quando:** `useCampaignsData` ainda carregando (campanhas para Top Campanhas).

**Skeleton para seção Top Campanhas apenas** (gasto e métricas vêm de `data.current` que já está disponível):

```tsx
<Skeleton className="h-12 w-full rounded-md" />   // 3x
```

**Seções 1 e 2** renderizam imediatamente com `data.current` já disponível — sem loading adicional.

### Empty State

**Quando:** Canal selecionado não tem dados no período (`total_spend === 0` e nenhuma row filtrada).

**Elemento:** Dentro do SheetContent, após o header:

```
Sem dados para [Google Ads / Meta Ads] no período selecionado.
Selecione outro período no date range picker ou verifique se o sync foi executado.
```

- Layout: `text-center py-12 text-sm text-muted-foreground`
- Nenhum CTA de ação — o picker está no header global, acessível.

**Empty state de Top Campanhas** (canal tem dados mas sem campanhas individuais mapeadas):
```
Nenhuma campanha encontrada para este canal no período.
```
- Layout: `text-xs text-muted-foreground text-center py-4`

### Error State

**Quando:** `useCampaignsData` retorna `isError === true`.

**Elemento:** Substituir seção Top Campanhas:

```
Erro ao carregar campanhas. Tente recarregar a página.
```

- Layout: `text-xs text-muted-foreground text-center py-4`
- Sem botão de retry (simplicidade v1).

### No-Data State (canal inexistente)

**Quando:** Canal não tem nenhuma row em `data.current` (tenant sem dados de um dos canais).

**Comportamento:** O slice do PieChart não deveria existir com valor 0, mas se clicar em um canal com `value = 0`: sheet abre e mostra o empty state completo.

---

## Copywriting Contract

| Elemento | Copy |
|----------|------|
| SheetTitle — Google Ads | "Google Ads" |
| SheetTitle — Meta Ads | "Meta Ads" |
| Subtexto do header | "{brl(totalSpend)} no período" |
| Label seção gasto | "GASTO NO PERÍODO" |
| Label seção métricas | "MÉTRICAS DO CANAL" |
| Label seção campanhas | "TOP CAMPANHAS" |
| Empty state (sem dados do canal) — heading | "Sem dados para {canal} no período selecionado." |
| Empty state (sem dados do canal) — body | "Selecione outro período no date range picker ou verifique se o sync foi executado." |
| Empty state (campanhas) | "Nenhuma campanha encontrada para este canal no período." |
| Error state (campanhas) | "Erro ao carregar campanhas. Tente recarregar a página." |
| Loading accessible label | `aria-label="Carregando campanhas"` no skeleton container |
| Affordance PieChart | Nenhum tooltip adicional — o `ChartTooltip` existente com `brl(value)` é suficiente |

**Nota de tom:** Direto, sem emoji, sem pontuação excessiva — alinhado ao padrão do CampaignSheet existente.

---

## Component Inventory

| Componente | Status | Ação |
|-----------|--------|------|
| `components/ui/sheet.tsx` | Instalado | Reusar — mesmo padrão do CampaignSheet |
| `components/ui/skeleton.tsx` | Instalado | Reusar para loading state de Top Campanhas |
| `components/ui/chart.tsx` | Instalado | Reusar `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` |
| `ChannelBadge` (em campaign-sheet.tsx) | Implementado | Extrair para `components/ui/channel-badge.tsx` ou copiar inline |
| `TotalsRow` (em campaign-sheet.tsx) | Implementado | Extrair para shared ou duplicar no ChannelSheet |
| `components/dashboard/channel-sheet.tsx` | Não existe | Criar — novo componente |
| `useCampaignsData` hook | Implementado | Reusar sem modificação |
| `groupCampaignMetrics` | Implementado | Reusar — filtrar por canal após grouping |
| `brl()`, `num()` formatters | Implementados | Reusar de `lib/formatters.ts` |

**Novo arquivo a criar:**
- `components/dashboard/channel-sheet.tsx`

**Arquivos a modificar:**
- `app/[tenant-slug]/dashboard/page.tsx` — adicionar `useState`, `onClick` no Pie, `<ChannelSheet>` no return

---

## Data Flow

```
DashboardPage
  │
  ├── useDashboardData(tenantSlug)    ← já implementado, dados já disponíveis
  │     └── data.current (daily_rollups rows)
  │           ├── filtrar por channel === 'google_ads' → seção gasto + métricas
  │           └── filtrar por channel === 'meta_ads'   → seção gasto + métricas
  │
  ├── useState<'Google Ads' | 'Meta Ads' | null>(null) → selectedChannel
  │
  ├── PieChart <Pie onClick> → set selectedChannel
  │
  └── <ChannelSheet
          channel={selectedChannel}
          channelRows={data.current.filter(r => r.channel === channelKey)}
          tenantSlug={tenantSlug}
          onClose={() => setSelectedChannel(null)}
        />
            │
            └── useCampaignsData(tenantSlug)   ← hook existente
                  └── groupCampaignMetrics()   ← lib existente
                        └── filter by channel  → top 5 ordenado por spend
```

**Mapeamento de nomes de canal:**

| PieChart `data.name` | `daily_rollups.channel` |
|----------------------|------------------------|
| "Google Ads" | "google_ads" |
| "Meta Ads" | "meta_ads" |

---

## Props Contract: ChannelSheet

```tsx
type ChannelSheetProps = {
  channel: 'Google Ads' | 'Meta Ads' | null   // null → Sheet fechado
  channelRows: DailyRollupRow[]               // já filtrados por canal, período atual
  tenantSlug: string
  onClose: () => void
}
```

**Não passar `data.prior`** — o drill-down de canal não exibe deltas period-over-period (simplicidade v1).

---

## Accessibility

| Elemento | Requisito |
|----------|-----------|
| PieChart slice clicável | `role="button"` não necessário — Recharts `<Cell>` é SVG. Adicionar `aria-label` no container: `"Clique em um canal para ver detalhes"` via `aria-description` no `<ChartContainer>` |
| SheetContent | `aria-labelledby` aponta para SheetTitle automaticamente (Base UI) |
| SheetTitle | Deve conter o nome do canal para leitores de tela |
| Loading skeleton | Container com `aria-busy="true"` enquanto `tsLoading === true` |
| Fechar Sheet | Botão X nativo do Sheet — `aria-label="Fechar"` já fornecido pelo shadcn |

---

## Registry Safety

| Registry | Componentes Usados | Safety Gate |
|----------|--------------------|-------------|
| shadcn oficial | Sheet, Skeleton, ChartContainer | not required |
| Base UI | Dialog (via sheet.tsx existente) | already installed — not required |

Nenhum registry de terceiros declarado para este gap. Vetting gate: não aplicável.

---

## Visual Mockup (texto)

```
┌─ Sheet lateral direito (520px) ──────────────────────────────────┐
│                                                              [X]  │
│ ┌─ SheetHeader (pb-4, border-b) ──────────────────────────────┐  │
│ │ Google Ads                                                   │  │
│ │ [badge: Google Ads] · R$ 34.200,00 no período               │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ GASTO NO PERÍODO                                                   │
│ ┌─ AreaChart 176px (chart-1 azul) ──────────────────────────────┐ │
│ │ ╱╲   ╱╲     ╱╲                                              │ │
│ │╱  ╲_╱  ╲___╱  ╲____                                         │ │
│ │ 01/05   15/05   30/05                                        │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ MÉTRICAS DO CANAL                                                  │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Impressões                              1.234.567              │ │
│ │ Cliques                                    23.456              │ │
│ │ CTR                                         1,90%              │ │
│ │ Gasto                                  R$ 34.200,00            │ │
│ │ Conversões                                  1.234              │ │
│ │ ROAS                                         3,20×             │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ TOP CAMPANHAS                                                      │
│ ● Campanha Remarketing Black Friday       R$ 12.450,00             │
│   [Google Ads]  ROAS: 4,10×                                        │
│ ─────────────────────────────────────────────────────────────────  │
│ ● Brand Keywords PT-BR                    R$ 9.800,00              │
│   [Google Ads]  ROAS: 3,50×                                        │
│ ─────────────────────────────────────────────────────────────────  │
│ (até 5 campanhas)                                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes para o Executor

1. **Reusar `data.current` — nenhum novo hook necessário para seções 1 e 2.** O hook `useDashboardData` já retorna todos os rows de `daily_rollups` para o período. Filtrar por canal dentro do `ChannelSheet` via props.

2. **`useCampaignsData` pode estar em loading** quando o Sheet abrir — mostrar Skeleton apenas na seção Top Campanhas. Seções 1 e 2 renderizam imediatamente.

3. **Extrair ou duplicar `ChannelBadge` e `TotalsRow`** — se a duplicação for preferível a extrair componentes shared, duplicar dentro do `channel-sheet.tsx` com comentário `// TODO: extract to shared when refactoring Phase 3 components`. Não bloquear a implementação por este refactor.

4. **`formatDateLabel`** é uma função helper no fim de `dashboard/page.tsx` — copiá-la para `lib/formatters.ts` ou duplicar no `channel-sheet.tsx`.

5. **Mapeamento canal:** `'Google Ads' → 'google_ads'`, `'Meta Ads' → 'meta_ads'` — usar objeto de lookup, não switch.

6. **Não adicionar período anterior (delta)** ao drill-down de canal em v1 — simplicidade intencional.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Gap: GAP-03-01*
*Phase: 03-dashboard-ui*
*UI-SPEC created: 2026-06-05*
*Researcher: Claude (gsd-ui-researcher)*
