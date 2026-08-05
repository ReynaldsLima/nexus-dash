---
phase: quick-260804-wnx
plan: 01
subsystem: leads
tags: [csv-export, leads, client-side]
requires: []
provides:
  - lib/leads-csv.ts (LEADS_CSV_HEADERS, escapeCsvField, leadsToCsv, buildLeadsCsvFilename)
affects:
  - app/[tenant-slug]/leads/page.tsx
tech-stack:
  added: []
  patterns:
    - "Client-side CSV export via Blob + temporary <a download> element, no server round-trip"
    - "Semicolon-delimited CSV with UTF-8 BOM for Excel pt-BR / Google Sheets compatibility"
key-files:
  created:
    - lib/leads-csv.ts
    - tests/unit/leads-csv.test.ts
  modified:
    - app/[tenant-slug]/leads/page.tsx
decisions:
  - "CSV delimiter is ';' (not ','), because Excel pt-BR treats ',' as the decimal separator and mangles the row into a single column"
  - "CSV formula injection (T-wnx-01) mitigated in escapeCsvField: fields starting with = + - @ \\t \\r get a leading ' prefix and are quoted"
  - "leadsToCsv exports whatever order it receives — no internal sorting; the caller (filtered array in page.tsx) already owns filter/search/sort"
metrics:
  duration: "3min"
  completed: 2026-08-05
---

# Quick Task 260804-wnx: Botão de exportação CSV na tela de Gestão de Leads Summary

Adiciona um botão "Exportar CSV" na barra de filtros da tela de Gestão de Leads, que baixa
exatamente os leads visíveis (categoria + busca + ordenação aplicadas) como um arquivo CSV
compatível com Excel pt-BR e Google Sheets, com mitigação de CSV formula injection.

## What Was Built

- `lib/leads-csv.ts`: lógica pura, sem dependências novas.
  - `escapeCsvField(value)`: normaliza `null`/`undefined` para `''`; prefixa campos que começam
    com `= + - @ \t \r` com `'` (mitigação T-wnx-01, CSV formula injection); duplica aspas
    internas; envolve em aspas quando o campo contém `;`, `,`, `"`, `\n` ou `\r`, ou recebeu o
    prefixo `'`.
  - `leadsToCsv(leads)`: monta o CSV com cabeçalho
    `Nome;Empresa;Produto;Status;Criado em;Resp.;Telefone`, delimitador `;`, quebras `\r\n`
    (RFC 4180), prefixado com BOM UTF-8 (`﻿`). A coluna Status usa o rótulo normalizado
    (`CATEGORY_LABELS[cat(status)]`), não o texto cru da planilha. Não reordena — preserva
    exatamente a ordem recebida.
  - `buildLeadsCsvFilename(slug, date)`: `leads-{slug}-{YYYY}-{MM}-{DD}.csv` com componentes de
    data locais (não UTC), zero-padded.
- `tests/unit/leads-csv.test.ts`: 16 casos cobrindo escaping (`; , " \n`), campos vazios/null,
  formula injection, cabeçalho, BOM, CRLF, ordem preservada, mapeamento de colunas e nome de
  arquivo.
- `app/[tenant-slug]/leads/page.tsx`: botão "Exportar CSV" inserido na barra de filtros, logo
  após o contador `{filtered.length} result.`. `handleExport()` chama `leadsToCsv(filtered)`
  (não `leads`) — respeita filtro de categoria, busca e ordenação já aplicados na tela — gera um
  `Blob` e dispara o download via elemento `<a>` temporário. Botão desabilitado quando
  `filtered.length === 0`.

## Deviations from Plan

None — plan executado exatamente como escrito. (A suíte de teste ganhou 1 caso extra além dos
15 do plano — verificação isolada de `LEADS_CSV_HEADERS` — sem alterar o comportamento
especificado.)

## Verification

- `npm test -- tests/unit/leads-csv.test.ts` — 16/16 verdes.
- `npm test` (suíte completa) — sem regressão nos arquivos tocados; 1 falha pré-existente e não
  relacionada em `tests/unit/anomaly-alerts-schema.test.ts` (teste de integração Realtime contra
  Supabase live, fora do escopo desta task — não modificamos `anomaly_alerts` nem código
  relacionado).
- `npx tsc --noEmit` — nenhum erro novo em `lib/leads-csv.ts` ou
  `app/[tenant-slug]/leads/page.tsx`.
- `npm run lint` — nenhum warning novo nos dois arquivos tocados (avisos pré-existentes em
  `lib/stores/tenant-store.tsx`, `lib/sync-status.ts` e arquivos de teste não relacionados,
  fora de escopo).

## Self-Check: PASSED

- FOUND: lib/leads-csv.ts
- FOUND: tests/unit/leads-csv.test.ts
- FOUND: app/[tenant-slug]/leads/page.tsx (modified)
- FOUND commit db8763f (test: add failing tests)
- FOUND commit 2bce269 (feat: implement leads CSV generation)
- FOUND commit 7ca9009 (feat: add Exportar CSV button)
