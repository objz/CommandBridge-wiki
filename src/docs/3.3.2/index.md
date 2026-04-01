---
title: Welcome
order: 1
description: "Documentation for CommandBridge 3.3.2, a Velocity plugin for executing commands across your entire Minecraft network using YAML scripts."
---

This is the documentation for CommandBridge.

CommandBridge is a cross-server command execution plugin for Minecraft networks running via Velocity. You define commands in YAML scripts on the proxy, and CB registers and dispatches them across all connected backend servers. No plugin messaging, no player required on the target server, no limitations.

---

### What's new in 3.3.2

this update adds a public developer API for third-party plugins, hardens auth security, and fixes a bunch of stability issues across the board.

so whats new:

- new `api` module for third-party plugin integration, available on Maven Central
- typed message channels, server lifecycle events, connection state tracking, player locator service
- hardened auth flow with constant-time HMAC comparison to prevent timing attacks
- fixed `AUTH_OK` race condition where messages could be sent before the client processed auth success
- added reconnect on failed server proof verification
- operator execution no longer grants wildcard permissions, only explicit ones
- fixed cooldown being applied before dispatch instead of after
- fixed MiniMessage tags in error messages not being escaped
- fixed script reload not being thread-safe
- fixed player join events firing for already-tracked players
- various null guard and stability improvements across dispatch, registration, and player tracking

breaking changes:
- `RunAs` and `ConnectionState` moved to the `api` package, internal duplicates removed

latest commit: d7f43a1

---

### Links

- [Migration Guide](/docs/migration/)
- [GitHub](https://github.com/objz/CommandBridge)
- [Modrinth](https://modrinth.com/plugin/commandbridge)
- [Discord](https://discord.gg/QPqBYb44ce)
