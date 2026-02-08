---
title: Velocity
order: 1
---

Velocity proxy `config.yml` reference. Located at `plugins/commandbridge/config.yml`.

---

## Default config

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

### `act-as-client`

When `true`, this Velocity instance connects to another proxy as a client instead of running as a server. Default `false`.

---

### `bind-host`

IP address to bind the WebSocket server to.

- `0.0.0.0` for all interfaces
- `127.0.0.1` for localhost only

---

### `bind-port`

Port for the WebSocket server. Must be open in your firewall if backends are on other machines. Default `8765`.

---

### `server-id`

Unique name for this proxy. Used in script `register` and `execute` blocks.

---

### `debug`

Enables verbose logging. Default `false`.

---

## heartbeat

Controls the keep-alive between proxy and clients.

### `app-ping-seconds`

How often (in seconds) to send a ping to each connected client. Default `10`.

---

### `stale-after-seconds`

Disconnect a client if no pong is received within this many seconds. Default `60`.

---

## security

Auth and TLS settings. See [Security](/docs/security/) for details on TLS modes.

### `require-auth`

Require clients to authenticate with the shared secret. Default `true`.

---

### `auth-timeout-seconds`

Seconds to wait for a client to authenticate before disconnecting. Default `10`.

---

### `tls-mode`

`PLAIN`, `TOFU`, or `STRICT`. See [Security](/docs/security/).

---

### `keystore-path`

Path to a PKCS12 or JKS keystore. Only used with `STRICT` mode.

---

### `keystore-password`

Password for the keystore.

---

### `keystore-type`

Keystore format. `PKCS12` or `JKS`.

---

## timeouts

### `register-timeout`

Seconds to wait for a backend to confirm command registration. Default `5`.

---

### `ping-timeout`

Seconds to wait for a ping response. Default `5`.

---

## limits

### `inbound-messages-per-sec`

Max inbound WebSocket messages per second per client. Default `60`.

---

### `max-connections`

Max simultaneous client connections. Default `100`.

---

### `max-message-size-bytes`

Max size of a single WebSocket message in bytes. Default `65536` (64 KB).
