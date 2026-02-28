---
title: Commands
order: 6
---

CommandBridge has admin commands for managing the plugin itself. These are not the custom commands you define in your scripts, those are covered in [Scripting](/docs/scripting/). The commands here are for checking connections, reloading configs, debugging issues, and things like that.

All admin commands require the `commandbridge.admin` permission. If you don't have a permissions plugin on Velocity, you won't be able to use them in-game. Console always works.

---

### Quick command list

If you just want to know what exists, this is the full list:

| Where | Command | What it does |
|---|---|---|
| Velocity | `/commandbridge` or `/cb` | Opens the help menu (same as `/cb help`). |
| Velocity | `/cb help` | Shows all admin subcommands. |
| Velocity | `/cb info` | Shows runtime/system info (Java, OS, uptime, memory, CPU). |
| Velocity | `/cb scripts [page]` | Lists loaded scripts (paginated). |
| Velocity | `/cb reload` | Reloads config + scripts and re-registers commands. |
| Velocity | `/cb list` | Lists authenticated backend clients. |
| Velocity | `/cb ping [clientId]` | Measures latency to one client or all clients. |
| Velocity | `/cb debug` | Toggles debug logging on/off. |
| Velocity | `/cb dump` | Generates a diagnostics dump for support/issue reports. |
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

### `/cb scripts [page]`

Lists loaded scripts with details: description, schema version, aliases, command count, and enabled/disabled state.

- Default page is `1`
- Page size is `5` scripts
- In-game output has clickable previous/next arrows

At the bottom, it also prints totals for loaded, enabled, disabled, and script errors.

If a script fails validation, it does not appear here. Check logs for the parser/validation error.

### `/cb reload`

Reloads `config.yml`, reloads scripts from disk, rebuilds command registration, and pushes registrations to authenticated clients.

It also gives a result summary per client (`OK`, `FAILED`, `TIMEOUT`) for the registration step, so you can immediately see which backend did not update cleanly.

{% hint "info" %}
This command reloads config/scripts only. It does not restart the websocket server or Redis connection layer. If endpoint mode/host/port changed, restart the server.
{% endhint %}

### `/cb list`

Lists authenticated and currently open client sessions only. Output includes:

- client ID
- remote address
- platform location (`VELOCITY` or `BACKEND`)

If a server is missing here, it has not completed auth (or connection is closed).

### `/cb ping [clientId]`

Measures round-trip latency to clients.

- No argument: ping all authenticated clients
- With `clientId`: ping just that client

Latency quality shown by the command:

| Latency | Rating |
|---|---|
| `< 50ms` | Excellent |
| `< 150ms` | Good |
| `150ms+` | Poor |

If a ping request fails or times out, it is shown as failed in the output.

### `/cb debug`

Toggles debug mode on/off immediately at runtime (`ENABLED` / `DISABLED`). No reload needed.

{% hint "warning" %}
Debug logging is noisy and can get big fast. Turn it on for troubleshooting, then turn it off again.
{% endhint %}

### `/cb dump`

This command exists and is usable, but right now it is still minimal. It currently reports client count and shows a TODO marker for detailed dump data.

So yes, it is there, but the deep diagnostics output is not fully implemented yet.

### `/commandbridgeclient reconnect` or `/cbc reconnect`

Backend-only command. It closes the current backend->proxy session, starts a reconnect attempt, waits briefly, then prints the new connection status.

Use this when a backend got stuck and you want to refresh the link without restarting the whole server.
