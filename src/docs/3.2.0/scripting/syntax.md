---
title: Syntax
order: 1
---

### Default example

This shows every field you can use in a script. Most of the time you won't need all of them, but this is the full picture so you know what exists:

```yaml
version: 3

name: example
description: An example command script - edit or replace this with your own
enabled: false
aliases: [ex]

permissions:
  enabled: true
  silent: false

register:
  - id: "client-1"
    location: VELOCITY

defaults:
  run-as: CONSOLE
  execute:
    - id: "survival-1"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
  delay: 0s
  cooldown: 0s

args:
  - name: player
    required: true
    type: STRING
    suggestions: []

  - name: message
    required: true
    type: TEXT
    suggestions: []

commands:
  - command: "msg ${player} ${message}"
    server:
        target-required: true
    delay: 2s
```

Don't worry if this looks like a lot. Its not that complex. I just wanted to show everything in one place.

---

## Top-level fields

These are the fields at the root of the script file. They define what the command is called, whether it is active, and some basic metadata.

{% configentry "version", "integer", "1 | 2 | 3" %}
Schema version. Always use `3`. Version 1 and 2 are deprecated. This field is required and must be the first thing in the file.
{% endconfigentry %}

{% configentry "name", "string", "" %}
The command name. This becomes `/name` in-game. Must be lowercase, start with a letter, 3 to 33 characters long, and only contain `a-z`, `0-9`, or `-`. So `example-command` is fine, `ExampleCommand` or `e` is not.
{% endconfigentry %}

{% configentry "description", "string", "" %}
A short description shown in `/help <name>`. Not required, but I recommend setting one so people know what the command does without reading the script file.
{% endconfigentry %}

{% configentry "enabled", "boolean", "true | false" %}
Set to `false` to disable the script without deleting the file. Disabled scripts are loaded but not registered anywhere.
{% endconfigentry %}

{% configentry "aliases", "list", "" %}
Alternative command names. Same naming rules as `name`. So if your command is called `example`, you could add `ex` as an alias.
{% endconfigentry %}

---

## permissions

Controls whether CommandBridge checks the `commandbridge.command.<name>` permission before executing. See [Permissions](/docs/permissions/) for details on where to set them.

{% configentry "enabled", "boolean", "true | false" %}
When `true`, the player needs `commandbridge.command.<name>` to run this command. When `false`, everyone can use it.
{% endconfigentry %}

{% configentry "silent", "boolean", "true | false" %}
When `true`, permission denials are silent. The player gets no error message, the command just does nothing. Useful for commands that should be invisible to unauthorized players.
{% endconfigentry %}

---

## register

A list of targets where the command should be registered. Each entry needs an `id` and a `location`. This is where the command shows up in tab completion and where players can type it.

{% configentry "id", "string", "" %}
The `server-id` or `client-id` of the target. Must match exactly what is in that instance's config. If it doesn't match, the command won't register on that target and you will see a warning.
{% endconfigentry %}

{% configentry "location", "enum", "VELOCITY | BACKEND" %}
Whether the target is the proxy or a backend server. The `VELOCITY` option can only be used for proxies that have the `act-as-client` enabled
{% endconfigentry %}

You can register the same command on multiple targets. This is useful if you want the command to be available on multiple backends for example:

```yaml
register:
  - id: "hub-1"
    location: BACKEND
  - id: "survival-1"
    location: BACKEND
```

---

## defaults

Default execution settings. Every field here is inherited by each entry in `commands` unless that entry explicitly overrides it. Define your common settings once here, and only override where you actually need something different. This keeps your scripts short and clean.

{% configentry "run-as", "enum", "CONSOLE | PLAYER | OPERATOR" %}
How the command runs on the target server. `CONSOLE` runs as the server console with full permissions. `PLAYER` runs as the triggering player with their own permissions. `OPERATOR` runs as the player but with temporary elevated permissions for that specific command.
{% endconfigentry %}

{% configentry "execute", "list", "" %}
Where to send the command for execution. This is where the command actually runs, not where it is registered. The distinction matters because you can register a command on Velocity but execute it on a backend.
    {% configentry "id", "string", "" %}
    The `server-id` or `client-id` of the target. Must match exactly what is in that instance's config. If it doesn't match, the command won't register on that target and you will see a warning.
    {% endconfigentry %}

    {% configentry "location", "enum", "VELOCITY | BACKEND" %}
    Whether the target is the proxy or a backend server. The `VELOCITY` option can only be used for proxies that have the `act-as-client` enabled
    {% endconfigentry %}
{% endconfigentry %}

{% configentry "server", "list", "" %}
    Controls player targeting and online/offline scheduling. These only matter when you are executing commands that involve a specific player on a backend.

    {% configentry "target-required", "boolean", "true | false" %}
    If `true`, the command is aborted when the target player is not online on the backend. If the player is not there, the command simply gets skipped. Ignored when `run-as` is `CONSOLE`.
    {% endconfigentry %}

    {% configentry "schedule-online", "boolean", "true | false" %}
    If `true`, the command is queued until the target player connects to the backend. The command is saved to disk so it survives server restarts. When the player finally joins that server, the command runs automatically.
    {% endconfigentry %}

    {% hint "info" %}
    Scheduled commands are saved to `tasks.json` on the Velocity proxy. They survive restarts. If the script is deleted or renamed before the player connects, the queued task is discarded because there is nothing to execute anymore.
    {% endhint %}
{% endconfigentry %}

{% configentry "delay", "duration", "" %}
Delay before executing. If you set this to `2s`, the command waits 2 seconds before it is dispatched.
{% endconfigentry %}

{% configentry "cooldown", "duration", "" %}
Per-player cooldown between uses. If a player runs the command and the cooldown is `10s`, they have to wait 10 seconds before they can use it again. Console is never rate-limited.
{% endconfigentry %}

{% hint "warning" %}
`OPERATOR` gives the player temporary elevated access for that specific command. Only use it when the target command requires permissions the player doesn't normally have. If `CONSOLE` works, use `CONSOLE`.
{% endhint %}

---

## args

Every command can be configured to have optional or required arguments. Each argument becomes a `${name}` placeholder you can use in your command strings. Arguments are positional, so the first thing the player types after the command goes to the first argument, the second to the second, and so on.

{% configentry "name", "string", "" %}
The name used as `${name}` in command strings. Use something descriptive like `player` or `amount`, not `a` or `x`. Required.
{% endconfigentry %}

{% configentry "required", "boolean", "true | false" %}
Whether the player must provide this argument. If `true` and the player skips it, they get an error.
{% endconfigentry %}

{% configentry "type", "enum", "" %}
The argument type. Controls how the input is parsed and what tab completion the player sees. See [Argument Types](/docs/scripting/argument-types/) for all types.
{% endconfigentry %}

{% configentry "suggestions", "list", "" %}
Static tab completion suggestions. These are only hints for tab completion, the player can still type anything the argument type accepts. These suggestions are added to the existing ones and do not replace any existing suggestions, such as the `PLAYERS` suggestions.
{% endconfigentry %}

> Required arguments must come before optional ones. If you put an optional argument before a required one, validation will fail and the script won't load.

{% hint "warning" %}
`TEXT` and `GREEDY_STRING` must always be the last argument, because they consume everything remaining in the input. You can't put anything after them.
{% endhint %}

---

## commands

The actual commands to execute. Each entry runs in order when the script is triggered. This is where the action happens. This is a list where the following can be repeated, so multiple commands can be executed.

{% configentry "command", "string", "" %}
The command to run. Use `${argname}` in the command string for argument placeholders. No leading `/` needed.
{% endconfigentry %}

> The `command` entry is the only one required. Any field you don't set here is inherited from `defaults`. So if all your commands run as `CONSOLE` on the same backend, you define that once in `defaults` and never touch it in the individual command entries. Only override what needs to be different:

```yaml
defaults:
  run-as: CONSOLE
  execute:
    - id: "survival-1"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
  delay: 0s
  cooldown: 0s

commands:
  - command: "eco give ${player} 100"
  - command: "say ${player} got 100 coins"
  - command: "broadcast Welcome bonus applied!"
    execute:
      - id: "lobby-1"
        location: BACKEND
```

The first two commands inherit everything from `defaults` and run on `survival-1`. The third overrides `execute` to target `lobby-1` instead. Clean and simple.

---

## Duration format

Duration fields (`delay`, `cooldown`, `timeout`) accept human-readable values. You don't have to do math in your head to convert everything to seconds:

| Format | Meaning |
|--------|---------|
| `500ms` | 500 milliseconds |
| `0s`, `5s`, `30s` | seconds |
| `1m`, `5m` | minutes |
| `1h` | hours |
| `10` | 10 seconds (bare numbers default to seconds) |

> Parsing is case-insensitive, so `5S` and `5s` both work.
