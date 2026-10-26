// Every field a script can have, changed one at a time through the editor model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as YAML from "yaml";
import { toModel, fromModel, ARG_TYPES } from "../src/lib/editor/script-yaml.js";

const dir = new URL("./fixtures/", import.meta.url);
const fixtures = readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
const concept = readFileSync(new URL("repo-concept.yml", dir), "utf8");

// drops what the file can't distinguish: _src, undefined, "", empty lists and empty objects
function norm(v) {
  if (Array.isArray(v)) {
    const a = v.map(norm).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "_src") continue;
      const n = norm(x);
      if (n !== undefined) o[k] = n;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v === "" || v === null || v === undefined ? undefined : String(v);
}
const comments = (t) => t.split("\n").map((l) => l.match(/#.*$/)?.[0]).filter(Boolean);

for (const [name, text] of fixtures) {
  test(`${name}: unchanged round trip is byte for byte`, () => {
    assert.equal(fromModel(YAML, text, toModel(YAML, text)), text);
  });
}

const t = (m) => ({ id: m, location: "BACKEND" });
const mutations = {
  "name": (m) => { m.name = "renamed-cmd"; },
  "description set": (m) => { m.description = "new description"; },
  "description cleared": (m) => { m.description = undefined; },
  "enabled off": (m) => { m.enabled = false; },
  "aliases changed": (m) => { m.aliases = ["a1", "a2"]; },
  "aliases cleared": (m) => { m.aliases = []; },
  "permissions.enabled off": (m) => { m.permissions.enabled = false; },
  "permissions.silent on": (m) => { m.permissions.silent = true; },
  "register target added": (m) => { m.register.push(t("hub-1")); },
  "register location changed": (m) => { m.register[0].location = "BACKEND"; },
  "defaults.run-as": (m) => { m.defaults["run-as"] = "OPERATOR"; },
  "defaults.execute added": (m) => { m.defaults.execute.push(t("survival-2")); },
  "defaults.execute cleared": (m) => { m.defaults.execute = []; },
  "defaults.server.target-required": (m) => { m.defaults.server["target-required"] = false; },
  "defaults.server.schedule-online": (m) => { m.defaults.server["schedule-online"] = false; },
  "defaults.server.player-arg": (m) => { m.defaults.server["player-arg"] = "target"; },
  "defaults.delay": (m) => { m.defaults.delay = "5s"; },
  "defaults.cooldown": (m) => { m.defaults.cooldown = "1m"; },
  "defaults.delay zero": (m) => { m.defaults.delay = "0s"; },
  "arg name": (m) => { m.args[0].name = "who"; },
  "arg required": (m) => { m.args[0].required = !m.args[0].required; },
  "arg type": (m) => { m.args[0].type = "OFFLINE_PLAYER"; },
  "arg suggestions": (m) => { m.args[0].suggestions = ["steve", "alex"]; },
  "arg added": (m) => { m.args.push({ name: "extra", required: false, type: "INTEGER", suggestions: ["1"] }); },
  "arg removed": (m) => { m.args.pop(); },
  "args reordered": (m) => { m.args.reverse(); },
  "command text": (m) => { m.commands[0].command = "eco take ${player} ${amount}"; },
  "command run-as": (m) => { m.commands[0]["run-as"] = "PLAYER"; },
  "command execute override": (m) => { m.commands[0].execute = [t("lobby"), { id: "proxy-2", location: "VELOCITY" }]; },
  "command delay": (m) => { m.commands[0].delay = "500ms"; },
  "command cooldown": (m) => { m.commands[0].cooldown = "10s"; },
  "command server override": (m) => { m.commands[0].server = { "target-required": true, "schedule-online": false, "player-arg": "player" }; },
  "command server override cleared": (m) => { m.commands[0].server = undefined; },
  "command added": (m) => { m.commands.push({ command: "say added", delay: "1s", server: { "target-required": false, "schedule-online": true } }); },
  "command removed": (m) => { m.commands.pop(); },
  "commands reordered": (m) => { m.commands.reverse(); },
};

for (const [label, mutate] of Object.entries(mutations)) {
  test(`field: ${label}`, () => {
    const m = toModel(YAML, concept);
    m.defaults.execute ??= [];
    m.defaults.server ??= {};
    if (m.commands.length < 2) m.commands.push({ command: "say second" });
    mutate(m);
    const out = fromModel(YAML, concept, m);
    assert.deepEqual(norm(toModel(YAML, out)), norm(m), "model after save differs");
    if (!/removed|cleared/.test(label)) {
      const kept = comments(out);
      for (const c of comments(concept)) assert.ok(kept.includes(c), "lost comment: " + c);
    }
  });
}

test("a script without permissions keeps checks on and writes nothing extra", () => {
  const src = "version: 4\nname: bare\nregister: []\ndefaults: {}\nargs: []\ncommands:\n  - command: say hi\n";
  const m = toModel(YAML, src);
  assert.equal(m.permissions.enabled, true);
  assert.equal(fromModel(YAML, src, m).includes("enabled: false"), false);
});

test("every argument type survives a round trip", () => {
  const m = toModel(YAML, concept);
  m.args = ARG_TYPES.map((type, i) => ({ name: "a" + i, required: false, type, suggestions: [] }));
  assert.deepEqual(toModel(YAML, fromModel(YAML, concept, m)).args.map((a) => a.type), ARG_TYPES);
});

for (const [name, text] of fixtures) {
  test(`${name}: editing one command changes exactly one line`, () => {
    const m = toModel(YAML, text);
    m.commands[0].command = "say edited";
    const a = text.split("\n"), b = fromModel(YAML, text, m).split("\n");
    assert.equal(b.length, a.length);
    const changed = a.filter((l, i) => l !== b[i]);
    assert.equal(changed.length, 1, "changed lines: " + JSON.stringify(changed));
  });
}

test("command server overrides keep their type", () => {
  const m = toModel(YAML, concept);
  m.commands[0].server = { "target-required": false, "schedule-online": true, "player-arg": "player" };
  const back = toModel(YAML, fromModel(YAML, concept, m)).commands[0].server;
  assert.deepEqual(back, { "target-required": false, "schedule-online": true, "player-arg": "player" });
});

test("a new argument spells out every field", () => {
  const m = toModel(YAML, concept);
  m.args.push({ name: "extra", required: false, type: "STRING", suggestions: [] });
  const added = YAML.parse(fromModel(YAML, concept, m)).args.at(-1);
  assert.deepEqual(added, { name: "extra", required: false, type: "STRING", suggestions: [] });
});

test("keys the file didn't have are inserted in the documented order", () => {
  const src = "version: 4\nname: bare\nenabled: true\nregister: []\ndefaults:\n  run-as: CONSOLE\nargs: []\ncommands:\n  - command: say hi\n";
  const m = toModel(YAML, src);
  m.description = "added";
  m.aliases = ["b"];
  m.defaults.cooldown = "1s";
  m.commands[0].delay = "2s";
  m.commands[0]["run-as"] = "PLAYER";
  const out = YAML.parse(fromModel(YAML, src, m));
  assert.deepEqual(Object.keys(out), ["version", "name", "description", "enabled", "aliases", "permissions", "register", "defaults", "args", "commands"]);
  assert.deepEqual(Object.keys(out.commands[0]), ["command", "run-as", "delay"]);
  assert.deepEqual(out.permissions, { enabled: true, silent: false }, "a missing required block is written out in full");
});

test("items added to an empty inline list are written as a block list", () => {
  const src = "version: 4\nname: bare\npermissions:\n  enabled: false\nregister: []\ndefaults: {}\nargs: []\ncommands:\n  - command: say hi\n";
  const m = toModel(YAML, src);
  m.args.push({ name: "who", required: true, type: "STRING", suggestions: [] });
  m.register.push({ id: "proxy-1", location: "VELOCITY" });
  const out = fromModel(YAML, src, m);
  assert.match(out, /\nargs:\n  - name: who\n/);
  assert.match(out, /\nregister:\n  - id: proxy-1\n/);
});

test("targets without a source index keep their comments by matching id and location", () => {
  const m = toModel(YAML, concept);
  m.defaults.execute = [{ id: "client-1", location: "BACKEND" }, { id: "added", location: "BACKEND" }];
  const out = fromModel(YAML, concept, m);
  assert.ok(out.includes("# Forward the command to this backend server."));
  assert.deepEqual(toModel(YAML, out).defaults.execute.map((t) => t.id), ["client-1", "added"]);
});

test("a zero default duration counts as no default", () => {
  const m = toModel(YAML, concept);
  m.defaults.delay = undefined;
  m.defaults.cooldown = "";
  const out = fromModel(YAML, concept, m);
  assert.ok(out.includes("delay: 0s") && out.includes("cooldown: 0s"));
  m.defaults.delay = "3s";
  assert.equal(toModel(YAML, fromModel(YAML, concept, m)).defaults.delay, "3s");
});

test("a step's server block is written whole, because it replaces the defaults' block", () => {
  const m = toModel(YAML, concept);
  m.commands[0].server = { "schedule-online": true };
  const back = YAML.parse(fromModel(YAML, concept, m)).commands[0].server;
  assert.deepEqual(back, { "target-required": false, "schedule-online": true });
});

test("a partial step server block is kept as is while its effective values don't change", () => {
  const src = "version: 4\nname: part\npermissions:\n  enabled: true\nregister: []\ndefaults: {}\nargs: []\ncommands:\n  - command: say hi\n    server:\n      schedule-online: false\n";
  const m = toModel(YAML, src);
  m.commands[0].server = { "target-required": false, "schedule-online": false };
  assert.equal(fromModel(YAML, src, m), src);
});
