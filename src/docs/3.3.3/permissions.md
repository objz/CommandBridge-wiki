---
title: Permissions
order: 7
description: "CommandBridge permission nodes for admin commands and per-script command access. All permissions are managed on the Velocity proxy."
---

CommandBridge permission handling is simple.

You need a permissions plugin on Velocity, because command usage permissions are checked there.
So in practice: use LuckPerms on Velocity (`lpv`).

---

### Permission nodes

| Permission | What it does |
|---|---|
| `commandbridge.admin` | Access to admin commands (`/cb` on Velocity, `/cbc reconnect` on backends). |
| `commandbridge.command.<name>` | Permission to use a script command (`<name>` = script `name`). |

Example: if your script name is `alert`, the permission is `commandbridge.command.alert`.

---

### Important

Every permission for script command usage must be set on Velocity.

Even if the command executes on a backend, permission is checked on the proxy side first.

```bash
# grant command usage on Velocity
lpv user playerName permission set commandbridge.command.alert true
```
