// Drives the setup page in Chromium against a fake proxy. Needs the wiki dev server (8080) and the relay (wrangler dev, 8787).
// Run: node tests/browser/setup-ui.mjs [screenshot dir]
import { chromium } from "/usr/lib/node_modules/omniroute/node_modules/playwright-core/index.mjs";
import crypto from "node:crypto";
import { fakeProxy } from "./fake-proxy.mjs";

const SHOTS = process.argv[2];

// a stand-in for the proxy: lobby is connected and keeps its settings; the others get codes once the setup is confirmed
const current = { serverId: "proxy-1", endpointType: "WEBSOCKET", port: 8765, bindHost: "0.0.0.0",
  redis: { host: "127.0.0.1", port: 6379, username: "" }, tlsMode: "TOFU", keystore: { path: "", type: "PKCS12" } };
const servers = [
  { id: "lobby", address: "127.0.0.1:30066", connected: true, platform: "PAPER", version: null },
  { id: "survival", address: "10.0.0.12:25565", connected: false, platform: null, version: null },
];
let plan = null, codes = {}, paired = {}, staged = null, applied = false, finished = false, plans = [];
const state = () => sendP({ type: "state", current, servers, saved: null, plan, codes, paired, staged, applied });
const sendP = (m) => proxy.send(m);
const confirm = () => {
  applied = true; staged = null;
  for (const s of plan.servers) if (!paired[s.id]) codes[s.id] = "7KQM-4XR2-" + s.id.slice(0, 2).toUpperCase().replace(/[^2-9A-HJKMNP-Z]/g, "Z");
  sendP({ type: "applied", restartNeeded: true, errors: [] });
  state();
};
const proxy = await fakeProxy((m) => {
  if (m.type === "hello") state();
  if (m.type === "plan") {
    plans.push(m.plan);
    if (m.plan.address === "0.0.0.0") { sendP({ type: "plan-error", problems: ["Servers can't reach 0.0.0.0. Use the address they connect to."] }); return; }
    plan = m.plan; paired = { lobby: { platform: "PAPER", version: null } };
    state();
  }
  if (m.type === "stage") { staged = "q8n2fl"; sendP({ type: "staged", code: staged }); }
  if (m.type === "unstage") { staged = null; state(); }
  if (m.type === "finish") finished = true;
  if (m.type === "editor") sendP({ type: "editor", url: `http://localhost:8080/editor/#${"a".repeat(32)}:${"b".repeat(43)}` });
});

let fails = 0;
const check = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (process.env.DEBUG && /error|warn/i.test(m.type())) console.log("CONSOLE", m.text()); });
const url = `http://localhost:8080/setup/#${proxy.link}`;
await page.goto(url);
await page.evaluate(() => document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove());
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });
const nodes = () => page.locator(".q:visible").count();
const ask = () => page.locator(".ask:visible").first().textContent().catch(() => "");
const enter = async () => { await page.keyboard.press("Enter"); await page.waitForTimeout(250); };

try {
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent), null, { timeout: 15000 });
  check("starts with the name", (await ask()) === "What's this proxy called?", await ask());
  check("the secret leaves the address bar", !page.url().includes("#"), page.url());
  check("name is prefilled", await page.locator('[data-f="serverId"]').inputValue() === "proxy-1");
  let one = (await nodes()) === 1;
  await shot("1-name");
  await enter();
  check("asks how servers connect", (await ask()) === "How do your servers connect to the proxy?", await ask());
  check("the default choice is marked", (await page.locator('[data-step="type"] .opt:has([value="WEBSOCKET"]) .def').count()) === 1);
  check("a new screen slides in forward", await page.locator('[data-step="type"].in-fwd').count() === 1);
  one &&= (await nodes()) === 1;
  await enter();
  check("asks for the port", (await ask()) === "Which port do your servers connect to?", await ask());
  one &&= (await nodes()) === 1;
  await enter();
  check("asks for the address", (await ask()) === "What address do your servers connect to?", await ask());
  one &&= (await nodes()) === 1;

  await page.locator('[data-f="address"]').fill("0.0.0.0");
  await enter();
  check("zero address is refused", (await page.locator(".setup-err:visible").textContent().catch(() => "")).includes("Servers can't reach 0.0.0.0"),
    await page.locator(".setup-err").allTextContents());
  check("stays on the address", (await ask()) === "What address do your servers connect to?");
  const addressError = async (v) => { await page.locator('[data-f="address"]').fill(v); await enter(); return page.locator(".setup-err:visible").textContent().catch(() => ""); };
  check("a broken IP is refused", (await addressError("999.1.1.1")).includes("0 to 255"));
  check("a protocol is refused", (await addressError("ws://play.example.net")).includes("ws://"));
  check("a port in the address is refused", (await addressError("play.example.net:8765")).includes("port"));
  check("spaces are refused", (await addressError("play example")).includes("isn't a valid address"));
  await page.locator('[data-f="address"]').fill("play.example.net");
  await enter();
  check("asks about encryption", (await ask()) === "How should the connection be secured?", await ask());
  one &&= (await nodes()) === 1;
  await enter();
  check("asks for the servers", (await ask()) === "Which servers run CommandBridge?", await ask());
  one &&= (await nodes()) === 1;
  check("asks one question per screen", one);
  check("finished steps show their answer", (await page.locator(".su-progress button.done").evaluateAll((b) => b.map((x) => x.title))).includes("Address: play.example.net"),
    await page.locator(".su-progress button.done").evaluateAll((b) => b.map((x) => x.title)));

  // add servers Velocity doesn't have yet; the address starts as the proxy's, on the next free port
  await page.locator(".srow-add").click();
  check("a new server gets the proxy's address", await page.locator('[data-f="new-address"]').inputValue() === "play.example.net:30067",
    await page.locator('[data-f="new-address"]').inputValue());
  await page.locator('[data-f="new-id"]').fill("creative");
  await page.locator('[data-f="new-address"]').fill("10.0.0.13:99999");
  await enter();
  check("a bad server port is refused", (await page.locator(".setup-err:visible").textContent().catch(() => "")).includes("1 and 65535"));
  await page.locator('[data-f="new-address"]').fill("10.0.0.13:25565");
  await enter();
  check("enter adds the server and opens the next one", await page.locator('[data-step="servers"] .srow-id', { hasText: "creative" }).count() === 1 &&
    await page.locator('[data-f="new-id"]').inputValue() === "" && await page.locator('[data-f="new-address"]').inputValue() === "play.example.net:30067",
    JSON.stringify([await page.locator('.srow-id').allTextContents(), await page.locator('[data-f="new-id"]').inputValue().catch((e) => e.message.slice(0, 60)), await page.locator('[data-f="new-address"]').inputValue().catch(() => "-")]));
  await shot("2-servers");
  await page.locator(".btn-next").click();
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent && e.textContent === "Ready to apply"), null, { timeout: 5000 }).catch(() => {});
  const sent = plans.at(-1);
  check("enter keeps the default port", sent?.port === 8765, JSON.stringify(sent));
  check("the plan marks the added server", sent?.servers.some((s) => s.id === "creative" && s.addToVelocity) && sent.servers.some((s) => s.id === "lobby" && !s.addToVelocity), JSON.stringify(sent?.servers));
  check("an empty extra row isn't sent", !sent?.servers.some((s) => !s.id));
  check("asks to apply before pairing", (await ask()) === "Ready to apply", await ask());
  await page.waitForTimeout(300);
  check("apply shows the confirm command", (await page.locator(".setup-confirm code").textContent().catch(() => "")) === "/cb setup confirm q8n2fl");
  check("no pairing code before the confirm", await page.locator(".pair-row code").count() === 0);
  await shot("4-apply");

  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check("a reload keeps the link and the step", (await ask()) === "Ready to apply", await ask());

  confirm();
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent && e.textContent === "Pair your servers"), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  check("the confirm leads to pairing", (await ask()) === "Pair your servers", await ask());
  check("restart note", (await page.locator(".setup-restart").textContent().catch(() => "")).includes("CommandBridge restarted with the new settings"));
  check("no going back once applied", await page.locator(".setup-back:visible").count() === 0);
  const cmds = await page.locator('[data-step="pairing"] .pair-row code').allTextContents();
  check("pairing shows a code per server", cmds.some((c) => c.startsWith("/cbc pair ") && c.includes("7KQM-4XR2-")) &&
    (await page.locator('[data-step="pairing"] .pair-row[data-id="survival"] code').count()) === 1 && (await page.locator('[data-step="pairing"] .pair-row[data-id="lobby"] code').count()) === 0, JSON.stringify(cmds));
  check("a waiting server says so", (await page.locator('[data-step="pairing"] .pair-row[data-id="survival"] .pair-state').textContent()).trim() === "waiting");
  await page.locator('[data-step="pairing"] .pair-row[data-id="survival"] .cmd button').click();
  check("copy leaves out the slash", (await page.evaluate(() => Alpine.$data(document.querySelector(".su")).copied)).startsWith("cbc pair "));
  check("a connected server gets a checkmark", await page.locator('[data-step="pairing"] .pair-row[data-id="lobby"] .pair-check:visible').count() === 1);
  await shot("3-pairing");
  if (SHOTS) {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(500);
    await shot("3-pairing-light");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }

  // something that isn't a code never reaches the page, it would end up in a console
  const realCodes = { ...codes };
  codes.survival = "AAAA-BBBB-CC\nop attacker";
  state();
  await page.waitForTimeout(400);
  check("a malformed code is not shown", await page.locator('[data-step="pairing"] .pair-row[data-id="survival"] code').count() === 0);
  codes = realCodes;
  state();
  await page.waitForTimeout(300);

  sendP({ type: "paired", id: "survival", platform: "PAPER", version: "1.21.4" });
  paired.survival = { platform: "PAPER", version: "1.21.4" }; delete codes.survival;
  await page.waitForTimeout(400);
  check("paired switches the server", await page.locator('[data-step="pairing"] .pair-row[data-id="survival"] .pair-state.ok').count() === 1);
  check("paired shows the software", (await page.locator('[data-step="pairing"] .pair-row[data-id="survival"]').textContent()).includes("Paper 1.21.4"));

  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check("reload lands on the same step", (await ask()) === "Pair your servers", await ask());
  check("reload keeps the code", (await page.locator('[data-step="pairing"] .pair-row[data-id="creative"] code').textContent().catch(() => "")).startsWith("/cbc pair "));

  await page.locator(".setup-later").click();
  await page.waitForTimeout(500);
  check("the end says the network is set up", (await ask()) === "Your network is set up", await ask());
  check("the proxy hears the setup is finished", finished);
  check("the end still lists the unpaired code", await page.locator('[data-step="done"] .pair-row[data-id="creative"] code').count() === 1);
  check("the end offers the editor and the docs", await page.locator(".setup-editor:visible").count() === 1 && await page.locator('a[href="/docs/"]:visible').count() === 1);
  await shot("5-done");

  sendP({ type: "editor", url: "javascript:alert(document.domain)" });
  await page.waitForTimeout(400);
  check("a link that isn't the editor's is refused", page.url().startsWith("http://localhost:8080/setup/") &&
    (await page.locator('[data-step="done"] .setup-err:visible').textContent().catch(() => "")).includes("isn't the editor's"));

  await page.locator(".setup-editor").click();
  const opened = await page.waitForURL("**/editor/**", { timeout: 5000 }).then(() => true, () => false);
  check("the editor button opens the link the proxy sends", opened, page.url());

  // a new link pasted into the same tab only changes the #fragment; the page has to follow it
  await page.goto(`http://localhost:8080/setup/#${"0".repeat(32)}:${crypto.randomBytes(32).toString("base64url")}`);
  const ended = await page.waitForFunction(() => document.querySelector(".su-note-t")?.offsetParent && document.querySelector(".su-note-t").textContent === "Set up your network", null, { timeout: 8000 }).then(() => true, () => false);
  check("a new link in the same tab is followed", ended, await page.locator(".su-note").innerText().catch(() => ""));

  // without a link the page says where to get one
  await page.goto("http://localhost:8080/setup/");
  check("no link explains itself", (await page.locator(".setup-nolink").textContent().catch(() => "")).includes("/cb setup"));
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("ran to the end", false, e.message);
}

await browser.close();
proxy.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
