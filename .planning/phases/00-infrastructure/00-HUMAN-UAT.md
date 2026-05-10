---
status: partial
phase: 00-infrastructure
source: [00-VERIFICATION.md]
started: 2026-05-10T21:00:00Z
updated: 2026-05-10T21:00:00Z
---

## Current Test

[aguardando confirmação humana — 3 itens N8N + 2 itens dashboard]

## Tests

### 1. N8N health endpoint retorna {status:ok}
expected: `curl -s http://localhost:5678/healthz` retorna `{"status":"ok"}` no VPS
result: [pending]

### 2. N8N versão >= 1.88.0 (CVE-2025-68613 CVSS 10.0)
expected: `n8n --version` retorna 1.88.0 ou superior
result: [pending]

### 3. N8N editor requer autenticação (não aberto)
expected: `curl -I https://evo.wrdigitalgroup.com.br/` retorna HTTP 401 ou redirect
result: [pending]

### 4. N8N_ENCRYPTION_KEY persiste em disco
expected: chave presente em arquivo persistente (systemd/pm2/.env), não apenas em memória — sobrevive reboot
result: [pending]

### 5. Vercel Dashboard — gru1 + 5 vars + secrets sem NEXT_PUBLIC_
expected: Settings > Functions mostra gru1; 5 variáveis presentes; SUPABASE_SERVICE_ROLE_KEY e ANTHROPIC_API_KEY marcados Sensitive sem prefixo NEXT_PUBLIC_
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
