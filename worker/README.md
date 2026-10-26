# Cloudflare Dump Worker

This worker stores `/cb dump` payloads in Cloudflare D1 and serves them back to a dedicated viewer page.

## Endpoints

- `POST /api/dump/upload`
  - Requires `Authorization: Bearer cb-dump-upload-v1`
  - Body: JSON dump payload
  - Response: `{ id, url, createdAt, expiresAt }` where `url` points to `/dump/?id=<id>`
- `GET /api/dump/:id`
  - Response: dump envelope
- `GET /api/dump/view/:id`
  - Compatibility redirect to `/dump/?id=<id>`

- `GET /api/editor/:id/ws?role=proxy|editor` (WebSocket)
  - Live editor relay, one Durable Object per session
  - `proxy` requires the same bearer token; `editor` can only join while the proxy is connected
  - One connection per role, forwarded as-is; sessions close after 1 hour or when the proxy leaves
  - Messages use end-to-end AES-256-GCM encryption; the role, page connection ID and sequence number are authenticated. The relay never sees the link secret.
  - Text frames are limited to 4 MiB; binary and oversized frames close the sender before forwarding.

- `GET /api/pair/:id/ws?role=proxy|server` (WebSocket)
  - One proxy and one server per code hash; text frames are limited to 64 KiB.
  - Pairing channels expire after 30 minutes or when either side leaves.

The bundled bearer token is public client identification, not proof that a proxy is yours. Only use links and pairing codes obtained from your own proxy console, and verify the destination before confirming pairing.

## Local checks

From `worker/`, run `node --test test/worker-security.test.mjs` with Node 22.13+ for isolated upload bounds, relay size and closing-socket checks. Against `npx wrangler dev --port 8787`, run `node test/editor-relay.mjs` and `node test/pair-relay.mjs` for live local WebSocket checks.

Deploy this service separately with `npx wrangler deploy` from `worker/`. Moving it from the plugin repo does not change its worker name, Durable Object migrations, or D1 binding.

## Database

Apply schema to D1:

```bash
wrangler d1 execute commandbridge-dumps --remote --file schema.sql
```

## Deploy

Run from this directory:

```bash
wrangler deploy
```
