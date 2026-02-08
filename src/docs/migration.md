---
title: Migration from v2
order: 11
---

This guide covers upgrading from CommandBridge v2 to v3. The script format, config structure, and connection system have all changed.

{% hint "danger" %}
Back up your configs and scripts before upgrading. v3 is not backwards-compatible with v2.
{% endhint %}

---

## What changed

| Area | v2 | v3 |
|------|----|----|
| Script format | Flat YAML with `target-client-ids`, `target-executor` | Structured YAML with `register`, `defaults`, `execute`, typed `args` |
| Arguments | `%args%`, `%arg[0]%` index-based | Named args with types: `${player}`, `${amount}` |
| Placeholders | `%cb_player%`, `%args%` | `${name}` for arguments, PAPI `%placeholder%` for external |
| Connection | Custom protocol | WebSocket with TLS |
| Config | `host`, `port`, `san`, `secret` flat | Nested sections: `security`, `timeouts`, `limits`, `heartbeat` |
| TLS | Not available | PLAIN, TOFU, STRICT modes |
| bStats | Included | Removed |
| Dependencies | None | CommandAPI required on backends |

---

## Migration steps

### 1. Back up everything

Copy your entire `plugins/CommandBridge/` folder on both Velocity and all backends.

### 2. Remove old JARs, install new

1. Delete the old CommandBridge JAR from `plugins/` on both sides
2. Install the v3 JAR
3. Install [CommandAPI](https://commandapi.jorel.dev/) on each backend
4. Delete old config files (they'll be regenerated)
5. Start and stop both sides to generate v3 configs

### 3. Config migration

v2 and v3 config keys don't map 1:1. Set up the new config from scratch following the [Getting Started](/docs/getting-started/) guide.

Key differences:

| v2 key | v3 equivalent |
|--------|--------------|
| `host` (Velocity) | `bind-host` |
| `port` (Velocity) | `bind-port` |
| `san` | Removed (TLS handles this now) |
| `server-id` | `server-id` (same) |
| `remote` (backend) | `host` |
| `port` (backend) | `port` (same) |
| `client-id` | `client-id` (same) |
| `secret` (backend) | `security.secret` |
| `debug` | `debug` (same) |

### 4. Script migration

v3 scripts are a complete rewrite. You need to convert each script manually.

{% tabs %}
{% tab "v2 format" %}
```yaml
name: alert
enabled: true
ignore-permission-check: false
hide-permission-warning: false
commands:
  - command: "say Maintenance in 5 minutes!"
    delay: 0
    target-client-ids:
      - "lobby"
      - "survival"
    target-executor: "console"
    wait-until-player-is-online: false
    check-if-executor-is-player: false
    check-if-executor-is-on-server: false
```
{% endtab %}
{% tab "v3 format" %}
```yaml
version: 2
name: alert
description: Broadcast a maintenance alert
enabled: true
aliases: []

permissions:
  enabled: true
  silent: false

register:
  - id: "proxy-1"
    location: VELOCITY

defaults:
  run-as: CONSOLE
  execute:
    - id: "lobby"
      location: BACKEND
    - id: "survival"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
    timeout: 5s
  delay: 0s
  cooldown: 0s

args: []

commands:
  - command: "say Maintenance in 5 minutes!"
```
{% endtab %}
{% endtabs %}

#### Field mapping

| v2 field | v3 equivalent |
|----------|--------------|
| `name` | `name` (same, but now validated: lowercase, 3-33 chars, `a-z0-9-` only) |
| `aliases` | `aliases` (same) |
| `enabled` | `enabled` (same) |
| `ignore-permission-check` | `permissions.enabled: false` |
| `hide-permission-warning` | `permissions.silent: true` |
| `target-executor: "console"` | `defaults.run-as: CONSOLE` |
| `target-executor: "player"` | `defaults.run-as: PLAYER` |
| `target-client-ids` | `defaults.execute` (list of `{id, location}` objects) |
| `delay` (integer seconds) | `delay` (duration string, e.g. `5s`) |
| `wait-until-player-is-online` | `server.schedule-online: true` |
| `check-if-executor-is-player` | No direct equivalent. Use `run-as: PLAYER` to require a player executor. |
| `check-if-executor-is-on-server` | `server.target-required: true` |

#### Argument changes

v2 used `%args%` and `%arg[0]%` for raw argument passthrough. v3 uses named, typed arguments:

```yaml
# v2: raw arguments
commands:
  - command: "eco give %arg[0]% %arg[1]%"

# v3: typed arguments
args:
  - name: player
    required: true
    type: PLAYERS
  - name: amount
    required: true
    type: INTEGER

commands:
  - command: "eco give ${player} ${amount}"
```

v3 arguments give you tab-completion, validation, and type safety.

### 5. Permission changes

| v2 | v3 |
|----|-----|
| `commandbridge.admin` | `commandbridge.admin` (unchanged) |
| `commandbridge.command.<name>` | `commandbridge.command.<name>` (unchanged) |

Permissions work the same way. No changes needed.

### 6. Verify

1. Start Velocity, then backends
2. Check `/cb list` for connected clients
3. Test each migrated script
4. Check logs for validation errors

---

## Breaking changes

- **CommandAPI is now required** on all backends
- **bStats removed** -- delete `plugins/bStats/` if no other plugins use it
- **`san` config key removed** -- TLS handles certificate validation now
- **Script format completely changed** -- old scripts will not load
- **`%args%` / `%arg[n]%` removed** -- use named `${arg}` placeholders
- **`%cb_player%` / `%cb_server%` removed** -- use PAPI or named arguments instead
- **WebSocket on a dedicated port** -- v3 uses its own port (default `8765`), not plugin messaging channels
