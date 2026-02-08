---
title: Troubleshooting
order: 10
---

Common issues and how to fix them. Enable `debug: true` in `config.yml` for detailed logs.

---

### Backend can't connect to Velocity

**Symptoms:** No "Client authenticated" message on Velocity. Backend logs show connection errors or timeouts.

**Checklist:**

- **Secret mismatch** -- the `secret` in each backend's config must match Velocity's `secret.key` file contents
- **Wrong host** -- if both run on the same machine, use `127.0.0.1`. If on different machines, the backend's `host` must point to Velocity's external IP or domain
- **Port closed** -- make sure `bind-port` on Velocity is open in your firewall and matches the backend's `port`
- **TLS mode mismatch** -- both sides must use the same `tls-mode` (`PLAIN`, `TOFU`, or `STRICT`)
- **Start order** -- start Velocity first, then backends. The proxy must be listening before clients connect.

---

### "Address already in use" on Velocity

Another process is using the configured port.

**Fix:** Change `bind-port` to an unused port (e.g. `8766`) on Velocity and all backends, then restart.

---

### Clients connect but commands don't work

**Symptoms:** `/cb list` shows the client as connected, but running a script command does nothing.

**Checklist:**

- **Script not loaded** -- check `/cb scripts` to verify the script appears. If not, check for YAML syntax errors in the server log.
- **Wrong side** -- the script must exist on the side that runs the dispatch. If the command is registered on Velocity, the script file must be on Velocity.
- **Missing permissions** -- the player needs `commandbridge.command.<name>` unless `permissions.enabled` is `false` in the script
- **Target client ID mismatch** -- the `id` in `execute` must match the backend's `client-id` exactly
- **Client disconnected** -- if the target backend disconnected after `/cb list` was run, the command will fail silently

---

### "You do not have permission to use this command"

The player lacks the required permission node.

**Fix:**

1. Grant `commandbridge.command.<name>` on the correct side (where the command is registered), or
2. Set `permissions.enabled: false` in the script to disable checks, or
3. Set `permissions.silent: true` to suppress the message (the command still won't run)

---

### TLS / SSL errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SSL handshake failed` | TLS mode mismatch | Set the same `tls-mode` on both sides |
| `Certificate pin mismatch` | Proxy cert was regenerated | Clear `tls-pin` on the backend, restart |
| `PKIX path building failed` | STRICT mode with bad keystore | Check `keystore-path`, `keystore-password`, and `keystore-type` |

See the [Security](/docs/security/) page for detailed TLS setup.

---

### Placeholders not resolving

- `${arg}` placeholders require matching argument names in the `args` list
- PlaceholderAPI (`%placeholder%`) requires PAPI on the backend and PapiProxyBridge on Velocity
- PAPI placeholders only resolve when the executor is a player (not console)
- Check spelling and case -- placeholder names are case-sensitive

---

### Script validation errors

CommandBridge validates scripts at load time. Common errors:

| Error | Fix |
|-------|-----|
| `name does not match pattern` | Script name must be lowercase, 3-33 chars, start with a letter, only `a-z0-9-` |
| `required field missing` | Add the missing field. All of `version`, `name`, `permissions`, `register`, `defaults`, `args`, `commands` are required. |
| `platform mismatch` | You used a backend-only argument type (like `PLAYERS`) in a command registered on Velocity without a backend in `register` |
| `unknown argument type` | Check spelling against the [Argument Types](/docs/scripting/argument-types/) list |

---

### Debug mode

Enable debug logging for detailed output:

```yaml
debug: true
```

Or toggle it at runtime:

```
/cb debug
```

Debug logs include WebSocket frames, auth handshakes, command dispatch steps, and placeholder resolution.

---

### Getting help

If you're still stuck:

1. Run `/cb dump` and include the output
2. Include your CommandBridge, Minecraft, Velocity, and backend versions
3. Include relevant log output (use a pastebin for long logs)

- [Discord](https://discord.gg/QPqBYb44ce)
- [GitHub Issues](https://github.com/objz/CommandBridge/issues)
