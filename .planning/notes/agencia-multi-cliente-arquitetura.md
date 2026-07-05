---
title: Arquitetura de 3 módulos — Super Admin / Agência / Cliente
date: 2026-07-05
context: Exploração via /gsd-explore, logo após o fechamento da Fase 03.1
---

## Origem

Usuário pediu para dividir o produto em 3 módulos de acesso: Super Admin, Agência, Cliente. Explorado via `/gsd-explore` para entender se é mudança estrutural ou só terminologia/UI antes de criar a Fase 5 (Access Modules — Multi-Client Agency).

## Definições capturadas

- **Super Admin**: acesso total, inalterado em relação ao modelo atual. Gerencia manualmente quem tem acesso a quê — cria tenants, libera Agências.
- **Agência**: entidade nova, **sem tenant próprio**. O Super Admin libera (grant) o acesso da Agência a N tenants "Cliente" — uma Agência pode gerenciar vários clientes ao mesmo tempo (ex: Agência X vê Cliente A, B e C). Acessa Dashboard, Campanhas e Gestão de Leads consolidados dos clientes que gerencia. Pode editar status de lead.
- **Cliente**: é o tenant em si (a empresa). Só acessa o próprio tenant, não visualiza nada de outros tenants. Equivalente ao `tenant_admin` de hoje. Pode editar status de lead.
- **Regra transversal**: todos os três papéis podem alterar o status de um lead — a diferença entre eles é de **escopo** (quantos tenants enxergam) e não de permissão de escrita nessa funcionalidade específica.

## Por que é mudança estrutural, não só terminologia

O modelo atual (`super_admin` / `tenant_admin` / `viewer` em `auth.users.app_metadata`, isolamento via RLS por `tenant_id` usando `get_tenant_id()`) só reconhece um caminho de acesso: "sou membro direto deste tenant". O modelo de Agência precisa de um **segundo caminho**: "sou membro de uma agência que tem grant neste tenant" — isso não existe hoje e não é redutível a uma troca de nomes de role.

Implica provavelmente:
- Nova tabela `agencies` (+ `agency_users` para vincular usuários a uma agência)
- Tabela de junção N:N `agency_tenants` (grant de quais tenants cada agência pode ver — gerenciado manualmente pelo Super Admin, sem self-service)
- RLS estendida: políticas de `tenants`/`campaign_metrics`/etc. precisam aceitar `tenant_id IN (SELECT tenant_id FROM agency_tenants WHERE agency_id = get_user_agency_id())` como alternativa ao caminho direto por tenant
- UI de troca/visão consolidada entre os clientes de uma agência (hoje o tenant-switcher assume Super Admin vendo tudo ou um usuário vendo um único tenant)

## Próximo passo

Fase 5 (Access Modules — Multi-Client Agency) já criada no roadmap, depende da Fase 4, ainda sem plano. Recomendado rodar `/gsd-discuss-phase 5` antes de planejar, dado o tamanho da mudança (ver também pergunta de pesquisa sobre padrão de RLS N:N registrada em `.planning/research/questions.md`).
