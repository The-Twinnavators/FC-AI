/**
 * Motion performance in the generated fixture app, measured (report only: runs when FLOWCODE_MOTION_REPORT names an
 * output file). Two separate things, never one score:
 *  - Responsiveness: the browser's Event Timing for real presses (input delay + handling + the next paint), per kind
 *    of interaction: page navigation, a category change, a save toggle.
 *  - Frame timing: requestAnimationFrame intervals and Long Animation Frames during a page transition and during a
 *    results move. Compositor animations (View Transitions run there) can stay smooth while the main thread is busy,
 *    and the reverse, so these frames describe the main thread only.
 * Conditions: desktop (1280x800) and a phone (390x844, touch, CPU slowed 4x), at Balanced, Expressive and reduced motion,
 * against a baseline with animation off (what the app costs without any motion).
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { motionTokens, type MotionLevel } from "@flowcode/contracts";
import { hasRecordedApp, motionFixtureApp } from "./motion-fixture.js";

const OUT = process.env.FLOWCODE_MOTION_REPORT;
const SKIP = !OUT || !hasRecordedApp();
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let base = "";
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

beforeAll(async () => {
  if (SKIP) return;
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

const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]! : 0);
const round = (n: number) => Math.round(n * 10) / 10;

async function setup(device: "desktop" | "phone", level: MotionLevel, reduced: boolean, off = false): Promise<Page> {
  const ctx = await browser!.newContext(device === "phone" ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: reduced ? "reduce" : "no-preference" } : { viewport: { width: 1280, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => {
    const w = window as unknown as { __events: Array<{ name: string; duration: number; id: number }>; __loaf: Array<{ start: number; duration: number }> };
    w.__events = [];
    w.__loaf = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { const t = e as PerformanceEventTiming & { interactionId?: number }; if (t.interactionId) w.__events.push({ name: t.name, duration: t.duration, id: t.interactionId }); })).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__loaf.push({ start: e.startTime, duration: e.duration }))).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      /* not in this browser */
    }
  });
  const page = await ctx.newPage();
  if (device === "phone") {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page.goto(`${base}${off ? "?motion=off" : ""}#/landing`);
  if (level !== "balanced") await page.addStyleTag({ content: `:root { ${Object.entries(motionTokens(level)).map(([k, v]) => `${k}: ${v};`).join(" ")} }` });
  await page.locator("main").waitFor();
  await page.waitForTimeout(800);
  return page;
}

const navTo = (page: Page, label: string) => page.locator(".fl-lkf-link:visible, .fl-lkf-bottom button:visible", { hasText: label }).first();

/** Frames on the main thread for `ms` after `act` starts. */
async function frames(page: Page, act: () => Promise<void>, ms = 900) {
  await page.evaluate((dur) => {
    const w = window as unknown as { __frames: number[]; __loafFrom: number };
    w.__frames = [];
    w.__loafFrom = performance.now();
    const t0 = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t);
      if (t - t0 < dur) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
  await act();
  await page.waitForTimeout(ms + 150);
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __loafFrom: number; __loaf: Array<{ start: number; duration: number }> };
    const iv = w.__frames.slice(1).map((t, i) => t - w.__frames[i]!);
    const loaf = w.__loaf.filter((l) => l.start >= w.__loafFrom);
    return { intervals: iv, loaf: loaf.map((l) => l.duration) };
  });
}

describe.skipIf(SKIP)("motion performance (report)", () => {
  it("measures responsiveness and frames", async () => {
    const report: Record<string, unknown> = { measuredAt: new Date().toISOString(), browser: `Chromium ${browser!.version()}`, note: "Event Timing durations are rounded by the browser to 8ms. Frame intervals are main-thread requestAnimationFrame; View Transition animations run on the compositor." };
    const rows: string[] = [];
    for (const device of ["desktop", "phone"] as const) {
      for (const [label, level, reduced, off] of [["off (baseline)", "balanced", false, true], ["balanced", "balanced", false, false], ["expressive", "expressive", false, false], ["reduced", "balanced", true, false]] as const) {
        const page = await setup(device, level, reduced, off);
        // Page transitions (frames) and their presses (responsiveness).
        const pageFrames: number[] = [];
        const pageLoaf: number[] = [];
        for (const to of ["Search", "Lists", "Home", "Search"]) {
          const f = await frames(page, () => navTo(page, to).click());
          pageFrames.push(...f.intervals);
          pageLoaf.push(...f.loaf);
        }
        // Results moving: category changes from the keyboard.
        const sel = page.locator(".fl-cat-filters select").first();
        await sel.focus();
        const moveFrames: number[] = [];
        const moveLoaf: number[] = [];
        for (let i = 0; i < 4; i++) {
          const f = await frames(page, () => page.keyboard.press("ArrowDown"), 700);
          moveFrames.push(...f.intervals);
          moveLoaf.push(...f.loaf);
        }
        // Save toggles.
        for (let i = 0; i < 6; i++) await page.locator(".fl-cat-save").first().click();
        await page.waitForTimeout(400);
        const events = await page.evaluate(() => (window as unknown as { __events: Array<{ name: string; duration: number; id: number }> }).__events);
        // One duration per interaction (its longest event).
        const byId = new Map<number, { name: string; duration: number }>();
        for (const e of events) if (!byId.has(e.id) || byId.get(e.id)!.duration < e.duration) byId.set(e.id, e);
        const inter = [...byId.values()];
        const kind = (n: string) => inter.filter((e) => (n === "press" ? ["pointerdown", "pointerup", "click"].includes(e.name) : e.name.startsWith("key"))).map((e) => e.duration);
        const presses = kind("press");
        const keys = kind("key");
        const sum = (iv: number[], loaf: number[]) => ({ frames: iv.length, p50: round(pct(iv, 50)), p95: round(pct(iv, 95)), max: round(Math.max(0, ...iv)), over25ms: iv.filter((x) => x > 25).length, longAnimationFrames: loaf.length, longestLoAF: round(Math.max(0, ...loaf)) });
        const r = {
          responsiveness: { presses: { n: presses.length, p75: round(pct(presses, 75)), max: round(Math.max(0, ...presses)) }, keyboard: { n: keys.length, p75: round(pct(keys, 75)), max: round(Math.max(0, ...keys)) } },
          framesPageTransition: sum(pageFrames, pageLoaf),
          framesResultsMove: sum(moveFrames, moveLoaf),
        };
        report[`${device}/${label}`] = r;
        rows.push(`${device}/${label}: presses p75 ${r.responsiveness.presses.p75}ms max ${r.responsiveness.presses.max}ms (n=${r.responsiveness.presses.n}); keys p75 ${r.responsiveness.keyboard.p75}ms max ${r.responsiveness.keyboard.max}ms; page frames p50 ${r.framesPageTransition.p50} p95 ${r.framesPageTransition.p95} max ${r.framesPageTransition.max} (>25ms: ${r.framesPageTransition.over25ms}/${r.framesPageTransition.frames}, LoAF ${r.framesPageTransition.longAnimationFrames}); move frames p95 ${r.framesResultsMove.p95} max ${r.framesResultsMove.max} (>25ms: ${r.framesResultsMove.over25ms}/${r.framesResultsMove.frames}, LoAF ${r.framesResultsMove.longAnimationFrames})`);
        await page.context().close();
      }
    }
    fs.writeFileSync(OUT!, JSON.stringify({ ...report, summary: rows }, null, 2));
  }, 600_000);
});
