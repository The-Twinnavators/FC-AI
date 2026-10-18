/**
 * FlowCode's screenshots check (quality/preview.ts captureScreenshots) takes its pictures with animation off and only
 * once the page is still: on the generated fixture app, the app sees <html data-motion="off"> before its scripts run,
 * a picture taken right after starting a move (a category change) is identical to one taken after waiting, and two
 * runs give identical pictures. Motion itself is tested separately (motion-fixture-app, motion-parts-fixture).
 */
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { captureScreenshots, type BrowserSession } from "../src/quality/preview.js";
import { hasRecordedApp, motionFixtureApp } from "./motion-fixture.js";

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1" || !hasRecordedApp();
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let base = "";
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

beforeAll(async () => {
  if (SKIP) return;
  const root = motionFixtureApp("expressive");
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

describe.skipIf(SKIP)("the screenshots check takes still pictures", () => {
  it("animation is off before the app runs, and a picture mid-move equals one taken after waiting", async () => {
    const session = { browser } as unknown as BrowserSession;
    const seen: string[] = [];
    const mark = async (page: Page) => void seen.push(await page.evaluate(() => document.documentElement.dataset.motion ?? "on"));
    // Start a results move (Expressive: the slowest) just before the picture.
    const midMove = (page: Page) => mark(page).then(() => page.locator(".fl-cat-filters select").first().selectOption("Dairy")).then(() => undefined);
    const afterWait = (page: Page) => midMove(page).then(() => page.waitForTimeout(1500));
    const a = await captureScreenshots(session, `${base}#/catalog`, midMove);
    const b = await captureScreenshots(session, `${base}#/catalog`, afterWait);
    const c = await captureScreenshots(session, `${base}#/catalog`, midMove);
    expect(seen.every((m) => m === "off")).toBe(true);
    expect(a.length).toBeGreaterThan(1);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.png.equals(b[i]!.png), `${a[i]!.name}: mid-move vs after waiting`).toBe(true);
      expect(a[i]!.png.equals(c[i]!.png), `${a[i]!.name}: two runs`).toBe(true);
    }
  }, 180_000);
});
