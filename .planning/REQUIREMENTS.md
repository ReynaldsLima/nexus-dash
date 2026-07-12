# Requirements: NEXUS-DASH v1.1

**Defined:** 2026-07-12
**Core Value:** O Super Admin consegue ver e otimizar campanhas de todos os clientes em um único lugar, com recomendações de IA acionáveis — sem precisar entrar em múltiplas plataformas de anúncios.

## v1.1 Requirements

Requirements para o milestone v1.1 (Gestão de Usuários, Limpeza e Redesign Visual). Cada um mapeia para uma fase do roadmap.

### Gestão de Usuários

- [ ] **USER-01**: Super Admin pode listar os usuários de um tenant na tela `/tenants/[slug]` (substitui o placeholder "gerenciado via Supabase Dashboard")
- [ ] **USER-02**: Super Admin pode listar os usuários de uma agência na tela `/agencies/[id]` (substitui o mesmo placeholder)
- [x] **USER-03**: Super Admin pode editar o email de um usuário existente
- [x] **USER-04**: Super Admin pode resetar a senha de um usuário existente
- [x] **USER-05**: Super Admin pode remover o acesso de um usuário (soft-delete — remove o vínculo com o tenant/agência, mantém a conta Auth) com revogação de sessão imediata via `signOut('global')`, evitando o gap de JWT desatualizado (claims só são re-emitidas no login/refresh) — Plan 01 built and live-verified the underlying `revoke_user_sessions` RPC; the `removeTenantUserAccess`/`removeAgencyUserAccess` Server Actions that call it are Plan 02's scope

### Limpeza de Papel Morto

- [x] **AUTH-07**: Nenhuma referência ao valor `"viewer"` permanece em tipos TypeScript (`Role` em `lib/stores/tenant-store.tsx`), middleware (`proxy.ts`), componentes (`tenant-switcher.tsx`) ou testes — apenas `super_admin`/`tenant_admin`/`agency` existem no sistema

### Janela de Histórico Retroativo

- [ ] **SET-03**: Tenant Admin escolhe a janela de histórico retroativo (7–365 dias, default 90) ao conectar uma conta Google Ads ou Meta Ads
- [ ] **SET-04**: A janela escolhida é persistida por conta (`ad_accounts.backfill_days`) e usada pelo N8N no primeiro sync daquela conta/canal
- [ ] **SET-05**: Tenant Admin pode alterar a janela de histórico depois de já conectado, sem precisar reconectar a conta (afeta apenas futuros primeiros syncs, não é retroativo)

### Redesign Visual

- [ ] **DESIGN-01**: Dashboard (Overview) redesenhado visualmente conforme os protótipos de referência (`prototipos/dashboard.html`), preservando os hooks/dados existentes (`use-dashboard-data.ts`)
- [ ] **DESIGN-02**: Página de Campanhas redesenhada visualmente, preservando filtros e drill-down existentes
- [ ] **DESIGN-03**: Página de Insights de IA redesenhada visualmente, preservando streaming e histórico existentes
- [ ] **DESIGN-04**: Página de Configurações redesenhada visualmente, incluindo o novo campo de janela de histórico (SET-03)
- [ ] **DESIGN-05**: Header/sidebar (chrome compartilhado) redesenhado de forma consistente nas 4 telas, preservando o contrato de props (`role`/`tenants`/`tenantId`) de `app/[tenant-slug]/layout.tsx` para `HeaderActions`/`SidebarNav`

## Future Requirements

Reconhecidos mas fora do escopo do v1.1.

### Gestão de Usuários

- **USER-06**: Super Admin pode mover um usuário entre tenant/agência sem recriar a conta

## Out of Scope

Explicitamente excluído do v1.1. Documentado para prevenir scope creep.

| Feature | Reason |
|---------|--------|
| Exclusão permanente de usuário (hard delete do Auth) | Usuário optou por soft-delete (reversível) em vez de exclusão irreversível — ver USER-05 |
| Re-sync retroativo automático ao mudar a janela de histórico já configurada | SET-05 é explicitamente não-retroativo — evita risco de rate limit/duplicação em contas já sincronizadas (ver ARCHITECTURE.md) |
| Fazer N8N tenant-aware via workflow separado por tenant | O `backfill_days` fica em `ad_accounts`, lido pelo workflow único existente — evita fragmentar o modelo single-workflow-per-channel |
| Mudanças de comportamento/dados além de pequenos ajustes de UX no redesign | Redesign é majoritariamente visual; qualquer mudança maior de comportamento deve virar requirement explícito, não "vir de brinde" com o redesign |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-07 | Phase 9 | Complete |
| USER-01 | Phase 10 | Pending |
| USER-02 | Phase 10 | Pending |
| USER-03 | Phase 10 | Complete |
| USER-04 | Phase 10 | Complete |
| USER-05 | Phase 10 | Pending (RPC foundation done in Plan 01, Server Action in Plan 02) |
| SET-03 | Phase 11 | Pending |
| SET-04 | Phase 11 | Pending |
| SET-05 | Phase 11 | Pending |
| DESIGN-01 | Phase 12 | Pending |
| DESIGN-02 | Phase 12 | Pending |
| DESIGN-03 | Phase 12 | Pending |
| DESIGN-04 | Phase 12 | Pending |
| DESIGN-05 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-12*
*Last updated: 2026-07-12 after roadmap creation (Phases 9-12, `/gsd-new-project` roadmapper agent)*
</content>
