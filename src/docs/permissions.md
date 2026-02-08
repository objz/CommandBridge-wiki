---
title: Permissions
order: 9
---

CommandBridge uses two permission nodes. A permissions plugin is required on both Velocity and backends. [LuckPerms](https://luckperms.net/) is recommended.

---

### Permission nodes

| Permission | Description |
|------------|-------------|
| `commandbridge.admin` | Access to all admin commands (`/cb`, `/cbc`). |
| `commandbridge.command.<name>` | Permission to run a specific script command. Replace `<name>` with the script name. |

---

### Where to set permissions

Set the permission where the command is **registered**.

- **Command registered on Velocity** -- set the permission on Velocity
- **Command registered on a backend** -- set the permission on that backend
- **Admin commands** -- always set on the side you want to use them

#### LuckPerms examples

```bash
# Grant admin access on Velocity
lpv user playerName permission set commandbridge.admin true

# Grant /alert permission on Velocity
lpv user playerName permission set commandbridge.command.alert true

# Grant /lobby permission on a backend
lp user playerName permission set commandbridge.command.lobby true
```

---

### Disabling permission checks

In any script, set `permissions.enabled` to `false` to skip the permission check entirely:

```yaml
permissions:
  enabled: false
  silent: false
```

To keep the check but suppress the error message when a player lacks permission:

```yaml
permissions:
  enabled: true
  silent: true
```

---

### Run-as modes and permissions

| Mode | Permission behavior |
|------|-------------------|
| `CONSOLE` | No permission check on the executing side -- console has full access. |
| `PLAYER` | The player's own permissions apply on the target server. |
| `OPERATOR` | The player is temporarily granted elevated permissions for the command, including `commandbridge.command.<name>`, the base command permission, and `<base>.*`. |

{% hint "warning" %}
`OPERATOR` mode grants broad permissions temporarily. Use it only when the target command requires permissions the player doesn't normally have.
{% endhint %}
