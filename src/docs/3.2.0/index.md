---
title: Welcome
order: 1
description: "Documentation for CommandBridge 3.2.0, a Velocity plugin for executing commands across your entire Minecraft network using YAML scripts."
---

This is the documentation for CommandBridge.

CommandBridge is a cross-server command execution plugin for Minecraft networks running via Velocity. You define commands in YAML scripts on the proxy, and CB registers and dispatches them across all connected backend servers. No plugin messaging, no player required on the target server, no limitations.

---

### What's new in 3.2.0

this version brings some nice additions mostly around target-required
and player tracking across proxies. the wiki has been fully rewritten for this version so make sure to check that out.

so whats new:

- target-required per command option. this makes sure the player is actually on the target server before dispatching the command. also works when a proxy is in client mode so it checks across all connected proxies not just the local one
- per-command cooldowns, the old pipeline cooldown stage is gone
- player presence tracking. backends and client mode proxies now sync their player lists to the proxy. the full list only gets sent once on auth and after that only join/leave deltas get sent so you dont have to worry about huge packets even with like 30k players
- added PLAYERS argument type for velocity
- scripts now require version 3

breaking changes:
- removed Server.timeout from the config
- removed some unused config values
- script version 3 is now required, older versions wont work anymore

latest commit: 37b29f5

---

### Links

- [GitHub](https://github.com/objz/CommandBridge)
- [Modrinth](https://modrinth.com/plugin/commandbridge)
- [Discord](https://discord.gg/QPqBYb44ce)
