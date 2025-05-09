---
title: Syntax
order: 1
---

CommandBridge scripts use **YAML** to define cross-server commands and their execution logic.

```yaml
name: "example"
enabled: true
ignore-permission-check: false
hide-permission-warning: false
commands:
  - command: "say Hello"
    delay: 0
    target-executor: "console"
    target-client-ids:
      - "lobby"
    wait-until-player-is-online: true
    check-if-executor-is-player: true
    check-if-executor-is-on-server: true
```
<div class="h-4"></div>

---

### Script Fields

| Field                     | Type    | Description                                                   |
| ------------------------- | ------- | ------------------------------------------------------------- |
| `name`                    | String  | Becomes the command (e.g. `alert` → `/alert`). No `/` needed. |
| `enabled`                 | Boolean | Whether the script is active.                                 |
| `ignore-permission-check` | Boolean | Bypasses internal permission handling.                        |
| `hide-permission-warning` | Boolean | Suppresses permission-denied messages.                        |
| `commands`                | List    | One or more command actions to run.                           |

---

### Command Fields

| Field                            | Type              | Description                                                |
| -------------------------------- | ----------------- | ---------------------------------------------------------- |
| `command`                        | String            | The raw command to run (without `/`).                      |
| `delay`                          | Integer (seconds) | Optional delay before execution.                           |
| `target-executor`                | String            | Who runs it: `"player"` or `"console"`.                    |
| `target-client-ids`              | List              | Target servers. **Only used by Velocity.**                 |
| `wait-until-player-is-online`    | Boolean           | Delay execution until player is online. **Velocity only.** |
| `check-if-executor-is-player`    | Boolean           | Only run if triggered by a player.                         |
| `check-if-executor-is-on-server` | Boolean           | Only run if the triggering player is online.               |

<div class="h-4"></div>

{% hint "info" %}
Fields like `target-client-ids` and `wait-until-player-is-online` are ignored on Paper.
{% endhint %}

