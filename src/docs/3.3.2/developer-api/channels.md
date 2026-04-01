---
title: Channels
order: 2
description: "MessageChannel is the typed communication pipe for the CommandBridge network. Both sides of the connection need the same payload class."
---

Channels are how you send and receive messages across the CommandBridge network. Each channel is typed and routes messages based on the payload class you use to open it.

The easiest way to explain it is with an example:

```java
CommandBridgeAPI api = CommandBridgeProvider.get();
MessageChannel<CommandPayload> channel = api.channel(CommandPayload.class);

channel.to(List.of(backend("survival-1")))
       .send(new CommandPayload("say hello", RunAs.CONSOLE));
```

First, we call `api.channel(CommandPayload.class)` to get a typed channel. The class token is the routing key, so both the sending and receiving side must call `api.channel()` with the same class.

Then, we build a sender with `channel.to()`. We pass a list with one target, `backend("survival-1")`, which refers to the backend server configured with `client-id: survival-1`.

Finally, we call `send()` on the sender with a `CommandPayload`. The message is dispatched asynchronously. The returned `CompletableFuture<Void>` resolves when the message has been dispatched over the network.

---

## Channel routing

Channels are identified by the payload type's fully-qualified class name, determined by `Class.getName()`. A `MessageChannel<CommandPayload>` on Velocity and one on a backend refer to the same channel because `CommandPayload` resolves to `dev.objz.commandbridge.api.channel.command.CommandPayload` on both sides.

For custom payload types, both the sending and receiving server must have the class on the classpath with the same fully-qualified name. If a message arrives for a type that is not registered on the receiving side, it is silently dropped.

---

## Targeting

`Platform.backend(id)` and `Platform.velocity(id)` construct `ServerTarget` instances that identify which server to send to:

```java
import static dev.objz.commandbridge.api.platform.Platform.backend;
import static dev.objz.commandbridge.api.platform.Platform.velocity;

Platform.ServerTarget s1 = backend("survival-1");
Platform.ServerTarget px = velocity("proxy-1");
```

The `id` passed to `backend()` must match the `client-id` in that server's `config.yml`. The `id` passed to `velocity()` must match the `server-id` in the proxy's `config.yml`.

`velocity()` targets are only useful in multi-proxy setups where one Velocity instance connects as a client to another. In most setups you only need `backend()`.

If the target server is not connected at send time, `send()` returns a failed `CompletableFuture`.

---

## Sender types

The return type of `channel.to()` and `channel.toAll()` depends on how you call them. There are three sender types.

A **single-target sender** is returned when you pass exactly one target to `to()`:

```java
channel.to(List.of(backend("survival-1")))
```

It supports `send()`, `request()`, and delivery conditions (`requirePlayer`, `whenOnline`).

A **multi-target sender** is returned when you pass two or more targets to `to()`:

```java
channel.to(List.of(backend("survival-1"), backend("creative-1")))
```

It supports `send()` and delivery conditions. Calling `request()` on a multi-target sender throws `UnsupportedOperationException`.

A **broadcast sender** is returned by `toAll()`:

```java
channel.toAll()
```

It broadcasts to all currently connected and authenticated servers. The target set is resolved at dispatch time. Only `send()` is supported. Calling `request()` or any delivery condition throws `UnsupportedOperationException`.

---

## MessageChannel methods

```java
MessageChannel<P> api.channel(Class<P> type)
```

Gets the channel for the given payload type. Channels are cached per type, so repeated calls with the same class return the same instance.

```java
Sender<P> to(Collection<Platform.ServerTarget> targets)
```

Creates a sender targeting the given servers. Must have at least one entry. Returns a `SingleTargetSender` for one target and a `MultiTargetSender` for two or more.

```java
Sender<P> toAll()
```

Creates a broadcast sender targeting all connected and authenticated servers. The target set is resolved at the time `send()` is called, not when `toAll()` is called.

For registering listeners and managing subscriptions, see [Receiving](/docs/developer-api/receiving/).
