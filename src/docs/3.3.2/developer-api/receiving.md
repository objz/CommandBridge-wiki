---
title: Receiving
order: 4
description: "Subscribe to incoming messages on a channel with listen(). Inspect the source and timestamp via MessageContext."
---

To receive messages on a channel, register a `MessageListener` with `channel.listen()`. The listener is called for every incoming message on that channel.

The easiest way to explain it is with an example:

```java
MessageChannel<CommandPayload> channel = api.channel(CommandPayload.class);

Subscription sub = channel.listen((ctx, payload) -> {
    String from = ctx.from().id();
    String command = payload.command();
    getLogger().info(from + " sent: " + command);
});
```

First, we call `channel.listen()` with a lambda that takes a `MessageContext` and the payload. The context carries metadata about the message: which server sent it and when.

Then, we store the returned `Subscription`. We need it to unregister the listener during plugin shutdown.

The listener is invoked on the thread that processes the incoming network message. If you need to dispatch to a specific thread (Bukkit main thread, Folia region, Velocity event thread), schedule that explicitly inside the listener.

Multiple listeners can be registered on the same channel and all of them are called for each incoming message.

---

## MessageContext

`MessageContext<T>` is a record with three components:

| Component | Type | Description |
|---|---|---|
| `channel()` | `Class<T>` | The payload class token, identifying which channel the message arrived on |
| `from()` | `Platform.ServerTarget` | The server that sent the message |
| `timestamp()` | `long` | Unix epoch milliseconds when the message was sent |

`ctx.from()` returns a `ServerTarget` with `.id()` (the server's configured identifier) and `.type()` (`Platform.BACKEND` or `Platform.VELOCITY`).

{% hint "info" %}
On backends, `ctx.from().type()` is always `BACKEND`. On Velocity, the type is inferred from the session and can be `BACKEND` for connected backends or `VELOCITY` for other proxy instances in a multi-proxy setup.
{% endhint %}

---

## Canceling a subscription

`Subscription.cancel()` unregisters the listener. It is idempotent, so calling it more than once is safe.

{% tabs %}
{% tab "Velocity" %}
```java
private Subscription commandListener;

@Subscribe(order = PostOrder.LATE)
public void onProxyInitialize(ProxyInitializeEvent event) {
    commandListener = channel.listen((ctx, payload) -> {
        getLogger().info(ctx.from().id() + ": " + payload.command());
    });
}

@Subscribe
public void onProxyShutdown(ProxyShutdownEvent event) {
    commandListener.cancel();
}
```
{% endtab %}
{% tab "Paper / Bukkit" %}
```java
private Subscription commandListener;

@Override
public void onEnable() {
    commandListener = channel.listen((ctx, payload) -> {
        getLogger().info(ctx.from().id() + ": " + payload.command());
    });
}

@Override
public void onDisable() {
    commandListener.cancel();
}
```
{% endtab %}
{% endtabs %}

If you don't cancel subscriptions during shutdown, the listener reference stays in the channel's internal list and prevents garbage collection.

{% hint "warning" %}
Always cancel subscriptions during shutdown. Store every `Subscription` returned by `listen()` and cancel them all on disable.
{% endhint %}

---

## Receiving methods

```java
Subscription listen(MessageListener<P> listener)
```

Registers a listener for incoming messages on this channel. Returns a `Subscription`. Multiple listeners can be registered on the same channel and all are called for each incoming message.

```java
void cancel()
```

Unregisters the listener. Called on the `Subscription` returned by `listen()`. Idempotent.
