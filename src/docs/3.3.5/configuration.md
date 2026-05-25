---
title: Configuration
order: 4
description: "Overview of CommandBridge configuration for Velocity and backend servers, including WebSocket, Redis, and multi-proxy networking modes."
---

CommandBridge has two different configurations. The one on the Velocity proxy and one on each backend. For each backend, every server that is not Velocity is counted.

---

### CommandBridge offers two ways to build up the network:

Either **Redis** or **WebSockets**. WebSockets are the standard and the first implementation, and it was originally built on this system. 
Redis is the newer method, but an alternative that is not reliable for everyone. The key difference is that in **WebSocket mode**, one Velocity hosts a server while the other backend servers connect to it. 
This proxy then manages all traffic. No other setup is required. **Redis mode**, on the other hand, requires a Redis server running externally. CommandBridge will not host a Redis server. 
With Redis mode, every CB instance will try to connect to it, including Velocity, but one Velocity instance still manages all message traffic, just the network stack isn’t managed by it anymore.

I was talking a lot about 'one Velocity instance', because CB supports **multi proxy setups**. What that exactly means is explained here: [Multi proxy](/docs/configuration/multi-proxy/). 
But for that to work, there can’t be multiple proxies that manage these messages, so each proxy has in its config the value `act-as-client`. 
This enables the client mode for that Velocity instance. So by design it will just act as the other client (as the title says). 
For this mode, a `client.yml` will be created with the default client config. Advanced configuration can be viewed in the article.

