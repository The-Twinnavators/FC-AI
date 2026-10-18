/**
 * Review recordings for motion (runs only when FLOWCODE_MOTION_RECORD names an output folder): short screen recordings,
 * not proof of anything by themselves.
 *  1. Balanced product journey: the generated fixture app on a desktop (catalog, filters, a product, save, Back).
 *  2. Expressive marketing example: the Motion Lab harness (hero, cards, filtering, product demo) on a desktop and a phone.
 *     The harness only; expressive pieces aren't in the builder (phase 3).
 *  3. Reduced-motion equivalents: the same journey on a phone and the same harness sections, with reduced motion.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { hasRecordedApp, motionFixtureApp } from "./motion-fixture.js";

const OUT = process.env.FLOWCODE_MOTION_RECORD;
const LAB = pathToFileURL(path.resolve(import.meta.dirname, "../../../docs/design/motion/motion-lab.html")).href;
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let base = "";
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

beforeAll(async () => {
  if (!OUT || !hasRecordedApp()) return;
  fs.mkdirSync(OUT, { recursive: true });
  const root = motionFixtureApp("balanced");
  const port = await freePort();
  server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120 && !(await fetch(base).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  server?.kill();
});

const DESKTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 } };
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function record(name: string, opts: BrowserContextOptions, reduced: boolean, script: (page: Page) => Promise<void>) {
  const size = opts.viewport!;
  const ctx = await browser!.newContext({ ...opts, reducedMotion: reduced ? "reduce" : "no-preference", recordVideo: { dir: OUT!, size } });
  const page = await ctx.newPage();
  await script(page);
  await page.waitForTimeout(600);
  const video = page.video();
  await ctx.close();
  const file = await video!.path();
  fs.renameSync(file, path.join(OUT!, `${name}.webm`));
}

const pause = (page: Page, ms = 900) => page.waitForTimeout(ms);
const navTo = (page: Page, labels: string[]) => page.locator(".fl-lkf-link:visible, .fl-lkf-bottom button:visible", { hasText: new RegExp(`^\\s*(${labels.join("|")})\\s*$`) }).first();

async function journey(page: Page) {
  await page.goto(`${base}#/landing`);
  await pause(page, 1200);
  await navTo(page, ["Search", "Catalog"]).click();
  await pause(page);
  const cat = page.locator(".fl-cat-filters select").first();
  await cat.selectOption("Bakery");
  await pause(page);
  await cat.selectOption("Dairy");
  await pause(page);
  await cat.selectOption("");
  await pause(page);
  await page.locator(".fl-cat-filters select").nth(1).selectOption({ index: 1 });
  await pause(page);
  await page.locator(".fl-cat-save").first().click();
  await pause(page, 600);
  await page.locator(".fl-cat-card .fl-cat-open").nth(1).click();
  await pause(page, 1200);
  await page.goBack();
  await pause(page, 1100);
  await navTo(page, ["Lists"]).click();
  await pause(page, 1100);
}

async function marketing(page: Page, level: "expressive" | "balanced") {
  await page.goto(LAB);
  await page.locator(`#level [data-v=${level}]`).click();
  await page.locator("#surface [data-v=tactile]").click();
  await page.locator("#hero").scrollIntoViewIfNeeded();
  await pause(page, 300);
  await page.locator("#replay").click();
  await pause(page, 1400);
  await page.locator("#cards").scrollIntoViewIfNeeded();
  await pause(page, 1200);
  await page.locator("#filter").scrollIntoViewIfNeeded();
  for (const c of ["dairy", "bakery", "produce", "all"]) {
    await page.locator(`#chips [data-c=${c}]`).click();
    await pause(page, 700);
  }
  await page.locator("#sort").click();
  await pause(page, 900);
  await page.locator("#demo").scrollIntoViewIfNeeded();
  await pause(page, 5200);
}

describe.skipIf(!OUT || !hasRecordedApp())("motion review recordings", () => {
  it("records", async () => {
    await record("1-balanced-product-journey-desktop", DESKTOP, false, journey);
    await record("2-expressive-marketing-harness-desktop", DESKTOP, false, (p) => marketing(p, "expressive"));
    await record("2-expressive-marketing-harness-phone", PHONE, false, (p) => marketing(p, "expressive"));
    await record("3-reduced-product-journey-phone", PHONE, true, journey);
    await record("3-reduced-marketing-harness-desktop", DESKTOP, true, (p) => marketing(p, "expressive"));
  }, 600_000);
});
