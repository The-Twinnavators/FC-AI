/**
 * The Motion Lab harness (docs/design/motion/motion-lab.html): what caused the early failed check runs, measured
 * (report only: runs when FLOWCODE_MOTION_HARNESS_REPORT names an output file).
 *  A. Clean runs of its in-page checks at every level, reduced motion and animation off.
 *  B. The same checks with real presses landing elsewhere on the page mid-run (what happened in the preview pane).
 *  C. The three flows that failed, driven with real input only (real presses and keys, the browser's own Back),
 *     repeated: if any of them were a defect with real use, it would show here.
 *  D. Frame timing of the expand/collapse pattern (grid rows: a measured exception to transform/opacity) on a phone
 *     with the CPU slowed 4x.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const OUT = process.env.FLOWCODE_MOTION_HARNESS_REPORT;
const LAB = pathToFileURL(path.resolve(import.meta.dirname, "../../../docs/design/motion/motion-lab.html")).href;
let browser: Browser | undefined;
beforeAll(async () => {
  if (OUT) browser = await chromium.launch();
});
afterAll(async () => browser?.close());

async function lab(opts: { reduced?: boolean; phone?: boolean } = {}) {
  const ctx = await browser!.newContext(opts.phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: opts.reduced ? "reduce" : "no-preference" } : { viewport: { width: 1280, height: 900 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  await page.goto(LAB);
  await page.waitForTimeout(500);
  return page;
}
const setLevel = (page: Page, level: string) => page.locator(`#level [data-v=${level}]`).click();
async function runChecks(page: Page, during?: () => Promise<void>) {
  await page.locator("#run").click();
  const bg = during ? during() : Promise.resolve();
  await page.waitForFunction(() => !(document.querySelector("#run") as HTMLButtonElement).disabled && document.querySelectorAll("#checks li").length > 0, undefined, { timeout: 60_000, polling: 200 });
  await bg;
  return page.evaluate(() => ({ summary: document.querySelector("#run-sum")!.textContent, failed: [...document.querySelectorAll("#checks li")].filter((li) => li.querySelector(".no")).map((li) => `${li.children[1]!.firstChild!.textContent} —${li.querySelector("[data-detail]")?.textContent ?? ""}`)}));
}

describe.skipIf(!OUT)("Motion Lab harness: the early failures", () => {
  it("measures", async () => {
    const report: Record<string, unknown> = { measuredAt: new Date().toISOString(), browser: `Chromium ${browser!.version()}` };

    // A. Clean runs.
    const clean: Record<string, unknown> = {};
    for (const [label, level, reduced, off] of [["minimal", "minimal", false, false], ["balanced", "balanced", false, false], ["expressive", "expressive", false, false], ["expressive+reduced", "expressive", true, false], ["balanced+off", "balanced", false, true]] as const) {
      const page = await lab({ reduced });
      await setLevel(page, level);
      if (off) await page.locator("#off").check();
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await runChecks(page));
      clean[label] = runs.map((r) => ({ summary: r.summary, failed: r.failed }));
      await page.context().close();
    }
    report.A_cleanRuns = clean;

    // B. Real presses elsewhere on the page while the checks run (on the intro text, as a person reading would).
    const interfered = [];
    for (let i = 0; i < 3; i++) {
      const page = await lab();
      await setLevel(page, "balanced");
      const r = await runChecks(page, async () => {
        for (let k = 0; k < 8; k++) {
          await page.waitForTimeout(700 + k * 150);
          await page.mouse.click(40, 120);
        }
      });
      interfered.push(r);
      await page.context().close();
    }
    report.B_withPressesElsewhere = interfered;

    // C. The three flows that failed, with real input only, 10 times each at each animated level.
    const real: Record<string, { pass: number; of: number; notes: string[] }> = {};
    for (const level of ["balanced", "expressive"]) {
      const page = await lab();
      await setLevel(page, level);
      const tally = (name: string, ok: boolean, note?: string) => {
        const t = (real[`${level}: ${name}`] ??= { pass: 0, of: 0, notes: [] });
        t.of++;
        if (ok) t.pass++;
        else if (note) t.notes.push(note);
      };
      for (let i = 0; i < 10; i++) {
        // Dialog: open with a real press, close with the real Escape key at once.
        await page.locator("#open-dlg").click();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(350);
        const d = await page.evaluate(() => ({ open: (document.querySelector("#dlg") as HTMLDialogElement).open, focus: document.activeElement?.id }));
        tally("dialog open + Escape → closed, focus on opener", !d.open && d.focus === "open-dlg", JSON.stringify(d));
        // Tabs: real press on the first tab, then four real ArrowRight keys.
        await page.locator("#t1").click();
        for (let k = 0; k < 4; k++) await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(450);
        const t = await page.evaluate(() => {
          const sel = document.querySelector('[role=tab][aria-selected="true"]') as HTMLElement;
          const ind = (document.querySelector(".ind") as HTMLElement).getBoundingClientRect();
          const tb = sel.getBoundingClientRect();
          return { sel: sel.id, focus: document.activeElement?.id, dx: Math.round(Math.abs(ind.left - tb.left)), dw: Math.round(Math.abs(ind.width - tb.width)) };
        });
        tally("tabs: 4 × ArrowRight → second tab, focus and indicator on it", t.sel === "t2" && t.focus === "t2" && t.dx < 2 && t.dw < 2, JSON.stringify(t));
        // Page transitions: three real presses in a row, then the browser's Back.
        for (const p of ["list", "stores", "list"]) await page.locator(`#mini nav a[data-p=${p}]`).click({ noWaitAfter: true });
        await page.waitForTimeout(700);
        const last = await page.evaluate(() => ({ heading: document.querySelector("#mini-page h3")?.textContent, focus: document.activeElement?.tagName }));
        await page.goBack();
        await page.waitForTimeout(700);
        const back = await page.evaluate(() => document.querySelector("#mini-page h3")?.textContent);
        tally("pages: 3 presses → last page, focus on its heading; Back → previous", last.heading === "My list" && last.focus === "H3" && back === "Stores", JSON.stringify({ last, back }));
        await page.locator('#mini nav a[data-p="home"]').click();
        await page.waitForTimeout(500);
      }
      await page.context().close();
    }
    report.C_realInput = real;

    // D. Expand/collapse frames on a slowed phone.
    {
      const page = await lab({ phone: true });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await setLevel(page, "balanced");
      await page.locator("[aria-controls=d1]").scrollIntoViewIfNeeded();
      const iv: number[] = [];
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => {
          const w = window as unknown as { __f: number[] };
          w.__f = [];
          const t0 = performance.now();
          const tick = (t: number) => (w.__f.push(t), t - t0 < 600 && requestAnimationFrame(tick));
          requestAnimationFrame(tick);
        });
        await page.locator("[aria-controls=d1]").click();
        await page.waitForTimeout(750);
        iv.push(...(await page.evaluate(() => { const f = (window as unknown as { __f: number[] }).__f; return f.slice(1).map((t, i) => t - f[i]!); })));
      }
      const s = [...iv].sort((a, b) => a - b);
      report.D_disclosurePhone4x = { frames: iv.length, p50: Math.round(s[Math.floor(s.length * 0.5)]! * 10) / 10, p95: Math.round(s[Math.floor(s.length * 0.95)]! * 10) / 10, max: Math.round(Math.max(...iv) * 10) / 10, over25ms: iv.filter((x) => x > 25).length };
      await page.context().close();
    }
    fs.writeFileSync(OUT!, JSON.stringify(report, null, 2));
  }, 900_000);
});
