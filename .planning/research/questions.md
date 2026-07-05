# Research Questions

Perguntas em aberto que precisam de investigação antes ou durante o planejamento de uma fase.

## Pendentes

### Padrão de RLS no Supabase para acesso N:N via entidade intermediária (Agência → múltiplos tenants)

**Origem:** Exploração "Arquitetura de 3 módulos" (2026-07-05), ver `.planning/notes/agencia-multi-cliente-arquitetura.md`. Relevante para Fase 5 (Access Modules — Multi-Client Agency).

**Contexto:** Hoje a RLS do projeto isola por `tenant_id` via `(SELECT get_tenant_id())` — um usuário só enxerga o próprio tenant. A Fase 5 precisa que uma "Agência" (sem tenant próprio) enxergue múltiplos tenants "Cliente" definidos por um grant N:N (tabela `agency_tenants`), sem virar acesso global e sem degradar performance (RLS avaliada por linha).

**Perguntas a responder:**
- Qual o padrão recomendado (Supabase docs / comunidade) para RLS que precisa checar pertencimento a um conjunto de tenants via tabela de junção, em vez de um único `tenant_id`?
- `(SELECT tenant_id FROM agency_tenants WHERE agency_id = get_user_agency_id())` dentro de uma policy `USING (tenant_id IN (...))` tem armadilhas de performance conhecidas (N+1, falta de index) em tabelas grandes como `campaign_metrics`?
- Como estruturar `get_user_agency_id()` de forma consistente com o padrão já usado (`get_user_role()`, `get_tenant_id()` — funções `SECURITY DEFINER` lidas do JWT `app_metadata` custom claims via Access Token Hook)?
- Um usuário de Agência deveria ter `tenant_id` nulo no JWT, ou um `agency_id` adicional ao lado do `tenant_id`? Isso afeta o Custom Access Token Hook (migration 0005).
