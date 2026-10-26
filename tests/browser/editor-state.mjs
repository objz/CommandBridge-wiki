// Run with the wiki dev server on 8080: node tests/browser/editor-state.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "/usr/lib/node_modules/omniroute/node_modules/playwright-core/index.mjs";
import YAML from "yaml";

const script = (name = "example") => `# script header
version: 4
name: ${name}
permissions:
  enabled: true
  silent: false
register:
  - id: proxy-1 # registration comment
    location: VELOCITY
defaults:
  run-as: CONSOLE
  execute:
    - id: lobby # target comment
      location: BACKEND
      custom-target: keep
args:
  - name: first # first argument
    custom-arg: first
  - name: second # second argument
    custom-arg: second
  - name: third # third argument
    custom-arg: third
commands:
  - command: say first # first step
    custom-step: first
  - command: say second # second step
    custom-step: second
  - command: say third # third step
    custom-step: third
`;
const servers = { "proxy-1": { location: "VELOCITY" }, lobby: { location: "BACKEND" } };
const source = readFileSync(new URL("../../src/lib/editor/editor.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });

async function open(scripts = { "example.yml": script() }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((state) => { window.__initialState = state; window.__messages = []; }, { type: "state", scripts, servers });
  await page.route("**/lib/editor/editor.js", (route) => route.fulfill({ contentType: "text/javascript", body: source }));
  await page.route("**/lib/editor/relay.js", (route) => route.fulfill({ contentType: "text/javascript", body: `
    window.cbLink = () => "test";
    window.cbRelay = () => ({
      send(msg) { window.__messages.push(msg); },
      connect() { queueMicrotask(() => this.onMessage(window.__initialState)); return this; }
    });
  ` }));
  await page.goto("http://localhost:8080/editor/");
  await page.waitForFunction(() => window.Alpine && Alpine.$data(document.querySelector(".ed")).status === "online");
  const act = (fn, arg) => page.evaluate(({ fn, arg }) => (0, eval)(`(${fn})`)(Alpine.$data(document.querySelector(".ed")), arg), { fn: fn.toString(), arg });
  const state = () => act((a) => ({ out: a.out, scripts: a.scripts, deletions: a.deletions, changes: a.changes(), blocking: a.blocking(), draft: a.yamlDraft, error: a.yamlError, code: a.confirmCode, messages: window.__messages }));
  return { page, act, state, errors };
}

async function scenario(name, run) {
  const app = await open(name.startsWith("unread") ? { "example.yml": script(), "broken.yml": "name: [\n" } : undefined);
  try {
    await run(app);
    assert.deepEqual(app.errors, [], "browser errors");
    console.log("PASS " + name);
  } finally { await app.page.close(); }
}

try {
  await scenario("unread malformed files never become inferred deletions", async ({ act, state }) => {
    assert.equal((await state()).changes, 0);
    await act((a) => {
      const field = document.querySelector('.cb-command [data-f="description"]');
      field.value = "local edit";
      a.onInput({ target: field });
      a.save();
    });
    let s = await state();
    assert.deepEqual(s.deletions, []);
    assert.deepEqual(Object.keys(s.messages.find((m) => m.type === "stage").files), ["example.yml"]);
    await act((a) => { a.cancelStage(); a.selectAll(); a.deleteSelection(); a.refresh(); });
    s = await state();
    assert.deepEqual(s.deletions, ["example.yml"]);
    assert.equal(s.scripts["broken.yml"], "name: [\n");
    await act((a) => { a.rebuild(); a.restoreDraft({ files: { "example.yml": "name: [" }, deletions: [] }); });
    s = await state();
    assert.deepEqual(s.deletions, [], "an unread restored draft is not a request to delete its saved file");
    assert.equal(s.out["example.yml"], undefined);
    assert.match(s.scripts["example.yml"], /name: example/);
  });

  await scenario("external changes freeze the dirty baseline and block rollback saves", async ({ act, state }) => {
    await act((a, other) => {
      a.receive({ type: "state", scripts: { ...a.scripts, "other.yml": other }, servers: a.servers });
      const field = document.querySelector('.cb-command [data-f="description"]');
      field.value = "local edit";
      a.onInput({ target: field });
      a.receive({ type: "state", scripts: { ...a.scripts, "other.yml": other.replace("say third", "say remote"), "new.yml": other.replace("name: other", "name: added") }, servers: a.servers });
      a.save();
    }, script("other"));
    let s = await state();
    assert.match(s.scripts["other.yml"], /say third/);
    assert.match(s.out["other.yml"], /say third/);
    assert.equal(s.scripts["new.yml"], undefined);
    assert.deepEqual(s.deletions, []);
    assert.match(s.blocking.at(-1).text, /changed on the proxy/);
    assert.equal(s.messages.some((m) => m.type === "stage"), false);
    await act((a) => {
      const external = a.scripts["example.yml"].replace("say third", "say remote");
      a.receive({ type: "state", scripts: { "example.yml": external, "broken.yml": "name: [" }, servers: a.servers });
      a.refresh();
    });
    s = await state();
    assert.match(s.out["example.yml"], /say third/);
    assert.doesNotMatch(s.out["example.yml"], /say remote/);
    await act((a) => a.rebuild());
    s = await state();
    assert.match(s.out["example.yml"], /say remote/);
    assert.equal(s.changes, 0);
    assert.deepEqual(s.deletions, []);
  });

  await scenario("an external edit to a just-saved file is not mistaken for its acknowledgement", async ({ act, state }) => {
    await act((a) => {
      const field = document.querySelector('.cb-command [data-f="description"]');
      field.value = "saved edit";
      a.onInput({ target: field });
      a.save();
      a.receive({ type: "staged", errors: {}, code: "k3m9x2" });
      a.receive({ type: "applied", results: { "example.yml": [] } });
      const saved = a.out["example.yml"];
      field.value = "next local edit";
      a.onInput({ target: field });
      a.receive({ type: "state", scripts: { "example.yml": saved }, servers: a.servers });
    });
    assert.deepEqual((await state()).blocking, []);
    await act((a) => a.receive({ type: "state", scripts: { "example.yml": a.scripts["example.yml"].replace("say third", "say remote") }, servers: a.servers }));
    const s = await state();
    assert.match(s.out["example.yml"], /next local edit/);
    assert.doesNotMatch(s.out["example.yml"], /say remote/);
    assert.match(s.blocking.at(-1).text, /changed on the proxy/);
  });

  await scenario("saved deletion and reorder preserve source YAML through refresh and undo", async ({ act, state }) => {
    await act((a) => {
      const snap = JSON.parse(a.serialize());
      const args = snap.nodes.filter((n) => n.kind === "arg");
      const removed = args[0].id;
      snap.nodes = snap.nodes.filter((n) => n.id !== removed);
      snap.edges = snap.edges.filter(([from, , to]) => from !== removed && to !== removed);
      [args[1].y, args[2].y] = [args[2].y, args[1].y];
      const steps = snap.nodes.filter((n) => n.kind === "run");
      const cmd = snap.nodes.find((n) => n.kind === "command");
      snap.edges = snap.edges.filter(([, out, to, inp]) => !(out === "output_1" && inp === "input_1" && steps.some((n) => n.id === to)));
      snap.edges.push([cmd.id, "output_1", steps[2].id, "input_1"], [steps[2].id, "output_1", steps[1].id, "input_1"]);
      snap.nodes = snap.nodes.filter((n) => n.id !== steps[0].id);
      a.buildFrom(snap);
      a.save();
      a.receive({ type: "staged", errors: {}, code: "k3m9x2" });
      const saved = a.out["example.yml"];
      a.receive({ type: "applied", results: { "example.yml": [] } });
      a.receive({ type: "state", scripts: { "example.yml": saved }, servers: a.servers });
      a.refresh();
    });
    let s = await state();
    const saved = s.scripts["example.yml"];
    assert.equal(s.out["example.yml"], saved);
    assert.deepEqual(YAML.parse(saved).args.map((a) => [a.name, a["custom-arg"]]), [["third", "third"], ["second", "second"]]);
    assert.deepEqual(YAML.parse(saved).commands.map((c) => [c.command, c["custom-step"]]), [["say third", "third"], ["say second", "second"]]);
    for (const comment of ["third argument", "second argument", "third step", "second step", "target comment"]) assert.ok(saved.includes(comment));
    await act((a) => a.undo());
    s = await state();
    assert.deepEqual(YAML.parse(s.out["example.yml"]).args.map((a) => a["custom-arg"]), ["first", "second", "third"]);
    assert.match(s.out["example.yml"], /first argument/);
    assert.match(s.out["example.yml"], /first step/);
    await act((a) => { a.redo(); a.refresh(); });
    assert.equal((await state()).out["example.yml"], saved);
  });

  await scenario("Save flushes valid YAML and blocks pending invalid YAML", async ({ act, state }) => {
    await act((a) => {
      a.yamlPick = "example.yml";
      a.yamlInput({ target: { value: a.out["example.yml"].replace("say third", "say latest") } });
      a.save();
    });
    let s = await state();
    assert.match(s.messages.find((m) => m.type === "stage").files["example.yml"], /say latest/);
    assert.equal(s.draft, null);
    await act((a) => {
      a.receive({ type: "staged", errors: {}, code: "k3m9x2" });
      a.yamlInput({ target: { value: "name: [" } });
    });
    s = await state();
    assert.equal(s.code, null);
    assert.equal(s.messages.at(-1).type, "unstage");
    await act((a) => {
      a.receive({ type: "staged", errors: {}, code: "k3m9x2" });
      a.save();
    });
    s = await state();
    assert.equal(s.code, null);
    assert.ok(s.error);
    assert.ok(s.blocking.length);
    assert.equal(s.messages.filter((m) => m.type === "stage").length, 1);
    assert.ok(s.changes);
    await act((a) => {
      a.yamlInput({ target: { value: a.out["example.yml"].replace(/args:[\s\S]*?commands:/, "args: {}\ncommands:") } });
      a.save();
    });
    assert.match((await state()).error, /Should be a list/);
    await act((a) => a.rebuild());
    assert.equal((await state()).draft, null);
    assert.equal((await state()).changes, 0);
    await act((a) => {
      a.yamlInput({ target: { value: "name: [" } });
      a.receive({ type: "state", scripts: { "example.yml": a.scripts["example.yml"].replace("say third", "say remote") }, servers: a.servers });
      a.save();
    });
    s = await state();
    assert.equal(s.changes, 1, "a pending invalid draft is unsaved work even on a clean graph");
    assert.doesNotMatch(s.scripts["example.yml"], /say remote/);
    assert.match(s.blocking.at(-1).text, /changed on the proxy/);
    assert.equal(s.messages.filter((m) => m.type === "stage").length, 1);
  });

  await scenario("YAML rebuild and history retain every script's indexed source", async ({ act, state }) => {
    await act((a, other) => {
      a.receive({ type: "state", scripts: { ...a.scripts, "other.yml": other }, servers: a.servers });
      const snap = JSON.parse(a.serialize());
      const args = snap.nodes.filter((n) => n.kind === "arg").slice(0, 3);
      [args[0].y, args[2].y] = [args[2].y, args[0].y];
      a.buildFrom(snap);
      a.yamlPick = "other.yml";
      a.yamlInput({ target: { value: a.out["other.yml"].replace("say third", "say typed") } });
      a.yamlApply();
      a.refresh();
    }, script("other"));
    let s = await state();
    assert.deepEqual(YAML.parse(s.out["example.yml"]).args.map((a) => [a.name, a["custom-arg"]]), [["third", "third"], ["second", "second"], ["first", "first"]]);
    await act((a) => { a.undo(); a.refresh(); });
    s = await state();
    assert.match(s.out["other.yml"], /say third/);
    assert.deepEqual(YAML.parse(s.out["example.yml"]).args.map((a) => [a.name, a["custom-arg"]]), [["third", "third"], ["second", "second"], ["first", "first"]]);
    await act((a) => { a.redo(); a.refresh(); });
    assert.match((await state()).out["other.yml"], /say typed/);
  });

  await scenario("undo and redo persist both the resulting draft and layout", async ({ act, state, page }) => {
    await page.waitForTimeout(1700);
    await act((a) => {
      window.__messages.length = 0;
      const field = document.querySelector('.cb-command [data-f="description"]');
      field.value = "persist me";
      a.onInput({ target: field });
      a.moveNodeBy(field.closest(".drawflow-node").id.slice(5), 100, 100);
      a.refresh();
    });
    await page.waitForTimeout(1700);
    const changedLayout = (await state()).messages.filter((m) => m.type === "layout").at(-1).layout;
    await act((a) => { window.__messages.length = 0; a.undo(); });
    await page.waitForTimeout(1700);
    let s = await state();
    assert.equal(s.changes, 0);
    assert.deepEqual(s.messages.find((m) => m.type === "draft").draft, {});
    assert.notDeepEqual(s.messages.find((m) => m.type === "layout").layout, changedLayout);
    await act((a) => { window.__messages.length = 0; a.redo(); });
    await page.waitForTimeout(1700);
    s = await state();
    assert.match(s.messages.find((m) => m.type === "draft").draft.files["example.yml"], /persist me/);
    assert.deepEqual(s.messages.find((m) => m.type === "layout").layout, changedLayout);
  });
} finally { await browser.close(); }
