---
title: Syntax
order: 1
---

Full YAML reference for CommandBridge v3 scripts.

### Complete example

```yaml
version: 2
name: eco-give
description: Give money to a player on a backend server
enabled: true
aliases: [eco]

permissions:
  enabled: true
  silent: false

register:
  - id: "proxy-1"
    location: VELOCITY

defaults:
  run-as: CONSOLE
  execute:
    - id: "survival-1"
      location: BACKEND
  server:
    target-required: true
    schedule-online: true
    timeout: 5s
  delay: 0s
  cooldown: 0s

args:
  - name: player
    required: true
    type: PLAYERS

  - name: amount
    required: true
    type: RANGE

commands:
  - command: "eco give ${player} ${amount}"
    run-as: CONSOLE
    server:
      target-required: false
      schedule-online: false
    delay: 2s
```

---

## Top-level fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | int | yes | -- | Schema version. Use `2`. |
| `name` | string | yes | -- | Command name (becomes `/name`). Lowercase, 3-33 chars, pattern: `^[a-z][a-z0-9-]{2,32}$`. |
| `description` | string | no | -- | Short description shown in `/help`. |
| `enabled` | boolean | no | `true` | Set `false` to disable without deleting the file. |
| `aliases` | list | no | `[]` | Alternative command names. |
| `permissions` | object | yes | -- | Permission settings. See below. |
| `register` | list | yes | -- | Where to register the command. See below. |
| `defaults` | object | yes | -- | Default execution settings inherited by all commands. See below. |
| `args` | list | yes | -- | Argument definitions. Can be empty (`[]`). See below. |
| `commands` | list | yes | -- | Commands to execute. See below. |

---

## permissions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Check `commandbridge.command.<name>` before executing. |
| `silent` | boolean | `false` | When `true`, permission failures are silent (no error message to the player). |

---

## register

A list of targets where the command should be registered. Each entry:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | The `server-id` or `client-id` of the target. |
| `location` | string | yes | `VELOCITY` or `BACKEND`. |

You can register the same command on multiple targets:

```yaml
register:
  - id: "proxy-1"
    location: VELOCITY
  - id: "survival-1"
    location: BACKEND
```

---

## defaults

Default execution settings. Every field here is inherited by each entry in `commands` unless explicitly overridden.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `run-as` | string | `CONSOLE` | Execution context: `CONSOLE`, `PLAYER`, or `OPERATOR`. |
| `execute` | list | -- | Where to send the command. Same format as `register`. |
| `server` | object | -- | Player-related scheduling settings. See below. |
| `delay` | duration | `0s` | Delay before executing. Supports `s`, `m`, `h`, `d` suffixes. |
| `cooldown` | duration | `0s` | Per-player cooldown between uses. Same suffix support. |

### run-as modes

| Mode | Description |
|------|-------------|
| `CONSOLE` | Command runs as the server console. |
| `PLAYER` | Command runs as the triggering player. |
| `OPERATOR` | Command runs as the player with temporary operator-level permissions. |

### server (scheduling)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `target-required` | boolean | `false` | If `true`, abort when the target player is not online on the backend. Ignored for `CONSOLE` executor. |
| `schedule-online` | boolean | `false` | If `true`, queue the command until the target player comes online. |
| `timeout` | duration | `5s` | How long to wait for a scheduled command before giving up. |

---

## args

Argument definitions. Each entry:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | -- | Name used as `${name}` placeholder in commands. |
| `required` | boolean | no | `false` | Whether the player must provide this argument. |
| `type` | string | no | `STRING` | Argument type. See [Argument Types](/docs/scripting/argument-types/). |
| `suggestions` | list | no | -- | Static suggestions for tab completion. Each must match `^[a-z0-9._+\-]+$`. |

Arguments are processed in order. Required arguments must come before optional ones.

---

## commands

A list of commands to execute. Each entry:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | yes | The command to run. Use `${argname}` for argument placeholders. No leading `/` needed. |
| `run-as` | string | no | Override `defaults.run-as` for this command. |
| `execute` | list | no | Override `defaults.execute` for this command. |
| `server` | object | no | Override `defaults.server` for this command. |
| `delay` | duration | no | Override `defaults.delay` for this command. |
| `cooldown` | duration | no | Override `defaults.cooldown` for this command. |

Fields marked with "Override" inherit from `defaults` when not set. This lets you define common settings once and only override where needed.

{% hint "info" %}
You can have multiple commands in one script. They are processed in order.
{% endhint %}

---

## Duration format

Duration fields (`delay`, `cooldown`, `timeout`) accept:

- `0s`, `5s`, `30s` -- seconds
- `1m`, `5m` -- minutes
- `1h` -- hours
- `1d` -- days
- Bare numbers are treated as seconds
