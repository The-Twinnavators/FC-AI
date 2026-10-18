/**
 * The plan review through the real UI (test daemon with a scripted planner, the UI's own dev server): the step-based
 * card in a wide pop-up, Request changes and the revised version's outcome, the colour picker staying inside the card
 * (a press on it used to land on the backdrop and close the card), a single status colour saving, unconfirmed look
 * edits needing an explicit choice, the acknowledgement after approving, late presses not deciding the next gate, and
 * that gate arming before its buttons work. Keyboard paths and short and narrow windows too. With FLOWCODE_REVIEW_VIDEO
 * set to a folder, the main flow is recorded there.
 */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { startServer } from "../src/api/server.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { getDesignState } from "../src/workspace/designState.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const VIDEO = process.env.FLOWCODE_REVIEW_VIDEO;
const step = (key: string, title: string, deps: string[] = []) => ({ key, title, objective: title, dependsOn: deps, expectedPaths: [`src/${key}.ts`], acceptanceCriteria: [{ id: key, description: `${key} exists`, check: { type: "file_exists", path: `src/${key}.ts` } }], verification: [], role: "coder" });
const PLAN1 = { goal: "Clean Cart slice: Home, search, a product, save it, see it on Saved", assumptions: Array.from({ length: 6 }, (_, i) => `Assumption ${i + 1}`), relevantFiles: ["README.md"], expectedChanges: ["src/**"], risk: "medium", riskNotes: ["Dependency installation runs package scripts"], validationPlan: ["final_report"], rollbackStrategy: "Restore snapshots", scopeDecisions: ["R6 isn't covered by a journey: add it to one, or check it on its own?"], tasks: [step("home", "Home with search"), step("lists", "Working lists", ["home"]), step("ratings", "Ratings and comments", ["home"])] };
const PLAN2 = { ...PLAN1, scopeDecisions: [], tasks: [step("home", "Home with search"), step("save", "Save journey: search, product, save, Saved, reload, unsave", ["home"])] };
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1";
let ui: ChildProcess | undefined;
let browser: Browser | undefined;
let server: Awaited<ReturnType<typeof startServer>> | undefined;
let uiUrl = "";
const { app } = makeApp();

beforeAll(async () => {
  if (SKIP) return;
  app.router.register(
    new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_r, h: ChatMessage[]) => {
      if (!(h[0]?.content ?? "").includes("You are the Planner")) return { content: "" };
      return { content: JSON.stringify(h.some((m) => (m.content ?? "").includes("Revision requested by the person")) ? PLAN2 : PLAN1) };
    }),
  );
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  server = await startServer(app, { port: 0, token: "review-token", host: "127.0.0.1" });
  const port = await freePort();
  ui = spawn(process.execPath, [path.join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort"], { cwd: path.join(REPO, "apps/ui"), env: { ...process.env, PORT: String(port), FLOWCODE_PORT: String(server.port) }, stdio: ["ignore", "pipe", "pipe"] });
  uiUrl = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120 && !(await fetch(uiUrl).then((r) => r.ok, () => false)); i++) await new Promise((r) => setTimeout(r, 500));
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  ui?.kill();
  app.orchestrator.stopWatchdog();
  await server?.close();
});

async function newRun(name: string) {
  const project = app.projects.create({ name, workspacePath: fs.mkdtempSync(path.join(os.tmpdir(), "fc-review-")) });
  app.projects.updateSettings(project.id, { autonomy: "supervised" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [] });
  await app.orchestrator.plan(run.id);
  return { project, run };
}
async function open(projectId: string, runId: string, viewport = { width: 1280, height: 800 }, record = false): Promise<Page> {
  const context = await browser!.newContext({ viewport, ...(record && VIDEO ? { recordVideo: { dir: VIDEO, size: viewport } } : {}) });
  const page = await context.newPage();
  await page.goto(`${uiUrl}?port=${server!.port}&token=review-token&temp=1#/projects/${projectId}/runs/${runId}`);
  await page.locator(".approval-modal .plan-review").waitFor({ timeout: 30_000 });
  return page;
}
const inView = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  const vp = page.viewportSize()!;
  return !!b && b.y >= 0 && b.y + b.height <= vp.height && b.x >= 0 && b.x + b.width <= vp.width;
};
const waitFor = async <T>(fn: () => T | undefined, ms = 15_000) => {
  for (let t = 0; t < ms; t += 50) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out");
};
/** Waits (up to 10 s) until the locator's text contains the given text. */
const hasText = async (loc: ReturnType<Page["locator"]>, text: string) => {
  for (let t = 0; t < 10_000; t += 100) {
    // innerText follows CSS text-transform (labels are upper-case on screen).
    if ((await loc.count()) && (await loc.first().innerText()).toLowerCase().includes(text.toLowerCase())) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Never showed "${text}": ${(await loc.count()) ? (await loc.first().innerText()).slice(0, 300) : "(not on the page)"}`);
};
const pause = (page: Page, ms = 700) => (VIDEO ? page.waitForTimeout(ms) : Promise.resolve());

describe.skipIf(SKIP)("the plan review card (UI)", () => {
  it("request changes, review the revision, choose about unconfirmed edits, approve, acknowledge, then the next gate", async () => {
    const { project, run } = await newRun("Review flow");
    const page = await open(project.id, run.id, { width: 1280, height: 800 }, true);
    const modal = page.locator(".approval-modal");
    expect(await modal.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(1100);
    for (const name of ["Approve plan version 1", "Request changes", "Deny"]) expect(await inView(page, `.approval-modal button:has-text("${name}")`), name).toBe(true);
    await modal.getByText("R6 isn't covered by a journey").first().waitFor();
    await pause(page, 1200);

    // 1. Request changes (keyboard: the textarea and the send button).
    await modal.getByRole("button", { name: "Request changes" }).click();
    await modal.getByLabel("What should change in this plan?").fill("Keep only the save journey; no working lists, ratings or comments. Check R6 on its own.");
    await pause(page);
    await modal.getByRole("button", { name: "Send and plan again" }).click();
    const v2 = await waitFor(() => app.store.approvals.where("run_id = ? AND status = 'pending'", run.id).find((a) => a.kind === "plan" && a.planVersion === 2));
    await page.locator(".approval-modal .plan-review__title", { hasText: "Plan version 2" }).waitFor({ timeout: 20_000 });
    const outcome = page.locator(".approval-modal .plan-review__outcome");
    await hasText(outcome, "answers your request on version 1");
    await hasText(outcome, "Removed: Working lists; Ratings and comments");
    await hasText(page.locator(".approval-modal .plan-review__summary"), "1 earlier kept");
    await pause(page, 1500);

    // 2. The Look step by keyboard; an unconfirmed edit (primary) and a single status colour through the picker.
    await page.locator(".approval-modal .plan-review__steps button", { hasText: "Look and layout" }).focus();
    await page.keyboard.press("Enter");
    const ed = modal.locator("section.ds");
    await ed.waitFor();
    const primary = ed.getByLabel("Primary colour hex value");
    await primary.fill("#2f9dd3");
    await ed.locator(".ds__msg", { hasText: "Draft saved" }).waitFor({ timeout: 10_000 });
    await ed.locator("details.ds-adv > summary").click();
    const warning = ed.locator(".ds-status .cpick__swatch").nth(1);
    await warning.scrollIntoViewIfNeeded();
    await warning.click();
    const pop = page.locator(".approval-modal .cpick__pop");
    await pop.waitFor();
    await page.waitForTimeout(150);
    const geo = await page.evaluate(() => {
      const p = document.querySelector(".approval-modal .cpick__pop")!.getBoundingClientRect();
      const m = document.querySelector(".approval-modal .plan-review__main")!.getBoundingClientRect();
      return { inside: p.left >= m.left - 1 && p.right <= m.right + 1 && p.top >= m.top - 1 && p.bottom <= m.bottom + 1 };
    });
    expect(geo.inside).toBe(true);
    const scrollBefore = await page.locator(".approval-modal .plan-review__main").evaluate((e) => e.scrollTop);
    const sv = (await page.locator(".approval-modal .cpick__sv").boundingBox())!;
    await page.mouse.click(sv.x + sv.width * 0.6, sv.y + sv.height * 0.4);
    expect(await page.locator(".approval-modal").count()).toBe(1);
    expect(await page.locator(".approval-modal .plan-review__main").evaluate((e) => e.scrollTop)).toBe(scrollBefore);
    // The square by keyboard as well.
    await page.locator(".approval-modal .cpick__sv").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await ed.locator(".ds__msg", { hasText: "Draft saved" }).waitFor({ timeout: 10_000 });
    expect(await ed.locator(".ds__err").count()).toBe(0);
    expect(getDesignState(app.store, project.id).draft?.appearance.status?.warning).toMatch(/^#/);
    await pause(page);

    // 3. Approve with unconfirmed edits: an explicit choice is required.
    await modal.getByRole("button", { name: "Approve plan version 2" }).click();
    await modal.locator(".plan-review__choice").first().waitFor();
    await hasText(page.locator(".approval-modal .plan-review__notice"), "Choose");
    expect(app.store.runs.require(run.id).planApproved).toBeFalsy();
    await pause(page);
    await modal.getByLabel(/Use my edits/).focus();
    await page.keyboard.press("Space");
    await pause(page);
    // The next gate appears the moment the plan is approved (as the install step does).
    let installId: string | undefined;
    const watcher = waitFor(() => (app.store.runs.require(run.id).planApproved ? (installId ??= app.approvals.request({ projectId: project.id, runId: run.id, kind: "dependency_install", action: "Run npm install --no-fund --no-audit", reason: "Install the starter's dependencies", affected: ["package-lock.json"], risk: "high", consequencesOfDenial: "The build stops before installing." }).id) : undefined));
    const approveBtn = modal.getByRole("button", { name: "Approve plan version 2" });
    const at = (await approveBtn.boundingBox())!;
    await approveBtn.click();
    await page.locator(".plan-approved").waitFor();
    await watcher;
    // Late and repeated presses where Approve was: they land on the acknowledgement, never on the next gate.
    for (let i = 0; i < 3; i++) await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await hasText(page.locator(".plan-approved"), "Plan version 2 approved");
    await hasText(page.locator(".plan-approved"), "your edits, confirmed with this approval");
    await page.locator(".plan-approved__next").waitFor({ timeout: 10_000 });
    await hasText(page.locator(".plan-approved__next"), "permission to install dependencies");
    expect(app.store.approvals.require(installId!).status).toBe("pending");
    const bound = app.store.getSetting<{ planVersion: number; look: { version: number; choice: string } } | null>(`planApproval:${run.id}`, null);
    expect(bound).toMatchObject({ planVersion: 2, look: { version: 1, choice: "use-edits" } });
    expect(app.store.approvals.require(v2.id).status).toBe("approved");
    await hasText(page.locator("[data-plan-status]"), "Plan version 2 approved");
    await pause(page, 1500);

    // 4. The next gate opens only when asked, labelled as a permission, and arms before its buttons work.
    await page.getByRole("button", { name: "Review the next decision" }).click();
    const gate = page.locator(".approval-modal .approval");
    await hasText(gate, "Execution permission: install dependencies");
    expect(await gate.getByRole("button", { name: "Allow once" }).isDisabled()).toBe(true);
    await page.waitForTimeout(1400);
    expect(await gate.getByRole("button", { name: "Allow once" }).isDisabled()).toBe(false);
    expect(app.store.approvals.require(installId!).status).toBe("pending");
    await pause(page, 1200);
    await page.context().close();
  }, 240_000);

  it("a short window keeps the actions in view; a narrow one stacks the steps; every step is reachable by keyboard", async () => {
    const { project, run } = await newRun("Review small");
    const short = await open(project.id, run.id, { width: 1024, height: 560 });
    for (const name of ["Approve plan version 1", "Request changes", "Deny"]) expect(await inView(short, `.approval-modal button:has-text("${name}")`), name).toBe(true);
    // Tab through the steps and open each one.
    for (const name of ["Scope", "Look and layout", "Permissions", "Review and decide"]) {
      await short.locator(".approval-modal .plan-review__steps button", { hasText: name }).focus();
      await short.keyboard.press("Enter");
      expect(await short.locator(".approval-modal .plan-review__steps button[aria-current=step]").innerText()).toContain(name);
    }
    await short.context().close();
    const narrow = await open(project.id, run.id, { width: 700, height: 760 });
    const cols = await narrow.locator(".approval-modal .plan-review__grid").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(1);
    for (const name of ["Approve plan version 1", "Request changes", "Deny"]) expect(await inView(narrow, `.approval-modal button:has-text("${name}")`), name).toBe(true);
    await narrow.context().close();
    for (const [, c] of (app.orchestrator as unknown as { active: Map<string, AbortController> }).active) c.abort();
  }, 120_000);
});
