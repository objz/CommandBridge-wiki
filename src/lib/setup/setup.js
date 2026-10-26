// CommandBridge network setup: one question per screen, then pairing and apply, live on the proxy through the relay.
// Nothing here writes anything: the proxy keeps the plan and applies it after /cb setup confirm in its console.

const LOGOS = { PAPER: "paper.svg", FOLIA: "folia.svg", VELOCITY: "velocity.svg", FORGE: "forge.svg", SPIGOT: "spigot.svg", BUKKIT: "spigot.svg", FABRIC: "fabric.png" };
const TLS = { TOFU: "first use", PLAIN: "off", STRICT: "strict" };
const PLATFORM = { PAPER: "Paper", FOLIA: "Folia", BUKKIT: "Bukkit", SPIGOT: "Spigot", FORGE: "Forge", FABRIC: "Fabric", VELOCITY: "Velocity" };

function cbSetup() {
  return {
    status: "connecting", // connecting | online | closed | nolink
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
    wires: [],

    init() {
      const relay = window.cbRelay(location.hash);
      if (!relay) { this.status = "nolink"; return; }
      relay.onOpen = () => relay.send({ type: "hello" });
      relay.onMessage = (msg) => this.receive(msg);
      relay.onClose = (reason) => { this.status = "closed"; this.closeReason = reason; };
      this.relay = relay.connect();
      window.addEventListener("resize", () => this.layoutWires());
    },

    statusText() {
      return { connecting: "Connecting…", closed: "Session ended: " + this.closeReason }[this.status] ?? "";
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

    go(k) {
      if (!this.isDone(k) || this.step === "apply" && this.applied) return;
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
      if (this.step === "apply") return this.applied ? "Applied" : "Waiting for confirm";
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
      this.$nextTick(() => {
        const q = document.querySelector(`#ed-canvas [data-step="${this.step}"]`);
        q?.querySelector("input[type=text], input:checked")?.focus();
        this.layoutWires();
      });
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
    logo(s) {
      const p = this.paired[s.id]?.platform || s.platform;
      return "/lib/editor/logos/" + (LOGOS[p] || "paper.svg");
    },
    hasLogo(s) { return !!LOGOS[this.paired[s.id]?.platform || s.platform]; },
    software(s) {
      const p = this.paired[s.id];
      if (!p) return "run in its console";
      return [PLATFORM[p.platform] || p.platform, p.version].filter(Boolean).join(" ") || "paired";
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
        this.$nextTick(() => this.layoutWires());
      } else if (msg.type === "staged") {
        this.staged = msg.code;
      } else if (msg.type === "applied") {
        this.staged = null;
        this.applied = { restartNeeded: !!msg.restartNeeded, errors: msg.errors || [], configs: msg.configs || {} };
      }
    },

    answersFrom(msg) {
      const c = msg.current, p = msg.plan;
      const fromToml = (msg.servers || []).map((s) => ({ id: s.id, address: s.address, on: true, isNew: false, platform: s.platform }));
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

    /* ================= the network drawing on the pairing screen ================= */

    // <template> doesn't work inside <svg>, so the paths are written out
    wiresSvg() {
      const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      return this.wires.map((w) => `<path class="pair-wire${this.paired[w.id] ? "" : " dashed"}" data-id="${esc(w.id)}" d="${w.d}"></path>`).join("");
    },

    layoutWires() {
      if (this.step !== "pairing") return;
      // measured a frame later, once the pairing screen is shown and laid out
      this.$nextTick(() => requestAnimationFrame(() => {
        const canvas = document.getElementById("ed-canvas"), proxy = canvas?.querySelector(".pair-proxy");
        if (!proxy) return;
        const box = canvas.getBoundingClientRect(), pr = proxy.getBoundingClientRect();
        const dx = canvas.scrollLeft - box.left, dy = canvas.scrollTop - box.top;
        const x1 = pr.left + dx, y1 = pr.top + dy + 57;
        this.wires = [...canvas.querySelectorAll(".pair-node")].map((n) => {
          const r = n.getBoundingClientRect(), x0 = r.right + dx, y0 = r.top + dy + 57, mid = (x0 + x1) / 2;
          return { id: n.dataset.id, d: `M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}` };
        });
      }));
    },
  };
}
