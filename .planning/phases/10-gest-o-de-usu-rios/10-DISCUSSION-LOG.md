# Phase 10: Gestão de Usuários - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 10-gest-o-de-usu-rios
**Areas discussed:** Padrão de tabela e ações por linha, Fluxo de reset de senha, Consequência da edição de email, UX de remoção de acesso

---

## Padrão de tabela e ações por linha

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown de ações (⋮) | Botão ⋮ abre menu com as 3 opções, usando dropdown-menu.tsx existente | ✓ |
| Botões inline | 3 botões/ícones lado a lado por linha | |

**User's choice:** Dropdown de ações (⋮)

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/Dialog | Mesmo padrão do AddUserModal/AddAgencyUserModal | ✓ |
| Sheet/drawer lateral | Painel lateral deslizante, padrão novo | |

**User's choice:** Modal/Dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Apenas email | Tabela mínima, só email + ações | ✓ |
| Data de vinculação | Mostrar created_at do vínculo | |
| Último login | Mostrar last_sign_in_at (custa chamada admin extra) | |

**User's choice:** Apenas email
**Notes:** Todas as recomendações aceitas sem contestação.

---

## Fluxo de reset de senha

| Option | Description | Selected |
|--------|-------------|----------|
| Gerar senha temporária e exibir uma vez | Mesmo padrão do AddUserModal/AddAgencyUserModal | ✓ |
| Disparar email de recuperação do Supabase | resetPasswordForEmail, depende de SMTP configurado | |

**User's choice:** Gerar senha temporária e exibir uma vez

| Option | Description | Selected |
|--------|-------------|----------|
| Apenas gera a nova senha | Não revoga sessões ativas | ✓ |
| Também revoga sessões ativas (signOut global) | Mesma mecânica de USER-05, não pedida em USER-04 | |

**User's choice:** Apenas gera a nova senha (não revoga sessões)
**Notes:** Distinção clara com USER-05: reset de senha não revoga sessão, remoção de acesso revoga.

---

## Consequência da edição de email

| Option | Description | Selected |
|--------|-------------|----------|
| Imediata, sem confirmação | email_confirm:true, mesmo padrão da criação | ✓ |
| Exige confirmação do novo endereço | Link de confirmação enviado ao novo email | |

**User's choice:** Imediata, sem confirmação

| Option | Description | Selected |
|--------|-------------|----------|
| Não revoga sessão | Usuário continua logado | ✓ |
| Revoga sessão (signOut global) | Força relogin imediato | |

**User's choice:** Não revoga sessão
**Notes:** Consistente com a decisão de reset de senha (D-05).

---

## UX de remoção de acesso

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog simples "tem certeza?" | AlertDialog padrão, sem fricção extra | ✓ |
| Fricção extra (digitar nome/email) | Padrão para exclusões irreversíveis — não é o caso (soft-delete) | |

**User's choice:** Dialog simples "tem certeza?"

| Option | Description | Selected |
|--------|-------------|----------|
| Linha some da lista + toast de confirmação | router.refresh() + sonner (já configurado no projeto) | ✓ |
| Mensagem inline sem remover a linha | Mantém histórico visível na mesma tela, fora do escopo pedido | |

**User's choice:** Linha some da lista + toast de confirmação
**Notes:** Confirmado que `sonner` já está configurado no projeto (`components/ui/sonner.tsx`, usado em `use-anomaly-alerts.tsx`).

---

## Claude's Discretion

- Checagem de autorização server-side (`role === 'super_admin'`) dentro de cada nova Server Action — gap de segurança pré-existente identificado no scouting (nenhuma action atual reverifica role), corrigido por padrão nesta phase sem precisar de decisão do usuário.
- Estrutura exata das novas Server Actions — segue o padrão de `lib/actions/tenants.ts`/`agencies.ts`.
- Diferenciação tenant vs agência — resolvida pelo contexto de rota, sem seletor extra.

## Deferred Ideas

- USER-06 (mover usuário entre tenant/agência) — já era Future Requirement em REQUIREMENTS.md, reconfirmado fora de escopo, nenhuma ideia nova de escopo surgiu.
