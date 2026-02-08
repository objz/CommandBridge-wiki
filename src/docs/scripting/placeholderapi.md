---
title: PlaceholderAPI
order: 4
---

CommandBridge integrates with [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) (PAPI) to resolve external placeholders in your command strings.

### Requirements

| Plugin | Where | Purpose |
|--------|-------|---------|
| [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) | Backend servers | Provides placeholder resolution on backends. |
| [PapiProxyBridge](https://modrinth.com/plugin/papiproxybridge) | Velocity proxy | Bridges PAPI resolution to the proxy side. |

Both are optional. Without them, PAPI placeholders in your scripts will not be resolved.

### How it works

1. CommandBridge resolves `${arg}` argument placeholders first
2. If PAPI is available and the executor is a player, the resolved command string is passed through PlaceholderAPI
3. Any `%placeholder%` tokens in the string are replaced with their PAPI values

This means you can mix both systems in the same command:

```yaml
commands:
  - command: "say Welcome %luckperms_prefix% ${player}!"
```

If the triggering player has the `[Admin]` prefix and the `player` argument is `Steve`:

> `say Welcome [Admin] Steve!`

### Setup

1. Install PlaceholderAPI on each backend server
2. Install any PAPI expansion packs you need (e.g. `Player`, `LuckPerms`, `Vault`)
3. If you need PAPI on the Velocity side, install PapiProxyBridge on Velocity

No CommandBridge configuration is needed -- PAPI support is auto-detected.

### Example

A welcome command that includes the player's rank and balance:

```yaml
version: 2
name: welcome
description: Welcome a player with their rank and balance
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
    - id: "survival-1"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
    timeout: 5s
  delay: 0s
  cooldown: 0s

args:
  - name: target
    required: true
    type: PLAYERS

commands:
  - command: "say Welcome %luckperms_prefix% ${target}! Balance: %vault_eco_balance%"
```

{% hint "warning" %}
PAPI placeholders are resolved in the context of the **triggering player**, not the target. If you need the target's data, the target must be the executor (use `run-as: PLAYER`).
{% endhint %}

{% hint "info" %}
PAPI uses `%placeholder%` syntax. CommandBridge argument placeholders use `${name}` syntax. They don't conflict.
{% endhint %}
