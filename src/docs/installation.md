---
title: Installation
order: 2
---

### Download

Get the latest **CommandBridge JAR** from [Modrinth](https://modrinth.com/plugin/commandbridge/versions).

CommandBridge ships as a single JAR. It detects whether it's running on Velocity or a backend server automatically.

### Install

1. Place the JAR in the `plugins/` folder on your **Velocity proxy**
2. Place the same JAR in the `plugins/` folder on each **backend server**
3. Install [CommandAPI](https://commandapi.jorel.dev/) on each backend server
4. Start Velocity, then start your backends
5. Stop both sides

On first startup, CommandBridge generates its config files and a shared secret on the Velocity side. You'll configure these in the [Getting Started](/docs/getting-started/) guide.

{% hint "info" %}
CommandBridge requires a permissions plugin on both sides. [LuckPerms](https://luckperms.net/) is recommended.
{% endhint %}

### File structure after first startup

**Velocity proxy:**

```
plugins/commandbridge/
├── config.yml
├── secret.key
├── tls/
└── scripts/
    └── testcmd.yml
```

**Backend server:**

```
plugins/commandbridge/
├── config.yml
└── scripts/
```

### Next steps

- Check the [requirements](/docs/requirements/) page for version compatibility
- Follow the [Getting Started](/docs/getting-started/) guide to connect your servers
