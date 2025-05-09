---
title: Common Issues
order: 7
---

Setting up a proxy and backend network can be error-prone. Here are common CommandBridge issues and how to resolve them.

---

### 1. Paper server can’t connect to Velocity

**Symptom:** Velocity doesn’t show `Client authenticated successfully`. Paper logs may show connection errors or timeouts.

**Checklist:**

- **Secret mismatch:** Make sure the `secret` in each Paper `config.yml` matches the content of Velocity’s `secret.key`.
- **Incorrect host/remote:** If both run on the same machine, use `127.0.0.1`. If they’re on separate machines, set Velocity’s `host` to `0.0.0.0` and Paper’s `remote` to the external IP or domain.
- **Port closed or incorrect:** Ensure the port matches on both sides and is open. On hosted setups, open it via the control panel or firewall. If in use, pick a different one.
- **SAN mismatch:** Velocity’s `san` must match the IP or domain Paper connects to. No port allowed — just the domain or IP.

Restart Velocity first, then all Paper servers. Enable `debug: true` in `config.yml` for detailed logs if needed.

---

### 2. “Address already in use” on Velocity startup

**Cause:** Another process is using the configured port.

**Fix:** Change the `port` in Velocity and all Paper configs to an unused one (e.g. 3001, 3555), then restart all servers.

---

### 3. Clients connect, but commands don’t work

**Symptom:** Velocity shows clients connected, but nothing happens when you run a command.

**Checklist:**

- **Script missing:** The script must exist on the correct side (Velocity or Paper) depending on where the command originates.
- **Missing permissions:** Players need `commandbridge.command.<name>` unless `ignore-permission-check` is enabled.
- **No permission plugin:** Make sure both Velocity and Paper have a permissions plugin (e.g. LuckPerms).
- **Invalid target client ID:** The `client-id` in each Paper config must match what’s used in `target-client-ids`.
- **Plugin not loaded:** Check `/plugins` (Paper) or `/cb version` (Velocity). Ensure the script file has `enabled: true`.

---

### 4. “You do not have permission to use this command”

**Cause:** Permission checks are active and the sender lacks the required node.

**Fix:**

- Grant the correct permission (`commandbridge.command.<name>`), or  
- Set `ignore-permission-check: true` in the script, or  
- Hide the message with `hide-permission-warning: true` (command still won’t run).

---

### 5. Placeholders aren’t working

**Symptom:** Placeholders like `%cb_player%` or `%luckperms_prefix%` are not replaced.

**Checklist:**

- **Built-in only:** Only `%cb_...%` placeholders work without PlaceholderAPI.
- **PAPI missing:** Install PlaceholderAPI on Paper, and PapiProxyBridge on Velocity if using placeholders on proxy side.
- **Debug logs:** With `debug: true`, logs will show if PAPI was detected.
- **Syntax:** Use lowercase, exact names (e.g. `%cb_player%` not `%CB_PLAYER%`).

---

### 6. Still stuck?

Enable debug logging and check the console output. If the issue persists, visit the [Support resources](support-resources.md) page to get help via Discord or GitHub.
