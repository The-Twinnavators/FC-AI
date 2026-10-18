/**
 * A plan with hard contradictions with its PRD (planChecks.ts) is not shown as approval-ready on the real plan card
 * (Frameproof planning: a plan with invented records and forbidden pages looked like any other): the card says "Not
 * approval-ready" with each contradiction, keeps compliance apart from structure, and names the contradictions on the
 * Approve button. The decision stays the person's: nothing is disabled or decided for them.
 */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { startServer } from "../src/api/server.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const step = (key: string, title: string) => ({ key, title, objective: title, dependsOn: [], expectedPaths: [`src/${key}.ts`], acceptanceCriteria: [{ id: key, description: `${key} exists`, check: { type: "file_exists", path: `src/${key}.ts` } }], verification: [], role: "coder" });
const compliance = [
  { id: 1, kind: "structural", hard: false, label: "Scope: required behaviour, supporting data and left-out capabilities agree in every step", ok: true, problems: [] },
  { id: 7, kind: "compliance", hard: true, label: "Required records: the PRD's explicit records, as given", ok: false, problems: ["Photos: 14 records; the PRD gives exactly 12"] },
  { id: 8, kind: "compliance", hard: true, label: "Navigation: the PRD's declared destinations only", ok: false, problems: ["The navigation has destinations the PRD doesn't declare: New photo"] },
  { id: 10, kind: "compliance", hard: true, label: "Runtime state: the PRD's state, one shared owner", ok: true, problems: [] },
];
const PLAN = { goal: "Frameproof", assumptions: ["Look: no direction is selected yet."], relevantFiles: ["README.md"], expectedChanges: ["src/**"], risk: "high", riskNotes: ["Not approval-ready: 2 contradictions with the PRD (Required records, Navigation)"], validationPlan: ["final_report"], rollbackStrategy: "Restore snapshots", tasks: [step("gallery", "Gallery")], compliance };
const freePort = () => new Promise<number>((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });

const SKIP = process.env.FLOWCODE_SKIP_BROWSER === "1";
let ui: ChildProcess | undefined;
let browser: Browser | undefined;
let server: Awaited<ReturnType<typeof startServer>> | undefined;
let uiUrl = "";
const { app } = makeApp();

beforeAll(async () => {
  if (SKIP) return;
  app.router.register(new ScriptedProvider({ id: "scripted", kind: "scripted", label: "scripted", enabled: true, hosted: false }, async (_r, h: ChatMessage[]) => ((h[0]?.content ?? "").includes("You are the Planner") ? { content: JSON.stringify(PLAN) } : { content: "" })));
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "scripted", model: "agent" });
  server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
  const port = await freePort();
  ui = spawn(process.execPath, [path.join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort"], { cwd: path.join(REPO, "apps/ui"), env: { ...process.env, PORT: String(port), FLOWCODE_PORT: String(server.port), FLOWCODE_TOKEN: "t" }, stdio: "ignore" });
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

describe.skipIf(SKIP)("a plan that contradicts its PRD (UI)", () => {
  it("is shown as not approval-ready, with each contradiction, compliance apart from structure, and the Approve button saying so", async () => {
    const project = app.projects.create({ name: "Contradictions", workspacePath: fs.mkdtempSync(path.join(os.tmpdir(), "fc-contra-")) });
    app.projects.updateSettings(project.id, { autonomy: "supervised" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Frameproof", constraints: [], attachedKnowledgeIds: [] });
    await app.orchestrator.plan(run.id);
    expect(app.store.runs.require(run.id).plan?.compliance?.length).toBe(4);
    const page = await (await browser!.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(`${uiUrl}?port=${server!.port}&token=t&temp=1#/projects/${project.id}/runs/${run.id}`);
    const card = page.locator(".approval-modal .plan-review");
    await card.waitFor({ timeout: 30_000 });
    const alert = card.locator("[data-plan-contradictions]");
    await alert.waitFor();
    expect(await alert.getAttribute("data-plan-contradictions")).toBe("2");
    const said = await alert.innerText();
    expect(said).toMatch(/Not approval-ready: 2 contradictions with the PRD/i);
    expect(said).toContain("Photos: 14 records; the PRD gives exactly 12");
    expect(said).toContain("The navigation has destinations the PRD doesn't declare: New photo");
    expect(said).not.toContain("Runtime state");
    expect(await card.locator("details summary", { hasText: "compliance with the PRD" }).innerText()).toMatch(/compliance with the PRD 1 of 3 pass · structure 1 of 1 pass/i);
    const approve = page.locator('.approval-modal button[data-cp="approval-allow"]');
    expect(await approve.innerText()).toBe("Approve version 1 despite 2 contradictions");
    expect(await approve.isDisabled()).toBe(false);
    expect(await card.locator(".plan-review__steps").innerText()).toMatch(/Not approval-ready/);
    // Nothing was decided for the person.
    expect(app.store.approvals.where("run_id = ? AND status = 'pending'", run.id).some((a) => a.kind === "plan")).toBe(true);
    await page.screenshot({ path: path.join(REPO, "docs/reliability/frameproof-repair/plan-card-contradictions.png") });
  }, 120_000);
});
