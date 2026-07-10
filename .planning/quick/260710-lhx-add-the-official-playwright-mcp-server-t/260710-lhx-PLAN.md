---
phase: quick
plan: 260710-lhx
type: execute
wave: 1
depends_on: []
files_modified: [.mcp.json]
autonomous: true
requirements: []
must_haves:
  truths:
    - "A `playwright` entry exists in .mcp.json under mcpServers"
    - "The `playwright` entry invokes @playwright/mcp via npx using the same Windows cmd /c pattern as the supabase entry"
    - "The existing github, vercel, and supabase entries are unchanged"
    - ".mcp.json remains valid JSON"
  artifacts:
    - path: ".mcp.json"
      provides: "Project-scoped MCP server config including Playwright"
      contains: "playwright"
  key_links: []
---

<objective>
Add the official Microsoft Playwright MCP server (`@playwright/mcp`) to the project-scoped `.mcp.json` so Claude Code can drive a real browser to run Phase 5 manual UAT (Plan 09 verification of the Agência Multi-Cliente module).

Purpose: Phase 5 (8/9 plans complete) needs manual UAT of login redirects, role-scoped navigation, and the agency landing page. A browser-driving MCP server lets Claude perform that verification interactively instead of relying purely on unit tests.

Output: Updated `.mcp.json` with a new `playwright` server entry, following the exact structure/style of the existing entries. No API key or access token required.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.mcp.json

<interfaces>
Current `.mcp.json` structure (the pattern to follow exactly):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com/riguettilimatech-8948s-projects/nexus-dash"
    },
    "supabase": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=rvkkvjitfddtbdpkupok",
        "--read-only"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

Notes:
- This is a Windows environment. The `supabase` entry proves the working local-server pattern here is `"command": "cmd"` with `args: ["/c", "npx", "-y", "<package>@latest", ...]`. The new `playwright` entry MUST use this same `cmd /c npx` form (a bare `"command": "npx"` will not resolve on Windows).
- `@playwright/mcp` needs no API key, so the new entry has NO `env` block (unlike `supabase`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the playwright MCP server entry to .mcp.json</name>
  <files>.mcp.json</files>
  <action>
Add a new `"playwright"` key inside the existing `mcpServers` object in `.mcp.json`, placed after the `supabase` entry. Do NOT modify, reorder, or remove the existing `github`, `vercel`, or `supabase` entries.

The new entry must mirror the Windows `cmd /c npx` invocation pattern the `supabase` entry uses, but with NO `env` block (the official Playwright MCP server needs no API key or access token):

```json
"playwright": {
  "command": "cmd",
  "args": [
    "/c",
    "npx",
    "-y",
    "@playwright/mcp@latest"
  ]
}
```

Ensure the comma placement is correct: the `supabase` entry now needs a trailing comma after its closing brace since `playwright` follows it. The file must remain valid JSON (no trailing comma after the final `playwright` entry).
  </action>
  <verify>
    <automated>node -e "const c=require('./.mcp.json'); const s=c.mcpServers; if(!s.playwright) throw new Error('playwright entry missing'); if(s.playwright.command!=='cmd') throw new Error('command must be cmd'); const a=s.playwright.args; if(!a.includes('@playwright/mcp@latest')) throw new Error('package arg missing'); if(!a.includes('/c')||!a.includes('npx')) throw new Error('cmd /c npx pattern missing'); if(s.playwright.env) throw new Error('playwright must NOT have an env block'); if(!s.github||!s.vercel||!s.supabase) throw new Error('an existing entry was removed'); console.log('OK: .mcp.json valid, playwright entry correct, existing entries intact');"</automated>
  </verify>
  <done>
`.mcp.json` is valid JSON. It contains a `playwright` entry using the `cmd /c npx -y @playwright/mcp@latest` pattern with no `env` block. The `github`, `vercel`, and `supabase` entries are byte-for-byte unchanged except for the comma added after `supabase`.

IMPORTANT (document in SUMMARY): This new MCP server will NOT be available as callable tools in the current Claude Code session. The `.mcp.json` change is only picked up when the Claude Code session / MCP connection is reloaded (restart the session or re-approve the project MCP servers). The executor must note this explicitly in the SUMMARY so the user knows to reload before attempting Phase 5 UAT with Playwright.
  </done>
</task>

</tasks>

<verification>
- `node -e "require('./.mcp.json')"` parses without error (valid JSON).
- The `playwright` entry exists with the `cmd /c npx -y @playwright/mcp@latest` invocation and no `env` block.
- `github`, `vercel`, and `supabase` entries remain present and functionally unchanged.
</verification>

<success_criteria>
- `.mcp.json` contains four MCP servers: `github`, `vercel`, `supabase`, `playwright`.
- The `playwright` entry follows the exact Windows `cmd /c npx` style of the existing `supabase` entry, minus the `env` block.
- File remains valid JSON.
- SUMMARY documents that a session/connection reload is required before the Playwright tools become callable.
</success_criteria>

<output>
After completion, create `.planning/quick/260710-lhx-add-the-official-playwright-mcp-server-t/260710-lhx-SUMMARY.md`
</output>
