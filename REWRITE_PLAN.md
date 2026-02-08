# Documentation Rewrite Plan (v2 → v3)

Keep the existing Eleventy + Nunjucks + TailwindCSS stack, layouts, styles, landing page, 404 page, and dump viewer.
Only the docs content (`src/docs/`) is being rewritten.

---

## New Sidebar Structure

```
Welcome                          (src/docs/index.md)
Installation                     (src/docs/installation.md)
Requirements                     (src/docs/requirements.md)
Getting Started                  (src/docs/getting-started.md)
Configuration
├── Velocity                     (src/docs/configuration/velocity.md)
└── Backends                     (src/docs/configuration/backends.md)
Scripting
├── Overview                     (src/docs/scripting.md)
├── Syntax                       (src/docs/scripting/syntax.md)
├── Argument Types               (src/docs/scripting/argument-types.md)
├── Placeholders                 (src/docs/scripting/placeholders.md)
├── PlaceholderAPI               (src/docs/scripting/placeholderapi.md)
├── Example: Alert               (src/docs/scripting/example-alert.md)
├── Example: Lobby               (src/docs/scripting/example-lobby.md)
├── Example: Economy             (src/docs/scripting/example-economy.md)
└── Example: Punishment          (src/docs/scripting/example-punishment.md)
Security                         (src/docs/security.md)
Commands                         (src/docs/commands.md)
Permissions                      (src/docs/permissions.md)
Troubleshooting                  (src/docs/troubleshooting.md)
Migration from v2                (src/docs/migration.md)
```

---

## Files to Delete

These v2 docs no longer apply:

- `src/docs/data-collection.md` (bStats removed in v3)
- `src/docs/support-resources.md` (fold into troubleshooting or welcome)
- `src/docs/common-issues.md` (replaced by troubleshooting.md)

---

## Files to Create / Rewrite

### 1. Welcome (`src/docs/index.md`)
- **Rewrite.** Brief intro to CommandBridge v3
- What it does, why WebSockets, single JAR
- What the docs cover
- Links to Discord, GitHub, Modrinth
- Hint box: "These docs are for v3. For v2 docs, see [link]"
- Mention `/cb` commands exist, link to commands page

### 2. Installation (`src/docs/installation.md`)
- **Rewrite.** Download from Modrinth
- Single JAR for all platforms
- Where to place it (Velocity + backends)
- First startup behavior (generates config, secret, certs)
- Link to requirements page

### 3. Requirements (`src/docs/requirements.md`)
- **Rewrite.** Java 21, Minecraft versions
- Platform compatibility table (Velocity, Paper, Folia, Bukkit -- update for v3)
- Required dependencies (CommandAPI on backends)
- Optional dependencies (PlaceholderAPI, PapiProxyBridge, PacketEvents)
- Permissions plugin recommendation (LuckPerms)

### 4. Getting Started (`src/docs/getting-started.md`)
- **Rewrite.** Detailed step-by-step walkthrough
- Terminology (server = Velocity proxy, clients = backends)
- File structure after first startup (both sides)
- Step 1: Install on both sides, start once, stop
- Step 2: Configure Velocity (host, port, server-id)
- Step 3: Configure backends (host, port, client-id)
- Step 4: Secret key setup (auto-generated, copy to backends OR set in config)
- Step 5: Start Velocity, then backends
- Step 6: Verify connection (expected log output, `/cb list`, `/cb ping`)
- Step 7: Create your first script (minimal example, test it)
- Show expected output at each step
- Mention `/cb reload` for script changes
- Link to scripting section for next steps

### 5. Configuration — Velocity (`src/docs/configuration/velocity.md`)
- **New.** Full config reference for Velocity side
- Every config key with type, default, and description
- Organized by section (server, security, timeouts, etc.)
- Example config file with comments
- Mention `/cb reload` applies config changes

### 6. Configuration — Backends (`src/docs/configuration/backends.md`)
- **New.** Full config reference for backend side
- Every config key with type, default, and description
- Organized by section (connection, security, timeouts, etc.)
- Example config file with comments
- Mention `/cbc reconnect` for reconnection

### 7. Scripting — Overview (`src/docs/scripting.md`)
- **Rewrite.** What scripts are, where they live, how they work
- Scripts directory location
- How scripts are loaded and registered
- The flow: YAML → validation → registration on backends → player runs command → dispatch
- Link to syntax page for full reference
- Mention `/cb scripts`, `/cb reload`

### 8. Scripting — Syntax (`src/docs/scripting/syntax.md`)
- **Rewrite.** Full YAML syntax reference for v3
- Complete annotated example script
- Every field documented: version, name, enabled, description, aliases, permissions, register, defaults, args, commands
- Register block: target server IDs
- Defaults block: run-as, cooldown
- Args block: name, type, required, default
- Commands block: command string, target, run-as override
- Placeholder usage in command strings (`${argname}`)
- Tips and common patterns

### 9. Scripting — Argument Types (`src/docs/scripting/argument-types.md`)
- **New.** All 21 argument types on one page
- Table with: type name, description, platform availability, example usage
- Grouped by category (basic, Minecraft, item, misc)
- For each type: what it accepts, what the player sees (tab completion)
- Note which types need PacketEvents on Velocity
- Custom argument types section (TIME, and how the framework works)

### 10. Scripting — Placeholders (`src/docs/scripting/placeholders.md`)
- **Rewrite.** Built-in `${arg}` placeholder system
- How argument placeholders work
- All built-in placeholders (player, uuid, server, etc.)
- Platform availability table
- Examples

### 11. Scripting — PlaceholderAPI (`src/docs/scripting/placeholderapi.md`)
- **New.** Dedicated page for PAPI integration
- Requirements (PlaceholderAPI on backends, PapiProxyBridge on Velocity)
- Setup steps
- How cross-server placeholder resolution works
- Examples using PAPI placeholders in scripts

### 12. Scripting — Example: Alert (`src/docs/scripting/example-alert.md`)
- **Rewrite.** Cross-server broadcast command
- Full YAML script
- Explanation of each field
- How to test it

### 13. Scripting — Example: Lobby (`src/docs/scripting/example-lobby.md`)
- **Rewrite.** Server transfer command
- Full YAML script
- Explanation of each field
- How to test it

### 14. Scripting — Example: Economy (`src/docs/scripting/example-economy.md`)
- **New.** Cross-server economy command (give money to player on another server)
- Shows argument types, run-as modes, targeting specific backends

### 15. Scripting — Example: Punishment (`src/docs/scripting/example-punishment.md`)
- **New.** Cross-server punishment command (ban/mute across network)
- Shows multiple commands in one script, console execution, PAPI placeholders

### 16. Security (`src/docs/security.md`)
- **New.** Single page covering all security features
- Shared secret (how it works, auto-generation, manual setup)
- TLS overview (why, what it protects)
- TLS modes explained:
  - PLAIN (no TLS)
  - TOFU (trust-on-first-use, auto pin)
  - STRICT (pre-shared keystore)
- Certificate generation (auto self-signed)
- When to use which mode
- Common TLS issues and fixes

### 17. Commands (`src/docs/commands.md`)
- **New.** Quick reference page for all commands
- `/cb help`, `/cb info`, `/cb list`, `/cb ping`, `/cb scripts`, `/cb reload`, `/cb debug`, `/cb dump`
- `/cbc reconnect`
- Each command: usage, permission, what it does, example output
- Note: commands are also mentioned contextually throughout other pages

### 18. Permissions (`src/docs/permissions.md`)
- **Rewrite.** All permission nodes
- `commandbridge.admin` — who needs it, where to set it
- `commandbridge.command.<name>` — per-script permissions
- Where to set permissions (Velocity vs backends)
- LuckPerms examples
- Bypassing with script config

### 19. Troubleshooting (`src/docs/troubleshooting.md`)
- **Rewrite.** Replaces both `common-issues.md` and `support-resources.md`
- Connection issues (can't connect, broken pipe, auth failures)
- TLS issues (certificate errors, pin mismatch)
- Command issues (not registering, permissions, wrong target)
- Placeholder issues
- Debug mode (`/cb debug`)
- How to read logs
- Where to get help (Discord, GitHub Issues)
- What to include when reporting a bug

### 20. Migration from v2 (`src/docs/migration.md`)
- **New.** Upgrade guide from v2 to v3
- What changed (new scripting format, WebSocket architecture, TLS, config structure)
- Step-by-step migration:
  - Back up everything
  - Remove old JARs, install new
  - Config migration (what maps to what)
  - Script migration (v2 format → v3 format, side-by-side examples)
  - Permission changes
  - Verify everything works
- Breaking changes list

---

## Dump Page

- **Keep as-is.** No changes to `src/dump.njk`
- The `/cb dump` command itself still needs to be implemented in the plugin (separate task)

---

## Eleventy Enhancements

Plugins and features to add for a better documentation experience.
Only add what actually improves the docs -- no bloat.

### Mermaid Diagrams

**Why:** Architecture diagrams (Velocity ↔ backends flow), script execution pipeline,
TLS handshake, and the reconnect lifecycle. Better than static images because they
stay in sync with the docs (just markdown) and support dark mode.

**Where used:**
- Getting Started: network topology diagram (Velocity → WebSocket → backends)
- Scripting Overview: script lifecycle flow (YAML → validation → registration → invocation → dispatch)
- Security: TLS handshake / TOFU flow
- Troubleshooting: connection state diagram

**How:** Add `markdown-it-mermaid` or render client-side via Mermaid JS CDN.
Client-side is simpler -- just load the script and auto-render ```` ```mermaid ```` blocks.

### Code Copy Button

**Why:** Users will copy-paste YAML scripts, config blocks, and commands constantly.
Every modern doc site has this.

**How:** Small JS snippet that adds a copy button to every `<pre><code>` block.
No plugin needed, ~20 lines of Alpine.js or vanilla JS in `base.njk`.

### Tabs / Code Groups

**Why:** Side-by-side comparisons for:
- Migration page: v2 script vs v3 script
- Config pages: minimal config vs full config
- Getting started: Velocity config vs Backend config in the same step

**How:** Custom Eleventy paired shortcode `{% tabs %}` / `{% tab "Label" %}` that renders
tabbed content panels. Styled with Tailwind, toggled with Alpine.js. ~50 lines total.

### Wire Up markdown-it-task-lists

**Why:** Already installed as a dependency but not registered in `.eleventy.js`.
Enables `- [x]` / `- [ ]` checkbox rendering in markdown -- useful for the
Getting Started checklist steps and Migration page.

**How:** One line in `.eleventy.js`: `.use(require('markdown-it-task-lists'))`.

### Summary

| Enhancement | Complexity | Pages that use it |
|-------------|-----------|-------------------|
| Mermaid diagrams | Low (CDN script) | Getting Started, Scripting Overview, Security, Troubleshooting |
| Code copy button | Low (20 lines JS) | Every page with code blocks |
| Tabs shortcode | Medium (shortcode + CSS + JS) | Migration, Config, Getting Started |
| Task lists | Trivial (1 line) | Getting Started, Migration |

---

## Non-Content Changes

- Update `src/_data/site.json` description if needed
- Update landing page (`src/index.njk`) feature descriptions to match v3
- Update navigation collection in `.eleventy.js` if the new directory structure needs adjustments
- Verify the `order` frontmatter values produce the correct sidebar ordering
- Add Mermaid JS to `base.njk` (CDN or local)
- Add code copy button JS to `base.njk`
- Create `{% tabs %}` / `{% tab %}` shortcode in `.eleventy.js`
- Wire up `markdown-it-task-lists` in `.eleventy.js`

---

## Page Order (frontmatter `order` values)

```
index.md                    → order: 1
installation.md             → order: 2
requirements.md             → order: 3
getting-started.md          → order: 4
configuration/ (section)    → order: 5
  velocity.md               → order: 1
  backends.md               → order: 2
scripting.md (section)      → order: 6
  syntax.md                 → order: 1
  argument-types.md         → order: 2
  placeholders.md           → order: 3
  placeholderapi.md         → order: 4
  example-alert.md          → order: 5
  example-lobby.md          → order: 6
  example-economy.md        → order: 7
  example-punishment.md     → order: 8
security.md                 → order: 7
commands.md                 → order: 8
permissions.md              → order: 9
troubleshooting.md          → order: 10
migration.md                → order: 11
```

---

## Writing Style

- Match the tone of the v2 wiki: casual but clear, concise, no fluff
- Use the existing `{% hint %}` shortcode for warnings, info boxes, and tips
- Code blocks for all YAML/config examples with syntax highlighting
- Tables for reference data (config keys, argument types, permissions, placeholders)
- Keep paragraphs short
- Show expected output where helpful (log lines, command responses)
- Don't over-explain obvious things

---

## Task Summary

| # | Task | Type | Files |
|---|------|------|-------|
| 1 | Delete removed pages | Delete | `data-collection.md`, `support-resources.md`, `common-issues.md` |
| 2 | Create configuration directory | Create | `src/docs/configuration/` |
| 3 | Write Welcome page | Rewrite | `src/docs/index.md` |
| 4 | Write Installation page | Rewrite | `src/docs/installation.md` |
| 5 | Write Requirements page | Rewrite | `src/docs/requirements.md` |
| 6 | Write Getting Started page | Rewrite | `src/docs/getting-started.md` |
| 7 | Write Velocity config reference | New | `src/docs/configuration/velocity.md` |
| 8 | Write Backends config reference | New | `src/docs/configuration/backends.md` |
| 9 | Write Scripting overview | Rewrite | `src/docs/scripting.md` |
| 10 | Write Scripting syntax reference | Rewrite | `src/docs/scripting/syntax.md` |
| 11 | Write Argument types reference | New | `src/docs/scripting/argument-types.md` |
| 12 | Write Placeholders page | Rewrite | `src/docs/scripting/placeholders.md` |
| 13 | Write PlaceholderAPI page | New | `src/docs/scripting/placeholderapi.md` |
| 14 | Write Example: Alert | Rewrite | `src/docs/scripting/example-alert.md` |
| 15 | Write Example: Lobby | Rewrite | `src/docs/scripting/example-lobby.md` |
| 16 | Write Example: Economy | New | `src/docs/scripting/example-economy.md` |
| 17 | Write Example: Punishment | New | `src/docs/scripting/example-punishment.md` |
| 18 | Write Security page | New | `src/docs/security.md` |
| 19 | Write Commands reference | New | `src/docs/commands.md` |
| 20 | Write Permissions page | Rewrite | `src/docs/permissions.md` |
| 21 | Write Troubleshooting page | Rewrite | `src/docs/troubleshooting.md` |
| 22 | Write Migration from v2 page | New | `src/docs/migration.md` |
| 23 | Update site metadata | Update | `src/_data/site.json` |
| 24 | Update landing page features | Update | `src/index.njk` |
| 25 | Verify navigation/ordering | Verify | `.eleventy.js`, frontmatter |
| 26 | Implement `/cb dump` command | Code | Plugin codebase (not wiki) |
