import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = readFileSync(new URL("../src/lib/editor/relay.js", import.meta.url), "utf8");
const enc = (text) => new TextEncoder().encode(text);
const b64 = (data) => Buffer.from(data).toString("base64url");
const unb64 = (text) => Buffer.from(text, "base64url");

async function page(secret = webcrypto.getRandomValues(new Uint8Array(32))) {
  let socket, sent;
  const errors = [], messages = [];
  const window = { addEventListener() {} };
  class Socket {
    constructor() { socket = this; }
    send(frame) { sent?.(JSON.parse(frame)); }
    close(code) { this.code = code; }
  }
  vm.runInNewContext(source, { window, location: { hostname: "localhost" }, crypto: webcrypto, WebSocket: Socket, TextEncoder, TextDecoder, Uint8Array, btoa, atob,
    console: { error: (e) => errors.push(e), warn() {} } });
  const relay = window.cbRelay("a".repeat(32) + ":" + b64(secret));
  relay.onMessage = (message) => messages.push(message);
  relay.connect();
  const send = (msg) => new Promise((resolve) => { sent = resolve; relay.send(msg); });
  const hello = await send({ type: "hello" });
  const ikm = await webcrypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc("commandbridge-relay-v1"), info: enc("aes-256-gcm") },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const seal = async (seq, message, role = "proxy", conn = hello.conn) => {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const box = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc(`${role}\n${conn}\n${seq}`) }, key, enc(JSON.stringify(message)));
    return JSON.stringify({ conn, seq, iv: b64(iv), box: b64(box) });
  };
  const receive = async (frame) => { socket.onmessage({ data: frame }); await send({ type: "barrier" }); };
  return { relay, socket, key, conn: hello.conn, errors, messages, send, receive, seal };
}

test("large editor saves encrypt without overflowing the argument stack", { timeout: 5000 }, async () => {
  const p = await page();
  const message = { type: "stage", files: { "big.yml": "say hello\n".repeat(30000) } };
  const frame = await p.send(message);
  assert.deepEqual(p.errors, []);
  const plain = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(frame.iv), additionalData: enc(`editor\n${frame.conn}\n${frame.seq}`) }, p.key, unb64(frame.box));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)), message);
});

test("only authenticated, fresh messages for this page and role are delivered", { timeout: 5000 }, async () => {
  const p = await page();
  const first = await p.seal(1, { type: "state" });
  await p.receive(first);
  await p.receive(first);
  await p.receive(await p.seal(2, { type: "reflection" }, "editor"));
  await p.receive(await p.seal(2, { type: "other-tab" }, "proxy", "b".repeat(32)));
  const corrupt = JSON.parse(await p.seal(100, { type: "tampered" }));
  corrupt.box = b64(Buffer.alloc(32));
  await p.receive(JSON.stringify(corrupt));
  await p.receive(await p.seal(2, { type: "fresh" }));
  assert.equal(JSON.stringify(p.messages), JSON.stringify([{ type: "state" }, { type: "fresh" }]));
  assert.deepEqual(p.errors, []);
});

test("reloading the same link changes the page identity and rejects earlier replies", { timeout: 5000 }, async () => {
  const secret = webcrypto.getRandomValues(new Uint8Array(32));
  const old = await page(secret), fresh = await page(secret);
  assert.notEqual(old.conn, fresh.conn);
  await fresh.receive(await old.seal(10, { type: "old" }));
  assert.deepEqual(fresh.messages, []);
});

test("oversized and binary relay data are closed before decryption", { timeout: 5000 }, async () => {
  for (const data of ["a".repeat(4 * 1024 * 1024 + 1), new ArrayBuffer(1)]) {
    const p = await page();
    p.socket.onmessage({ data });
    assert.equal(p.socket.code, 1009);
    assert.deepEqual(p.messages, []);
  }
});
