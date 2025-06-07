---
title: Permissions
order: 6
---

CommandBridge requires a **permissions plugin** on both Velocity and Paper servers. I recommend [LuckPerms](https://luckperms.net/).

***

### **Permission Nodes**

| Permission | Description |
|------------|-------------|
| `commandbridge.admin` | Access to all admin commands like `/cb reload` |
| `commandbridge.command.<name>` | Permission to use a specific command |

Replace `<name>` with your script's name (e.g. `lobby`, `alert`, `test`).

***

### **Where to Set**

**Simple rule:** Set permissions where the command runs.

- **Admin permissions** → Set on Velocity only
- **Velocity commands** → Set on Velocity with `lpv`
- **Paper commands** → Set on Paper with `lp`

#### Examples

```bash
# Admin access (Velocity only)
lpv user playerName permission set commandbridge.admin true

# Velocity: Grant /alert permission
lpv user playerName permission set commandbridge.command.alert true

# Paper: Grant /lobby permission  
lp user playerName permission set commandbridge.command.lobby true
```

***

### **Bypass Permissions**

Add this to any script to skip permission checks:

```yaml
ignore-permission-check: true
```
<div class="h-4"></div>

{% hint "warning" %}
If you see "You do not have permission to use this command", check that the permission is set on the correct server (Velocity vs Paper) and that your permissions plugin is installed.
{% endhint %}
