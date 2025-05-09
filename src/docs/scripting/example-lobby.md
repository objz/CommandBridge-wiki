---
title: "Example: lobby"
order: 4
---

**Goal:** Forward a proxy `/server lobby` command from a Paper server.

```yaml
name: lobby
enabled: true
ignore-permission-check: false
hide-permission-warning: false
commands:
  - command: "server lobby"
    delay: 0
    target-executor: "player"
    check-if-executor-is-player: true
    check-if-executor-is-on-server: true
```

#### What happens?

* Registers `/lobby` command.
* Runs `server lobby` on the player.
* Player is moved to the `lobby` server via proxy.

> This command is triggered from the **Paper server** and automatically forwarded to **Velocity**.

{% hint "warning" %}
Set the permission `commandbridge.command.lobby` on **Paper**, not Velocity.
{% endhint %}
