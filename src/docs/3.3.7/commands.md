---
title: Commands
order: 6
description: "Reference for all CommandBridge admin commands including reload, info, debug, dump, and the resource-scoped script, task, client, and config trees."
---

CommandBridge has admin commands for managing the plugin itself. These are not the custom commands you define in your scripts, those are covered in [Scripting](/docs/scripting/). The commands here are for checking connections, reloading configs, debugging issues, and things like that.

All admin commands require the `commandbridge.admin` permission. If you don't have a permissions plugin on Velocity, you won't be able to use them in-game. Console always works.

{% hint "info" %}
v3.3.5 reorganised the `/cb` tree by resource (`script`, `task`, `client`, `config`). The old top-level forms (`/cb scripts`, `/cb tasks`, `/cb list`, `/cb ping`) are gone in v3 with no backwards-compat aliases. Every argument-taking subcommand has live tab-completion: script names, script groups, task ids, client ids, and config keys.
{% endhint %}

---

### Quick command list

If you just want to know what exists, this is the full list:

| Where | Command | What it does |
|---|---|---|
| Velocity | `/commandbridge` or `/cb` | Opens the help menu (same as `/cb help`). |
| Velocity | `/cb help` | Shows all admin subcommands. |
| Velocity | `/cb info` | Shows runtime/system info (Java, OS, uptime, memory, CPU). |
| Velocity | `/cb reload` | Reloads config + scripts and re-registers commands. |
| Velocity | `/cb debug` | Toggles debug logging on/off. |
| Velocity | `/cb dump` | Generates a diagnostics dump for support/issue reports. |
| Velocity | `/cb migrate` | Migrates script files to the latest schema version. |
| Velocity | `/cb script list [page]` | Lists loaded scripts (paginated). |
| Velocity | `/cb script show <name> [group]` | Opens a script overview, or drills into a single group. |
| Velocity | `/cb script enable <name>` | Flips `enabled: true` in the script file and re-pushes registrations. |
| Velocity | `/cb script disable <name>` | Flips `enabled: false` in the script file and re-pushes registrations. |
| Velocity | `/cb task list [page]` | Lists pending scheduled tasks (paginated). |
| Velocity | `/cb task clear <id>` | Removes a pending scheduled task by id. |
| Velocity | `/cb client list` | Lists authenticated backend clients. |
| Velocity | `/cb client ping [id]` | Measures latency to one client or all clients. |
| Velocity | `/cb client players <id>` | Lists players currently on a given backend. |
| Velocity | `/cb config show [key]` | Shows the config overview, or drills into a section. |
| Velocity | `/cb config reload` | Reloads only `config.yml` (no script reload, no re-registration). |
| Backend | `/commandbridgeclient reconnect` or `/cbc reconnect` | Forces reconnect to the proxy. |

---

## What each command does

### `/commandbridge` or `/cb`

Running the base command with no subcommand opens the help menu. Internally this behaves like `/cb help`.

### `/cb help`

Shows the full admin command list. In-game, each command entry is clickable so you can run it directly from the help output.

### `/cb info`

Shows runtime info of the current Velocity instance: OS name and arch, Java version, uptime, memory usage, and CPU core count.

In-game it also shows a memory load bar so you can quickly see if this proxy is under memory pressure.

### `/cb reload`

Reloads `config.yml`, reloads scripts from disk, rebuilds command registration, and pushes registrations to authenticated clients.

It also gives a result summary per client (`OK`, `FAILED`, `TIMEOUT`) for the registration step, so you can immediately see which backend did not update cleanly.

{% hint "info" %}
This command reloads config/scripts only. It does not restart the websocket server or Redis connection layer. If endpoint mode/host/port changed, restart the server.
{% endhint %}

### `/cb debug`

Toggles debug mode on/off immediately at runtime (`ENABLED` / `DISABLED`). No reload needed.

{% hint "warning" %}
Debug logging is noisy and can get big fast. Turn it on for troubleshooting, then turn it off again.
{% endhint %}

### `/cb dump`

Builds a support snapshot, uploads it to the dump viewer, and saves a local copy.

- Local copy path: `plugins/commandbridge/dumps/dump-<timestamp>.json`
- Upload retention: currently 14 days
- Sensitive keys like `secret`, passwords, tokens, and pins are redacted

The dump still contains configuration and script metadata, so review it before sharing publicly.

### `/cb migrate`

Migrates script files in `plugins/commandbridge/scripts/` to the latest script schema.

It prints a per-file result (`MIGRATED`, `SKIPPED`, or `ERROR`) and only touches script files (not `config.yml`).

Current built-in rules cover `2 -> 3` and `3 -> 4`.

For a short practical flow, see [Migration](/docs/migration/).

---

### `/cb script list [page]`

Lists loaded scripts with name, description, and enabled/disabled state.

- Default page is `1`
- Page size is `5` scripts
- In-game output has clickable previous/next arrows and each entry links to `/cb script show <name>`

The summary at the top shows totals for loaded, enabled, disabled, and script errors.

If a script fails validation, it does not appear here. Check logs for the parser/validation error.

### `/cb script show <name> [group]`

Without a group, this opens an overview card for the script: status, schema version, aliases, register targets, and counts for args and commands. Below the summary, it lists clickable section links (`permissions`, `register`, `defaults`, `args`, `commands`).

With a group, it drills into just that group, rendered the same way the old `/cb scripts` view rendered a full script — as a syntax-highlighted yaml card on console, and as nested key/value lines in chat.

Tab-completion suggests loaded script names for `<name>` and the five group keys above for `[group]`.

### `/cb script enable <name>` / `/cb script disable <name>`

Edits the `enabled:` line of the matching yaml file in place. Comments and formatting are preserved.

After the flip, the registration set is rebuilt and pushed to connected clients, so enabling or disabling a script takes effect immediately — no `/cb reload` needed.

Tab-completion only suggests scripts that are currently in the opposite state (disabled scripts for `enable`, enabled scripts for `disable`).

---

### `/cb task list [page]`

Lists pending scheduled tasks created by scripts using `<schedule>` placeholders. Each entry shows the short task id, the source script, the player it is queued for, and how long ago it was queued.

- Default page is `1`
- Page size is `5` tasks

Tasks expire after the duration set in `tasks.expire-after` (default `86400` seconds; set to `0` to disable). Expired tasks are pruned on load and on the 5-minute save tick.

### `/cb task clear <id>`

Removes a pending scheduled task by id. The id is the full UUID — use tab-completion to insert it from the list view.

---

### `/cb client list`

Lists authenticated and currently open client sessions only. Each entry shows:

- client ID
- platform location (`VELOCITY` or `BACKEND`)
- remote address
- current player count on that backend

If a server is missing here, it has not completed auth (or connection is closed).

### `/cb client ping [id]`

Measures round-trip latency to clients.

- No argument: ping all authenticated clients
- With `id`: ping just that client

Latency quality shown by the command:

| Latency | Rating |
|---|---|
| `< 50ms` | Excellent |
| `< 150ms` | Good |
| `150ms+` | Poor |

If a ping request fails or times out, it is shown as `FAILED` in the output.

### `/cb client players <id>`

Lists players currently online on the given backend client. The summary at the bottom shows the total count. Useful for spot-checking that the proxy and a backend agree on who is connected.

---

### `/cb config show [key]`

Without a key, this shows a flat summary of all top-level scalar config values and a clickable list of nested sections (`server`, `auth`, `commands`, `tasks`, `timeouts`, and so on).

With a key, it drills into just that section as a yaml card on console or as nested key/value lines in chat.

Tab-completion suggests top-level config keys.

### `/cb config reload`

Reloads only `config.yml`. This does not reload scripts and does not push a registration update to connected clients — use `/cb reload` for that.

Useful when you only changed a value like `debug` or `tasks.expire-after` and want to apply it without disturbing connected backends.

---

### `/commandbridgeclient reconnect` or `/cbc reconnect`

Backend-only command. It closes the current backend->proxy session, starts a reconnect attempt, waits briefly, then prints the new connection status.

Use this when a backend got stuck and you want to refresh the link without restarting the whole server.
