---
title: Placeholders
order: 3
---

CommandBridge uses `${name}` placeholders in command strings to insert argument values at runtime. It also supports PlaceholderAPI if you need external data like player ranks or balances.

There are two placeholder systems and they use different syntax, so they don't conflict with each other.

---

## Argument placeholders

Every argument defined in your `args` list becomes a `${name}` placeholder you can reference in `commands`. The name in the placeholder must match the argument name exactly:

```yaml
name: eco-give
args:
  - name: player
    required: true
    type: PLAYERS
    suggestions: []

  - name: amount
    required: true
    type: INTEGER
    suggestions: []

commands:
  - command: "eco give ${player} ${amount}"
```

When someone runs `/eco-give Steve 100`, the command resolves to `eco give Steve 100` and gets dispatched to the target.

---

## Optional arguments

If an optional argument is not provided by the player, its placeholder resolves to an empty string:

```yaml
name: msg-test
args:
  - name: target
    required: true
    type: PLAYERS
    suggestions: []

  - name: message
    required: false
    type: GREEDY_STRING
    suggestions: []

commands:
  - command: "msg ${target} ${message}"
```

Running `/msg-test Steve` resolves to `msg Steve ` (with a trailing space). Running `/cmd Steve hello` resolves to `msg Steve hello`. Keep in mind that the trailing space might matter for some commands, so be aware of it when using optional arguments at the end.

---

## Validation

Placeholders are validated when the script loads. CB checks that every `${name}` in your command strings actually has a matching argument in the `args` list. If you write `${amount}` but there is no argument named `amount`, you get a warning.

- Placeholder names must match the argument `name` exactly. They are case-sensitive.
- Only arguments referenced as `${name}` in at least one command string are actually used during execution.
- Use descriptive names: `${player}`, `${amount}`, `${reason}`. Not `${a}`, `${b}`, `${c}`. Your future self will thank you.

---

## PlaceholderAPI integration

CommandBridge integrates with [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) (PAPI) to resolve external placeholders in your command strings. This lets you inject data like player ranks, balances, or any other PAPI expansion into your commands.

### Requirements

| Plugin | Where | Purpose |
|--------|-------|---------|
| [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) | Backends | Provides placeholder resolution on backend servers |
| [PapiProxyBridge](https://modrinth.com/plugin/papiproxybridge) | Velocity | Bridges PAPI resolution to the proxy side |

Both are optional. Without them, `%placeholder%` tokens in your commands stay as-is and are not resolved. The commands still work, you just don't get PAPI values.
> CommandBridge automaticly detecs whether PlaceholderAPI is installed - you don't have to enable anything.

### How it works

After CommandBridge resolves all `${arg}` placeholders, it passes the resulting command string through PlaceholderAPI if available. Any `%placeholder%` tokens are then replaced with their PAPI values.

You can mix both systems in the same command:

```yaml
commands:
  - command: "say Welcome %luckperms_prefix% ${player}!"
```

If the triggering player has the `[Admin]` prefix and the `player` argument is `Steve`:

> `say Welcome [Admin] Steve!`

{% hint "warning" %}
PAPI placeholders are resolved in the context of the **triggering player**, not the target. If you need target-specific data (like the target's balance), the target must be the executor using `run-as: PLAYER`.
{% endhint %}
