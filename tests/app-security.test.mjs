import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function app(file, factory) {
  const context = vm.createContext({ setInterval() {}, setTimeout() {} });
  vm.runInContext(readFileSync(new URL(`../src/lib/${file}`, import.meta.url), "utf8"), context);
  return vm.runInContext(`${factory}()`, context);
}

test("setup treats prototype-named servers as unpaired until explicitly paired", () => {
  const setup = app("setup/setup.js", "cbSetup");
  const servers = ["constructor", "toString", "__proto__"].map((id) => ({ id, address: "localhost:25565", on: true }));
  setup.a = { servers };
  setup.focus = () => {};
  setup.current = {};
  setup.receive({ type: "state", current: {}, paired: {}, codes: {} });
  assert.equal(setup.pairedCount(), 0);
  assert.equal(setup.unpaired().length, 3);
  assert.equal(setup.codes.constructor, undefined);
  setup.receive({ type: "paired", id: "constructor", platform: "PAPER", version: "1.21" });
  assert.equal(setup.pairedCount(), 1);
  assert.equal(setup.paired.__proto__, undefined);
  setup.receive({ type: "paired", id: "__proto__", platform: "FOLIA", version: "1.21" });
  assert.equal(setup.pairedCount(), 2);
  assert.equal(Object.getPrototypeOf(setup.paired), null);
});

test("a failed setup apply stays retryable instead of claiming the proxy is set up", () => {
  const setup = app("setup/setup.js", "cbSetup");
  setup.step = "apply";
  setup.staged = "q8n2fl";
  setup.receive({ type: "applied", restartNeeded: false, errors: ["Could not save config.yml"] });
  assert.equal(setup.applied, null);
  assert.equal(setup.step, "apply");
  assert.equal(setup.staged, "q8n2fl");
  assert.equal(setup.err, "Could not save config.yml");
  setup.receive({ type: "applied", restartNeeded: true, errors: [] });
  assert.equal(setup.step, "pairing");
  assert.equal(setup.err, "");
  assert.equal(setup.applied.restartNeeded, true);
});

function editor() {
  const editor = app("editor/editor.js", "cbEditor"), sent = [];
  editor.relay = { send: (msg) => sent.push(msg) };
  editor.refresh = editor.rebuild = () => {};
  editor.blocking = () => [];
  editor.changes = () => Object.keys(editor.out).length;
  return { editor, sent };
}

test("a reload cancels a pending set instead of offering a blind confirm command", () => {
  const { editor: e, sent } = editor();
  e.receive({ type: "state", scripts: {}, pending: "k3m9x2", draft: { files: { "evil.yml": "unreviewed" } } });
  assert.equal(e.confirmCode, null);
  assert.equal(sent[0].type, "unstage");
  assert.equal(e.results.length, 1);
  assert.ok(e.results[0].offer);
});

test("an old staged reply cannot confirm edits made while Save was in flight", () => {
  const { editor: e, sent } = editor();
  e.out = { "script.yml": "old" };
  e.save();
  e.out["script.yml"] = "new";
  e.receive({ type: "staged", errors: {}, code: "k3m9x2" });
  assert.equal(e.confirmCode, null);
  assert.equal(e.busy, false);
  assert.equal(sent.at(-1).type, "unstage");
});

test("Save cannot overlap pending checks even after an edit cancels that set", () => {
  const { editor: e, sent } = editor();
  e.out = { "script.yml": "old" };
  e.save();
  e.out["script.yml"] = "new";
  e.cancelStage();
  e.save();
  assert.equal(sent.filter((m) => m.type === "stage").length, 1);
  e.receive({ type: "staged", errors: {}, code: "k3m9x2" });
  assert.equal(e.confirmCode, null);
  e.save();
  assert.equal(sent.filter((m) => m.type === "stage").length, 2);
});

test("a malformed confirm code never becomes a console command", () => {
  const { editor: e, sent } = editor();
  e.out = { "script.yml": "edited" };
  e.save();
  e.receive({ type: "staged", errors: {}, code: "k3m9x2\nop attacker" });
  assert.equal(e.confirmCode, null);
  assert.equal(sent.at(-1).type, "unstage");
  assert.match(e.results[0].text, /invalid confirmation code/);
});

test("a matching staged set still offers its valid confirm code", () => {
  const { editor: e } = editor();
  e.out = { "script.yml": "edited" };
  e.save();
  e.receive({ type: "staged", errors: {}, code: "k3m9x2" });
  assert.equal(e.confirmCode, "k3m9x2");
});

test("stored groups cannot inject a selector or break rendering with invalid fields", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL("../src/lib/editor/editor.js", import.meta.url), "utf8"), context);
  const validGroup = vm.runInContext("validGroup", context);
  const group = { id: "abcd1234", title: "Group", color: "#8b5cf6", members: ["test.yml"], x: 0, y: 0, w: 400, h: 200 };
  assert.ok(validGroup(group));
  for (const invalid of [null, { id: 'x"]' }, { title: null }, { color: "url(https://evil.test/)" }, { members: {} }, { members: [null] }, { x: "not a number" }]) {
    assert.ok(!validGroup(invalid && { ...group, ...invalid }));
  }
});

test("Cloudflare Pages blocks framing both privileged apps", () => {
  const headers = readFileSync(new URL("../src/assets/_headers", import.meta.url), "utf8");
  for (const path of ["editor", "setup"]) {
    assert.ok(headers.includes(`/${path}/*\n  X-Frame-Options: DENY\n  Content-Security-Policy: frame-ancestors 'none'`));
  }
});
