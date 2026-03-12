---
title: Welcome
order: 1
description: "Documentation for CommandBridge 3.3.0, a Velocity plugin for executing commands across your entire Minecraft network using YAML scripts."
---

This is the documentation for CommandBridge.

CommandBridge is a cross-server command execution plugin for Minecraft networks running via Velocity. You define commands in YAML scripts on the proxy, and CB registers and dispatches them across all connected backend servers. No plugin messaging, no player required on the target server, no limitations.

---

### What's new in 3.3.0

- Scripts now use schema `version: 4`.
- Added `player-arg` for `target-required` / `schedule-online` player resolution.
- Added `OFFLINE_PLAYER` argument type and improved name-to-UUID resolution.
- Added `/cb dump` for support diagnostics (sanitized upload + local copy).
- Added `/cb migrate` to migrate older scripts to the latest script schema.

---

### Links

- [Migration Guide](/docs/migration/)
- [GitHub](https://github.com/objz/CommandBridge)
- [Modrinth](https://modrinth.com/plugin/commandbridge)
- [Discord](https://discord.gg/QPqBYb44ce)
