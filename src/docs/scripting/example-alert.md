---
title: "Example: Alert"
order: 5
---

Broadcast a maintenance warning to multiple backend servers from the proxy.

### Script

```yaml
version: 2
name: alert
description: Broadcast an alert to all servers
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
    - id: "minigames"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
    timeout: 5s
  delay: 0s
  cooldown: 0s

args:
  - name: message
    required: true
    type: GREEDY_STRING

commands:
  - command: "say [Alert] ${message}"
```

### What happens

- Registers `/alert` on the Velocity proxy
- When run, sends `say [Alert] <message>` to the console on `lobby`, `survival`, and `minigames`
- Uses `GREEDY_STRING` so the message can include spaces

### Test it

```
/alert Maintenance in 5 minutes!
```

Each backend server broadcasts: `[Alert] Maintenance in 5 minutes!`

### Permissions

Set `commandbridge.command.alert` on **Velocity** (where the command is registered).

```bash
lpv user playerName permission set commandbridge.command.alert true
```
