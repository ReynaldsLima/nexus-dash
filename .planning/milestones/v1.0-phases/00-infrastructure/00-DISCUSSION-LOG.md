# Phase 0: Infrastructure — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 00-infrastructure
**Areas discussed:** VPS Provider e specs, N8N editor security, Supabase region + Vercel, Pré-requisitos externos

---

## VPS Provider e specs

| Option | Description | Selected |
|--------|-------------|----------|
| Hetzner Cloud | CX22: 2 vCPU, 4 GB RAM — €4.35/mês | |
| DigitalOcean Droplet | Basic 2 GB — $12/mês, data center SP | |
| Vultr | 1 GB — $6/mês, data center SP | |
| Render / Railway | PaaS Docker | |
| **Hostinger (existente)** | **VPS 2+ GB RAM — N8N já instalado** | ✓ |

**User's choice:** N8N já está instalado e operacional em `evo.wrdigitalgroup.com.br` (Hostinger VPS 2+ GB RAM)

| Detalhe | Resposta |
|---------|----------|
| Instalação N8N | NPM / Node direto (sem Docker) |
| Backend N8N | PostgreSQL ✓ |
| N8N_ENCRYPTION_KEY | Configurada ✓ |
| Acesso ao editor | Login nativo N8N (email+senha) ✓ |

---

## N8N Editor Security

| Option | Description | Selected |
|--------|-------------|----------|
| **Só login N8N** | **Autenticação nativa suficiente para v1 interno** | ✓ |
| IP allowlist Hostinger | Bloquear porta para IPs específicos via firewall | |
| Cloudflare Access | Zero-trust SSO gratuito | |

**User's choice:** Login N8N nativo é suficiente para uso interno com 1-3 tenants

| Detalhe | Resposta |
|---------|----------|
| Subdomínio N8N | `evo.wrdigitalgroup.com.br` — dedicado ao N8N |
| App Next.js | Outro domínio/URL |

---

## Supabase Region + Vercel

| Option | Description | Selected |
|--------|-------------|----------|
| **South America (sa-east-1) — São Paulo** | **Menor latência para Brasil** | ✓ |
| US East (us-east-1) — Virginia | Mais extensões, compatível Vercel East | |
| Projeto já existe | Verificar região | |

| Option | Description | Selected |
|--------|-------------|----------|
| 2 projetos separados | Isolamento total — recomendado | |
| **1 projeto + schemas** | **schema public (prod) + schema staging** | ✓ |
| 1 projeto + Supabase Branching | Beta | |

| Option | Description | Selected |
|--------|-------------|----------|
| nexusdash.com.br | Domínio dedicado — pagar e configurar | |
| Subdomínio wrdigitalgroup | dash.wrdigitalgroup.com.br | |
| **Vercel .app por enquanto** | **nexus-dash.vercel.app até decidir domínio** | ✓ |

**Notes:** `vercel.json` deve usar `"regions": ["gru1"]` para coincidir com Supabase São Paulo

---

## Pré-requisitos externos

| Item | Status | Ação necessária |
|------|--------|----------------|
| Google Ads Developer Token | ❌ **NÃO EXISTE** | Solicitar Standard Access em https://ads.google.com/aw/apicenter — BLOQUEIO para Phase 2 |
| Google OAuth App | ✅ Publicado (Production) | Nenhuma |
| Meta Business Manager | ✅ Configurado | Nenhuma |
| Meta System User tokens | ✅ Prontos | Nenhuma |

---

## Deferred Ideas

- Domínio customizado para o app
- Cloudflare Access no N8N
- Supabase Branching para staging
