// The page's end of a proxy session on cb.objz.dev: the link's #id:secret names the relay channel and signs
// every message, so the relay only forwards. Used by the editor and the setup page.

window.cbRelay = (hash) => {
  const [id, secret] = String(hash).replace(/^#/, "").split(":");
  if (!/^[0-9a-f]{32}$/.test(id || "") || !secret) return null;
  const base = location.hostname === "localhost" ? "ws://localhost:8787/api/editor/" : "wss://cb.objz.dev/api/editor/";
  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64url = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const enc = (t) => new TextEncoder().encode(t);
  // replies are bound to this page load, so old proxy messages can't be replayed into it
  const conn = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  let ws, sendSeq = 0, recvSeq = 0;
  // WebCrypto is async; chain sends and receives so sequence numbers stay in order
  let queue = Promise.resolve();
  const enqueue = (fn) => { queue = queue.then(fn).catch((e) => console.error(e)); };
  const keyP = crypto.subtle.importKey("raw", unb64url(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

  const relay = {
    onOpen: () => {},
    onMessage: () => {},
    onClose: () => {},
    send(msg) {
      enqueue(async () => {
        const body = JSON.stringify(msg);
        const seq = ++sendSeq;
        const mac = await crypto.subtle.sign("HMAC", await keyP, enc(`editor\n${conn}\n${seq}\n${body}`));
        ws.send(JSON.stringify({ conn, seq, body, mac: b64url(mac) }));
      });
    },
    connect() {
      ws = new WebSocket(base + id + "/ws?role=editor");
      ws.onopen = () => relay.onOpen();
      ws.onmessage = (e) => enqueue(async () => {
        const { conn: c, seq, body, mac } = JSON.parse(e.data);
        const ok = typeof body === "string" && c === conn && seq > recvSeq &&
          await crypto.subtle.verify("HMAC", await keyP, unb64url(mac), enc(`proxy\n${c}\n${seq}\n${body}`));
        if (!ok) { console.warn("Dropped an unsigned or replayed message"); return; }
        recvSeq = seq;
        await relay.onMessage(JSON.parse(body));
      });
      // 1006 without a reason means the relay refused the connection or was unreachable
      ws.onclose = (e) => relay.onClose(e.reason || (e.code === 1006 ? "could not join the session" : "code " + e.code));
      return relay;
    },
  };
  return relay;
};
