---
title: "Example: Lobby"
order: 6
---

Send a player to the lobby server using a command registered on a backend.

### Script

Place this script on a **backend server** (e.g. `survival-1`):

```yaml
version: 2
name: lobby
description: Send the player to the lobby
enabled: true
aliases: [hub]

permissions:
  enabled: true
  silent: false

register:
  - id: "survival-1"
    location: BACKEND

defaults:
  run-as: PLAYER
  execute:
    - id: "proxy-1"
      location: VELOCITY
  server:
    target-required: false
    schedule-online: false
    timeout: 5s
  delay: 0s
  cooldown: 0s

args: []

commands:
  - command: "server lobby"
```

### What happens

- Registers `/lobby` (and alias `/hub`) on the backend server `survival-1`
- When a player runs it, the command `server lobby` is forwarded to Velocity and executed as the player
- The player is transferred to the `lobby` server

### Permissions

Set `commandbridge.command.lobby` on the **backend** (where the command is registered).

```bash
lp user playerName permission set commandbridge.command.lobby true
```

{% hint "info" %}
`run-as: PLAYER` is required here because `server lobby` needs to run in the player's context on Velocity.
{% endhint %}
