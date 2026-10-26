// Loopback-only, paced relay check. Run: node worker/test/sustained-load.mjs [seconds=300] [ws-base]
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as pause } from "node:timers/promises";

const sessions = 10, rate = 100;
function localBase(text) {
  const url = new URL(text);
  assert.equal(url.protocol, "ws:");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Load tests only permit loopback");
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/");
  return url.origin;
}
function seal(key, conn, role, seq, body) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${role}\n${conn}\n${seq}`));
  const box = Buffer.concat([cipher.update(JSON.stringify(body)), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ conn, seq, iv: iv.toString("base64url"), box: box.toString("base64url") });
}
function open(key, conn, role, frame) {
  const envelope = JSON.parse(frame), box = Buffer.from(envelope.box, "base64url");
  assert.equal(envelope.conn, conn);
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  cipher.setAAD(Buffer.from(`${role}\n${conn}\n${envelope.seq}`));
  cipher.setAuthTag(box.subarray(-16));
  const body = JSON.parse(Buffer.concat([cipher.update(box.subarray(0, -16)), cipher.final()]).toString());
  assert.equal(body.seq, envelope.seq);
  return body;
}
function percentile(values, fraction) {
  return values.length ? Math.round(values[Math.ceil(values.length * fraction) - 1] * 100) / 100 : null;
}

if (process.argv[2] === "--self-test") {
  const key = randomBytes(32), conn = randomBytes(16).toString("hex");
  const frame = seal(key, conn, "editor", 1, { seq: 1, text: "hello" });
  assert.deepEqual(open(key, conn, "editor", frame), { seq: 1, text: "hello" });
  assert.throws(() => open(key, conn, "proxy", frame));
  assert.throws(() => localBase("wss://cb.objz.dev/"));
  assert.throws(() => localBase("ws://example.com/"));
  assert.equal(percentile([1, 2, 3, 4], .95), 4);
  console.log("Relay load self-checks passed; no network traffic sent");
} else {
  const seconds = Number(process.argv[2] || 300), base = localBase(process.argv[3] || "ws://127.0.0.1:8787/");
  assert.ok(Number.isInteger(seconds) && seconds > 0 && seconds <= 600);
  const sockets = [], pairs = [], failures = [], latencies = [];
  let sent = 0, delivered = 0, duplicates = 0, unexpected = 0, closedEarly = 0, stopping = false;
  function connect(url, proxy) {
    const ws = new WebSocket(url, proxy ? { headers: { Authorization: "Bearer cb-dump-upload-v1" } } : undefined);
    sockets.push(ws);
    ws.addEventListener("close", () => { if (!stopping) closedEarly++; });
    ws.addEventListener("error", () => { failures.push("WebSocket error"); });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error("Relay connection timed out")); }, 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(ws); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("Relay connection failed")); };
    });
  }
  let result, failure;
  try {
    for (let i = 0; i < sessions; i++) {
      const id = randomBytes(16).toString("hex"), conn = randomBytes(16).toString("hex");
      const key = Buffer.from(hkdfSync("sha256", randomBytes(32), "commandbridge-relay-v1", "aes-256-gcm", 32));
      const proxy = await connect(`${base}/api/editor/${id}/ws?role=proxy`, true);
      const page = await connect(`${base}/api/editor/${id}/ws?role=editor`, false);
      const pair = { proxy, page, conn, key, seq: 0, sent: new Map(), seen: new Set(), requests: new Set() };
      pairs.push(pair);
      proxy.onmessage = (event) => {
        try {
          const body = open(key, conn, "editor", event.data);
          assert.ok(pair.sent.has(body.seq) && !pair.requests.has(body.seq), "Unexpected or repeated request");
          assert.equal(body.pad, "x".repeat(1024));
          pair.requests.add(body.seq);
          proxy.send(seal(key, conn, "proxy", body.seq, body));
        } catch { failures.push("Invalid request or forwarding failure"); }
      };
      page.onmessage = (event) => {
        try {
          const body = open(key, conn, "proxy", event.data);
          assert.equal(body.pad, "x".repeat(1024));
          if (!pair.sent.has(body.seq)) { unexpected++; return; }
          if (pair.seen.has(body.seq)) { duplicates++; return; }
          pair.seen.add(body.seq);
          delivered++;
          latencies.push(performance.now() - pair.sent.get(body.seq));
        } catch { failures.push("Invalid reply"); }
      };
    }
    const start = performance.now();
    for (let tick = 0; tick < seconds * rate / sessions; tick++) {
      await pause(Math.max(0, start + tick * sessions * 1000 / rate - performance.now()));
      assert.ok(!failures.length && !closedEarly, "Relay failed during sustained traffic");
      assert.ok(sent - delivered < rate * 10, "Relay backlog exceeds ten seconds");
      for (const pair of pairs) {
        const seq = ++pair.seq;
        pair.sent.set(seq, performance.now());
        pair.page.send(seal(pair.key, pair.conn, "editor", seq, { seq, pad: "x".repeat(1024) }));
        sent++;
      }
    }
    await pause(Math.max(0, start + seconds * 1000 - performance.now()));
    const deadline = performance.now() + 10000;
    while (delivered < sent && performance.now() < deadline) await pause(20);
    await pause(500);
    latencies.sort((a, b) => a - b);
    result = { seconds, sessions, target_roundtrips_per_second: rate, payload_bytes: 1024, sent, delivered,
      missing: sent - delivered, duplicates, unexpected, closed_early: closedEarly, errors: failures.length,
      elapsed_seconds: Math.round((performance.now() - start) / 10) / 100,
      latency_ms: { p50: percentile(latencies, .5), p95: percentile(latencies, .95),
        p99: percentile(latencies, .99), max: latencies.length ? latencies.at(-1) : null } };
    assert.equal(sent, seconds * rate);
    assert.equal(delivered, sent);
    assert.ok(!duplicates && !unexpected && !closedEarly && !failures.length);
  } catch (error) {
    failure = error;
  } finally {
    stopping = true;
    for (const ws of sockets) {
      if (ws.readyState < WebSocket.CLOSING) ws.close(1000, "Load check finished");
    }
    await pause(500);
  }
  console.log(JSON.stringify(result || { sent, delivered, errors: failures.length, failed: true }, null, 2));
  if (failure) console.error(failure.message);
  process.exit(failure ? 1 : 0);
}
