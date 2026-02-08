---
title: Commands
order: 8
---

Admin commands for both sides of the network.

---

## Velocity

Base command: `/commandbridge` (alias `/cb`)

Requires `commandbridge.admin`.

- `/cb help` shows available commands
- `/cb info` shows plugin version, uptime, and connection info
- `/cb list` lists connected clients and their status
- `/cb ping [clientId]` pings a specific client or all clients
- `/cb scripts [page]` lists loaded scripts
- `/cb reload` reloads config and scripts from disk
- `/cb debug` toggles debug logging
- `/cb dump` generates a diagnostic dump for bug reports

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

## Backends

Base command: `/commandbridgeclient` (alias `/cbc`)

Requires `commandbridge.admin`.

- `/cbc reconnect` disconnects and reconnects to the proxy

---

## Notes

- Admin commands use styled chat (MiniMessage) for players and ANSI box-drawing for console
