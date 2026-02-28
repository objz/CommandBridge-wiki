---
title: Velocity
order: 1
---

This config can be found at `plugins/commandbridge/config.yml`.

---

## Default configuration

```yaml
act-as-client: false
server-id: proxy-1
endpoint-type: WEBSOCKET
endpoints:
  websocket:
    bind-host: 0.0.0.0
    bind-port: 8765
  redis:
    host: 127.0.0.1
    port: 6379
    username: ''
    password: ''
security:
  tls-mode: TOFU
  keystore-path: ''
  keystore-password: ''
  keystore-type: PKCS12
timeouts:
  register-timeout: 5
  ping-timeout: 5
debug: false
```

---

## Core

{% configentry "act-as-client", "boolean", "true | false" %}
When enabled, everything below is ignored and the config from `client.yml` is loaded instead. This is used in multi-proxy setups. See [Multi proxy](/docs/configuration/multi-proxy/) for details.
{% endconfigentry %}

{% configentry "server-id", "string", "" %}
A unique ID that CB uses to identify this proxy. Keep the default if you are not using a multi-proxy setup. If you are, every proxy needs its own unique name.
{% endconfigentry %}

{% configentry "endpoint-type", "enum", "WEBSOCKET | REDIS" %}
Determines the backend communication type CB uses.
{% endconfigentry %}

---

## WebSocket

In WebSocket mode, Velocity hosts the server itself, so these values are named around that behavior.

{% configentry "bind-host", "string", "" %}
The address the WebSocket server binds to. Usually this should stay at `0.0.0.0` because it covers all network interfaces. Only change this if you know exactly what you are doing.
{% endconfigentry %}

{% configentry "bind-port", "integer", "" %}
The port CB listens on. Must be free and not used by any other process. When self-hosting, you can normally leave the default. On hosted setups, providers often give you a random port; if so, enter that port here. Remember this port, because it is where CB listens and your backends need to connect to it.
{% endconfigentry %}

{% hint "warning" %}
You need to open this port as a `TCP` connection in your firewall so it is reachable from the internet. On some setups, this is done in your router. If the port is not open, backends will not be able to connect.
{% endhint %}

---

## Redis

Redis mode is a bit different because Velocity just connects to Redis; it does not host it.

{% configentry "host", "string", "" %}
The IP address where the Redis server is running. If you are self-hosting and Redis runs locally, you can usually keep the default value. In most other cases (provider or Docker), you need to change this. If Redis runs on the same machine, use a local IP address. If not, use the public IP your hosting provider gives you.
{% endconfigentry %}

{% configentry "port", "integer", "" %}
The port Redis is listening on. You do not need to open anything on your router since you are not hosting a server here.
{% endconfigentry %}

{% configentry "username", "string", "" %}
Redis usually requires authentication for a secure connection. Enter your Redis username here.
{% endconfigentry %}

{% configentry "password", "string", "" %}
The password for your Redis authentication. Used together with `username`.
{% endconfigentry %}

---

## Security

Authentication and TLS settings. See [Security](/docs/configuration/security/) for details.

{% configentry "tls-mode", "enum", "PLAIN | TOFU | STRICT" %}
TLS encryption mode. See [Security](/docs/configuration/security/). `TOFU` is the default and should be used in most cases.
{% endconfigentry %}

{% hint "info" %}
`TOFU` gives you encryption with zero manual certificate management. Only change this if you know what you are doing.
{% endhint %}

{% configentry "keystore-path", "string", "" %}
Path to a PKCS12 or JKS keystore. Only used with `STRICT` mode. This loads the keystore from a custom path so you can use your own certificates.
{% endconfigentry %}

{% configentry "keystore-password", "string", "" %}
The password for your custom keystore. Only relevant when using `STRICT` mode with a custom `keystore-path`.
{% endconfigentry %}

{% configentry "keystore-type", "enum", "PKCS12 | JKS" %}
Keystore format. Only affects `STRICT` mode.
{% endconfigentry %}

---

## Timeouts

{% configentry "register-timeout", "integer (seconds)", "" %}
Seconds to wait for a backend to confirm command registration. If this times out, the connection is closed.
{% endconfigentry %}

{% configentry "ping-timeout", "integer (seconds)", "" %}
Seconds to wait for a ping response before timing out and printing an error.
{% endconfigentry %}

---
## Debug

{% configentry "debug", "boolean", "true | false" %}
Enables verbose logging. Useful for troubleshooting connection or script issues. Keep this off in production.
{% endconfigentry %}
