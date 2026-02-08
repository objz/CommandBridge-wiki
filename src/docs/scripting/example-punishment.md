---
title: "Example: Punishment"
order: 8
---

Ban a player across the entire network. Demonstrates multiple commands in one script, console execution, and PAPI placeholders.

### Script

```yaml
version: 2
name: netban
description: Ban a player on all servers
enabled: true
aliases: [nban]

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
    - id: "lobby"
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
    type: STRING

  - name: reason
    required: false
    type: GREEDY_STRING

commands:
  - command: "ban ${target} ${reason}"

  - command: "kick ${target} You have been banned: ${reason}"
    execute:
      - id: "proxy-1"
        location: VELOCITY
    run-as: CONSOLE
```

### What happens

1. `/netban Steve cheating` is run on Velocity
2. First command: `ban Steve cheating` runs on `survival-1` and `lobby` consoles
3. Second command: `kick Steve You have been banned: cheating` runs on the Velocity console (overrides `execute` to target the proxy)

The ban is applied on each backend through their ban plugin, and the player is kicked from the proxy.

### Key concepts

- **Multiple commands**: Each entry in `commands` runs independently
- **Per-command overrides**: The second command overrides `execute` to target Velocity instead of the backends
- **Optional argument**: `reason` is optional -- if not provided, `${reason}` resolves to an empty string

### Permissions

```bash
lpv user playerName permission set commandbridge.command.netban true
```
