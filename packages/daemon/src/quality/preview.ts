/**
 * Preview, screenshots and browser checks (§13.2, §13.3, FR-Q1/Q2, Phase 7). Playwright is launched and
 * owned by the daemon (as a run-owned process) and connects to the run's own dev server.
 */
import net from "node:net";
import { chromium, type Browser, type BrowserServer, type Page } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type { Finding } from "@flowcode/contracts";
import type { ProcessManager } from "../commands/processManager.js";

export const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => resolve(typeof addr === "object" && addr ? addr.port : 0));
    });
  });
}

export class BrowserSession {
  private constructor(
    readonly server: BrowserServer,
    readonly browser: Browser,
    private procId?: string,
    private processes?: ProcessManager,
  ) {}

  static async launch(runId: string, processes?: ProcessManager): Promise<BrowserSession> {
    const server = await chromium.launchServer({ headless: true });
    const pid = server.process().pid;
    const rec = processes && pid ? processes.registerPid(runId, pid, ["chromium", "--headless"], "browser") : undefined;
    const browser = await chromium.connect(server.wsEndpoint());
    return new BrowserSession(server, browser, rec?.id, processes);
  }

  async close() {
    await this.browser.close().catch(() => undefined);
    await this.server.close().catch(() => undefined);
    if (this.procId) this.processes?.markExited(this.procId);
  }
}

export interface HealthResult {
  ok: boolean;
  status?: number;
  consoleErrors: string[];
  pageErrors: string[];
  rootHasContent: boolean;
  title: string;
  loadMs: number;
}

export async function checkHealth(session: BrowserSession, url: string): Promise<HealthResult> {
  const page = await session.browser.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 300)));
  const started = Date.now();
  let status: number | undefined;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    status = res?.status();
    await page.waitForTimeout(400);
    const rootHasContent = await page.evaluate(() => {
      const root = document.querySelector("#root") ?? document.body;
      return (root?.textContent ?? "").trim().length > 0;
    });
    const title = await page.title();
    return { ok: status === 200 && rootHasContent && pageErrors.length === 0, status, consoleErrors, pageErrors, rootHasContent, title, loadMs: Date.now() - started };
  } catch (err) {
    pageErrors.push((err as Error).message.slice(0, 300));
    return { ok: false, status, consoleErrors, pageErrors, rootHasContent: false, title: "", loadMs: Date.now() - started };
  } finally {
    await page.close();
  }
}

export interface ScreenshotResult {
  name: string;
  width: number;
  height: number;
  png: Buffer;
  horizontalOverflow: boolean;
  overflowingElements: string[];
}

export async function captureScreenshots(session: BrowserSession, url: string, prepare?: (page: Page) => Promise<void>): Promise<ScreenshotResult[]> {
  const out: ScreenshotResult[] = [];
  for (const vp of VIEWPORTS) {
    const ctx = await session.browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (prepare) await prepare(page);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = doc.scrollWidth > window.innerWidth + 1;
      const els: string[] = [];
      if (over) {
        for (const el of Array.from(document.querySelectorAll("body *")).slice(0, 2000)) {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 && r.width > 0) els.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.className && typeof el.className === "string" ? `.${el.className.split(" ").join(".")}` : ""}`);
          if (els.length >= 5) break;
        }
      }
      return { over, els };
    });
    const png = await page.screenshot({ fullPage: true });
    out.push({ name: vp.name, width: vp.width, height: vp.height, png, horizontalOverflow: overflow.over, overflowingElements: overflow.els });
    await ctx.close();
  }
  return out;
}

export interface AxeOutcome {
  findings: Finding[];
  counts: Record<string, number>;
  passes: number;
  incomplete: number;
  raw: unknown;
}

/** The accessibility rules that are part of the look, checked in the Design build: text contrast and touch-target size. */
export const LOOK_RULES = ["color-contrast", "target-size"];

export async function runAxe(session: BrowserSession, url: string, prepare?: (page: Page) => Promise<void>, rules?: string[]): Promise<AxeOutcome> {
  const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  if (prepare) await prepare(page);
  const builder = new AxeBuilder({ page });
  const results = await (rules ? builder.withRules(rules) : builder.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])).analyze();
  await ctx.close();
  const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const findings: Finding[] = results.violations.map((v, i) => {
    const sev = (v.impact ?? "moderate") as "critical" | "serious" | "moderate" | "minor";
    counts[sev] = (counts[sev] ?? 0) + 1;
    return {
      id: `axe_${i + 1}`,
      category: "accessibility",
      rule: v.id,
      severity: sev,
      confidence: "high",
      message: `${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
      evidence: v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | "),
      recommendation: v.helpUrl,
      manualValidationRequired: false,
      source: "browser",
    };
  });
  return { findings, counts, passes: results.passes.length, incomplete: results.incomplete.length, raw: { violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), passes: results.passes.length } };
}

export interface KeyboardWalk {
  stops: Array<{ tag: string; name: string; focusVisible: boolean }>;
  allControlsReachable: boolean;
  missingFocusIndicator: string[];
}

/** Tabs through the page and records focus stops and whether a visible focus indicator is drawn. */
export async function keyboardWalkthrough(session: BrowserSession, url: string, maxStops = 25): Promise<KeyboardWalk> {
  const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  const controls = await page.evaluate(() => Array.from(document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")).filter((e) => !(e as HTMLButtonElement).disabled && (e as HTMLElement).offsetParent !== null).length);
  const stops: KeyboardWalk["stops"] = [];
  for (let i = 0; i < Math.min(maxStops, controls + 1); i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return undefined;
      const cs = getComputedStyle(el);
      const focusVisible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none") || false;
      const name = el.getAttribute("aria-label") ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? "";
      return { tag: el.tagName.toLowerCase(), name: name.trim().slice(0, 60), focusVisible: !!focusVisible };
    });
    if (!info) break;
    stops.push(info);
  }
  await ctx.close();
  const unique = new Set(stops.map((s) => `${s.tag}:${s.name}`));
  return { stops, allControlsReachable: unique.size >= controls, missingFocusIndicator: stops.filter((s) => !s.focusVisible).map((s) => `${s.tag} "${s.name}"`) };
}

export interface SmokeStep {
  step: string;
  ok: boolean;
  detail: string;
}

/**
 * Reproducible smoke test for the scheduler golden path (§19 required evidence): create, edit, delete,
 * list and persistence across reload — driven through accessible names, like a user would.
 */
export async function schedulerSmokeTest(session: BrowserSession, url: string): Promise<{ ok: boolean; steps: SmokeStep[]; screenshots: Array<{ name: string; png: Buffer }> }> {
  const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const steps: SmokeStep[] = [];
  const shots: Array<{ name: string; png: Buffer }> = [];
  const step = async (name: string, fn: () => Promise<string | void>) => {
    try {
      const detail = (await fn()) ?? "ok";
      steps.push({ step: name, ok: true, detail });
      return true;
    } catch (err) {
      steps.push({ step: name, ok: false, detail: (err as Error).message.split("\n")[0].slice(0, 300) });
      return false;
    }
  };
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    const ok =
      (await step("empty state visible", async () => {
        await page.getByText(/no events yet/i).first().waitFor({ timeout: 5000 });
        shots.push({ name: "empty-state", png: await page.screenshot() });
      })) &&
      (await step("create event", async () => {
        await page.getByLabel(/^title/i).fill("Dentist appointment");
        await page.getByLabel(/^date/i).fill("2026-10-14");
        await page.getByLabel(/^time/i).fill("09:30");
        const notes = page.getByLabel(/^notes/i);
        if (await notes.count()) await notes.fill("Bring insurance card");
        await page.getByRole("button", { name: /add event/i }).click();
        await page.getByRole("list", { name: /scheduled events/i }).getByText("Dentist appointment").waitFor({ timeout: 5000 });
        shots.push({ name: "after-create", png: await page.screenshot() });
      })) &&
      (await step("list shows second event in date order", async () => {
        await page.getByLabel(/^title/i).fill("Team standup");
        await page.getByLabel(/^date/i).fill("2026-10-02");
        await page.getByLabel(/^time/i).fill("10:00");
        await page.getByRole("button", { name: /add event/i }).click();
        const items = page.getByRole("list", { name: /scheduled events/i }).getByRole("listitem");
        await items.nth(1).waitFor({ timeout: 5000 });
        const first = await items.nth(0).innerText();
        if (!/Team standup/.test(first)) throw new Error(`Expected "Team standup" first (earlier date), got: ${first.slice(0, 80)}`);
        return "2 events, sorted by date";
      })) &&
      (await step("edit event", async () => {
        await page.getByRole("button", { name: /edit dentist appointment/i }).click();
        const title = page.getByLabel(/^title/i);
        await title.fill("Dentist check-up");
        await page.getByRole("button", { name: /^save/i }).click();
        await page.getByRole("list", { name: /scheduled events/i }).getByText("Dentist check-up").waitFor({ timeout: 5000 });
        shots.push({ name: "after-edit", png: await page.screenshot() });
      })) &&
      (await step("persistence across reload", async () => {
        await page.reload({ waitUntil: "networkidle" });
        await page.getByRole("list", { name: /scheduled events/i }).getByText("Dentist check-up").waitFor({ timeout: 5000 });
        const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => `${k}:${(localStorage.getItem(k) ?? "").length}b`).join(", "));
        return `localStorage: ${stored}`;
      })) &&
      (await step("delete events", async () => {
        await page.getByRole("button", { name: /delete dentist check-up/i }).click();
        await page.getByRole("button", { name: /delete team standup/i }).click();
        await page.getByText(/no events yet/i).first().waitFor({ timeout: 5000 });
        shots.push({ name: "after-delete", png: await page.screenshot() });
      }));
    if (ok)
      await step("deletion persisted", async () => {
        await page.reload({ waitUntil: "networkidle" });
        await page.getByText(/no events yet/i).first().waitFor({ timeout: 5000 });
      });
  } finally {
    await ctx.close();
  }
  return { ok: steps.length > 0 && steps.every((s) => s.ok), steps, screenshots: shots };
}

/** Renders an HTML document to PDF with the owned browser (report export, FR-O3). */
export async function htmlToPdf(session: BrowserSession, html: string): Promise<Buffer> {
  const page = await session.browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } });
  await page.close();
  return pdf;
}
