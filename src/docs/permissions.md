---
title: Permissions
order: 9
---

Two permission nodes. Requires a permissions plugin on both Velocity and backends. [LuckPerms](https://luckperms.net/) recommended.

---

### Permission nodes

- `commandbridge.admin` grants access to all admin commands (`/cb`, `/cbc`).
- `commandbridge.command.<name>` grants access to run a specific script command.

---

### Where to set permissions

Set the permission where the command is **registered**.

- Command registered on Velocity → set on Velocity
- Command registered on a backend → set on that backend
- Admin commands → set on the side you want to use them

#### LuckPerms examples

```bash
# Admin access on Velocity
lpv user playerName permission set commandbridge.admin true

# /alert permission on Velocity
lpv user playerName permission set commandbridge.command.alert true

# /lobby permission on a backend
lp user playerName permission set commandbridge.command.lobby true
```

---

### Disabling permission checks

Skip the permission check entirely:

```yaml
permissions:
  enabled: false
  silent: false
```

Keep the check but suppress the error message:

```yaml
permissions:
  enabled: true
  silent: true
```

---

### Run-as modes

- `CONSOLE` has full access, no permission check on the executing side.
- `PLAYER` uses the player's own permissions on the target server.
- `OPERATOR` temporarily grants elevated permissions for the command.

{% hint "warning" %}
`OPERATOR` grants broad permissions temporarily. Only use it when the target command requires permissions the player doesn't normally have.
{% endhint %}
