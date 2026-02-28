---
title: "Example: Economy"
order: 7
---

Give money to a player on a backend server. Demonstrates typed arguments with backend-only argument types.

### Script

Place this in `plugins/commandbridge/scripts/eco-give.yml` on Velocity:

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
  - id: "survival-1"
    location: BACKEND

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
    type: INTEGER

commands:
  - command: "eco give ${player} ${amount}"
```

### What happens

- Registers `/eco-give` (alias `/eco`) on the backend `survival-1`
- `player` uses the `PLAYERS` type. Tab-completes online players and supports selectors like `@a`.
- `amount` uses `INTEGER`. Accepts whole numbers.
- The resolved command runs on `survival-1`'s console

### Test it

```
/eco-give Steve 500
```

Runs `eco give Steve 500` on the `survival-1` server console.

### Permissions

Set the permission on the **backend** where the command is registered:

```bash
lp user playerName permission set commandbridge.command.eco-give true
```

{% hint "warning" %}
`PLAYERS` is a backend-only argument type. It can only be used in scripts that register on a `BACKEND`. See [Argument Types](/docs/scripting/argument-types/) for platform availability.
{% endhint %}
