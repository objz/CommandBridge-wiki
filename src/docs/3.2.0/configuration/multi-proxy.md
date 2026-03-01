---
title: Multi Proxy
order: 4
description: "Run CommandBridge across multiple Velocity proxies. Configure client-mode proxies that connect to a primary Velocity instance for command forwarding."
---

CB supports setups with more than one Velocity proxy. I already talked about this in the [Configuration](/docs/configuration/) overview, but here is the full picture.

The idea is simple: only one Velocity runs in server mode. Every other Velocity instance runs as a client. That is what the `act-as-client` value in the config is for.
The client-mode proxies connect to the main one and behave like any other backend: they authenticate, receive command registrations, and execute commands. The only difference is that CB internally marks them as `VELOCITY` instead of `BACKEND`, so it knows they are proxies and not actual game servers.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '18px', 'clusterBkg': 'transparent', 'clusterBorder': 'transparent', 'edgeLabelBackground': 'transparent'}, 'flowchart': {'padding': 20, 'nodeSpacing': 40, 'rankSpacing': 60}} }%%
flowchart TB
    subgraph primary ["Primary Velocity"]
        V["CommandBridge"]
    end

    subgraph clients ["Client-mode proxies"]
        V2["Velocity 2<br/>act-as-client: true"]
        V3["Velocity 3<br/>act-as-client: true"]
    end

    subgraph backends ["Backend servers"]
        B1["survival-1"]
        B2["creative-1"]
        B3["lobby-1"]
    end

    V2 -- "connects as client" --> V
    V3 -- "connects as client" --> V
    B1 -- "connects as client" --> V
    B2 -- "connects as client" --> V
    B3 -- "connects as client" --> V

    classDef primary fill:#1e3a5f,stroke:#3b82f6,color:#93c5fd
    classDef client fill:#3b1f5e,stroke:#a855f7,color:#d8b4fe
    classDef backend fill:#14532d,stroke:#22c55e,color:#86efac
    class V primary
    class V2,V3 client
    class B1,B2,B3 backend
```

So there is no mesh or anything fancy. One proxy manages everything, the rest just connect to it.

{% hint "warning" %}
Only **one** Velocity instance can run in server mode. If you start two proxies in server mode on the same Redis instance or the same WebSocket port, things will break.
{% endhint %}

---

## act-as-client

On every Velocity that should not be the main one, open `plugins/commandbridge/config.yml` and set:

```yaml
act-as-client: true
```

That is the only thing you change in `config.yml`. When this is enabled, CB ignores everything else in that file; endpoints, security, timeouts, all of it. Instead it reads the connection config from a separate file called `client.yml`.

---

## client.yml

When `act-as-client` is `true`, CB creates a `client.yml` in `plugins/commandbridge/` on first startup. This file looks exactly like a backend config, because that is basically what this proxy becomes:

```yaml
client-id: proxy-2
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

If you already configured a backend before, this should look familiar. It is the same schema as the [Backends](/docs/configuration/backends/) config.
The `client-id` is the unique name for this proxy, `endpoints` point to wherever the primary proxy is reachable, and `security` needs the same secret as everything else.
I will not explain every field again here since it is identical to the backend config.

{% hint "info" %}
The `config.yml` is still read on startup to check the `act-as-client` flag. But when it is `true`, everything else in `config.yml` is skipped and `client.yml` takes over completely.
{% endhint %}

---

## Registering & executing across proxies

In your scripts, you can target more than one instance for both registration and execution. So if you have three Velocity proxies, you can register a command on all of them:

```yaml
register:
  - id: "proxy-1"
    location: VELOCITY
  - id: "proxy-2"
    location: VELOCITY
  - id: "proxy-3"
    location: VELOCITY
```

You can mix proxies and backends too:

```yaml
register:
  - id: "proxy-1"
    location: VELOCITY
  - id: "survival-1"
    location: BACKEND
```

The `location` tells CB what type of target it is: `VELOCITY` for a proxy (primary or client-mode), `BACKEND` for a game server.

The `execute` section works the same way. You can send a command to client-mode proxies, backends, or both:

---

## Player presence tracking

CB tracks which players are on which server in real time. Every client, both backends and client-mode proxies, reports player changes to the primary. The primary stores all of this in a tracker that maps each client ID to a set of player UUIDs.

The initial sync on auth is a full snapshot so both sides start from the same state. After that, joins and leaves are sent individually. 

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '18px', 'clusterBkg': 'transparent', 'clusterBorder': 'transparent', 'edgeLabelBackground': 'transparent'}, 'flowchart': {'padding': 20, 'nodeSpacing': 40, 'rankSpacing': 60}} }%%
flowchart TB
    T{Type?}
    T -- "Auth" --> SNAP["Send PLAYER_LIST<br>(full snapshot)"]
    SNAP --> STORE["Store full set"]:::success
    T -- "Join" --> PJ["Send PLAYER_JOIN"]
    PJ --> ADD["Add UUID to set"]:::success
    T -- "Leave" --> DELAY["Wait 1 tick / 50ms"]
    DELAY --> PL["Send PLAYER_LEAVE"]
    PL --> REM["Remove UUID<br>from set"]:::success
    T -- "Disconnect" --> WIPE["Wipe client's<br>player set"]:::reject

    classDef success fill:#14532d,stroke:#22c55e,color:#86efac
    classDef reject fill:#7f1d1d,stroke:#ef4444,color:#fca5a5
```

> The delay on leave is there so the player is actually gone from the server's player list before the message is sent.

---

## target-required

The `target-required` setting controls whether a command should only execute on a target if the player is actually on that server. This is where the player tracking from above comes in.

```yaml
server:
  target-required: true
```

When this is enabled, CB checks the player tracker before dispatching to each target. If the player is not on that target, the command is skipped for it.

This works for both **BACKEND** and **VELOCITY** targets. Since every client, whether it is a Paper backend or a client-mode Velocity, sends its player data to the primary, CB has full visibility across the entire network. 
It does not matter which proxy the player originally connected through. If a backend reports that `uuid-123` is online, the primary knows about it.

For the primary Velocity itself there is a small shortcut: CB does not need to check the tracker because the primary already knows its own players directly. But for every remote target the tracker is used, regardless of whether it is a backend or another proxy.
So if you have `target-required: true` and the player is on `survival-1`, the command runs on `survival-1` and gets skipped on `creative-1`.
