---
phase: 05
slug: agencia-multi-cliente
status: draft
shadcn_initialized: true
preset: detected from components.json (style base-nova, baseColor neutral, iconLibrary lucide)
created: 2026-07-05
---

# Phase 05 — UI Design Contract

> Visual and interaction contract for the Agência (multi-client Agency) access module.
> No new visual language is introduced — every screen in this phase reuses the exact shadcn
> patterns already shipped in `app/tenants/*` and `components/tenants/*`. This spec exists to
> pin down the specific reuse decisions (which component maps to which new screen, what copy,
> what states) so the planner/executor never have to invent a pattern from scratch.

---

## Scope

This phase touches five UI surfaces:

| # | Surface | Type | Mirrors |
|---|---------|------|---------|
| 1 | `/agencies` — Super Admin agencies list | New page | `app/tenants/page.tsx` |
| 2 | `/agencies/[id]` — Super Admin agency detail (users + client grants) | New page | `app/tenants/[slug]/page.tsx` |
| 3 | `/agencia` — Agência client-selector landing | New page | `app/tenants/page.tsx` (read-only subset) |
| 4 | `components/tenants/tenant-switcher.tsx` | Extended (existing) | itself — widen role guard |
| 5 | `components/layout/sidebar-nav.tsx` | Extended (existing) | itself — add role filtering |
| 6 | `app/tenants/layout.tsx` header | Extended (existing) | itself — add "Agências" nav link |
| 7 | `components/tenants/add-user-modal.tsx` | Modified (existing) | itself — remove role `<Select>` per D-03 |

No new design tokens, no new color, no new typography scale. This document declares exact reuse mappings and the small amount of genuinely new copy (agency-specific labels, empty states).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (already initialized) |
| Preset | `components.json` — style `base-nova`, baseColor `neutral`, `cssVariables: true`, no prefix |
| Component library | Base UI (via shadcn — `components/ui/dialog.tsx`, `sheet.tsx` use `@base-ui-components/react`) |
| Icon library | lucide-react |
| Font — body | Bricolage Grotesque (`var(--font-bricolage)`, weights 400/500/600 loaded) |
| Font — headings | Syne (`var(--font-syne)`) — applied automatically to all `h1`–`h6` via `app/globals.css` `@layer base` rule |
| Font — mono | DM Mono (`var(--font-dm-mono)`) — used for slugs/IDs |
| Theme | Dark-only. `<html>` always carries the `dark` class (`app/layout.tsx` line 39) — there is no light-mode toggle in this project. All color values below are the `.dark` block from `app/globals.css`. |

**Source:** `components.json`, `app/globals.css`, `app/layout.tsx` (all verified directly).

---

## Spacing Scale

Multiples of 4, matching Tailwind defaults already used throughout `app/tenants/*`:

| Token | Value | Usage in this phase |
|-------|-------|----------------------|
| xs | 4px | Icon-to-label gaps, badge internal spacing (`px-2 py-0.5` on status pills — existing exception, see note) |
| sm | 8px | Compact spacing inside list rows (checkbox-to-label gap in "Clientes vinculados") |
| md | 16px | Default vertical rhythm inside `CardContent` (`gap-4`), form field spacing (`space-y-4`) |
| lg | 24px | Page-level section gaps (`flex flex-col gap-8` uses 32px — see xl; `gap-6` variant not used here) |
| xl | 32px | Top-level `<section>` gap between page header / table / next card (`gap-8` rounds to this bucket) |
| 2xl | 48px | Not used in this phase |
| 3xl | 64px | Not used in this phase |

**Exception (inherited, do not "fix"):** `TenantStatusBadge` uses `py-0.5` (2px vertical padding) — this is pre-existing, shipped code reused as-is for `AgencyStatusBadge`. Do not introduce a new 2px value anywhere else; this is the one grandfathered exception from Phase 1.

---

## Typography

Exactly 4 sizes, exactly 2 weights — matching what `app/tenants/*` already uses:

| Role | Size | Weight | Line Height | Tailwind classes | Used for |
|------|------|--------|-------------|-------------------|----------|
| Meta / label | 12px (text-xs) | 400 (normal) | default | `text-xs text-muted-foreground` | Slugs, hints, muted sub-labels |
| Body | 14px (text-sm) | 400 (normal) | default | `text-sm` | Form labels' description text, table cells, dialog descriptions |
| Body emphasis | 14px (text-sm) | 600 (font-semibold) | default | `text-sm font-semibold` | Table primary column (agency name), form `<Label>` |
| Section heading | 16px (text-base) | 600 (font-semibold) | tight | `text-base font-semibold` | `CardTitle` ("Informações", "Usuários", "Clientes vinculados") |
| Page heading | 20px (text-xl) | 600 (font-semibold) | tight | `text-xl font-semibold leading-tight` | `<h1>` page titles ("Agências", "Detalhes da agência", "Meus clientes") |

**Declared weights: 400 (normal) and 600 (font-semibold) only.** No `font-medium` (500) in this phase's UI — that weight belongs to Phase 3's chart components, not reused here.

Headings (`h1`) automatically render in Syne per the global `@layer base` rule — no extra class needed beyond the size/weight utilities above.

---

## Color

| Role | Value (dark theme, the only theme) | Usage in this phase |
|------|-------|-------|
| Dominant (60%) | `--background` = `#060608` | Page background, `<main>` wrapper |
| Secondary (30%) | `--card` = `#0e0e12` (cards) / `--secondary` = `#16161c` (header bar, `bg-card` on `app/tenants/layout.tsx` header) | `Card` surfaces (Informações, Usuários, Clientes vinculados), header bar |
| Accent (10%) | `--primary` = `#c8ff00` (lime) | Reserved for: primary action buttons only — "+ Nova agência", "+ Adicionar usuário" (agency), "Salvar agência", "Criar usuário", "Entrar" (client-selector row action), active sidebar nav item background, focus rings (`--ring`) |
| Destructive | `--destructive` = `#ff4444` | "Desativar agência" button (`variant="destructive"`), destructive confirmation dialog title/description accent, inline error text (`text-destructive`) |

**Accent reserved for (explicit list — nothing else may use `--primary`):**
- `+ Nova agência` dialog trigger button
- `+ Adicionar usuário` dialog trigger button (agency detail)
- `Salvar agência` / `Criar usuário` submit buttons
- `Entrar` button per row on the Agência client-selector landing page
- Active nav link background in `SidebarNav` and the "Agências"/"Tenants" header link when on that route
- Focus ring outline (`--ring`, same token, automatic via `focus-visible` utilities)

**Status badges are a separate, pre-existing semantic pair — not the accent color:**
- Active: `bg-emerald-500/20 text-emerald-400` (reused from `TenantStatusBadge`, unchanged)
- Inactive: `bg-zinc-500/20 text-zinc-400` (reused from `TenantStatusBadge`, unchanged)

Do not recolor status badges to lime — that would violate the 10%-accent reservation above by turning a frequent, repeated element (every table row) into the accent color.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title — Agencies list | "Agências" |
| Page subtitle — Agencies list | "Gerencie as agências e seus clientes vinculados" |
| Primary CTA — create agency | "+ Nova agência" |
| Dialog title — create agency | "Nova agência" |
| Dialog description — create agency | "Crie uma agência para conceder acesso a múltiplos clientes." |
| Field label — create agency | "Nome" (placeholder: "Agência XYZ") |
| Submit button — create agency | "Salvar agência" (pending state: spinner, same as `CreateTenantForm`) |
| Empty state heading — Agencies list | "Nenhuma agência cadastrada" |
| Empty state body — Agencies list | "Crie uma agência para conceder acesso a múltiplos clientes." |
| Table action — Agencies list | "Gerenciar" (links to `/agencies/[id]`) |
| Page title — Agency detail | "Detalhes da agência" |
| Card title — Agency detail info | "Informações" |
| Destructive action — Agency detail | "Desativar agência" |
| Destructive confirm title | "Desativar agência?" |
| Destructive confirm body | "A agência \"{name}\" e seus usuários perderão acesso a todos os clientes vinculados imediatamente. Esta ação pode ser revertida." |
| Destructive confirm action button | "Sim, desativar" |
| Reactivate action — Agency detail | "Reativar agência" |
| Card title — Agency detail users | "Usuários" |
| Primary CTA — add agency user | "+ Adicionar usuário" |
| Dialog title — add agency user | "Adicionar usuário" |
| Dialog description — add agency user | "O usuário receberá acesso à agência **{agencyName}** e poderá visualizar todos os clientes vinculados a ela." |
| Field label — add agency user | "E-mail" |
| Submit button — add agency user | "Criar usuário" |
| Success state — add agency user | "Usuário criado" / "Comunique a senha temporária para **{email}**. Ela será exibida apenas uma vez." (identical to `AddUserModal`'s existing success copy) |
| Users list placeholder — Agency detail | "A listagem de usuários é gerenciada via Supabase Dashboard em v1." (verbatim reuse from `app/tenants/[slug]/page.tsx`) |
| Card title — Agency detail grants | "Clientes vinculados" |
| Card description — Agency detail grants | "Marque os tenants que esta agência pode acessar." |
| Empty state — grants list (no active tenants exist) | "Nenhum tenant ativo disponível para vincular." |
| Error — grant/revoke toggle failure | "Não foi possível atualizar o acesso. Tente novamente." |
| Header nav link (Super Admin) | "Tenants" \| "Agências" (two links, same header, active route gets `--primary`-tinted underline/text) |
| Page title — Agência landing | "Meus clientes" |
| Page subtitle — Agência landing | "Selecione um cliente para visualizar o dashboard" |
| Table action — Agência landing | "Entrar" (identical label to existing `TenantsTable`, links to `/{slug}/dashboard`) |
| Empty state heading — Agência landing | "Nenhum cliente vinculado à sua agência" |
| Empty state body — Agência landing | "Contate o Super Admin para solicitar acesso a um cliente." |
| Dialog description — tenant add user (MODIFIED, role removed per D-03) | "O usuário receberá acesso completo ao tenant **{tenantName}**." (was: "...com a role selecionada") |
| Field removed — tenant add user | Role `<Select>` (Administrador/Visualizador) is deleted entirely — no replacement field |

**Tone:** Direct, no emoji, sentence case for body copy, matches the existing `app/tenants/*` voice exactly. All copy in pt-BR.

---

## Screen 1: `/agencies` — Super Admin Agencies List

Mirrors `app/tenants/page.tsx` structurally, one-to-one:

```
┌────────────────────────────────────────────────────────┐
│ Agências                              [+ Nova agência]  │  ← header row
│ Gerencie as agências e seus clientes vinculados         │
├────────────────────────────────────────────────────────┤
│ Nome            Status        Ações                     │
│ Agência Alpha   [Ativo]       [Gerenciar]               │
│ Agência Beta    [Inativo]     [Gerenciar]                │
└────────────────────────────────────────────────────────┘
```

**Component inventory for this screen:**

| Component | Status | Action |
|-----------|--------|--------|
| `app/agencies/page.tsx` | Does not exist | Create — mirrors `app/tenants/page.tsx` exactly (Server Component, `createClient()`, `.from('agencies').select('id, name, active').order('created_at', desc)`) |
| `components/agencies/create-agency-form.tsx` | Does not exist | Create — copy `CreateTenantForm` structure, drop the `slug` field entirely (agencies have no slug) |
| `components/agencies/agencies-table.tsx` | Does not exist | Create — copy `TenantsTable` structure: columns Nome / Status / Ações; Nome is **not** a link (agencies have no public-facing slug route the way tenants do — link lives only on the "Gerenciar" action); Ações column renders `Gerenciar` linking to `/agencies/{id}` |
| `components/tenants/tenant-status-badge.tsx` | Exists | Reuse directly, unchanged — the component already takes a generic `active: boolean` prop, no agency-specific fork needed |
| `components/ui/table.tsx`, `skeleton.tsx` | Exist | Reuse unchanged |

**Empty state:** identical shape to `TenantsTable`'s empty state (`rounded-lg border border-border bg-card p-12 text-center`), copy per Copywriting Contract above.

**Loading state:** `Suspense` + 3× `<Skeleton className="h-12 w-full" />`, identical to `app/tenants/page.tsx`.

---

## Screen 2: `/agencies/[id]` — Super Admin Agency Detail

Mirrors `app/tenants/[slug]/page.tsx`, with one new card ("Clientes vinculados") that has no tenant-detail equivalent:

```
┌────────────────────────────────────────────────────────┐
│ Detalhes da agência                                     │
│ Agência Alpha                                            │
├─ Card: Informações ─────────────────────────────────────┤
│ Nome            Status                                   │
│ Agência Alpha   [Ativo]                                  │
│                                                            │
│ [Desativar agência]                                       │
├─ Card: Usuários ─────────────────────────────────────────┤
│                                     [+ Adicionar usuário] │
│ A listagem de usuários é gerenciada via Supabase          │
│ Dashboard em v1.                                           │
├─ Card: Clientes vinculados ──────────────────────────────┤
│ Marque os tenants que esta agência pode acessar.          │
│ ☑ Acme Corp        acme-corp                              │
│ ☐ Beta Test        beta-test                              │
│ ☑ Lukseg           lukseg                                 │
└────────────────────────────────────────────────────────┘
```

**Component inventory for this screen:**

| Component | Status | Action |
|-----------|--------|--------|
| `app/agencies/[id]/page.tsx` | Does not exist | Create — mirrors `app/tenants/[slug]/page.tsx` exactly for the Informações + Usuários cards |
| `components/agencies/deactivate-agency-button.tsx` | Does not exist | Create — copy `DeactivateTenantButton` verbatim, swap copy per Copywriting Contract, call new `deactivateAgency`/`reactivateAgency` Server Actions |
| `components/agencies/add-agency-user-modal.tsx` | Does not exist | Create — copy `AddUserModal`, **remove the Role `<Select>` field entirely** (agency membership has no internal role split per D-04/research), keep the E-mail field + temp-password success state verbatim |
| `components/agencies/agency-tenant-grants.tsx` | Does not exist | Create — new component, see Interaction Contract below |
| `components/ui/checkbox.tsx` | **Not installed** | Add via `npx shadcn add checkbox` (shadcn official registry — no third-party vetting needed) before implementing `agency-tenant-grants.tsx` |
| `components/ui/card.tsx` | Exists | Reuse unchanged for all three cards |

### Interaction Contract: `agency-tenant-grants.tsx` ("Clientes vinculados")

- **Data source:** all `active = true` rows from `tenants` (Server Component fetch, RLS-scoped — Super Admin sees all via `tenants_super_admin_all`), joined client-side against the agency's current `agency_tenants` grants to determine each checkbox's initial checked state.
- **Layout:** a bordered list (`divide-y divide-border rounded-md border border-border`), one row per tenant: `<Checkbox>` + tenant name (`text-sm font-semibold`) + tenant slug (`text-xs text-muted-foreground font-mono`, right-aligned or inline after name with a middle dot separator).
- **Toggle behavior:** checking/unchecking is **optimistic, no confirmation dialog** — matches the project's established optimistic-write pattern from Phase 03.1's lead status dropdown (D-06/D-07 precedent). On check → call `grantTenant(agencyId, tenantId)` Server Action; on uncheck → call `revokeTenant(agencyId, tenantId)`. On failure, revert the checkbox to its prior state and show the inline error copy ("Não foi possível atualizar o acesso. Tente novamente.") via `role="alert" text-xs text-destructive` beneath the list, same visual treatment as every other inline error in this codebase.
- **Why no confirmation dialog for revoke:** unlike deactivating an entire agency (which cascades to all clients at once and is harder to reverse mentally), a single grant toggle is a one-row, instantly-reversible action (re-check the box). Treating it as destructive-with-confirmation would add friction disproportionate to the risk, and breaks the "recurring, changing operation" intent explicitly stated in CONTEXT.md D-02. This is a researcher discretion call, not a locked user decision — flag for the checker/planner if this needs revisiting.
- **Sort order:** alphabetical by tenant name.
- **Empty state:** if zero active tenants exist platform-wide, render "Nenhum tenant ativo disponível para vincular." in place of the list (same muted-text-center treatment as other empty states in this phase).

---

## Screen 3: `/agencia` — Agência Client-Selector Landing

This is the page an Agência user lands on after login (per `proxy.ts`'s new `role === 'agency'` branch, per RESEARCH.md Pitfall 3). Read-only subset of `TenantsTable` — no create action, no manage links:

```
┌────────────────────────────────────────────────────────┐
│ Meus clientes                                            │
│ Selecione um cliente para visualizar o dashboard          │
├────────────────────────────────────────────────────────┤
│ Nome            Status         Ações                     │
│ Acme Corp       [Ativo]        [Entrar]                  │
│ Lukseg          [Ativo]        [Entrar]                  │
└────────────────────────────────────────────────────────┘
```

**Component inventory for this screen:**

| Component | Status | Action |
|-----------|--------|--------|
| `app/agencia/page.tsx` | Does not exist | Create — Server Component, `createClient()` (RLS-scoped, not service-role — the new `tenants_agency_select` policy scopes this query automatically per RESEARCH.md "Tenant Switcher Scoping — Already Works For Free") |
| `app/agencia/layout.tsx` | Does not exist | Create — minimal shell: header with logo + `LogoutButton` only (no "Tenants \| Agências" nav — that nav is Super-Admin-only) |
| `components/agencies/agency-clients-table.tsx` | Does not exist | Create — **cannot reuse `TenantsTable` as-is**: `TenantsTable`'s Nome column wraps the name in `<Link href="/tenants/{slug}">`, which is a Super-Admin-only route an Agência user cannot access. This new component is `TenantsTable` minus that Link (plain `<span>` for Nome) and minus any create/deactivate affordance — everything else (Status badge, "Entrar" button, empty state shape) is copied verbatim |

**Empty state:** if the agency has zero granted tenants, render the empty state per Copywriting Contract — same visual treatment (`rounded-lg border border-border bg-card p-12 text-center`) as `TenantsTable`'s empty state.

**Explicitly not built (per D-01, deferred):** no aggregation, no cross-client totals, no "all clients" combined view. This page is a plain list + per-row entry point, nothing more.

---

## Extension 1: `components/tenants/tenant-switcher.tsx`

No new visual pattern — one-line guard change, per RESEARCH.md:

```tsx
// Before:
if (role !== 'super_admin') return null
// After:
if (role !== 'super_admin' && role !== 'agency') return null
```

The `<select>` markup, styling (`h-8 rounded-md border border-border bg-background px-2 text-sm font-semibold`), and the trailing "Gerenciar tenants…" option are unchanged for Super Admin. For an Agência user, the same `<select>` renders — but the trailing management option should read **"Gerenciar clientes…"** and route to `/agencia` instead of `/tenants` (Agência has no `/tenants` access). Implement via a `manageHref`/`manageLabel` prop pair (defaulting to the Super Admin values) rather than a role branch inside the component, keeping the component presentational as it is today.

```tsx
interface TenantSwitcherProps {
  role: 'super_admin' | 'tenant_admin' | 'agency' | string | null
  tenants: TenantOption[]
  activeSlug: string
  manageHref?: string    // default '/tenants'
  manageLabel?: string   // default 'Gerenciar tenants…'
}
```

No color, spacing, or typography changes to this component.

---

## Extension 2: `components/layout/sidebar-nav.tsx`

Add a `role` prop; filter two items per D-01 (Agência sees only Dashboard, Campanhas, Gestão de Leads):

```tsx
export function SidebarNav({ slug, role }: { slug: string; role: string | null }) {
  const marketingItems = role === 'agency'
    ? MARKETING_ITEMS.filter((item) => item.key !== 'insights')   // hide "AI Insights"
    : MARKETING_ITEMS
  // "Conta" section (Configurações) is rendered conditionally:
  const showSettings = role !== 'agency'
  ...
}
```

- "AI Insights" link removed from the Marketing group for `role === 'agency'`.
- The entire "Conta" group (currently just "Configurações") is omitted for `role === 'agency'` — not just hidden via CSS, not rendered at all (avoids a dangling `border-t` divider with nothing above it).
- "Leads" group (Gestão de Leads + Agente IA) is **unchanged** — both items remain visible to Agência per D-01.
- No new visual treatment — same `NavLink` component, same active-state styling (`bg-sidebar-primary text-sidebar-primary-foreground`).
- This is additive filtering only; Super Admin and Cliente (`tenant_admin`) continue to see the full nav exactly as today (verify no regression: passing `role={null}` or any non-`'agency'` value must render identically to the current unfiltered behavior).

---

## Extension 3: `app/tenants/layout.tsx` Header

Add a second nav link so Super Admin can move between the two admin screens. Apply the identical header shape to the new `app/agencies/layout.tsx`:

```
┌──────────────────────────────────────────────────┐
│ NEXUS-DASH     Tenants   Agências         [Sair]  │
└──────────────────────────────────────────────────┘
```

```tsx
// app/tenants/layout.tsx header — extended
<header className="h-14 w-full bg-card border-b border-border flex items-center justify-between px-6">
  <div className="flex items-center gap-6">
    <Link href="/tenants" className="text-sm font-semibold">NEXUS-DASH</Link>
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/tenants" className="font-semibold text-foreground">Tenants</Link>
      <Link href="/agencies" className="text-muted-foreground hover:text-foreground">Agências</Link>
    </nav>
  </div>
  <LogoutButton />
</header>
```

- Active route gets `text-foreground font-semibold`; inactive route gets `text-muted-foreground hover:text-foreground` — no background pill, no accent color on the nav link itself (accent is reserved for buttons, not text nav links, per the Color contract above).
- Duplicate this exact header markup in `app/agencies/layout.tsx` (do not extract a shared component for two call sites — matches this codebase's existing preference for small, independent per-area layouts over premature abstraction).
- Per RESEARCH.md, standardize both layouts' role check on `(await supabase.auth.getUser()).data.user.app_metadata.role`, not the manual `decodeRole()` JWT-decode helper `app/tenants/layout.tsx` currently uses — this is a code-correctness note from RESEARCH.md, not a visual change, but affects where the redirect-to-`/`  guard lives in both files.

---

## Extension 4: `components/tenants/add-user-modal.tsx` (Role Select Removal, D-03)

This existing component is modified, not replaced:

**Removed:**
- The entire "Role" `<Label>` + `<Select>` block (lines ~120–129 of the current file), including its two `<SelectItem>`s ("Administrador"/"Visualizador").
- The `role` variable read from `formData` in `handleSubmit`.

**Changed:**
- `DialogDescription` copy: from *"O usuário receberá acesso ao tenant **{tenantName}** com a role selecionada."* to *"O usuário receberá acesso completo ao tenant **{tenantName}**."*
- `createTenantUser({ email, tenantId })` call — drop the `role` argument; the Server Action itself always inserts `role: 'tenant_admin'` now (per RESEARCH.md's migration recommendation — DB value reused, not renamed).

**Unchanged:** dialog trigger label ("+ Adicionar usuário"), success state (temp password display + copy button), error display pattern, all spacing/typography.

---

## States Contract (applies across all new screens)

| State | Treatment |
|-------|-----------|
| Loading | `Suspense` boundary + `<Skeleton className="h-12 w-full" />` × 2–3, identical shape/count to `app/tenants/page.tsx` |
| Empty | `rounded-lg border border-border bg-card p-12 text-center` container, `text-xl font-semibold leading-tight` heading + `mt-2 text-sm text-muted-foreground` body — copy per Copywriting Contract |
| Error (form submit) | Inline `<p role="alert" className="text-xs text-destructive">{error}</p>` beneath the form, dynamic message from the Server Action's returned error string — no fixed copy, matches `CreateTenantForm`/`AddUserModal` exactly |
| Error (grant toggle) | Same `role="alert" text-xs text-destructive` treatment, fixed copy per Copywriting Contract |
| Success (user creation) | Dialog swaps to a success view showing the one-time temp password, identical pattern to `AddUserModal` — no toast/notification system exists in this project, don't introduce one |

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Checkbox rows (Clientes vinculados) | Each `<Checkbox>` paired with a `<Label>` via `htmlFor`/`id` so the tenant name is the accessible name, not just a visual label |
| Grant toggle error | `role="alert"` on the inline error text so screen readers announce failed toggles immediately |
| Header nav links | Active link communicated via `aria-current="page"` in addition to the visual `font-semibold` treatment |
| Empty states | Heading uses a real heading element (`<h2>`) inside the empty-state box, not just styled `<p>`, for consistent landmark navigation |
| Dialogs (create agency, add user) | Inherit Base UI's existing `Dialog` accessibility (focus trap, `aria-labelledby` via `DialogTitle`) — no additional work needed, same as `CreateTenantForm`/`AddUserModal` today |

---

## Registry Safety

| Registry | Components Used | Safety Gate |
|----------|------------------|--------------|
| shadcn official | `Card`, `Dialog`, `AlertDialog`, `Table`, `Button`, `Input`, `Label`, `Skeleton` (all already installed, reused unchanged) | not required |
| shadcn official | `Checkbox` (**not yet installed** — required for "Clientes vinculados") | not required — official registry component, install via `npx shadcn add checkbox` before implementing `agency-tenant-grants.tsx` |

No third-party registries declared for this phase. Vetting gate: not applicable.

---

## Component Inventory Summary

| Component | Status | Action |
|-----------|--------|--------|
| `app/agencies/page.tsx` | New | Create |
| `app/agencies/[id]/page.tsx` | New | Create |
| `app/agencies/layout.tsx` | New | Create (duplicate header shape from `app/tenants/layout.tsx`) |
| `app/agencia/page.tsx` | New | Create |
| `app/agencia/layout.tsx` | New | Create (minimal — logo + logout only) |
| `components/agencies/create-agency-form.tsx` | New | Create (copy `CreateTenantForm`, drop slug field) |
| `components/agencies/agencies-table.tsx` | New | Create (copy `TenantsTable`, Nome not a link, Ações → "Gerenciar") |
| `components/agencies/deactivate-agency-button.tsx` | New | Create (copy `DeactivateTenantButton` verbatim, swap copy) |
| `components/agencies/add-agency-user-modal.tsx` | New | Create (copy `AddUserModal`, remove role select) |
| `components/agencies/agency-tenant-grants.tsx` | New | Create (see Interaction Contract, Screen 2) |
| `components/agencies/agency-clients-table.tsx` | New | Create (copy `TenantsTable`, Nome not a link, no create/deactivate) |
| `components/tenants/tenant-switcher.tsx` | Modified | Widen guard + add `manageHref`/`manageLabel` props |
| `components/layout/sidebar-nav.tsx` | Modified | Add `role` prop, filter AI Insights + Configurações for `agency` |
| `components/tenants/add-user-modal.tsx` | Modified | Remove Role `<Select>`, update description copy |
| `app/tenants/layout.tsx` | Modified | Add "Agências" header nav link |
| `components/tenants/tenant-status-badge.tsx` | Unchanged | Reuse directly for agency status (generic `active: boolean` prop) |
| `components/ui/checkbox.tsx` | Not installed | Add via `npx shadcn add checkbox` |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Phase: 05-agencia-multi-cliente*
*UI-SPEC created: 2026-07-05*
*Researcher: Claude (gsd-ui-researcher)*
