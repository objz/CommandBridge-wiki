---
title: Payloads
order: 6
description: "CommandPayload and RunAs for command execution. Define custom payload types with ChannelPayload."
---

Payloads are the data you send over a channel. `CommandPayload` is the built-in type for executing commands on remote servers. You can also define your own payload types for arbitrary data.

The easiest way to explain it is with an example:

```java
MessageChannel<CommandPayload> channel = api.channel(CommandPayload.class);

channel.to(List.of(backend("survival-1")))
       .send(new CommandPayload("gamemode creative", RunAs.OPERATOR, playerUUID));
```

First, we get a channel typed to `CommandPayload`.

Then, we create a `CommandPayload` with three components: the command to run (`"gamemode creative"`), how to run it (`RunAs.OPERATOR`), and which player to run it as (`playerUUID`).

Finally, we send it. The backend will run `gamemode creative` as `playerUUID` with temporary op-level permissions.

---

## CommandPayload

`CommandPayload` is a record:

```java
public record CommandPayload(String command, RunAs runAs, UUID player) implements ChannelPayload
```

| Component | Type | Description |
|---|---|---|
| `command` | `String` | The command to run, without a leading `/`. |
| `runAs` | `RunAs` | How the command executes on the remote server. |
| `player` | `UUID` | The player to run it as. Use `null` for `CONSOLE`. |

There is a two-arg convenience constructor for the console case, where no player is needed:

```java
new CommandPayload("say hello", RunAs.CONSOLE)
new CommandPayload("home", RunAs.PLAYER, playerUUID)
new CommandPayload("gamemode creative", RunAs.OPERATOR, playerUUID)
```

---

## RunAs

`RunAs` controls who runs the command on the remote server:

| Value | Runs as | Player required |
|---|---|---|
| `CONSOLE` | Server console with full permissions | No |
| `PLAYER` | The specified player with their own permissions | Yes |
| `OPERATOR` | The specified player with temporary op-level permissions | Yes |

`OPERATOR` grants op status for the duration of that one command only. It is revoked immediately after. Only use it when the command needs elevated permissions that the player does not have.

{% hint "info" %}
`OPERATOR` no longer grants wildcard `*` permission. It grants only the explicit permissions the backend platform's op system provides.
{% endhint %}

---

## Custom payload types

Any class implementing `ChannelPayload` can be sent over a channel. Java records are the cleanest option:

```java
public record StatusPayload(String status, int playerCount) implements ChannelPayload {
}
```

Use it the same way as `CommandPayload`:

```java
MessageChannel<StatusPayload> statusChannel = api.channel(StatusPayload.class);

statusChannel.to(List.of(backend("survival-1")))
             .send(new StatusPayload("online", 42));

statusChannel.listen((ctx, payload) -> {
    int count = payload.playerCount();
});
```

---

## Serialization

Payloads are serialized to JSON using Jackson. The rules for custom types:

Records with primitive fields, `String`, `UUID`, and simple collections work without any configuration. If Jackson cannot serialize a field, the message is dropped and a warning is logged on the sending side. If Jackson cannot deserialize the incoming data, the message is dropped with a warning on the receiving side and no exception reaches your listener. Records do not need `@JsonProperty` annotations, Jackson maps record components automatically.

```java
public record MyPayload(String name, int count, boolean active) implements ChannelPayload {}

public record PlayerPayload(UUID uuid, String name) implements ChannelPayload {}

public record ComplexPayload(List<Map<String, Object>> data) implements ChannelPayload {}
```

The first two work reliably. The third may not round-trip correctly because complex nested types are not always handled well by the default Jackson configuration.

{% hint "warning" %}
Custom payload classes must exist on the classpath of both the sending and receiving server with the same fully-qualified class name. If the names differ, messages are silently dropped.
{% endhint %}

---

## CommandPayload methods

```java
new CommandPayload(String command, RunAs runAs)
```

Constructs a `CommandPayload` with `player` set to `null`. Use this for `CONSOLE` execution.

```java
new CommandPayload(String command, RunAs runAs, UUID player)
```

Constructs a `CommandPayload` with all three components. Required for `PLAYER` and `OPERATOR` execution.

```java
String command()
RunAs runAs()
UUID player()
```

Accessors for the record components.
