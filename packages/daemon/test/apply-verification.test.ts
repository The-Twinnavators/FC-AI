/**
 * Applied is not verified (POST /projects/:id/design/apply): applying a direction to an existing app reports four things
 * apart - the file update, technical verification (typecheck, build), browser and functional verification (the latest
 * build's preview checks and journey through the app, rerun with the existing verifier) and the person's visual
 * approval, always pending. Checks that can't run are "not_run", never passed; a failed check is never shown as verified
 * and doesn't undo the files (the snapshots can). The browser cases use the recorded Clean Cart app.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, type Appearance } from "@flowcode/contracts";
import { startServer } from "../src/api/server.js";
import { appWrittenKey, appFiles } from "../src/orchestrator/appFiles.js";
import { appModelKey, prdSampleSection, resolveScreenAliases, type AppModel } from "../src/orchestrator/appModel.js";
import { declaredScreens } from "../src/orchestrator/screenPlan.js";
import { mergeRecords, prdFixtureRows } from "../src/orchestrator/recordIdentity.js";
import { syncedLibraryCss } from "../src/orchestrator/sectionRecipes.js";
import { getDesignState, type ApplyVerification } from "../src/workspace/designState.js";
import { makeApp } from "./helpers.js";

const REPO = path.resolve(import.meta.dirname, "../../..");
const RECORDED = path.join(REPO, ".flowcode-data/workspaces/clean-cart-slice-eval-1-9b1947");
const LOOK: Appearance = { ...BASE_APPEARANCE, surface: "skeuomorphism", primary: "#1f6f43", neutral: "warm", fonts: { display: "Fraunces", body: "Work Sans" } };
const PRD_PATH = path.join(REPO, "docs/handoff/slice/clean-cart-slice-prd.md");

type ApplyResponse = { ok: boolean; label: string; verification: ApplyVerification; rollback: string; applied?: { snapshotIds: string[] } };

async function withServer<T>(app: ReturnType<typeof makeApp>["app"], fn: (call: (p: string, body?: unknown) => Promise<Response>) => Promise<T>) {
  const server = await startServer(app, { port: 0, token: "t", host: "127.0.0.1" });
  try {
    return await fn((p, body) => fetch(`http://127.0.0.1:${server.port}${p}`, { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }));
  } finally {
    await server.close();
  }
}
async function selectLook(call: (p: string, body?: unknown) => Promise<Response>, projectId: string) {
  expect((await call(`/projects/${projectId}/design/draft`, { appearance: LOOK, sources: { primary: "you" } })).status).toBe(200);
  expect((await call(`/projects/${projectId}/design/select`)).status).toBe(200);
}

describe.skipIf(!fs.existsSync(RECORDED))("applied is not verified", () => {
  it("with no build to rerun: files updated, both verifications not run (not passed), visual approval pending", async () => {
    const { app } = makeApp();
    const root = copyApp();
    const project = app.projects.create({ name: "No build", workspacePath: root });
    const jail = app.projects.jail(project);
    const r = await withServer(app, async (call) => {
      await selectLook(call, project.id);
      return (await (await call(`/projects/${project.id}/design/apply`)).json()) as ApplyResponse;
    });
    expect(r.ok).toBe(true);
    expect(fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8")).toContain("Fraunces");
    expect(r.verification).toMatchObject({ file: "applied", technical: { status: "not_run", checks: [] }, browser: { status: "not_run", checks: [] }, human: "pending" });
    expect(r.verification.technical.note).toMatch(/No build has run/);
    expect(r.label).toBe("Applied (files updated); some checks not run");
    expect(r.rollback).toMatch(/doesn't undo the change/);
    expect(getDesignState(app.store, project.id).applied?.verification?.version).toBe(1);
  });
});

function copyApp(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-verify-"));
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
  fs.symlinkSync(path.join(RECORDED, "node_modules"), path.join(root, "node_modules"), "junction");
  return root;
}

describe.skipIf(process.env.FLOWCODE_SKIP_BROWSER === "1" || !fs.existsSync(path.join(RECORDED, "node_modules")))("applied is not verified: the look-up app", () => {
  const PRD = fs.readFileSync(PRD_PATH, "utf8");
  const MODEL = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval1-app-model.json"), "utf8")) as AppModel;
  const seed = Object.fromEntries(MODEL.entities.map((e) => [e.key, mergeRecords(e, [], MODEL.seed[e.key] ?? [], { prdRows: prdFixtureRows(e, prdSampleSection(PRD)) }).rows]));
  const FIXED = resolveScreenAliases({ ...MODEL, seed }, declaredScreens(PRD));

  /** The recorded app regenerated by today's writers, as a project whose latest build requires the existing checks. */
  function project() {
    const root = copyApp();
    for (const f of appFiles(FIXED).filter((f) => !f.path.startsWith("src/screens/"))) (fs.mkdirSync(path.dirname(path.join(root, f.path)), { recursive: true }), fs.writeFileSync(path.join(root, f.path), f.content));
    const css = syncedLibraryCss(root);
    if (css !== undefined) fs.writeFileSync(path.join(root, "src/styles/library.css"), css);
    const { app } = makeApp();
    const p = app.projects.create({ name: "Verify", workspacePath: root });
    const run = app.orchestrator.createRun({ projectId: p.id, objective: "Clean Cart slice", constraints: [], attachedKnowledgeIds: [], references: [{ name: "prd.md", role: "prd", content: PRD }] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "done", strategy: { kind: "spec_build", previewStrategy: "vite_dev", requiredChecks: ["typecheck", "build", "preview_health", "screenshots", "functional_journey", "final_report"] } as never });
    app.store.setSetting(appModelKey(run.id), FIXED);
    app.store.setSetting(appWrittenKey(run.id), true);
    app.store.setSetting(`runRefs:${run.id}`, [{ name: "prd.md", role: "prd", content: PRD }]);
    return { app, p, root };
  }

  it("passing checks: technical and browser/functional verification passed; visual approval still pending", async () => {
    const { app, p } = project();
    const r = await withServer(app, async (call) => {
      await selectLook(call, p.id);
      return (await (await call(`/projects/${p.id}/design/apply`)).json()) as ApplyResponse;
    });
    expect(r.ok).toBe(true);
    expect(r.verification.technical.checks.map((c) => [c.kind, c.status])).toEqual([["typecheck", "passed"], ["build", "passed"]]);
    expect(r.verification.browser.checks.map((c) => [c.kind, c.status])).toEqual([["preview_health", "passed"], ["screenshots", "passed"], ["functional_journey", "passed"]]);
    expect(r.verification.technical.status).toBe("passed");
    expect(r.verification.browser.status).toBe("passed");
    expect(r.verification.human).toBe("pending");
    expect(r.label).toBe("Applied and checked; your visual approval is pending");
    app.orchestrator.stopWatchdog();
  }, 420_000);

  it("a failing check: reported failed, browser checks not run, never verified; the files stay applied with their snapshots", async () => {
    const { app, p, root } = project();
    fs.writeFileSync(path.join(root, "src/broken.ts"), "export const n: number = \"not a number\";\n");
    const r = await withServer(app, async (call) => {
      await selectLook(call, p.id);
      return (await (await call(`/projects/${p.id}/design/apply`)).json()) as ApplyResponse;
    });
    expect(r.ok).toBe(true);
    expect(r.verification.technical.status).toBe("failed");
    expect(r.verification.technical.checks.find((c) => c.kind === "typecheck")?.status).toBe("failed");
    expect(r.verification.browser).toMatchObject({ status: "not_run", checks: [] });
    expect(r.verification.browser.note).toMatch(/technical verification didn't pass/);
    expect(r.label).toBe("Applied (files updated); a check after it failed");
    // No automatic rollback: the look is in the files, and the snapshots to undo it are recorded.
    expect(fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8")).toContain("Fraunces");
    expect(r.applied?.snapshotIds.length).toBeGreaterThan(0);
    app.orchestrator.stopWatchdog();
  }, 300_000);
});
