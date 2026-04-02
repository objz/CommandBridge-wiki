---
title: Events
order: 7
description: "Subscribe to server connect and disconnect events, track connection state, and look up player locations from the proxy."
---

The API exposes events for server lifecycle, connection state changes, and player tracking. Some of this is proxy-only. Each section notes which platforms support it.

---

## Server lifecycle events

**Proxy-only.** Both methods return `Optional.empty()` on backends.

`onServerConnected` fires when a backend completes authentication. `onServerDisconnected` fires when a session is removed, either from a clean disconnect or a lost connection.

```java
import dev.objz.commandbridge.api.message.Subscription;
import dev.objz.commandbridge.api.platform.Platform;

private final List<Subscription> subs = new ArrayList<>();

@Subscribe
public void onProxyInitialize(ProxyInitializeEvent event) {
    api.onServerConnected(server -> {
        String id = server.id();
        Platform type = server.type();
    }).ifPresent(subs::add);

    api.onServerDisconnected(server -> {
        String id = server.id();
    }).ifPresent(subs::add);
}

@Subscribe
public void onProxyShutdown(ProxyShutdownEvent event) {
    subs.forEach(Subscription::cancel);
    subs.clear();
}
```

The `ServerTarget` passed to each listener has `.id()` (the server's configured identifier) and `.type()` (`Platform.BACKEND` or `Platform.VELOCITY`).

`.ifPresent(subs::add)` works on both platforms without any platform checks. On Velocity you get a `Subscription`, on backends you get an empty `Optional` and nothing happens. These methods are proxy-only, so in practice they only register on Velocity. `List<Subscription>` is used here because two listeners are registered together and need to be canceled as a pair.

---

## Connection state

`onConnectionStateChanged` is available on all platforms. The listener is called on every state transition.

{% tabs %}
{% tab "Velocity" %}
```java
import dev.objz.commandbridge.api.message.Subscription;
import dev.objz.commandbridge.api.platform.ConnectionState;

private Subscription connectionListener;

@Subscribe
public void onProxyInitialize(ProxyInitializeEvent event) {
    connectionListener = api.onConnectionStateChanged(state -> {
        boolean active = state.isActive();
        ConnectionState current = state;
    });
}

@Subscribe
public void onProxyShutdown(ProxyShutdownEvent event) {
    connectionListener.cancel();
}
```
{% endtab %}
{% tab "Paper / Bukkit" %}
```java
import dev.objz.commandbridge.api.message.Subscription;
import dev.objz.commandbridge.api.platform.ConnectionState;

private Subscription connectionListener;

@Override
public void onEnable() {
    connectionListener = api.onConnectionStateChanged(state -> {
        boolean active = state.isActive();
        ConnectionState current = state;
    });
}

@Override
public void onDisable() {
    connectionListener.cancel();
}
```
{% endtab %}
{% endtabs %}

You can also query the current state directly at any time:

```java
ConnectionState state = api.connectionState();
boolean ready = state.isActive();
```

`isActive()` returns `true` only when the state is `AUTHENTICATED`.

**ConnectionState values:**

| State | Meaning |
|---|---|
| `DISCONNECTED` | No connection. Initial state. |
| `CONNECTING` | Socket is being established. |
| `CONNECTED` | Socket is open, authentication not yet complete. Messages cannot be sent. |
| `AUTHENTICATED` | Fully connected. `isActive()` returns `true`. |
| `RECONNECTING` | Connection dropped unexpectedly. Reconnect in progress. |
| `AUTH_FAILED` | Authentication failed. No further attempts will be made. |

**Platform differences:**

On Velocity, `connectionState()` always returns `AUTHENTICATED`. `onConnectionStateChanged` fires immediately with `AUTHENTICATED` and returns a no-op `Subscription`. Canceling it does nothing.

On backends, the state reflects the actual client connection to the proxy. When you call `onConnectionStateChanged`, a background daemon thread starts polling every 500ms. Listeners are called on transitions.

{% hint "info" %}
If you see `AUTH_FAILED` on a backend, check that `secret` in the backend's `config.yml` matches the `secret.key` file on Velocity.
{% endhint %}

---

## Player locator

**Proxy-only.** Returns `Optional.empty()` on backends.

`playerLocator()` returns a service for finding which server a player is currently on.

```java
api.playerLocator().ifPresent(locator -> {
    Optional<Platform.ServerTarget> location = locator.locate(playerUUID);
    // location.isPresent() — player is tracked
    // location.get().id() — server identifier
});
```

`locate(UUID)` returns empty if the player is offline or not tracked by any authenticated session.

---

## Connected servers

**Proxy-only.** Returns `Optional.empty()` on backends.

`connectedServers()` returns a snapshot of all server IDs that are currently connected and authenticated:

```java
api.connectedServers().ifPresent(servers -> {
    // servers — Set<String> of authenticated server IDs
});
```

This is a point-in-time snapshot. Use `onServerConnected` and `onServerDisconnected` to track changes in real time instead.

---

## Server identity

Available on all platforms. `api.server()` returns a `ServerTarget` with the current server's own configured ID and platform type:

```java
Platform.ServerTarget me = api.server();
String id = me.id();
Platform type = me.type();
```

On Velocity, `server()` returns `Platform.VELOCITY.target(serverId)` where `serverId` is the `server-id` from `config.yml`. On backends, it returns `Platform.BACKEND.target(clientId)` where `clientId` is the `client-id` from `config.yml`.

---

## Event methods

```java
Optional<Subscription> onServerConnected(ServerEventListener listener)
Optional<Subscription> onServerDisconnected(ServerEventListener listener)
```

Register a listener for server connect and disconnect events. Proxy-only. Returns `Optional.empty()` on backends.

```java
Subscription onConnectionStateChanged(Consumer<ConnectionState> listener)
```

Register a listener for connection state transitions. Available on all platforms.

```java
ConnectionState connectionState()
```

Returns the current connection state. Always `AUTHENTICATED` on Velocity. Reflects the actual connection state on backends.

```java
Optional<PlayerLocator> playerLocator()
```

Returns a player location service. Proxy-only. Returns `Optional.empty()` on backends.

```java
Optional<Set<String>> connectedServers()
```

Returns a snapshot of connected and authenticated server IDs. Proxy-only. Returns `Optional.empty()` on backends.

```java
Platform.ServerTarget server()
```

Returns the current server's own identity. Available on all platforms.
