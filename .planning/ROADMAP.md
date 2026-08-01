# NEXUS-DASH — Roadmap

## Milestones

- ✅ **v1.0 MVP** — Phases 0-8 (shipped 2026-07-12) — see `.planning/milestones/v1.0-ROADMAP.md`
- 🚧 **v1.1 Gestão de Usuários, Limpeza e Redesign Visual** — Phases 9-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (9, 10, 11, 12): Planned v1.1 milestone work, continuing numbering from v1.0 (which ended at Phase 8)
- Decimal phases (e.g. 9.1): Reserved for urgent insertions via `/gsd-insert-phase`

<details>
<summary>✅ v1.0 MVP (Phases 0-8) — SHIPPED 2026-07-12</summary>

- [x] Phase 0: Infrastructure (1/1 plan) — completed 2026-05-10
- [x] Phase 1: Foundation (5/5 plans) — completed 2026-05-16
- [x] Phase 2: Data Pipeline (5/5 plans) — completed 2026-06-01
- [x] Phase 3: Dashboard UI (6/6 plans) — completed 2026-06-05
- [x] Phase 03.1: Leads Management via Google Sheets Integration (3/3 plans) — completed 2026-07-05
- [x] Phase 4: AI Insights (6/6 plans) — completed 2026-07-11
- [x] Phase 5: Access Modules — Multi-Client Agency (9/9 plans) — completed 2026-07-10
- [x] Phase 6: Security & Consistency — Leads Endpoints (4/4 plans) — completed 2026-07-11
- [x] Phase 7: Google Ads OAuth2 Connect (4/4 plans) — completed 2026-07-11
- [x] Phase 8: Tech Debt Cleanup (3/3 plans) — completed 2026-07-11

Full phase details, success criteria, and coverage validation: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Gestão de Usuários, Limpeza e Redesign Visual (In Progress)

**Milestone Goal:** Fechar débitos técnicos deixados do v1.0 (usuários, papel viewer morto, janela de histórico) e redesenhar visualmente as telas do dashboard usando os protótipos existentes como base.

- [x] **Phase 9: Limpeza do Papel Viewer** - Nenhuma referência ao papel "viewer" morto permanece em tipos, middleware, componentes ou testes (completed 2026-07-12)
- [x] **Phase 10: Gestão de Usuários** - Super Admin lista, edita e remove acesso de usuários de tenants e agências direto no app
 (completed 2026-07-13)
- [x] **Phase 11: Janela de Histórico Retroativo** - Tenant Admin configura os dias de backfill por conta conectada, com opção de ajuste posterior
 (completed 2026-07-17)
- [ ] **Phase 12: Redesign Visual** - Dashboard, Campanhas, Insights, Settings e o chrome compartilhado redesenhados conforme os protótipos de referência

## Phase Details

### Phase 9: Limpeza do Papel Viewer
**Goal**: O papel "viewer" — já impossível de existir no banco desde a migration `0020` (Phase 5) — deixa de existir também na camada de aplicação (tipos, middleware, componentes, testes), removendo código morto e simplificando o `Role` type antes de a UI de gestão de usuários ser construída sobre ele.
**Depends on**: Phase 8 (continuação sequencial pós-v1.0; sem acoplamento funcional — feature isolada, zero coupling com banco de dados)
**Requirements**: AUTH-07
**Success Criteria** (what must be TRUE):
  1. O `Role` type em `lib/stores/tenant-store.tsx` não inclui `'viewer'` como valor possível
  2. `proxy.ts` não contém nenhum branch condicional para `'viewer'` — apenas `tenant_admin`/`agency`/`super_admin` são tratados no redirecionamento por papel
  3. `components/tenants/tenant-switcher.tsx` não aceita `'viewer'` como valor válido da prop `role`
  4. A suíte de testes (`tests/middleware.test.ts` e os testes de rotas afetados) passa sem nenhum caso de teste que assuma `'viewer'` como um papel válido do sistema
**Plans**: 1 plan
- [x] 09-01-PLAN.md — Remove todas as referências ao papel morto 'viewer' (tipos, middleware, componente, comentário, 6 arquivos de teste via sentinel 'invalid_role')

### Phase 10: Gestão de Usuários
**Goal**: Super Admin gerencia o ciclo de vida completo de usuários de tenants e agências (listar, editar email, resetar senha, remover acesso) diretamente no app, sem precisar abrir o Supabase Dashboard.
**Depends on**: Phase 9 (Role type já limpo evita construir a nova UI de usuários sobre um union type com valor morto)
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05
**Success Criteria** (what must be TRUE):
  1. Super Admin vê a lista de usuários de um tenant em `/tenants/[slug]`, substituindo o placeholder "gerenciado via Supabase Dashboard"
  2. Super Admin vê a lista de usuários de uma agência em `/agencies/[id]`, substituindo o mesmo placeholder
  3. Super Admin edita o email de um usuário existente e a mudança aparece refletida na listagem
  4. Super Admin reseta a senha de um usuário existente a partir da própria tela de gestão
  5. Super Admin remove o acesso de um usuário (soft-delete do vínculo tenant/agência, conta Auth preservada) e a sessão desse usuário é revogada imediatamente via `signOut('global')`, sem depender da expiração natural do token
**Plans**: 4 plans
- [x] 10-01-PLAN.md — Fundação: migration `0023_revoke_user_sessions` (SECURITY DEFINER RPC) + push + gate `requireSuperAdmin()` + scaffolds de teste (Wave 0)
- [x] 10-02-PLAN.md — 6 Server Actions (editar email / resetar senha / remover acesso, tenant + agência) com gate super_admin e revogação de sessão
- [x] 10-03-PLAN.md — UI: tabela de usuários + dropdown de ações + 3 dialogs (scope tenant/agência) e wiring das duas páginas
- [x] 10-04-PLAN.md — Verificação humana ponta-a-ponta (Playwright prod) + observação ao vivo do comportamento D-05

### Phase 11: Janela de Histórico Retroativo
**Goal**: Tenant Admin controla quantos dias de histórico são puxados no primeiro sync de cada conta de anúncio conectada, por canal, com a opção de ajustar essa janela depois sem reconectar.
**Depends on**: Phase 9 (sequenciamento recomendado pela pesquisa de arquitetura; funcionalmente independente de Phase 10 — tabelas e rotas distintas)
**Requirements**: SET-03, SET-04, SET-05
**Success Criteria** (what must be TRUE):
  1. Tenant Admin escolhe a janela de histórico (7–365 dias, default 90) ao conectar uma conta Google Ads ou Meta Ads
  2. A janela escolhida é persistida em `ad_accounts.backfill_days` e é o valor usado pelo N8N no primeiro sync daquela conta/canal
  3. Tenant Admin altera a janela de histórico de uma conta já conectada sem precisar reconectá-la, e essa mudança afeta apenas futuros primeiros syncs (não é retroativa)
**Plans**: 5 plans
- [x] 11-01-PLAN.md — Fundação: migration `0024` (ad_accounts.backfill_days 7–365 default 90) + push + regen types + signState carrega backfillDays
- [x] 11-02-PLAN.md — Google Ads: form + connect route (assina backfillDays no state) + callback route (upsert backfill_days)
- [x] 11-03-PLAN.md — Meta Ads: form + connect route (BodySchema + upsert backfill_days) + spec
- [x] 11-04-PLAN.md — Edição pós-conexão: Server Action `updateBackfillWindow` (super_admin/tenant_admin) + controle inline otimístico + wiring na página de Settings (SET-05)
- [x] 11-05-PLAN.md — N8N: ambos workflows selecionam backfill_days e usam por conta no primeiro sync (fallback na constante global)

### Phase 12: Redesign Visual
**Goal**: As telas principais do dashboard (Overview, Campanhas, Insights, Settings) e o chrome compartilhado (header/sidebar) exibem a nova identidade visual baseada nos protótipos de referência, sem alterar os dados, hooks ou comportamento existentes.
**Depends on**: Phase 10, Phase 11 (redesign captura a forma final da UI de gestão de usuários e do campo de janela de histórico, evitando duas passadas de estilo sobre a mesma tela)
**Requirements**: DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04, DESIGN-05
**Success Criteria** (what must be TRUE):
  1. O Dashboard (Overview) reflete visualmente os protótipos de referência (`prototipos/dashboard.html`), mantendo os mesmos KPIs e dados vindos de `use-dashboard-data.ts`
  2. A página de Campanhas reflete o novo visual, preservando os filtros e o drill-down existentes
  3. A página de Insights de IA reflete o novo visual, preservando o streaming e o histórico de recomendações existentes
  4. A página de Configurações reflete o novo visual e inclui o campo de janela de histórico (SET-03/SET-05) já estilizado de acordo
  5. Header e sidebar têm aparência visual consistente nas 4 telas, mantendo o contrato de props (`role`/`tenants`/`tenantId`) de `app/[tenant-slug]/layout.tsx` para `HeaderActions`/`SidebarNav`
**Plans**: 7 plans
- [x] 12-01-PLAN.md — Fundação: tokens --viz-*, correção --chart-2/--chart-3, 6 classes utilitárias, Card em rounded-2xl/px-6
- [x] 12-02-PLAN.md — Chrome compartilhado (DESIGN-05): sidebar ativo em wash lime, header translúcido, pills de switcher/date-range
- [x] 12-03-PLAN.md — Dashboard (DESIGN-01): KPI cards por categoria, título Display, pill de sync pulsante, cards de gráfico
- [x] 12-04-PLAN.md — Campanhas (DESIGN-02): filter bar em pill-track, tabela mono/uppercase, badges de canal exatos do protótipo
- [ ] 12-05-PLAN.md — Insights (DESIGN-03): cards planos com badge mono, título Syne 700, chips de métrica, CTA lime
- [ ] 12-06-PLAN.md — Configurações (DESIGN-04): extrapolação dos tokens + polimento do BackfillWindowControl da Fase 11
- [ ] 12-07-PLAN.md — Varredura de conformidade cross-screen + verificação humana das 4 telas
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 0. Infrastructure | v1.0 | 1/1 | Complete | 2026-05-10 |
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-05-16 |
| 2. Data Pipeline | v1.0 | 5/5 | Complete | 2026-06-01 |
| 3. Dashboard UI | v1.0 | 6/6 | Complete | 2026-06-05 |
| 03.1. Leads Management | v1.0 | 3/3 | Complete | 2026-07-05 |
| 4. AI Insights | v1.0 | 6/6 | Complete | 2026-07-11 |
| 5. Access Modules — Agency | v1.0 | 9/9 | Complete | 2026-07-10 |
| 6. Security & Consistency | v1.0 | 4/4 | Complete | 2026-07-11 |
| 7. Google Ads OAuth2 Connect | v1.0 | 4/4 | Complete | 2026-07-11 |
| 8. Tech Debt Cleanup | v1.0 | 3/3 | Complete | 2026-07-11 |
| 9. Limpeza do Papel Viewer | v1.1 | 1/1 | Complete   | 2026-07-12 |
| 10. Gestão de Usuários | v1.1 | 4/4 | Complete    | 2026-07-13 |
| 11. Janela de Histórico Retroativo | v1.1 | 5/5 | Complete    | 2026-07-18 |
| 12. Redesign Visual | v1.1 | 4/7 | In Progress|  |

**v1.0 total: 10/10 phases, 46/46 plans complete.**
**v1.1: 3/4 phases complete; Phase 10 (4 plans) + Phase 11 (5 plans) complete, Phase 12 (7 plans) planned. 14/14 requirements mapped.**
</content>
