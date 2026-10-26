import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = stripTypeScriptTypes(readFileSync(new URL("../src/index.ts", import.meta.url), "utf8"));
const { default: worker, EditorRelay, PairRelay } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function socket(role) {
  return { role, readyState: WebSocket.OPEN, sent: [], send(message) { this.sent.push(message); }, close(code) { this.code = code; this.readyState = WebSocket.CLOSING; } };
}

test("dump upload bounds raw request bytes before parsing or storing", async () => {
  let cancelled = false, reads = 0;
  const body = new ReadableStream({
    pull(controller) {
      reads++;
      controller.enqueue(new TextEncoder().encode(reads === 1 ? "{}" : " ".repeat(1_000_000)));
    },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://worker.test/api/dump/upload", { method: "POST", headers: { Authorization: "Bearer cb-dump-upload-v1" }, body, duplex: "half" });
  const response = await worker.fetch(request, {}, {});
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.ok(reads <= 4);
});

test("dump upload still rejects malformed or missing JSON", async () => {
  for (const body of [undefined, "{broken"]) {
    const request = new Request("https://worker.test/api/dump/upload", { method: "POST", headers: { Authorization: "Bearer cb-dump-upload-v1" }, body });
    assert.equal((await worker.fetch(request, {}, {})).status, 400);
  }
});

test("valid dump JSON survives a split UTF-8 character and is stored", async () => {
  const text = '{"note":"é"}', bytes = new TextEncoder().encode(text);
  const split = bytes.indexOf(0xc3) + 1;
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, split)); controller.enqueue(bytes.slice(split)); controller.close(); } });
  let stored;
  const env = { DUMP_DB: { prepare(sql) { return { bind(...values) { if (sql.startsWith("INSERT")) stored = values[3]; return this; }, async run() {} }; } } };
  const request = new Request("https://worker.test/api/dump/upload", { method: "POST", headers: { Authorization: "Bearer cb-dump-upload-v1" }, body, duplex: "half" });
  const response = await worker.fetch(request, env, { waitUntil() {} });
  assert.equal(response.status, 201);
  assert.equal(stored, text);
});

for (const [Relay, receiver, limit] of [[EditorRelay, "editor", 4 * 1024 * 1024], [PairRelay, "server", 64 * 1024]]) {
  function channel() {
    const proxy = socket("proxy"), peer = socket(receiver);
    const state = { getTags: (ws) => [ws.role], getWebSockets: (role) => [proxy, peer].filter((ws) => !role || ws.role === role) };
    return { relay: new Relay(state), proxy, peer };
  }

  test(`${Relay.name}: frames up to the protocol limit pass both ways`, async () => {
    const { relay, proxy, peer } = channel();
    const frame = "a".repeat(limit);
    await relay.webSocketMessage(proxy, frame);
    await relay.webSocketMessage(peer, "reply");
    assert.deepEqual(peer.sent, [frame]);
    assert.deepEqual(proxy.sent, ["reply"]);
  });

  test(`${Relay.name}: oversized UTF-8 frames are closed before forwarding`, async () => {
    for (const frame of ["a".repeat(limit + 1), "é".repeat(limit / 2 + 1)]) {
      const { relay, proxy, peer } = channel();
      await relay.webSocketMessage(peer, frame);
      assert.equal(peer.code, 1009);
      assert.deepEqual(proxy.sent, []);
    }
  });

  test(`${Relay.name}: binary frames are not forwarded`, async () => {
    const { relay, proxy, peer } = channel();
    await relay.webSocketMessage(proxy, new ArrayBuffer(1));
    assert.equal(proxy.code, 1003);
    assert.deepEqual(peer.sent, []);
  });

  test(`${Relay.name}: replaced or closing sockets cannot send or receive`, async () => {
    const { relay, proxy, peer } = channel();
    peer.close(4001);
    await relay.webSocketMessage(peer, "stale edit");
    await relay.webSocketMessage(proxy, "private reply");
    assert.deepEqual(proxy.sent, []);
    assert.deepEqual(peer.sent, []);
  });
}
