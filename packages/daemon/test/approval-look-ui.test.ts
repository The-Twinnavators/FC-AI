/**
 * The look on the real approval cards, driven through the UI (not inferred from the Design tab): a test daemon with a
 * scripted planner (no build, no model) and the UI's own dev server pointed at it. On the plan card: the shared editor
 * opens, a direction is edited and confirmed, the draft survives closing and reopening, and approving the plan settles
 * the confirmed direction. On the design review card (a plan approval on a step, with an app): edit, confirm and apply,
 * with the four-part result. Both at a short window (1024x560), with the actions in view and reachable by keyboard.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { startServer } from "../src/api/server.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { designDirectionKey, type DesignDirection } from "../src/orchestrator/homeConceptOffer.js";
import { getDesignState } from "../src/workspace/designState.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const SHOTS = process.env.FLOWCODE_SPEC_SHOTS;
const task = (key: string, title: string, p: string) => ({ key, title, objective: `Create ${p}`, dependsOn: [], expectedPaths: [p], acceptanceCriteria: [{ id: key, description: `${p} exists`, check: { type: "file_exists", path: p } }], verification: [], role: "coder" });
// A long plan (many steps and notes), so the card's body has to scroll in a short window.
const PLAN = {
  goal: "Clean Cart slice",
  assumptions: Array.from({ length: 8 }, (_, i) => `Assumption ${i + 1}: the shopper searches products and saves the ones they like.`),
  relevantFiles: ["README.md"],
  expectedChanges: ["src/a.ts"],
  risk: "high",
  riskNotes: ["A long plan, so the card scrolls"],
  validationPlan: ["final_report"],
  rollbackStrategy: "Restore snapshots",
  tasks: Array.from({ length: 6 }, (_, i) => task(`t${i}`, `Step ${i + 1}`, `src/s${i}.ts`)),
};

const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });
let ui: ChildProcess | undefined;
let browser: Browser | undefined;
let server: Awaited<ReturnType<typeof startServer>> | undefined;
let uiUrl = "";
const { app } = makeApp();

function copyApp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-review-"));
  const walk = (from: string, to: string) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git"].includes(e.name)) continue;
      const s = path.join(from, e.name);
      const d = path.join(to, e.name);
      if (e.isDirectory()) (fs.mkdirSync(d, { recursive: true }), walk(s, d));
      else fs.copyFileSync(s, d);
    }
  };
  walk(RECORDED, root);
  return root;
}

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1" || !fs.existsSync(RECORDED);

beforeAll(async () => {
  if (SKIP) return;
  app.router.register(new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_r, h: ChatMessage[]) => ((h[0]?.content ?? "").includes("You are the Planner") ? { content: JSON.stringify(PLAN) } : { content: "" })));
  app.router.register(idealProbeSolver("scripted-ideal"));
  const asg = { providerId: "scripted", model: "agent" };
  const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
  app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: (await import("../src/models/router.js")).ModelRouter.configHash(asg) });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
  server = await startServer(app, { port: 0, token: "harness-token", host: "127.0.0.1" });
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

async function openRun(projectId: string, runId: string): Promise<Page> {
  const page = await browser!.newPage({ viewport: { width: 1024, height: 560 } });
  await page.goto(`${uiUrl}?port=${server!.port}&token=harness-token&temp=1#/projects/${projectId}/runs/${runId}`);
  await page.locator(".approval-modal").waitFor({ timeout: 30_000 });
  return page;
}
/** The element is inside the window (not cut off by the short viewport). */
const inView = async (page: Page, sel: string) => {
  const box = await page.locator(sel).first().boundingBox();
  const vp = page.viewportSize()!;
  return !!box && box.y >= 0 && box.y + box.height <= vp.height && box.x >= 0 && box.x + box.width <= vp.width;
};
/** Tabs until the named button has focus (keyboard only), and says whether it is in view then. */
async function tabTo(page: Page, name: RegExp, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() ?? "");
    if (name.test(label)) {
      const visible = await page.evaluate(() => {
        const r = document.activeElement!.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      });
      return { reached: true, visible };
    }
  }
  return { reached: false, visible: false };
}

describe.skipIf(SKIP)("the look on the real approval cards (UI)", () => {
  it("plan card: edit and confirm a direction, keep the draft across close and reopen, approve with it", async () => {
    const project = app.projects.create({ name: "Plan card harness", workspacePath: fs.mkdtempSync(path.join(os.tmpdir(), "fc-plan-")) });
    app.projects.updateSettings(project.id, { autonomy: "supervised" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    expect(app.store.runs.require(run.id).status).toBe("awaiting_approval");
    const page = await openRun(project.id, run.id);
    const modal = page.locator(".approval-modal");
    // The shared editor is on the plan card (its Look step), and the actions stay in view in a short window.
    await modal.locator(".plan-review__steps button", { hasText: "Look and layout" }).click();
    await modal.locator("section.ds[aria-label='Look']").waitFor({ timeout: 20_000 });
    expect(await inView(page, ".approval-modal button:has-text('Approve plan')")).toBe(true);
    expect(await inView(page, ".approval-modal button:has-text('Deny')")).toBe(true);
    // Edit: Tactile surface, then a font pair - by keyboard (focus the radio, Space).
    await modal.getByRole("radio", { name: /Tactile/ }).focus();
    await page.keyboard.press("Space");
    await modal.locator(".ds__msg", { hasText: "Draft saved" }).waitFor({ timeout: 10_000 });
    expect(getDesignState(app.store, project.id).draft?.appearance.surface).toBe("skeuomorphism");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "harness-plan-card-1024x560.png") });
    // Close (Escape) and reopen (a fresh page): the draft is still there.
    await page.keyboard.press("Escape");
    await expect(page.locator(".approval-modal").count()).resolves.toBe(0);
    await page.close();
    const again = await openRun(project.id, run.id);
    const m2 = again.locator(".approval-modal");
    await m2.locator(".plan-review__steps button", { hasText: "Look and layout" }).click();
    await m2.locator("section.ds").waitFor();
    // (The card is also in the run panel: before each copy had its own radio group, this one showed nothing checked.)
    expect(await m2.getByRole("radio", { name: /Tactile/ }).isChecked()).toBe(true);
    // Confirm by keyboard: "Use this direction" reached with Tab and in view when focused.
    const use = await tabTo(again, /^Use this direction$/);
    expect(use).toEqual({ reached: true, visible: true });
    await again.keyboard.press("Enter");
    await m2.locator(".ds__msg", { hasText: "Approving the plan uses this direction" }).waitFor({ timeout: 10_000 });
    expect(getDesignState(app.store, project.id).selected).toMatchObject({ version: 1, appearance: { surface: "skeuomorphism" } });
    // Approve the plan by keyboard: it settles the confirmed direction (no unconfirmed edits).
    const approve = await tabTo(again, /^Approve plan version 1$/);
    expect(approve).toEqual({ reached: true, visible: true });
    await again.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 1500));
    expect(app.store.runs.require(run.id).planApproved).toBe(true);
    const d = app.store.getSetting<DesignDirection | null>(designDirectionKey(run.id), null);
    expect(d?.appearance).toEqual({ version: 1 });
    expect(d?.unconfirmedDraft).toBeFalsy();
    await again.close();
    for (const [, c] of (app.orchestrator as unknown as { active: Map<string, AbortController> }).active) c.abort();
  }, 180_000);

  it("design review card: edit, confirm and apply to the app, with the four-part result; actions in view and keyboard-reachable", async () => {
    const root = copyApp();
    fs.symlinkSync(path.join(RECORDED, "node_modules"), path.join(root, "node_modules"), "junction");
    const project = app.projects.create({ name: "Review card harness", workspacePath: root });
    app.projects.updateSettings(project.id, { autonomy: "supervised" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    // The fixture: the plan already approved (recorded as decided, no build started) and the design review waiting on
    // its step, as a spec build's "Review the prototype plan and the design" approval is.
    for (const a of app.store.approvals.where("run_id = ? AND status = 'pending'", run.id)) app.store.approvals.upsert({ ...a, status: "approved", decidedAt: new Date().toISOString() } as never);
    app.store.runs.upsert({ ...app.store.runs.require(run.id), planApproved: true });
    const step = app.orchestrator.graph.tasks(run.id)[0]!;
    app.approvals.request({ projectId: project.id, runId: run.id, taskId: step.id, kind: "plan", action: "Approve the prototype plan and the design", reason: "Review the plan and the look before the build continues", affected: [], risk: "medium", consequencesOfDenial: "The build stops here" });
    expect(app.orchestrator.isActive(run.id)).toBe(false);
    const page = await openRun(project.id, run.id);
    const modal = page.locator(".approval-modal");
    await modal.locator("section.ds").waitFor();
    expect(await inView(page, ".approval-modal button:has-text('Approve plan')")).toBe(true);
    await modal.getByRole("radio", { name: /Tactile/ }).focus();
    await page.keyboard.press("Space");
    await modal.locator(".ds__msg", { hasText: "Draft saved" }).waitFor({ timeout: 10_000 });
    const apply = await tabTo(page, /^Apply changes$/);
    expect(apply).toEqual({ reached: true, visible: true });
    await page.keyboard.press("Enter");
    // The result separates the file update from the checks the latest build requires (rerun with the existing
    // verifier) and shows exactly what was recorded; visual approval stays pending.
    await modal.locator(".ds-verify").waitFor({ timeout: 240_000 });
    const rows = (await modal.locator(".ds-verify__row").allInnerTexts()).map((r) => r.replace(/\s+/g, " "));
    const s = getDesignState(app.store, project.id);
    const v = s.applied!.verification!;
    const word = { passed: "✓ Passed", failed: "✕ Failed", not_run: "– Not run" } as const;
    expect(rows[0]).toMatch(/^File update ✓ Applied/);
    expect(rows[1]!.startsWith(`Technical verification ${word[v.technical.status]}`)).toBe(true);
    expect(rows[2]!.startsWith(`Browser and functional verification ${word[v.browser.status]}`)).toBe(true);
    expect(rows[3]).toMatch(/^Your visual approval – Pending/);
    expect(s.applied?.appearance.surface).toBe("skeuomorphism");
    expect(v.human).toBe("pending");
    console.log("review-card apply result:", JSON.stringify(rows));
    // The review approval itself is still the person's: applying the look didn't decide it.
    expect(app.store.approvals.where("run_id = ? AND status = 'pending'", run.id).map((a) => a.taskId)).toEqual([step.id]);
    await modal.locator(".ds-verify").scrollIntoViewIfNeeded();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "harness-review-card-1024x560.png") });
    await page.close();
  }, 180_000);
});
