---
phase: 11-janela-de-hist-rico-retroativo
verified: 2026-07-18T16:09:01Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Conectar uma conta Google Ads real via OAuth escolhendo uma janela diferente de 90 (ex.: 30) e confirmar que ad_accounts.backfill_days recebe 30 após o callback"
    expected: "Linha em ad_accounts para o canal google_ads reflete o valor escolhido no formulário, não o default 90"
    why_human: "Requer o consentimento real do Google OAuth (bloqueado no ambiente automatizado desde a Phase 7, D-03) — não pode ser exercitado por testes unitários"
  - test: "Conectar uma conta Meta Ads real (System User token válido) escolhendo uma janela diferente de 90 e confirmar backfill_days persistido"
    expected: "Linha em ad_accounts para o canal meta_ads reflete o valor escolhido"
    why_human: "Requer um Meta System User token e ad account reais; a rota está coberta por testes unitários com mocks, não por uma chamada real ao Graph API"
  - test: "Como tenant_admin logado, editar a janela de uma conta já conectada usando o BackfillWindowControl na tela de Settings e observar o comportamento visual (Salvar aparecendo/desaparecendo, revert em caso de erro simulado)"
    expected: "Campo sempre editável, botão Salvar só aparece ao mudar o valor, erro reverte o campo visualmente com o bloco role=alert"
    why_human: "Comportamento de UI/interação em tempo real (otimista + revert) não é verificável apenas por grep/leitura estática de código"
  - test: "Reimportar/ativar os dois workflows atualizados (google-ads-sync.json, meta-ads-sync.json) na instância N8N real e rodar um primeiro sync de uma conta com backfill_days customizado, confirmando que o range de datas pedido à API do canal reflete o valor customizado"
    expected: "O primeiro sync usa o backfill_days da conta (não o default global) para calcular date_from"
    why_human: "N8N roda em uma instância externa (VPS self-hosted); não há ambiente de execução do workflow disponível para o verificador automatizado"
---

# Phase 11: Janela de Histórico Retroativo Verification Report

**Phase Goal:** Tenant Admin controla quantos dias de histórico são puxados no primeiro sync de cada conta de anúncio conectada, por canal, com a opção de ajustar essa janela depois sem reconectar.
**Verified:** 2026-07-18T16:09:01Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Tenant Admin escolhe a janela de histórico (7–365 dias, default 90) ao conectar uma conta Google Ads ou Meta Ads | ✓ VERIFIED | `components/settings/google-ads-form.tsx` and `components/settings/meta-ads-form.tsx` both have a `type="number"` input (`min={7}`, `max={365}`, default 90) registered as `backfillDays` in their Zod schemas, wired into the connect request (query string for Google, JSON body for Meta). `app/api/google-ads/connect/route.ts` validates via `BackfillDaysSchema = z.coerce.number().int().min(7).max(365).catch(90)` and signs it into the OAuth state via `signState(tenantId, tenantSlug, customerId, backfillDays)`. `app/api/meta-ads/connect/route.ts`'s `BodySchema` validates `backfillDays: z.number().int().min(7).max(365).default(90)`. 20 unit tests (connect+callback) and 3 unit tests (meta connect) cover explicit/default/out-of-range cases, all passing. |
| 2 | A janela escolhida é persistida em `ad_accounts.backfill_days` e é o valor usado pelo N8N no primeiro sync daquela conta/canal | ✓ VERIFIED | Migration `supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql` adds `backfill_days INTEGER NOT NULL DEFAULT 90 CHECK (backfill_days BETWEEN 7 AND 365)`; `types/database.types.ts` regenerated with `backfill_days: number` in the ad_accounts Row/Insert/Update types. `app/api/google-ads/callback/route.ts` destructures `backfillDays` from the verified state and upserts `backfill_days: backfillDays`. `app/api/meta-ads/connect/route.ts` upserts `backfill_days: parsed.data.backfillDays`. Both `n8n-workflows/google-ads-sync.json` and `n8n-workflows/meta-ads-sync.json` select `backfill_days` in the `List active … accounts` PostgREST query and use `$('Loop tenants').item.json.backfill_days ?? $('Set Constants').first().json.BACKFILL_DAYS` in the `Compute date range` Code node's first-sync branch (`INCREMENTAL_DAYS` branch untouched). Both JSON files parse as valid JSON. |
| 3 | Tenant Admin altera a janela de histórico de uma conta já conectada sem precisar reconectá-la, e essa mudança afeta apenas futuros primeiros syncs (não é retroativa) | ✓ VERIFIED | `lib/actions/ad-accounts.ts` exports `updateBackfillWindow`, gated for `super_admin` OR own-tenant `tenant_admin` (tenant scope resolved via `getClaims()`, never `getUser().app_metadata`), performing a service-role `.update({ backfill_days: parsed.data.days }).eq('tenant_id', ...).eq('channel', ...)`. `components/settings/backfill-window-control.tsx` is an always-editable inline number control (no "Editar" toggle/dialog), shows "Salvar" only when `value !== persisted`, calls `updateBackfillWindow` optimistically and reverts `value`/`persisted` plus shows an inline `role="alert"` error on failure. Wired into `app/[tenant-slug]/settings/page.tsx` next to each `ChannelStatusBadge`, guarded on `status !== 'not_configured'`, fed with real fetched `metaBackfillDays`/`googleBackfillDays` (not hardcoded). 6 unit tests in `tests/unit/ad-accounts-actions.test.ts` cover super_admin ok, own-tenant tenant_admin ok, cross-tenant tenant_admin rejected, unauthenticated rejected, and out-of-range rejected — all passing. Non-retroactivity is enforced by design (only `ad_accounts.backfill_days` is written; N8N only reads it on `isFirstSync === true`) and communicated via fixed D-05 help text in both the connect forms and the control. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/0024_add_backfill_days_to_ad_accounts.sql` | ALTER TABLE + CHECK 7-365 DEFAULT 90 | ✓ VERIFIED | Exact SQL present, matches plan literally |
| `types/database.types.ts` | regenerated types incl. backfill_days | ✓ VERIFIED | `backfill_days: number` present in ad_accounts Row/Insert/Update (3 occurrences) |
| `lib/google-ads/oauth-state.ts` | StatePayload.backfillDays + 4-arg signState | ✓ VERIFIED | `backfillDays: number` in interface; `signState(tenantId, tenantSlug, customerId, backfillDays)` |
| `app/api/google-ads/connect/route.ts` | parse+validate+sign backfillDays | ✓ VERIFIED | `BackfillDaysSchema`, `.catch(90)`, passed to `signState` |
| `app/api/google-ads/callback/route.ts` | read payload.backfillDays, upsert backfill_days | ✓ VERIFIED | destructured + `backfill_days: backfillDays` in upsert |
| `components/settings/google-ads-form.tsx` | backfillDays input → connect query string | ✓ VERIFIED (with WR-01 gap, see below) | Input present, wired into URLSearchParams; default hardcoded to 90 regardless of existing persisted value |
| `app/api/meta-ads/connect/route.ts` | BodySchema.backfillDays + upsert | ✓ VERIFIED | `z.number().int().min(7).max(365).default(90)`, upsert `backfill_days: parsed.data.backfillDays` |
| `components/settings/meta-ads-form.tsx` | backfillDays input → POST body | ✓ VERIFIED (with WR-01 gap, see below) | Same pattern as Google form, same default-90 gap |
| `tests/unit/meta-ads-connect-route.test.ts` | spec asserting backfill_days reaches upsert | ✓ VERIFIED | 3/3 tests passing (45, default 90, 400 out-of-range) |
| `lib/actions/ad-accounts.ts` | updateBackfillWindow Server Action | ✓ VERIFIED | Exported, scoped auth gate, service-role update |
| `components/settings/backfill-window-control.tsx` | always-editable inline control, optimistic+revert | ✓ VERIFIED | Matches D-02/D-03/D-05/D-06 exactly |
| `app/[tenant-slug]/settings/page.tsx` | backfill_days in select + control wired per channel | ✓ VERIFIED | select widened, control rendered twice, guarded on `!== 'not_configured'` |
| `n8n-workflows/google-ads-sync.json` | select + use backfill_days | ✓ VERIFIED | select includes `backfill_days`; Compute date range uses per-account value with fallback |
| `n8n-workflows/meta-ads-sync.json` | select + use backfill_days | ✓ VERIFIED | Same as Google; Meta `act_` prefix handling untouched |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `google-ads-form.tsx` onSubmit | `/api/google-ads/connect` | `backfillDays` query param | ✓ WIRED | `URLSearchParams({..., backfillDays: String(values.backfillDays)})` |
| `google-ads/connect/route.ts` | `oauth-state.ts signState` | `backfillDays` 4th arg | ✓ WIRED | `signState(tenantId, tenantSlug, customerId, backfillDays)` |
| `google-ads/callback/route.ts` | `ad_accounts.backfill_days` | upsert payload | ✓ WIRED | `backfill_days: backfillDays` in upsert object |
| `meta-ads-form.tsx` onSubmit | `/api/meta-ads/connect` | `backfillDays` POST body field | ✓ WIRED | JSON body includes `backfillDays: values.backfillDays` |
| `meta-ads/connect/route.ts` | `ad_accounts.backfill_days` | upsert payload | ✓ WIRED | `backfill_days: parsed.data.backfillDays` |
| `backfill-window-control.tsx` | `lib/actions/ad-accounts.ts updateBackfillWindow` | direct call in onSave | ✓ WIRED | imported and awaited in `onSave` |
| `settings/page.tsx fetchTenantSettings` | `ad_accounts.backfill_days` | `.select('channel, active, account_id, backfill_days')` | ✓ WIRED | select confirmed; values flow into `metaBackfillDays`/`googleBackfillDays` and then into `BackfillWindowControl.initialDays` |
| `n8n google-ads-sync.json Compute date range` | `ad_accounts.backfill_days` | `$('Loop tenants').item.json.backfill_days ?? BACKFILL_DAYS` | ✓ WIRED | confirmed in jsCode string |
| `n8n meta-ads-sync.json Compute date range` | `ad_accounts.backfill_days` | same pattern | ✓ WIRED | confirmed in jsCode string |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `BackfillWindowControl` (Meta card) | `initialDays` | `metaBackfillDays ?? 90` ← `fetchTenantSettings` `.select(...backfill_days...)` from live `ad_accounts` query (TanStack Query) | Yes — real DB-backed value, `90` only as null-coalesce fallback, not a hardcoded stub | ✓ FLOWING |
| `BackfillWindowControl` (Google card) | `initialDays` | `googleBackfillDays ?? 90` ← same query | Yes | ✓ FLOWING |
| `google-ads-form.tsx` / `meta-ads-form.tsx` `backfillDays` default | `defaultValues.backfillDays` | hardcoded literal `90`, NOT threaded from `googleBackfillDays`/`metaBackfillDays` already fetched by the parent page | No — reconnect flow always shows 90 regardless of a previously customized value | ⚠️ STATIC (see WR-01 below; not a roadmap SC blocker, only affects reconnect edge case) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SET-03 | 11-01, 11-02, 11-03 | Tenant Admin escolhe a janela (7–365, default 90) ao conectar | ✓ SATISFIED | Both forms + both connect routes validate and carry `backfillDays` end-to-end |
| SET-04 | 11-01, 11-02, 11-03, 11-05 | Janela persistida em `ad_accounts.backfill_days`, usada pelo N8N no primeiro sync | ✓ SATISFIED | Column live, callback/connect routes upsert it, both N8N workflows select + use it with fallback |
| SET-05 | 11-04 | Tenant Admin altera a janela pós-conexão sem reconectar, não retroativo | ✓ SATISFIED | `updateBackfillWindow` + `BackfillWindowControl` deliver this; non-retroactivity by design (N8N only reads on first sync) |

No orphaned requirements found — REQUIREMENTS.md maps exactly SET-03/SET-04/SET-05 to Phase 11, all three appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `components/settings/google-ads-form.tsx` | 113 | `defaultValues.backfillDays: 90` hardcoded, not threaded from persisted value | ⚠️ Warning (WR-01, from 11-REVIEW.md) | Reconnecting an already-configured account silently resets a previously customized window back to 90 on the next upsert. Does not affect the initial-connect success criterion; only a reconnect edge case. Not retroactive/no data loss. |
| `components/settings/meta-ads-form.tsx` | 87 | same pattern | ⚠️ Warning (WR-01) | Same as above for Meta channel |
| `lib/actions/ad-accounts.ts` | 67 | `revalidatePath` targets a route the client-only `useQuery` page doesn't actually read from | ⚠️ Warning (WR-02, from 11-REVIEW.md) | Stale UI possible after 5-min `staleTime` window elapses across navigations; masked in-session by the control's own optimistic state |
| `components/settings/backfill-window-control.tsx` | 36-50 | `onSave` awaits the Server Action with no `try/catch` | ⚠️ Warning (WR-03, from 11-REVIEW.md) | A transport-level Server Action rejection (not the function's own `{error}` return) would leave `saving` stuck `true` with no error surfaced |
| `app/[tenant-slug]/settings/page.tsx` | 148 | `data!` non-null assertion when query is `enabled: !!tenantSlug` | ⚠️ Warning (WR-04, from 11-REVIEW.md) | Theoretical crash if `tenantSlug` is momentarily falsy; unlikely under normal `[tenant-slug]` routing today |

No blockers (🛑) found. No TODO/FIXME/placeholder stubs found in any Phase 11 file. All four warnings above were already identified and documented in `11-REVIEW.md` (0 critical, 4 warnings) prior to this verification pass; they are logic/UX hardening gaps, not missing functionality — none of them prevent any of the three roadmap Success Criteria from being true today.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| oauth-state round-trip carries backfillDays | `npx vitest run tests/unit/oauth-state.test.ts` | 6/6 passed | ✓ PASS |
| Google connect route signs validated backfillDays (30/default/out-of-range) | `npx vitest run tests/unit/google-ads-connect-route.test.ts` | 12/12 passed | ✓ PASS |
| Google callback route upserts backfill_days from verified state | `npx vitest run tests/unit/google-ads-callback-route.test.ts` | 8/8 passed | ✓ PASS |
| Meta connect route validates + upserts backfill_days | `npx vitest run tests/unit/meta-ads-connect-route.test.ts` | 3/3 passed | ✓ PASS |
| updateBackfillWindow Server Action scope + write | `npx vitest run tests/unit/ad-accounts-actions.test.ts` | 6/6 passed | ✓ PASS |
| No new TypeScript errors introduced | `npx tsc --noEmit` | Only the 2 pre-existing unrelated `vault-rpc.test.ts` errors remain | ✓ PASS |
| Both N8N workflow JSON files still parse | `node -e "JSON.parse(...)"` on both files | both valid | ✓ PASS |
| Live Google OAuth consent + real Meta Graph API connect flow | N/A — no live credentials/server in this environment | not run | ? SKIP (routed to human verification) |
| N8N workflow execution against a live instance | N/A — N8N runs on an external self-hosted VPS | not run | ? SKIP (routed to human verification) |

### Human Verification Required

### 1. Live Google Ads OAuth connect with a custom backfill window

**Test:** Connect a real Google Ads account choosing a backfill window other than 90 (e.g. 30) through the actual Google OAuth consent screen.
**Expected:** `ad_accounts.backfill_days` for that tenant/channel row reflects the chosen value (30), not the default.
**Why human:** Requires real Google OAuth consent (blocked in this automated environment since Phase 7, per D-03) — cannot be exercised by unit tests alone, only by mocks.

### 2. Live Meta Ads connect with a custom backfill window

**Test:** Connect a real Meta Ads account (valid System User token + ad account) choosing a backfill window other than 90.
**Expected:** `ad_accounts.backfill_days` for the meta_ads row reflects the chosen value.
**Why human:** Requires a real Meta System User token and Graph API round-trip; the route is only mock-tested today.

### 3. Post-connect inline edit UX (BackfillWindowControl)

**Test:** As a tenant_admin, open Settings for an already-connected account, change the number, observe the "Salvar" button appearing, click it, and (separately) simulate/force a save failure to observe the revert + inline error.
**Expected:** Field always editable; "Salvar" appears only on change; on success the field simply reflects the new persisted value (no toast); on failure the field reverts and an inline `role="alert"` error appears.
**Why human:** Real-time optimistic UI/interaction behavior — not verifiable from static code alone.

### 4. N8N first-sync honoring per-account backfill window

**Test:** Re-import/activate both updated workflow JSON files in the live N8N instance and trigger a first sync for an account with a customized `backfill_days`, confirming the computed `date_from` matches the customized window (not the global constant).
**Expected:** The first sync's date range reflects the per-account value.
**Why human:** N8N runs on an external self-hosted VPS with no execution environment available to this verifier; also flagged in `11-REVIEW.md` IN-03 that a pre-existing (out-of-phase-scope) Vault secret naming mismatch could prevent the sync pipeline from running at all — worth checking as part of this same manual pass.

### Gaps Summary

No gaps block the three roadmap Success Criteria — all are code-complete, unit-tested (35/35 new/updated tests green), and consistent end-to-end from form to DB to N8N per static analysis. Four warnings from `11-REVIEW.md` (reconnect silently resetting a customized window to 90, `revalidatePath` not invalidating the client-side query cache the Settings page actually reads, missing `try/catch` around the Server Action call in the optimistic control, and a `data!` non-null assertion edge case) remain open but do not block goal achievement — they are UX/hardening gaps, not missing functionality, and were already surfaced in the code review rather than newly discovered here.

The phase is marked `human_needed` rather than `passed` solely because the live, end-to-end paths (real Google OAuth consent, real Meta Graph API token, live N8N execution, and the optimistic-UI interaction itself) cannot be exercised by an automated verifier and require a human to confirm the last mile.

---

*Verified: 2026-07-18T16:09:01Z*
*Verifier: Claude (gsd-verifier)*
