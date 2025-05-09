---
title: Getting Started
order: 4
---

In this documentation:

- **Server** → the **Velocity proxy**
- **Clients** → all connected **Paper servers**

***

### **File Structure Overview**

After installing and restarting your servers, CommandBridge will generate the following files:

#### On **each Paper server**:
```

plugins/CommandBridge/
├── config.yml             # Client configuration
└── scripts/
    └── example.yml        # Example script

```

#### On the **Velocity proxy**:
```

plugins/CommandBridge/
├── config.yml             # Server configuration
├── secret.key             # Shared authentication key (server only)
└── scripts/
    └── example.yml        # Example script

```

<div class="h-4"></div>

{% hint "danger" %}
The `secret.key` file is only created on the Velocity proxy. **Keep it private** — anyone with this key can issue commands across your network.
{% endhint %}

<div class="h-4"></div>

***

### **Step 1: Configure Authentication**

1. Open the `secret.key` file from the **Velocity server**.
2. Copy the key and paste it into each **Paper server’s** `config.yml`:

```yaml
secret: "PASTE_KEY_HERE"
```
<div class="h-4"></div>

---

### **Step 2: Set Server and Client IDs**

* On **each backend server**:
  Set a unique `client-id` in `config.yml`:

```yaml
client-id: "lobby"
```

* On the **Velocity proxy**:
  Set a `server-id` in `config.yml` (default is `"main"`):

```yaml
server-id: "main"
```
<div class="h-4"></div>

---

### **Step 3: Configure Velocity Network**

In the Velocity `config.yml`:

```yaml
host: "0.0.0.0"      # Use 127.0.0.1 if running locally
port: 3000           # Choose any free port
san: "your.server.ip"  # Must match client-side remote host
```
<div class="h-4"></div>

{% hint "warning" %}
Do not include a port in the `san` value — use `"152.248.198.124"`, **not** `"152.248.198.124:3000"`.
{% endhint %}

Ensure the port is open and reachable from each Paper server.

---

### **Step 4: Configure Paper Servers**

In each Paper server’s `config.yml`, configure connection to Velocity:

```yaml
remote: "152.248.198.124"  # Must match Velocity’s SAN
port: 3000                 # Same port used on Velocity
```
<div class="h-4"></div>

---

### **Step 5: Start Your Network**

1. **Start the Velocity proxy first**
2. Then restart all Paper servers

This ensures the proxy is listening before clients attempt to connect.

---

### **Connection Verification**

On startup, the Velocity console should show:

```
[INFO] [CommandBridge]: Client authenticated successfully: /127.0.0.1:42918
[INFO] [CommandBridge]: Added connected client: lobby
```

If all Paper clients show up as connected, your setup is complete!

If not, check for:

* Typos in config files
* Incorrect or closed ports
* Mismatched `secret`, `client-id`, or `san` values

