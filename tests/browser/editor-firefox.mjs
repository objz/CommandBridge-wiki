// The editor in the installed Firefox, driven over WebDriver BiDi (no extra dependencies). Same setup as editor-ui.mjs.
// Run: node tests/browser/editor-firefox.mjs
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const D = new URL("../fixtures/", import.meta.url);
const scripts = Object.fromEntries(["docs-examples-0.yml", "docs-examples-2.yml"].map((f) => [f, readFileSync(new URL(f, D), "utf8")]));
const id = crypto.randomBytes(16).toString("hex"), secret = crypto.randomBytes(32);
const sign = (r, c, s, b) => crypto.createHmac("sha256", secret).update(`${r}\n${c}\n${s}\n${b}`).digest("base64url");
const proxy = new WebSocket(`ws://localhost:8787/api/editor/${id}/ws?role=proxy`, { headers: { Authorization: "Bearer cb-dump-upload-v1" } });
let seq = 0, conn = "";
const sendP = (m) => { const b = JSON.stringify(m); seq++; proxy.send(JSON.stringify({ conn, seq, body: b, mac: sign("proxy", conn, seq, b) })); };
proxy.onmessage = (e) => { const env = JSON.parse(e.data); conn = env.conn; if (JSON.parse(env.body).type === "hello") sendP({ type: "state", scripts, servers: { "proxy-1": { location: "VELOCITY", platform: "VELOCITY" }, lobby: { location: "BACKEND", platform: "PAPER" } } }); };
await new Promise((r) => (proxy.onopen = r));

const profile = mkdtempSync(join(tmpdir(), "cb-ff-"));
const port = 9300 + Math.floor(Math.random() * 500);
const ff = spawn("firefox", ["--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", String(port), "--window-size=1600,1000"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try { ws = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }); } catch { ws = null; }
}
let msgId = 0;
const waiting = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
const cmd = (method, params) => new Promise((ok, no) => { const i = ++msgId; waiting.set(i, (m) => (m.type === "error" ? no(new Error(method + ": " + m.message)) : ok(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
await cmd("session.new", { capabilities: {} });
const ctx = (await cmd("browsingContext.getTree", {})).contexts[0].context;
// results come back as JSON text, since BiDi's own serialization of objects is verbose
const js = async (expr) => {
  const r = await cmd("script.evaluate", { expression: `(async () => JSON.stringify(await (${expr})))()`, target: { context: ctx }, awaitPromise: true });
  if (r.type === "exception") throw new Error(r.exceptionDetails.text);
  return r.result.value === undefined ? undefined : JSON.parse(r.result.value);
};
const act = (actions) => cmd("input.performActions", { context: ctx, actions });
const click = async (x, y, button = 0) => act([{ type: "pointer", id: "m", actions: [{ type: "pointerMove", x: Math.round(x), y: Math.round(y) }, { type: "pointerDown", button }, { type: "pointerUp", button }] }]);
const keys = async (...seq) => act([{ type: "key", id: "k", actions: seq.flatMap((k) => (Array.isArray(k) ? [...k.map((v) => ({ type: "keyDown", value: v })), ...k.slice().reverse().map((v) => ({ type: "keyUp", value: v }))] : [{ type: "keyDown", value: k }, { type: "keyUp", value: k }])) }]);
const CTRL = "";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
const check = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); if (!c) fails++; };
try {
  await cmd("browsingContext.navigate", { context: ctx, url: `http://localhost:8080/editor/#${id}:${secret.toString("base64url")}`, wait: "complete" });
  for (let i = 0; i < 40 && !(await js(`document.querySelectorAll(".drawflow-node").length > 5`)); i++) await pause(250);
  await js(`(document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove(), 1)`);
  const A = `Alpine.$data(document.querySelector(".ed"))`;
  const count = () => js(`document.querySelectorAll(".drawflow-node").length`);

  // a node, then Ctrl+A, Ctrl+C, Ctrl+V
  const cmdHead = await js(`(() => { const n = [...document.querySelectorAll(".cb-command")].find((n) => n.querySelector('[data-f="name"]').value === "alert"); const a = ${A}, r = a.rectOf(n.id.slice(5)); a.centerOn(r.x + 200, r.y + 100, 1); const b = n.querySelector(".nh").getBoundingClientRect(); return { x: b.left + 120, y: b.top + 15 }; })()`);
  await click(cmdHead.x, cmdHead.y);
  check("click selects a node", (await js(`${A}.selectionSize`)) === 1);
  check("keys go to the editor's key field", (await js(`document.activeElement.className`)) === "ed-keys", await js(`document.activeElement.tagName + "." + document.activeElement.className`));
  await keys([CTRL, "a"]);
  const all = await count();
  check("Ctrl+A selects everything", (await js(`${A}.selectionSize`)) === all, `${await js(`${A}.selectionSize`)} of ${all}`);
  const empty = await js(`(() => { const r = document.getElementById("ed-canvas").getBoundingClientRect(); return { x: r.left + 8, y: r.top + 8 }; })()`);
  await click(empty.x, empty.y); // empty canvas: nothing selected
  await click(cmdHead.x, cmdHead.y);
  await keys([CTRL, "c"]);
  await keys([CTRL, "v"]);
  await pause(200);
  check("Ctrl+C, Ctrl+V paste a copy", (await count()) === all + 1, `${await count()} vs ${all + 1}`);

  // typing into a field after clicking it
  // a description field nothing else covers (the pasted copy lands on top of the original)
  const desc = await js(`(() => { for (const t of document.querySelectorAll('.cb-command [data-f="description"]')) { const b = t.getBoundingClientRect(), x = b.left + 20, y = b.top + 10; if (document.elementFromPoint(x, y) === t) return { x, y }; } })()`);
  await click(desc.x, desc.y);
  await keys("x", "y");
  check("a clicked field takes typing", /xy/.test(await js(`document.activeElement.value`)) && (await js(`document.activeElement.dataset.f`)) === "description");
  // every kind of field takes typing after a click, also a click on its frame
  for (const [label, sel, frame] of [["command name", '.cb-command .slashed', true], ["suggestions", '.cb-arg [data-f="suggestions"]'], ["delay", '.cb-defaults [data-f="d-delay"]'],
    ["alias row", '.cb-alias .tag input'], ["new alias", '.cb-alias .al-new', true], ["step command", '.cb-run .cmd']]) {
    const pt = await js(`(() => { for (const el of document.querySelectorAll(${JSON.stringify(sel)})) { const n = el.closest(".drawflow-node"), a = ${A}, r = a.rectOf(n.id.slice(5)); a.centerOn(r.x + r.w / 2, r.y + r.h / 2, 1);
      const b = el.getBoundingClientRect(), x = b.left + (${!!frame} ? 4 : Math.min(30, b.width / 2)), y = b.top + b.height / 2; if (el.contains(document.elementFromPoint(x, y)) || document.elementFromPoint(x, y) === el) return { x, y }; } })()`);
    if (!pt) { check(label + " is reachable", false); continue; }
    await click(pt.x, pt.y);
    await keys("q", "z");
    const got = await js(`(() => { const a = document.activeElement; return a.isContentEditable ? a.textContent : a.value; })()`);
    check(`typing goes into the ${label}`, /qz/.test(got || "") && (frame ? /qz$/.test(got) : true), String(got));
  }
  check("fields allow text selection (caret shows in Firefox)", (await js(`getComputedStyle(document.querySelector('.cb-command [data-f="name"]')).userSelect`)) !== "none");

  // dragging an argument pill into a command, with a preview while dragging
  const drag = await js(`(() => { const run = [...document.querySelectorAll(".cb-run")].find((n) => n.querySelector('.ph[data-arg="amount"]')); const a = ${A}, r = a.rectOf(run.id.slice(5)); a.centerOn(r.x + 200, r.y + 150, 1);
    const p = run.querySelector(".pill").getBoundingClientRect(), c = run.querySelector(".cmd").getBoundingClientRect(); window.__run = run.id; return { px: p.left + 10, py: p.top + 8, cx: c.left + 8, cy: c.top + c.height / 2, before: run.querySelectorAll(".cmd .ph").length }; })()`);
  await act([{ type: "pointer", id: "m", actions: [{ type: "pointerMove", x: Math.round(drag.px), y: Math.round(drag.py) }, { type: "pointerDown", button: 0 },
    { type: "pointerMove", x: Math.round(drag.cx), y: Math.round(drag.cy), duration: 200 }] }]);
  check("dragging shows a preview in the text", (await js(`document.querySelectorAll("#" + window.__run + " .cmd .ph.preview").length`)) === 1);
  await act([{ type: "pointer", id: "m", actions: [{ type: "pointerUp", button: 0 }] }]);
  check("dropping inserts the argument", (await js(`document.querySelectorAll("#" + window.__run + " .cmd .ph").length`)) === drag.before + 1);
  check("still on the editor page", (await js(`location.pathname`)) === "/editor/");
} finally {
  ff.kill();
  proxy.close();
  ws?.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
