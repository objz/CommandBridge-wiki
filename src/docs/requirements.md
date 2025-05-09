---
title: Requirements
order: 3
---

{% hint "success" %}
Looking for the legacy version of CommandBridge? Visit the [old documentation](https://docs.old.huraxdax.club).
{% endhint %}

### **Requirements**

CommandBridge v2.0.0+ requires **Java 21** and is compatible with **Minecraft 1.20.x – 1.21.x**.

A **permissions plugin** is also required on both the **Velocity proxy** and **Paper backend**.  
I recommend using [LuckPerms](https://luckperms.net/) for its reliability and flexibility.

***

### **Platform Compatibility**

CommandBridge runs a unified JAR across both proxy and backend servers.

| Server Platform                         | Support Level        | Notes                                                                 |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| **Velocity**                           | ✅ Fully Supported   | Native support for proxy-side command routing.                        |
| **Paper**                              | ✅ Fully Supported   | Officially supported backend platform.                                |
| **Spigot / Bukkit**                    | ✅ Compatible        | Works as long as Paper-specific APIs aren't required by your scripts. |
| **Folia (Paper fork)**                 | ✅ Supported         | Officially supported. Compatible with regionized multithreading.     |
| **Purpur / Tuinity / Other Paper Forks** | ⚠️ Should Work      | Based on Paper. Not extensively tested, but expected to work.         |
| **Waterfall / Other Proxies**          | ⚠️ Should Work      | Likely compatible if Velocity is used as the backend bridge.         |
| **Forge / Fabric / Other Modloaders**  | ❌ Not Supported     | Only works on plugin-based platforms (not modloaders).                |
