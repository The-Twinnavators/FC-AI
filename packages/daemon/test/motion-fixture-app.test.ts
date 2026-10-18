/**
 * The motion foundation in a generated app (motion-fixture.ts: the Clean Cart look-up app on today's writers), driven
 * in Chromium with real input. Correctness first: the last of rapid inputs wins, navigation and filters work when a
 * transition is interrupted, skipped, unsupported, reduced or off, focus follows the kind of navigation, nothing is left
 * behind when a page goes away mid-move, and screenshots with animation off are deterministic. Motion-enabled behaviour
 * is checked separately from the screenshots. Levels are applied as the Look writes them (the level's tokens).
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright";
import { motionTokens, type MotionLevel } from "@flowcode/contracts";
import { hasRecordedApp, motionFixtureApp } from "./motion-fixture.js";

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1" || !hasRecordedApp();
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let base = "";
let root = "";

const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

beforeAll(async () => {
  if (SKIP) return;
  root = motionFixtureApp("balanced");
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

interface Open {
  page: Page;
  errors: string[];
  /** View transitions the page started. */
  vt: () => Promise<number>;
}
async function open(hash: string, o: { level?: MotionLevel; reduced?: boolean; off?: boolean; noViewTransitions?: boolean; ctx?: BrowserContextOptions } = {}): Promise<Open> {
  const context = await browser!.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: o.reduced ? "reduce" : "no-preference", ...o.ctx });
  await context.addInitScript(({ noVT }) => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const proto = Document.prototype as unknown as { startViewTransition?: (...a: unknown[]) => unknown };
    if (noVT) delete proto.startViewTransition;
    else if (proto.startViewTransition) {
      const real = proto.startViewTransition;
      proto.startViewTransition = function (this: Document, ...a: unknown[]) {
        w.__vt++;
        return real.apply(this, a);
      };
    }
  }, { noVT: !!o.noViewTransitions });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}${o.off ? "?motion=off" : ""}#/${hash}`);
  if (o.level && o.level !== "balanced") await page.addStyleTag({ content: `:root { ${Object.entries(motionTokens(o.level)).map(([k, v]) => `${k}: ${v};`).join(" ")} }` });
  await page.locator("main").waitFor();
  await page.waitForTimeout(400);
  return { page, errors, vt: () => page.evaluate(() => (window as unknown as { __vt: number }).__vt) };
}
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms);
const nav = (page: Page, label: string) => page.locator(".fl-lkf-link", { hasText: label }).first();
const focusIsPage = (page: Page) => page.evaluate(() => { const a = document.activeElement; const m = document.querySelector("main"); return !!a && !!m && (a === m || (m.contains(a) && a.tagName === "H1")); });
const titles = (page: Page) => page.locator(".fl-cat-card .fl-cat-open").allInnerTexts();
const leftovers = (page: Page) => page.evaluate(() => ({ moving: document.querySelectorAll("[data-moving]").length, nav: document.documentElement.dataset.nav ?? null }));
const category = (page: Page) => page.locator(".fl-cat-filters select").first();

describe.skipIf(SKIP)("motion in a generated app", () => {
  for (const level of ["minimal", "balanced", "expressive"] as const) {
    it(`${level}: rapid navigation and navigation during a transition end on the last page, with focus on it`, async () => {
      const { page, errors, vt } = await open("landing", { level });
      // Three presses in a row, each while the previous page is still moving in.
      for (const label of ["Lists", "Categories", "Search"]) await nav(page, label).click({ noWaitAfter: true });
      await settle(page);
      expect(page.url()).toMatch(/#\/catalog$/);
      expect(await focusIsPage(page)).toBe(true);
      // A raw press 30ms into a transition (no waiting for the page to settle) takes effect at once: the overlay never
      // holds input until the animation ends.
      await nav(page, "Lists").click();
      await page.waitForTimeout(30);
      const target = (await nav(page, "Find Stores").boundingBox())!;
      const [px, py] = [target.x + target.width / 2, target.y + target.height / 2];
      const under = await page.evaluate(([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement | null)?.closest(".fl-lkf-link")?.textContent ?? document.elementFromPoint(x!, y!)?.outerHTML.slice(0, 80), [px, py]);
      expect(under).toMatch(/Find Stores/);
      const pressedAt = Date.now();
      await page.mouse.click(px, py);
      await page.waitForFunction(() => location.hash === "#/places", undefined, { timeout: 2000, polling: 5 });
      expect(Date.now() - pressedAt).toBeLessThan(150);
      await settle(page);
      expect(page.url()).toMatch(/#\/places$/);
      expect(await page.locator(".fl-lkf-link[aria-current=page]").innerText()).toMatch(/Find Stores/);
      expect(await leftovers(page)).toEqual({ moving: 0, nav: null });
      expect(await vt()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await page.context().close();
    }, 60_000);

    it(`${level}: filter changes during movement end on the last choice; focus stays on the control`, async () => {
      const { page, errors } = await open("catalog", { level });
      const sel = category(page);
      await sel.focus();
      await sel.selectOption("Bakery");
      await sel.selectOption("Dairy");
      await sel.selectOption("Snacks");
      await settle(page);
      const moved = await titles(page);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SELECT");
      expect(await leftovers(page)).toEqual({ moving: 0, nav: null });
      // The same final choice with animation off gives the same results.
      const off = await open("catalog", { off: true });
      await category(off.page).selectOption("Snacks");
      expect(await titles(off.page)).toEqual(moved);
      expect(moved.length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await off.page.context().close();
      await page.context().close();
    }, 60_000);
  }

  it("Back and Forward return to where the page was, without pulling focus to the top; a new page starts at the top", async () => {
    const { page, errors } = await open("landing");
    await nav(page, "Search").click();
    await settle(page);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    expect(y).toBeGreaterThan(300);
    await page.locator(".fl-cat-card .fl-cat-open").nth(6).click();
    await settle(page);
    expect(page.url()).toMatch(/#\/product\//);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await focusIsPage(page)).toBe(true);
    await page.goBack();
    await settle(page);
    expect(page.url()).toMatch(/#\/catalog$/);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(8);
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await page.goForward();
    await settle(page);
    expect(page.url()).toMatch(/#\/product\//);
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("a same-page update (the category in the address) moves neither focus nor the scroll position", async () => {
    const { page, vt } = await open("catalog");
    await page.evaluate(() => window.scrollTo(0, 120));
    // The router never scrolls on a same-page update (the page may still get shorter when fewer results are left).
    await page.evaluate(() => { const w = window as unknown as { __scrolls: number }; w.__scrolls = 0; const real = window.scrollTo.bind(window); window.scrollTo = ((...a: Parameters<typeof window.scrollTo>) => (w.__scrolls++, real(...a))) as typeof window.scrollTo; });
    const sel = category(page);
    await sel.focus();
    const before = await vt();
    await sel.selectOption("Dairy");
    await settle(page);
    expect(page.url()).toMatch(/#\/catalog\/Dairy$/);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SELECT");
    expect(await page.evaluate(() => (window as unknown as { __scrolls: number }).__scrolls)).toBe(0);
    // The results moved (a continuity transition) but the page itself didn't change: one transition, the results'.
    expect((await vt()) - before).toBeLessThanOrEqual(1);
    // Back undoes the filter the same way: still the catalog, focus untouched.
    await page.goBack();
    await settle(page);
    expect(page.url()).toMatch(/#\/catalog$/);
    expect(await page.evaluate(() => (window as unknown as { __scrolls: number }).__scrolls)).toBe(0);
    await page.context().close();
  }, 60_000);

  it("rapid save toggles end on the state of the last press", async () => {
    const { page } = await open("catalog");
    const save = page.locator(".fl-cat-save").first();
    const start = await save.getAttribute("aria-pressed");
    for (let i = 0; i < 7; i++) await save.click({ delay: 0 });
    await settle(page, 300);
    expect(await save.getAttribute("aria-pressed")).toBe(start === "true" ? "false" : "true");
    await page.context().close();
  }, 60_000);

  it("a dialog opened and closed quickly gives focus back to what opened it, every time", async () => {
    const { page } = await open("catalog");
    const badge = page.locator(".fl-plc-badge").first();
    for (let i = 0; i < 5; i++) {
      await badge.click();
      await page.locator(".fl-plc-pop[role=dialog]").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(40);
      expect(await page.locator(".fl-plc-pop").count()).toBe(0);
      expect(await page.evaluate(() => document.activeElement?.classList.contains("fl-plc-badge"))).toBe(true);
    }
    await page.context().close();
  }, 60_000);

  it("reduced motion: quick fades with no travel at every level, followed live when the setting changes", async () => {
    const { page, errors } = await open("landing", { reduced: true, level: "expressive" });
    const tok = () => page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { base: s.getPropertyValue("--duration-base").trim(), dist: s.getPropertyValue("--enter-distance").trim(), stagger: s.getPropertyValue("--stagger-max").trim() }; });
    expect(await tok()).toEqual({ base: "120ms", dist: "0px", stagger: "0ms" });
    await nav(page, "Search").click();
    await settle(page);
    expect(page.url()).toMatch(/#\/catalog$/);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await tok()).toEqual({ base: motionTokens("expressive")["--duration-base"], dist: motionTokens("expressive")["--enter-distance"], stagger: motionTokens("expressive")["--stagger-max"] });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await tok()).dist).toBe("0px");
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("animation off: no transition starts, nothing animates, and the app works the same", async () => {
    const { page, errors, vt } = await open("landing", { off: true });
    await nav(page, "Search").click();
    await settle(page, 200);
    expect(page.url()).toMatch(/#\/catalog$/);
    await category(page).selectOption("Dairy");
    expect(await vt()).toBe(0);
    const anim = await page.evaluate(() => ({ running: document.getAnimations().length, transition: getComputedStyle(document.querySelector(".fl-cat-save")!).transitionDuration, hidden: [...document.querySelectorAll("main *")].filter((el) => getComputedStyle(el).opacity === "0" && (el as HTMLElement).offsetWidth > 0 && !el.closest("[aria-hidden=true]")).length }));
    expect(anim).toEqual({ running: 0, transition: "0s", hidden: 0 });
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("without View Transitions (an older browser), navigation, Back and filters behave the same", async () => {
    const { page, errors } = await open("landing", { noViewTransitions: true });
    expect(await page.evaluate(() => typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition)).toBe("undefined");
    await Promise.all([nav(page, "Lists").click(), nav(page, "Search").click()]);
    await settle(page, 300);
    expect(page.url()).toMatch(/#\/catalog$/);
    await category(page).selectOption("Bakery");
    await category(page).selectOption("Snacks");
    const t = await titles(page);
    await page.goBack();
    await settle(page, 300);
    expect(page.url()).not.toMatch(/Snacks$/);
    expect(t.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("leaving the catalog in the middle of a move leaves nothing behind", async () => {
    const { page, errors } = await open("catalog", { level: "expressive" });
    await category(page).selectOption("Bakery");
    await nav(page, "Lists").click();
    await settle(page);
    expect(page.url()).toMatch(/#\/lists$/);
    expect(await leftovers(page)).toEqual({ moving: 0, nav: null });
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("screenshots with animation off are deterministic", async () => {
    const a = await open("catalog", { off: true });
    const b = await open("catalog", { off: true });
    const [sa, sb] = [await a.page.screenshot({ fullPage: true }), await b.page.screenshot({ fullPage: true })];
    expect(sa.equals(sb)).toBe(true);
    await a.page.context().close();
    await b.page.context().close();
  }, 60_000);
});

