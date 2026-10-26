// Drives the setup page in Chromium against a fake proxy. Needs the wiki dev server (8080) and the relay (wrangler dev, 8787).
// Run: node tests/browser/setup-ui.mjs [screenshot dir]
import { chromium } from "/usr/lib/node_modules/omniroute/node_modules/playwright-core/index.mjs";
import crypto from "node:crypto";

const SHOTS = process.argv[2];
const id = crypto.randomBytes(16).toString("hex"), secret = crypto.randomBytes(32);
const sign = (r, c, s, b) => crypto.createHmac("sha256", secret).update(`${r}\n${c}\n${s}\n${b}`).digest("base64url");
const proxy = new WebSocket(`ws://localhost:8787/api/editor/${id}/ws?role=proxy`, { headers: { Authorization: "Bearer cb-dump-upload-v1" } });
let seq = 0, conn = "";
const sendP = (m) => { const b = JSON.stringify(m); seq++; proxy.send(JSON.stringify({ conn, seq, body: b, mac: sign("proxy", conn, seq, b) })); };

// a stand-in for the proxy: lobby is connected and keeps its settings, so only the others get a code
const current = { serverId: "proxy-1", endpointType: "WEBSOCKET", port: 8765, bindHost: "0.0.0.0",
  redis: { host: "127.0.0.1", port: 6379, username: "" }, tlsMode: "TOFU", keystore: { path: "", type: "PKCS12" } };
const servers = [
  { id: "lobby", address: "127.0.0.1:30066", connected: true, platform: "PAPER", version: null },
  { id: "survival", address: "10.0.0.12:25565", connected: false, platform: null, version: null },
];
let plan = null, codes = {}, paired = {}, staged = null, plans = [];
const state = () => sendP({ type: "state", current, servers, saved: null, plan, codes, paired, staged });
proxy.onmessage = (e) => {
  const env = JSON.parse(e.data); conn = env.conn; const m = JSON.parse(env.body);
  if (m.type === "hello") state();
  if (m.type === "plan") {
    plans.push(m.plan);
    if (m.plan.address === "0.0.0.0") { sendP({ type: "plan-error", problems: ["Servers can't reach 0.0.0.0. Use the address they connect to."] }); return; }
    plan = m.plan; codes = {};
    for (const s of plan.servers) {
      if (s.id === "lobby") paired.lobby = { platform: "PAPER", version: null };
      else if (!paired[s.id]) codes[s.id] = "7KQM-4XR2-" + s.id.slice(0, 2).toUpperCase().replace(/[^2-9A-HJKMNP-Z]/g, "Z");
    }
    state();
  }
  if (m.type === "stage") { staged = "q8n2fl"; sendP({ type: "staged", code: staged }); }
  if (m.type === "unstage") { staged = null; state(); }
};
await new Promise((r) => (proxy.onopen = r));

let fails = 0;
const check = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (process.env.DEBUG && /error|warn/i.test(m.type())) console.log("CONSOLE", m.text()); });
const url = `http://localhost:8080/setup/#${id}:${secret.toString("base64url")}`;
await page.goto(url);
await page.evaluate(() => document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove());
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });
const nodes = () => page.locator(".q:visible").count();
const ask = () => page.locator(".ask:visible").first().textContent().catch(() => "");
const enter = async () => { await page.keyboard.press("Enter"); await page.waitForTimeout(250); };

try {
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent), null, { timeout: 15000 });
  check("starts with the name", (await ask()) === "What's this proxy called?", await ask());
  check("name is prefilled", await page.locator('[data-f="serverId"]').inputValue() === "proxy-1");
  let one = (await nodes()) === 1;
  await shot("1-name");
  await enter();
  check("asks how servers connect", (await ask()) === "How do your servers connect to the proxy?", await ask());
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

  // add a server Velocity doesn't have yet
  await page.locator(".srow-add").click();
  await page.locator('[data-f="new-id"]').fill("creative");
  await page.locator('[data-f="new-address"]').fill("10.0.0.13:25565");
  await shot("2-servers");
  await page.locator(".btn-next").click();
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent && e.textContent === "Pair your servers"), null, { timeout: 5000 }).catch(() => {});
  const sent = plans.at(-1);
  check("enter keeps the default port", sent?.port === 8765, JSON.stringify(sent));
  check("the plan marks the added server", sent?.servers.some((s) => s.id === "creative" && s.addToVelocity) && sent.servers.some((s) => s.id === "lobby" && !s.addToVelocity), JSON.stringify(sent?.servers));
  check("reaches pairing", (await ask()) === "Pair your servers", await ask());
  const cmds = await page.locator(".pair-row code").allTextContents();
  check("pairing shows a code per server", cmds.some((c) => c.startsWith("/cbc pair ") && c.includes("7KQM-4XR2-")) &&
    (await page.locator('.pair-row[data-id="survival"] code').count()) === 1 && (await page.locator('.pair-row[data-id="lobby"] code').count()) === 0, JSON.stringify(cmds));
  check("a waiting server says so", (await page.locator('.pair-row[data-id="survival"] .pair-state').textContent()).trim() === "waiting");
  await shot("3-pairing");
  if (SHOTS) {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(500);
    await shot("3-pairing-light");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }

  sendP({ type: "paired", id: "survival", platform: "PAPER", version: "1.21.4" });
  paired.survival = { platform: "PAPER", version: "1.21.4" }; delete codes.survival;
  await page.waitForTimeout(400);
  check("paired switches the server", await page.locator('.pair-row[data-id="survival"] .pair-state.ok').count() === 1);
  check("paired shows the software", (await page.locator('.pair-row[data-id="survival"]').textContent()).includes("Paper 1.21.4"));

  await page.reload();
  await page.evaluate(() => document.querySelector("[x-data*=cookie], .cookie, #cookie-banner")?.remove());
  await page.waitForFunction(() => [...document.querySelectorAll(".ask")].some((e) => e.offsetParent), null, { timeout: 15000 })
    .catch(async (e) => { throw new Error(e.message + " status: " + await page.locator(".ed-status").textContent()); });
  await page.waitForTimeout(300);
  check("reload lands on the same step", (await ask()) === "Pair your servers", await ask());
  check("reload keeps the code", (await page.locator('.pair-row[data-id="creative"] code').textContent().catch(() => "")).startsWith("/cbc pair "));

  await page.locator(".setup-later").click();
  await page.waitForTimeout(400);
  check("asks to apply", (await ask()) === "Ready to apply", await ask());
  check("apply shows the confirm command", (await page.locator(".setup-confirm code").textContent().catch(() => "")) === "/cb setup confirm q8n2fl");
  check("no download before applying", await page.locator(".setup-download").count() === 0);
  await shot("4-apply");

  sendP({ type: "applied", restartNeeded: true, errors: [], configs: { creative: "client-id: creative\n" } });
  await page.waitForTimeout(400);
  check("restart hint", (await page.locator(".setup-restart").textContent().catch(() => "")).includes("Restart the proxy to switch to the new connection settings."));
  check("download for unpaired servers", await page.locator(".setup-download").count() === 1 &&
    (await page.locator(".setup-download").textContent()).includes("download their configs") &&
    await page.locator('.setup-unpaired .pair-row[data-id="creative"] code').count() === 1);
  const dl = page.waitForEvent("download", { timeout: 3000 }).catch(() => null);
  await page.locator(".setup-download").click();
  const file = await dl;
  check("the download is the server's config", file?.suggestedFilename() === "creative-config.yml", file?.suggestedFilename());
  await shot("5-applied");

  // a new link pasted into the same tab only changes the #fragment; the page has to follow it
  await page.goto(`http://localhost:8080/setup/#${"0".repeat(32)}:${crypto.randomBytes(32).toString("base64url")}`);
  const ended = await page.waitForFunction(() => document.querySelector(".su-note-t")?.offsetParent && document.querySelector(".su-note-t").textContent === "This setup has ended", null, { timeout: 8000 }).then(() => true, () => false);
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
