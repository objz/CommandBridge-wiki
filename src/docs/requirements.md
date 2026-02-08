---
title: Requirements
order: 3
---

### Java and Minecraft

- **Java 21** or newer
- **Minecraft 1.20.x -- 1.21.x**

### Platform compatibility

| Platform | Support | Notes |
|----------|---------|-------|
| **Velocity** | Fully supported | Proxy side. Native command routing. |
| **Paper** | Fully supported | Primary backend platform. |
| **Folia** | Fully supported | Regionized multithreading compatible. |
| **Bukkit / Spigot** | Compatible | Works unless scripts use Paper-specific features. |
| **Purpur / other Paper forks** | Should work | Not extensively tested. |
| **Forge / Fabric / NeoForge** | Not supported | Plugin-based platforms only. |

### Required dependencies

| Dependency | Where | Purpose |
|------------|-------|---------|
| [CommandAPI](https://commandapi.jorel.dev/) | Backends | Command registration and argument parsing on backend servers. |
| A permissions plugin | Both sides | Permission checks for admin and script commands. [LuckPerms](https://luckperms.net/) recommended. |

### Optional dependencies

| Dependency | Where | Purpose |
|------------|-------|---------|
| [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) | Backends | Use PAPI placeholders in scripts. |
| [PapiProxyBridge](https://modrinth.com/plugin/papiproxybridge) | Velocity | Resolve PAPI placeholders on the proxy side. |
| [PacketEvents](https://modrinth.com/plugin/packetevents) | Velocity | Enables the `TIME` argument type on Velocity-registered commands. |
