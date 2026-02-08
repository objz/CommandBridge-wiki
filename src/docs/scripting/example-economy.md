---
title: "Example: Economy"
order: 7
---

Give money to a player on a backend server from the proxy. Demonstrates typed arguments and targeting a specific backend.

### Script

```yaml
version: 2
name: eco-give
description: Give money to a player on a backend
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
    target-required: false
    schedule-online: false
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
```

### What happens

- Registers `/eco-give` (alias `/eco`) on Velocity
- `player` uses the `PLAYERS` type -- tab-completes online players and supports selectors like `@a`
- `amount` uses `RANGE` -- accepts values like `100`, `1..1000`
- The resolved command is sent to `survival-1`'s console

### Test it

```
/eco-give Steve 500
```

Runs `eco give Steve 500` on the `survival-1` server console.

### Permissions

```bash
lpv user playerName permission set commandbridge.command.eco-give true
```

{% hint "info" %}
This script is registered on Velocity but the `PLAYERS` and `RANGE` argument types are backend-only. CommandBridge handles this by registering the tab-completion on the backend specified in `register`, then routing execution through the proxy.
{% endhint %}
