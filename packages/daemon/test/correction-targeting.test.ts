/**
 * The correction step after a failed functional baseline is sent to the actual failing file (Frameproof main build:
 * ESLint printed src\sections\RecordDetail.tsx with its Windows path on a line of its own, FlowCode never located the
 * error, and the step's brief named src/app/schema.ts and src/App.tsx; all three attempts edited schema.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { classifyFailure, diagnosticsOf, locatedErrorsBrief, LOCATED_NOW, type Diagnostic } from "../src/orchestrator/recoveryRouting.js";
import { functionalBaselineKey, type FunctionalBaseline } from "../src/orchestrator/orchestrator.js";
import { stepBaselineKey } from "../src/quality/verification.js";
import { makeApp, makeProject } from "./helpers.js";

// The lint output as the Frameproof run recorded it (npm run lint in the generated workspace).
const RECORDED_LINT = [
  "> flowcode-starter@0.1.0 lint",
  "> eslint .",
  "",
  "C:\\Users\\JenoU\\Desktop\\FlowCode\\.flowcode-data\\workspaces\\frameproof-f6873f\\src\\sections\\RecordDetail.tsx",
  "  132:67  warning  The ref value 'fallbackFocus.current' will likely have changed by the time this effect cleanup function runs  react-hooks/exhaustive-deps",
  "  635:21  error    Expected an assignment or function call and instead saw an expression                                       @typescript-eslint/no-unused-expressions",
  "",
  "C:\\Users\\JenoU\\Desktop\\FlowCode\\.flowcode-data\\workspaces\\frameproof-f6873f\\src\\sections\\ResourceIndex.tsx",
  "  286:9  warning  The 'records' logical expression could make the dependencies of useMemo Hook (at line 344) change on every render  react-hooks/exhaustive-deps",
  "",
  "✖ 3 problems (1 error, 2 warnings)",
].join("\r\n");

describe("locating the failing file", () => {
  it("reads ESLint's stylish output with an absolute Windows path: the file, the line, the message and rule; no warnings", () => {
    expect(diagnosticsOf(RECORDED_LINT)).toEqual([
      { kind: "lint", file: "src/sections/RecordDetail.tsx", line: 635, text: "src/sections/RecordDetail.tsx:635 Expected an assignment or function call and instead saw an expression (@typescript-eslint/no-unused-expressions)" },
    ]);
  });

  it("reads the same output with POSIX paths, once per error", () => {
    const posix = RECORDED_LINT.replace(/C:\\Users\\JenoU\\Desktop\\FlowCode\\/g, "/home/u/FlowCode/").replace(/\\/g, "/");
    expect(diagnosticsOf(posix).map((d) => `${d.file}:${d.line}`)).toEqual(["src/sections/RecordDetail.tsx:635"]);
  });

  it("a lint check's summary (its file, then ESLint's own error line) is a located lint error for recovery routing", () => {
    const summary = "npm run lint failed: src/sections/RecordDetail.tsx\n635:21  error    Expected an assignment or function call and instead saw an expression";
    const v = classifyFailure("complete", [`Lint: failed: ${summary}`]);
    expect(v.cls).toBe("implementation");
    expect(v.diagnostics).toEqual([expect.objectContaining({ kind: "lint", file: "src/sections/RecordDetail.tsx", line: 635 })]);
  });

  it("gives the correction brief the diagnostic with the file's current code around it", () => {
    const { ws } = makeProject(makeApp().app, { "src/sections/RecordDetail.tsx": Array.from({ length: 640 }, (_, i) => (i + 1 === 635 ? "    navigator.clipboard?.writeText(id) ?? toast(id);" : `// line ${i + 1}`)).join("\n") });
    const brief = locatedErrorsBrief(ws, diagnosticsOf(RECORDED_LINT))!;
    expect(brief.files).toEqual(["src/sections/RecordDetail.tsx"]);
    expect(brief.text.startsWith(LOCATED_NOW)).toBe(true);
    expect(brief.text).toContain("- src/sections/RecordDetail.tsx:635 Expected an assignment or function call");
    expect(brief.text).toContain("  635|     navigator.clipboard?.writeText(id) ?? toast(id);");
    expect(brief.text).toContain("  631| // line 631");
  });
});

describe("the correction step's brief and scope", () => {
  function setup(failed: Partial<FunctionalBaseline>) {
    const { app } = makeApp();
    const { project, ws } = makeProject(app, { "README.md": "# demo\n", "src/sections/RecordDetail.tsx": "a\nb\nc\nbad();\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "Frameproof", constraints: [], attachedKnowledgeIds: [] });
    app.store.tasks.upsert({ id: "w", runId: run.id, title: "Write the complete app", objective: "o", status: "running", dependsOn: [], expectedPaths: [], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 1 } as unknown as Task);
    const orch = app.orchestrator as unknown as { correctBaseline: (r: unknown, t: Task, b: unknown) => void; withLocatedErrors: (r: unknown, t: Task, root: string) => Task };
    const base = { taskId: "w", sourceState: { snapshotSeq: 1, srcSha256: "x" }, at: "", typecheck: "passed", checks: { typecheck: "passed", lint: "failed: npm run lint failed: src/sections/RecordDetail.tsx:4 Expected an assignment", build: "passed" }, dataSource: [], journey: { ok: true, summary: "1/1 journey steps passed" }, ok: false, ...failed };
    orch.correctBaseline(app.store.runs.require(run.id), app.store.tasks.require("w"), base);
    const fixId = app.store.getSetting<FunctionalBaseline | null>(functionalBaselineKey(run.id), null)!.correctionTaskId!;
    return { app, run, ws, orch, fixId };
  }

  it("a lint-only failure isn't sent to the records: no src/app/schema.ts in its brief or scope", () => {
    const s = setup({});
    const fix = s.app.store.tasks.require(s.fixId);
    expect(fix.expectedPaths).toEqual(["src/App.tsx"]);
    expect(fix.objective).not.toContain("schema.ts");
  });

  it("a journey failure names the navigation (src/app/routes.ts, where the generated app keeps it)", () => {
    const s = setup({ journey: { ok: false, summary: '0/1 journey steps passed; failed: Gallery.: opens from the top bar ("Gallery" in the top bar is disabled)' } });
    const fix = s.app.store.tasks.require(s.fixId);
    expect(fix.expectedPaths).toEqual(["src/App.tsx", "src/app/routes.ts"]);
    expect(fix.objective).toContain("the navigation in src/app/routes.ts and src/App.tsx");
  });

  it("starts (and starts over, on a retry) from the located errors as they are now: their files join its scope, one list", () => {
    const s = setup({});
    const located: Diagnostic[] = [{ kind: "lint", file: "src/sections/RecordDetail.tsx", line: 4, text: "src/sections/RecordDetail.tsx:4 Expected an assignment (@typescript-eslint/no-unused-expressions)" }];
    s.app.store.setSetting(stepBaselineKey(s.fixId), { at: "", lint: { passed: false, errors: [], located } });
    const run = s.app.store.runs.require(s.run.id);
    let task = s.orch.withLocatedErrors(run, s.app.store.tasks.require(s.fixId), s.ws);
    task = s.orch.withLocatedErrors(run, task, s.ws);
    expect(task.expectedPaths).toEqual(["src/App.tsx", "src/sections/RecordDetail.tsx"]);
    expect(task.objective.split(LOCATED_NOW)).toHaveLength(2);
    expect(task.objective).toContain("- src/sections/RecordDetail.tsx:4 Expected an assignment");
    expect(task.objective).toContain("    4| bad();");
    expect(fs.existsSync(path.join(s.ws, "src/sections/RecordDetail.tsx"))).toBe(true);
  });
});
