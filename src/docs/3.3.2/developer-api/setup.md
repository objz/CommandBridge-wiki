---
title: Setup
order: 1
description: "Add the commandbridge-api dependency and get the API instance in your plugin."
---

To use the CommandBridge API in your plugin, add the `commandbridge-api` dependency to your build and declare CommandBridge as a plugin dependency so it loads first.

---

## Dependency

Add the dependency to your build script.

{% tabs %}
{% tab "Maven" %}
```xml
<dependency>
    <groupId>dev.objz</groupId>
    <artifactId>commandbridge-api</artifactId>
    <version>3.3.2</version>
    <scope>provided</scope>
</dependency>
```
{% endtab %}
{% tab "Gradle (Groovy)" %}
```groovy
compileOnly 'dev.objz:commandbridge-api:3.3.2'
```
{% endtab %}
{% tab "Gradle (Kotlin)" %}
```kotlin
compileOnly("dev.objz:commandbridge-api:3.3.2")
```
{% endtab %}
{% endtabs %}

Shading the API into your jar is not supported. CommandBridge bundles the API in its own jar and provides it at runtime, so use `provided` or `compileOnly`.

---

## Plugin dependency

Declare CommandBridge as a required dependency in your plugin descriptor so it loads before your plugin.

{% tabs %}
{% tab "Velocity" %}
```java
@Plugin(
    id = "myplugin",
    dependencies = { @Dependency(id = "commandbridge") }
)
public class MyPlugin { }
```
{% endtab %}
{% tab "Paper (paper-plugin.yml)" %}
```yaml
dependencies:
  server:
    CommandBridge:
      load: BEFORE
      required: true
      join-classpath: true
```

`join-classpath: true` is required. Paper uses isolated classloaders, so your plugin can't see CommandBridge's API classes without it.
{% endtab %}
{% tab "Bukkit / Spigot (plugin.yml)" %}
```yaml
depend:
  - CommandBridge
```
{% endtab %}
{% endtabs %}

---

## Getting the instance

Call `CommandBridgeProvider.get()` to get the API instance. Store it as a field and call it from the right lifecycle method.

{% tabs %}
{% tab "Velocity" %}
```java
private CommandBridgeAPI api;

@Subscribe
public void onProxyInitialize(ProxyInitializeEvent event) {
    api = CommandBridgeProvider.get();
}
```
{% endtab %}
{% tab "Paper / Bukkit" %}
```java
private CommandBridgeAPI api;

@Override
public void onEnable() {
    api = CommandBridgeProvider.get();
}
```
{% endtab %}
{% endtabs %}

{% hint "warning" %}
`CommandBridgeProvider.get()` throws `IllegalStateException` if CommandBridge is not installed or has not finished enabling.
{% endhint %}

If you need to cast to a platform-specific subtype, use the typed overload. It throws `IllegalStateException` if the registered implementation is not an instance of the requested type:

```java
CommandBridgeProvider.get(MyPlatformExtension.class)
```
