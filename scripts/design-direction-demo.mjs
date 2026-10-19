/**
 * Drives the Design direction page end to end on the isolated demo copy (scripts/design-demo-setup.mjs, demo daemon on
 * 7466) through the real UI, recording a video, screenshots and timings:
 *   1 read a direction · 2 change type, palette and density · 3 live preview of the project · 4 lock colours and try
 *   to change them · 5 apply and check the rendered app · 6 restore the previous version and apply it.
 *   node scripts/design-direction-demo.mjs [uiPort]
 * Writes docs/design-direction-demo/ (demo.webm, step-*.png, evidence.json). It never touches the main daemon.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const out = path.join(root, "docs/design-direction-demo");
fs.mkdirSync(out, { recursive: true });
const API = "http://127.0.0.1:7466";
const H = { authorization: "Bearer design-demo-token", "content-type": "application/json" };
const PROJECT = "prj_7dc3fb8e913b4f61840f";
const ui = `http://localhost:${process.argv[2] ?? "5200"}/?port=7466&token=design-demo-token&temp=1#/projects/${PROJECT}/design`;
const state = async () => (await fetch(`${API}/projects/${PROJECT}/design/state`, { headers: H })).json();
const evidence = { at: new Date().toISOString(), steps: [], errors: [] };
const note = (step, data) => (evidence.steps.push({ step, ...data }), console.log(step, JSON.stringify(data)));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } }, colorScheme: "dark" });
const page = await context.newPage();
page.on("pageerror", (e) => evidence.errors.push(e.message.slice(0, 200)));
const pause = (ms) => page.waitForTimeout(ms);
const seg = (label) => page.locator(".dd-seg button", { hasText: new RegExp(`^${label}$`) }).first();
const meta = () => page.locator(".dd-preview__meta").innerText();
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
// The time from an edit to the app painting it (the page reports it from the app's own paint acknowledgement).
const paint = async () => {
  await pause(700);
  const m = /Updated in (\d+) ms/.exec(await meta());
  return m ? Number(m[1]) : null;
};

const t0 = Date.now();
await page.goto(ui, { waitUntil: "load" });
await page.locator(".dd-controls").waitFor({ timeout: 30_000 });
note("page", { loadMs: Date.now() - t0 });
if (await page.getByRole("button", { name: "Start the preview" }).count()) {
  const t = Date.now();
  await page.getByRole("button", { name: "Start the preview" }).click();
  await page.locator(".dd-frame iframe").waitFor({ timeout: 90_000 });
  note("preview started", { ms: Date.now() - t });
}
await pause(5000);
if (await page.getByRole("button", { name: "Turn on live preview" }).count()) {
  await page.getByRole("button", { name: "Turn on live preview" }).click();
  await pause(2000);
  await page.reload();
  await page.locator(".dd-frame iframe").waitFor({ timeout: 60_000 });
  await pause(6000);
  note("live preview turned on", { bridge: (await state()).previewBridge });
}
await shot("step-0-start");

// 1. Read the PRD's own direction.
await page.getByRole("button", { name: "Use the PRD's direction" }).click();
await page.getByRole("button", { name: "Read my direction" }).click();
const understood = await page.locator(".dd-reading li").allInnerTexts();
note("1 direction read", { understood: understood.map((u) => u.replace(/\s+/g, " ")), unread: (await page.locator(".dd-unread").innerText().catch(() => "")).replace(/\s+/g, " "), paintMs: await paint() });
await shot("step-1-direction");

// 2–3. Direct controls; the project's own preview follows each one.
await page.getByLabel("Heading font").selectOption("Fraunces");
const fontMs = await paint();
await page.getByLabel("Accent colour hex value").fill("#7a2338");
await page.getByLabel("Accent colour hex value").press("Enter");
const accentMs = await paint();
await seg("Compact").click();
const densityMs = await paint();
note("2-3 controls with live preview", { fontMs, accentMs, densityMs, draft: (await state()).draft?.appearance });
await shot("step-2-controls");

// 4. Lock the colours, then ask for different ones.
await page.locator(".dd-lock").first().click();
await pause(800);
await page.getByLabel("Describe the look").fill("Bright teal accent, dark mode. Square corners.");
await page.getByRole("button", { name: "Read my direction" }).click();
await pause(1500);
const st4 = await state();
note("4 lock", { understood: (await page.locator(".dd-reading li").allInnerTexts()).map((u) => u.replace(/\s+/g, " ")), locks: st4.locks, serverDraft: { primary: st4.draft?.appearance.primary, mode: st4.draft?.appearance.mode, radius: st4.draft?.appearance.shape?.radius } });
await shot("step-4-lock");

// 5. Apply and check the rendered app.
let t = Date.now();
await page.locator(".dd-foot").getByRole("button", { name: "Apply to the app" }).click();
await page.locator(".dd-msg").filter({ hasText: /Applied to the app|Not applied/ }).waitFor({ timeout: 300_000 });
const applyMs = Date.now() - t;
const st5 = await state();
note("5 apply", { applyMs, applied: st5.applied?.version, checks: [...(st5.applied?.verification?.technical.checks ?? []), ...(st5.applied?.verification?.browser.checks ?? [])].map((c) => `${c.kind}: ${c.status} (${c.summary})`) });
await page.reload();
await page.locator(".dd-frame iframe").waitFor({ timeout: 60_000 });
await pause(6000);
await seg("As the app is").click();
await pause(1500);
await shot("step-5-applied");

// 6. Restore the version before: first with the colours still locked, then unlocked, and apply it.
const versions = (await state()).versions.map((v) => v.version);
const prev = versions.filter((v) => v !== st5.applied?.version).at(-1);
await seg("Draft").click();
const row = page.locator(".dd-versions li", { hasText: `Version ${prev}` });
await row.getByRole("button", { name: "Restore" }).click();
await pause(1500);
const lockedRestore = (await state()).draft?.appearance;
await page.locator(".dd-lock").first().click();
await pause(800);
await row.getByRole("button", { name: "Restore" }).click();
await pause(1500);
const fullRestore = (await state()).draft?.appearance;
note("6 restore", { versions, restored: prev, withColoursLocked: { primary: lockedRestore?.primary, display: lockedRestore?.fonts.display }, unlocked: { primary: fullRestore?.primary, display: fullRestore?.fonts.display } });
await shot("step-6-restored-draft");
t = Date.now();
await page.locator(".dd-foot").getByRole("button", { name: "Apply to the app" }).click();
await page.locator(".dd-msg").filter({ hasText: /Applied to the app|Not applied/ }).waitFor({ timeout: 300_000 });
const st6 = await state();
note("6 apply restored", { applyMs: Date.now() - t, applied: st6.applied?.version, appearance: { primary: st6.applied?.appearance.primary, display: st6.applied?.appearance.fonts.display }, look: (st6.applied?.verification?.browser.checks ?? []).find((c) => c.kind === "look_reached") });
await page.reload();
await page.locator(".dd-frame iframe").waitFor({ timeout: 60_000 });
await pause(6000);
await seg("As the app is").click();
await pause(1500);
await shot("step-6-restored-applied");

const video = page.video();
await context.close();
fs.rmSync(path.join(out, "demo.webm"), { force: true });
fs.renameSync(await video.path(), path.join(out, "demo.webm"));
await browser.close();
fs.writeFileSync(path.join(out, "evidence.json"), JSON.stringify(evidence, null, 2));
console.log(`errors: ${evidence.errors.length}`);
