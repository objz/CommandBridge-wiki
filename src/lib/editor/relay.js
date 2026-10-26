// The page's end of a proxy session on cb.objz.dev. The link's #id:secret names the relay channel, and the secret
// is the key every message is encrypted with (AES-GCM, see RelayCrypto.java), so the relay can neither read nor
// change what passes through it. Used by the editor and the setup page.

// a new link in the same tab only changes the #fragment, which doesn't reload the page;
// without this the page would keep talking to the old, ended session
window.addEventListener("hashchange", () => location.reload());

// The link for this tab. The secret is taken out of the address bar and history right away and kept for this
// tab only, so a reload still works but the link doesn't linger in history or sync.
window.cbLink = () => {
  const slot = "cb-link:" + location.pathname;
  if (location.hash.length > 1) {
    const hash = location.hash;
    try { sessionStorage.setItem(slot, hash); } catch {}
    history.replaceState(null, "", location.pathname + location.search);
    return hash;
  }
  try { return sessionStorage.getItem(slot) || ""; } catch { return ""; }
};

// why a session ended, by close code; the relay's reason text isn't shown, the encryption doesn't cover it
const CLOSED = {
  1000: "the proxy closed it",
  4001: "it was opened in another tab",
  4404: "this link has ended",
  1006: "the relay could not be reached",
};

window.cbRelay = (hash) => {
  const [id, secret] = String(hash).replace(/^#/, "").split(":");
  if (!/^[0-9a-f]{32}$/.test(id || "") || !/^[A-Za-z0-9_-]{43}$/.test(secret || "")) return null;
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
  const keyP = crypto.subtle.importKey("raw", unb64url(secret), "HKDF", false, ["deriveKey"])
    .then((ikm) => crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: enc("commandbridge-relay-v1"), info: enc("aes-256-gcm") },
      ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
  // the sender's role, this page's connection and the sequence number are bound into every message
  const aad = (role, seq) => enc(`${role}\n${conn}\n${seq}`);

  const relay = {
    onOpen: () => {},
    onMessage: () => {},
    onClose: () => {},
    send(msg) {
      enqueue(async () => {
        const seq = ++sendSeq;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const box = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad("editor", seq) }, await keyP, enc(JSON.stringify(msg)));
        ws.send(JSON.stringify({ conn, seq, iv: b64url(iv), box: b64url(box) }));
      });
    },
    connect() {
      ws = new WebSocket(base + id + "/ws?role=editor");
      ws.onopen = () => relay.onOpen();
      ws.onmessage = (e) => enqueue(async () => {
        let body;
        try {
          const { conn: c, seq, iv, box } = JSON.parse(e.data);
          if (c !== conn || !Number.isSafeInteger(seq) || seq <= recvSeq || typeof iv !== "string" || typeof box !== "string") throw new Error("not for this page");
          body = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64url(iv), additionalData: aad("proxy", seq) }, await keyP, unb64url(box)));
          recvSeq = seq;
        } catch {
          console.warn("Dropped a message that could not be opened or was already seen");
          return;
        }
        await relay.onMessage(JSON.parse(body));
      });
      ws.onclose = (e) => relay.onClose(CLOSED[e.code] || "the connection closed");
      return relay;
    },
  };
  return relay;
};
