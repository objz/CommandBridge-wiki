// CommandBridge network setup: one question per screen, then pairing and apply, live on the proxy through the relay.
// Nothing here writes anything: the proxy keeps the plan and applies it after /cb setup confirm in its console.

const LOGOS = { PAPER: "paper.svg", FOLIA: "folia.svg", VELOCITY: "velocity.svg", FORGE: "forge.svg", SPIGOT: "spigot.svg", BUKKIT: "spigot.svg", FABRIC: "fabric.png" };
const TLS = { TOFU: "first use", PLAIN: "off", STRICT: "strict" };
// these logos are drawn in white, so light mode turns them dark
const WHITE = new Set(["paper.svg", "velocity.svg"]);
const PLATFORM = { PAPER: "Paper", FOLIA: "Folia", BUKKIT: "Bukkit", SPIGOT: "Spigot", FORGE: "Forge", FABRIC: "Fabric", VELOCITY: "Velocity" };

// what the proxy's codes look like (PairCrypto.java, SetupSession.java)
const PAIR_CODE = /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/;
const CONFIRM_CODE = /^[a-hj-np-z2-9]{6}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

// what's wrong with an address servers should connect to, or "" when it's an IP address or a hostname
function hostProblem(host) {
  const h = host.trim();
  if (!h) return "Enter the address.";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(h)) return `Leave out ${h.split("//")[0]}//, only the address.`;
  if (h === "0.0.0.0") return "Servers can't reach 0.0.0.0. Use the address they connect to.";
  if (/^\[?[0-9a-f]*:[0-9a-f:]*\]?$/i.test(h) && h.split(":").length > 2) return ""; // IPv6
  if (/:\d*$/.test(h)) return "Leave out the port, only the address.";
  if (/^[\d.]+$/.test(h)) return IPV4.test(h) ? "" : "That isn't a valid IP address. Each of the four parts goes from 0 to 255.";
  return HOSTNAME.test(h) ? "" : "That isn't a valid address. Use an IP like 203.0.113.7 or a name like play.example.net.";
}

// a server's host:port
function serverAddressProblem(address) {
  const a = address.trim(), colon = a.lastIndexOf(":");
  if (colon < 0) return "Write the address as host:port, like 10.0.0.13:25565.";
  const port = a.slice(colon + 1);
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) return "The port must be between 1 and 65535.";
  return hostProblem(a.slice(0, colon));
}

function cbSetup() {
  return {
    status: "connecting", // connecting | online | closed | nolink
    slow: false,    // still connecting after a while
    relay: null,
    current: null,
    known: [],      // servers from velocity.toml: { id, address, connected, platform }
    a: null,        // the answers
    step: "name",
    dir: 1,         // 1 going forward, -1 going back; picks the direction a screen slides in from
    err: "",        // what's wrong with the answer on this screen
    problems: [],   // what the proxy said about the plan
    codes: {},
    paired: {},
    staged: null,
    applied: null,  // { restartNeeded, errors }
    copied: "",
    newRow: null,   // { id, address } while adding a server
    waiting: false, // a plan was sent, the codes aren't back yet
    editorBusy: false,
    editorError: "",

    init() {
      const relay = window.cbRelay(window.cbLink());
      if (!relay) { this.status = "nolink"; return; }
      relay.onOpen = () => relay.send({ type: "hello" });
      relay.onMessage = (msg) => this.receive(msg);
      relay.onClose = () => { this.status = "closed"; };
      this.relay = relay.connect();
      setTimeout(() => { this.slow = this.status === "connecting"; }, 8000);
    },

    /* ================= steps ================= */

    steps() {
      if (!this.a) return [];
      const ws = this.a.endpointType === "WEBSOCKET";
      return [
        { k: "name", t: "Name", s: this.a.serverId },
        { k: "type", t: "Connection", s: ws ? "WebSocket" : "Redis" },
        ws && { k: "port", t: "Port", s: String(this.a.port) },
        { k: "address", t: ws ? "Address" : "Redis", s: ws ? this.a.address : `${this.a.redis.host}:${this.a.redis.port}` },
        { k: "tls", t: "Encryption", s: TLS[this.a.tlsMode] },
        this.a.tlsMode === "STRICT" && { k: "keystore", t: "Keystore", s: this.a.keystore.path },
        { k: "servers", t: "Servers", s: this.picked().map((s) => s.id).join(", ") || "none" },
        { k: "apply", t: "Apply", s: this.applied ? "applied" : "" },
        { k: "pairing", t: "Pairing", s: `${this.pairedCount()} of ${this.picked().length} paired` },
      ].filter(Boolean);
    },
    // "done" comes after every step
    index() { return this.step === "done" ? this.steps().length : this.steps().findIndex((s) => s.k === this.step); },
    isDone(k) { return this.steps().findIndex((s) => s.k === k) < this.index(); },
    canGo(k) { return this.isDone(k) && !this.applied; },

    go(k) {
      if (!this.canGo(k)) return;
      if (this.step === "apply" && this.staged) this.relay.send({ type: "unstage" });
      this.err = "";
      this.dir = this.steps().findIndex((s) => s.k === k) < this.index() ? -1 : 1;
      this.step = k;
      this.focus();
    },

    // the class that slides a screen in when it shows
    enter(k) { return this.step === k ? (this.dir < 0 ? "in-back" : "in-fwd") : ""; },

    back() {
      const st = this.steps(), i = this.index();
      if (i > 0) this.go(st[i - 1].k);
    },

    next() {
      if (this.status !== "online" || this.nextDisabled()) return;
      if (this.step === "servers" && this.newRow) {
        // an untouched extra row is just closed; a filled one is added first
        if (!this.newRow.id.trim()) this.newRow = null;
        else if ((this.err = this.addRow())) return;
      }
      this.err = this.check();
      if (this.err) return;
      if (this.step === "servers") { this.sendPlan(); return; }
      if (this.step === "pairing") { this.finish(); return; }
      const st = this.steps(), i = this.index();
      this.dir = 1;
      this.step = st[i + 1].k;
      if (this.step === "apply") this.relay.send({ type: "stage" });
      this.focus();
    },

    nextDisabled() {
      if (this.step === "pairing") return this.pairedCount() < this.picked().length;
      if (this.step === "servers") return this.waiting || !this.picked().length;
      return this.step === "apply";
    },

    nextLabel() {
      if (this.step === "servers") return this.waiting ? "Making codes…" : `Continue with ${this.picked().length} ${this.picked().length === 1 ? "server" : "servers"}`;
      if (this.step === "pairing") {
        const left = this.picked().length - this.pairedCount();
        return left ? `Waiting for ${left} ${left === 1 ? "server" : "servers"}` : "Finish";
      }
      return "Continue";
    },

    // the same rules the proxy checks, so most mistakes show before the plan is sent
    check() {
      const a = this.a;
      if (this.step === "name" && !/^[a-z0-9-]{1,32}$/.test(a.serverId)) return "Use a to z, 0 to 9 and dashes, up to 32 characters.";
      if (this.step === "port" && !(a.port >= 1 && a.port <= 65535)) return "The port must be between 1 and 65535.";
      if (this.step === "address" && a.endpointType === "WEBSOCKET") return hostProblem(a.address);
      if (this.step === "address" && a.endpointType === "REDIS")
        return hostProblem(a.redis.host) || (a.redis.port >= 1 && a.redis.port <= 65535 ? "" : "The Redis port must be between 1 and 65535.");
      if (this.step === "keystore" && !a.keystore.path.trim()) return "Enter the path of the keystore file.";
      return "";
    },

    focus() {
      this.$nextTick(() => document.querySelector(`.q[data-step="${this.step}"]`)?.querySelector("input[type=text], input:checked")?.focus());
    },

    keydown(e) {
      if (e.key !== "Enter" || e.isComposing) return;
      // Enter anywhere on the page continues, except on the site's own links and buttons
      if (e.target !== document.body && !e.target.closest(".su")) return;
      if (e.target.matches("[data-f=new-id], [data-f=new-address]")) {
        e.preventDefault();
        this.err = this.addRow();
        if (!this.err) this.startRow(); // straight on to the next one
        return;
      }
      if (e.target.closest("button")) return;
      e.preventDefault();
      this.next();
    },

    /* ================= servers ================= */

    picked() { return this.a ? this.a.servers.filter((s) => s.on) : []; },
    pairedCount() { return this.picked().filter((s) => this.paired[s.id]).length; },
    platformOf(s) { return this.paired[s.id]?.platform || s.platform; },
    logo(s) { return "/lib/editor/logos/" + (LOGOS[this.platformOf(s)] || "paper.svg"); },
    logoClass(s) { return [WHITE.has(this.logo(s).split("/").pop()) && "white", !this.platformOf(s) && "unknown"].filter(Boolean).join(" "); },
    software(s) {
      const p = this.paired[s.id];
      return p ? [PLATFORM[p.platform] || p.platform, p.version].filter(Boolean).join(" ") : "";
    },
    added() { return this.picked().filter((s) => s.isNew); },

    // a new server most likely runs where the proxy does, on the port after the highest one in use
    suggestedAddress() {
      const a = this.a;
      const host = a.endpointType === "WEBSOCKET" && !hostProblem(a.address) ? a.address.trim() : a.servers[0]?.address.replace(/:\d+$/, "") || "127.0.0.1";
      const ports = a.servers.map((s) => +s.address.split(":").pop()).filter((n) => n > 0 && n < 65535);
      return `${host}:${ports.length ? Math.max(...ports) + 1 : 25566}`;
    },
    startRow() {
      this.newRow = { id: "", address: this.suggestedAddress() };
      this.$nextTick(() => document.querySelector("[data-f=new-id]")?.focus());
    },
    addRow() {
      const r = this.newRow;
      if (!r) return "";
      const id = r.id.trim(), address = r.address.trim();
      if (!id) return "Give the new server a name, the same one it has in velocity.toml.";
      if (!/^[A-Za-z0-9._-]{1,32}$/.test(id)) return "A server name can use letters, digits, dots, dashes and underscores.";
      if (this.a.servers.some((s) => s.id === id)) return `There is already a server called ${id}.`;
      const problem = serverAddressProblem(address);
      if (problem) return problem;
      this.a.servers.push({ id, address, on: true, isNew: true, platform: null });
      this.newRow = null;
      return "";
    },
    removeRow(s) { this.a.servers = this.a.servers.filter((x) => x !== s); },

    // a different connection means every server pairs again
    connectionChanged() {
      const a = this.a, c = this.current;
      return a.endpointType !== c.endpointType || a.tlsMode !== c.tlsMode || (a.endpointType === "WEBSOCKET" && a.port !== c.port);
    },

    /* ================= plan, pairing, apply ================= */

    planJson() {
      const a = this.a, ws = a.endpointType === "WEBSOCKET";
      return {
        serverId: a.serverId.trim(),
        endpointType: a.endpointType,
        port: Number(a.port),
        address: ws ? a.address.trim() : "",
        redis: ws ? null : { host: a.redis.host.trim(), port: Number(a.redis.port), username: a.redis.username, password: a.redis.password || null },
        tlsMode: a.tlsMode,
        keystore: a.tlsMode === "STRICT" ? { path: a.keystore.path.trim(), type: a.keystore.type, password: a.keystore.password || null } : null,
        servers: this.picked().map((s) => ({ id: s.id, address: s.address, addToVelocity: !!s.isNew })),
      };
    },

    sendPlan() {
      this.problems = [];
      this.waiting = true;
      this.relay.send({ type: "plan", plan: this.planJson() });
    },

    unpaired() { return this.picked().filter((s) => !this.paired[s.id]); },

    // the setup is over; the proxy closes it for any page that comes back to this link
    finish() {
      this.dir = 1;
      this.step = "done";
      this.relay.send({ type: "finish" });
    },

    // the proxy opens an editor session and sends back its link
    openEditor() {
      this.editorBusy = true;
      this.editorError = "";
      this.relay.send({ type: "editor" });
    },

    copy(text) {
      navigator.clipboard?.writeText(text).catch((e) => console.warn("Copy failed:", e.message));
      this.copied = text;
      setTimeout(() => { if (this.copied === text) this.copied = ""; }, 1500);
    },

    /* ================= connection ================= */

    receive(msg) {
      if (msg.type === "state") {
        const first = !this.a;
        this.current = msg.current;
        this.known = msg.servers || [];
        // codes end up in a console, so anything that isn't exactly a code is left out
        this.codes = Object.fromEntries(Object.entries(msg.codes || {}).filter(([, c]) => PAIR_CODE.test(c)));
        this.paired = msg.paired || {};
        this.staged = CONFIRM_CODE.test(msg.staged || "") ? msg.staged : null;
        if (first) {
          this.a = this.answersFrom(msg);
          // a reload in the middle of the setup lands where it was
          if (msg.applied) this.applied = this.applied || { restartNeeded: false, errors: [] };
          this.step = msg.applied ? "pairing" : msg.plan ? "apply" : "name";
          if (this.step === "apply" && !this.staged) this.relay.send({ type: "stage" });
          setInterval(() => this.relay.send({ type: "ping" }), 60_000);
        } else if (this.waiting) {
          this.waiting = false;
          this.dir = 1;
          this.step = "apply";
          this.relay.send({ type: "stage" });
        }
        this.status = "online";
        this.focus();
      } else if (msg.type === "plan-error") {
        this.waiting = false;
        if (this.step === "apply") this.step = "servers";
        this.problems = msg.problems || [];
      } else if (msg.type === "paired") {
        this.paired = { ...this.paired, [msg.id]: { platform: msg.platform, version: msg.version } };
        delete this.codes[msg.id];
      } else if (msg.type === "editor") {
        // only ever to this site's editor, whatever the message says
        let url;
        try { url = new URL(msg.url, location.href); } catch { url = null; }
        if (url && url.origin === location.origin && url.pathname === "/editor/" && /^#[0-9a-f]{32}:[A-Za-z0-9_-]{43}$/.test(url.hash)) location.href = url.href;
        else { this.editorBusy = false; this.editorError = "The proxy sent a link that isn't the editor's. Run /cb editor instead."; }
      } else if (msg.type === "editor-error") {
        this.editorBusy = false;
        this.editorError = `The proxy couldn't open the editor: ${msg.error}. Run /cb editor instead.`;
      } else if (msg.type === "staged") {
        this.staged = CONFIRM_CODE.test(msg.code || "") ? msg.code : null;
      } else if (msg.type === "applied") {
        this.staged = null;
        this.applied = { restartNeeded: !!msg.restartNeeded, errors: (msg.errors || []).map(String) };
        this.dir = 1;
        this.step = "pairing";
      }
    },

    answersFrom(msg) {
      const c = msg.current, p = msg.plan;
      const fromToml = (msg.servers || []).map((s) => ({ id: s.id, address: s.address, on: true, isNew: false, platform: s.platform, connected: s.connected }));
      const servers = p
        ? [...fromToml.map((s) => ({ ...s, on: p.servers.some((x) => x.id === s.id) })),
           ...p.servers.filter((x) => x.addToVelocity).map((x) => ({ id: x.id, address: x.address, on: true, isNew: true, platform: null }))]
        : fromToml;
      // a guess for the address: the bind host when it's one servers can reach
      const guess = msg.saved?.address || (/^(0\.0\.0\.0|127\.|localhost|::)/.test(c.bindHost || "") ? "" : c.bindHost || "");
      return {
        serverId: p?.serverId ?? c.serverId,
        endpointType: p?.endpointType ?? c.endpointType,
        port: p?.port || c.port,
        address: p?.address ?? guess,
        redis: { host: p?.redis?.host ?? c.redis.host, port: p?.redis?.port ?? c.redis.port, username: p?.redis?.username ?? c.redis.username, password: "" },
        tlsMode: p?.tlsMode ?? c.tlsMode,
        keystore: { path: p?.keystore?.path ?? c.keystore.path, type: p?.keystore?.type ?? (c.keystore.type || "PKCS12"), password: "" },
        servers,
      };
    },
  };
}
