// CommandBridge network setup: one question per screen, then pairing and apply, live on the proxy through the relay.
// Nothing here writes anything: the proxy keeps the plan and applies it after /cb setup confirm in its console.

const LOGOS = { PAPER: "paper.svg", FOLIA: "folia.svg", VELOCITY: "velocity.svg", FORGE: "forge.svg", SPIGOT: "spigot.svg", BUKKIT: "spigot.svg", FABRIC: "fabric.png" };
const TLS = { TOFU: "first use", PLAIN: "off", STRICT: "strict" };
// these logos are drawn in white, so light mode turns them dark
const WHITE = new Set(["paper.svg", "velocity.svg"]);
const PLATFORM = { PAPER: "Paper", FOLIA: "Folia", BUKKIT: "Bukkit", SPIGOT: "Spigot", FORGE: "Forge", FABRIC: "Fabric", VELOCITY: "Velocity" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => (String(v).length > n ? String(v).slice(0, n - 1) + "…" : String(v));

function cbSetup() {
  return {
    status: "connecting", // connecting | online | closed | nolink
    slow: false,    // still connecting after a while
    closeReason: "",
    relay: null,
    current: null,
    known: [],      // servers from velocity.toml: { id, address, connected, platform }
    a: null,        // the answers
    step: "name",
    err: "",        // what's wrong with the answer on this screen
    problems: [],   // what the proxy said about the plan
    codes: {},
    paired: {},
    staged: null,
    applied: null,  // { restartNeeded, errors, configs }
    copied: "",
    newRow: null,   // { id, address } while adding a server
    waiting: false, // a plan was sent, the codes aren't back yet

    init() {
      const relay = window.cbRelay(location.hash);
      if (!relay) { this.status = "nolink"; return; }
      relay.onOpen = () => relay.send({ type: "hello" });
      relay.onMessage = (msg) => this.receive(msg);
      relay.onClose = (reason) => { this.status = "closed"; this.closeReason = reason; };
      this.relay = relay.connect();
      setTimeout(() => { this.slow = this.status === "connecting"; }, 8000);
    },

    closedText() {
      const r = this.closeReason.trim();
      return /new (one|link)/i.test(r) ? r : `${r ? r.replace(/\.?$/, ".") + " " : ""}Run /cb setup on your proxy for a new link.`;
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
        { k: "pairing", t: "Pairing", s: `${this.pairedCount()} of ${this.picked().length} paired` },
        { k: "apply", t: "Apply", s: this.applied ? "applied" : "" },
      ].filter(Boolean);
    },
    index() { return this.steps().findIndex((s) => s.k === this.step); },
    isDone(k) { return this.steps().findIndex((s) => s.k === k) < this.index(); },
    canGo(k) { return this.isDone(k) && !this.applied; },

    go(k) {
      if (!this.canGo(k)) return;
      if (this.step === "apply" && this.staged) this.relay.send({ type: "unstage" });
      this.err = "";
      this.step = k;
      this.focus();
    },

    back() {
      const st = this.steps(), i = this.index();
      if (i > 0) this.go(st[i - 1].k);
    },

    next() {
      if (this.status !== "online" || this.nextDisabled()) return;
      this.err = this.check();
      if (this.err) return;
      if (this.step === "servers") { this.sendPlan(); return; }
      const st = this.steps(), i = this.index();
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
        return left ? `Waiting for ${left} ${left === 1 ? "server" : "servers"}` : "Continue";
      }
      return "Continue";
    },

    // the same rules the proxy checks, so most mistakes show before the plan is sent
    check() {
      const a = this.a;
      if (this.step === "name" && !/^[a-z0-9-]{1,32}$/.test(a.serverId)) return "Use a to z, 0 to 9 and dashes, up to 32 characters.";
      if (this.step === "port" && !(a.port >= 1 && a.port <= 65535)) return "The port must be between 1 and 65535.";
      if (this.step === "address" && a.endpointType === "WEBSOCKET") {
        if (!a.address.trim()) return "Enter the address servers use to reach the proxy.";
        if (a.address.trim() === "0.0.0.0") return "Servers can't reach 0.0.0.0. Use the address they connect to.";
      }
      if (this.step === "address" && a.endpointType === "REDIS" && (!a.redis.host.trim() || !(a.redis.port >= 1 && a.redis.port <= 65535)))
        return "Enter the Redis host and a port between 1 and 65535.";
      if (this.step === "keystore" && !a.keystore.path.trim()) return "Enter the path of the keystore file.";
      if (this.step === "servers" && this.newRow && (this.newRow.id || this.newRow.address)) return this.addRow() || "";
      return "";
    },

    focus() {
      this.$nextTick(() => document.querySelector(`.q[data-step="${this.step}"]`)?.querySelector("input[type=text], input:checked")?.focus());
    },

    keydown(e) {
      if (e.key !== "Enter" || e.isComposing) return;
      if (e.target.matches("[data-f=new-id], [data-f=new-address]")) { e.preventDefault(); this.err = this.addRow(); return; }
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

    startRow() { this.newRow = { id: "", address: "" }; this.$nextTick(() => document.querySelector("[data-f=new-id]")?.focus()); },
    addRow() {
      const r = this.newRow;
      if (!r) return "";
      const id = r.id.trim(), address = r.address.trim();
      if (!id || !address) return "A new server needs a name and an address.";
      if (this.a.servers.some((s) => s.id === id)) return `There is already a server called ${id}.`;
      if (!/^[^\s:]+:\d{1,5}$/.test(address)) return "Write the address as host:port, like 10.0.0.13:25565.";
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

    later() {
      this.step = "apply";
      this.relay.send({ type: "stage" });
    },

    async copy(text) {
      await navigator.clipboard?.writeText(text).catch(() => {});
      this.copied = text;
      setTimeout(() => { if (this.copied === text) this.copied = ""; }, 1500);
    },

    download() {
      for (const [id, yml] of Object.entries(this.applied?.configs || {})) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([yml], { type: "text/yaml" }));
        link.download = `${id}-config.yml`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
    },

    /* ================= connection ================= */

    receive(msg) {
      if (msg.type === "state") {
        const first = !this.a;
        this.current = msg.current;
        this.known = msg.servers || [];
        this.codes = msg.codes || {};
        this.paired = msg.paired || {};
        this.staged = msg.staged || null;
        if (first) {
          this.a = this.answersFrom(msg);
          // a reload in the middle of the setup lands where it was
          this.step = msg.plan ? (msg.staged ? "apply" : "pairing") : "name";
          setInterval(() => this.relay.send({ type: "ping" }), 60_000);
        } else if (this.waiting) {
          this.waiting = false;
          this.step = "pairing";
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
      } else if (msg.type === "staged") {
        this.staged = msg.code;
      } else if (msg.type === "applied") {
        this.staged = null;
        this.applied = { restartNeeded: !!msg.restartNeeded, errors: msg.errors || [], configs: msg.configs || {} };
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

    /* ================= the network drawing ================= */

    // the proxy on top, the servers below; it fills in as questions are answered and outlines
    // what the current question is about
    diagram() {
      const a = this.a;
      if (!a) return "";
      const W = 440, step = this.step, past = (k) => this.index() > this.steps().findIndex((s) => s.k === k);
      const ws = a.endpointType === "WEBSOCKET";
      const where = ws ? (a.address.trim() ? `${a.address.trim()}:${a.port}` : `port ${a.port}`) : `Redis ${a.redis.host}:${a.redis.port}`;
      const hl = (on) => (on ? " hl" : "");
      const px = 90, pw = 260, py = 20, ph = 78;

      // servers: up to six, three to a row
      const all = a.servers.slice(0, 6), more = a.servers.length - all.length;
      const bw = 124, bh = 60, gap = 14;
      const placed = all.map((s, i) => {
        const row = Math.floor(i / 3), inRow = Math.min(3, all.length - row * 3), col = i % 3;
        const x0 = (W - (inRow * bw + (inRow - 1) * gap)) / 2;
        return { s, x: x0 + col * (bw + gap), y: 210 + row * (bh + 26) };
      });
      const H = placed.length ? placed.at(-1).y + bh + (more > 0 ? 30 : 6) : 200;
      let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your network">`;

      for (const { s, x, y } of placed) {
        if (!s.on) continue;
        const sx = x + bw / 2, my = py + ph, mid = (my + y) / 2;
        const solid = this.paired[s.id] || (s.connected && !past("servers"));
        out += `<path class="wire${solid ? "" : " dashed"}${hl(step === "pairing")}" data-id="${esc(s.id)}" d="M 220 ${my} C 220 ${mid}, ${sx} ${mid}, ${sx} ${y}"/>`;
      }
      out += `<circle class="port" cx="220" cy="${py + ph}" r="4"/>`;
      for (const { s, x, y } of placed) {
        const ok = this.paired[s.id] || (s.connected && !past("servers"));
        const state = this.paired[s.id] ? "paired" : past("servers") ? (this.codes[s.id] ? "waiting" : "not paired") : s.connected ? "connected" : clip(s.address, 17);
        out += `<g class="srv${s.on ? "" : " off"}${hl(step === "servers")}" data-id="${esc(s.id)}">` +
          `<rect class="box" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10"/><rect class="bar" x="${x}" y="${y + 14}" width="3" height="${bh - 28}" rx="1.5"/>` +
          `<image href="${this.logo(s)}" x="${x + 12}" y="${y + 12}" width="16" height="16" class="${this.logoClass(s)}"/>` +
          `<text class="t" x="${x + 34}" y="${y + 25}">${esc(clip(s.id, 11))}</text>` +
          `<text class="m${ok ? " ok" : ""}" x="${x + 12}" y="${y + 47}">${esc(state)}</text></g>`;
      }
      if (more > 0) out += `<text class="m" x="220" y="${H - 8}" text-anchor="middle">and ${more} more</text>`;

      out += `<g class="proxy"><rect class="box" x="${px}" y="${py}" width="${pw}" height="${ph}" rx="12"/><rect class="bar" x="${px}" y="${py + 16}" width="3" height="${ph - 32}" rx="1.5"/>` +
        `<image href="/lib/editor/logos/velocity.svg" x="${px + 16}" y="${py + 15}" width="18" height="18" class="white"/>` +
        `<text class="t${hl(step === "name")}" x="${px + 42}" y="${py + 29}">${esc(clip(a.serverId || "proxy", 22))}</text>` +
        `<text class="m${hl(["type", "port", "address"].includes(step))}" x="${px + 16}" y="${py + 58}">${esc(clip(where, 24))}</text>` +
        `<g class="lock${hl(step === "tls" || step === "keystore")}" transform="translate(${px + pw - 82} ${py + 47})">` +
        `<rect x="0" y="5" width="9" height="7" rx="1.5"/><path d="M2 5 V3 a2.5 2.5 0 0 1 5 0${a.tlsMode === "PLAIN" ? "" : " V5"}"/>` +
        `<text class="m" x="14" y="11.5">${TLS[a.tlsMode]}</text></g></g>`;
      return out + "</svg>";
    },
  };
}
