---
title: Argument Types
order: 2
description: "All supported argument types for CommandBridge scripts. Includes universal types like STRING and INTEGER, plus Minecraft-specific types for players, entities, and more."
---

CommandBridge supports many argument types. Each type controls how the input is parsed, what tab completion the player sees, and where the argument can be used. Not all types work everywhere, so pay attention to the platform column.

If you don't set a `type` for an argument, it defaults to `STRING`.

---

## Universal types

These work on both Velocity and backends. If you are not sure what to use, start here. They cover most use cases.

| Type | Description | Example input |
|------|-------------|---------------|
| `STRING` | A single word. No spaces allowed. This is the default. | `hello` |
| `OFFLINE_PLAYER` | A player name (online or cached offline). Useful when the target might not be online right now. | `Steve` |
| `INTEGER` | A whole number. Negative numbers work too. | `42`, `-5` |
| `BOOLEAN` | Either `true` or `false`. | `true` |
| `DOUBLE` | A decimal number. | `3.14` |
| `TEXT` | A single token, can be quoted to include spaces. Must be the last argument. | `"hello world"` |
| `GREEDY_STRING` | Everything after this point, including spaces. | `this is a long message` |

`STRING` is the safe default. `GREEDY_STRING` is what you want for messages or reasons where the input can be multiple words. You can also use `TEXT`, but you have to enclose your input into "...".

{% hint "info" %}
`TEXT` and `GREEDY_STRING` must always be the last argument in your `args` list. They consume the remaining input, so you can't put anything after them.
{% endhint %}

---

## Minecraft types

These use CommandAPI's argument system under the hood and give you rich tab completion with Minecraft-aware suggestions. 
Most of them only work on **backend servers** because they rely on Bukkit/Paper APIs that are not available on Velocity. Some also have specific implementations that only work with **PacketEvents**.


### Entity

| Type | Description | Example input |
|------|-------------|---------------|
| `ENTITIES` | One or more entities. Supports selectors with filters. | `@e[type=zombie]` |
| `ENTITY_TYPE` | An entity type from the registry. | `zombie`, `creeper` |

If your command targets entities, this is where you want to look.

### World and location

| Type | Description | Example input |
|------|-------------|---------------|
| `WORLD` | A loaded world name. | `world`, `world_nether` |
| `LOCATION` | A 3D position (x y z). Supports relative coordinates with `~`. | `100 64 -200`, `~ ~1 ~` |
| `LOCATION_2D` | A 2D position (x z). Same as `LOCATION` but without the Y coordinate. | `100 -200` |
| `ANGLE` | A rotation angle. Supports relative values. | `90`, `~45` |
| `ROTATION` | A full rotation (yaw pitch). | `90 0` |

### Item and effect

| Type | Description | Example input |
|------|-------------|---------------|
| `ITEM_STACK` | An item. | `diamond_sword`, `stone` |
| `ENCHANTMENT` | An enchantment type. | `sharpness`, `protection` |
| `POTION_EFFECT` | A potion effect type. | `speed`, `regeneration` |
| `SOUND` | A sound identifier. | `entity.experience_orb.pickup` |
| `BIOME` | A biome identifier. | `plains`, `desert` |

### Numeric

| Type | Description | Example input |
|------|-------------|---------------|
| `RANGE` | A numeric range. Uses CommandAPI's IntegerRange argument. Useful for commands that accept a range of values. | `1..10`, `5..` |

---

## Velocity-only types

| Type | Description | Example input |
|------|-------------|---------------|
| `SERVER` | A server name from the Velocity proxy config. Perfect for commands like `/send` where the player picks a server. | `lobby`, `survival` |

---

## Conditional types

| Type | Platforms | Condition |
|------|-----------|-----------|
| `PLAYERS` | Backend (always), Velocity (conditional) | Works on backends by default. On Velocity, requires [PacketEvents](https://modrinth.com/plugin/packetevents) to be installed. Without PacketEvents on Velocity, the type is not available there. |
| `TIME` | Backend (always), Velocity (conditional) | Works on backends by default. On Velocity, requires [PacketEvents](https://modrinth.com/plugin/packetevents) to be installed. Without PacketEvents on Velocity, the type is not available there. |

---

## Platform availability

This is important. If you use a backend-only type in a script that registers on Velocity, validation will fail and the script won't load. CB checks this at load time so you find out immediately instead of getting a confusing error at runtime.

| Type | Velocity | Backend |
|------|----------|---------|
| `STRING` | yes | yes |
| `INTEGER` | yes | yes |
| `BOOLEAN` | yes | yes |
| `DOUBLE` | yes | yes |
| `TEXT` | yes | yes |
| `GREEDY_STRING` | yes | yes |
| `OFFLINE_PLAYER` | yes | yes |
| `SERVER` | yes | no |
| `TIME` | with PacketEvents | yes |
| `PLAYERS` | with PacketEvents | yes |
| `RANGE` | no | yes |
| `ENTITIES` | no | yes |
| `ENTITY_TYPE` | no | yes |
| `WORLD` | no | yes |
| `LOCATION` | no | yes |
| `LOCATION_2D` | no | yes |
| `ANGLE` | no | yes |
| `ROTATION` | no | yes |
| `ITEM_STACK` | no | yes |
| `ENCHANTMENT` | no | yes |
| `POTION_EFFECT` | no | yes |
| `SOUND` | no | yes |
| `BIOME` | no | yes |


---

## Serialization

When a command is dispatched, argument values are converted to strings for the `${name}` placeholder. How that works depends on the type:

| Type | Serialized as |
|------|--------------|
| `PLAYERS`, `ENTITIES` | Space-separated player/entity names |
| `OFFLINE_PLAYER` | The provided player name |
| `LOCATION` | `x y z` |
| `LOCATION_2D` | `x z` |
| Any collection | Space-separated values |
| Missing optional argument | Empty string |
| Everything else | Standard `.toString()` |

In most cases you don't have to think about this. It just works. The only edge case is when you use `PLAYERS` with a selector like `@a` that matches multiple players. In that case, the placeholder resolves to all matching names separated by spaces. Your command needs to handle that.

---

## Custom suggestions

You can provide static tab completion suggestions for any argument using the `suggestions` field:

```yaml
args:
  - name: action
    required: true
    type: STRING
    suggestions:
      - start
      - stop
      - restart
```

Each suggestion value must match lowercase alphanumeric with `.`, `_`, `+`, `-`.

Suggestions are only hints for tab completion. The player can still type anything the argument type accepts. So even with suggestions, `STRING` will accept any word, not just the ones you listed.
