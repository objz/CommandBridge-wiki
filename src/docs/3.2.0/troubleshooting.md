---
title: Troubleshooting
order: 8
---

This page lists real error messages you may encounter and how to fix them.

---

## Connection issues

### `Connection failed: <message>`

The backend could not open a WebSocket connection to Velocity.

| Cause | Fix |
|-------|-----|
| Wrong host | The backend's `endpoints.websocket.host` must be the IP or hostname where Velocity is reachable. If both run on the same machine, use `127.0.0.1`. If on different machines, use Velocity's external IP or domain. |
| Wrong port | The backend's `endpoints.websocket.port` must match Velocity's `endpoints.websocket.bind-port`. |
| Port not open | The bind port on Velocity must be open as TCP in your firewall. If you are on a hosting provider, check their panel for a separate port allowlist. |
| Velocity not running yet | In WebSocket mode, Velocity hosts the server. If the backend starts before Velocity is listening, the connection has nothing to reach. The backend retries automatically, but if Velocity takes too long you may hit the `reconnect-timeout`. Start Velocity first. |

---

### `WebSocket TLS/HTTP failed to bind on <host>:<port> (<reason>)`

Velocity could not start the WebSocket server on the configured address.

The most common reason is **"Address already in use"** — another process (or a previous Velocity instance that hasn't fully shut down) is already occupying that port.

**Fix:** Either wait a few seconds and restart, or change `endpoints.websocket.bind-port` to an unused port on Velocity and update `endpoints.websocket.port` on all backends to match.

---

### `Connection lost - attempting to reconnect`

The WebSocket connection between a backend and Velocity dropped unexpectedly. This is logged on the backend side. The backend will automatically try to reconnect using the configured `reconnect-timeout` and `reconnect-interval`.

If the reconnection succeeds, no action is needed. If it keeps failing, see the next entry.

---

### `All reconnection attempts failed after <N>s`

The backend exhausted its reconnection window (configured by `timeouts.reconnect-timeout`) without successfully reconnecting.

**Fix:** Check that Velocity is running and reachable from the backend. Verify host, port, firewall, and TLS mode. You can manually trigger a reconnection from the backend with `/cb reconnect` once the underlying issue is resolved.

---

### `Scheduling automatic reconnection (timeout: <N>s, interval: <N>s)`

Informational. The backend detected a disconnect and is entering the automatic reconnection loop. The values shown come from `timeouts.reconnect-timeout` and `timeouts.reconnect-interval` in the backend config.

---

## Authentication errors

### `Authentication rejected by server`

The backend sent an `AUTH_REQUEST` but Velocity responded with `AUTH_FAIL`. This means the shared secret on the backend does not match Velocity's `secret.key`.

**Fix:** Open `plugins/commandbridge/secret.key` on Velocity, copy its content, and paste it into the backend's `security.secret` config field (or copy the `secret.key` file itself to the backend). Make sure there are no trailing spaces or line breaks.

---

### `Authentication failed: invalid server proof`

The backend received an `AUTH_OK` from Velocity, but the server's HMAC proof did not verify. This means the backend and Velocity are using different secrets even though the server thinks the client's secret was correct — which should not happen under normal circumstances.

**Fix:** This typically indicates a corrupted secret on one side. Regenerate: delete `secret.key` on Velocity, restart it to create a new one, then copy the new key to all backends.

---

### `Authentication timeout`

The backend sent an `AUTH_REQUEST` but received no response within the configured `timeouts.auth-timeout`.

**Fix:** This usually means Velocity never received the request. Check that the connection was actually established (look for TLS or connection errors above this message in the log). If the connection is fine, increase `timeouts.auth-timeout` if your network has high latency.

---

### `Authentication failed (malformed payload) from '<endpoint>'`

Velocity received an `AUTH_REQUEST` but the payload was missing required fields (client ID, nonce, or HMAC). This should not happen with matching plugin versions.

**Fix:** Make sure both Velocity and the backend are running the same version of CommandBridge.

---

### `'security.secret' contains 'change-me'. replace with real key`

The backend config still has the default placeholder secret. CommandBridge will not authenticate with this value in production.

**Fix:** Copy the real key from Velocity's `secret.key` file into `security.secret` on the backend.

---

## TLS / SSL errors

### `TLS pin mismatch (STRICT): expected '<pin>' but got '<pin>'`

In STRICT mode, the backend has a configured `tls-pin` that does not match the certificate Velocity is presenting.

**Fix:** Get the correct SPKI pin from the Velocity startup log (it prints `TLS SPKI pin: sha256/...` on boot) and set it as `security.tls-pin` on the backend.

---

### `TLS pin mismatch (TOFU configured): expected '<pin>' but got '<pin>'`

The backend has a `tls-pin` set in its config (from a previous TOFU pinning), but Velocity's certificate has changed since then (e.g. the keystore was regenerated).

**Fix:** Clear `security.tls-pin` on the backend (set it to `""`) and restart. The backend will re-pin the new certificate on the next connection. Optionally, copy the new pin from the Velocity startup log for persistent pinning.

---

### `TLS pin mismatch (TOFU session): expected '<pin>' but got '<pin>'`

During a single session, the backend already pinned a certificate in memory, but on a subsequent reconnection the certificate changed. This could indicate a man-in-the-middle or that Velocity was restarted with a new certificate mid-session.

**Fix:** Restart the backend so it can pin the new certificate fresh. If you want to prevent this, set the pin explicitly in the config.

---

### `STRICT mode requires a TLS pin`

The backend is configured with `tls-mode: STRICT` but `tls-pin` is empty.

**Fix:** STRICT mode always requires an explicit pin. Copy the SPKI pin from the Velocity startup log into `security.tls-pin` on the backend.

---

### `TLS validation failed: empty server certificate chain`

The backend connected to Velocity but received no TLS certificate. This typically means one side is using `PLAIN` while the other expects TLS.

**Fix:** Make sure `security.tls-mode` is the same on both Velocity and the backend.

---

### `'tls-mode=PLAIN' disables transport encryption. use TOFU/STRICT in production`

A warning that you are running without any transport encryption. All traffic between the proxy and backends is sent in plain text.

**Fix:** For anything beyond local testing, switch to `tls-mode: TOFU` (recommended) or `STRICT` on both sides.

---

### `TLS is disabled. This is insecure for production.`

Same as above, logged on the Velocity side when the WebSocket server starts without TLS.

---

### STRICT mode keystore errors

| Error | Fix |
|-------|-----|
| `'security.keystore-path' is required in STRICT mode` | Set the full path to your `.p12` or `.jks` keystore file on Velocity. |
| `'security.keystore-password' is required in STRICT mode` | Set the keystore password on Velocity. |
| `'security.keystore-type' is required in STRICT mode` | Set `PKCS12` or `JKS` on Velocity. |
| `Failed to load STRICT keystore` | The keystore file could not be read. Verify the path exists, the password is correct, and the type matches the file format. |

See the [Security](/docs/configuration/security/) page for full TLS setup instructions.

---

## Script validation errors

CommandBridge validates every script at load time. If a script has errors, it is skipped and the problems are printed in the Velocity log as a bulleted list under the script file name.

### `does not match required pattern: <regex>`

A field value failed a regex validation. The most common case is the script **name**: it must be lowercase, 3 to 33 characters, start with a letter, and only contain `a-z`, `0-9`, or `-`.

Valid: `eco-give`, `lobby`, `alert-staff`
Invalid: `EcoGive`, `e`, `my_command`, `123test`

---

### Required field missing

A field marked as required was not set or was left empty. The core required fields in a script are: `version`, `name`, `permissions`, `register`, `defaults`, `args`, and `commands`. Check the error message for which specific field is missing.

---

### `Argument '<name>' (type '<type>') is only supported on [<locations>], but script registers on [<locations>]`

You used a platform-specific argument type (like `PLAYERS` or `GAME_PROFILE`) in a script that registers on a location where that type is not available. For example, `PLAYERS` only works on backends — if the script registers on Velocity, this fails.

**Fix:** Either change `register` to a backend, or use a universal argument type like `STRING`.

---

### `Required argument '<name>' is used after optional argument '<name>' in command string`

Required arguments must come before optional arguments in the `args` list. If you have an optional argument followed by a required one, the parser cannot determine where one ends and the other begins.

**Fix:** Reorder your `args` so all required arguments come first.

---

### `Argument '<name>' (type '<type>') must be the last argument in command string`

Argument types that consume all remaining input (like `GREEDY_STRING` or `TEXT`) must be the final argument. Nothing can follow them because they absorb everything.

**Fix:** Move this argument to the end of the `args` list.

---

### `Unknown argument '<name>' at placeholder[<N>]`

A `${name}` placeholder in a command string references an argument name that does not exist in the `args` list.

**Fix:** Check spelling and case — placeholder names are case-sensitive. `${Player}` is not the same as `${player}`.

---

### `Empty placeholder ${} is not allowed`

A command string contains `${}` with nothing inside.

**Fix:** Fill in the argument name: `${player}`, `${amount}`, etc.

---

### `Invalid default '<value>': <message>`

A default value defined for an argument could not be parsed as the expected type.

**Fix:** Make sure the default value is valid for the argument type (e.g. a number for `INTEGER`, a valid duration string for `DURATION`).

---

### YAML parse errors

| Error | Meaning |
|-------|---------|
| `YAML error at line <N>, column <N>: <problem>` | The YAML syntax is broken at the indicated position. Common causes: wrong indentation, tabs instead of spaces, missing colons, unclosed quotes. |
| `expected a mapping/object` | A field expected a YAML map (key-value pairs) but got something else (a string, a list, etc.). |
| `expected a list` | A field expected a YAML list but got a scalar or map. |
| `expected a value` | A required value is missing entirely. |

---

## Configuration errors

### `Invalid config.yml`

The config file could not be parsed at all. This is usually a YAML syntax error.

**Fix:** Validate your `config.yml` with a YAML linter. Look for wrong indentation, tabs, or missing colons.

---

### `Unknown config key: '<key>' did you mean '<suggestion>' ? (ignored)`

A key in your config does not match any known setting. CommandBridge suggests the closest match if one exists.

**Fix:** Rename the key to the suggested value, or remove it if it is no longer needed.

---

### `Invalid value '<value>' for '<key>'. expected one of <values>`

An enum field (like `tls-mode` or `endpoint-type`) has an unrecognized value.

**Fix:** Use one of the listed valid values. Common examples: `tls-mode` accepts `PLAIN`, `TOFU`, or `STRICT`. `endpoint-type` accepts `WEBSOCKET` or `REDIS`.

---

### Host format warnings

| Error | Fix |
|-------|-----|
| `'endpoints.websocket.host' must NOT include ws:// or wss://` | Remove the protocol prefix. Use `127.0.0.1`, not `ws://127.0.0.1`. |
| `'endpoints.redis.host' must NOT include redis:// or rediss://` | Remove the protocol prefix. Use `127.0.0.1`, not `redis://127.0.0.1`. |

---

### Port and timeout validation

| Error | Fix |
|-------|-----|
| `'endpoints.websocket.port' must be between 1 and 65535` | Set a valid port number. |
| `'endpoints.redis.port' must be between 1 and 65535` | Set a valid port number. |
| `'timeouts.auth-timeout' must be > 0` | The authentication timeout must be a positive value. |
| `'timeouts.reconnect-timeout' must be > 0` | The reconnection window must be a positive value. |
| `'timeouts.reconnect-interval' must be > 0` | The reconnection retry interval must be a positive value. |
| `'timeouts.register-timeout' must be > 0` | The command registration timeout must be a positive value (Velocity only). |
| `'timeouts.ping-timeout' must be > 0` | The ping timeout must be a positive value (Velocity only). |

---

## Command execution issues

### Commands are registered but nothing happens

`/cb list` shows the backend as connected, but running a script command produces no output or effect.

**Checklist:**

1. **Script not loaded** — run `/cb scripts` on Velocity to check if the script appears. If it doesn't, there is a validation error. Check the Velocity log for the exact problem.
2. **Script disabled** — the script might have `enabled: false`. Check the `enabled` field.
3. **Scripts live on Velocity** — all script files must be in `plugins/commandbridge/scripts/` on the Velocity proxy. Do not put scripts on backends.
4. **Target client ID mismatch** — the `id` in `execute` must match the backend's `client-id` exactly. A typo means the command is sent to a nonexistent client and silently fails.
5. **Client disconnected** — the target backend may have disconnected after you last checked. Run `/cb list` again.

---

### `Target '<id>' (<location>) not found or not connected`

A command tried to execute on a backend that is not currently connected.

**Fix:** Check that the backend is running and authenticated (`/cb list`). Verify the `client-id` in the backend config matches the `id` in the script's `execute` block.

---

### `target-required: player '<name>' is not on <location> '<id>', skipping`

The command has `target-required: true` and the player is not on the target server. The execution is skipped for that target.

This is expected behavior when using `target-required` to restrict commands to the server the player is currently on. If you want the command to execute regardless of where the player is, set `target-required: false`.

---

### `Command '<name>' has no execution targets defined`

The script's `commands` section has an entry with no `execute` blocks, so there is nothing to dispatch.

**Fix:** Add at least one `execute` block with an `id` and `command` to the command entry.

---

### `You do not have permission to execute this command`

The player does not have the required permission node.

**Fix:**

1. Grant `commandbridge.command.<name>` where the command is **registered** (Velocity or the backend, depending on the script's `register` setting).
2. Or set `permissions.enabled: false` in the script to disable permission checks entirely.
3. Or set `permissions.silent: true` to suppress the message (the command still won't run, but the player won't see the error).

---

## Redis errors

### `Redis connection failed: <message>`

The backend could not connect to the Redis server.

**Fix:** Verify that the Redis server is running and reachable at the configured `endpoints.redis.host` and `endpoints.redis.port`. Check firewall rules. If Redis requires authentication, make sure credentials are correct.

---

### `Redis subscriber disconnected: <message>`

The Redis pub/sub subscription dropped. The backend will attempt to reconnect.

**Fix:** Check the Redis server health. If this keeps happening, look at Redis server logs for memory or connection limit issues.

---

### `Redis publish failed: <message>`

A message could not be published to Redis.

**Fix:** Check the Redis connection. This usually means the connection was lost. The backend should reconnect automatically.

---

### `Redis subscribe loop failed: <message>`

Velocity's Redis subscription loop encountered an error. This is logged on the Velocity side.

**Fix:** Same as above — check the Redis server. Velocity will log this when the subscription thread fails.

---

## Platform and startup errors

### `Unknown platform detected (<platform>). Falling back to Bukkit adapter`

CommandBridge could not identify the server platform and is using the generic Bukkit adapter. This is a warning — things may still work, but some platform-specific features might not be available.

---

### `Failed to enable CommandBridge: <message>`

The plugin failed during startup. The error message contains the specific cause.

**Fix:** Check the full stack trace in the server log. Common causes: config parse errors, port conflicts, missing dependencies.

---

### `Detected old CommandBridge installation at '<path>'. Please view the migration guide`

An older version's data folder was found alongside the new one.

**Fix:** Remove the old installation folder and reconfigure CommandBridge using the current documentation.

---

### `PapiProxyBridge not found. PlaceholderAPI will not be used`

Velocity cannot resolve `%placeholder%` style PlaceholderAPI placeholders because PapiProxyBridge is not installed.

**Fix:** If you need PAPI placeholders, install [PapiProxyBridge](https://hangar.papermc.io/William278/PapiProxyBridge) on Velocity and PlaceholderAPI on your backends. If you don't use PAPI placeholders, this warning is safe to ignore.

---

### `A new version of CommandBridge is available`

A newer release exists. This is informational.

---

## Debug mode

Enable debug logging for verbose output:

```yaml
debug: true
```

Or toggle it at runtime without a restart:

```
/cb debug
```

Debug logs include network frames, authentication handshakes, command dispatch steps, placeholder resolution, and registration events.

{% hint "warning" %}
Debug mode produces a lot of log output. It is meant for diagnosing specific issues, not for production use. Turn it off when you are done.
{% endhint %}

---

## Getting help

If you went through this page and are still stuck:

1. Run `/cb dump` and include the output
2. Include your CommandBridge version, Minecraft version, Velocity version, and backend platform (Paper, Folia, etc.)
3. Include relevant log output (use a paste service for long logs, don't paste them directly into chat)
4. Describe what you expected to happen and what actually happened

- [Discord](https://discord.gg/QPqBYb44ce)
- [GitHub Issues](https://github.com/objz/CommandBridge/issues)
