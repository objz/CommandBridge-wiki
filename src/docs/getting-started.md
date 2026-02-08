---
title: Getting Started
order: 4
---

This guide walks you through connecting Velocity and your backend servers with CommandBridge.

**Terminology:**

- **Server** = your Velocity proxy
- **Clients** = your backend servers (Paper, Folia, etc.)

---

### Step 1: Install the plugin

1. Download the JAR from [Modrinth](https://modrinth.com/plugin/commandbridge/versions)
2. Place it in `plugins/` on Velocity and each backend
3. Install [CommandAPI](https://commandapi.jorel.dev/) on each backend
4. Start Velocity, then start backends
5. Stop everything

This generates default configs on both sides.

---

### Step 2: Configure the Velocity proxy

Open `plugins/commandbridge/config.yml` on Velocity:

```yaml
bind-host: "0.0.0.0"
bind-port: 8765
server-id: "proxy-1"
```

- `bind-host` -- use `0.0.0.0` to listen on all interfaces, or `127.0.0.1` if everything runs on the same machine
- `bind-port` -- any free port. Must be open in your firewall if backends are on other machines.
- `server-id` -- a unique name for this proxy

---

### Step 3: Configure each backend

Open `plugins/commandbridge/config.yml` on each backend:

```yaml
host: "127.0.0.1"
port: 8765
client-id: "survival-1"
```

- `host` -- the IP or domain of your Velocity server
- `port` -- must match Velocity's `bind-port`
- `client-id` -- a unique name for this backend (e.g. `lobby`, `survival-1`, `minigames`)

---

### Step 4: Set up authentication

On first startup, Velocity generates a `secret.key` file. Copy the contents of this file into each backend's `config.yml`:

```yaml
security:
  secret: "paste-your-secret-here"
```

{% hint "danger" %}
Keep `secret.key` private. Anyone with this key can issue commands across your network.
{% endhint %}

---

### Step 5: Start your network

1. Start Velocity first
2. Then start each backend

Order matters -- the proxy must be listening before clients try to connect.

---

### Step 6: Verify the connection

On the Velocity console you should see:

```
[CommandBridge] Client authenticated successfully: /127.0.0.1:42918
[CommandBridge] Added connected client: survival-1
```

You can also run:

- `/cb list` -- shows connected clients
- `/cb ping survival-1` -- pings a specific client

If clients don't connect, check the [Troubleshooting](/docs/troubleshooting/) page.

---

### Step 7: Create your first script

Create a file at `plugins/commandbridge/scripts/hello.yml` on Velocity:

```yaml
version: 2
name: hello
description: Say hello on a backend server
enabled: true
aliases: []

permissions:
  enabled: false
  silent: false

register:
  - id: "proxy-1"
    location: VELOCITY

defaults:
  run-as: CONSOLE
  execute:
    - id: "survival-1"
      location: BACKEND
  server:
    target-required: false
    schedule-online: false
    timeout: 5s
  delay: 0s
  cooldown: 0s

args: []

commands:
  - command: "say Hello from the proxy!"
```

Run `/cb reload` to load the script, then type `/hello` on the proxy.

The backend server `survival-1` will execute `say Hello from the proxy!` in its console.

---

### Next steps

- [Scripting](/docs/scripting/) -- full guide to YAML scripts, arguments, and placeholders
- [Configuration](/docs/configuration/velocity/) -- all config options for both sides
- [Security](/docs/security/) -- TLS modes and authentication details
