/**
 * A step is judged on the errors it adds: type errors that were there before the run (another file's half-done work)
 * don't fail it, including after the repeat guard stops rerunning the same failing check (a one-line reword failed
 * on four known errors in another screen, and the debugger went to edit that screen).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { makeApp, makeProject } from "./helpers.js";

const CHECK = `console.log("src/screens/Other.tsx(11,9): error TS2322: Type 'x' is not assignable to type 'y'.");\nprocess.exit(1);\n`;

describe("known errors from before the run", () => {
  it("don't fail a step that adds none, even once the failing check is no longer rerun", async () => {
    const { app } = makeApp();
    const { project, ws } = makeProject(app, {
      "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }),
      "check.js": CHECK,
      "src/screens/Search.tsx": "export const s = 1;\n",
      "src/screens/Other.tsx": "export const o = 1;\n",
    });
    // A stand-in tsc that reports one error in another screen (the project's script stays the usual "tsc --noEmit").
    const bin = path.join(ws, "node_modules", ".bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "tsc.cmd"), '@node "%~dp0\\..\\..\\check.js" %*\r\n');
    fs.writeFileSync(path.join(bin, "tsc"), '#!/bin/sh\nnode "$(dirname "$0")/../../check.js" "$@"\n', { mode: 0o755 });
    app.projects.preflight(project.id);
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
    expect(await app.verifier.captureBaseline(run)).toEqual([{ kind: "typecheck", errors: 1 }]);
    const task = { id: "task_reword", runId: run.id, title: "Reword the Search screen", objective: "Reword it", status: "running", dependsOn: [], expectedPaths: ["src/screens/Search.tsx"], actualPaths: [], acceptanceCriteria: [{ id: "tc", description: "The project still type-checks", check: { type: "verification", kind: "typecheck" }, evidenceRefs: [] }], validationPlan: { kinds: [] }, role: "coder", ordinal: 0, attempts: 1 } as unknown as Task;
    app.store.tasks.upsert(task);
    // Checked until the repeat guard stops rerunning it: every verdict passes the step.
    const notes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = await app.verifier.checkCriteria(app.store.runs.require(run.id), task);
      expect(v.allMet, v.failures.join(" | ")).toBe(true);
      notes.push(...v.evidenceRefs.filter((r) => r.startsWith("note:")));
    }
    expect(notes.at(-1)).toMatch(/no new typecheck errors/);
  }, 180_000);
});
