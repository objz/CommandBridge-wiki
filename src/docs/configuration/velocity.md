---
title: Velocity
order: 1
---

Full reference for the Velocity proxy `config.yml`. Located at `plugins/commandbridge/config.yml`.

### Example config

```yaml
act-as-client: false
bind-host: "0.0.0.0"
bind-port: 8765
server-id: "proxy-1"

heartbeat:
  app-ping-seconds: 10
  stale-after-seconds: 60

security:
  require-auth: true
  auth-timeout-seconds: 10
  tls-mode: TOFU
  keystore-path: ""
  keystore-password: ""
  keystore-type: PKCS12

timeouts:
  register-timeout: 5
  ping-timeout: 5

limits:
  inbound-messages-per-sec: 60
  max-connections: 100
  max-message-size-bytes: 65536

debug: false
```

---

## Top-level settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `act-as-client` | boolean | `false` | When `true`, this Velocity instance connects to another proxy as a client instead of running as a server. |
| `bind-host` | string | `0.0.0.0` | IP address to bind the WebSocket server to. Use `0.0.0.0` for all interfaces, `127.0.0.1` for localhost only. |
| `bind-port` | int | `8765` | Port for the WebSocket server. Must be open in your firewall if backends are on other machines. |
| `server-id` | string | `proxy-1` | Unique identifier for this proxy. Used in script `register` and `execute` blocks. |
| `debug` | boolean | `false` | Enables verbose logging. Useful for troubleshooting connection and command issues. |

---

## heartbeat

Controls the application-level keep-alive between proxy and clients.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `app-ping-seconds` | int | `10` | How often to send a ping to each connected client. |
| `stale-after-seconds` | int | `60` | Mark a client as stale and disconnect it if no pong is received within this time. |

---

## security

Authentication and TLS settings. See the [Security](/docs/security/) page for a detailed overview of TLS modes.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `require-auth` | boolean | `true` | Require clients to authenticate with the shared secret. |
| `auth-timeout-seconds` | int | `10` | How long to wait for a client to authenticate before disconnecting. |
| `tls-mode` | string | `TOFU` | TLS mode: `PLAIN`, `TOFU`, or `STRICT`. See [Security](/docs/security/). |
| `keystore-path` | string | `""` | Path to a PKCS12 or JKS keystore. Only used with `STRICT` mode. |
| `keystore-password` | string | `""` | Password for the keystore. |
| `keystore-type` | string | `PKCS12` | Keystore format: `PKCS12` or `JKS`. |

---

## timeouts

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `register-timeout` | int (seconds) | `5` | How long to wait for a backend to confirm command registration. |
| `ping-timeout` | int (seconds) | `5` | How long to wait for a ping response before considering it failed. |

---

## limits

Rate limiting and connection caps.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `inbound-messages-per-sec` | int | `60` | Maximum inbound WebSocket messages per second per client. |
| `max-connections` | int | `100` | Maximum number of simultaneous client connections. |
| `max-message-size-bytes` | int | `65536` | Maximum size of a single WebSocket message in bytes (64 KB default). |
