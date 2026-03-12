---
title: Welcome
order: 1
description: "Documentation for CommandBridge 3.3.0, a Velocity plugin for executing commands across your entire Minecraft network using YAML scripts."
---

This is the documentation for CommandBridge.

CommandBridge is a cross-server command execution plugin for Minecraft networks running via Velocity. You define commands in YAML scripts on the proxy, and CB registers and dispatches them across all connected backend servers. No plugin messaging, no player required on the target server, no limitations.

---

### What's new in 3.3.0

this update is mostly about migration tooling, better player resolution, and support/debug quality of life.
also had some internal cleanup and an important fix for velocity running in client mode.

so whats new:

- added `/cb dump` for support snapshots (sanitized upload + local file export)
- added `/cb migrate` to migrate script files to the current schema
- migration is script-only now. there was a short config migration path but that got reverted again
- added `player-arg` per command for `target-required` and `schedule-online`
- added remote uuid resolving between connected proxies (`RESOLVE_UUID`) + local `UserCache` + Mojang fallback
- added `OFFLINE_PLAYER` argument type with suggestions support
- reworked schedule-online / player tracking flow to be more reliable and added clearer warning logs when player resolution fails
- fixed double command descriptions in command registration output
- fixed velocity client mode startup crash (`ClassNotFoundException: org.bukkit.command.CommandSender`)

breaking changes:
- scripts now require `version: 4`
- older scripts must be migrated first
- internal runtime files moved into the `data/` subdirectory

latest commit: e951a9e

---

### Links

- [Migration Guide](/docs/migration/)
- [GitHub](https://github.com/objz/CommandBridge)
- [Modrinth](https://modrinth.com/plugin/commandbridge)
- [Discord](https://discord.gg/QPqBYb44ce)
