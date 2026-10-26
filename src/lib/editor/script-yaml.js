// Converts CommandBridge script YAML to a plain model for the node editor and back.
// Saving patches the original document instead of re-serializing it, so comments,
// formatting and keys the editor doesn't know about survive an edit.
// `YAML` is the `yaml` package (eemeli/yaml v2), passed in so this runs in the browser and in node.

export const ARG_TYPES = ["STRING", "INTEGER", "BOOLEAN", "DOUBLE", "TEXT", "GREEDY_STRING", "RANGE",
  "PLAYERS", "OFFLINE_PLAYER", "ENTITIES", "ENTITY_TYPE", "WORLD", "SERVER", "LOCATION", "LOCATION_2D",
  "ANGLE", "ROTATION", "ITEM_STACK", "ENCHANTMENT", "POTION_EFFECT", "SOUND", "BIOME", "TIME"];
export const RUN_AS = ["CONSOLE", "PLAYER", "OPERATOR"];
export const LOCATIONS = ["VELOCITY", "BACKEND"];

/** Parses script text into the editor model; list items remember their index in the file as `_src`. */
export function toModel(YAML, text) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  const js = doc.toJS() || {};
  const tag = (list) => (Array.isArray(list) ? list : []).map((item, i) => ({ ...item, _src: i }));
  const defaults = js.defaults ?? {};
  return {
    version: js.version ?? 4,
    name: js.name ?? "",
    description: js.description,
    enabled: js.enabled ?? true,
    aliases: js.aliases ?? [],
    // same defaults as the Java model: permission checks are on unless disabled
    permissions: { enabled: js.permissions?.enabled ?? true, silent: js.permissions?.silent ?? false },
    register: tag(js.register),
    defaults: { ...defaults, execute: defaults.execute && tag(defaults.execute) },
    args: tag(js.args).map((a) => ({ ...a, required: a.required ?? false, type: a.type ?? "STRING" })),
    commands: tag(js.commands).map((c) => ({ ...c, execute: c.execute && tag(c.execute) })),
  };
}

/** Writes the model back into `original` (or a fresh document when null) and returns the new text. */
export function fromModel(YAML, original, model) {
  const doc = original ? YAML.parseDocument(original) : new YAML.Document({});
  if (!YAML.isMap(doc.contents)) doc.contents = doc.createNode({});
  const root = doc.contents;

  setField(YAML, doc, root, "version", model.version ?? 4);
  setField(YAML, doc, root, "name", model.name);
  setField(YAML, doc, root, "description", model.description || undefined);
  setField(YAML, doc, root, "enabled", model.enabled, true);
  setField(YAML, doc, root, "aliases", model.aliases, []);

  // a block the file didn't have is written out in full, like a new item
  const newPerms = !root.has("permissions");
  const perms = childMap(doc, root, "permissions");
  setField(YAML, doc, perms, "enabled", model.permissions.enabled, newPerms ? undefined : true);
  setField(YAML, doc, perms, "silent", model.permissions.silent, newPerms ? undefined : false);

  syncTargets(YAML, doc, root, "register", model.register, true);

  const d = model.defaults;
  const newDefaults = !root.has("defaults");
  const defaults = childMap(doc, root, "defaults");
  setField(YAML, doc, defaults, "run-as", d["run-as"], newDefaults ? undefined : "CONSOLE");
  syncTargets(YAML, doc, defaults, "execute", d.execute);
  const s = d.server || {};
  if (defaults.has("server") || s["target-required"] || s["schedule-online"] || s["player-arg"]) {
    patchServer(YAML, doc, childMap(doc, defaults, "server"), s);
  }
  setDefaultDuration(YAML, doc, defaults, "delay", d.delay);
  setDefaultDuration(YAML, doc, defaults, "cooldown", d.cooldown);

  // new items spell out every field; existing ones keep omitted defaults omitted
  syncItems(YAML, doc, root, "args", model.args, (node, a, fresh) => {
    setField(YAML, doc, node, "name", a.name);
    setField(YAML, doc, node, "required", a.required, fresh ? undefined : false);
    setField(YAML, doc, node, "type", a.type, fresh ? undefined : "STRING");
    setField(YAML, doc, node, "suggestions", a.suggestions, fresh ? undefined : []);
  });

  // per-command keys left undefined inherit from defaults, so they are removed
  syncItems(YAML, doc, root, "commands", model.commands, (node, c) => {
    setField(YAML, doc, node, "command", c.command);
    setField(YAML, doc, node, "run-as", c["run-as"] || undefined);
    syncTargets(YAML, doc, node, "execute", c.execute);
    setField(YAML, doc, node, "delay", c.delay || undefined);
    setField(YAML, doc, node, "cooldown", c.cooldown || undefined);
    // A step's server block replaces the defaults' block as a whole (CB merges top-level fields only),
    // so keys missing inside it mean false/none. Rewrite it only when its effective values change.
    const have = node.has("server") ? effectiveServer(plain(YAML, node.get("server", true))) : null;
    const want = c.server ? effectiveServer(c.server) : null;
    if (!want) {
      if (have) node.delete("server");
    } else if (!have || !same(have, want)) {
      const srv = childMap(doc, node, "server");
      setField(YAML, doc, srv, "target-required", !!c.server["target-required"]);
      setField(YAML, doc, srv, "schedule-online", !!c.server["schedule-online"]);
      setField(YAML, doc, srv, "player-arg", c.server["player-arg"] || undefined);
    }
  });

  return keepFormatting(YAML, original, doc.toString({ flowCollectionPadding: false }));
}

// The yaml library re-renders the whole file, normalizing indentation and spacing. Lines that only
// differ in whitespace get their original text back, unless that changes what the file means.
function keepFormatting(YAML, original, generated) {
  if (!original) return generated;
  const key = (l) => l.trim().replace(/\s+#/, " #");
  const a = original.split("\n"), b = generated.split("\n");
  // longest common subsequence of lines, compared without whitespace differences
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = key(a[i]) === key(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (j < b.length) {
    if (i < a.length && key(a[i]) === key(b[j])) { out.push(a[i]); i++; j++; }
    else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) {
      if (!a[i].trim()) out.push(a[i]); // the library collapses blank lines
      i++;
    }
    else { out.push(b[j]); j++; }
  }
  const merged = out.join("\n");
  try {
    const same = JSON.stringify(YAML.parse(merged)) === JSON.stringify(YAML.parse(generated));
    return same ? merged : generated;
  } catch {
    return generated;
  }
}

function patchServer(YAML, doc, map, server) {
  setField(YAML, doc, map, "target-required", server["target-required"], false);
  setField(YAML, doc, map, "schedule-online", server["schedule-online"], false);
  setField(YAML, doc, map, "player-arg", server["player-arg"] || undefined);
}

// a default of 0s means the same as no default, so `delay: 0s` stays when the editor has none
const isZero = (v) => v != null && /^\s*0+(\.0+)?\s*(ms|s|m|h)?\s*$/i.test(String(v));
function setDefaultDuration(YAML, doc, map, key, value) {
  if (!value && isZero(plain(YAML, map.get(key, true)))) return;
  setField(YAML, doc, map, key, value || undefined);
}

const effectiveServer = (o) => ({ t: String(!!o?.["target-required"]), s: String(!!o?.["schedule-online"]), p: String(o?.["player-arg"] || "") });
const plain = (YAML, node) => (YAML.isNode(node) ? node.toJSON() : node);

function childMap(doc, parent, key) {
  let node = parent.get(key, true);
  if (!node || typeof node.get !== "function") {
    const existed = parent.has(key);
    node = doc.createNode({});
    parent.set(key, node);
    if (!existed) moveToSchemaPosition(parent, key);
  }
  return node;
}

// "10" from a text field equals 10 in the file, and "" equals a missing value
const same = (a, b) => {
  if ((a === "" || a === null) && b === undefined) return true;
  if (a !== null && b !== null && typeof a !== "object" && typeof b !== "object") return String(a) === String(b);
  return JSON.stringify(a) === JSON.stringify(b);
};

// Only touches the file when the value really changed; an absent key equal to `def` stays absent.
function setField(YAML, doc, map, key, value, def) {
  const has = map.has(key);
  if (value === undefined) {
    if (has && !same(plain(YAML, map.get(key, true)), undefined)) map.delete(key);
    return;
  }
  if (has) {
    const current = map.get(key, true);
    if (same(plain(YAML, current), value)) return;
  } else if (def !== undefined && same(value, def)) {
    return;
  }
  const scalars = Array.isArray(value) && value.every((v) => v === null || typeof v !== "object");
  const current = has ? map.get(key, true) : undefined;
  if (value === null || typeof value !== "object") {
    map.set(key, value); // keeps the existing scalar node, and its comments, when there is one
  } else if (scalars && YAML.isSeq(current)) {
    current.items = value.map((v) => doc.createNode(v)); // keeps the list node and its comment
  } else {
    const node = doc.createNode(value);
    if (scalars && value.length) node.flow = true;
    map.set(key, node);
  }
  if (!has) moveToSchemaPosition(map, key);
}

// The documented key order; a key the file didn't have goes before the first later key, not at the end
const KEY_ORDER = ["version", "name", "description", "enabled", "silent", "aliases", "permissions", "register",
  "defaults", "args", "commands", "command", "required", "type", "suggestions", "id", "location", "run-as",
  "execute", "server", "target-required", "schedule-online", "player-arg", "delay", "cooldown"];

function moveToSchemaPosition(map, key) {
  const rank = KEY_ORDER.indexOf(key);
  if (rank < 0) return;
  const items = map.items;
  const pair = items.pop();
  const at = items.findIndex((p) => KEY_ORDER.indexOf(String(p.key?.value ?? p.key)) > rank);
  items.splice(at < 0 ? items.length : at, 0, pair);
}

// Target lists ({id, location}); an empty optional list is removed so it inherits again
function syncTargets(YAML, doc, parent, key, targets, required = false) {
  const list = targets || [];
  const current = plain(YAML, parent.get(key, true));
  if (same(norm(current), norm(list))) return;
  if (!list.length && !required) {
    parent.delete(key);
    return;
  }
  // shared server nodes don't know their line in the file, so match entries by id and location
  const original = norm(current), used = new Set();
  const matched = list.map((t) => {
    if (t._src != null) return t;
    const i = original.findIndex((o, k) => !used.has(k) && o.id === String(t.id) && o.location === String(t.location));
    if (i >= 0) used.add(i);
    return { ...t, _src: i >= 0 ? i : undefined };
  });
  syncItems(YAML, doc, parent, key, matched, (node, t) => {
    setField(YAML, doc, node, "id", t.id);
    setField(YAML, doc, node, "location", t.location);
  });
}

const norm = (list) => (Array.isArray(list) ? list.map((t) => ({ id: String(t?.id ?? ""), location: String(t?.location ?? "") })) : []);

// Rebuilds a list from model items, reusing each item's original node so its comments move with it.
function syncItems(YAML, doc, parent, key, items, patch) {
  const seq = parent.get(key, true);
  const old = YAML.isSeq(seq) ? seq.items : [];
  const next = items.map((item) => {
    const reuse = item._src != null && YAML.isMap(old[item._src]);
    const node = reuse ? old[item._src] : doc.createNode({});
    patch(node, item, !reuse);
    return node;
  });
  if (YAML.isSeq(seq)) {
    seq.items = next;
    if (next.length && seq.flow) seq.flow = false; // `args: []` grows into a normal block list
  } else {
    const fresh = doc.createNode([]);
    fresh.items = next;
    parent.set(key, fresh);
  }
}
