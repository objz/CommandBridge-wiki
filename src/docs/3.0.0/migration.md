---
title: Migration from v2
order: 11
---

This guide is for migrating from **v2** scripts/configs to **v3**.

Short version: there is no auto-converter and no 1:1 migration. You need to rewrite scripts manually.

This page is here to make that rewrite way less painful by showing what actually maps, what does not, and where behavior changed.

{% hint "danger" %}
v3 is not backward-compatible with v2.
Do not copy old v2 script files into v3 and expect them to load.
{% endhint %}

---

## What this guide is (and is not)

- It is a practical migration guide for server owners/admins.
- It is not a full scripting tutorial (for that use [Scripting](/docs/scripting/) and [Syntax](/docs/scripting/syntax/)).
- It focuses only on values that really map from v2 to v3.
- For everything else, you decide behavior and rewrite intentionally.

---

## Read this first

- v2 used `plugins/CommandBridge`.
- v3 uses `plugins/commandbridge` (all lowercase).
- Because the folder name changed, v3 will not read your old v2 folder by accident.
- So yes: no folder copy is needed. Keep old files only as reference while rewriting.
- v3 scripts are managed on Velocity only: `plugins/commandbridge/scripts/`.

In v2, you could treat scripts more like "drop in and hope". In v3 that is not a good strategy anymore.
The system validates strictly and has clearer execution rules. That is good long-term, but it means migration is a rewrite task, not a rename task.

---

## Migration flow (practical)

### Step 1: Install v3 everywhere and generate fresh files

Install v3 on Velocity and all backends, then start once so the new configs/scripts are generated.
Do this first before touching old files, so you can compare against valid defaults.

### Step 2: Configure network settings from scratch

Do not line-by-line copy old config values into new files.
Use the mapping table below only for values that really carry over.

### Step 3: Rewrite scripts one by one

Do not try to bulk-convert all scripts at once.
Take one script, rebuild it in v3 format, test it, then move to the next.
This keeps failures small and obvious.

### Step 4: Reload and validate

Use `/cb reload` after each rewritten script (or small batch).
If v3 finds schema or logic errors, fix them immediately before touching the next script.

### Step 5: Remove old v2 files only after real tests

Only delete old v2 script references after command behavior is verified by actually running the commands in realistic scenarios (player online/offline, console use, wrong permissions, etc.).

Use these pages while doing it:

- [Getting Started](/docs/getting-started/)
- [Velocity config](/docs/configuration/velocity/)
- [Backends config](/docs/configuration/backends/)
- [Scripting overview](/docs/scripting/)
- [Script syntax](/docs/scripting/syntax/)
- [Troubleshooting](/docs/troubleshooting/)

---

## Config mapping (only keys that really map)

Start with this: decide if you run `WEBSOCKET` or `REDIS` in v3. After that, map only relevant keys for that mode.
If you use websocket mode, the old host/port style mapping is straightforward. Redis mode is new and has no v2 equivalent.

### Velocity config

| v2 key | v3 key | Notes |
|---|---|---|
| `debug` | `debug` | Same purpose. |
| `server-id` | `server-id` | Same concept, default naming changed. |
| `host` | `endpoints.websocket.bind-host` | Same role in websocket mode. |
| `port` | `endpoints.websocket.bind-port` | Same role in websocket mode. |
| `timeout` | `timeouts.register-timeout` | Closest mapping (reload/register related timeout behavior). |

`san` from v2 has no direct v3 key.

So what to do with `san`? Usually: nothing. v3 TLS/config flow changed and this old value is not part of the new config model anymore.

### Backend config

| v2 key | v3 key | Notes |
|---|---|---|
| `debug` | `debug` | Same purpose. |
| `client-id` | `client-id` | Same concept. |
| `remote` | `endpoints.websocket.host` | Same role in websocket mode. |
| `port` | `endpoints.websocket.port` | Same role in websocket mode. |
| `timeout` | `timeouts.reconnect-timeout` | Closest mapping for reconnect window. |
| `secret` | `security.secret` | Same purpose (shared auth secret). |

Also new in v3 config: `endpoint-type` (`WEBSOCKET` or `REDIS`) and nested `endpoints` sections.

Also remember: Velocity generates `secret.key`; your backends use that value in `security.secret`.

---

## How to think about script rewrites

Before the table, this mindset helps a lot:

1. Define where the command is available (`register`).
2. Define where commands run (`defaults.execute` / per-command `execute`).
3. Define who runs it (`run-as`).
4. Define player-sensitive behavior (`target-required`, `schedule-online`).
5. Define args/placeholders last.

If you do it in this order, migration is usually smooth.
If you start with placeholders first, you will probably redo it twice.

---

## Script mapping (only keys that really map)

| v2 key | v3 key | Notes |
|---|---|---|
| `name` | `name` | Same purpose. |
| `enabled` | `enabled` | Same purpose. |
| `aliases` | `aliases` | Same purpose. |
| `ignore-permission-check` | `permissions.enabled` | Inverted logic: old `true` becomes new `false`. |
| `hide-permission-warning` | `permissions.silent` | Same intent (silent deny message). |
| `cooldown` | `defaults.cooldown` | Duration format in v3 (`5s`, `1m`, ...). |
| `commands[].command` | `commands[].command` | Same core purpose. |
| `commands[].delay` | `defaults.delay` or `commands[].delay` | Duration format in v3. |
| `commands[].target-client-ids` | `defaults.execute` / `commands[].execute` | Convert IDs into `{ id, location }` entries (`location: BACKEND` in most migrations). |
| `commands[].target-executor` | `defaults.run-as` / `commands[].run-as` | `player` -> `PLAYER`, `console` -> `CONSOLE`. |
| `commands[].wait-until-player-is-online` | `server.schedule-online` | Closest mapping, but behavior changed (see below). |
| `commands[].check-if-executor-is-on-server` | `server.target-required` | Closest mapping, but behavior changed (see below). |

Important: in v3, script structure is explicit (`permissions`, `register`, `defaults`, `args`, `commands`).
So even mapped keys now live in a different structure.

---

## Important behavior differences

### `wait-until-player-is-online` (v2) vs `schedule-online` (v3)

They are similar in goal, but not the same in behavior:

- v2 retried in-memory for a limited amount of attempts.
- v3 queues scheduled tasks and persists them (`tasks.json`) so they survive restarts.
- v3 scheduling is evaluated against execution targets, not just a basic online check.

Practical advice:

- If your v2 command used this mainly to avoid losing rewards/actions for offline players, `schedule-online: true` is usually the right start in v3.
- If you do not want queued execution later, keep it `false` and handle offline cases in another way.

### `check-if-executor-is-on-server` (v2) vs `target-required` (v3)

Also similar, but different execution model:

- v2 checked the executor context in the old command flow.
- v3 checks player presence per target and skips targets that do not match.
- In multi-target commands this is more granular than old v2 behavior.

Practical advice:

- If the command should only run where the target player actually is, set `target-required: true`.
- If the command should fire on all configured targets regardless of player location, keep it `false`.

### `check-if-executor-is-player` (v2)

This one has no direct 1-field replacement.

In v3 you control this with overall script design:

- `run-as: PLAYER` when it must execute as a player context.
- argument design + permissions when the command intent is "player-only".

So migration here is behavior design, not key mapping.

---

## Placeholders and arguments: what changes most

v2 used raw placeholders like `%args%`, `%arg[0]%`, `%cb_player%`.
v3 expects argument definitions and `${arg}` placeholders.

That means command rewrite is usually not "replace one token", it is:

1. define args in `args`
2. set their type/required state
3. use `${name}` in `commands[].command`

If your old script heavily depended on raw `%args%`, treat it as a redesign, not a port.

---

## What does not have a real 1:1 mapping

- `check-if-executor-is-player` has no direct single-key replacement.
- Old placeholder style (`%args%`, `%arg[n]%`, `%cb_player%`) is replaced by v3 args + `${arg}` placeholder flow.
- v2 script structure cannot be transformed mechanically into v3 schema.

For `check-if-executor-is-player` style behavior, you now combine `run-as` with your argument design depending on what you actually want.

This is why manual rewrite is required: you need to decide the intended behavior per script, not just rename keys.

---

## Quick per-script checklist

Use this for each migrated script before calling it done:

- Command name/aliases valid and enabled state correct.
- `register` targets are where users should type the command.
- `execute` targets are where commands should actually run.
- `run-as` is intentional (`CONSOLE`, `PLAYER`, `OPERATOR`).
- Permission behavior matches old intent (`permissions.enabled` + `permissions.silent`).
- Delay/cooldown values make sense in duration format.
- Player-online behavior tested (`target-required` and/or `schedule-online`).
- Command works from player and console where expected.

If all of that passes, your migration for that script is usually solid.
