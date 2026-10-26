// node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as YAML from "yaml";
import { toModel, fromModel } from "../src/lib/editor/script-yaml.js";

const EXAMPLE = `# header comment
version: 4

name: example
description: An example
enabled: false # Set to true to activate
aliases: [ex]

permissions:
  enabled: true # needs a node
  silent: false

register:
  - id: "client-1"
    location: VELOCITY

defaults:
  run-as: CONSOLE
  execute:
    - id: "client-1"
      location: BACKEND
  delay: 0s

args:
  - name: player
    required: true
    type: TEXT

# what runs
commands:
  # first step
  - command: "msg \${player} hi"
  # second step
  - command: "say done"
    delay: 2s
`;

const strip = (m) => JSON.parse(JSON.stringify(m, (k, v) => (k === "_src" ? undefined : v)));

test("unchanged model writes the file back byte for byte", () => {
  assert.equal(fromModel(YAML, EXAMPLE, toModel(YAML, EXAMPLE)), EXAMPLE);
});

test("editing one command keeps every comment and other line", () => {
  const m = toModel(YAML, EXAMPLE);
  m.commands[0].command = "msg ${player} hello";
  m.enabled = true;
  const out = fromModel(YAML, EXAMPLE, m);
  for (const c of ["# header comment", "# Set to true to activate", "# needs a node", "# what runs", "# first step", "# second step"]) {
    assert.ok(out.includes(c), "lost comment: " + c);
  }
  assert.ok(out.includes('msg ${player} hello'));
  assert.ok(out.includes("enabled: true # Set to true to activate"));
  assert.equal(out.split("\n").length, EXAMPLE.split("\n").length);
});

test("reorder, remove and add items; comments travel with their item", () => {
  const m = toModel(YAML, EXAMPLE);
  m.commands.reverse();
  m.commands[0].delay = undefined;
  m.args.push({ name: "reason", required: false, type: "GREEDY_STRING", suggestions: [] });
  const out = fromModel(YAML, EXAMPLE, m);
  const back = toModel(YAML, out);
  assert.deepEqual(back.commands.map((c) => c.command), ["say done", "msg ${player} hi"]);
  assert.equal(back.commands[0].delay, undefined);
  assert.deepEqual(back.args.map((a) => a.name), ["player", "reason"]);
  // a comment on a later item moves with it (the first item's comment belongs to the list)
  assert.ok(out.indexOf("# second step") < out.indexOf("say done"));
  assert.ok(out.indexOf("say done") < out.indexOf("msg ${player} hi"));
});

test("new script from a model parses back to the same model", () => {
  const m = {
    version: 4, name: "fresh", enabled: true, aliases: [], permissions: { enabled: false, silent: false },
    register: [{ id: "proxy-1", location: "VELOCITY" }],
    defaults: { "run-as": "CONSOLE", execute: [{ id: "lobby", location: "BACKEND" }] },
    args: [{ name: "msg", required: true, type: "TEXT", suggestions: [] }],
    commands: [{ command: "say ${msg}" }],
  };
  const out = fromModel(YAML, null, m);
  assert.ok(!out.includes("server:"), "empty server block written");
  const back = strip(toModel(YAML, out));
  assert.deepEqual(back.commands, m.commands);
  assert.deepEqual(back.register, m.register);
  assert.deepEqual(back.defaults.execute, m.defaults.execute);
  assert.equal(back.name, "fresh");
});

test("the shipped example script round-trips unchanged", () => {
  const text = readFileSync(new URL("../../CommandBridge/velocity/src/main/resources/example.yml", import.meta.url), "utf8");
  assert.equal(fromModel(YAML, text, toModel(YAML, text)), text);
});
