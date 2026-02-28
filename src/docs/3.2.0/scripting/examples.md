---
title: Examples
order: 4
---

Real-world script examples to get you started. Each one demonstrates a different use case. You can copy them, change the `id` values to match your setup, and they should work.

All scripts go in `plugins/commandbridge/scripts/` on Velocity.

---

## Alert: broadcast to multiple servers

Broadcast a maintenance warning to all your backend servers from the proxy. This is probably the most common use case for CB.

```yaml
version: 3
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
  delay: 0s
  cooldown: 0s

args:
  - name: message
    required: true
    type: GREEDY_STRING
    suggestions: []

commands:
  - command: "say [Alert]: ${message}"
```

**What happens:**
- Registers `/alert` on the Velocity proxy
- When someone runs it, `say [Alert]: <message>` is sent to the console on all three backends
- Uses `GREEDY_STRING` so the message can contain spaces without quoting

**Permission:** `commandbridge.command.alert`

---

## Lobby: send player to another server

Send the player to the lobby server. This is registered on a backend so players can run `/lobby` while playing on survival (or any other game mode).

```yaml
version: 3
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
  delay: 0s
  cooldown: 0s

args: []

commands:
  - command: "server lobby"
```

**What happens:**
- Registers `/lobby` (and `/hub`) on the backend `survival-1`
- When a player runs it, `server lobby` is forwarded to Velocity and executed as the player
- The player gets transferred to the `lobby` server

**Key detail:** `run-as: PLAYER` is required here because `server lobby` needs to run in the player's context on Velocity. If you used `CONSOLE`, it would try to send the console to lobby, which obviously doesn't work.

**Permission:** `commandbridge.command.lobby`

{% hint "info" %}
This technique can be used to bridge Velocity-only commands to your backend servers. In this case, the `/server lobby` command would exist as a native backend command, allowing plugins on that server to execute it and, for example, send players to the lobby.
{% endhint %}

---

## Economy: typed arguments with backend-only types

Give money to a player. Demonstrates using argument types like `PLAYERS` and `INTEGER` for proper tab completion and input validation.

```yaml
version: 3
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
  delay: 0s
  cooldown: 0s

args:
  - name: player
    required: true
    type: PLAYERS
    suggestions: []

  - name: amount
    required: true
    type: INTEGER
    suggestions: []

commands:
  - command: "eco give ${player} ${amount}"
```

**What happens:**
- Registers `/eco-give` (and `/eco`) on `proxy-1`
- `PLAYERS` gives tab completion for online players
- `INTEGER` only accepts whole numbers, so a player can't type random text here

**Permission:** `commandbridge.command.eco-give`

---

## Punishment: multiple commands and per-command overrides

Ban a player across the network. This shows how to run multiple commands in one script and override execution targets per command. A common pattern for network-wide moderation.

```yaml
version: 3
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
    - id: "lobby-1"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
  delay: 0s
  cooldown: 0s

args:
  - name: target
    required: true
    type: PLAYERS
    suggestions: []

  - name: reason
    required: false
    type: GREEDY_STRING
    suggestions: []

commands:
  - command: "ban ${target} ${reason}"

  - command: "say ${target} has been banned: ${reason}"
    execute:
      - id: "admin-1"
        location: BACKEND
    run-as: CONSOLE
```

**What happens:**

1. `/netban Steve cheating` is run on Velocity
2. First command: `ban Steve cheating` runs on `survival-1` and `lobby` consoles (uses the defaults)
3. Second command: `say Steve has been banned: cheating` runs on the Admin backend console (overrides `execute` to target only one backend instead of all backends)

**Permission:** `commandbridge.command.netban`

---

## Delayed reward: using delay and schedule-online

Give a player a reward 30 seconds after they run a command. If the player logs off before the delay is up, the command is queued and executes when they come back.

```yaml
version: 3
name: claim-reward
description: Claim your daily reward
enabled: true
aliases: [reward]

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
    schedule-online: true
  delay: 0s
  cooldown: 24h

args: []

commands:
  - command: "say ${player} is claiming their daily reward..."
  - command: "give ${player} diamond 5"
    delay: 30s
```

**What happens:**

1. Player runs `/claim-reward` on Velocity
2. The first command broadcasts immediately on the backend
3. The second command waits 30 seconds, then gives the player 5 diamonds
4. If the player disconnects during those 30 seconds, the command is queued and runs when they reconnect
5. The `cooldown: 24h` prevents them from using it again for 24 hours(the cooldown is not permanent, it does not survive server restarts)

**Permission:** `commandbridge.command.claim-reward`
