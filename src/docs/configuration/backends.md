---
title: Backends
order: 2
---

Backend server `config.yml` reference. Located at `plugins/commandbridge/config.yml`.

---

## Default config

```yaml
host: "127.0.0.1"
port: 8765
client-id: "survival-1"

security:
  tls-mode: TOFU
  tls-pin: ""
  secret: "change-me"
  require-auth: true

timeouts:
  auth-timeout: 5
  reconnect-timeout: 60
  reconnect-interval: 5

limits:
  inbound-messages-per-sec: 60

debug: false
```

---

## Top-level settings

### `host`

IP or domain of the Velocity proxy to connect to.

---

### `port`

Port of the Velocity proxy's WebSocket server. Must match Velocity's `bind-port`.

---

### `client-id`

Unique name for this backend. Used in script `register` and `execute` blocks. Must match what your scripts reference.

---

### `debug`

Enables verbose logging. Default `false`.

---

## security

### `tls-mode`

`PLAIN`, `TOFU`, or `STRICT`. Must match the proxy's TLS mode. See [Security](/docs/security/).

---

### `tls-pin`

TLS certificate pin. Auto-populated in `TOFU` mode on first connection.

---

### `secret`

Shared secret for authentication. Copy from Velocity's `secret.key` file.

---

### `require-auth`

Send authentication credentials when connecting. Should match the proxy's `require-auth` setting.

{% hint "danger" %}
Change the default `secret` value before going to production. Use the key from Velocity's `secret.key` file.
{% endhint %}

---

## timeouts

### `auth-timeout`

Seconds to wait for the proxy to accept authentication. Default `5`.

---

### `reconnect-timeout`

Max time in seconds to keep trying to reconnect after a disconnect. Default `60`.

---

### `reconnect-interval`

Seconds between reconnect attempts. Default `5`.

---

## limits

### `inbound-messages-per-sec`

Max inbound WebSocket messages per second from the proxy. Default `60`.
