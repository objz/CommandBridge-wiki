---
title: Payloads
order: 6
description: "Define custom payload types for message channels. CommandPayload is the built-in type for command execution."
---

Payloads are the data you send over a channel. `CommandPayload` is the built-in type for dispatching commands on remote servers. For anything beyond command execution you define your own payload types.

---

## CommandPayload

`CommandPayload` is a record with three components:

```java
public record CommandPayload(String command, RunAs runAs, UUID player) implements ChannelPayload
```

| Component | Type | Description |
|---|---|---|
| `command` | `String` | The command to run, without a leading `/`. |
| `runAs` | `RunAs` | How the command runs on the target server. |
| `player` | `UUID` | The player to run it as. `null` for `CONSOLE`. |

`RunAs` controls execution context:

| Value | Runs as | Player required |
|---|---|---|
| `CONSOLE` | Server console with full permissions | No |
| `PLAYER` | The specified player with their own permissions | Yes |
| `OPERATOR` | The specified player with temporary op-level permissions | Yes |

`OPERATOR` grants op status for that one command only and revokes it immediately after. Use `CONSOLE` when no player context is needed.

{% hint "info" %}
`OPERATOR` no longer grants wildcard `*` permission. It grants only the explicit permissions the backend platform's op system provides.
{% endhint %}

There is a two-arg constructor for the console case:

```java
new CommandPayload("say hello", RunAs.CONSOLE)
new CommandPayload("home", RunAs.PLAYER, playerUUID)
new CommandPayload("gamemode creative", RunAs.OPERATOR, playerUUID)
```

---

## Custom payload types

`ChannelPayload` is a marker interface. Any class that implements it can be sent over a channel. Java records are the recommended approach because Jackson serializes them automatically without any configuration.

```java
import dev.objz.commandbridge.api.channel.ChannelPayload;

public record PlayerDataPayload(UUID playerId, String displayName, int level) implements ChannelPayload {
}

public record ServerStatusPayload(String serverId, int playerCount, boolean accepting) implements ChannelPayload {
}
```

Use custom payloads exactly like `CommandPayload`:

```java
import dev.objz.commandbridge.api.channel.MessageChannel;
import dev.objz.commandbridge.api.message.Subscription;
import static dev.objz.commandbridge.api.platform.Platform.backend;

MessageChannel<ServerStatusPayload> channel = api.channel(ServerStatusPayload.class);

channel.to(List.of(backend("lobby-1")))
       .send(new ServerStatusPayload("survival-1", 47, true));

Subscription sub = channel.listen((ctx, payload) -> {
    String serverId = payload.serverId();
    int count = payload.playerCount();
    boolean accepting = payload.accepting();
});
```

### Channel routing

Channels are keyed by the payload type's fully-qualified class name (`Class.getName()`). Both the sending and receiving side must use the same class with the same fully-qualified name. If a message arrives for a type not registered on the receiving side, it is silently dropped.

This means shared payload types need to be on the classpath of every server that participates in that channel. The standard approach is a shared module or jar that all involved plugins depend on.

---

## Serialization

Payloads are serialized to JSON using Jackson, configured with `Jdk8Module` (for `Optional<T>`), `JavaTimeModule` (for `java.time.*`), and `findAndRegisterModules()` to auto-discover additional modules.

Supported field types: primitives, `String`, `UUID`, `Optional<T>`, `java.time.*` types (`Instant`, `Duration`, `LocalDate`, `LocalDateTime`, etc.), and collections (`List<T>`, `Set<T>`, `Map<K, V>`).

```java
import dev.objz.commandbridge.api.channel.ChannelPayload;

public record EventPayload(
    UUID playerId,
    String event,
    Instant occurredAt,
    Optional<String> metadata
) implements ChannelPayload {}
```

Records do not need `@JsonProperty` annotations. Jackson maps record components by name automatically.

If Jackson cannot serialize a field, the message is dropped and a warning is logged on the sending side. If Jackson cannot deserialize incoming data into the expected type, the message is dropped with a warning on the receiving side. No exception is thrown to your listener in either case.

{% hint "warning" %}
Custom payload classes must exist on the classpath of both the sending and receiving server with the same fully-qualified class name. If the names differ, messages are silently dropped.
{% endhint %}
