# Phase 12: Redesign Visual - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 12-redesign-visual
**Areas discussed:** Prototype source of truth, Settings without a prototype, Implementation approach

---

## Prototype Source of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| nexus-dash.html | Most recent (2026-05-18), single file covering Dashboard+Campanhas+Insights+Leads+Agente, lime palette (#c8ff00) already matching production `--primary` | ✓ |
| The 4 separate files (dashboard/campanhas/insights.html + style.css) | Older (2026-05-17), blue/purple palette (#5b8df6/#a78bfa) | |
| Combine both | Mix structure from one, palette from the other | |

**User's choice:** nexus-dash.html
**Notes:** Discovered during codebase scouting that two prototype generations exist in `prototipos/`, one day apart, with conflicting color palettes. Confirmed via file mtimes and by cross-checking the lime color against the live `app/globals.css` `--primary` value (exact match) and against `nexus-dash.html`'s sidebar structure matching the real `sidebar-nav.tsx` layout almost exactly.

---

## Settings Screen (no prototype available)

| Option | Description | Selected |
|--------|-------------|----------|
| Extrapolate from other screens' style | Apply the same visual tokens (color, typography, cards, spacing) used across Dashboard/Campanhas/Insights to Settings' current structure, no pixel-specific prototype | ✓ |
| Wait for user to provide a reference | Defer Settings' exact design until user brings a specific visual reference | |

**User's choice:** Extrapolate from other screens' style
**Notes:** Neither prototype generation has a Settings/Configurações nav item or screen. PROJECT.md mentions the user might provide screenshots — none were provided during this discussion.

---

## Implementation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental reskin | Keep shadcn/ui components and existing data/hooks, swap only visual tokens (colors, fonts, spacing, radius, shadows) | ✓ |
| Rewrite from scratch | Recreate each screen's HTML/CSS pixel-for-pixel against the prototype, plugging existing data hooks into the new structure | |

**User's choice:** Incremental reskin
**Notes:** Aligns with REQUIREMENTS.md's explicit constraint that the redesign must preserve existing hooks/data/behavior. The prototype's header/sidebar structure already closely matches the live app's, reducing the risk/need for a full rewrite.

---

## Claude's Discretion

- Exact mapping of `nexus-dash.html`'s inline design tokens to the app's existing CSS variables in `app/globals.css`.
- Whether `/tenants` and `/agencies` (outside DESIGN-01..05's formal scope but sharing the same `layout.tsx` chrome) inherit the reskin by consequence.
- Execution order/waves across the 4 screens + shared chrome.

## Deferred Ideas

None — discussion stayed within phase scope (which prototype to follow, how to handle Settings without a dedicated prototype, and implementation strategy).
