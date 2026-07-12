# Phase 0: Infrastructure — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Provisionar e conectar o ambiente completo (VPS/N8N existente + Supabase + Vercel) antes de qualquer código de aplicação ser escrito. Esta fase é inteiramente operacional — sem código Next.js, sem schema de banco de dados de produto, sem N8N workflows de integração.

</domain>

<decisions>
## Implementation Decisions

### VPS e N8N (Existente)
- **D-01:** N8N já está instalado e operacional em `evo.wrdigitalgroup.com.br` (Hostinger VPS 2+ GB RAM, NPM install, PostgreSQL como backend do N8N)
- **D-02:** `N8N_ENCRYPTION_KEY` já está configurada — não é necessário gerar nova ou reconfigurar credenciais existentes
- **D-03:** N8N usa autenticação nativa (email + senha) — sem camada adicional de segurança por enquanto; suficiente para uso interno v1
- **D-04:** N8N fica em `evo.wrdigitalgroup.com.br` — esse subdomínio é dedicado ao N8N; o app Next.js vai para outro endereço

### Supabase
- **D-05:** Região do projeto Supabase prod: **South America (sa-east-1) — São Paulo** — menor latência para usuários brasileiros
- **D-06:** Estratégia de ambiente: **1 projeto Supabase + schemas separados** — schema `public` para prod, schema `staging` para testes. Atenção: compartilham os limites do free tier (500 MB banco, 2 GB bandwidth)
- **D-07:** `vercel.json` deve setar `"regions": ["gru1"]` (Vercel South America) para coincidir com Supabase São Paulo

### Vercel e Domínio
- **D-08:** Domínio inicial: URL gerado pelo Vercel (`.vercel.app`) — domínio customizado decidido depois
- **D-09:** Deploy automático: push para `main` → prod; push para outras branches → preview URLs

### Pré-requisitos externos
- **D-10:** Google OAuth App já está publicado (Production) — tokens dos tenants não expiram em 7 dias ✓
- **D-11:** Meta Business Manager + System User já configurados para os tenants iniciais ✓
- **D-12:** **BLOQUEIO CRÍTICO:** Google Ads Developer Token ainda NÃO existe. Deve ser solicitado durante a Phase 0. Sem ele, a Phase 2 (Data Pipeline — Google Ads sync) é impossível. Aplicar em: https://ads.google.com/aw/apicenter — solicitar Standard Access direto (Basic Access pode ser insuficiente para backfill de 90 dias com 3 tenants)

### Claude's Discretion
- Método exato de instalação de dependências no VPS para novos tools (se necessário)
- Configuração de alertas de disco/memória no Hostinger (além do mínimo funcional)
- Estrutura interna dos schemas Supabase staging vs prod (convenções de nomenclatura de tabelas)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Supabase Setup
- `.planning/research/STACK.md` — padrões de integração Supabase + Next.js App Router, `@supabase/ssr` vs deprecated `@supabase/auth-helpers-nextjs`
- `.planning/research/PITFALLS.md` §"Supabase RLS" — armadilhas de RLS e free tier limits (500 MB)
- `.planning/research/ARCHITECTURE.md` §"Multi-tenancy / RLS" — padrão shared schema + RLS

### N8N
- `.planning/research/PITFALLS.md` §"N8N self-hosted" — encryption key, CVE-2025-68613, SQLite vs Postgres
- `.planning/research/STACK.md` §"N8N → Supabase Write Strategy" — HTTP Request node obrigatório (bug #17020)

### Google Ads API
- `.planning/research/PITFALLS.md` §"Google Ads API" — token de desenvolvedor, Standard vs Basic Access, versão de API
- Solicitar token: https://ads.google.com/aw/apicenter

### Vercel
- `.planning/research/STACK.md` §"Vercel Deployment Optimization" — região, maxDuration, limites do Hobby tier
- `.planning/research/PITFALLS.md` §"Vercel + Next.js" — limites do Hobby tier, cold starts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — projeto greenfield. Nenhum código de aplicação existe ainda.

### Established Patterns
- N8N já está funcionando em prod no Hostinger — padrões de N8N podem ser estendidos em Phase 2

### Integration Points
- N8N em `evo.wrdigitalgroup.com.br` será o endpoint que Phase 2 vai configurar para chamar Google Ads e Meta APIs
- Supabase São Paulo será o endpoint que Phase 1 vai usar para criar o schema e configurar RLS

</code_context>

<specifics>
## Specific Ideas

- N8N backend já usa PostgreSQL — isso é importante; pesquisa recomendou Postgres sobre SQLite para N8N em produção e esse requisito já está satisfeito
- Verificar se `N8N_EXECUTION_DATA_SAVE_ON_SUCCESS` está configurado como `none` para workflows de sync (reduz disco e crescimento do banco do N8N)
- Schema staging no mesmo projeto Supabase: usar prefixo `stg_` nas tabelas ou schema separado `staging`? Schema separado é mais limpo

</specifics>

<deferred>
## Deferred Ideas

- Domínio customizado para o app (nexusdash.com.br ou dash.wrdigitalgroup.com.br) — decidir quando o produto estiver próximo do primeiro acesso de cliente real
- IP allowlist / Cloudflare Access no N8N — adicionar se surgir preocupação de segurança ou quando abrir para mais usuários
- Supabase Branching (beta) — considerar na evolução para SaaS se o workflow de staging/prod precisar de mais robustez

</deferred>

---

*Phase: 00-infrastructure*
*Context gathered: 2026-05-10*
