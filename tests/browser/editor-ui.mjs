// Drives the editor in Chromium against a fake proxy. Needs the wiki dev server (8080) and the relay (wrangler dev, 8787).
// Run: node tests/browser/editor-ui.mjs [screenshot dir]
import { chromium } from "/usr/lib/node_modules/omniroute/node_modules/playwright-core/index.mjs";
import { fakeProxy } from "./fake-proxy.mjs";
import { readFileSync } from "node:fs";

const SHOTS = process.argv[2];
const D = new URL("../fixtures/", import.meta.url);
const scripts = Object.fromEntries(["docs-examples-0.yml", "docs-examples-1.yml", "docs-examples-2.yml", "docs-examples-4.yml"].map((f) => [f, readFileSync(new URL(f, D), "utf8")]));
scripts["docs-examples-2.yml"] = scripts["docs-examples-2.yml"].replace("aliases: [eco]", "aliases: [eco, money]");
const sendP = (m) => proxy.send(m);
// a stand-in for the proxy: it keeps the draft, holds staged changes until confirm() is called, and counts pings
const servers = { "proxy-1": { location: "VELOCITY", platform: "VELOCITY" }, lobby: { location: "BACKEND", platform: "PAPER" } };
let draft = {}, staged = null, pings = 0;
const state = () => sendP({ type: "state", scripts, servers, draft, pending: staged?.code ?? null });
const confirm = () => {
  const results = {};
  for (const [f, y] of Object.entries(staged.files)) { scripts[f] = y; results[f] = []; }
  for (const f of staged.deletions) { delete scripts[f]; results[f] = []; }
  staged = null; draft = {};
  sendP({ type: "applied", results, warning: null });
  state();
};
const proxy = await fakeProxy((m) => {
  if (m.type === "hello") state();
  if (m.type === "draft") draft = m.draft;
  if (m.type === "ping") pings++;
  if (m.type === "stage") { staged = { code: "k3m9x2", files: m.files, deletions: m.deletions }; sendP({ type: "staged", errors: {}, code: staged.code }); }
  if (m.type === "unstage") { staged = null; state(); }
});

let fails = 0;
const check = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (process.env.DEBUG && /error|warn/i.test(m.type())) console.log("CONSOLE", m.text()); });
await page.goto(`http://localhost:8080/editor/#${proxy.link}`);
await page.waitForFunction(() => document.querySelectorAll(".drawflow-node").length > 5, null, { timeout: 15000 });
await page.waitForTimeout(500);
const app = () => page.evaluate(() => { const a = Alpine.$data(document.querySelector(".ed")); return { changes: a.changes(), out: a.out, scripts: a.scripts, blocking: a.blocking().map((p) => ({ script: p.script, text: p.text })) }; });
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });

const view = (loc, dx = 200, dy = 150) => loc.evaluate((n, [dx, dy]) => { const a = Alpine.$data(document.querySelector(".ed")), r = a.rectOf(n.id.slice(5)); a.centerOn(r.x + dx, r.y + dy, 1); }, [dx, dy]);
const blank = async () => { await page.evaluate(() => Alpine.$data(document.querySelector(".ed")).centerOn(-5000, -5000)); };
await page.evaluate(() => document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove());

let s = await app();
check("loads without changes", s.changes === 0, JSON.stringify(s.blocking) + " " + Object.keys(s.out).filter((f) => s.out[f] !== s.scripts?.[f]));
check("every script has a Defaults node", await page.locator(".cb-defaults").count() === 4);
check("Defaults show run as PLAYER", await page.locator('.cb-defaults [data-f="d-runas"][value="PLAYER"]:checked').count() === 1);
check("checks player is a picker", await page.locator('.cb-defaults [data-f="d-player"]').evaluateAll((els) => els.map((e) => e.dataset.v)).then((v) => v.includes("player")));
check("a connected backend shows the software it runs", await page.locator('.cb-server:has(.nk:text-is("lobby")) .srv-k').first().textContent() === "paper");
check("server node shows its id as the title", await page.locator('.cb-server .nk', { hasText: "proxy-1" }).count() > 0);
// wires that run through a node they don't belong to, and nodes on top of each other
const crossings = () => page.evaluate(() => {
  const nodes = [...document.querySelectorAll("#ed-canvas .drawflow-node")].map((n) => ({ id: n.id, r: n.getBoundingClientRect() }));
  let wires = 0, overlaps = 0;
  const bad = [];
  for (const c of document.querySelectorAll("#ed-canvas svg.connection")) {
    const ends = [...c.classList].filter((k) => k.startsWith("node_")).map((k) => "node-" + k.split("-")[1]);
    const path = c.querySelector(".main-path"), len = path.getTotalLength(), m = path.getScreenCTM();
    const hit = new Set();
    for (let t = 0.08; t < 0.92; t += 0.04) {
      const p = path.getPointAtLength(len * t), x = p.x * m.a + m.e, y = p.y * m.d + m.f;
      for (const n of nodes) if (!ends.includes(n.id) && x > n.r.left + 2 && x < n.r.right - 2 && y > n.r.top + 2 && y < n.r.bottom - 2) hit.add(n.id);
    }
    wires += hit.size;
    if (hit.size) bad.push(ends.join(">") + " through " + [...hit].join(","));
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].r, b = nodes[j].r;
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) { overlaps++; bad.push(nodes[i].id + " on " + nodes[j].id); }
  }
  return { wires, overlaps, bad: bad.slice(0, 6) };
});
const cx = await crossings();
check("first layout: no overlapping nodes, no wire through a node", cx.overlaps === 0 && cx.wires === 0, JSON.stringify(cx));
check("server node is fixed", await page.locator('.cb-server input[type="text"]').count() === 0);

const def = page.locator(".cb-defaults").filter({ has: page.locator('[data-f="d-runas"][value="PLAYER"]:checked') });
await view(def);
await def.locator('label:has([value="OPERATOR"])').click();
s = await app();
check("run-as change reaches YAML", /run-as: OPERATOR/.test(s.out["docs-examples-1.yml"]));

// saving: staged on the proxy, written only after the confirm command
await page.locator(".ed-save").click();
await page.locator(".ed-confirm").waitFor({ state: "visible" });
check("Save shows the confirm command", (await page.locator(".ed-confirm code").textContent()) === "/cb editor confirm k3m9x2" && staged !== null);
check("nothing is written before the confirm", !scripts["docs-examples-1.yml"].includes("OPERATOR"));
await page.waitForTimeout(300);
await shot("confirm");
const before = Object.keys(staged.files).length;
confirm();
await page.locator(".ed-confirm").waitFor({ state: "hidden" });
s = await app();
check("after the confirm the changes are saved", s.changes === 0 && scripts["docs-examples-1.yml"].includes("OPERATOR") && before > 0, `${s.changes} left`);
// a change after Save takes the staged set back
const lobbyDesc = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="lobby"]') }).locator('[data-f="description"]');
await view(lobbyDesc.locator("xpath=ancestor::div[contains(@class,'drawflow-node')]"), 200, 200);
await lobbyDesc.fill("Draft text");
await page.locator(".ed-save").click();
await page.locator(".ed-confirm").waitFor({ state: "visible" });
await lobbyDesc.fill("Draft text, changed after Save");
await page.waitForTimeout(300);
check("changing something after Save cancels the waiting code", staged === null && !(await page.locator(".ed-confirm").isVisible()));
// the unsaved change comes back after reopening the editor
await page.waitForTimeout(2000);
check("unsaved changes are kept on the proxy", JSON.stringify(draft).includes("Draft text, changed after Save"));
await page.reload();
await page.waitForFunction(() => document.querySelectorAll(".drawflow-node").length > 5, null, { timeout: 15000 });
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove());
check("reopening the editor restores them", await page.locator('.cb-command [data-f="description"]').evaluateAll((e) => e.some((x) => x.value === "Draft text, changed after Save")) && (await app()).changes === 1);
await page.locator(".ed-notes button", { hasText: "Discard" }).click();
check("Discard drops them", (await app()).changes === 0);


// aliases: a list, each row edited in place
const al = page.locator("#" + await page.locator(".cb-alias").filter({ has: page.locator('.tag[data-v="money"]') }).getAttribute("id"));
await view(al);
check("one Aliases node holds both aliases", await al.locator(".tag").count() === 2);
await al.locator(".tag-in").click();
await page.keyboard.type("cash ");
s = await app();
check("typed alias becomes a row in YAML", /aliases:.*cash/.test(s.out["docs-examples-2.yml"]));
await page.keyboard.type("Bad!");
await page.keyboard.press("Enter");
s = await app();
check("invalid alias is marked on its row", await al.locator('.tag.bad').count() === 1 && s.blocking.length > 0);
await al.locator('.tag[data-v="Bad!"] input').fill("");
await al.locator(".tag-in").focus();
await al.locator('.tag[data-v="money"] input').fill("coins");
s = await app();
check("an alias row is edited in place", /aliases: \[eco, coins, cash\]/.test(s.out["docs-examples-2.yml"]));
await al.locator('.tag[data-v="coins"] input').fill("money");
await al.locator('.tag[data-v="cash"]').hover();
await al.locator('.tag[data-v="cash"] .tag-x').click();
s = await app();
check("emptying and removing rows leaves YAML", /aliases: \[eco, money\]/.test(s.out["docs-examples-2.yml"]) && !s.blocking.length, JSON.stringify(s.blocking));
await shot("nodes");

// command text with argument pieces, dragged with the mouse
const at = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const runId = await page.locator(".cb-run").filter({ has: page.locator('.ph[data-arg="amount"]') }).getAttribute("id");
const run = page.locator("#" + runId);
await view(run);
check("placeholders render as pieces without a remove button", await run.locator(".ph").count() === 2 && await run.locator(".ph button").count() === 0);
// out to the remove zone
let p0 = await at(run.locator('.ph[data-arg="amount"]'));
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 30, p0.y + 40, { steps: 4 });
const bin = await at(page.locator(".ed-trash"));
await page.mouse.move(bin.x, bin.y, { steps: 8 });
check("the remove zone lights up under the piece", await page.locator(".ed-trash.hot").count() === 1);
await shot("trash");
await page.mouse.up();
s = await app();
check("dropping into the remove zone removes the piece", /command: "?eco give \$\{player\}"?\s*$/m.test(s.out["docs-examples-2.yml"]), s.out["docs-examples-2.yml"].match(/command:.*/)?.[0]);
// back in, aimed at the middle of a word: it goes between words and the text makes room while dragging
p0 = await at(run.locator('.pill[data-arg="amount"]'));
const word = await run.locator(".cmd").boundingBox();
await page.mouse.move(p0.x, p0.y); await page.mouse.down();
await page.mouse.move(word.x + 14, word.y + word.height / 2, { steps: 10 });
check("dragging shows where the piece goes", await run.locator(".cmd .ph.preview").count() === 1);
await shot("drag-preview");
await page.mouse.up();
s = await app();
check("a piece never splits a word", /command: "?(\$\{amount\} eco|eco \$\{amount\}) give \$\{player\}"?\s*$/m.test(s.out["docs-examples-2.yml"]), s.out["docs-examples-2.yml"].match(/command:.*/)?.[0]);
// a piece dragged out and dropped on nothing goes back
p0 = await at(run.locator('.ph[data-arg="amount"]'));
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 200, p0.y - 150, { steps: 6 }); await page.mouse.up();
check("a piece dropped on nothing goes back", await run.locator('.ph[data-arg="amount"]').count() === 1);
// moved to the end
p0 = await at(run.locator('.ph[data-arg="amount"]'));
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(word.x + word.width - 10, word.y + word.height / 2, { steps: 10 });
await page.mouse.up();
s = await app();
check("a piece moves within the command", /eco give \$\{player\} \$\{amount\}/.test(s.out["docs-examples-2.yml"]), s.out["docs-examples-2.yml"].match(/command:.*/)?.[0]);
await run.locator(".cmd").click({ position: { x: 12, y: 14 } });
await page.keyboard.press("End");
await page.keyboard.type(" ${nope}");
await page.locator("#ed-canvas").click({ position: { x: 5, y: 5 } });
check("typed placeholder becomes a marked piece", await run.locator('.ph.bad[data-arg="nope"]').count() === 1);
await run.locator('.ph[data-arg="nope"]').hover();
check("hover shows the reason", /no argument nope/.test(await page.locator(".ed-tip").textContent()));
await page.locator(".ed-savewrap").hover();
check("save explains why it's blocked", /Fix 1 problem/.test(await page.locator(".ed-tip").textContent()), await page.locator(".ed-tip").textContent());
await shot("errors");
p0 = await at(run.locator('.ph[data-arg="nope"]'));
await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 30, p0.y + 40, { steps: 4 });
await page.mouse.move(...Object.values(await at(page.locator(".ed-trash"))), { steps: 6 }); await page.mouse.up();
check("notes stay empty for pinned problems", !(await page.locator(".ed-notes").isVisible()));

// a step that calls another script shows the called name as a fixed piece
await view(run, 300, 60);
await run.locator(".output.output_2").click({ force: true });
await page.locator(".ed-pop .ed-mi", { hasText: "/lobby" }).click();
check("a calling step shows the called script as a piece", await run.locator(".cmd .callw").textContent() === "/lobby");
await shot("calling");
s = await app();
// "eco" was an alias of the script itself, so the called name takes its place
check("the call keeps its arguments in the text", /command: "?lobby give/.test(s.out["docs-examples-2.yml"]), s.out["docs-examples-2.yml"].match(/command:.*/)?.[0]);
await page.keyboard.press("Control+z");
await page.keyboard.press("Control+z");

// description wraps downwards
const cmdNode = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="eco-give"]') });
const h0 = (await cmdNode.locator('[data-f="description"]').boundingBox()).height;
await cmdNode.locator('[data-f="description"]').click();
await page.keyboard.type(" and a lot more words so the description needs a second line to show all of it");
check("description grows downwards", (await cmdNode.locator('[data-f="description"]').boundingBox()).height > h0 + 10);
await page.keyboard.press("Escape");

// group toggle
const grp = page.locator(".grp").filter({ has: page.locator('.grp-t[value="/eco-give"]') });
await grp.locator(".grp-h .sw").click();
s = await app();
check("group off disables its script", /enabled: false/.test(s.out["docs-examples-2.yml"]));
await grp.locator(".grp-h .sw").click();

// a loose Wait dropped onto the wire between a command and its step goes in between
const ecoCmd = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="eco-give"]') });
await view(ecoCmd, 600, 60);
const cb = await ecoCmd.boundingBox();
await page.mouse.click(cb.x + cb.width + 40, cb.y - 120, { button: "right" });
await page.locator(".ed-pop > .ed-mw > .ed-mi", { hasText: "Step" }).hover();
await page.locator(".ed-sub .ed-mi", { hasText: "Wait" }).click();
const wait = page.locator(".cb-wait.is-sel");
const wh = await wait.locator(".nh").boundingBox();
const then = await ecoCmd.locator(".output.output_1").boundingBox();
await page.mouse.move(wh.x + 60, wh.y + 15); await page.mouse.down();
await page.mouse.move(then.x + 60, then.y - 20, { steps: 12 });
check("the wire under a dragged Wait lights up", await page.locator("svg.connection.insert-at").count() === 1);
await shot("insert");
await page.mouse.up();
s = await app();
check("dropping it there puts the Wait between them", /command: .*eco give.*\n\s+delay: 1s/.test(s.out["docs-examples-2.yml"]), s.out["docs-examples-2.yml"].split("commands:")[1]);
await page.keyboard.press("Control+z");
await page.keyboard.press("Control+z");
await page.keyboard.press("Control+z");

// durations: suggestions in the editor's menu
const def2 = page.locator(".cb-defaults").filter({ has: page.locator('[data-f="d-runas"][value="OPERATOR"]:checked') });
await view(def2, 200, 150);
await def2.locator('[data-f="d-delay"]').click();
check("a duration field offers durations", await page.locator(".ed-pop .ed-mi", { hasText: "500ms" }).count() === 1);
await page.keyboard.type("1");
check("typing narrows them down", await page.locator(".ed-pop .ed-mi", { hasText: "500ms" }).count() === 0 && await page.locator(".ed-pop .ed-mi", { hasText: "1m" }).count() === 1);
await page.locator(".ed-pop .ed-mi", { hasText: "1m" }).click();
check("picking one fills the field", await def2.locator('[data-f="d-delay"]').inputValue() === "1m");
await def2.locator('[data-f="d-delay"]').fill("");
await page.keyboard.press("Escape");
// checks player: closed while unused, and picking an argument makes it required
await def2.locator('[data-f="d-player"]').click({ force: true });
check("checks player can't be opened while it's unused", await page.locator(".ed-pop .ed-mi", { hasText: "who ran it" }).count() === 0);

// groups from a selection
const alert = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="alert"]') });
const lobby = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="lobby"]') });
const groupsBefore = await page.locator(".grp").count();
await view(alert, 100, 10);
await alert.locator(".nh").click({ position: { x: 120, y: 15 } });
await page.evaluate(() => Alpine.$data(document.querySelector(".ed")).fit());
await lobby.locator(".nh .nk").click({ modifiers: ["Control"], force: true });
await page.keyboard.press("Control+g");
check("Ctrl+G groups two selected scripts", await page.locator(".grp").count() === groupsBefore - 1 && await page.locator(".grp:not(.solo) .grp-n").first().textContent() === "2 scripts");
await page.keyboard.press("Escape");
await page.keyboard.press("Control+z");
check("undo restores the groups", await page.locator(".grp").count() === groupsBefore);

// menus
const box = await page.locator("#ed-canvas").boundingBox();
await blank();
await page.mouse.click(box.x + 600, box.y + 400, { button: "right" });
check("context menu opens", await page.locator(".ed-pop").isVisible());
await page.locator(".ed-pop > .ed-mw > .ed-mi", { hasText: "Step" }).hover();
await shot("ctx-add");
await page.locator(".ed-sub .ed-mi", { hasText: "Execute" }).click();
check("Execute added from context menu", await page.locator(".cb-run .nh.has-err").count() === 1);
await page.mouse.click(box.x + 900, box.y + 300, { button: "right" });
await page.locator(".ed-pop .ed-mi-l").getByText("Server", { exact: true }).hover();
await shot("ctx-servers");
// safe triangle: heading diagonally into the submenu across other items keeps it open
const srvItem = await page.locator(".ed-pop .ed-mi-l").getByText("Server", { exact: true }).boundingBox();
const sub = await page.locator(".ed-mw.open > .ed-sub").boundingBox();
await page.mouse.move(srvItem.x + 20, srvItem.y + 8);
await page.mouse.move(sub.x + 10, sub.y + sub.height - 10, { steps: 12 });
check("safe triangle keeps the submenu", await page.locator(".ed-mw.open .ed-mi-l", { hasText: "lobby" }).count() === 1);
await page.locator(".ed-sub .ed-mi", { hasText: "lobby" }).click();
check("server added from the menu", await page.locator('.cb-server [data-f="id"][value="lobby"]').count() > 0);

await page.locator(".ed-addbtn").click();
await page.locator(".ed-pop .ed-mi-l").getByText("Server", { exact: true }).hover();
await shot("add-servers");
await page.locator('.ed-custom input').fill("hub-2");
await page.locator('.ed-custom button[value="VELOCITY"]').click();
check("custom id adds a proxy server", await page.locator('.cb-server:has([data-f="id"][value="hub-2"]):has([data-f="location"][value="VELOCITY"])').count() === 1);

// a new command comes with its Defaults wired
await page.locator(".ed-addbtn").click();
await page.locator(".ed-pop .ed-mi", { hasText: "Command" }).click();
s = await app();
const fresh = s.out["new-command.yml"] || "";
check("new command has Defaults with a target", /defaults:[\s\S]*execute:[\s\S]*proxy-1/.test(fresh) && !s.blocking.some((b) => b.script === "new-command"), JSON.stringify(s.blocking));
check("a new command gets exactly one group", await page.locator(".grp .grp-t").evaluateAll((e) => e.filter((x) => x.value === "/new-command").length) === 1);

// copy / paste
await view(alert, 100, 10);
await alert.locator(".nh").click({ position: { x: 120, y: 15 } });
await page.keyboard.press("Control+c");
await page.keyboard.press("Control+v");
s = await app();
check("pasted Command is a new script", Object.keys(s.out).includes("alert-copy.yml"));
const hb = await alert.locator(".nh").boundingBox();
await page.mouse.click(hb.x + 120, hb.y + 15, { button: "right" });
await page.locator(".ed-pop .ed-mi-l").getByText("Group", { exact: true }).hover();
await shot("ctx-node");
check("node menu shows the group, with the current one checked", await page.locator(".ed-mw.open .ed-sub .ed-mi.checked").count() === 1 && await page.locator(".ed-mw.open .ed-sub .ed-mi", { hasText: "New group" }).count() === 1);
await page.keyboard.press("Escape");

// renaming a command keeps its single group
const nc = page.locator(".cb-command").filter({ has: page.locator('[data-f="name"][value="new-command"]') });
await view(nc, 100, 100);
await nc.locator('[data-f="name"]').fill("");
await nc.locator('[data-f="name"]').type("alert");
await nc.locator('[data-f="name"]').fill("");
await nc.locator('[data-f="name"]').type("renamed");
check("renaming through a taken name keeps one group each", await page.evaluate(() => {
  const t = [...document.querySelectorAll(".grp .grp-t")].map((x) => x.value);
  return t.filter((v) => v === "/renamed").length === 1 && t.filter((v) => v === "/alert").length === 1;
}), await page.evaluate(() => [...document.querySelectorAll(".grp .grp-t")].map((x) => x.value).join(",")));
await page.keyboard.press("Escape");

// pickers
const arg = page.locator(".cb-arg").filter({ has: page.locator('[data-f="name"][value="message"]') });
await view(arg, 100, 100);
await arg.locator('[data-f="type"]').click();
await shot("type-menu");
check("type picker lists types by family", await page.locator(".ed-pop .ed-pop-s", { hasText: "Numbers" }).count() === 1);
await page.locator(".ed-pop .ed-mi", { hasText: "GREEDY_STRING" }).click();
check("picking a type reaches YAML", /type: GREEDY_STRING/.test((await app()).out["docs-examples-0.yml"]));
const alertRun = page.locator(".cb-run").filter({ has: page.locator('.ph[data-arg="message"]') }).first();
check("unwired step settings show what the Defaults give", await alertRun.locator('[data-port="run as"] .inh').textContent() === "console");

// sort
await page.locator(".ed-tool", { hasText: "Sort" }).click();
const cs = await crossings();
check("Sort: no overlapping nodes, no wire through a node", cs.overlaps === 0 && cs.wires === 0, JSON.stringify(cs));
await shot("sorted");

// yaml panel
await page.locator(".ed-tool", { hasText: "YAML" }).click();
await page.locator(".ed-yaml").waitFor({ state: "visible" });
await page.waitForTimeout(350); // the panel slides in
const grip = await page.locator(".ed-yaml-grip").boundingBox(), w0 = (await page.locator(".ed-yaml").boundingBox()).width;
await page.mouse.move(grip.x + 4, grip.y + 300); await page.mouse.down(); await page.mouse.move(grip.x - 150, grip.y + 300, { steps: 5 }); await page.mouse.up();
check("the YAML panel is dragged wider", (await page.locator(".ed-yaml").boundingBox()).width > w0 + 100);
const code = await page.locator(".ed-yaml-code").boundingBox();
await page.mouse.move(code.x + 20, code.y + 20); await page.mouse.down(); await page.mouse.move(code.x + 200, code.y + 80, { steps: 5 }); await page.mouse.up();
check("text selected in the YAML stays selected", await page.evaluate(() => { const t = document.querySelector(".ed-yaml-ta"); return t.selectionEnd - t.selectionStart > 5; }));
// editing the YAML changes the nodes
await page.locator(".ed-file", { hasText: "docs-examples-2.yml" }).click();
const ta = page.locator(".ed-yaml-ta");
const yaml0 = await ta.inputValue();
await ta.fill(yaml0.replace("silent: false", "silent: true"));
await page.locator(".ed-yaml-main header").click();
await page.waitForTimeout(100);
const ecoSilent = () => page.locator('.cb-command').filter({ has: page.locator('[data-f="name"][value="eco-give"]') }).locator('[data-f="silent"]').isChecked();
check("editing the YAML updates the node", await ecoSilent());
await ta.fill(yaml0.replace("version: 4", "version: [4"));
await page.waitForTimeout(900);
check("broken YAML shows an error and leaves the nodes", await page.locator(".ed-yaml-err").isVisible() && await ecoSilent());
// linting: a wrong value is underlined and explained on its line
await ta.fill(yaml0.replace("silent: false", "silent: maybe"));
check("a wrong value is underlined", await page.locator(".ed-yaml-lint .lint-e", { hasText: "maybe" }).count() === 1);
check("its line number says why", /true or false/.test(await page.locator(".ed-yaml-n span.le").first().getAttribute("data-err")));
await page.waitForTimeout(300);
await shot("yaml-lint");
// completion: values after a key, keys where a key goes
await ta.fill(yaml0);
await ta.evaluate((t) => { const i = t.value.indexOf("silent: false") + "silent: ".length; t.focus(); t.setSelectionRange(i, i + 5); });
await page.keyboard.press("Backspace");
await page.keyboard.press("Control+Space");
check("after a key the values are offered", (await page.locator(".ed-ycmp button > span").allTextContents()).join(",") === "true,false");
await page.waitForTimeout(300);
await shot("yaml-complete");
await page.keyboard.press("Enter");
check("Enter takes the first suggestion", (await ta.inputValue()).includes("silent: true"));
await ta.evaluate((t) => { const i = t.value.indexOf("  enabled: ", t.value.indexOf("permissions:")); t.focus(); t.setSelectionRange(i, i); });
await page.keyboard.type("  si\n".slice(0, 4));
check("keys already there aren't offered again", !(await page.locator(".ed-ycmp button > span").allTextContents()).includes("silent"));
await page.keyboard.press("Escape");
await ta.fill(yaml0);
await page.locator(".ed-yaml-main header").click();
await page.waitForTimeout(300);
check("the header names the file picked in the list", (await page.locator(".ed-yaml-main header span").textContent()) === "scripts/" + (await page.locator(".ed-file.on").getAttribute("title")).split(" (")[0],
  (await page.locator(".ed-yaml-main header span").textContent()) + " vs " + await page.locator(".ed-file.on").getAttribute("title"));
await shot("yaml");
await page.locator(".ed-tool", { hasText: "YAML" }).click();
await page.locator(".ed-tool", { hasText: "YAML" }).click();
check("YAML panel is highlighted", await page.locator(".ed-yaml .y-key").count() > 3);
check("YAML panel lists the files with what saving does", await page.locator(".ed-file.changed").count() > 0 && await page.locator(".ed-file.new").count() > 0, await page.locator(".ed-files").innerText());
await page.locator(".ed-file.new").first().click();
check("picking a file shows it", (await page.locator(".ed-yaml-main header span").textContent()).includes((await page.locator(".ed-file.new .ed-file-n").first().textContent())));
await shot("yaml");
await page.locator(".ed-tool", { hasText: "YAML" }).click();

// shortcuts
await page.keyboard.press("h");
check("H picks the grab tool", await page.evaluate(() => document.getElementById("ed-canvas").classList.contains("ed-grab")));
await page.keyboard.press("v");
await alert.locator('[data-f="enabled"]').evaluate((i) => i.focus());
const z0 = await page.evaluate(() => Alpine.$data(document.querySelector(".ed")).zoom);
await page.keyboard.press("Control+0");
check("shortcuts work while a switch has focus", await page.evaluate(() => Alpine.$data(document.querySelector(".ed")).zoom) === 100 && z0 !== undefined);
await view(alert, 100, 10);
await alert.locator(".nh").click({ position: { x: 120, y: 15 } });
const x0 = (await alert.boundingBox()).x;
await page.keyboard.press("ArrowRight");
check("arrow keys nudge", Math.round((await alert.boundingBox()).x - x0) === 10);

await page.evaluate(() => document.documentElement.classList.remove("dark"));
await view(ecoCmd, 300, 200);
await shot("light");
check("no page errors", !errors.length, errors.join(" | "));
await browser.close();
proxy.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
