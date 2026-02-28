---
title: Requirements
order: 2
---

CommandBridge has some requirements that need to be installed alongside it. Also, the supported platforms are listed here.

---

### Runtime

| Requirement | Version |
|---|---|
| Java | 21+ |
| Minecraft | 1.20.x to 1.21.x |


### Platforms

| Platform | Supported |
|---|---|
| Velocity | Yes |
| Paper | Yes |
| Folia | Yes |
| Bukkit / Spigot | Yes |
| Purpur | Yes |
| Forge | No |
| Fabric | No |
| NeoForge | No |



### Requirements

| Plugin/Library | Where | Why | Required |
|---|---|---|---|
| [CommandAPI](https://modrinth.com/plugin/commandapi) | Velocity/Backends | For command dispatching | required |
| [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) | Backends | For PAPI placeholders | optional |
| [PapiProxyBridge](https://modrinth.com/plugin/papiproxybridge) | Velocity | Resolve PAPI placeholders proxy-side | optional |
| [PacketEvents](https://modrinth.com/plugin/packetevents) | Velocity | Enable the `TIME` argument type | optional |

{% hint "info" %}
CommandBridge requires a permissions plugin on velocity. [LuckPerms](https://luckperms.net/) is recommended.
{% endhint %}
