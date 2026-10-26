// Plays the proxy's end of a relay session for the browser tests, encrypted the way RelayChannel.java does it.
import crypto from "node:crypto";

const enc = (t) => new TextEncoder().encode(t);
const b64url = (b) => Buffer.from(b).toString("base64url");

export async function fakeProxy(onMessage) {
  const id = crypto.randomBytes(16).toString("hex"), secret = crypto.randomBytes(32);
  const ikm = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc("commandbridge-relay-v1"), info: enc("aes-256-gcm") },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const ws = new WebSocket(`ws://localhost:8787/api/editor/${id}/ws?role=proxy`, { headers: { Authorization: "Bearer cb-dump-upload-v1" } });
  let seq = 0, conn = "", queue = Promise.resolve();
  const proxy = {
    id,
    link: `${id}:${secret.toString("base64url")}`,
    // in order, like the real proxy
    send(msg) {
      queue = queue.then(async () => {
        const s = ++seq, iv = crypto.randomBytes(12);
        const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc(`proxy\n${conn}\n${s}`) }, key, enc(JSON.stringify(msg)));
        ws.send(JSON.stringify({ conn, seq: s, iv: b64url(iv), box: b64url(box) }));
      });
      return queue;
    },
    close: () => ws.close(),
    raw: ws,
  };
  ws.onmessage = async (e) => {
    const env = JSON.parse(e.data);
    conn = env.conn;
    const body = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(env.iv, "base64url"), additionalData: enc(`editor\n${env.conn}\n${env.seq}`) },
      key, Buffer.from(env.box, "base64url"));
    onMessage(JSON.parse(new TextDecoder().decode(body)));
  };
  await new Promise((r) => (ws.onopen = r));
  return proxy;
}
