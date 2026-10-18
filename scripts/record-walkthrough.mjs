/**
 * Records the Walkthrough (#/walkthrough) end to end as the presentation's backup video, with a screenshot of each
 * stage, and fails if the page logs an error. Needs the FlowCode daemon (7457) and UI (default 5200) running.
 *   node scripts/record-walkthrough.mjs [uiPort]
 * Writes docs/presentation/walkthrough-backup.webm and docs/presentation/stage-<n>-<id>.png.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const out = path.join(root, "docs/presentation");
fs.mkdirSync(out, { recursive: true });
const uiPort = process.argv[2] ?? "5200";
const base = `http://localhost:${uiPort}/?port=7457&token=dev-token-flowcode`;
const STAGES = ["prd", "requirements", "look", "build", "preview", "change", "verify"];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } }, colorScheme: "dark" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 200)}`));
const pause = (ms) => page.waitForTimeout(ms);
const scrollStage = async () => {
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 500);
    await pause(700);
  }
  await page.mouse.wheel(0, -3000);
  await pause(500);
};

await page.goto(`${base}#/walkthrough/prd`, { waitUntil: "load" });
await page.locator(".wt-stage").waitFor({ timeout: 30_000 });
await pause(2500);
for (const [i, id] of STAGES.entries()) {
  if (i > 0) {
    await page.locator(".wt-stage__nav .btn--primary").click();
    await page.waitForURL(new RegExp(`#/walkthrough/${id}$`));
    await pause(1800);
  }
  if (id === "requirements") {
    const boxes = page.locator(".wt-confirm input");
    for (let k = 0; k < Math.min(3, await boxes.count()); k++) (await boxes.nth(k).check(), await pause(300));
  }
  if (id === "build") {
    await page.getByRole("button", { name: "Play" }).click();
    await pause(9000);
    await page.getByRole("button", { name: "Show all" }).click();
    await pause(800);
  }
  if (id === "preview") {
    await pause(2500);
    await page.mouse.wheel(0, 400);
    await pause(2500);
    await page.getByRole("radio", { name: "Hand-built reference" }).click();
    await pause(3500);
    await page.getByRole("radio", { name: "FlowCode's build" }).click();
    await pause(2500);
    await page.mouse.wheel(0, -2000);
  }
  if (id === "change") {
    await page.getByRole("button", { name: "Plan this change" }).click();
    await pause(1500);
  }
  if (id === "verify") await pause(1500);
  await page.screenshot({ path: path.join(out, `stage-${i + 1}-${id}.png`), fullPage: true });
  if (id !== "preview") await scrollStage();
}
await pause(1000);
const video = page.video();
await context.close();
const target = path.join(out, "walkthrough-backup.webm");
fs.rmSync(target, { force: true });
fs.renameSync(await video.path(), target);
await browser.close();
console.log(JSON.stringify({ video: path.relative(root, target), screenshots: STAGES.length, errors }, null, 2));
process.exit(errors.length ? 1 : 0);
