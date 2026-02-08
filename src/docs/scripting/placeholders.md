---
title: Placeholders
order: 3
---

CommandBridge uses `${name}` placeholders in command strings to insert argument values at runtime.

### Argument placeholders

Every argument defined in the `args` list becomes a placeholder you can use in `commands`:

```yaml
args:
  - name: player
    required: true
    type: PLAYERS

  - name: amount
    required: true
    type: INTEGER

commands:
  - command: "eco give ${player} ${amount}"
```

When a player runs `/eco-give Steve 100`, the command resolves to `eco give Steve 100`.

---

### How resolution works

1. Player runs the command with arguments
2. Each `${name}` in the command string is looked up from the arguments map
3. Values are serialized based on their type (see [Argument Types](/docs/scripting/argument-types/) for serialization rules)
4. If PlaceholderAPI is available and the executor is a player, PAPI placeholders are resolved after argument placeholders

---

### Optional arguments

If an optional argument isn't provided, its placeholder resolves to an empty string:

```yaml
args:
  - name: target
    required: true
    type: PLAYERS

  - name: message
    required: false
    type: GREEDY_STRING

commands:
  - command: "msg ${target} ${message}"
```

Running `/cmd Steve` resolves to `msg Steve ` (with trailing space). Running `/cmd Steve hello` resolves to `msg Steve hello`.

---

### Tips

- Placeholder names must match the argument `name` exactly (case-sensitive)
- Use descriptive names: `${player}`, `${amount}`, `${reason}` -- not `${a}`, `${b}`
- Only arguments referenced in at least one command string are registered with the command system
- Placeholders are validated at script load time -- a `${name}` that doesn't match any argument will produce a warning
