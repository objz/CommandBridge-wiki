---
title: Backends
order: 2
---

Full reference for the backend server `config.yml`. Located at `plugins/commandbridge/config.yml`.

### Example config

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

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `host` | string | `127.0.0.1` | IP address or domain of the Velocity proxy to connect to. |
| `port` | int | `8765` | Port of the Velocity proxy's WebSocket server. Must match Velocity's `bind-port`. |
| `client-id` | string | `survival-1` | Unique identifier for this backend. Used in script `register` and `execute` blocks. Must match what your scripts reference. |
| `debug` | boolean | `false` | Enables verbose logging. |

---

## security

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tls-mode` | string | `TOFU` | TLS mode: `PLAIN`, `TOFU`, or `STRICT`. Must match the proxy's TLS mode. See [Security](/docs/security/). |
| `tls-pin` | string | `""` | TLS certificate pin. Auto-populated in `TOFU` mode on first connection. Used for certificate pinning. |
| `secret` | string | `change-me` | Shared secret for authentication. Copy from Velocity's `secret.key` file. |
| `require-auth` | boolean | `true` | Whether to send authentication credentials when connecting. Should match the proxy's `require-auth` setting. |

{% hint "danger" %}
Change the default `secret` value before going to production. Use the key from Velocity's `secret.key` file.
{% endhint %}

---

## timeouts

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auth-timeout` | int (seconds) | `5` | How long to wait for the proxy to accept authentication. |
| `reconnect-timeout` | int (seconds) | `60` | Maximum time to keep trying to reconnect after a disconnect. |
| `reconnect-interval` | int (seconds) | `5` | How often to retry the connection during reconnect. |

---

## limits

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `inbound-messages-per-sec` | int | `60` | Maximum inbound WebSocket messages per second from the proxy. |
