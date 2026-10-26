// CommandBridge script editor: every script as a node graph, live on the proxy through the relay.
// The YAML side lives in script-yaml.js; positions and groups go to the proxy's editor-layout.json.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const splitList = (v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const isZero = (v) => v != null && /^\s*0+(\.0+)?\s*(ms|s|m|h)?\s*$/i.test(String(v));

// the same rules the proxy validates with, checked while typing
const RULES = {
  name: [/^[a-z][a-z0-9-]{2,32}$/, "3 to 33 lowercase letters, digits or -, starting with a letter"],
  argname: [/^[A-Za-z][A-Za-z0-9_-]*$/, "letters, digits, _ or -, starting with a letter"],
  duration: [/^\s*\d+(\.\d+)?\s*(ms|s|m|h)?\s*$/i, "a duration like 500ms, 5s, 1m or 1h"],
  // CB itself doesn't limit alias length (and short ones like /ft work), so only the characters are checked
  alias: [/^[a-z][a-z0-9-]{0,32}$/, "lowercase letters, digits or -, starting with a letter"],
  suggestions: [/^\s*([a-z0-9._+\-]+\s*(,\s*[a-z0-9._+\-]+\s*)*)?$/, "words of lowercase letters, digits and . _ + -, separated by commas"],
  serverid: [/^\S+$/, "a server id without spaces"],
};
const PLAYER_TYPES = ["STRING", "PLAYERS", "OFFLINE_PLAYER"]; // what CB can resolve to a player
const RUN_AS = ["CONSOLE", "PLAYER", "OPERATOR"];
const PLACEHOLDER = /\$\{([^}]*)\}/g;

// Ports per node type: [label, type]. A wire only joins ports of the same type, shape and color.
// Only text and switches live inside nodes; everything else is a node of its own, wired in.
const PORTS = {
  command: { in: [["aliases", "alias"], ["arguments", "arg"], ["registered on", "srv"], ["defaults", "def"], ["called by", "call"]], out: [["then", "flow"]] },
  run: { in: [["after", "flow"], ["targets", "srv"], ["run as", "runas"], ["cooldown", "cool"], ["server rules", "rules"]], out: [["then", "flow"], ["calls", "call"]] },
  wait: { in: [["after", "flow"]], out: [["then", "flow"]] },
  arg: { in: [], out: [["argument", "arg"]] },
  server: { in: [], out: [["server", "srv"]] },
  alias: { in: [], out: [["aliases", "alias"]] },
  defaults: { in: [["targets", "srv"]], out: [["defaults", "def"]] },
  runas: { in: [], out: [["run as", "runas"]] },
  cooldown: { in: [], out: [["cooldown", "cool"]] },
  rules: { in: [], out: [["server rules", "rules"]] },
};
// port classes by name, so the code says what it wires
const P = {
  cmd: { aliases: "input_1", args: "input_2", reg: "input_3", defaults: "input_4", calledBy: "input_5", then: "output_1" },
  run: { after: "input_1", targets: "input_2", runas: "input_3", cooldown: "input_4", rules: "input_5", then: "output_1", calls: "output_2" },
  def: { targets: "input_1" },
};
const REQUIRED_PORTS = { command: ["registered on", "defaults", "then"] };
const TITLES = { command: "Command", run: "Execute", wait: "Wait", arg: "Argument", server: "Server", alias: "Aliases", defaults: "Defaults", runas: "Run as", cooldown: "Cooldown", rules: "Server rules" };
const svg = (inner, size = 15) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  command: svg('<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2"/>'),
  run: svg('<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>'),
  wait: svg('<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>'),
  arg: svg('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'),
  server: svg('<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>'),
  alias: svg('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
  defaults: svg('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
  runas: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  cooldown: svg('<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'),
  rules: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
};
const GRIP = `<span class="grip" title="Drag to move" aria-hidden="true">${svg('<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>', 16)}</span>`;
// a proxy and a backend look different wherever servers are listed
const SRV_ICONS = {
  BACKEND: svg('<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>'),
  VELOCITY: svg('<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>'),
};
const RUN_AS_ICONS = {
  CONSOLE: svg('<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>'),
  PLAYER: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  OPERATOR: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
};
// Lucide icons used beyond the node icons (lucide.dev, ISC licence)
const LUCIDE = {
  "type": '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  "text": '<path d="M15 18H3"/><path d="M17 6H3"/><path d="M21 12H3"/>',
  "wrap-text": '<line x1="3" x2="21" y1="6" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" x2="10" y1="18" y2="18"/>',
  "hash": '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  "sigma": '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
  "move-horizontal": '<path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/>',
  "toggle-left": '<circle cx="9" cy="12" r="3"/><rect width="20" height="14" x="2" y="5" rx="7"/>',
  "clock-3": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/>',
  "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  "user-round-x": '<path d="M2 21a8 8 0 0 1 11.873-7"/><circle cx="10" cy="8" r="5"/><path d="m17 17 5 5"/><path d="m22 17-5 5"/>',
  "paw-print": '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  "shapes": '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  "globe": '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  "map-pin": '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  "map": '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  "compass": '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
  "rotate-3d": '<path d="M16.466 7.5C15.643 4.237 13.952 2 12 2 9.239 2 7 6.477 7 12s2.239 10 5 10c.342 0 .677-.069 1-.2"/><path d="m15.194 13.707 3.814 1.86-1.86 3.814"/><path d="M19 15.57c-1.804.885-4.274 1.43-7 1.43-5.523 0-10-2.239-10-5s4.477-5 10-5c4.838 0 8.873 1.718 9.8 4"/>',
  "trees": '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
  "package": '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  "sparkles": '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  "flask-conical": '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  "volume-2": '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  "server": '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  "power-off": '<path d="M18.36 6.64A9 9 0 0 1 20.77 15"/><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/><path d="M12 2v4"/><path d="m2 2 20 20"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  "file": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'
};
const TYPE_ICONS = { STRING: "type", TEXT: "text", GREEDY_STRING: "wrap-text", INTEGER: "hash", DOUBLE: "sigma", RANGE: "move-horizontal", BOOLEAN: "toggle-left",
  TIME: "clock-3", PLAYERS: "users", OFFLINE_PLAYER: "user-round-x", ENTITIES: "paw-print", ENTITY_TYPE: "shapes", WORLD: "globe", LOCATION: "map-pin",
  LOCATION_2D: "map", ANGLE: "compass", ROTATION: "rotate-3d", BIOME: "trees", ITEM_STACK: "package", ENCHANTMENT: "sparkles", POTION_EFFECT: "flask-conical",
  SOUND: "volume-2", SERVER: "server" };
const typeIcon = (t) => svg(LUCIDE[TYPE_ICONS[t]] || LUCIDE.type);
// what a script file may contain, for linting and completing the YAML panel (mirrors the proxy's Script records)
const Y = {
  bool: { type: "bool" }, str: { type: "str" }, dur: { type: "dur" }, int: { type: "int" }, server: { type: "server" },
  enum: (values) => ({ type: "enum", values }),
  map: (keys, required = []) => ({ type: "map", keys, required }),
  list: (of) => ({ type: "list", of }),
};
const Y_TARGETS = Y.list(Y.map({ id: Y.server, location: Y.enum(["VELOCITY", "BACKEND"]) }, ["id", "location"]));
const Y_RULES = Y.map({ "target-required": Y.bool, "schedule-online": Y.bool, "player-arg": { type: "arg" } });
const Y_SCRIPT = Y.map({
  version: Y.int, name: { type: "name" }, enabled: Y.bool, description: Y.str, aliases: Y.list(Y.str),
  permissions: Y.map({ enabled: Y.bool, silent: Y.bool }),
  register: Y_TARGETS,
  defaults: Y.map({ "run-as": Y.enum(RUN_AS), execute: Y_TARGETS, server: Y_RULES, delay: Y.dur, cooldown: Y.dur }),
  args: Y.list(Y.map({ name: Y.str, required: Y.bool, type: { type: "enum", values: null }, suggestions: Y.list(Y.str) }, ["name"])),
  commands: Y.list(Y.map({ command: Y.str, "run-as": Y.enum(RUN_AS), execute: Y_TARGETS, server: Y_RULES, delay: Y.dur, cooldown: Y.dur }, ["command"])),
}, ["version", "name", "permissions", "register", "defaults", "args", "commands"]);
const Y_HINTS = { bool: "true / false", enum: "one of", dur: "duration", int: "number", str: "text", server: "server id", arg: "argument", name: "name", map: "section", list: "list" };

// argument types by family, for the type menu
const ARG_FAMILIES = [
  ["Text", ["STRING", "TEXT", "GREEDY_STRING"]],
  ["Numbers", ["INTEGER", "DOUBLE", "RANGE", "BOOLEAN", "TIME"]],
  ["Players and entities", ["PLAYERS", "OFFLINE_PLAYER", "ENTITIES", "ENTITY_TYPE"]],
  ["World", ["WORLD", "LOCATION", "LOCATION_2D", "ANGLE", "ROTATION", "BIOME"]],
  ["Items and effects", ["ITEM_STACK", "ENCHANTMENT", "POTION_EFFECT", "SOUND"]],
  ["Network", ["SERVER"]],
];
// the software a server runs, by its real logo; Bukkit servers are shown as Spigot, which nearly all of them are
const logo = (file) => `<img class="logo" src="/lib/editor/logos/${file}" alt="" draggable="false">`;
Object.assign(SRV_ICONS, {
  VELOCITY: logo("velocity.svg"), PAPER: logo("paper.svg"), FOLIA: logo("folia.svg"), BUKKIT: logo("spigot.svg"), FORGE: logo("forge.svg"), FABRIC: logo("fabric.png"),
});
const srvIcon = (loc, platform) => SRV_ICONS[platform] || SRV_ICONS[loc];
const srvKind = (loc, platform) => (SRV_ICONS[platform] && platform !== "VELOCITY" ? platform.toLowerCase() : loc === "VELOCITY" ? "proxy" : "backend");
const SRV_COLORS = { BACKEND: "#f59e0b", VELOCITY: "#60a5fa" };
const MINIMAP_COLORS = { command: "#8b5cf6", run: "#22c55e", wait: "#64748b", arg: "#38bdf8", server: "#f59e0b", alias: "#ec4899", defaults: "#14b8a6", runas: "#eab308", cooldown: "#94a3b8", rules: "#f97316" };
const GROUP_COLORS = ["#8b5cf6", "#22c55e", "#38bdf8", "#f59e0b", "#ef4444", "#94a3b8"];
const kindOf = (node) => node.class.replace("cb-", "");
const portType = (kind, side, port) => PORTS[kind][side][Number(port.split("_")[1]) - 1]?.[1];
const portLabel = (kind, side, port) => PORTS[kind][side][Number(port.split("_")[1]) - 1]?.[0];

/* ---------------- fields inside nodes: text and switches only ---------------- */

const row = (label, control, req = false) => `<div class="fr"><span class="fl">${label}${req ? '<i class="req" title="required">*</i>' : ""}</span><div class="fc">${control}</div></div>`;
const text = (f, v, ph, rule = "", extra = "") => `<input type="text" data-f="${f}" value="${esc(v)}" placeholder="${esc(ph)}"${rule ? ` data-rule="${rule}"` : ""}${extra}>`;
const toggle = (f, on, label) => `<label class="sw"><input type="checkbox" role="switch" data-f="${f}"${on ? " checked" : ""} aria-label="${esc(label)}"><span></span></label>`;
const duration = (f, v, ph, req = false) => text(f, v, ph, "duration", req ? ' data-req="1"' : "");
let segId = 0;
const seg = (f, options, current) => { const name = "seg" + ++segId;
  return `<div class="seg" role="radiogroup" style="--n:${options.length}"><i class="seg-thumb" aria-hidden="true"></i>${options.map(([v, label]) => `<label><input type="radio" name="${name}" data-f="${f}" value="${v}"${v === current ? " checked" : ""}><span>${label}</span></label>`).join("")}</div>`; };
const RUN_AS_SEG = RUN_AS.map((r) => [r, r.toLowerCase()]);
// a dropdown in the editor's own menu style; the value lives in data-v
const CHEVRON = svg('<path d="m6 9 6 6 6-6"/>', 14);
const pick = (f, kind, v, label, icon) => `<button type="button" class="pick" data-f="${f}" data-pick="${kind}" data-v="${esc(v)}"><i class="pi">${icon}</i><span>${esc(label)}</span>${CHEVRON}</button>`;
// whose server target-required and schedule-online look at: the sender, or a player given as an argument
const playerPick = (f, v) => pick(f, "player", v, v || "who ran it", v ? svg(LUCIDE.users) : RUN_AS_ICONS.PLAYER);
const PLAYER_TIP = "Target required and schedule online look at this player's server. Normally that's the player who ran the command; pick an argument to use the player it names instead.";
// one alias: a row of the list, edited in place
const tag = (a) => `<div class="tag" data-v="${esc(a)}"><i>/</i><input type="text" class="al-in" value="${esc(a)}" data-rule="alias" aria-label="Alias" autocomplete="off" spellcheck="false"><button type="button" class="tag-x" aria-label="Remove /${esc(a)}">${svg(LUCIDE["trash-2"], 14)}</button></div>`;
// a placeholder inside the command text: one piece that is moved or removed as a whole
// a placeholder inside the command text: one piece, dragged to move it or out to remove it
const ph = (name) => `<span class="ph" contenteditable="false" data-arg="${esc(name)}">${esc(name)}</span>`;
const textHtml = (t) => String(t ?? "").split(/(\$\{[^}]*\})/).map((part) => (/^\$\{[^}]*\}$/.test(part) ? ph(part.slice(2, -1)) : esc(part))).join("");
// a step that calls another script shows the called name as a fixed piece; the rest are its arguments
const CALL_ICON = svg('<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>', 13);
const cmdHtml = (t, calling = false) => {
  const m = calling && String(t ?? "").match(/^(\S+)(.*)$/s);
  return m ? `<span class="callw" contenteditable="false" data-word="${esc(m[1])}">${CALL_ICON}/${esc(m[1].replace(/^\//, ""))}</span>${textHtml(m[2])}` : textHtml(t);
};

function nodeBody(kind, v) {
  if (kind === "command") {
    return `<div class="sec">
        ${row("name", `<div class="slashed"><span>/</span>${text("name", v.name, "my-command", "name", ' data-req="1"')}</div>`, true)}
        ${row("description", `<textarea data-f="description" rows="1" placeholder="What it does, shown in /help">${esc(v.description)}</textarea>`)}
        ${row("needs permission", toggle("perm", v.perm !== "false", "needs permission"))}
        ${row("silent denial", toggle("silent", v.silent === "true", "silent denial"))}
      </div>`;
  }
  if (kind === "run") {
    return `<div class="sec"><div class="cmd" contenteditable="true" spellcheck="false" role="textbox" aria-label="Command to execute" data-f="command" data-placeholder="say hello">${cmdHtml(v.command)}</div><div class="args"></div></div>`;
  }
  if (kind === "wait") return `<div class="sec">${row("for", duration("delay", v.delay ?? "1s", "1s", true), true)}</div>`;
  if (kind === "arg") {
    return `<div class="sec">
        ${row("name", text("name", v.name, "player", "argname", ' data-req="1"'), true)}
        ${row("type", pick("type", "type", v.type || "STRING", v.type || "STRING", typeIcon(v.type || "STRING")))}
        ${row("required", toggle("required", v.required === "true", "required"))}
        ${row("suggestions", text("suggestions", v.suggestions, "steve, alex", "suggestions"))}
      </div>`;
  }
  if (kind === "server") {
    // fixed once added: a different server is a different node, picked from the menu
    return `<div class="srv"><input type="hidden" data-f="id" value="${esc(v.id)}"><input type="hidden" data-f="location" value="${srvLoc(v)}"></div>`;
  }
  if (kind === "alias") {
    // a list of names, then a field like the command's name to add one more
    const list = splitList(v.aliases);
    return `<div class="sec"><div class="al-list"><div class="als">${list.map(tag).join("")}</div><div class="al-new"><i>+</i><input type="text" class="tag-in" placeholder="add alias" aria-label="Add alias" autocomplete="off" spellcheck="false"></div></div><input type="hidden" data-f="aliases" value="${esc(list.join(","))}"></div>`;
  }
  if (kind === "defaults") {
    return `<div class="sec">
        ${row("run as", seg("d-runas", RUN_AS_SEG, v["d-runas"] || "CONSOLE"))}
        ${row("delay", duration("d-delay", v["d-delay"], "none"))}
        ${row("cooldown", duration("d-cooldown", v["d-cooldown"], "none"))}
        ${row("target required", toggle("d-target", v["d-target"] === "true", "target required"))}
        ${row("schedule online", toggle("d-online", v["d-online"] === "true", "schedule online"))}
        ${row(`<span data-tip="${PLAYER_TIP}">checks player</span>`, playerPick("d-player", v["d-player"]))}
      </div>`;
  }
  if (kind === "runas") return `<div class="sec">${seg("value", RUN_AS_SEG, v.value || "CONSOLE")}</div>`;
  if (kind === "cooldown") return `<div class="sec">${row("for", duration("cooldown", v.cooldown, "10s", true), true)}</div>`;
  return `<div class="sec">
      ${row("target required", toggle("r-target", v["r-target"] === "true", "target required"))}
      ${row("schedule online", toggle("r-online", v["r-online"] === "true", "schedule online"))}
      ${row(`<span data-tip="${PLAYER_TIP}">checks player</span>`, playerPick("r-player", v["r-player"]))}
    </div>`;
}

const srvLoc = (v) => (v.location === "VELOCITY" ? "VELOCITY" : "BACKEND");

function nodeHtml(kind, v) {
  const ports = PORTS[kind];
  let rows = "";
  const req = REQUIRED_PORTS[kind] || [];
  for (let i = 0; i < Math.max(ports.in.length, ports.out.length); i++) {
    const cell = (p) => (p ? `<span data-port="${esc(p[0])}">${p[0]}${req.includes(p[0]) ? '<i class="req" title="required">*</i>' : ""}</span>` : "<span></span>");
    const left = kind === "server" ? `<span class="srv-k">${srvLoc(v) === "VELOCITY" ? "proxy" : "backend"}</span>` : cell(ports.in[i]);
    rows += `<div class="pr">${left}${cell(ports.out[i])}</div>`;
  }
  const title = kind === "command" ? `<span class="nk">/<b class="nh-name">${esc(v.name || "")}</b></span>`
    : kind === "server" ? `<span class="nk">${esc(v.id)}</span>` : `<span class="nk">${TITLES[kind]}</span>`;
  const enabled = kind === "command" ? `<span class="nh-on" title="Enabled">${toggle("enabled", v.enabled !== "false", "enabled")}</span>` : "";
  const icon = kind === "server" ? SRV_ICONS[srvLoc(v)] : ICONS[kind];
  return `<div class="nh">${GRIP}${icon}${title}${enabled}</div>${rows ? `<div class="np">${rows}</div>` : ""}${nodeBody(kind, v)}`;
}

function cbEditor() {
  // kept out of Alpine's reactive data: proxies around Drawflow and ES modules break them
  let df, YAML, conv, building = false, syncingCalls = false, restoring = false;
  const meta = new Map(); // node id -> { file, version } for commands, { src } for args and steps loaded from a file
  let owner = new Map();   // node id -> the first command node that uses it, recomputed on every refresh
  let owners = new Map();  // node id -> every command node that uses it
  let groups = [];         // { id, title, color, x, y, w, h, members: [script ids, see sidOf], auto } in canvas coordinates
  let layout = { nodes: {}, groups: [] };
  const LAYOUT_VERSION = 3; // older layouts used other node types or one Server node per id; their nodes are laid out fresh
  const selected = new Set();
  const history = { past: [], future: [], last: null, timer: null, pending: false };
  let layoutTimer = null, lastLayout = "";
  let wiring = null; // { from, port, x, y, made } while a wire is dragged
  let wireShown = null; // the wire the delete button belongs to
  const aim = { p0: null, p1: null, t: 0, timer: null }; // pointer trail for submenus' safe triangle
  let clipboard = null; // { nodes, edges } copied with Ctrl+C
  const bases = {}; // file -> YAML text edited in the panel, the base its YAML is written onto
  let staged = null; // the change set waiting on the proxy for /cb editor confirm, as JSON
  let draftTimer = null, lastDraft = "";
  let yamlTimer = null;
  let lint = { text: null }, yamlCellSize = null;
  let insertAt = null; // { from, to, out, inp, wire } a dragged step would be dropped into
  let mouse = null; // last pointer position over the canvas, where Ctrl+V pastes

  return {
    status: "connecting",
    closeReason: "",
    scripts: {},
    servers: {},
    loadedFiles: [],
    out: {},
    deletions: [],
    problems: [],
    results: [],
    showYaml: false,
    showWarnings: false,
    showMinimap: true,
    selectedFile: null,
    selectionSize: 0,
    zoom: 100,
    canUndo: false,
    canRedo: false,
    busy: false,
    tip: null,       // { text, x, y, right, err } for the hover tooltip
    yamlPick: null,  // the file chosen in the YAML panel
    confirmCode: null, // the code to run /cb editor confirm with, once Save staged the changes
    copied: false,
    yamlDraft: null, // { file, text } being typed in the YAML panel
    yamlError: "",
    yamlSugg: null,  // { items, sel, x, y, from, to } completion popup at the caret
    yamlLine: -1,    // the caret's line, for the message of a problem on it
    pop: null,       // { x, y, title, items: [{ label, hint, kind, keys, run, sub }] } for port and context menus
    tool: "select",  // left-drag on the canvas: "select" draws a selection box, "grab" pans
    wireX: null,     // { x, y } of the delete button on a selected wire
    relay: null,
    justSaved: [],
    deferred: false,
    removingNodes: false,
    dragId: 0,

    async init() {
      const relay = window.cbRelay(window.cbLink());
      if (!relay) { this.status = "nolink"; return; }
      [YAML, conv] = await Promise.all([import("/js/yaml/index.js"), import("/lib/editor/script-yaml.js")]);
      window.cbArgTypes = conv.ARG_TYPES;
      this.setupCanvas();
      relay.onOpen = () => this.send({ type: "hello" });
      relay.onMessage = (msg) => this.receive(msg);
      relay.onClose = (reason) => { this.status = "closed"; this.closeReason = reason; };
      this.relay = relay.connect();
      window.addEventListener("beforeunload", (e) => { if (this.changes()) e.preventDefault(); });
    },

    statusText() {
      return { connecting: "Connecting…", closed: "Session ended: " + this.closeReason }[this.status] ?? "";
    },

    /* ================= canvas ================= */

    setupCanvas() {
      const el = document.getElementById("ed-canvas");
      df = new Drawflow(el);
      df.reroute = false;
      df.draggable_inputs = false;
      df.zoom_enter = () => {}; // wheel zoom is ours, centred on the cursor
      df.key = () => {}; // keys are ours too: Drawflow's Delete removes whatever it last saw clicked, even while typing
      df.start();

      df.on("connectionCreated", (c) => this.onConnect(c));
      df.on("connectionRemoved", (c) => this.onDisconnect(c));
      df.on("nodeRemoved", (id) => this.onNodeRemoved(id));
      // Drawflow stores a dragged node's position one mouse step behind where it draws it; trust the drawing
      df.on("nodeMoved", (id) => {
        if (insertAt) this.insertInto(String(id));
        const n = df.drawflow.drawflow.Home.data[id], node = document.getElementById("node-" + id);
        if (n && node) { n.pos_x = parseFloat(node.style.left); n.pos_y = parseFloat(node.style.top); }
        this.refresh();
      });
      df.on("translate", () => this.drawMinimap());
      // keeps each wire's click area on the wire while Drawflow redraws it
      new MutationObserver((list) => {
        for (const m of list) if (m.target.classList?.contains("main-path")) m.target.parentElement.querySelector(".hit-path")?.setAttribute("d", m.target.getAttribute("d"));
      }).observe(df.precanvas, { subtree: true, attributes: true, attributeFilter: ["d"] });

      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        this.zoomAt(df.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });

      el.addEventListener("mousedown", (e) => this.onPointerDown(e), true);
      // right-drag pans; keep Drawflow's right-click menu out of the way
      el.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
      el.addEventListener("click", (e) => this.onClick(e));
      el.addEventListener("mousemove", (e) => { mouse = { x: e.clientX, y: e.clientY }; });
      el.addEventListener("mouseleave", () => { mouse = null; });
      el.addEventListener("input", (e) => this.onInput(e));
      el.addEventListener("change", (e) => this.onChange(e));
      el.addEventListener("keydown", (e) => this.onFieldKey(e));
      el.addEventListener("focusin", (e) => { if (e.target.dataset?.rule === "duration") this.durationMenu(e.target); });
      el.addEventListener("focusout", (e) => {
        if (e.target === this.pop?.anchor && !e.relatedTarget?.closest?.(".ed-pop")) setTimeout(() => { if (this.pop?.anchor === e.target && document.activeElement !== e.target) this.pop = null; }, 150);
        if (e.target.classList.contains("tag-in")) this.commitTag(e.target);
        // an alias row emptied out goes away
        if (e.target.classList.contains("al-in") && !e.target.value.trim()) { const box = e.target.closest(".sec"); e.target.closest(".tag").remove(); this.saveTags(box); }
        if (e.target.classList.contains("cmd")) this.syncCalls(); // the first word may now name another script
      });
      // nothing in the editor is dragged natively; Firefox would try to open a dropped piece as a link
      el.addEventListener("dragstart", (e) => e.preventDefault());
      // only plain text is pasted into a command
      el.addEventListener("paste", (e) => {
        if (!e.target.closest?.(".cmd")) return;
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
      });
      // tooltips for fields with a problem, and for the save button
      document.addEventListener("mouseover", (e) => this.showTip(e.target, e));
      document.addEventListener("mousedown", () => { this.tip = null; }, true);
      document.addEventListener("keydown", (e) => this.onKey(e), true);
      for (const type of ["copy", "cut", "paste"]) document.addEventListener(type, (e) => this.onClipboard(e));
      // Firefox drops keys like Ctrl+A and Ctrl+V while a plain element has focus; a hidden text field gets them all.
      // Clicking anything in the editor that isn't a field hands focus back to it.
      const keyBox = document.querySelector(".ed-keys");
      keyBox.addEventListener("beforeinput", (e) => e.preventDefault());
      // decided by what was clicked: Firefox may not have focused a clicked field yet when mouseup arrives.
      // Click handlers that focus a field themselves run after this.
      let down = null;
      document.addEventListener("mousedown", (e) => { down = e.target; }, true);
      document.addEventListener("mouseup", (e) => {
        // text being selected (in the YAML panel) keeps its selection
        if (this.status !== "online" || !e.target.closest?.(".ed") || e.target.closest(".ed-yaml") || !getSelection().isCollapsed) return;
        if (!this.isTyping(down) && !this.isTyping(e.target)) keyBox.focus({ preventScroll: true });
      }, true);
      document.addEventListener("keyup", (e) => { if (e.code === "Space") el.classList.remove("ed-space"); });
      window.addEventListener("resize", () => this.drawMinimap());
    },

    toWorld(sx, sy) {
      const r = df.container.getBoundingClientRect();
      const ox = df.precanvas.clientWidth / 2, oy = df.precanvas.clientHeight / 2;
      return { x: (sx - r.left - df.canvas_x - ox) / df.zoom + ox, y: (sy - r.top - df.canvas_y - oy) / df.zoom + oy };
    },

    // screen position inside the work area, for popups
    toWork(sx, sy) {
      const r = df.container.parentElement.getBoundingClientRect();
      return { x: sx - r.left, y: sy - r.top };
    },

    /* ---------- pointer: pan, select, move, groups, wires, port menus ---------- */

    onPointerDown(e) {
      const el = df.container;
      const t = e.target;
      const nodeEl = t.closest(".drawflow-node");
      if (!t.closest(".ed-pop") && t !== this.pop?.anchor) this.pop = null;
      if (!t.closest(".connection")) this.wireX = null;
      const empty = t === el || t === df.precanvas || t.classList.contains("grp-body");

      if (e.button === 2) {
        // right-drag pans, a right-click without moving opens the context menu
        e.stopPropagation(); e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY;
        let moved = false;
        return this.drag(e, "ed-panning", (dx, dy, ev) => {
          moved ||= Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4;
          if (moved) this.setView(df.zoom, df.canvas_x + dx, df.canvas_y + dy);
        }, () => { if (!moved) this.contextMenu(t, x0, y0); });
      }
      if (e.button === 1 || el.classList.contains("ed-space") || (this.tool === "grab" && empty)) {
        e.stopPropagation(); e.preventDefault();
        return this.drag(e, "ed-panning", (dx, dy) => this.setView(df.zoom, df.canvas_x + dx, df.canvas_y + dy));
      }

      if (t.closest(".connection")) {
        // a wire: select it and offer a delete button right there (Delete works too)
        e.stopPropagation();
        return this.selectWire(t, e.clientX, e.clientY);
      }

      const port = t.classList.contains("output") || t.classList.contains("input") ? t : null;
      if (port && e.altKey) {
        // Alt-click breaks every wire on a port, like in Unreal
        e.stopPropagation(); e.preventDefault();
        const id = nodeEl.id.slice(5), cls = [...port.classList].find((c) => /^(in|out)put_\d+$/.test(c));
        const n = df.getNodeFromId(id), side = cls.startsWith("in") ? "inputs" : "outputs";
        for (const c of [...n[side][cls].connections]) {
          side === "outputs" ? df.removeSingleConnection(id, c.node, cls, c.output) : df.removeSingleConnection(c.node, id, c.input, cls);
        }
        return;
      }
      if (port && t.classList.contains("input")) {
        e.stopPropagation(); e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY;
        window.addEventListener("mouseup", (u) => { if (Math.hypot(u.clientX - x0, u.clientY - y0) < 5) this.portMenu(nodeEl.id.slice(5), "in", [...t.classList].find((c) => c.startsWith("input_")), u.clientX, u.clientY); }, { once: true });
        return;
      }
      if (port) return this.startWire(e, nodeEl, t);

      const grpHead = t.closest(".grp-h");
      if (grpHead && !t.closest("input, button, label")) {
        e.stopPropagation(); e.preventDefault();
        const g = this.groupById(grpHead.parentElement.dataset.gid);
        const inside = this.nodesIn(g);
        return this.drag(e, "ed-moving", (dx, dy) => {
          g.x += dx / df.zoom; g.y += dy / df.zoom;
          for (const id of inside) this.moveNodeBy(id, dx / df.zoom, dy / df.zoom);
          this.renderGroups();
        }, () => this.refresh());
      }

      if (nodeEl) {
        const id = nodeEl.id.slice(5);
        // an argument pill, or a piece already in a command, is dragged into place with a live preview
        const piece = t.closest(".pill, .ph");
        if (piece) { this.pieceDrag(e, piece); return; }
        const control = t.closest("input, select, button, textarea, label, .cmd, .args, .al-list");
        // the command box places its own caret; Drawflow must not move the node
        if (t.closest(".cmd, .args")) e.stopPropagation();
        if ((e.shiftKey || e.ctrlKey || e.metaKey) && !control) {
          e.stopPropagation();
          selected.has(id) ? selected.delete(id) : selected.add(id);
          return this.paintSelection();
        }
        if (!selected.has(id)) { selected.clear(); selected.add(id); this.paintSelection(); }
        if (control) return;
        // leaving a field for the node itself, so shortcuts act on the graph again
        document.querySelector(".ed-keys").focus({ preventScroll: true });
        if (!t.closest(".nh")) { e.stopPropagation(); return; } // only the header moves a node
        if (selected.size > 1) {
          // move the whole selection; Drawflow itself only moves one node
          e.stopPropagation(); e.preventDefault();
          return this.drag(e, "ed-moving", (dx, dy) => {
            for (const s of selected) this.moveNodeBy(s, dx / df.zoom, dy / df.zoom);
          }, () => this.refresh());
        }
        el.classList.add("ed-moving");
        // a loose Execute or Wait dragged onto a step-to-step wire goes in between when dropped
        const n0 = df.getNodeFromId(id);
        const loose = ["run", "wait"].includes(kindOf(n0)) && !n0.inputs.input_1.connections.length && !n0.outputs.output_1.connections.length;
        const watch = () => this.findInsert(id);
        if (loose) window.addEventListener("mousemove", watch);
        window.addEventListener("mouseup", () => { el.classList.remove("ed-moving"); window.removeEventListener("mousemove", watch); }, { once: true });
        return;
      }

      if (empty && e.button === 0) {
        // selection box; clicking the canvas also leaves any field, so shortcuts like Ctrl+Z act on the graph
        e.stopPropagation(); e.preventDefault();
        document.querySelector(".ed-keys").focus({ preventScroll: true });
        if (!e.shiftKey) { selected.clear(); this.paintSelection(); }
        const r = el.getBoundingClientRect();
        const box = document.createElement("div");
        box.className = "ed-marquee";
        el.appendChild(box);
        const x0 = e.clientX, y0 = e.clientY;
        let x1 = x0, y1 = y0;
        return this.drag(e, "ed-selecting", (dx, dy, ev) => {
          x1 = ev.clientX; y1 = ev.clientY;
          Object.assign(box.style, { left: Math.min(x0, x1) - r.left + "px", top: Math.min(y0, y1) - r.top + "px", width: Math.abs(x1 - x0) + "px", height: Math.abs(y1 - y0) + "px" });
        }, () => {
          box.remove();
          const [l, tp, rt, bt] = [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
          if (rt - l > 3 || bt - tp > 3) {
            for (const n of el.querySelectorAll(".drawflow-node")) {
              const b = n.getBoundingClientRect();
              if (b.right > l && b.left < rt && b.bottom > tp && b.top < bt) selected.add(n.id.slice(5));
            }
          }
          this.paintSelection();
        });
      }
    },

    selectWire(t, sx, sy) {
      selected.clear(); this.paintSelection();
      const main = t.closest(".connection").querySelector(".main-path");
      df.connection_selected?.classList.remove("selected");
      df.connection_selected = main;
      main.classList.add("selected");
      wireShown = main;
      const p = this.toWork(sx, sy);
      this.wireX = { x: p.x, y: p.y };
    },

    // a wire starts: highlight the ports it may join in their own color, mute everything else
    startWire(e, nodeEl, portEl) {
      const el = df.container;
      const from = df.getNodeFromId(nodeEl.id.slice(5));
      const port = [...portEl.classList].find((c) => c.startsWith("output_"));
      const id = ++this.dragId;
      wiring = { from: String(from.id), port, x: e.clientX, y: e.clientY, made: false };
      el.classList.add("ed-wiring");
      el.dataset.drag = portType(kindOf(from), "out", port);
      el.querySelectorAll(".drawflow-node").forEach((node) => {
        const to = df.getNodeFromId(node.id.slice(5));
        let any = false;
        node.querySelectorAll(".input").forEach((inp) => {
          const ok = this.allowed(from, port, to, [...inp.classList].find((c) => c.startsWith("input_")), true);
          inp.classList.add(ok ? "can" : "cannot");
          any ||= ok;
        });
        if (!any && node !== nodeEl) node.classList.add("no-target");
      });
      window.addEventListener("mouseup", (u) => setTimeout(() => {
        if (id !== this.dragId) return; // a later drag already started
        el.classList.remove("ed-wiring");
        delete el.dataset.drag;
        el.querySelectorAll(".can, .cannot, .no-target").forEach((n) => n.classList.remove("can", "cannot", "no-target"));
        const w = wiring;
        wiring = null;
        if (!w || w.made) return;
        // a click on a port, or a wire dropped on empty space, opens the menu of what can go there
        const onEmpty = u.target === el || u.target === df.precanvas || u.target.classList?.contains("grp-body");
        const clicked = Math.hypot(u.clientX - w.x, u.clientY - w.y) < 5;
        if (clicked || onEmpty) this.portMenu(w.from, "out", w.port, u.clientX, u.clientY, !clicked);
      }), { once: true });
    },

    // the step-to-step wire running under a dragged node, lit up as the place it will go
    findInsert(id) {
      const node = document.getElementById("node-" + id), r = node.getBoundingClientRect(), from = df.getNodeFromId(id);
      let hit = null;
      for (const c of df.container.querySelectorAll("svg.connection.t-flow")) {
        const path = c.querySelector(".main-path"), len = path.getTotalLength(), m = path.getScreenCTM();
        const cls = [...c.classList];
        const a = cls.find((k) => k.startsWith("node_out_"))?.slice(14), b = cls.find((k) => k.startsWith("node_in_"))?.slice(13);
        if (!a || !b || a === id || b === id) continue;
        for (let t = 0.1; t < 0.9 && !hit; t += 0.05) {
          const p = path.getPointAtLength(len * t), x = p.x * m.a + m.e, y = p.y * m.d + m.f;
          if (x > r.left && x < r.right && y > r.top && y < r.bottom) hit = { from: a, to: b, wire: c };
        }
        if (hit) break;
      }
      // a Wait can't follow or lead into another Wait
      if (hit && kindOf(from) === "wait" && [hit.from, hit.to].some((n) => kindOf(df.getNodeFromId(n)) === "wait")) hit = null;
      if (insertAt?.wire !== hit?.wire) insertAt?.wire.classList.remove("insert-at");
      hit?.wire.classList.add("insert-at");
      node.classList.toggle("inserting", !!hit);
      insertAt = hit;
    },

    insertInto(id) {
      const { from, to, wire } = insertAt;
      insertAt = null;
      wire.classList.remove("insert-at");
      const node = document.getElementById("node-" + id);
      node.classList.remove("inserting");
      df.removeSingleConnection(from, to, "output_1", "input_1");
      df.addConnection(from, id, "output_1", "input_1");
      df.addConnection(id, to, "output_1", "input_1");
      node.classList.add("dropped-in");
      setTimeout(() => node.classList.remove("dropped-in"), 400);
    },

    // generic drag helper: calls move(dx, dy) in screen pixels since the last event
    drag(e, cls, move, done) {
      const el = df.container;
      let lx = e.clientX, ly = e.clientY;
      el.classList.add(cls);
      const onMove = (ev) => { move(ev.clientX - lx, ev.clientY - ly, ev); lx = ev.clientX; ly = ev.clientY; this.drawMinimap(); };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        el.classList.remove(cls);
        done?.();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp, { once: true });
    },

    moveNodeTo(id, x, y) {
      const n = df.drawflow.drawflow.Home.data[id];
      if (!n) return;
      n.pos_x = x; n.pos_y = y;
      const el = document.getElementById("node-" + id);
      el.style.left = x + "px";
      el.style.top = y + "px";
      df.updateConnectionNodes("node-" + id);
    },

    moveNodeBy(id, dx, dy) {
      const n = df.drawflow.drawflow.Home.data[id];
      if (n) this.moveNodeTo(id, n.pos_x + dx, n.pos_y + dy);
    },

    rectOf(id) {
      const n = df.drawflow.drawflow.Home.data[id], el = document.getElementById("node-" + id);
      return { x: n.pos_x, y: n.pos_y, w: el.offsetWidth, h: el.offsetHeight };
    },

    // moves a new node to the nearest spot around (x, y) where it doesn't cover anything
    settle(id, x, y) {
      const me = this.rectOf(id), pad = 28;
      const others = Object.keys(df.drawflow.drawflow.Home.data).filter((k) => k !== String(id)).map((k) => this.rectOf(k));
      const free = (px, py) => others.every((o) => px + me.w + pad <= o.x || o.x + o.w + pad <= px || py + me.h + pad <= o.y || o.y + o.h + pad <= py);
      for (let ring = 0; ring < 40; ring++) {
        const steps = Math.max(1, ring * 8);
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const px = x + Math.cos(a) * ring * 60, py = y + Math.sin(a) * ring * 45;
          if (free(px, py)) return this.moveNodeTo(id, px, py);
        }
      }
      this.moveNodeTo(id, x, y);
    },

    paintSelection() {
      document.querySelectorAll(".drawflow-node.is-sel").forEach((n) => n.classList.remove("is-sel"));
      for (const id of [...selected]) {
        const n = document.getElementById("node-" + id);
        if (n) n.classList.add("is-sel"); else selected.delete(id);
      }
      this.selectionSize = selected.size;
      const first = [...selected][0];
      if (first && owner.has(first)) this.selectedFile = this.fileOf(owner.get(first));
    },

    isTyping(t) {
      if (!t || t.classList?.contains("ed-keys")) return false;
      return !!(t.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select') || t.closest?.('[contenteditable="true"]'));
    },

    // Ctrl+C, X and V go through the browser's clipboard events, so they also work between tabs; fields keep their own
    onClipboard(e) {
      if (this.status !== "online" || this.isTyping(e.target)) return;
      if (e.type === "paste") {
        let data = null;
        try { data = JSON.parse(e.clipboardData.getData("text/plain")).cbEditor; } catch {}
        if (data?.nodes) clipboard = data;
        if (!clipboard) return;
        e.preventDefault();
        this.paste(mouse && this.toWorld(mouse.x, mouse.y));
        return;
      }
      if (!selected.size) return;
      e.preventDefault();
      this.copy();
      e.clipboardData.setData("text/plain", JSON.stringify({ cbEditor: clipboard }));
      if (e.type === "cut") this.deleteSelection();
    },

    // the usual node-editor keys; fields keep theirs, except Ctrl+S and Escape
    onKey(e) {
      if (this.status !== "online") return;
      const t = e.target;
      const typing = this.isTyping(t);
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (k === "escape") {
        if (this.yamlSugg) return; // the YAML completion list closes first
        if (this.pop) this.pop = null;
        else if (typing) t.blur();
        else { selected.clear(); this.paintSelection(); this.wireX = null; }
        return;
      }
      if (mod && k === "s") { e.preventDefault(); this.save(); return; }
      if (typing) return;
      if (mod) {
        const run = {
          z: () => (e.shiftKey ? this.redo() : this.undo()), y: () => this.redo(), a: () => this.selectAll(),
          d: () => this.duplicate(),
          g: () => (e.shiftKey ? this.ungroupSelection() : this.newGroup()),
          0: () => this.zoomAt(1, df.container.clientWidth / 2, df.container.clientHeight / 2),
          "=": () => this.zoomBy(1.2), "+": () => this.zoomBy(1.2), "-": () => this.zoomBy(1 / 1.2),
        }[k];
        if (run) { e.preventDefault(); run(); }
        return;
      }
      if (k === "delete" || k === "backspace") {
        // Drawflow would delete only the node it thinks is selected
        e.stopPropagation(); e.preventDefault();
        if (selected.size) this.deleteSelection(); else this.deleteWire();
        return;
      }
      const step = e.shiftKey ? 50 : 10;
      const nudge = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
      if (nudge && selected.size) {
        e.preventDefault();
        for (const id of selected) this.moveNodeBy(id, ...nudge);
        this.refresh();
        return;
      }
      if (e.code === "Space") { df.container.classList.add("ed-space"); e.preventDefault(); return; }
      if (k === "f") this.fit(selected.size ? [...selected] : null);
      else if (k === "v") this.setTool("select");
      else if (k === "h") this.setTool("grab");
      else if (k === "a") { e.preventDefault(); this.addMenu(); }
    },

    selectAll() {
      for (const id of Object.keys(df.drawflow.drawflow.Home.data)) selected.add(id);
      this.paintSelection();
    },

    setTool(t) {
      this.tool = t;
      df.container.classList.toggle("ed-grab", t === "grab");
    },

    copy() {
      if (!selected.size) return;
      const snap = JSON.parse(this.serialize());
      clipboard = { nodes: snap.nodes.filter((n) => selected.has(n.id)), edges: snap.edges.filter(([a, , b]) => selected.has(a) && selected.has(b)) };
    },

    // pastes at a canvas point, or next to the originals; a pasted Command is a new script (refresh gives it a group)
    paste(at) {
      if (!clipboard?.nodes.length) return;
      const x0 = Math.min(...clipboard.nodes.map((n) => n.x)), y0 = Math.min(...clipboard.nodes.map((n) => n.y));
      const origin = at || { x: x0 + 60, y: y0 + 60 };
      const taken = new Set(Object.values(df.drawflow.drawflow.Home.data).filter((n) => kindOf(n) === "command").map((n) => this.fields(n.id).name));
      const ids = new Map();
      selected.clear();
      for (const n of clipboard.nodes) {
        const values = { ...n.values };
        if (n.kind === "command") {
          let name = values.name + "-copy", i = 2;
          while (taken.has(name) || this.scripts[name + ".yml"] !== undefined) name = `${values.name}-copy-${i++}`;
          taken.add(values.name = name);
        }
        const id = this.place(n.kind, origin.x + n.x - x0, origin.y + n.y - y0, values);
        ids.set(n.id, id);
        selected.add(id);
      }
      for (const [a, out, b, inp] of clipboard.edges) df.addConnection(ids.get(a), ids.get(b), out, inp);
      this.paintSelection();
      this.syncCalls();
      this.refresh();
    },

    cut() {
      this.copy();
      this.deleteSelection();
    },

    duplicate() {
      const keep = clipboard;
      this.copy();
      this.paste();
      clipboard = keep;
    },

    deleteSelection() {
      const ids = [...selected];
      selected.clear();
      this.removingNodes = true; // their wires go too, which must not rewrite other scripts' commands
      for (const id of ids) if (df.drawflow.drawflow.Home.data[id]) df.removeNodeId("node-" + id);
      this.removingNodes = false;
      this.paintSelection();
      this.refresh();
    },

    // deletes the wire the button was shown for; Drawflow may have dropped its own selection by now
    deleteWire() {
      if (wireShown?.isConnected) {
        df.connection_selected = wireShown;
        df.removeConnection();
      }
      wireShown = null;
      this.wireX = null;
    },

    /* ---------- port menus: what can be added or wired at a port ---------- */

    portMenu(nodeId, side, port, sx, sy, dropped = false) {
      const n = df.getNodeFromId(nodeId), kind = kindOf(n);
      const label = portLabel(kind, side, port);
      const type = portType(kind, side, port);
      const at = dropped ? this.toWorld(sx, sy) : null;
      const r = this.rectOf(nodeId);
      const right = at || { x: r.x + r.w + 90, y: r.y };
      const left = (w) => at || { x: r.x - w - 90, y: r.y };
      const below = at || { x: r.x, y: r.y + r.h + 40 };
      const items = [];
      const data = df.drawflow.drawflow.Home.data;
      const script = owner.get(String(nodeId));
      const wireIn = (k, values, pos) => () => { const id = this.addNode(k, values, pos.x, pos.y); df.addConnection(id, nodeId, "output_1", port); this.refresh(); return id; };

      if (side === "out" && type === "flow") {
        const next = n.outputs[port].connections[0]?.node;
        const insert = (k) => () => {
          const id = this.addNode(k, {}, right.x, right.y);
          if (next) df.removeSingleConnection(nodeId, next, port, "input_1");
          df.addConnection(nodeId, id, port, "input_1");
          if (next) df.addConnection(id, next, "output_1", "input_1");
          this.refresh();
        };
        items.push({ kind: "run", label: "Execute step", run: insert("run") });
        if (kind !== "wait") items.push({ kind: "wait", label: "Wait", run: insert("wait") });
      } else if (side === "out" && type === "call") {
        for (const c of Object.values(data).filter((c) => kindOf(c) === "command" && String(c.id) !== script)) {
          items.push({ kind: "command", label: "/" + this.fields(c.id).name, run: () => df.addConnection(nodeId, c.id, port, P.cmd.calledBy) });
        }
        if (!items.length) items.push({ label: "No other scripts yet", disabled: true });
      } else if (side === "in" && type === "call") {
        for (const c of Object.values(data).filter((c) => kindOf(c) === "run" && owner.get(String(c.id)) !== String(nodeId))) {
          const s = owner.get(String(c.id));
          items.push({ kind: "run", label: `/${s ? this.fields(s).name : "?"}: ${this.fields(c.id).command || "(empty step)"}`, run: () => df.addConnection(c.id, nodeId, P.run.calls, port) });
        }
        if (!items.length) items.push({ label: "No steps in other scripts yet", disabled: true });
      } else if (side === "in" && type === "arg") {
        items.push({ kind: "arg", label: "New argument", run: () => {
          // below the existing arguments, because their order on the canvas is their order in the command
          const y = n.inputs[port].connections.map((c) => this.rectOf(c.node)).reduce((m, q) => Math.max(m, q.y + q.h + 30), r.y);
          wireIn("arg", {}, at || { x: r.x - 380 - 90, y })();
        } });
      } else if (side === "in" && type === "alias") {
        items.push({ kind: "alias", label: "New aliases", run: wireIn("alias", {}, left(300)) });
      } else if (side === "in" && type === "def") {
        items.push({ kind: "defaults", label: "New defaults", run: wireIn("defaults", {}, below) });
        for (const d of Object.values(data).filter((d) => kindOf(d) === "defaults")) {
          const users = d.outputs.output_1.connections.map((c) => "/" + this.fields(c.node).name).join(", ");
          items.push({ kind: "defaults", label: "Reuse defaults", hint: users ? "used by " + users : "not used yet", run: () => { df.addConnection(d.id, nodeId, "output_1", port); this.refresh(); } });
        }
      } else if (side === "in" && type === "runas") {
        for (const v of RUN_AS) items.push({ icon: RUN_AS_ICONS[v], color: MINIMAP_COLORS.runas, label: v.toLowerCase(), run: wireIn("runas", { value: v }, below) });
      } else if (side === "in" && type === "cool") {
        items.push({ kind: "cooldown", label: "New cooldown", run: wireIn("cooldown", { cooldown: "10s" }, below) });
      } else if (side === "in" && type === "rules") {
        items.push({ kind: "rules", label: "New server rules", run: wireIn("rules", {}, below) });
      } else if (side === "in" && type === "srv") {
        const wired = new Set(n.inputs[port].connections.map((c) => this.target(c.node)).map((t) => `${t.id}@${t.location}`));
        items.push(...this.serverItems((t) => this.wireServer(nodeId, port, t, left(240)), wired));
      } else if (side === "out" && type === "def") {
        for (const c of Object.values(data).filter((c) => kindOf(c) === "command" && !c.inputs[P.cmd.defaults].connections.length)) {
          items.push({ kind: "command", label: "/" + this.fields(c.id).name, run: () => { df.addConnection(nodeId, c.id, "output_1", P.cmd.defaults); this.refresh(); } });
        }
        if (!items.length) items.push({ label: "Every script already has defaults", disabled: true });
      } else {
        const hints = { flow: "Connect it from a step's 'then'", arg: "Drag it into a Command's 'arguments'", srv: "Drag it into 'registered on' or 'targets'",
          alias: "Drag it into a Command's 'aliases'", runas: "Drag it into 'run as'", cool: "Drag it into a step's 'cooldown'", rules: "Drag it into a step's 'server rules'" };
        items.push({ label: hints[type] || "Drag from here to connect", disabled: true });
      }
      this.openMenu(sx, sy, items, label);
    },

    // shows a menu at a screen point, kept inside the work area; submenus open to the left near the right edge
    openMenu(sx, sy, items, title = "") {
      const p = this.toWork(sx, sy);
      this.pop = { x: p.x, y: p.y, title, items, flip: false, open: null };
      this.$nextTick(() => {
        const m = document.querySelector(".ed-pop"), w = df.container.parentElement;
        if (!m || !this.pop) return;
        this.pop.x = Math.max(4, Math.min(p.x, w.clientWidth - m.offsetWidth - 16));
        this.pop.y = Math.max(4, Math.min(p.y, w.clientHeight - m.offsetHeight - 16));
        this.pop.flip = this.pop.x + m.offsetWidth * 2 > w.clientWidth;
      });
    },

    // safe triangle: while the pointer heads for the open submenu, crossing other items doesn't switch it
    aimMove(e) {
      aim.p0 = aim.p1;
      aim.p1 = { x: e.clientX, y: e.clientY };
      aim.t = Date.now();
    },

    aim(i) {
      clearTimeout(aim.timer);
      const sub = document.querySelector(".ed-pop > .ed-mw.open > .ed-sub");
      if (sub && this.pop.open !== i && this.headingFor(sub)) { aim.timer = setTimeout(() => this.aim(i), 120); return; }
      this.pop.open = i;
    },

    headingFor(sub) {
      const { p0: a, p1: p } = aim;
      if (!a || !p || Date.now() - aim.t > 100) return false; // the pointer rests: it's where the user wants to be
      const r = sub.getBoundingClientRect(), x = this.pop.flip ? r.right : r.left;
      const b = { x, y: r.top - 8 }, c = { x, y: r.bottom + 8 };
      const side = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
      const d1 = side(a, b, p), d2 = side(b, c, p), d3 = side(c, a, p);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    },

    icon(kind) { return ICONS[kind] || ""; },
    color(kind) { return MINIMAP_COLORS[kind]; },

    // what can be added, at a canvas point or in the middle of the view
    addItems(at) {
      const node = (kind, label) => ({ kind, label, run: () => this.addAt(kind, {}, at) });
      return [
        { kind: "command", label: "Command", run: () => this.addScript(at) },
        { kind: "run", label: "Step", sub: [node("run", "Execute"), node("wait", "Wait")] },
        { kind: "arg", label: "Input", sub: [node("arg", "Argument"), node("alias", "Aliases")] },
        { kind: "defaults", label: "Setting", sub: [node("defaults", "Defaults"), node("runas", "Run as"), node("cooldown", "Cooldown"), node("rules", "Server rules")] },
        { kind: "server", label: "Server", sub: this.serverItems((t) => this.addAt("server", t, at)) },
      ];
    },

    addAt(kind, values, at) {
      const c = at || this.viewCenter();
      const id = this.addNode(kind, values, c.x, c.y);
      selected.clear(); selected.add(id); this.paintSelection();
      this.refresh();
      return id;
    },

    // the toolbar's Add button and the A key
    addMenu(e) {
      const r = (e?.currentTarget || document.querySelector(".ed-addbtn")).getBoundingClientRect();
      this.openMenu(r.left, r.bottom - 4, this.addItems(null));
    },

    contextMenu(t, sx, sy) {
      const at = this.toWorld(sx, sy);
      const nodeEl = t.closest(".drawflow-node"), wire = t.closest(".connection"), frame = t.closest(".grp");
      const ic = (d) => svg(d, 15);
      const I = {
        copy: ic('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
        cut: ic('<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>'),
        paste: ic('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
        dup: ic('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/><path d="M15 12v6M12 15h6"/>'),
        trash: ic('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
        power: ic('<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>'),
        group: ic('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M2 9h20"/>'),
        ungroup: ic('<rect width="20" height="16" x="2" y="4" rx="2" stroke-dasharray="3 3"/>'),
        tidy: ic('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
        fit: ic('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        all: ic('<path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1M9 21h1M14 3h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1"/>'),
        dot: ic('<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>'),
      };
      // the icon shows what the item does: switch off (crossed out) or switch on (green)
      const onOff = (on, what, run) => (on ? { icon: svg(LUCIDE["power-off"]), label: `Disable ${what}`, run } : { icon: I.power, label: `Enable ${what}`, run });
      const paste = { icon: I.paste, label: "Paste", keys: "Ctrl+V", disabled: !clipboard, run: () => this.paste(at) };
      let items, title = "";
      if (wire) {
        this.selectWire(t, sx, sy);
        items = [{ icon: I.trash, label: "Delete connection", keys: "Del", danger: true, run: () => this.deleteWire() }];
      } else if (nodeEl) {
        const id = nodeEl.id.slice(5);
        if (!selected.has(id)) { selected.clear(); selected.add(id); this.paintSelection(); }
        const n = selected.size, kind = kindOf(df.getNodeFromId(id));
        title = n > 1 ? `${n} nodes` : kind === "command" ? "/" + this.fields(id).name : TITLES[kind];
        const sw = kind === "command" && n === 1 && nodeEl.querySelector('[data-f="enabled"]');
        const sids = this.selectedFiles(), inGroups = new Set(sids.map((f) => this.groupOf(f)));
        const one = inGroups.size === 1 ? [...inGroups][0] : null, shared = [...inGroups].some((g) => g?.members.length > 1);
        items = [
          { icon: I.copy, label: "Copy", keys: "Ctrl+C", run: () => this.copy() },
          { icon: I.cut, label: "Cut", keys: "Ctrl+X", run: () => this.cut() },
          { icon: I.dup, label: "Duplicate", keys: "Ctrl+D", run: () => this.duplicate() },
          paste,
          { sep: true },
          // the group of the script(s) behind the selection: shown, changed, or left
          ...(sids.length ? [{ icon: I.group, label: "Group", hint: one?.title || "", sub: [
            { section: sids.length > 1 ? `Move ${sids.length} scripts to` : "Move the script to" },
            ...groups.map((g) => ({ icon: I.dot, color: g.color, label: g.title || "Group", check: g === one, disabled: g === one, run: () => this.moveToGroup(sids, g) })),
            { sep: true },
            { icon: I.group, label: "New group", keys: "Ctrl+G", run: () => this.newGroup() },
            ...(shared ? [{ icon: I.ungroup, label: "Remove from group", keys: "Ctrl+Shift+G", run: () => this.ungroupSelection() }] : []),
          ] }] : []),
          ...(shared ? [{ icon: I.ungroup, label: "Remove from group", keys: "Ctrl+Shift+G", run: () => this.ungroupSelection() }] : []),
          ...(sw ? [onOff(sw.checked, "script", () => { sw.checked = !sw.checked; this.refresh(); })] : []),
          { sep: true },
          { icon: I.trash, label: n > 1 ? `Delete ${n} nodes` : "Delete", keys: "Del", danger: true, run: () => this.deleteSelection() },
        ];
      } else {
        const g = frame && this.groupById(frame.dataset.gid);
        items = [
          ...this.addItems(at),
          { sep: true },
          paste,
          { icon: I.all, label: "Select all", keys: "Ctrl+A", run: () => this.selectAll() },
          { sep: true },
          ...(g ? [
            { section: g.title || "Group" },
            onOff(this.groupEnabled(g), "group", () => this.setGroupEnabled(g, !this.groupEnabled(g))),
            { icon: I.tidy, label: "Sort group", run: () => this.sortGroup(g) },
            ...(g.members.length > 1 ? [{ icon: I.ungroup, label: "Ungroup", danger: true, run: () => this.ungroup(g.members) }] : []),
            { sep: true },
          ] : []),
          { icon: I.tidy, label: "Sort everything", run: () => this.tidy() },
          { icon: I.fit, label: "Fit view", keys: "F", run: () => this.fit() },
        ];
      }
      this.openMenu(sx, sy, items, title);
    },

    runPop(item) {
      if (item.disabled || item.sub) return;
      this.pop = null;
      item.run();
    },

    // connected servers, then the ones scripts use that aren't connected, then a field for any other id
    serverItems(pick, skip = new Set()) {
      const items = [];
      for (const online of [true, false]) {
        const list = [...this.knownServers()].filter(([id, info]) => info.online === online && !skip.has(`${id}@${info.location}`));
        if (!list.length) continue;
        items.push({ section: online ? "Connected" : "Offline" });
        for (const [id, info] of list) {
          items.push({ icon: srvIcon(info.location, info.platform), color: online ? SRV_COLORS[info.location] : null, label: id, muted: !online, run: () => pick({ id, location: info.location }) });
        }
      }
      items.push({ sep: true }, { custom: true, run: pick });
      return items;
    },

    srvIcon(loc) { return srvIcon(loc); },

    customServer(e, item) {
      const input = e.target.elements.sid, id = input.value.trim();
      if (!RULES.serverid[0].test(id)) { input.classList.add("bad"); input.focus(); return; }
      this.pop = null;
      item.run({ id, location: e.submitter?.value || "BACKEND" });
    },

    // one Server node per use, like a variable, so its wire stays short and crosses nothing
    wireServer(nodeId, port, t, pos) {
      df.addConnection(this.addNode("server", { id: t.id, location: t.location }, pos.x, pos.y), nodeId, "output_1", port);
      this.refresh();
    },

    // servers the proxy knows: itself and connected clients, plus every id the scripts already use
    knownServers() {
      const out = new Map();
      for (const [id, info] of Object.entries(this.servers)) out.set(id, { location: info.location, platform: info.platform, online: true });
      for (const text of Object.values(this.scripts)) {
        let m;
        try { m = conv.toModel(YAML, text); } catch { continue; }
        for (const t of [...m.register, ...(m.defaults.execute || []), ...m.commands.flatMap((c) => c.execute || [])]) {
          if (t?.id && !out.has(t.id)) out.set(String(t.id), { location: t.location || "BACKEND", online: false });
        }
      }
      return new Map([...out].sort((a, b) => Number(b[1].online) - Number(a[1].online) || a[0].localeCompare(b[0])));
    },

    /* ---------- fields: lists, suggestions, validation ---------- */

    onClick(e) {
      const t = e.target;
      // the switch shows whether any script in the group is on; a click turns them all the other way
      if (t.classList.contains("grp-en")) { const g = this.groupById(t.closest(".grp").dataset.gid); this.setGroupEnabled(g, !this.groupEnabled(g)); return; }
      if (t.classList.contains("grp-x")) { this.ungroup(this.groupById(t.closest(".grp").dataset.gid).members); return; }
      if (t.closest(".grp-sort")) { this.sortGroup(this.groupById(t.closest(".grp").dataset.gid)); return; }
      if (t.classList.contains("grp-c")) { this.groupById(t.closest(".grp").dataset.gid).color = t.dataset.color; this.renderGroups(); this.refresh(); return; }
      if (t.closest(".tag-x")) {
        const box = t.closest(".sec");
        t.closest(".tag").remove();
        this.saveTags(box);
        return;
      }
      const pk = t.closest(".pick");
      if (pk) { this.pickMenu(pk); return; }
      // a click on a field's frame, like the "/" before a name, goes into the field
      const frame = t.closest(".slashed, .tag, .al-new");
      if (frame && t.tagName !== "INPUT" && !t.closest("button")) {
        const input = frame.querySelector("input");
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    },

    onInput(e) {
      const t = e.target;
      if (t.classList.contains("grp-t")) {
        Object.assign(this.groupById(t.closest(".grp").dataset.gid), { title: t.value, named: true });
        t.size = Math.max(6, t.value.length + 1);
      }
      if (t.classList.contains("tag-in")) return;
      if (t.classList.contains("al-in")) { t.closest(".tag").dataset.v = t.value.trim().replace(/^\//, ""); this.check(t); this.saveTags(t.closest(".sec")); return; }
      if (t.dataset.f === "name" && t.closest(".cb-command")) t.closest(".drawflow-node").querySelector(".nh-name").textContent = t.value;
      if (t.tagName === "TEXTAREA") this.grow(t);
      if (t.classList.contains("cmd")) this.tokenize(t);
      if (t.dataset.rule && RULES[t.dataset.rule]) this.check(t);
      if (t.dataset.rule === "duration" && t === document.activeElement) this.durationMenu(t);
      this.refresh(t.type === "text" || t.tagName === "TEXTAREA" || t.classList.contains("cmd"));
    },

    onChange(e) {
      const t = e.target;
      if (["name"].includes(t.dataset.f)) this.syncCalls();
      df.updateConnectionNodes(t.closest(".drawflow-node")?.id || "");
      this.refresh();
    },

    onFieldKey(e) {
      const t = e.target;
      // single-line fields that wrap: Enter leaves them instead of breaking the line
      if (e.key === "Enter" && (t.tagName === "TEXTAREA" || t.classList.contains("cmd"))) { e.preventDefault(); t.blur(); return; }
      if (e.key === "Enter" && t.classList.contains("al-in")) { e.preventDefault(); t.closest(".sec").querySelector(".tag-in").focus(); return; }
      if (!t.classList.contains("tag-in")) return;
      if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === "Tab") {
        if (t.value.trim()) { e.preventDefault(); this.commitTag(t); }
      } else if (e.key === "Backspace" && !t.value) {
        const box = t.closest(".sec"), last = box.querySelector(".als").lastElementChild;
        if (last) { last.remove(); this.saveTags(box); }
      }
    },

    // an alias typed into the tag field becomes a tag
    commitTag(input) {
      const v = input.value.trim().replace(/^\//, "");
      input.value = "";
      const box = input.closest(".sec");
      if (!v || box.querySelector(`.tag[data-v="${CSS.escape(v)}"]`)) return;
      box.querySelector(".als").insertAdjacentHTML("beforeend", tag(v));
      this.saveTags(box);
    },

    saveTags(box) {
      box.querySelector('[data-f="aliases"]').value = [...box.querySelectorAll(".tag")].map((t) => t.dataset.v).filter(Boolean).join(",");
      df.updateConnectionNodes(box.closest(".drawflow-node").id);
      this.syncCalls();
      this.refresh();
    },

    grow(area) {
      area.style.height = "auto";
      area.style.height = area.scrollHeight + 2 + "px";
      df.updateConnectionNodes(area.closest(".drawflow-node").id);
    },

    // the command text without its pieces: placeholders back to ${name}
    cmdText(box) {
      let out = "";
      for (const n of box.childNodes) {
        out += n.nodeType === 3 ? n.nodeValue : n.classList?.contains("ph") ? "${" + n.dataset.arg + "}" : n.classList?.contains("callw") ? n.dataset.word : this.cmdText(n);
      }
      return out.replace(/\u00a0/g, " ");
    },

    setCmd(box, text) {
      box.innerHTML = cmdHtml(text, box.classList.contains("calling"));
    },

    // a typed ${name} becomes a placeholder piece; the caret stays where it was in the text
    tokenize(box) {
      if (![...box.childNodes].some((n) => n.nodeType === 3 && /\$\{[^}]*\}/.test(n.nodeValue)) && !box.querySelector(":scope > :not(.ph):not(.callw)")) return;
      const sel = getSelection(), range = sel.rangeCount && sel.getRangeAt(0);
      let caret = null;
      if (range && box.contains(range.startContainer)) {
        const pre = document.createRange();
        pre.selectNodeContents(box);
        pre.setEnd(range.startContainer, range.startOffset);
        const tmp = document.createElement("div");
        tmp.appendChild(pre.cloneContents());
        caret = this.cmdText(tmp).length;
      }
      this.setCmd(box, this.cmdText(box));
      if (caret === null) return;
      let left = caret;
      for (const n of box.childNodes) {
        const len = n.nodeType === 3 ? n.nodeValue.length : this.cmdText({ childNodes: [n] }).length;
        if (left <= len) {
          const r = document.createRange();
          if (n.nodeType === 3) r.setStart(n, left); else r.setStartAfter(n);
          r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
          return;
        }
        left -= len;
      }
    },

    // drags an argument (a pill, or a piece already in a command) between the words of a command; the text makes room
    // as it moves. A piece dragged out lands in the remove zone, or anywhere else to go back where it was.
    pieceDrag(e, el) {
      e.stopPropagation(); e.preventDefault();
      this.tip = null;
      const name = el.dataset.arg, from = el.classList.contains("ph") ? el : null, home = from?.closest(".cmd");
      const x0 = e.clientX, y0 = e.clientY, r0 = el.getBoundingClientRect();
      const PREVIEW = "\u0000";
      let ghost = null, trash = null, box = null, tokens = [], slots = [], slot = -1, homeText = "", overTrash = false;
      const render = (b, list) => { b.innerHTML = list.map((t) => (t === PREVIEW ? `<span class="ph preview" contenteditable="false">${esc(name)}</span>` : `<span class="tk">${textHtml(t)}</span>`)).join(" "); };
      const leave = () => { if (box) { this.setCmd(box, tokens.join(" ")); box.classList.remove("drop-here"); } box = null; slot = -1; };
      const enter = (b) => {
        box = b;
        const text = this.cmdText(b).trim();
        tokens = text ? text.split(/\s+/) : []; // one space between words, however many there were
        render(b, tokens);
        b.classList.add("drop-here");
        const spans = [...b.querySelectorAll(".tk")].map((s) => s.getBoundingClientRect());
        // slot i goes before word i; a step that calls a script keeps the called name first
        slots = spans.map((r) => ({ x: r.left - 3, y: r.top + r.height / 2 }));
        const last = spans.at(-1), br = b.getBoundingClientRect();
        slots.push(last ? { x: last.right + 3, y: last.top + last.height / 2 } : { x: br.left + 10, y: br.top + br.height / 2 });
        if (b.classList.contains("calling") && slots.length > 1) slots[0] = null;
      };
      const start = () => {
        // the ghost is the piece as it looks in the text, at the canvas zoom, held where it was grabbed
        ghost = document.createElement("div");
        ghost.className = "ph-ghost";
        ghost.textContent = name;
        ghost.style.transform = `scale(${df.zoom})`;
        document.body.append(ghost);
        ghost.dataset.dx = x0 - r0.left; ghost.dataset.dy = y0 - r0.top;
        if (from) {
          homeText = this.cmdText(home);
          from.remove();
          this.setCmd(home, this.cmdText(home).trim().replace(/\s+/g, " "));
          trash = document.createElement("div");
          trash.className = "ed-trash";
          trash.innerHTML = `${svg(LUCIDE["trash-2"], 18)}<span>Drop here to remove</span>`;
          document.querySelector(".ed-stage").append(trash);
          requestAnimationFrame(() => trash.classList.add("on"));
        } else {
          el.classList.add("lifted");
        }
        df.container.classList.add("ed-moving");
      };
      const move = (ev) => {
        if (!ghost) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; start(); }
        ghost.style.left = ev.clientX - ghost.dataset.dx + "px";
        ghost.style.top = ev.clientY - ghost.dataset.dy + "px";
        const tr = trash?.getBoundingClientRect();
        overTrash = !!tr && ev.clientX > tr.left - 20 && ev.clientX < tr.right + 20 && ev.clientY > tr.top - 20 && ev.clientY < tr.bottom + 20;
        trash?.classList.toggle("hot", overTrash);
        ghost.classList.toggle("doomed", overTrash);
        const under = overTrash ? null : document.elementFromPoint(ev.clientX, ev.clientY)?.closest("#ed-canvas .cmd");
        if (under !== box) { leave(); if (under) enter(under); }
        if (!box) return;
        let best = -1, dist = Infinity;
        slots.forEach((p, i) => { if (!p) return; const d = Math.abs(p.x - ev.clientX) + Math.abs(p.y - ev.clientY) * 3; if (d < dist) { dist = d; best = i; } });
        if (best === slot) return;
        slot = best;
        const list = [...tokens];
        list.splice(slot, 0, PREVIEW);
        render(box, list);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        df.container.classList.remove("ed-moving");
        el.classList.remove("lifted");
        if (!ghost) return;
        let land = null;
        if (box && slot >= 0) {
          const target = box;
          const list = [...tokens];
          list.splice(slot, 0, "${" + name + "}");
          box.classList.remove("drop-here");
          this.setCmd(target, list.join(" "));
          // the new piece is the one after as many same-named pieces as the words before it hold
          const before = tokens.slice(0, slot).join(" ").split("${" + name + "}").length - 1;
          land = target.querySelectorAll(`.ph[data-arg="${CSS.escape(name)}"]`)[before];
          box = null;
        } else if (from && !overTrash) {
          this.setCmd(home, homeText); // dropped nowhere: it goes back
          land = [...home.querySelectorAll(".ph")].find((p) => p.dataset.arg === name);
        }
        // the ghost glides onto where the piece landed and hands over to it; in the bin or nowhere it fades
        const to = land?.getBoundingClientRect();
        if (to) {
          ghost.classList.add("settle");
          ghost.style.left = to.left + "px"; ghost.style.top = to.top + "px";
          ghost.addEventListener("transitionend", () => ghost.remove(), { once: true });
          setTimeout(() => ghost.remove(), 300);
        } else {
          ghost.classList.add("gone");
          setTimeout(() => ghost.remove(), 160);
        }
        if (trash) { trash.classList.remove("on"); setTimeout(() => trash.remove(), 220); }
        this.syncCalls();
        this.refresh();
        df.container.querySelectorAll(".cb-run").forEach((n) => df.updateConnectionNodes(n.id));
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up, { once: true });
    },

    // the player a server check is about has to be given, so the argument it comes from becomes required
    requireArg(btn, name) {
      const node = this.argNodesOf(btn.closest(".drawflow-node").id.slice(5)).find((n) => this.fields(n.id).name === name);
      const sw = node && document.querySelector(`#node-${node.id} [data-f="required"]`);
      if (sw) sw.checked = true;
    },

    // durations to pick from, narrowed down by what's typed; "none" where the field may stay empty
    durationMenu(input) {
      const v = input.value.trim().toLowerCase();
      const all = ["500ms", "1s", "3s", "5s", "10s", "30s", "1m", "5m", "10m", "30m", "1h", "6h", "12h", "24h"];
      const list = all.filter((d) => !v || (d.startsWith(v) && d !== v));
      const set = (d) => () => { input.value = d; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); };
      const items = [...(!input.dataset.req && v ? [{ label: "none", muted: true, run: set("") }] : []), ...list.map((d) => ({ icon: svg(LUCIDE["clock-3"]), label: d, run: set(d) }))];
      if (!items.length) { this.pop = null; return; }
      const r = input.getBoundingClientRect();
      this.openMenu(r.left, r.bottom + 2, items);
      this.pop.scroll = true;
      this.pop.width = Math.max(160, r.width);
      this.pop.anchor = input;
    },

    // the editor's own dropdown: argument types by family, or the player the server checks are about
    pickMenu(btn) {
      if (btn.closest(".fr.idle")) return;
      const r = btn.getBoundingClientRect(), cur = btn.dataset.v;
      const set = (v, label, icon) => () => { btn.dataset.v = v; btn.querySelector("span").textContent = label; btn.querySelector(".pi").innerHTML = icon; this.refresh(); };
      let items;
      if (btn.dataset.pick === "type") {
        const types = window.cbArgTypes || [];
        const used = new Set();
        const entry = (t) => ({ icon: typeIcon(t), label: t, check: t === cur, run: set(t, t, typeIcon(t)) });
        items = ARG_FAMILIES.flatMap(([section, list]) => {
          const mine = list.filter((t) => types.includes(t));
          mine.forEach((t) => used.add(t));
          return mine.length ? [{ section }, ...mine.map(entry)] : [];
        });
        const rest = types.filter((t) => !used.has(t));
        if (rest.length) items.push({ section: "Other" }, ...rest.map(entry));
      } else {
        const args = this.argsOf(btn.closest(".drawflow-node").id.slice(5));
        items = [
          { icon: RUN_AS_ICONS.PLAYER, label: "who ran it", check: !cur, run: set("", "who ran it", RUN_AS_ICONS.PLAYER) },
          ...(args.length ? [{ section: "From an argument" }] : []),
          ...args.map((a) => ({ icon: typeIcon(a.type), label: a.name, keys: a.type, check: a.name === cur,
            disabled: !PLAYER_TYPES.includes(a.type), run: () => { this.requireArg(btn, a.name); set(a.name, a.name, svg(LUCIDE.users))(); } })),
        ];
      }
      this.openMenu(r.left, r.bottom + 2, items);
      this.pop.scroll = true;
      this.pop.width = Math.max(200, r.width);
    },


    // a Server node's id and location
    target(id) {
      const f = this.fields(id);
      return { id: f.id, location: f.location || "BACKEND" };
    },

    check(input) {
      const v = input.value.trim();
      const ok = v === "" ? !input.dataset.req : RULES[input.dataset.rule][0].test(v);
      input.classList.toggle("bad", !ok);
      if (ok) delete input.dataset.err;
      else input.dataset.err = v === "" ? "Required" : "Use " + RULES[input.dataset.rule][1];
    },

    // the argument nodes of the script a node belongs to, in their order
    argNodesOf(nodeId) {
      const cmd = owner.get(String(nodeId));
      if (!cmd) return [];
      const data = df.drawflow.drawflow.Home.data;
      return (data[cmd].inputs[P.cmd.args].connections || []).map((c) => data[c.node]).sort((a, b) => a.pos_y - b.pos_y);
    },

    argsOf(nodeId) {
      return this.argNodesOf(nodeId).map((n) => this.fields(n.id)).filter((a) => a.name);
    },

    // options that depend on the graph: argument chips, player-arg choices, inherited values, server lists
    // what depends on the whole graph: argument chips, unknown placeholders, required fields and ports, muted scripts
    refreshDynamic(scripts) {
      const byCmd = new Map(scripts.map((s) => [s.id, s]));
      const data = df.drawflow.drawflow.Home.data;
      // a step's arguments, ready to be dragged into its command
      document.querySelectorAll("#ed-canvas .args").forEach((box) => {
        const s = byCmd.get(owner.get(box.closest(".drawflow-node").id.slice(5)));
        const html = (s?.model.args || []).filter((a) => a.name).map((a) => `<span class="pill" data-arg="${esc(a.name)}" data-tip="Drag into the command">${esc(a.name)}</span>`).join("");
        if (box.innerHTML !== html) box.innerHTML = html;
      });
      const known = this.knownServers();
      // a connected server shows the software it runs; the rest show proxy or backend
      document.querySelectorAll('#ed-canvas .cb-server [data-f="id"]').forEach((i) => {
        const node = i.closest(".drawflow-node"), info = known.get(i.value), loc = node.querySelector('[data-f="location"]').value;
        const platform = info?.location === loc ? info.platform : undefined;
        node.classList.toggle("offline", !info?.online);
        if (node.dataset.platform !== String(platform)) {
          node.dataset.platform = String(platform);
          node.querySelector(".nh > svg, .nh > .logo").outerHTML = srvIcon(loc, platform);
          node.querySelector(".srv-k").textContent = srvKind(loc, platform);
        }
      });
      // "checks player" only matters while target required or schedule online is on
      document.querySelectorAll('#ed-canvas [data-pick="player"]').forEach((b) => {
        const f = this.fields(b.closest(".drawflow-node").id.slice(5)), p = b.dataset.f[0];
        b.closest(".fr").classList.toggle("idle", f[p + "-target"] !== "true" && f[p + "-online"] !== "true");
      });
      // a step that calls another script shows the called name as a fixed piece (not while it's being typed in)
      for (const n of Object.values(data)) {
        if (kindOf(n) !== "run") continue;
        const box = document.querySelector(`#node-${n.id} .cmd`), calling = n.outputs[P.run.calls].connections.length > 0;
        if (box && box !== document.activeElement && box.classList.contains("calling") !== calling) {
          const text = this.cmdText(box);
          box.classList.toggle("calling", calling);
          this.setCmd(box, text);
        }
      }
      // a step's unwired settings come from the Defaults: show what they'll be
      for (const [nodeId, cmdId] of owner) {
        const node = document.getElementById("node-" + nodeId), s = byCmd.get(cmdId);
        if (!s || !node?.classList.contains("cb-run")) continue;
        const d = s.model.defaults, n = data[nodeId];
        const inherited = {
          targets: (d.execute || []).map((t) => t.id).join(", ") || "none",
          "run as": (d["run-as"] || "CONSOLE").toLowerCase(),
          cooldown: d.cooldown || "none",
          "server rules": "defaults",
        };
        for (const [label, value] of Object.entries(inherited)) {
          const span = node.querySelector(`[data-port="${label}"]`), port = { targets: P.run.targets, "run as": P.run.runas, cooldown: P.run.cooldown, "server rules": P.run.rules }[label];
          const text = n.inputs[port].connections.length ? "" : value;
          let em = span.querySelector(".inh");
          if (!text) { em?.remove(); continue; }
          if (!em) { em = document.createElement("em"); em.className = "inh"; em.dataset.tip = "Not wired, so it uses the Defaults"; span.append(em); }
          if (em.textContent !== text) em.textContent = text;
        }
      }
      // a disabled script is muted with everything that only it uses
      const off = new Set(scripts.filter((s) => !s.model.enabled).map((s) => s.id));
      for (const n of Object.values(data)) {
        const own = owners.get(String(n.id));
        document.getElementById("node-" + n.id).classList.toggle("muted", !!own?.size && [...own].every((c) => off.has(c)));
      }
      document.querySelectorAll("#ed-canvas svg.connection").forEach((c) => {
        const ids = [...c.classList].filter((k) => k.startsWith("node_")).map((k) => k.split("-")[1]);
        c.classList.toggle("muted", ids.length === 2 && ids.every((i) => document.getElementById("node-" + i)?.classList.contains("muted")));
      });
    },

    // red marks right on what needs a change, with the reason on hover; what has no place goes to the notes
    markProblems(problems) {
      document.querySelectorAll("#ed-canvas .pmark").forEach((el) => { el.classList.remove("pmark", "bad", "missing", "has-err"); delete el.dataset.err; });
      document.querySelectorAll("#ed-canvas [data-rule]").forEach((i) => this.check(i));
      const pinned = new Set();
      for (const p of problems) {
        const node = p.at && document.getElementById("node-" + p.at.node);
        let el = node && (p.at.port ? node.querySelector(`[data-port="${p.at.port}"]`) : node.querySelector(p.at.sel || ".nh"));
        if (el && ["checkbox", "radio", "hidden"].includes(el.type)) el = el.closest(".fr") || el.closest(".sec");
        if (!el) continue;
        pinned.add(p);
        el.dataset.err = el.classList.contains("pmark") ? el.dataset.err + "\n" + p.text : p.text;
        el.classList.add("pmark", p.at.port ? "missing" : el.classList.contains("nh") ? "has-err" : "bad");
      }
      return pinned;
    },

    showTip(target, e) {
      if (e?.buttons) { this.tip = null; return; } // never while dragging
      const el = target.closest?.("[data-err], [data-tip]");
      const text = el && (el.dataset.err || el.dataset.tip);
      if (!text || !el.closest(".ed")) { this.tip = null; return; }
      const r = el.getBoundingClientRect(), w = document.querySelector(".ed").getBoundingClientRect();
      const right = r.left - w.left > w.width / 2;
      this.tip = { text, err: !!el.dataset.err, y: r.bottom - w.top + 6, x: right ? w.right - r.right : r.left - w.left, right };
    },

    saveTip() {
      const b = this.blocking();
      if (!b.length) return "";
      return `Fix ${b.length} ${b.length === 1 ? "problem" : "problems"} before saving:\n` + b.slice(0, 5).map((p) => (p.script ? `/${p.script}: ` : "") + p.text).join("\n") + (b.length > 5 ? `\nand ${b.length - 5} more` : "");
    },

    // clicking the blocked save button shows the first problem
    revealProblem() {
      const p = this.blocking().find((x) => x.pinned);
      if (!p) return;
      const r = this.rectOf(p.at.node);
      this.centerOn(r.x + r.w / 2, r.y + r.h / 2, Math.max(df.zoom, 0.8));
      selected.clear(); selected.add(String(p.at.node)); this.paintSelection();
    },

    groupById(id) { return groups.find((g) => g.id === id); },

    // a group holds whole scripts: every node they use
    nodesIn(g) {
      const cmds = new Set(this.groupCommands(g).map((n) => String(n.id)));
      return [...owners].filter(([, own]) => [...own].some((c) => cmds.has(c))).map(([id]) => id);
    },

    groupOf(sid) { return groups.find((g) => g.members.includes(sid)); },

    // a script's id for its group: its file once saved, a random one until then, so renaming never moves it
    sidOf(cmdId) {
      const m = meta.get(String(cmdId)) || {};
      if (!m.sid && !m.file) meta.set(String(cmdId), { ...m, sid: crypto.randomUUID() });
      return meta.get(String(cmdId)).sid || m.file;
    },

    // the scripts the selected nodes belong to
    selectedFiles() {
      return [...new Set([...selected].filter((id) => owner.has(id)).map((id) => this.sidOf(owner.get(id))))];
    },

    // a script is in exactly one group; a group left without scripts goes away
    moveToGroup(files, g) {
      for (const x of groups) if (x !== g) x.members = x.members.filter((m) => !files.includes(m));
      g.members = [...new Set([...g.members, ...files])];
      groups = groups.filter((x) => x.members.length);
      this.renderGroups();
      this.refresh();
    },

    // the selected scripts form a new group (Ctrl+G)
    newGroup() {
      const files = this.selectedFiles();
      if (!files.length) return;
      const g = { id: crypto.randomUUID().slice(0, 8), title: "Group", color: GROUP_COLORS[groups.length % GROUP_COLORS.length], x: 0, y: 0, w: 0, h: 0, members: [] };
      groups.push(g);
      this.moveToGroup(files, g);
      document.querySelector(`.grp[data-gid="${g.id}"] .grp-t`)?.select();
    },

    // scripts leaving a group go back to a group of their own, like every script starts
    ungroup(files) {
      for (const g of groups) g.members = g.members.filter((m) => !files.includes(m));
      groups = groups.filter((g) => g.members.length);
      for (const f of files) {
        const cmd = Object.values(df.drawflow.drawflow.Home.data).find((n) => kindOf(n) === "command" && this.sidOf(n.id) === f);
        groups.push(this.scriptGroup(f, "/" + (cmd ? this.fields(cmd.id).name : f)));
      }
      this.renderGroups();
      this.refresh();
    },

    ungroupSelection() {
      const files = this.selectedFiles().filter((f) => this.groupOf(f)?.members.length > 1);
      if (files.length) this.ungroup(files);
    },

    groupCommands(g) {
      return Object.values(df.drawflow.drawflow.Home.data).filter((n) => kindOf(n) === "command" && g.members.includes(this.sidOf(n.id)));
    },

    groupEnabled(g) {
      return this.groupCommands(g).some((n) => this.fields(n.id).enabled === "true");
    },

    // a disabled group is every script in it disabled; nodes shared with an enabled script stay live
    setGroupEnabled(g, on) {
      for (const n of this.groupCommands(g)) document.querySelector(`#node-${n.id} [data-f="enabled"]`).checked = on;
      this.refresh();
    },

    scriptGroup(file, title) {
      return { id: crypto.randomUUID().slice(0, 8), title, color: GROUP_COLORS[groups.length % GROUP_COLORS.length], x: 0, y: 0, w: 400, h: 200, members: [file], auto: true };
    },

    // frames always wrap all of their scripts' nodes
    fitGroups() {
      const PAD = 40, HEAD = 44;
      for (const g of groups) {
        const ids = this.nodesIn(g);
        if (!ids.length) continue;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const id of ids) { const r = this.rectOf(id); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
        Object.assign(g, { x: x0 - PAD, y: y0 - PAD - HEAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 + HEAD });
      }
    },

    // updates frames in place, so a title being typed keeps its focus
    renderGroups() {
      const seen = new Set();
      for (const g of groups) {
        seen.add(g.id);
        let el = df.precanvas.querySelector(`.grp[data-gid="${g.id}"]`);
        if (!el) {
          el = document.createElement("div");
          el.className = "grp";
          el.dataset.gid = g.id;
          el.innerHTML = `<div class="grp-h">${GRIP}<input class="grp-t" value="${esc(g.title)}" size="${Math.max(6, g.title.length + 1)}" aria-label="Group name"><span class="grp-n"></span><span class="grp-fill"></span>
            <span class="grp-colors">${GROUP_COLORS.map((c) => `<button class="grp-c" style="--c:${c}" data-color="${c}" aria-label="Group color"></button>`).join("")}</span>
            <label class="sw" data-tip="Turns every script in this group on or off"><input type="checkbox" role="switch" class="grp-en" aria-label="Group enabled"><span></span></label>
            <button class="grp-sort" data-tip="Sort this group" aria-label="Sort this group">${svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 14)}</button>
            <button class="grp-x" data-tip="Ungroup" aria-label="Ungroup">×</button></div><div class="grp-body"></div>`;
          // behind the nodes, but above older frames
          const frames = df.precanvas.querySelectorAll(".grp");
          frames.length ? frames[frames.length - 1].after(el) : df.precanvas.prepend(el);
        }
        Object.assign(el.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px" });
        el.style.setProperty("--g", g.color);
        el.classList.toggle("solo", g.members.length === 1);
        const on = this.groupEnabled(g);
        el.querySelector(".grp-en").checked = on;
        el.classList.toggle("off", !on);
        el.querySelector(".grp-n").textContent = `${g.members.length} ${g.members.length === 1 ? "script" : "scripts"}`;
        const title = el.querySelector(".grp-t");
        if (document.activeElement !== title && title.value !== g.title) { title.value = g.title; title.size = Math.max(6, g.title.length + 1); }
      }
      df.precanvas.querySelectorAll(".grp").forEach((n) => { if (!seen.has(n.dataset.gid)) n.remove(); });
      this.drawMinimap();
    },

    // same-type ports only, and the flow stays a single chain
    // same-type ports only; the flow stays a single chain; single-value inputs take one wire
    allowed(from, outPort, to, inPort, preview = false) {
      if (String(from.id) === String(to.id)) return false;
      const type = portType(kindOf(from), "out", outPort);
      if (!type || type !== portType(kindOf(to), "in", inPort)) return false;
      const already = preview ? 0 : 1; // after creation the new wire is already counted
      const outs = from.outputs[outPort].connections, ins = to.inputs[inPort].connections;
      if (["flow", "call", "alias", "arg"].includes(type) && outs.length > already) return false;
      if (type === "flow" && ins.length > already) return false;
      if (["def", "runas", "cool", "rules"].includes(type) && ins.length > already) return false;
      if (kindOf(from) === "wait" && kindOf(to) === "wait") return false;
      return true;
    },

    onConnect({ output_id, input_id, output_class, input_class }) {
      if (building) { this.tagWire(output_id, input_id, output_class, input_class); return; }
      const from = df.getNodeFromId(output_id), to = df.getNodeFromId(input_id);
      if (!this.allowed(from, output_class, to, input_class)) {
        df.removeSingleConnection(output_id, input_id, output_class, input_class);
        return;
      }
      if (wiring) wiring.made = true;
      this.tagWire(output_id, input_id, output_class, input_class);
      const type = portType(kindOf(from), "out", output_class);
      if (!syncingCalls && type === "call") {
        // wiring a call writes the called command's name into the step and runs the step where that script is registered
        // the name replaces a script name already in front, otherwise it goes in front of what's there
        const runField = document.querySelector(`#node-${output_id} [data-f="command"]`);
        const words = this.cmdText(runField).trim().split(/\s+/).filter(Boolean);
        const scripts = new Set(Object.values(df.drawflow.drawflow.Home.data).filter((n) => kindOf(n) === "command").flatMap((n) =>
          [this.fields(n.id).name, ...n.inputs[P.cmd.aliases].connections.flatMap((c) => splitList(this.fields(c.node).aliases))]).map((x) => String(x).toLowerCase()));
        if (words.length && scripts.has(words[0].replace(/^\//, "").toLowerCase())) words.shift();
        this.setCmd(runField, [this.fields(input_id).name, ...words].join(" "));
        const home = to.inputs[P.cmd.reg].connections[0]?.node;
        if (home) {
          const h = this.target(home);
          const own = from.inputs[P.run.targets].connections.map((k) => String(k.node));
          if (!own.some((k) => { const t = this.target(k); return t.id === h.id && t.location === h.location; })) {
            for (const k of own) df.removeSingleConnection(k, output_id, "output_1", P.run.targets);
            const r = this.rectOf(output_id);
            this.wireServer(output_id, P.run.targets, h, { x: r.x - 320 - 90, y: r.y + 40 });
          }
        }
        this.syncCalls();
      } else if (!syncingCalls && type === "srv") {
        this.syncCalls(); // where a step runs decides whether it calls a script
      }
      this.refresh();
    },

    // Drawflow removes a node's wires before it reports the node removed; deferring keeps the old
    // ownership around so removing a Command can still take its own nodes with it
    // Drawflow removes a node's wires before it reports the node removed; deferring keeps the old
    // ownership around so removing a Command can still take its own nodes with it
    onDisconnect(c) {
      if (building || syncingCalls) return;
      const data = df.drawflow.drawflow.Home.data;
      const from = data[c?.output_id];
      if (!this.removingNodes && from && data[c.input_id] && kindOf(from) === "run" && c.output_class === P.run.calls) {
        // a call is the command text; removing the wire removes the called name from it, or it would come right back
        const field = document.querySelector(`#node-${c.output_id} [data-f="command"]`);
        this.setCmd(field, this.cmdText(field).trim().split(/\s+/).slice(1).join(" "));
      }
      if (this.deferred) return;
      this.deferred = true;
      queueMicrotask(() => {
        this.deferred = false;
        this.syncCalls();
        this.refresh();
      });
    },

    onNodeRemoved(id) {
      if (building) return;
      // removing a Command removes its script: the nodes only it uses go with it, shared ones stay
      this.removingNodes = true;
      for (const [nodeId, own] of owners) {
        if (nodeId !== String(id) && own.has(String(id)) && own.size === 1 && df.drawflow.drawflow.Home.data[nodeId]) df.removeNodeId("node-" + nodeId);
      }
      this.removingNodes = false;
      meta.delete(String(id));
      selected.delete(String(id));
      this.refresh();
    },

    tagWire(outId, inId, outPort, inPort) {
      const type = portType(kindOf(df.getNodeFromId(outId)), "out", outPort);
      const wire = document.querySelector(`.connection.node_out_node-${outId}.node_in_node-${inId}.${outPort}.${inPort}`);
      if (!wire) return;
      wire.classList.add("t-" + type);
      // a wide invisible copy to click on: the drawn wire is thin, and a dashed one has gaps clicks fall through.
      // It goes after the drawn path, because Drawflow updates children[0] when nodes move.
      if (!wire.querySelector(".hit-path")) {
        const hit = wire.querySelector(".main-path").cloneNode();
        hit.setAttribute("class", "hit-path");
        wire.appendChild(hit);
      }
    },

    /* ---------- nodes ---------- */

    place(kind, x, y, values = {}) {
      const p = PORTS[kind];
      const id = String(df.addNode(kind, p.in.length, p.out.length, x, y, "cb-" + kind, {}, nodeHtml(kind, values)));
      const el = document.getElementById("node-" + id);
      if (kind === "server") el.classList.toggle("proxy", srvLoc(values) === "VELOCITY");
      // shape and color per port type; appended so Drawflow's positional classes stay where it expects them
      el.querySelectorAll(".inputs .input").forEach((n, i) => { n.classList.add("pt-" + p.in[i][1]); n.title = `${p.in[i][0]}: click to add, or drop a wire here. Alt-click removes its wires`; });
      el.querySelectorAll("textarea").forEach((a) => this.grow(a));
      el.querySelectorAll(".outputs .output").forEach((n, i) => { n.classList.add("pt-" + p.out[i][1]); n.title = `${p.out[i][0]}: drag to connect, click for options. Alt-click removes its wires`; });
      return id;
    },

    // a node added by hand goes into free space near where it was asked for
    addNode(kind, values, x, y) {
      const id = this.place(kind, x, y, values);
      const el = document.getElementById("node-" + id);
      el.classList.add("born");
      setTimeout(() => el.classList.remove("born"), 400);
      this.settle(id, x, y);
      return id;
    },

    fields(id) {
      const out = {};
      document.querySelectorAll(`#node-${id} [data-f]`).forEach((el) => {
        if (el.type === "radio") { if (el.checked) out[el.dataset.f] = el.value; return; }
        if (el.dataset.pick) { out[el.dataset.f] = el.dataset.v; return; }
        if (el.classList.contains("cmd")) { out[el.dataset.f] = this.cmdText(el).trim(); return; }
        out[el.dataset.f] = el.type === "checkbox" ? String(el.checked) : el.value.trim();
      });
      return out;
    },

    // keeps the canvas point under (mx, my) in place; Drawflow scales around the precanvas centre
    zoomAt(z, mx, my) {
      z = Math.min(1.6, Math.max(0.15, z));
      const ox = df.precanvas.clientWidth / 2, oy = df.precanvas.clientHeight / 2;
      const px = (mx - df.canvas_x - ox) / df.zoom + ox, py = (my - df.canvas_y - oy) / df.zoom + oy;
      this.setView(z, mx - ox - (px - ox) * z, my - oy - (py - oy) * z);
    },

    setView(z, x, y) {
      df.zoom = df.zoom_last_value = z;
      df.canvas_x = x;
      df.canvas_y = y;
      df.precanvas.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
      this.zoom = Math.round(z * 100);
      this.pop = null;
      this.wireX = null;
      this.drawMinimap();
    },

    zoomBy(f) { this.zoomAt(df.zoom * f, df.container.clientWidth / 2, df.container.clientHeight / 2); },

    bounds(ids = null) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ids || Object.keys(df.drawflow.drawflow.Home.data)) {
        const r = this.rectOf(id);
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      }
      if (!ids) for (const g of groups) { x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y); x1 = Math.max(x1, g.x + g.w); y1 = Math.max(y1, g.y + g.h); }
      return x0 === Infinity ? null : { x0, y0, x1, y1 };
    },

    centerOn(wx, wy, z = df.zoom) {
      const ox = df.precanvas.clientWidth / 2, oy = df.precanvas.clientHeight / 2;
      this.setView(z, df.container.clientWidth / 2 - ox - (wx - ox) * z, df.container.clientHeight / 2 - oy - (wy - oy) * z);
    },

    // the whole graph, or only the given nodes
    fit(ids = null) {
      const b = this.bounds(ids);
      if (!b) return;
      const w = df.container.clientWidth, h = df.container.clientHeight;
      const z = Math.min(1, Math.max(0.15, Math.min((w - 80) / (b.x1 - b.x0 + 120), (h - 80) / (b.y1 - b.y0 + 120))));
      this.centerOn((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, z);
    },

    viewCenter() {
      const ox = df.precanvas.clientWidth / 2, oy = df.precanvas.clientHeight / 2;
      return {
        x: (df.container.clientWidth / 2 - df.canvas_x - ox) / df.zoom + ox - 160,
        y: (df.container.clientHeight / 3 - df.canvas_y - oy) / df.zoom + oy,
      };
    },

    drawMinimap() {
      if (this.minimapQueued) return;
      this.minimapQueued = true;
      requestAnimationFrame(() => {
        this.minimapQueued = false;
        const c = document.getElementById("ed-minimap");
        if (!c || !this.showMinimap || !df) return;
        const ctx = c.getContext("2d"), W = c.width, H = c.height;
        ctx.clearRect(0, 0, W, H);
        const b = this.bounds();
        if (!b) return;
        const r = df.container.getBoundingClientRect();
        const v0 = this.toWorld(r.left, r.top), v1 = this.toWorld(r.right, r.bottom);
        const x0 = Math.min(b.x0, v0.x), y0 = Math.min(b.y0, v0.y), x1 = Math.max(b.x1, v1.x), y1 = Math.max(b.y1, v1.y);
        const s = Math.min((W - 16) / (x1 - x0), (H - 16) / (y1 - y0));
        const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
        const mx = (x) => ox + (x - x0) * s, my = (y) => oy + (y - y0) * s;
        this.minimapMap = { x0, y0, s, ox, oy };
        for (const g of groups) { ctx.fillStyle = g.color + "33"; ctx.fillRect(mx(g.x), my(g.y), g.w * s, g.h * s); }
        for (const n of Object.values(df.drawflow.drawflow.Home.data)) {
          const rr = this.rectOf(n.id);
          ctx.fillStyle = MINIMAP_COLORS[kindOf(n)];
          ctx.fillRect(mx(rr.x), my(rr.y), Math.max(2, rr.w * s), Math.max(2, rr.h * s));
        }
        ctx.strokeStyle = getComputedStyle(c).color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mx(v0.x), my(v0.y), (v1.x - v0.x) * s, (v1.y - v0.y) * s);
      });
    },

    minimapJump(e) {
      const m = this.minimapMap;
      if (!m) return;
      const c = e.currentTarget, r = c.getBoundingClientRect();
      const go = (ev) => {
        const px = (ev.clientX - r.left) * (c.width / r.width), py = (ev.clientY - r.top) * (c.height / r.height);
        this.centerOn((px - m.ox) / m.s + m.x0, (py - m.oy) / m.s + m.y0);
      };
      go(e);
      const move = (ev) => go(ev);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
    },

    /* ================= scripts -> graph ================= */

    // one row per script: its servers, arguments, the command, then its steps left to right
    // one row per script: servers, arguments and aliases, the command with its defaults, then its steps
    // left to right with their own settings underneath
    // texts: the scripts to lay out, by file; the saved ones unless the YAML panel hands in edited text
    snapshotFromScripts(texts = this.scripts) {
      const nodes = [], edges = [];
      let next = 0;
      for (const file of Object.keys(texts).sort()) {
        let m;
        try { m = conv.toModel(YAML, texts[file]); } catch { continue; } // listed as a problem in collect()
        const count = {};
        const add = (kind, values, extra = {}) => {
          const key = kind === "command" ? "cmd" : kind + (count[kind] = (count[kind] ?? -1) + 1);
          const n = { id: String(++next), kind, values, band: file, key: `${file}#${key}`, ...extra };
          nodes.push(n);
          return n.id;
        };
        const d = m.defaults, s = d.server || {};
        const cmd = add("command", { name: m.name, description: m.description || "", enabled: String(m.enabled !== false), perm: String(m.permissions.enabled !== false), silent: String(!!m.permissions.silent) }, { meta: this.scripts[file] !== undefined ? { file, version: m.version } : { version: m.version } });
        if (m.aliases.length) edges.push([add("alias", { aliases: m.aliases.join(", ") }), "output_1", cmd, P.cmd.aliases]);
        m.args.forEach((a) => {
          const id = add("arg", { name: a.name, type: a.type, required: String(!!a.required), suggestions: (a.suggestions || []).join(", ") }, { meta: { src: a._src } });
          edges.push([id, "output_1", cmd, P.cmd.args]);
        });
        // one Server node per use, like a variable: every wire stays short. Added in the order collect() meets them,
        // which is what the layout keys count by
        const server = (t) => add("server", { id: String(t.id), location: t.location === "VELOCITY" ? "VELOCITY" : "BACKEND" });
        m.register.forEach((t) => edges.push([server(t), "output_1", cmd, P.cmd.reg]));
        // every script has its Defaults node, so where steps run is never left open
        {
          const def = add("defaults", { "d-runas": d["run-as"] || "CONSOLE", "d-delay": d.delay && !isZero(d.delay) ? String(d.delay) : "", "d-cooldown": d.cooldown && !isZero(d.cooldown) ? String(d.cooldown) : "",
            "d-target": String(!!s["target-required"]), "d-online": String(!!s["schedule-online"]), "d-player": s["player-arg"] || "" });
          edges.push([def, "output_1", cmd, P.cmd.defaults]);
          (d.execute || []).forEach((t) => edges.push([server(t), "output_1", def, P.def.targets]));
        }
        let prev = cmd;
        m.commands.forEach((c) => {
          if (c.delay != null) {
            const w = add("wait", { delay: String(c.delay) });
            edges.push([prev, "output_1", w, "input_1"]);
            prev = w;
          }
          const run = add("run", { command: c.command }, { meta: { src: c._src } });
          edges.push([prev, "output_1", run, P.run.after]);
          (c.execute || []).forEach((t) => edges.push([server(t), "output_1", run, P.run.targets]));
          if (c["run-as"]) edges.push([add("runas", { value: c["run-as"] }), "output_1", run, P.run.runas]);
          if (c.cooldown != null) edges.push([add("cooldown", { cooldown: String(c.cooldown) }), "output_1", run, P.run.cooldown]);
          if (c.server) {
            const o = c.server;
            const rules = add("rules", { "r-target": String(!!o["target-required"]), "r-online": String(!!o["schedule-online"]), "r-player": o["player-arg"] || "" });
            edges.push([rules, "output_1", run, P.run.rules]);
          }
          prev = run;
        });
      }
      // groups are by file name since version 2 and still fit
      return { nodes, edges, groups: layout.version >= 2 ? layout.groups || [] : [] };
    },

    // places nodes from a snapshot; nodes without a stored position get a tidy spot in their script's row
    // places nodes from a snapshot; nodes without a stored position get a tidy spot in their script's row
    buildFrom(snap, auto = false) {
      building = true;
      df.clear();
      meta.clear();
      selected.clear();
      groups = (snap.groups || []).map((g) => ({ ...g, members: [...(g.members || [])] }));
      if (auto) {
        // members whose script is gone (deleted, or never saved) leave; a script's own group goes with it
        for (const g of groups) g.members = g.members.filter((m) => this.scripts[m] !== undefined);
        groups = groups.filter((g) => g.members.length);
      }
      const ids = new Map(), unplaced = new Map(); // band -> [[snapshot node, node id]]
      const keep = !auto || layout.version === LAYOUT_VERSION;
      for (const n of snap.nodes) {
        const stored = auto ? (keep ? layout.nodes?.[n.key] : null) : n;
        const has = stored && stored.x != null;
        const id = this.place(n.kind, has ? stored.x : 0, has ? stored.y : 0, n.values);
        ids.set(n.id, id);
        if (n.meta) meta.set(id, n.meta);
        if (!has) (unplaced.get(n.band) || unplaced.set(n.band, []).get(n.band)).push([n, id]);
      }
      for (const [from, out, to, inp] of snap.edges) if (ids.has(from) && ids.has(to)) df.addConnection(ids.get(from), ids.get(to), out, inp);
      if (unplaced.size) {
        // measure nodes at their final size: argument pills only appear once the wires say whose arguments they are
        this.refreshDynamic(this.collect().scripts);
        const fresh = new Set([...unplaced.values()].flat().map(([, id]) => id));
        const data = df.drawflow.drawflow.Home.data;
        const others = Object.keys(data).filter((id) => !fresh.has(id));
        const top = others.length ? Math.max(...others.map((id) => { const r = this.rectOf(id); return r.y + r.h; })) + 160 : 0;
        // a whole new script gets the full layout below everything; a new node in a placed script goes next to what it feeds
        const whole = [];
        for (const items of unplaced.values()) {
          const cmd = items.find(([n]) => n.kind === "command");
          if (cmd) { whole.push(cmd[1]); continue; }
          for (const [, id] of items) {
            const to = data[id].outputs.output_1?.connections[0]?.node, r = to && this.rectOf(to);
            if (r) this.settle(id, r.x - this.rectOf(id).w - 90, r.y); else this.settle(id, 0, top);
          }
        }
        this.arrange(whole, 0, top);
      }
      building = false;
      this.renderGroups();
      this.syncCalls();
      this.refresh();
    },

    // lays one script out so its wires run straight into their ports without crossing nodes:
    // [Defaults' servers] [aliases, arguments, servers it's registered on, Defaults] [Command] [steps...],
    // and each step's own settings below the step, ending just left of it. Returns where it ends.
    layoutScript(cmdId, x, y) {
      cmdId = String(cmdId);
      const data = df.drawflow.drawflow.Home.data, cmd = data[cmdId];
      const GAP = 90, V = 28;
      // nodes shared with another script stay where that script put them
      const mine = (n, port) => (n?.inputs[port]?.connections || []).map((c) => String(c.node)).filter((id) => owner.get(id) === cmdId)
        .sort((a, b) => data[a].pos_y - data[b].pos_y);
      const size = (id) => this.rectOf(id);
      const width = (ids) => Math.max(0, ...ids.map((id) => size(id).w));
      const defId = mine(cmd, P.cmd.defaults)[0];
      const colA = [...mine(cmd, P.cmd.aliases), ...mine(cmd, P.cmd.args), ...mine(cmd, P.cmd.reg), ...(defId ? [defId] : [])];
      const colB = defId ? mine(data[defId], P.def.targets) : [];
      const wA = width(colA), wB = width(colB);
      const xA = x + (wB ? wB + GAP : 0), xC = xA + (wA ? wA + GAP : 0);
      let bottom = y, yA = y, defY = y;
      // right-aligned, so every output sits at the same distance from the command
      for (const id of colA) { if (id === defId) defY = yA; this.moveNodeTo(id, xA + wA - size(id).w, yA); yA += size(id).h + V; }
      let yB = defY;
      for (const id of colB) { this.moveNodeTo(id, x + wB - size(id).w, yB); yB += size(id).h + V; }
      this.moveNodeTo(cmdId, xC, y);
      bottom = Math.max(yA - V, yB - V, y + size(cmdId).h);
      // the chain of steps in one row
      const chain = [];
      let sx = xC + size(cmdId).w + GAP, rowBottom = y + size(cmdId).h;
      for (let n = data[cmd.outputs[P.cmd.then].connections[0]?.node]; n && owner.get(String(n.id)) === cmdId && !chain.includes(String(n.id)); n = data[n.outputs.output_1.connections[0]?.node]) {
        const id = String(n.id);
        chain.push(id);
        this.moveNodeTo(id, sx, y);
        sx += size(id).w + GAP;
        rowBottom = Math.max(rowBottom, y + size(id).h);
      }
      const bandY = rowBottom + 50;
      for (const id of chain) {
        if (kindOf(data[id]) !== "run") continue;
        const own = [P.run.targets, P.run.runas, P.run.cooldown, P.run.rules].flatMap((port) => mine(data[id], port));
        let sy = bandY;
        for (const s of own) { this.moveNodeTo(s, data[id].pos_x - 30 - size(s).w, sy); sy += size(s).h + V; }
        bottom = Math.max(bottom, sy - V);
      }
      return { bottom: Math.max(bottom, rowBottom), right: sx - GAP };
    },

    // scripts one below the other, group by group, with room for the frames between groups
    arrange(cmdIds, x, y) {
      const rank = (id) => { const i = groups.indexOf(this.groupOf(this.sidOf(id))); return i < 0 ? groups.length : i; };
      const data = df.drawflow.drawflow.Home.data;
      const list = [...cmdIds].sort((a, b) => rank(a) - rank(b) || data[a].pos_y - data[b].pos_y);
      let last = null;
      for (const id of list) {
        const g = rank(id);
        if (last !== null) y += g === last ? 120 : 220;
        last = g;
        y = this.layoutScript(id, x, y).bottom;
      }
      return y;
    },

    // the Sort button: every script laid out again (undoable)
    tidy() {
      this.arrange(Object.values(df.drawflow.drawflow.Home.data).filter((n) => kindOf(n) === "command").map((n) => String(n.id)), 0, 0);
      this.refresh();
      this.fit();
    },

    // a group's sort button: only its scripts, where the group is now
    sortGroup(g) {
      this.arrange(this.groupCommands(g).map((n) => String(n.id)), g.x + 40, g.y + 84);
      this.refresh();
    },

    rebuild() {
      for (const f of Object.keys(bases)) delete bases[f];
      this.results = [];
      this.buildFrom(this.snapshotFromScripts(), true);
      history.past = []; history.future = []; history.last = this.serialize();
      this.canUndo = this.canRedo = false;
      this.fit();
    },

    /* ---------- undo / redo: snapshots of the whole graph ---------- */

    serialize() {
      const data = df.drawflow.drawflow.Home.data;
      const nodes = Object.values(data).map((n) => ({ id: String(n.id), kind: kindOf(n), x: n.pos_x, y: n.pos_y, values: this.fields(n.id), meta: meta.get(String(n.id)) }));
      const edges = [];
      for (const n of Object.values(data)) {
        for (const [out, o] of Object.entries(n.outputs)) for (const c of o.connections) edges.push([String(n.id), out, String(c.node), c.output]);
      }
      return JSON.stringify({ nodes, edges, groups });
    },

    // every action is its own undo step; only typing is grouped, so a word isn't one step per letter
    remember(typing = false) {
      if (building || restoring) return;
      clearTimeout(history.timer);
      if (typing) {
        history.pending = true;
        history.timer = setTimeout(() => this.commitHistory(), 400);
      } else {
        this.commitHistory();
      }
    },

    commitHistory() {
      history.pending = false;
      const now = this.serialize();
      if (now === history.last) return;
      if (history.last) history.past.push(history.last);
      if (history.past.length > 100) history.past.shift();
      history.last = now;
      history.future = [];
      this.canUndo = history.past.length > 0;
      this.canRedo = false;
    },

    restore(snap) {
      restoring = true;
      const view = [df.zoom, df.canvas_x, df.canvas_y];
      this.buildFrom(JSON.parse(snap));
      this.setView(...view);
      history.last = this.serialize(); // node ids change on every rebuild
      restoring = false;
      this.canUndo = history.past.length > 0;
      this.canRedo = history.future.length > 0;
    },

    undo() {
      // an edit still waiting for its snapshot becomes its own undo step first; a refresh without a change
      // (like leaving a field) is not one. last is always serialized fresh, so comparing text is reliable here.
      if (history.pending) { clearTimeout(history.timer); this.commitHistory(); }
      if (!history.past.length) return;
      history.future.push(history.last);
      this.restore(history.past.pop());
    },

    redo() {
      if (!history.future.length) return;
      history.past.push(history.last);
      this.restore(history.future.pop());
    },

    // A step calls a script when its command starts with that script's name or alias AND it runs where
    // that script is registered. Elsewhere the same word is just that server's own command (e.g. /eco).
    // A step calls a script when its command starts with that script's name or alias AND it runs where
    // that script is registered. Elsewhere the same word is just that server's own command (e.g. /eco).
    syncCalls() {
      syncingCalls = true;
      const data = df.drawflow.drawflow.Home.data;
      const servers = (n, port) => (n?.inputs[port]?.connections || []).map((k) => { const t = this.target(k.node); return `${t.id}@${t.location}`; });
      const byName = new Map();
      for (const n of Object.values(data)) {
        if (kindOf(n) !== "command") continue;
        const reg = new Set(servers(n, P.cmd.reg));
        const names = [this.fields(n.id).name, ...n.inputs[P.cmd.aliases].connections.flatMap((c) => splitList(this.fields(c.node).aliases))];
        for (const name of names) if (name) (byName.get(name.toLowerCase()) || byName.set(name.toLowerCase(), []).get(name.toLowerCase())).push({ id: String(n.id), reg });
      }
      for (const cmd of Object.values(data).filter((n) => kindOf(n) === "command")) {
        const defaults = servers(data[cmd.inputs[P.cmd.defaults].connections[0]?.node], P.def.targets);
        const seen = new Set();
        for (let n = data[cmd.outputs.output_1.connections[0]?.node]; n && !seen.has(n.id); n = data[n.outputs.output_1.connections[0]?.node]) {
          seen.add(n.id);
          if (kindOf(n) !== "run") continue;
          const own = servers(n, P.run.targets), where = own.length ? own : defaults;
          const first = (this.fields(n.id).command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
          const want = (byName.get(first) || []).find((c) => c.id !== String(cmd.id) && where.some((w) => c.reg.has(w)))?.id;
          const have = n.outputs[P.run.calls].connections[0]?.node;
          if (have && have !== want) df.removeSingleConnection(n.id, have, P.run.calls, P.cmd.calledBy);
          if (want && have !== want) df.addConnection(n.id, want, P.run.calls, P.cmd.calledBy);
        }
      }
      syncingCalls = false;
    },

    fileOf(cmdId) {
      if (!cmdId) return null;
      return meta.get(cmdId)?.file || (this.fields(cmdId).name || "new") + ".yml";
    },

    collect() {
      const data = df.drawflow.drawflow.Home.data;
      const nodes = Object.values(data);
      const problems = [], scripts = [];
      owner = new Map();
      owners = new Map();
      // a node belongs to every script that reaches it; the first one keeps its layout
      const own = (id, cmd) => {
        id = String(id);
        (owners.get(id) || owners.set(id, new Set()).get(id)).add(cmd);
        if (!owner.has(id)) owner.set(id, cmd);
      };
      const from = (n, port) => (n?.inputs[port]?.connections || []).map((k) => data[k.node]).filter(Boolean).sort((a, b) => a.pos_y - b.pos_y);
      const durationOk = (v) => !v || RULES.duration[0].test(v);

      const field = (node, f) => ({ node: String(node.id), sel: `[data-f="${f}"]` });
      for (const cmd of nodes.filter((n) => kindOf(n) === "command")) {
        const id = String(cmd.id), f = this.fields(id), file = this.fileOf(id), info = meta.get(id) || {};
        // at: where the problem is shown, { node, sel } for a field or { node, port } for a port
        const bad = (text, at) => problems.push({ file, script: f.name, text, at, blocking: true });
        const target = (n) => { own(n.id, id); return this.target(n.id); };
        own(id, id);
        if (!RULES.name[0].test(f.name)) bad("Use " + RULES.name[1], field(cmd, "name"));

        const aliases = from(cmd, P.cmd.aliases).flatMap((n) => {
          own(n.id, id);
          const list = splitList(this.fields(n.id).aliases);
          if (!list.length) bad("Add an alias, or delete this node", { node: String(n.id), sel: ".al-new" });
          for (const a of list) if (!RULES.alias[0].test(a)) bad("Use " + RULES.alias[1], { node: String(n.id), sel: `.tag[data-v="${CSS.escape(a)}"]` });
          return list;
        });

        // arguments are positional: top to bottom on the canvas
        const names = new Set();
        const args = from(cmd, P.cmd.args).map((n, i) => {
          own(n.id, id);
          const label = document.querySelector(`#node-${n.id} .nk`), title = `Argument ${i + 1}<em>${esc(this.fields(n.id).name)}</em>`;
          if (label && label.innerHTML !== title) label.innerHTML = title;
          const a = this.fields(n.id);
          if (a.name && RULES.argname[0].test(a.name) && names.has(a.name)) bad(`Another argument is already named ${a.name}`, field(n, "name"));
          if (!RULES.suggestions[0].test(a.suggestions)) bad("Use " + RULES.suggestions[1], field(n, "suggestions"));
          if (!a.name || !RULES.argname[0].test(a.name)) bad(a.name ? "Use " + RULES.argname[1] : "Required", field(n, "name"));
          names.add(a.name);
          return { name: a.name, type: a.type, required: a.required === "true", suggestions: splitList(a.suggestions), _src: meta.get(String(n.id))?.src, node: n };
        });
        let optional = false;
        args.forEach((a) => { if (!a.required) optional = true; else if (optional) bad("A required argument can't come after an optional one", field(a.node, "required")); });
        args.forEach((a, i) => { if (["TEXT", "GREEDY_STRING"].includes(a.type) && i < args.length - 1) bad(`${a.type} takes the rest of the line, so it has to be the last argument`, field(a.node, "type")); });
        args.forEach((a) => delete a.node);
        // a player comes from one of this script's arguments that CB can resolve to a player
        const player = (name, at) => {
          if (!name) return undefined;
          const a = args.find((x) => x.name === name);
          if (!a) bad(`/${f.name} has no argument ${name}`, at);
          else if (!PLAYER_TYPES.includes(a.type)) bad(`${a.name} is ${a.type}, which can't be a player`, at);
          else if (!a.required) bad(`Make ${a.name} required: the server check needs a player`, at);
          return name;
        };

        const register = from(cmd, P.cmd.reg).map(target);
        const defNode = from(cmd, P.cmd.defaults)[0];
        let defaults = { "run-as": "CONSOLE", execute: [], server: {} };
        if (defNode) {
          own(defNode.id, id);
          const d = this.fields(defNode.id);
          for (const k of ["d-delay", "d-cooldown"]) if (!durationOk(d[k])) bad("Use " + RULES.duration[1], field(defNode, k));
          defaults = {
            "run-as": d["d-runas"] || "CONSOLE", execute: from(defNode, P.def.targets).map(target),
            delay: d["d-delay"] || undefined, cooldown: d["d-cooldown"] || undefined,
            server: { "target-required": d["d-target"] === "true", "schedule-online": d["d-online"] === "true", "player-arg": player(d["d-player"], field(defNode, "d-player")) },
          };
        } else {
          bad("Wire a Defaults node here", { node: id, port: "defaults" });
        }

        const commands = [];
        let cur = data[cmd.outputs[P.cmd.then].connections[0]?.node], delay, nowhere = false;
        const seen = new Set();
        while (cur && !seen.has(cur.id)) {
          seen.add(cur.id);
          own(cur.id, id);
          const s = this.fields(cur.id);
          if (kindOf(cur) === "wait") {
            delay = s.delay;
            if (!s.delay || !durationOk(s.delay)) bad(s.delay ? "Use " + RULES.duration[1] : "Required", field(cur, "delay"));
            if (!cur.outputs.output_1.connections.length) bad("Nothing comes after this Wait", { node: String(cur.id), sel: ".nh" });
          } else {
            if (!s.command) bad("Required", field(cur, "command"));
            for (const p of new Set([...s.command.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((p) => !names.has(p)))) {
              bad(`/${f.name} has no argument ${p}`, { node: String(cur.id), sel: `.ph[data-arg="${CSS.escape(p)}"]` });
            }
            const execute = from(cur, P.run.targets).map(target);
            nowhere ||= !execute.length && !defaults.execute.length;
            const ra = from(cur, P.run.runas)[0], cd = from(cur, P.run.cooldown)[0], rules = from(cur, P.run.rules)[0];
            [ra, cd, rules].forEach((v) => v && own(v.id, id));
            const r = rules && this.fields(rules.id);
            if (cd && (!this.fields(cd.id).cooldown || !durationOk(this.fields(cd.id).cooldown))) bad(this.fields(cd.id).cooldown ? "Use " + RULES.duration[1] : "Required", field(cd, "cooldown"));
            commands.push({
              command: s.command, "run-as": ra ? this.fields(ra.id).value : undefined, delay, cooldown: cd ? this.fields(cd.id).cooldown : undefined, execute, _src: meta.get(String(cur.id))?.src,
              server: rules ? { "target-required": r["r-target"] === "true", "schedule-online": r["r-online"] === "true", "player-arg": player(r["r-player"], field(rules, "r-player")) } : undefined,
            });
            delay = undefined;
          }
          cur = data[cur.outputs.output_1.connections[0]?.node];
        }
        // the defaults' servers are where every step without its own runs
        if (nowhere && defNode) bad("Wire the Server the steps run on", { node: String(defNode.id), port: "targets" });
        if (!commands.length) bad("Connect an Execute step", { node: id, port: "then" });
        if (!register.length) bad("Wire the Server this command is registered on", { node: id, port: "registered on" });
        // older schemas differ in structure; bumping the number alone would corrupt the script
        if (info.version != null && String(info.version) !== "4") bad(`${file} uses schema version ${info.version}. Run /cb migrate on the proxy first.`);

        scripts.push({
          id, file, sid: this.sidOf(id), isNew: !info.file,
          model: {
            version: info.version ?? 4, name: f.name, description: f.description || undefined, enabled: f.enabled === "true",
            aliases, permissions: { enabled: f.perm === "true", silent: f.silent === "true" }, register, defaults, args, commands,
          },
        });
      }

      // anything not wired into a script would silently vanish
      for (const n of nodes) {
        if (!owner.has(String(n.id))) problems.push({ file: null, text: "Not connected to any script", at: { node: String(n.id), sel: ".nh" }, blocking: true });
      }

      const byName = new Map();
      for (const s of scripts) for (const name of [s.model.name, ...s.model.aliases]) byName.set(name, [...(byName.get(name) || []), s]);
      for (const s of scripts) {
        const err = (text, at) => problems.push({ file: s.file, script: s.model.name, text, at, blocking: true });
        for (const name of [s.model.name, ...s.model.aliases]) {
          const others = [...new Set(byName.get(name).filter((o) => o !== s).map((o) => "/" + o.model.name))];
          if (!others.length) continue;
          const text = `/${name} is also used by ${others.join(", ")}`;
          if (name === s.model.name) err(text, { node: s.id, sel: '[data-f="name"]' });
          else err(text, { node: s.id, port: "aliases" });
        }
        if (s.isNew && this.scripts[s.file] !== undefined) err(`${s.file} already exists on the proxy`, { node: s.id, sel: '[data-f="name"]' });
      }
      for (const file of Object.keys(this.scripts)) {
        try { conv.toModel(YAML, this.scripts[file]); } catch (e) { problems.push({ file, text: `${file} is not valid YAML. Fix it in a text editor: ${e.message}`, blocking: false }); }
      }
      return { scripts, problems };
    },

    // positions and groups for editor-layout.json, keyed so they survive reloads
    // positions and groups for editor-layout.json, keyed so they survive reloads
    layoutNow(scripts) {
      const data = df.drawflow.drawflow.Home.data;
      const nodes = {};
      for (const s of scripts) {
        const count = {};
        for (const [nodeId, cmd] of owner) {
          const n = data[nodeId];
          if (cmd !== s.id || !n) continue;
          const k = kindOf(n);
          const key = k === "command" ? "cmd" : k + (count[k] = (count[k] ?? -1) + 1);
          nodes[`${s.file}#${key}`] = { x: Math.round(n.pos_x), y: Math.round(n.pos_y) };
        }
      }
      // the file stores groups by file name; unsaved scripts have none yet and drop out on the next load
      const fileOfSid = new Map(scripts.map((s) => [s.sid, s.file]));
      return { version: LAYOUT_VERSION, nodes, groups: groups.map((g) => ({ ...g, members: g.members.map((m) => fileOfSid.get(m) || m) })) };
    },

    refresh(typing = false) {
      if (building || !conv) return;
      const { scripts, problems } = this.collect();
      this.refreshDynamic(scripts);
      const out = {};
      for (const s of scripts) {
        try {
          // text edited in the YAML panel is the base, so its comments and layout stay
          out[s.file] = conv.fromModel(YAML, bases[s.file] ?? this.scripts[s.file] ?? this.newScript(s.model.name), s.model);
        } catch (e) {
          problems.push({ file: s.file, text: `${s.file} could not be turned into YAML: ${e.message}`, blocking: true });
        }
      }
      // every script is in one group; groups of scripts that are gone go too
      const sids = new Set(scripts.map((s) => s.sid));
      for (const g of groups) g.members = g.members.filter((m) => sids.has(m));
      groups = groups.filter((g) => g.members.length);
      for (const s of scripts) {
        if (!this.groupOf(s.sid)) groups.push(this.scriptGroup(s.sid, "/" + s.model.name));
        // a script's own group is named after it, until someone names the group
        const own = groups.find((g) => g.auto && !g.named && g.members.length === 1 && g.members[0] === s.sid);
        if (own) own.title = "/" + s.model.name;
      }
      this.fitGroups();
      this.renderGroups();
      const present = new Set([...meta.values()].map((m) => m.file).filter(Boolean));
      this.deletions = this.loadedFiles.filter((f) => !present.has(f) && this.scripts[f] !== undefined);
      this.out = out;
      // only problems in scripts that would be saved, or loose nodes, block saving
      const pinned = this.markProblems(problems);
      this.problems = problems.map((p) => ({ ...p, pinned: pinned.has(p), blocking: p.blocking && (p.file === null || out[p.file] !== this.scripts[p.file]) }));
      this.remember(typing);
      this.saveLayoutSoon(scripts);
      this.saveDraftSoon();
      // a change after Save makes the waiting code save something older: take it back
      if (staged && this.confirmCode && JSON.stringify(this.changeSet()) !== staged) this.cancelStage();
      this.drawMinimap();
    },

    saveLayoutSoon(scripts) {
      if (restoring || this.status !== "online") return;
      const next = this.layoutNow(scripts);
      clearTimeout(layoutTimer);
      layoutTimer = setTimeout(() => {
        const text = JSON.stringify(next);
        if (text === lastLayout) return;
        lastLayout = text;
        layout = next;
        this.send({ type: "layout", layout: next });
      }, 800);
    },

    changes() {
      return Object.keys(this.out).filter((f) => this.out[f] !== this.scripts[f]).length + this.deletions.length;
    },

    blocking() { return this.problems.filter((p) => p.blocking); },

    // the YAML panel: every script file with what saving does to it, and the chosen one, highlighted
    yamlFiles() {
      const files = [...new Set([...Object.keys(this.out), ...Object.keys(this.scripts)])].sort();
      const state = (f) => this.deletions.includes(f) ? "deleted" : this.scripts[f] === undefined ? "new"
        : this.out[f] === undefined ? "unread" : this.out[f] !== this.scripts[f] ? "changed" : "saved";
      const order = { new: 0, changed: 1, deleted: 2, unread: 3, saved: 4 };
      return files.map((file) => ({ file, state: state(file) })).sort((a, b) => order[a.state] - order[b.state] || a.file.localeCompare(b.file));
    },

    fileIcon() { return svg(LUCIDE.file, 14); },

    // the YAML panel's left edge drags its width
    resizeYaml(e) {
      const panel = e.currentTarget.parentElement, grip = e.currentTarget, right = panel.getBoundingClientRect().right;
      grip.classList.add("on");
      const move = (ev) => panel.style.setProperty("--yaml-w", Math.max(320, right - ev.clientX) + "px");
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", () => { window.removeEventListener("mousemove", move); grip.classList.remove("on"); this.drawMinimap(); }, { once: true });
    },

    yamlFile() {
      const files = this.yamlFiles().map((f) => f.file);
      return [this.yamlPick, this.selectedFile].find((f) => f && files.includes(f)) || files[0];
    },

    yamlState() {
      return this.yamlFiles().find((f) => f.file === this.yamlFile())?.state || "";
    },

    // what the file will be after saving; a deleted file shows what goes away
    yamlText() {
      const f = this.yamlFile();
      if (this.yamlDraft && this.yamlDraft.file === f) return this.yamlDraft.text;
      return (this.deletions.includes(f) ? this.scripts[f] : this.out[f] ?? this.scripts[f]) ?? "";
    },

    // problems in the YAML with where they are: parse errors, wrong value types, unknown or missing keys
    yamlLint(text) {
      if (lint.text === text) return lint;
      const marks = [];
      const at = (node, msg, warn = false) => { const r = node?.range; if (r) marks.push({ from: r[0], to: Math.max(r[1], r[0] + 1), msg, warn }); };
      let doc;
      try { doc = YAML.parseDocument(text); } catch (e) { doc = null; }
      for (const e of doc?.errors || []) marks.push({ from: e.pos[0], to: Math.max(e.pos[1], e.pos[0] + 1), msg: e.message.split("\n")[0] });
      const argNames = new Set((doc?.toJS?.()?.args || []).map((a) => a?.name).filter(Boolean));
      const types = window.cbArgTypes || [];
      const walk = (node, sch) => {
        if (!sch || node == null) return;
        const scalar = YAML.isScalar(node), v = scalar ? node.value : undefined;
        if (sch.type === "map") {
          if (!YAML.isMap(node)) return at(node, "Should be a section of keys");
          const seen = new Set();
          for (const pair of node.items) {
            const k = pair.key?.value;
            seen.add(k);
            if (!(k in sch.keys)) at(pair.key, `Unknown key ${k}`, true);
            else walk(pair.value, sch.keys[k]);
          }
          for (const k of sch.required) if (!seen.has(k)) at({ range: [node.range[0], node.range[0] + 1] }, `Missing ${k}`);
        } else if (sch.type === "list") {
          if (!YAML.isSeq(node)) return at(node, "Should be a list");
          node.items.forEach((item) => walk(item, sch.of));
        } else if (!scalar) {
          at(node, `Should be ${Y_HINTS[sch.type] === "text" ? "text" : "a single value"}`);
        } else if (sch.type === "bool" && typeof v !== "boolean") at(node, "Should be true or false");
        else if (sch.type === "int" && !Number.isInteger(v)) at(node, "Should be a whole number");
        else if (sch.type === "dur" && !RULES.duration[0].test(String(v))) at(node, "Should be " + RULES.duration[1]);
        else if (sch.type === "name" && !RULES.name[0].test(String(v))) at(node, "Should be " + RULES.name[1]);
        else if (sch.type === "enum" && !(sch.values || types).includes(String(v))) at(node, `Should be one of ${(sch.values || types).join(", ")}`);
        else if (sch.type === "arg" && v && !argNames.has(String(v))) at(node, `No argument named ${v}`);
      };
      if (doc && !doc.errors.length) walk(doc.contents, Y_SCRIPT);
      const lines = [];
      const starts = [0];
      for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
      const lineOf = (pos) => { let l = 0; while (l + 1 < starts.length && starts[l + 1] <= pos) l++; return l; };
      for (const m of marks) (lines[lineOf(m.from)] ||= []).push(m);
      lint = { text, marks, lines };
      return lint;
    },

    // the same text, see-through, with the problems underlined; it lies under the typing field
    yamlLintHtml() {
      const text = this.yamlText(), { marks } = this.yamlLint(text);
      let html = "", pos = 0;
      for (const m of [...marks].sort((a, b) => a.from - b.from)) {
        if (m.from < pos) continue;
        html += esc(text.slice(pos, m.from)) + `<span class="${m.warn ? "lint-w" : "lint-e"}">${esc(text.slice(m.from, m.to)) || " "}</span>`;
        pos = m.to;
      }
      return html + esc(text.slice(pos)) + "\n";
    },

    // what the caret's line has wrong, shown above the code
    yamlLineMsg() {
      const ms = this.yamlLint(this.yamlText()).lines[this.yamlLine];
      return ms ? ms.map((m) => m.msg).join("; ") : "";
    },

    yamlCaret(t) {
      this.yamlLine = t.value.slice(0, t.selectionStart).split("\n").length - 1;
    },

    // the schema for a line, from the keys it sits under; list items count as one step down
    yamlSchemaAt(lines, li, col) {
      const keyCol = (l) => { const m = l.match(/^(\s*)(- )?([\w-]+):/); return m ? m[1].length + (m[2] ? 2 : 0) : -1; };
      const path = [];
      let c = col;
      for (let i = li - 1; i >= 0 && c > 0; i--) {
        const kc = keyCol(lines[i]);
        if (kc >= 0 && kc < c) { path.unshift(lines[i].match(/([\w-]+):/)[1]); c = kc; }
      }
      let sch = Y_SCRIPT;
      for (const k of path) {
        if (sch?.type === "list") sch = sch.of;
        sch = sch?.type === "map" ? sch.keys[k] : null;
      }
      if (sch?.type === "list") sch = sch.of;
      return sch;
    },

    // completion at the caret, like nvim-cmp: keys where a key goes, values after a key
    yamlComplete(t, force = false) {
      const text = t.value, caret = t.selectionStart;
      const lineStart = text.lastIndexOf("\n", caret - 1) + 1, before = text.slice(lineStart, caret);
      const lines = text.split("\n"), li = text.slice(0, caret).split("\n").length - 1;
      let items = [], from = caret;
      const val = before.match(/^(\s*)(- )?([\w-]+):\s*([^\s#]*)$/);
      const key = before.match(/^(\s*)(- )?([\w-]*)$/);
      if (val) {
        const sch = this.yamlSchemaAt(lines, li, val[1].length + (val[2] ? 2 : 0));
        const s2 = sch?.type === "map" ? sch.keys[val[3]] : null, typed = val[4];
        from = caret - typed.length;
        const opts = !s2 ? [] : s2.type === "bool" ? ["true", "false"] : s2.type === "enum" ? s2.values || window.cbArgTypes || []
          : s2.type === "dur" ? ["0s", "500ms", "1s", "5s", "10s", "30s", "1m", "5m", "1h", "24h"] : s2.type === "server" ? [...this.knownServers().keys()].map((id) => `"${id}"`)
          : s2.type === "arg" ? (conv && (() => { try { return conv.toModel(YAML, text).args.map((a) => a.name); } catch { return []; } })()) || [] : [];
        if (!before.endsWith(":") || force) items = opts.filter((o) => o.toLowerCase().startsWith(typed.toLowerCase()) && o !== typed).map((o) => ({ label: o, kind: Y_HINTS[s2.type] }));
      } else if (key && (key[3] || force)) {
        const col = key[1].length + (key[2] ? 2 : 0);
        const sch = this.yamlSchemaAt(lines, li, col);
        if (sch?.type === "map") {
          // keys already in this block (this list item) aren't offered again
          const kc = (l) => { const m = l.match(/^(\s*)(- )?([\w-]+):/); return m ? [m[1].length + (m[2] ? 2 : 0), m[3], !!m[2]] : null; };
          const have = new Set();
          for (let i = li - 1; i >= 0; i--) { const k = kc(lines[i]); if (!k) continue; if (k[0] < col) break; if (k[0] === col) { have.add(k[1]); if (k[2]) break; } }
          for (let i = li + 1; i < lines.length; i++) { const k = kc(lines[i]); if (!k) continue; if (k[0] < col || (k[0] === col && k[2])) break; if (k[0] === col) have.add(k[1]); }
          from = caret - key[3].length;
          items = Object.entries(sch.keys).filter(([k]) => !have.has(k) && k.startsWith(key[3]) && k !== key[3]).map(([k, v]) => ({ label: k, kind: Y_HINTS[v.type] || "key", key: true, block: ["map", "list"].includes(v.type) }));
        }
      }
      if (!items.length) { this.yamlSugg = null; return; }
      // where the caret is, from the monospace cell size
      const cell = this.yamlCell(t), col = caret - lineStart;
      this.yamlSugg = { items: items.slice(0, 50), sel: 0, from, to: caret, x: 16 + (from - lineStart) * cell.w - t.scrollLeft, y: 12 + (li + 1) * cell.h };
    },

    yamlCell(t) {
      if (!yamlCellSize) {
        const probe = document.createElement("span");
        probe.textContent = "M".repeat(10);
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit";
        t.parentElement.querySelector(".ed-yaml-code").append(probe);
        yamlCellSize = { w: probe.getBoundingClientRect().width / 10, h: parseFloat(getComputedStyle(t).lineHeight) };
        probe.remove();
      }
      return yamlCellSize;
    },

    yamlAccept(i) {
      const sg = this.yamlSugg, t = document.querySelector(".ed-yaml-ta"), item = sg?.items[i ?? sg.sel];
      if (!item) return;
      const indent = (t.value.slice(0, sg.from).match(/(^|\n)(\s*)(- )?[^\n]*$/)?.[2] || "") + (t.value.slice(0, sg.from).match(/(^|\n)\s*- [^\n]*$/) ? "  " : "");
      const insert = item.key ? (item.block ? `${item.label}:\n${indent}  ` : `${item.label}: `) : item.label;
      t.focus();
      t.setRangeText(insert, sg.from, sg.to, "end");
      this.yamlSugg = null;
      this.yamlInput({ target: t });
      if (item.key && !item.block) this.yamlComplete(t, true);
    },

    // keys while typing YAML: the completion list takes arrows, Tab, Enter and Escape when it's open
    yamlKey(e) {
      const sg = this.yamlSugg, t = e.target;
      if (sg) {
        const n = sg.items.length;
        if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n") || (e.key === "Tab" && !e.shiftKey)) { e.preventDefault(); sg.sel = (sg.sel + 1) % n; return; }
        if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p") || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); sg.sel = (sg.sel - 1 + n) % n; return; }
        if (e.key === "Enter") { e.preventDefault(); this.yamlAccept(); return; }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.yamlSugg = null; return; }
      }
      if (e.ctrlKey && e.key === " ") { e.preventDefault(); this.yamlComplete(t, true); return; }
      if (e.key === "Tab") { e.preventDefault(); this.yamlTab(e); return; }
      if (e.key === "Escape") t.blur();
    },

    yamlEditable() {
      return ["new", "changed", "saved"].includes(this.yamlState());
    },

    yamlInput(e) {
      this.yamlError = ""; // the underlines show what's wrong while typing
      this.yamlDraft = { file: this.yamlFile(), text: e.target.value };
      clearTimeout(yamlTimer);
      yamlTimer = setTimeout(() => this.yamlApply(), 700);
    },

    // edited YAML that parses becomes the graph: the script's nodes are rebuilt, everything keeps its place
    yamlApply() {
      clearTimeout(yamlTimer);
      const draft = this.yamlDraft;
      if (!draft) return;
      try { conv.toModel(YAML, draft.text); } catch (e) { this.yamlError = e.message.split("\n")[0]; return; }
      this.yamlError = "";
      if (draft.text === this.out[draft.file]) { this.yamlDraft = null; return; }
      const texts = { ...this.scripts, ...this.out, [draft.file]: draft.text };
      for (const f of this.deletions) delete texts[f];
      bases[draft.file] = draft.text;
      layout = this.layoutNow(this.collect().scripts);
      const view = [df.zoom, df.canvas_x, df.canvas_y];
      this.buildFrom(this.snapshotFromScripts(texts), true);
      this.setView(...view);
      this.yamlDraft = null;
    },

    // Tab indents by two spaces in the YAML, like an editor
    yamlTab(e) {
      const t = e.target, a = t.selectionStart;
      t.setRangeText("  ", a, t.selectionEnd, "end");
      this.yamlInput(e);
    },

    // highlighting in the editor's own colors: keys, strings, numbers, switches, enums, comments and ${arguments}
    yamlHtml() {
      const value = (v) => {
        const m = v.match(/^(\s*)(.*?)(\s+#.*)?$/);
        let body = m[2];
        if (/^(true|false|null)$/.test(body)) body = `<span class="y-bool">${body}</span>`;
        else if (/^-?\d+(\.\d+)?(ms|s|m|h)?$/.test(body)) body = `<span class="y-num">${body}</span>`;
        else if (/^[A-Z][A-Z0-9_]*$/.test(body)) body = `<span class="y-enum">${body}</span>`;
        else if (/^\[.*\]$/.test(body)) body = `<span class="y-punct">${esc(body)}</span>`;
        else if (body) body = `<span class="y-str">${esc(body).replace(/\$\{([^}]*)\}/g, '<span class="y-arg">$1</span>')}</span>`;
        return m[1] + body + (m[3] ? `<span class="y-com">${esc(m[3])}</span>` : "");
      };
      return this.yamlText().split("\n").map((line) => {
        if (/^\s*#/.test(line)) return `<span class="y-com">${esc(line)}</span>`;
        const m = line.match(/^(\s*)(- )?([A-Za-z0-9_-]+)(:)(.*)$/);
        if (m) return `${m[1]}${m[2] ? '<span class="y-punct">- </span>' : ""}<span class="y-key">${m[3]}</span><span class="y-punct">:</span>${value(m[5])}`;
        const d = line.match(/^(\s*)- (.*)$/);
        return d ? `${d[1]}<span class="y-punct">- </span>${value(" " + d[2]).slice(1)}` : esc(line);
      }).join("\n");
    },

    yamlGutter() {
      const f = this.yamlFile(), state = this.yamlState();
      const saved = new Set((this.scripts[f] ?? "").split("\n"));
      const { lines } = this.yamlLint(this.yamlText());
      return this.yamlText().split("\n").map((l, i) => {
        const ms = lines[i], cls = [state === "new" ? "add" : state === "deleted" ? "del" : state === "changed" && !saved.has(l) ? "chg" : "", ms ? (ms.every((m) => m.warn) ? "lw" : "le") : ""].join(" ");
        return `<span class="${cls}"${ms ? ` data-err="${esc(ms.map((m) => m.msg).join("\n"))}"` : ""}>${i + 1}</span>`;
      }).join("\n");
    },

    newScript(name) {
      return `version: 4\n\nname: ${name}\nenabled: true\n\npermissions:\n  enabled: true\n  silent: false\n\nregister: []\n\ndefaults:\n  run-as: CONSOLE\n\nargs: []\n\ncommands: []\n`;
    },

    // a new script gets its own row below everything else, one step, and is registered on the proxy
    // a new script gets its own row below everything else, one step, and is registered on the proxy
    addScript(at) {
      const taken = new Set(Object.values(df.drawflow.drawflow.Home.data).filter((n) => kindOf(n) === "command").map((n) => this.fields(n.id).name));
      let name = "new-command", i = 2;
      while (taken.has(name) || this.scripts[name + ".yml"] !== undefined) name = "new-command-" + i++;
      const b = this.bounds();
      const x = at ? at.x : 0, y = at ? at.y : b ? b.y1 + 220 : 0;
      const proxyId = Object.keys(this.servers).find((id) => this.servers[id].location === "VELOCITY");
      const cmd = this.place("command", x, y, { name });
      df.addConnection(cmd, this.place("run", x, y, { command: "say hello" }), "output_1", P.run.after);
      const def = this.place("defaults", x, y, {});
      df.addConnection(def, cmd, "output_1", P.cmd.defaults);
      // registered on the proxy and running there, until changed
      if (proxyId) {
        df.addConnection(this.place("server", x, y, { id: proxyId, location: "VELOCITY" }), cmd, "output_1", P.cmd.reg);
        df.addConnection(this.place("server", x, y, { id: proxyId, location: "VELOCITY" }), def, "output_1", P.def.targets);
      }
      this.collect(); // who owns the new nodes, for the layout
      const end = this.layoutScript(cmd, x, y);
      if (!at) this.centerOn(x + (end.right - x) / 2, y + (end.bottom - y) / 2);
      selected.clear(); selected.add(cmd); this.paintSelection();
      document.querySelector(`#node-${cmd} [data-f="name"]`).select();
      this.refresh();
    },

    /* ================= save ================= */

    // what saving would write: changed and new files, and the files to delete
    changeSet() {
      const files = {};
      for (const f of Object.keys(this.out)) if (this.out[f] !== this.scripts[f]) files[f] = this.out[f];
      return { files, deletions: [...this.deletions] };
    },

    // Save stages the changes on the proxy; they are written once someone runs the confirm command there
    save() {
      this.refresh();
      if (this.blocking().length || !this.changes()) return;
      this.results = [];
      this.busy = true;
      const set = this.changeSet();
      staged = JSON.stringify(set);
      this.send({ type: "stage", ...set });
    },

    cancelStage() {
      staged = null;
      this.confirmCode = null;
      this.send({ type: "unstage" });
    },

    copyConfirm() {
      navigator.clipboard?.writeText(`/cb editor confirm ${this.confirmCode}`);
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 1500);
    },

    // unsaved work is kept on the proxy, so closing the tab or a new link doesn't lose it
    saveDraftSoon() {
      if (restoring || this.status !== "online") return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        const set = this.changeSet();
        const text = JSON.stringify(set);
        if (text === lastDraft) return;
        lastDraft = text;
        this.send({ type: "draft", draft: Object.keys(set.files).length || set.deletions.length ? { ...set, at: Date.now() } : {} });
      }, 1500);
    },

    // a draft from earlier is laid over the saved scripts, the same way an edit in the YAML panel is
    restoreDraft(d) {
      const texts = { ...this.scripts, ...d.files };
      for (const f of d.deletions || []) delete texts[f];
      for (const [f, t] of Object.entries(d.files)) bases[f] = t;
      this.buildFrom(this.snapshotFromScripts(texts), true);
      history.past = []; history.future = []; history.last = this.serialize();
      this.canUndo = this.canRedo = false;
      this.fit();
      this.results = [{ ok: true, warning: true, restored: true, text: `Restored the unsaved changes from ${new Date(d.at || Date.now()).toLocaleString()}.` }];
    },

    // drops an offered draft without looking at it, here and on the proxy
    dropDraft() {
      this.results = this.results.filter((r) => !r.offer);
      lastDraft = "{}";
      this.send({ type: "draft", draft: {} });
    },

    discardDraft() {
      this.results = [];
      this.rebuild();
    },

    /* ================= connection ================= */

    send(msg) {
      this.relay.send(msg);
    },

    receive(msg) {
      if (msg.type === "state") {
        const first = this.status !== "online";
        // files we just saved or deleted changed because of us; anything else changed on the proxy
        const ours = new Set(this.justSaved);
        const external = Object.keys({ ...this.scripts, ...msg.scripts }).some((f) => this.scripts[f] !== msg.scripts[f] && !ours.has(f));
        const hadChanges = this.changes() > 0;
        this.scripts = msg.scripts;
        this.servers = msg.servers || {};
        this.confirmCode = msg.pending || null;
        if (first) { layout = msg.layout || layout; lastLayout = JSON.stringify(layout); }
        this.status = "online";
        if (first) {
          this.loadedFiles = Object.keys(msg.scripts);
          this.rebuild();
          // keeps the session alive while the tab is open; the proxy closes it a few minutes after the tab is gone
          setInterval(() => this.send({ type: "ping" }), 60_000);
          const d = msg.draft;
          // a draft is offered, not applied: it could have been left by anyone who had an editor link
          if (d?.files && (Object.keys(d.files).some((f) => d.files[f] !== msg.scripts[f]) || d.deletions?.length))
            this.results.push({ ok: true, warning: true, offer: d, text: `There are unsaved changes from ${new Date(d.at || Date.now()).toLocaleString()}. Review them before you save.` });
          lastDraft = JSON.stringify(this.changeSet());
          if (this.confirmCode) staged = lastDraft;
        } else if (external && !hadChanges) {
          this.loadedFiles = Object.keys(msg.scripts);
          this.rebuild();
        } else {
          this.loadedFiles = [...new Set([...this.loadedFiles, ...Object.keys(msg.scripts)])].filter((f) => msg.scripts[f] !== undefined);
          if (external) this.results.push({ ok: true, warning: true, text: "Scripts changed on the proxy. Revert to load them." });
          this.refresh();
        }
      } else if (msg.type === "staged") {
        this.busy = false;
        const bad = Object.entries(msg.errors || {});
        if (bad.length) {
          staged = null;
          for (const [file, errs] of bad) this.results.push({ ok: false, text: `${file} can't be saved: ${errs.join("; ")}` });
        } else {
          this.confirmCode = msg.code;
        }
      } else if (msg.type === "applied") {
        staged = null;
        this.confirmCode = null;
        this.justSaved = Object.keys(msg.results);
        setTimeout(() => { this.justSaved = []; }, 2000);
        for (const [file, errs] of Object.entries(msg.results)) {
          if (!errs.length) {
            // a new script now has a file; remember it so it isn't treated as new again
            for (const [id, cmd] of owner) {
              if (id === cmd && !meta.get(id)?.file && this.fileOf(id) === file) meta.set(id, { ...meta.get(id), file, version: 4 });
            }
            delete bases[file];
          }
          this.results.push({ ok: !errs.length, text: errs.length ? `${file}: not saved: ${errs.join("; ")}` : `${file}: ${this.deletions.includes(file) ? "deleted" : "saved"}` });
        }
        if (msg.warning) this.results.push({ ok: true, warning: true, text: msg.warning });
      } else if (msg.type === "layout-error") {
        this.results.push({ ok: false, text: "Layout not stored: " + msg.error });
      }
    },
  };
}

