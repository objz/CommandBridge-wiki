---
title: Placeholders
order: 2
---

### Built-in Placeholders

These placeholders are always available — no plugins required.

| Placeholder                  | Paper | Velocity | Description                                  |
|-----------------------------|:-----:|:--------:|----------------------------------------------|
| `%cb_player%`               | ✅    | ✅       | The triggering player’s name.                |
| `%cb_uuid%`                 | ✅    | ✅       | The player’s UUID.                           |
| `%cb_world%`                | ✅    | ❌       | The player’s current world.                  |
| `%cb_server%`               | ❌    | ✅       | The player’s current Velocity server.        |
| `%args%`                    | ✅    | ✅       | The full raw argument string.                |
| `%arg[0]%`, `%arg[1]%`, …   | ✅    | ✅       | Individual arguments by index.               |

<div class="h-4"></div>


{% hint "info" %}
Platform-specific placeholders (like `%cb_world%` or `%cb_server%`) are automatically ignored when unsupported.
{% endhint %}

<div class="h-4"></div>

{% hint "warning" %}
Only `%args%` and `%arg[n]%` work for console executors; all other placeholders require a player executor.
{% endhint %}


<div class="h-4"></div>

***

### Argument Placeholders

Use `%args%` or `%arg[n]%` to insert player-provided input:

- `%args%` → everything after the command name  
- `%arg[0]%` → the first argument  
- `%arg[1]%` → the second argument  
- etc.

Helpful for passing dynamic values into commands across servers.

***

### Example: Cross-Server Announcements

Broadcast a custom message using `/announce <message>`:

```yaml
name: announce
enabled: true
ignore-permission-check: false
hide-permission-warning: false
commands:
  - command: "say [Notice] %args%"
    delay: 0
    target-client-ids:
      - "lobby"
      - "survival"
    target-executor: "console"
    wait-until-player-is-online: false
    check-if-executor-is-player: true
    check-if-executor-is-on-server: true
```

If a player runs:

```
/announce Hello world
```

The result on each target server will be:

> `[Notice] Hello world`

---

### PlaceholderAPI Integration

CommandBridge supports full **PlaceholderAPI (PAPI)** support:

* **On Paper:** install [`PlaceholderAPI`](https://www.spigotmc.org/resources/placeholderapi.6245/)
* **On Velocity:** install [`PapiProxyBridge`](https://modrinth.com/plugin/papiproxybridge)

Example usage:

```yaml
- command: "say Welcome %luckperms_prefix% %cb_player%!"
```

> Output: `Welcome [Admin] Alex!`

{% hint "info" %}
PAPI is optional, but recommended for dynamic metadata like prefixes, stats, or permissions.
{% endhint %}
