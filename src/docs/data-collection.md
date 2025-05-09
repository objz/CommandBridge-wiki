---
title: Data Collection
order: 8
---

CommandBridge uses [bStats](https://bstats.org/) to collect **anonymous usage statistics**. This helps the developer understand how the plugin is used and improve it over time.

### What’s Collected

- Plugin version  
- Minecraft version  
- Server count and player count  
- Other non-personal, technical data

**No sensitive information is collected.** IP addresses, usernames, chat, and personal data are never tracked.

---

### How to Disable

To opt out, edit the file at:

```
plugins/bStats/config.yml
```

Set:

```yaml
enabled: false
```

Repeat this on each server where you want to disable metrics.

---

![bStats](https://bstats.org/signatures/velocity/CommandBridge.svg)

*Example chart showing the number of servers using CommandBridge over time.*

---

Using bStats is standard for many Minecraft plugins. It’s lightweight, fully anonymous, and doesn’t affect performance. But it’s optional — you’re always in control.

*For more info, visit [bstats.org](https://bstats.org/).*
