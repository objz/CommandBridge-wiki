---
title: Commands
order: 8
---

CommandBridge provides admin commands on both sides of the network.

---

## Velocity commands

Base command: `/commandbridge` (alias: `/cb`)

Permission: `commandbridge.admin`

| Command | Description |
|---------|-------------|
| `/cb help` | Show available commands. |
| `/cb info` | Show plugin version, uptime, and connection info. |
| `/cb list` | List all connected clients and their status. |
| `/cb ping [clientId]` | Ping a specific client or all clients. Shows round-trip latency. |
| `/cb scripts [page]` | List loaded scripts with pagination. |
| `/cb reload` | Reload all scripts from disk. Does not reload `config.yml` (restart required for config changes). |
| `/cb debug` | Toggle debug logging on/off. |
| `/cb dump` | Generate a diagnostic dump for bug reports. |

### Example output

```
> /cb list
Connected clients (2):
  survival-1  [connected]  12ms
  lobby       [connected]   8ms
```

```
> /cb ping survival-1
Pong from survival-1: 12ms
```

---

## Backend commands

Base command: `/commandbridgeclient` (alias: `/cbc`)

Permission: `commandbridge.admin`

| Command | Description |
|---------|-------------|
| `/cbc reconnect` | Disconnect from the proxy and reconnect. Useful after config changes or connection issues. |

---

## Notes

- All admin commands require `commandbridge.admin` permission
- Admin commands output in two formats: styled chat (MiniMessage with clickable elements) for players, and ANSI box-drawing for the console
- `/cb reload` only reloads scripts, not the main config. For config changes, restart the server.
