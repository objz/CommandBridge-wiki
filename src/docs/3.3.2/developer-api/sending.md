---
title: Sending
order: 3
description: "Send messages to remote servers with send() for fire-and-forget dispatch, or request() for request-response."
---

Sending messages is done through a `Sender` you get from `channel.to()` or `channel.toAll()`. There are two ways to send: fire-and-forget with `send()`, or request-response with `request()`.

The easiest way to explain it is with an example:

```java
MessageChannel<CommandPayload> channel = api.channel(CommandPayload.class);

channel.to(List.of(backend("survival-1")))
       .send(new CommandPayload("say hello", RunAs.CONSOLE));
```

First, we get a sender by calling `channel.to()` with a list containing one target, `backend("survival-1")`.

Then, we call `send()` with a `CommandPayload`. This dispatches the message and returns a `CompletableFuture<Void>` that resolves when the message has been sent over the network. The remote server processes the command independently.

That's it for a basic send. The sections below cover `send()` in detail, the `request()` method, and how messages are relayed.

---

## send()

`send()` dispatches the payload to all targets and returns a `CompletableFuture<Void>`. The future resolves when the message has been dispatched, not when the remote has processed it.

```java
channel.to(List.of(backend("survival-1"), backend("creative-1")))
       .send(new CommandPayload("say hello", RunAs.CONSOLE));

channel.toAll()
       .send(new CommandPayload("broadcast restart in 5 minutes", RunAs.CONSOLE));
```

If a target is not connected at dispatch time, `send()` returns a failed future with `IllegalStateException`.

---

## request()

`request()` sends to a single server and waits for the remote to send back a response payload. It returns a `CompletableFuture<P>` that resolves with the response.

```java
channel.to(List.of(backend("survival-1")))
       .request(new CommandPayload("ping", RunAs.CONSOLE))
       .thenAccept(response -> {
           getLogger().info("Got response: " + response.command());
       });
```

The default timeout is 15 seconds. Pass a `Duration` to use a different one:

```java
channel.to(List.of(backend("survival-1")))
       .request(new CommandPayload("ping", RunAs.CONSOLE), Duration.ofSeconds(3))
       .thenAccept(response -> getLogger().info(response.command()));
```

If the remote does not respond within the timeout, the future completes exceptionally.

`request()` is only supported on single-target senders. Calling it on a multi-target sender or a broadcast sender throws `UnsupportedOperationException`. `whenOnline` is also not compatible with `request()`, see [Delivery conditions](/docs/developer-api/delivery-conditions/) for details.

---

## Relay

Velocity acts as the hub for all channel messages. When a backend sends a message to another backend, it does not communicate directly. The message goes to Velocity first, which relays it to the target. The `MessageContext.from()` in the receiving listener reflects the original sender, not the proxy.

{% hint "info" %}
If the proxy is not reachable or the target backend is not connected to it, messages cannot be delivered.
{% endhint %}

---

## Sender methods

```java
CompletableFuture<Void> send(P payload)
```

Dispatches the payload to all targets. Returns a `CompletableFuture<Void>` that resolves when the message has been sent. Returns a failed future if a target is not connected.

```java
CompletableFuture<P> request(P payload)
CompletableFuture<P> request(P payload, Duration timeout)
```

Sends to a single target and waits for a response payload. Only supported on single-target senders. Default timeout is 15 seconds.
