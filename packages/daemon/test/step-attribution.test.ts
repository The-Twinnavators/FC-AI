/**
 * A step is judged against the diagnostics it started with: an error that was already there is inherited (not its),
 * even on a moved line; an error that wasn't is its own, in whatever file it appears (a changed component signature
 * breaks an untouched caller). Inherited errors still fail the run's own check: excusing a step doesn't fix the app.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { attributeDiagnostics, signature } from "../src/quality/verification.js";
import { makeApp, makeProject } from "./helpers.js";

// A stand-in type checker: prints the lines of diag.txt and fails when there are any.
const CHECK = `const fs = require("fs");\nconst t = fs.readFileSync("diag.txt", "utf8").trim();\nif (!t) process.exit(0);\nconsole.log(t);\nprocess.exit(1);\n`;
const HOME = "src/screens/Home.tsx(11,9): error TS2322: Type '{ cta: string; }' is not assignable to type 'IntrinsicAttributes & HeroSplitProps'.";
const HOME_MOVED = "src/screens/Home.tsx(14,9): error TS2322: Type '{ cta: string; }' is not assignable to type 'IntrinsicAttributes & HeroSplitProps'.";
const APP = "src/App.tsx(19,43): error TS2741: Property 'onNavigate' is missing in type '{}' but required in type '{ onNavigate: (value: string) => void; }'.";

function setup() {
  const { app } = makeApp();
  const { project, ws } = makeProject(app, {
    "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }),
    "check.js": CHECK,
    "diag.txt": "",
    "src/screens/Frame.css": ".ui-shell{}\n",
  });
  const bin = path.join(ws, "node_modules", ".bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "tsc.cmd"), '@node "%~dp0\\..\\..\\check.js" %*\r\n');
  fs.writeFileSync(path.join(bin, "tsc"), '#!/bin/sh\nnode "$(dirname "$0")/../../check.js" "$@"\n', { mode: 0o755 });
  app.projects.preflight(project.id);
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
  const task = { id: "task_frame", runId: run.id, title: "Design the frame", objective: "Restyle the frame", status: "running", dependsOn: [], expectedPaths: ["src/screens/Frame.css"], actualPaths: [], acceptanceCriteria: [{ id: "tc", description: "The project still type-checks", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] }], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts: 1 } as unknown as Task;
  app.store.tasks.upsert(task);
  const diag = (...lines: string[]) => fs.writeFileSync(path.join(ws, "diag.txt"), lines.join("\n"));
  const check = () => app.verifier.checkCriteria(app.store.runs.require(run.id), app.store.tasks.require(task.id));
  return { app, run, task, diag, check };
}

describe("diagnostics against the step's start", () => {
  it("an unchanged inherited error isn't the step's, and stays on record as inherited", async () => {
    const s = setup();
    s.diag(HOME);
    await s.app.verifier.captureStepBaseline(s.app.store.runs.require(s.run.id), s.task.id);
    const v = await s.check();
    expect(v.allMet, v.failures.join(" | ")).toBe(true);
    expect(v.evidenceRefs.join(" ")).toMatch(/no new typecheck errors since this step started; 1 inherited/);
    expect(s.app.store.getSetting<Record<string, string[]>>(`inheritedErrors:${s.run.id}`, {}).typecheck).toEqual([HOME]);
  }, 60_000);

  it("a moved line is the same inherited error, not a new one", async () => {
    const s = setup();
    s.diag(HOME);
    await s.app.verifier.captureStepBaseline(s.app.store.runs.require(s.run.id), s.task.id);
    s.diag(HOME_MOVED);
    expect((await s.check()).allMet).toBe(true);
    expect(attributeDiagnostics([signature(HOME)], [HOME_MOVED]).introduced).toEqual([]);
    // One more of the same error is introduced.
    expect(attributeDiagnostics([signature(HOME)], [HOME, HOME_MOVED]).introduced).toEqual([HOME_MOVED]);
  }, 60_000);

  it("an error in a file the step never touched is the step's when it wasn't there before (a changed signature)", async () => {
    const s = setup();
    s.diag(HOME);
    await s.app.verifier.captureStepBaseline(s.app.store.runs.require(s.run.id), s.task.id);
    // The step changed Home's props; App.tsx (FlowCode's, untouched by the step) now fails.
    s.diag(HOME, APP);
    const v = await s.check();
    expect(v.allMet).toBe(false);
    expect(v.failures[0]).toMatch(/1 error that weren't there when this step started \(including in src\/App\.tsx/);
    expect(v.failures[0]).toContain(APP);
    expect(v.failures[0]).not.toContain(HOME);
    // In-loop feedback after an edit says the same.
    expect(await s.app.verifier.newTypeErrors(s.app.store.runs.require(s.run.id), undefined, ["src/screens/Home.tsx"], s.task.id)).toEqual([APP]);
  }, 60_000);

  it("inherited errors still fail the run's own type check, so the run can't claim a healthy app", async () => {
    const s = setup();
    s.diag(HOME);
    await s.app.verifier.captureStepBaseline(s.app.store.runs.require(s.run.id), s.task.id);
    expect((await s.check()).allMet).toBe(true);
    const runLevel = await (s.app.verifier as unknown as { runScriptCheck: (r: unknown, k: string) => Promise<{ status: string }> }).runScriptCheck(s.app.store.runs.require(s.run.id), "typecheck");
    expect(runLevel.status).toBe("failed");
  }, 60_000);
});
