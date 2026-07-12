# Phase 10: Gestão de Usuários - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Super Admin gerencia o ciclo de vida completo de usuários de tenants e agências (listar, editar email, resetar senha, remover acesso) diretamente no app, substituindo o placeholder "gerenciado via Supabase Dashboard" nas telas `/tenants/[slug]` e `/agencies/[id]`. Escopo é USER-01 a USER-05 — não inclui mover usuário entre tenant/agência (USER-06, fora de escopo do v1.1) nem exclusão permanente (hard delete).

</domain>

<decisions>
## Implementation Decisions

### Tabela e ações por linha

- **D-01:** As 3 ações (editar email, resetar senha, remover acesso) ficam atrás de um dropdown de ações (⋮) por linha, usando o componente `dropdown-menu.tsx` já existente no design system (nunca usado até agora) — evita poluir a linha com 3 botões lado a lado.
- **D-02:** Os formulários de editar email, resetar senha e confirmar remoção vivem em Modal/Dialog — mesmo padrão do `AddUserModal`/`AddAgencyUserModal` já existentes, não um Sheet/drawer lateral.
- **D-03:** A tabela mostra apenas email + coluna de ações. Sem data de vinculação, sem "último login" (exigiria chamada admin extra por usuário, fora de escopo).

### Fluxo de reset de senha

- **D-04:** Resetar senha gera uma nova senha temporária via `generateTempPassword()` + `supabase.auth.admin.updateUserById`, exibida uma vez num Dialog com botão "copiar" — mesmo padrão/UX do `AddUserModal` (Phase 5), não um email de recuperação do Supabase.
- **D-05:** Resetar senha NÃO revoga sessões ativas do usuário — ele continua logado normalmente, só precisa da senha nova no próximo login. Diferente do comportamento de USER-05 (remoção de acesso), que é explícito sobre revogação imediata.

### Consequência da edição de email

- **D-06:** A troca de email é imediata, sem exigir confirmação do novo endereço pelo usuário — `supabase.auth.admin.updateUserById({email, email_confirm:true})`, mesmo padrão de `email_confirm` usado na criação de usuário (Phase 5).
- **D-07:** Editar o email NÃO revoga a sessão ativa do usuário — consistente com D-05 (reset de senha também não revoga).

### UX de remoção de acesso

- **D-08:** Confirmação via `AlertDialog` simples ("tem certeza?") com botão destrutivo — sem fricção extra de digitar nome/email para confirmar. A ação é soft-delete reversível (conta Auth preservada) numa tela já restrita a Super Admin, então fricção extra tem pouco benefício real.
- **D-09:** Depois de remover o acesso, a linha desaparece da tabela (`router.refresh()`) e um toast confirma "Acesso removido e sessão encerrada" — usando `sonner`, já configurado no projeto (`components/ui/sonner.tsx`, usado hoje em `lib/hooks/use-anomaly-alerts.tsx`).

### Claude's Discretion

- **Checagem de autorização server-side em cada nova Server Action.** Nenhuma das Server Actions existentes (`createTenantUser`, `createAgencyUser`) reverifica `role` no servidor hoje — confiam apenas no `proxy.ts` guardando as rotas de página (`/tenants/*`, `/agencies/*`). Como as novas actions desta phase são sensíveis (troca de email arbitrária, reset de senha, revogação de sessão de outro usuário), Claude vai incluir uma checagem explícita `role === 'super_admin'` dentro de cada nova action, usando o mesmo padrão de decodificação de claims já usado em `proxy.ts`. Isso não é uma escolha de design — é um requisito de segurança básico que não precisa de decisão do usuário, mas os planos devem incluí-lo explicitamente (ver `<code_context>` e considerar no threat model da phase).
- **Estrutura exata dos novos Server Actions** (nomes de função, validação Zod, shape de retorno, tratamento de erro) segue o padrão já estabelecido em `lib/actions/tenants.ts` e `lib/actions/agencies.ts` — `'use server'`, Zod schema, retorno `{ok:true,...} | {error}`, `revalidatePath` após sucesso.
- **Diferenciação tenant vs agência** — a UI/rota já sabe o contexto pela página onde está (`/tenants/[slug]` vs `/agencies/[id]`), não precisa de seletor extra nem de lógica de union entre os dois tipos de vínculo.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` §Gestão de Usuários — texto completo de USER-01 a USER-05, e USER-06 como Future Requirement (fora de escopo)
- `.planning/ROADMAP.md` §Phase 10 — goal e success criteria (5 critérios)

### Padrões de UI a reaproveitar
- `components/tenants/add-user-modal.tsx` — padrão de Dialog + senha temporária exibida uma vez (base para o modal de reset de senha)
- `components/agencies/add-agency-user-modal.tsx` — mesmo padrão, versão agência
- `components/tenants/tenants-table.tsx` — padrão de tabela hand-rolled shadcn (Table/TableHeader/TableRow/TableCell), base para a nova tabela de usuários
- `components/ui/dropdown-menu.tsx` — primitivo existente no design system, ainda não usado em nenhuma tabela — Phase 10 é o primeiro consumidor
- `components/ui/sonner.tsx` — toast já configurado (usado em `lib/hooks/use-anomaly-alerts.tsx`)

### Padrões de Server Actions e dados a seguir
- `lib/actions/tenants.ts` — `createTenantUser()`: `createServiceClient()` + `supabase.auth.admin.createUser()` + insert em `tenant_users` + rollback (`auth.admin.deleteUser`) se o insert falhar
- `lib/actions/agencies.ts` — `createAgencyUser()`: mesmo padrão para `agency_users`
- `supabase/migrations/0002_create_tenants.sql` — schema `tenants`/`tenant_users` (`role CHECK IN ('tenant_admin','viewer')` — nota: viewer aqui é histórico de banco, não tocar, ver Phase 9)
- `supabase/migrations/0017_create_agencies_schema.sql` — schema `agencies`/`agency_users`/`agency_tenants` (um usuário pertence a no máximo uma agência)
- `proxy.ts` (linhas 79-93) — guarda de rota atual (`role === 'super_admin'`) para `/tenants` e `/agencies`; novas Server Actions precisam de checagem equivalente (ver Claude's Discretion)

No external specs além dos acima — requirements totalmente capturados nas decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddUserModal`/`AddAgencyUserModal`: Dialog + geração/exibição única de senha temporária — será estendido/replicado para o fluxo de reset de senha (D-04)
- `tenants-table.tsx`: padrão de tabela shadcn simples — será estendido com dropdown-menu de ações (D-01)
- `createServiceClient()`: client service-role já em uso em `lib/actions/tenants.ts`/`agencies.ts` para chamadas `auth.admin.*`

### Established Patterns
- Server Actions `'use server'` com validação Zod, retornando `{ok:true,...} | {error}`, chamando `revalidatePath` após sucesso
- Rollback pattern: se o insert na tabela de vínculo falhar após criar o usuário no Auth, chama `auth.admin.deleteUser` para não deixar conta órfã
- `dropdown-menu.tsx` existe no design system mas nunca foi usado — Phase 10 é o primeiro consumidor real
- Nenhuma Server Action existente reverifica `role` no servidor — gap de segurança pré-existente que as novas actions desta phase devem corrigir (ver Claude's Discretion)

### Integration Points
- `app/tenants/[slug]/page.tsx:67-69` — substituir o texto placeholder "A listagem de usuários é gerenciada via Supabase Dashboard em v1." pela tabela de usuários (USER-01)
- `app/agencies/[id]/page.tsx:69-71` — mesmo placeholder, mesma substituição (USER-02)
- Ambas as páginas já buscam a linha do tenant/agência via `createClient()` server-side — a query de usuários entra no mesmo local

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — em todas as 4 áreas discutidas o usuário optou pela recomendação baseada em padrões já existentes no código (`AddUserModal`, `tenants-table.tsx`, `sonner`), priorizando consistência com o que já está construído em vez de introduzir padrões novos.

</specifics>

<deferred>
## Deferred Ideas

- **USER-06** (mover usuário entre tenant/agência sem recriar a conta) — já documentado em `REQUIREMENTS.md` como Future Requirement, confirmado fora do escopo desta phase. Não foi levantado como ideia nova durante a discussão, apenas reconfirmado.

Nenhuma outra ideia de escopo surgiu durante a discussão — as 4 áreas cobriram toda a superfície de decisão da phase.

</deferred>

---

*Phase: 10-gest-o-de-usu-rios*
*Context gathered: 2026-07-12*
