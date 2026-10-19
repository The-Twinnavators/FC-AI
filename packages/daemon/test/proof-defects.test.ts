/**
 * The defects the Frameproof Gallery proof and the calculator build showed (docs/handoff/2026-10-16/HANDOFF.md §0.10):
 * a file replace that a Windows lock refuses for a moment; the Design tab's previews losing the app's tokens to a cut;
 * a pictures step verified with records left without a picture; and a retry (the debugger) shown every tool on a local
 * model, which made its request too big to send.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { replaceWith } from "../src/workspace/replaceFile.js";
import { previewCss } from "../src/workspace/componentLibrary.js";
import { imagesCompleteProblem } from "../src/quality/verification.js";
import { ScriptedProvider } from "../src/models/scripted.js";
import { makeApp, makeProject } from "./helpers.js";

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "fc-defects-"));
const locked = (code: string) => Object.assign(new Error(`${code}: operation not permitted, rename`), { code });

describe("replacing a file a Windows lock holds for a moment", () => {
  it("tries the rename again, and never leaves the temporary file", () => {
    const d = tmpDir();
    const target = path.join(d, "GalleryScreen.tsx");
    const tmp = `${target}.flowcode-restore.tmp`;
    fs.writeFileSync(target, "broken");
    fs.writeFileSync(tmp, "restored");
    let tries = 0;
    replaceWith(tmp, target, (a, b) => {
      if (++tries < 3) throw locked("EPERM");
      fs.renameSync(a, b);
    });
    expect(tries).toBe(3);
    expect(fs.readFileSync(target, "utf8")).toBe("restored");
    expect(fs.existsSync(tmp)).toBe(false);
  });

  it("copies over the file when the rename stays refused, and rethrows anything else", () => {
    const d = tmpDir();
    const target = path.join(d, "a.ts");
    fs.writeFileSync(target, "old");
    fs.writeFileSync(`${target}.tmp`, "new");
    replaceWith(`${target}.tmp`, target, () => {
      throw locked("EBUSY");
    });
    expect(fs.readFileSync(target, "utf8")).toBe("new");
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
    fs.writeFileSync(`${target}.tmp`, "newer");
    expect(() => replaceWith(`${target}.tmp`, target, () => { throw locked("ENOSPC"); })).toThrow("ENOSPC");
    expect(fs.readFileSync(target, "utf8")).toBe("new");
    expect(fs.existsSync(`${target}.tmp`)).toBe(false);
  });
});

describe("the Design tab's preview stylesheet", () => {
  it("puts the tokens and fonts first, and leaves a file out whole rather than cutting a rule", () => {
    const files = [
      { rel: "src/styles/app.css", text: ".app { color: var(--color-text); }" },
      { rel: "src/styles/library.css", text: `.fl-btn { padding: 4px; }\n${"/* x */\n".repeat(60)}` },
      { rel: "src/styles/screen-parts.css", text: ".ui-chart__label { text-overflow: ellipsis; }" },
      { rel: "src/styles/tokens.css", text: ":root { --color-text: #111; }" },
      { rel: "src/styles/fonts.css", text: "@font-face { font-family: Roboto; }" },
    ];
    const css = previewCss(files, 320);
    expect(css.indexOf("src/styles/tokens.css")).toBe(3);
    expect(css.indexOf("src/styles/fonts.css")).toBeLessThan(css.indexOf("src/styles/app.css"));
    expect(css).toContain(":root { --color-text: #111; }");
    expect(css).toContain("/* src/styles/library.css left out of the preview (");
    expect(css).toContain(".ui-chart__label { text-overflow: ellipsis; }");
    // Every rule that is in is whole.
    expect(css.split("{").length).toBe(css.split("}").length);
  });
});

describe("a pictures step's completeness check", () => {
  it("names the records without a local picture of their own", () => {
    const d = tmpDir();
    fs.mkdirSync(path.join(d, "public/images"), { recursive: true });
    for (const n of ["photo-01.jpg", "photo-02.jpg"]) fs.writeFileSync(path.join(d, "public/images", n), "x");
    const rows = [
      { id: "photo-01", imageSource: "/images/photo-01.jpg" },
      { id: "photo-02", imageSource: "/images/photo-02.jpg" },
      { id: "photo-03", imageSource: "" },
      { id: "photo-04", imageSource: "/images/photo-04.jpg" },
      { id: "photo-05", imageSource: "https://example.com/a.jpg" },
      { id: "photo-06", imageSource: "/images/photo-01.jpg" },
    ];
    const problem = imagesCompleteProblem(d, rows, "photo", "imageSource")!;
    expect(problem).toContain("2 of 6 photo records have no local picture: photo-03, photo-04 (/images/photo-04.jpg isn't in public/)");
    expect(problem).toContain("1 use a remote or inline address (photo-05)");
    expect(problem).toContain("records share a picture (/images/photo-01.jpg: photo-01, photo-06)");
    expect(imagesCompleteProblem(d, rows.slice(0, 2), "photo", "imageSource")).toBeUndefined();
  });
});

describe("a retry on a local model", () => {
  it("is shown the step's tools, not every tool its role allows", async () => {
    const { app } = makeApp();
    app.router.register(new ScriptedProvider({ id: "scripted", kind: "ollama", label: "Ollama", enabled: true, hosted: false }, async () => ({ content: "not called" })));
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "scripted", model: "agent" });
    const { project } = makeProject(app, { "README.md": "# demo\n", "package.json": JSON.stringify({ name: "demo", version: "1.0.0", scripts: { typecheck: "tsc --noEmit" } }), "src/a.ts": "export const a = 1;\n" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "demo", constraints: [], attachedKnowledgeIds: [] });
    const task = { id: "t1", runId: run.id, title: "Change a", objective: "Change src/a.ts so a is 2.", status: "blocked", dependsOn: [], expectedPaths: ["src/a.ts"], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 2 } as unknown as Task;
    app.store.tasks.upsert(task);
    const coder = await app.orchestrator.measureRequest(run.id, app.store.tasks.require("t1"), "coder");
    const debuggerReq = await app.orchestrator.measureRequest(run.id, app.store.tasks.require("t1"), "debugger");
    expect(debuggerReq!.toolsChars).toBeLessThanOrEqual(coder!.toolsChars + 400);
    expect(debuggerReq!.toolsChars).toBeLessThan(10_000);
  });
});
