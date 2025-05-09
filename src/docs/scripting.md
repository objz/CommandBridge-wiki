---
title: Scripting
order: 5
---
<img src="/media/overview.png" alt="CommandBridge Overview" class="rounded-xl mb-6">

### Overview
| Context              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| **Velocity scripts** | Run commands from the proxy on connected Paper servers. |
| **Paper scripts**    | Run commands from a Paper server back to the Velocity proxy. |

Scripts are defined as simple **YAML files** and live in the `plugins/CommandBridge/scripts/` folder of your server.

{% hint "info" %}
Scripts define **custom commands** your players or console can run across your network!
{% endhint %}

Each script file can register a command (like `/alert` or `/lobby`) and attach actions to be executed on target servers.

