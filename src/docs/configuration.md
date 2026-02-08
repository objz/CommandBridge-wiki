---
title: Configuration
order: 5
---

CommandBridge uses `config.yml` on both sides. The file is auto-generated on first startup with sensible defaults.

Configs use [Configurate](https://github.com/SpongePowered/Configurate) YAML format. Changes take effect after restart, or after `/cb reload` for script-related settings.

- [Velocity configuration](/docs/configuration/velocity/) -- proxy-side settings (bind address, security, limits, heartbeat)
- [Backends configuration](/docs/configuration/backends/) -- client-side settings (connection, authentication, reconnect)
