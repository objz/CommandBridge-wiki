---
title: Scripting
order: 5
description: "Learn how CommandBridge scripts work. Define commands in YAML on the Velocity proxy and dispatch them across all connected backend servers."
---

Scripts are the core of CommandBridge. They are YAML files that define custom commands: what they are called, what arguments they take, who can use them, and what happens when someone runs them. You write them once, drop them on the Velocity proxy, and CB handles the rest.

All scripts live in one place:

```
plugins/commandbridge/scripts/
```

This folder only exists on the **Velocity proxy**. Backends do not have their own scripts folder. Velocity is the brain of the operation. It reads all scripts, validates them, registers commands on whichever targets you specified, and dispatches execution when someone actually uses them. You manage everything from one location.

{% hint "info" %}
Scripts are loaded on startup. Use `/cb reload` to reload them without restarting. If a script has errors, CB tells you exactly what is wrong and skips it. The other scripts still load fine.
{% endhint %}

---

### How it works

You create a `.yml` file in the scripts folder. In that file you define the command name, its arguments, where it should be registered, where it should execute, and the actual commands to run. That sounds like a lot, but most of the time you define your defaults once and then just list the commands.

On startup (or when you run `/cb reload`), CommandBridge reads all script files, validates them against a strict schema, and registers the commands on the targets you specified. If the target is a backend, CB pushes the registration over the network. If it is Velocity, it registers locally.

When a player or console actually runs the command, CB processes it through a pipeline. It resolves arguments, checks permissions, applies cooldowns, replaces placeholders, and then dispatches the final command to each target. If anything fails at any stage, the pipeline stops and nothing half-executed reaches the servers.

The pipeline is what makes CB reliable. You don't get partial execution. Either everything passes and the command runs, or it doesn't.

---

### Script format version

Every script starts with `version: 3`. This tells CB which schema to use for parsing. Version 1 and 2 are deprecated.

---

### Default script

CommandBridge ships with an example script that gets copied to the scripts folder on first startup. It is disabled by default, but it shows the basic structure of a script:

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
```

This registers `/example` on the Velocity proxy. When someone runs `/example Steve hello`, the command `msg Steve hello` is forwarded to the `client-1` backend and executed as console. To try it out, set `enabled` to `true` and change the `id` values to match your actual setup.
