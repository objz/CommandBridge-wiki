---
title: Backends
order: 2
description: "Configuration reference for CommandBridge on backend servers. Set up client ID, connection endpoint, TLS, authentication, and reconnect behavior."
---

This config can be found at every backend server at `plugins/commandbridge/config.yml`.

---

## Default config

```yaml
client-id: survival-1
endpoint-type: WEBSOCKET
endpoints:
  websocket:
    host: 127.0.0.1
    port: 8765
  redis:
    host: 127.0.0.1
    port: 6379
    username: ''
    password: ''
security:
  tls-mode: TOFU
  tls-pin: ''
  secret: change-me
timeouts:
  auth-timeout: 5
  reconnect-timeout: 60
  reconnect-interval: 5
debug: false
```

---

## Core

{% configentry "client-id", "string", "" %}
This id is used to identify this client. You are required to change it to a unique name for every backend server. I recommend using a name associated with the server, like `survival-1` if it is a survival server.
{% endconfigentry %}

{% configentry "endpoint-type", "enum", "WEBSOCKET | REDIS" %}
This works the same as on Velocity. Either connect using Redis or WebSocket; in this enum you can choose what you want.
{% endconfigentry %}

---

## WebSocket

{% configentry "host", "string", "" %}
The address the WebSocket server is running on. If you are using a local setup you can use `127.0.0.1`, but in most cases you are using a hosting provider or multiple servers, so then you need to enter the public IP address of the Velocity proxy.
{% endconfigentry %}

{% configentry "port", "integer", "" %}
Use the port you configured in the Velocity proxy CommandBridge config. This must match the `bind-port` value from Velocity.
{% endconfigentry %}

{% hint "warning" %}
Make sure this port is open as a `TCP` connection on the Velocity server. If it is not reachable, the backend will not be able to connect.
{% endhint %}

---

## Redis

Redis mode is a bit different because the backend just connects to Redis; it does not host it. The values here should point to your Redis server.

{% configentry "host", "string", "" %}
The IP address where the Redis server is running. If you are self-hosting and Redis runs locally, you can usually keep the default value. In most other cases (provider or Docker), you need to change the host. Hosting providers usually give you the IP directly, so you can copy that value.
{% endconfigentry %}

{% configentry "port", "integer", "" %}
The port Redis is listening on. You do not have to open anything on your router here, just enter the port Redis is running on.
{% endconfigentry %}

{% configentry "username", "string", "" %}
Redis usually requires authentication for a secure connection, so put your username here.
{% endconfigentry %}

{% configentry "password", "string", "" %}
The password for your Redis authentication. Used together with `username`.
{% endconfigentry %}

---

## Security

Authentication and TLS settings. These must match what you configured on the Velocity side. See [Security](/docs/configuration/security/) for a full explanation.

{% configentry "tls-mode", "enum", "PLAIN | TOFU | STRICT" %}
TLS encryption mode. This must match the proxy's TLS mode. `TOFU` is the default and should be used in most cases. See [Security](/docs/configuration/security/).
{% endconfigentry %}

{% configentry "tls-pin", "string", "" %}
TLS certificate pin. This is auto-populated in `TOFU` mode on the first connection. You do not need to touch this unless you are re-pinning after a certificate change.
{% endconfigentry %}

{% configentry "secret", "string", "" %}
Shared secret for authentication. Copy this from Velocity's `secret.key` file. On first startup, Velocity generates this file automatically.
{% endconfigentry %}

{% hint "danger" %}
Change the default `secret` value before going to production. Use the key from Velocity's `secret.key` file. Anyone with this key can connect to your proxy and execute commands.
{% endhint %}

---

## Timeouts

{% configentry "auth-timeout", "integer (seconds)", "" %}
Seconds to wait for the proxy to accept authentication. If this times out, the connection attempt is dropped.
{% endconfigentry %}

{% configentry "reconnect-timeout", "integer (seconds)", "" %}
Max time in seconds to keep trying to reconnect after a disconnect. After this, the backend stops trying.
{% endconfigentry %}

{% configentry "reconnect-interval", "integer (seconds)", "" %}
Seconds between reconnect attempts. If the connection drops, the backend waits this long before trying again.
{% endconfigentry %}

---

## Debug

{% configentry "debug", "boolean", "true | false" %}
Enables verbose logging. Useful for troubleshooting connection or script issues. Keep this off in production.
{% endconfigentry %}
