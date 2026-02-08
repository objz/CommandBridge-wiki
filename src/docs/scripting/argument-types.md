---
title: Argument Types
order: 2
---

CommandBridge supports 21 argument types. Each type controls what the player can input and what tab-completion suggestions they see.

### Platform availability

Some types are only available on specific platforms. Using a backend-only type in a command registered on Velocity will fail validation.

---

## Universal types

Available on both Velocity and backends.

| Type | Description | Example input |
|------|-------------|---------------|
| `STRING` | A single word (no spaces). | `hello` |
| `INTEGER` | A whole number. | `42` |
| `BOOLEAN` | `true` or `false`. | `true` |
| `DOUBLE` | A decimal number. | `3.14` |
| `TEXT` | A single quoted or unquoted token. | `"hello world"` |
| `GREEDY_STRING` | Everything after this argument, including spaces. Must be the last argument. | `this is a long message` |

---

## Minecraft types (backend only)

These use CommandAPI's argument system and provide rich tab-completion on backend servers.

### Entity and player

| Type | Description | Example input |
|------|-------------|---------------|
| `PLAYERS` | One or more players. Supports entity selectors (`@a`, `@p`, `@r`). | `Steve`, `@a` |
| `ENTITIES` | One or more entities. Supports entity selectors. | `@e[type=zombie]` |
| `ENTITY_TYPE` | An entity type. | `zombie`, `creeper` |

### World and location

| Type | Description | Example input |
|------|-------------|---------------|
| `WORLD` | A loaded world name. | `world`, `world_nether` |
| `LOCATION` | A 3D location (x y z). Supports relative coords. | `100 64 -200`, `~ ~1 ~` |
| `LOCATION_2D` | A 2D location (x z). | `100 -200` |
| `ANGLE` | A rotation angle. | `90`, `~45` |
| `ROTATION` | A full rotation (yaw pitch). | `90 0` |

### Item and effect

| Type | Description | Example input |
|------|-------------|---------------|
| `ITEM_STACK` | An item. | `diamond_sword`, `stone` |
| `ENCHANTMENT` | An enchantment. | `sharpness`, `protection` |
| `POTION_EFFECT` | A potion effect type. | `speed`, `regeneration` |
| `SOUND` | A sound identifier. | `entity.experience_orb.pickup` |
| `BIOME` | A biome identifier. | `plains`, `desert` |

### Numeric

| Type | Description | Example input |
|------|-------------|---------------|
| `RANGE` | A numeric range (uses CommandAPI's DoubleRangeArgument). | `1..10`, `5..` |

---

## Velocity-only types

| Type | Description | Example input |
|------|-------------|---------------|
| `SERVER` | A Velocity server name from the proxy config. Tab-completes server names. | `lobby`, `survival` |

---

## Conditional types

| Type | Default platform | Optional on | Requires |
|------|-----------------|-------------|----------|
| `TIME` | Backend | Velocity | [PacketEvents](https://modrinth.com/plugin/packetevents) on Velocity |

`TIME` accepts time values (ticks or duration). It works on backends by default. On Velocity, it requires PacketEvents to be installed.

---

## Placeholder resolution

When a command is executed, argument values are serialized to strings for the `${name}` placeholder:

| Type | Serialization |
|------|--------------|
| `PLAYERS`, `ENTITIES` | Space-separated names |
| `LOCATION` | `x y z` |
| `LOCATION_2D` | `x z` |
| Collections | Space-separated values |
| `null` / missing optional | Empty string |
| Everything else | `.toString()` |

---

## Example usage

```yaml
args:
  - name: target
    required: true
    type: PLAYERS

  - name: amount
    required: true
    type: INTEGER

  - name: reason
    required: false
    type: GREEDY_STRING

commands:
  - command: "eco give ${target} ${amount}"
```
