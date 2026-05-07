---
title: Delivery conditions
order: 5
description: "Gate message delivery on player presence with requirePlayer() and whenOnline()."
---

Delivery conditions let you gate a message on whether a specific player is present on the target server. Chain them on the sender before calling `send()`.

The easiest way to explain it is with an example:

```java
import dev.objz.commandbridge.api.channel.command.CommandPayload;
import dev.objz.commandbridge.api.channel.command.RunAs;
import static dev.objz.commandbridge.api.platform.Platform.backend;

channel.to(List.of(backend("survival-1")))
       .requirePlayer(playerUUID)
       .send(new CommandPayload("home", RunAs.PLAYER, playerUUID));
```

First, we build a sender targeting `survival-1`.

Then, we call `requirePlayer(playerUUID)`. This adds a condition: only deliver the message if `playerUUID` is currently on `survival-1`. If the player is not there at dispatch time, the message is silently dropped.

Finally, we call `send()` with the payload.

---

## requirePlayer

`requirePlayer(UUID)` checks whether the specified player is on the target server at dispatch time.

If the player is not on the server, the behavior depends on how you send:

With `send()`, the message is dropped silently. The future completes normally with `null`.

With `request()`, the future completes exceptionally with `IllegalStateException("Player not on target server: {id}")`.

---

## whenOnline

`whenOnline(UUID)` queues the message if the player is not currently on the target server. The message is held and delivered automatically when that player next connects to the target.

```java
channel.to(List.of(backend("survival-1")))
       .whenOnline(playerUUID)
       .send(new CommandPayload("give " + playerUUID + " diamond 1", RunAs.CONSOLE));
```

The queue lives in memory on the Velocity proxy and is not persisted to disk. If the proxy restarts, queued messages are lost.

If you need delivery to survive a proxy restart, use the scripting system's [`schedule-online`](/docs/scripting/syntax/) instead. That saves tasks to disk and has no TTL. The API queue is intentionally lightweight and in-memory. There is no persistent equivalent for custom payload types since the scripting system only supports command execution.

Each queued message has a 5-minute TTL, but this is not a background timer. The TTL is checked when the player joins the target server. If they join within 5 minutes of the message being queued, it is delivered. If they join after that, the message is discarded at that point.

The total number of queued messages across all players and all target servers is capped at 1000. If the cap is reached, new messages are dropped with a warning logged.

If the target server disconnects before the player joins, all messages queued for that server are removed.

{% hint "warning" %}
`whenOnline` is not supported with `request()`. It throws `UnsupportedOperationException`.
{% endhint %}

---

## No-arg variants

Both conditions have no-arg overloads that extract the player UUID from the payload automatically:

```java
channel.to(List.of(backend("survival-1")))
       .requirePlayer()
       .send(new CommandPayload("home", RunAs.PLAYER, playerUUID));

channel.to(List.of(backend("survival-1")))
       .whenOnline()
       .send(new CommandPayload("teleport ...", RunAs.CONSOLE, playerUUID));
```

These only work with `CommandPayload`. The implementation calls `.player()` on the payload. If the payload is not a `CommandPayload`, or its `player` component is `null`, an `IllegalStateException` is thrown at dispatch time.

---

## Constraints

| Situation | Result |
|---|---|
| `requirePlayer` + player absent + `send()` | message dropped, future completes with `null` |
| `requirePlayer` + player absent + `request()` | `IllegalStateException` |
| `whenOnline` + player absent + `send()`                     | queued (in-memory, lazy 5-min TTL, 1000 global cap) |
| `whenOnline` + `request()` | `UnsupportedOperationException` |
| `requirePlayer` + `whenOnline` combined | `IllegalStateException` |
| `requirePlayer` or `whenOnline` on broadcast sender | `UnsupportedOperationException` |
| No-arg variant with non-`CommandPayload` | `IllegalStateException` |
| No-arg variant with `CommandPayload` where `player` is `null` | `IllegalStateException` |

---

## Delivery condition methods

```java
Sender<P> requirePlayer(UUID player)
Sender<P> requirePlayer()
```

Gates delivery on the player being present on the target server at dispatch time. The no-arg overload uses `CommandPayload.player()`.

```java
Sender<P> whenOnline(UUID player)
Sender<P> whenOnline()
```

Queues the message until the player connects to the target server. The no-arg overload uses `CommandPayload.player()`. Not supported with `request()` or on broadcast senders.
