---
title: Requirements
order: 3
---

### Java and Minecraft

- Java 21 or newer
- Minecraft 1.20.x to 1.21.x

---

### Platforms

| Platform | Supported |
|----------|-----------|
| Velocity | Yes (proxy side) |
| Paper | Yes (primary backend) |
| Folia | Yes (regionized multithreading) |
| Bukkit / Spigot | Yes (unless scripts use Paper-specific features) |
| Purpur / other Paper forks | Yes (not extensively tested) |
| Forge | No |
| Fabric | No |
| NeoForge | No |


### Required

- [CommandAPI](https://commandapi.jorel.dev/) on **Velocity and all backends**
- A permissions plugin on **both sides** ([LuckPerms](https://luckperms.net/) recommended)

---

### Optional

- [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) on backends for PAPI placeholders
- [PapiProxyBridge](https://modrinth.com/plugin/papiproxybridge) on Velocity to resolve PAPI placeholders proxy-side
- [PacketEvents](https://modrinth.com/plugin/packetevents) on Velocity to enable the `TIME` argument type
