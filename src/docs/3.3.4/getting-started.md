---
title: Getting Started
order: 3
description: "Step-by-step guide to installing CommandBridge, configuring WebSocket or Redis connections, and writing your first cross-server command script."
---

### Step 1: Install the plugin

I assume that everyone knows how to install plugins.
Install CommandBridge on every server you want to connect to the CB network.

{% hint "info" %}
CommandBridge is bundled in a single jar, so you do not have to install different versions. One jar works everywhere.
{% endhint %}


### Step 2: Configure the connection on Velocity

After you verified that CommandBridge started up correctly and the config was created, open it at `plugins/commandbridge/config.yml` on Velocity:

CommandBridge has two modes to run the network, either `REDIS` mode or the default `WEBSOCKET` mode.

```yaml
endpoint-type: REDIS
endpoints:
  websocket:
    bind-host: 0.0.0.0
    bind-port: 8765
  redis:
    host: 127.0.0.1
    port: 6379
    username: ''
    password: ''
```

This section needs to be changed to configure the connection. As said, change `endpoint-type` to what you want to use.
While one mode is selected, the values from the other mode are ignored. First I focus on the websocket section, as it is the default:

The `bind-host` is set to `0.0.0.0` by default, which you can leave in most cases. If you know what you are doing, you probably know what to enter.
The `bind-port` can be any port, but it has to be an unused one. You need to open this port in the firewall/router to the internet with TCP.

The redis section is nearly the same. The only difference here is that CommandBridge does not host a Redis instance, so you only need to enter your Redis credentials there.
Enter the address or IP of the Redis server and the port. In this case you do not have to change anything in the firewall like before, because you only connect.
The username and password should be self-explanatory (most of the time they are actually not).

Each CommandBridge instance has an ID that you have to specify. For Velocity, you can modify (or not, as the default value is usually enough) the `server-id` value.
It is set to `proxy-1` by default. If you use more proxies in your setup, you need to change the names. Otherwise it is pretty unnecessary.

---

### Step 3: Configure each backend

Open `plugins/commandbridge/config.yml` on each backend:

The important section should look like this (nearly identical to the Velocity one):

```yaml
endpoints:
  websocket:
    host: 127.0.0.1
    port: 8765
  redis:
    host: 127.0.0.1
    port: 6379
    username: ''
    password: ''
```

The only difference here is the naming and the function. I will not explain the Redis section again, as it is identical to before.
The websocket section has the values `host` and `port`, with slightly different names than before. This is because backends do not host the websocket server, they just connect to it.
So for backends you do not have to reserve or open any ports like you had before.
For `host`, enter the public IP address of the Velocity server with the running websocket server. You can also use the local IP address if you use a local setup.
And the port just has to match the port on Velocity. Not wizardry here.

Also here you need to change the ID of the instance, and this time it is important to change it.
Every backend acts as a client and needs its own specific ID.
The value is called `client-id` and by default it is set to `survival-1`.
I would recommend changing it to the server name or something obvious you can recognize.
Cryptic names are not that smart in this case.

{% hint "info" %}
`client-id` should be unique for every backend.
{% endhint %}


### Step 4: Set up authentication

On first startup, Velocity generates a `secret.key` file (it will be regenerated if you delete it).

The content of the file will contain a key and look something like this:

```key
9RDP43dYvjk8tos86QkU9QxG1V20O27LTR8AN0bPfeg
```

Copy this key into each config of your backend instances. You need to put it in the `secret` value in the `security` section.
An example section will look like this:

```yaml
security:
  secret: "9RDP43dYvjk8tos86QkU9QxG1V20O27LTR8AN0bPfeg"
```


{% hint "danger" %}
Keep `secret.key` private. Anyone with this key can issue commands across your network.
{% endhint %}


### Step 5: Start your network

Pretty self-explanatory. Start your Velocity server and the backend servers.
If you run in Redis mode, make sure Redis is running.
If you run in websocket mode, ensure that Velocity starts first, because the websocket server needs to run first.
After that you can start up any other servers.


> CommandBridge comes with an example script. You may need to enable it, or you can start by writing your own.
For that, visit the [Scripting](/docs/scripting/) section.
