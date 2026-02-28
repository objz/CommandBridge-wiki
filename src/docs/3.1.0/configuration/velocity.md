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

### act-as-client

As already mentioned, the first entry is `act-as-client`. This is first for a reason: when it is enabled, everything below is ignored and the config from `client.yml` is loaded instead.
This value is explained in more detail in the [Multi proxy](/docs/multi-proxy) section.

### server-id

It is a unique ID that CB uses to identify proxies. You can keep the default if you are not using a multi-proxy setup. If you are, every proxy needs its own unique name.

### endpoint-type

>`WEBSOCKET` or `REDIS`

This changes the backend type CB uses. Either WebSocket or Redis.

---

## WebSocket

In WebSocket mode, Velocity hosts the server itself, so these values are named around that behavior.

### bind-host

This is the address it binds to. Usually, this should stay at `0.0.0.0` because it covers all network interfaces.
If you know exactly what you are doing, you can change it.

### bind-port

The bind port is the more important part in this section. This port must be free and not used by any other process.
You also need to configure your firewall to allow `TCP` connections through this port so it is reachable from the internet. On some setups, this is done in your router.
When self-hosting, you can normally leave the default port. On hosted setups, providers often give you a random one; if so, enter that port here.
Remember this port, because it is where CB listens.

---
## Redis

Redis mode is a bit different because Velocity just connects to Redis; it does not host it.

### host

If you are self-hosting, you may have Redis running locally. In that case, you can usually keep the default value.
In most other cases (provider or Docker), you need to change the host. The host is the IP address where the Redis server is running.
If Redis runs on the same machine as your servers, you can use local IP addresses. If not, use a public IP address.
Hosting providers usually give you the public IP directly, so you can copy that value.

### port

This time you do not have to open anything on your router, because you are not hosting a server here. Just enter the port Redis is listening on.

### username

Redis usually requires authentication for a secure connection, so put your username here.

### password

Where there is a username, there is usually also a password. Pretty self-explanatory, right?

---

## Security

Authentication and TLS settings. See [Security](/docs/security/) for details.

### tls-mode

`PLAIN`, `TOFU`, or `STRICT`. See [Security](/docs/security/). `TOFU` is the default and should be used in most cases.

### keystore-path

Path to a PKCS12 or JKS keystore. Only used with `STRICT` mode. This loads the keystore from a different path so you can use your own keystore.

### keystore-password

If you set up your own keystore, you need to enter its password here.

### keystore-type

Keystore format: `PKCS12` or `JKS`. As already mentioned, this only affects `STRICT` mode.

## Timeouts

### register-timeout

Seconds to wait for a backend to confirm command registration. If this times out, the connection is closed.

### ping-timeout

Seconds to wait for a ping response. After that, it times out and prints an error.
