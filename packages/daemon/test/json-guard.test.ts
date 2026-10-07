/** Edits can't leave a .json data file invalid (No BIO & GMO: a half-deleted credit broke the build). */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeApp, makeProject } from "./helpers.js";

describe("JSON guard", () => {
  it("refuses an edit that breaks a JSON file, allows a valid one, and leaves tsconfig alone", () => {
    const { app } = makeApp();
    const credits = '[\n  { "file": "/a.jpg", "title": "A" },\n  { "file": "/b.jpg", "title": "B" }\n]\n';
    const { project, ws, jail } = makeProject(app, { "src/content/credits.json": credits, "tsconfig.app.json": '{ "compilerOptions": {} }\n' });
    const ctx = { jail, projectId: project.id, runId: "run_json" };
    const bad = app.ops.apply_patch(ctx, { path: "src/content/credits.json", edits: [{ find: '"title": "B" }', replace: "" }] });
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/valid JSON/);
    expect(fs.readFileSync(path.join(ws, "src/content/credits.json"), "utf8")).toBe(credits);
    const good = app.ops.apply_patch(ctx, { path: "src/content/credits.json", edits: [{ find: '"title": "B"', replace: '"title": "Bee"' }] });
    expect(good.ok).toBe(true);
    // tsconfig files may have comments: not checked.
    expect(app.ops.apply_patch(ctx, { path: "tsconfig.app.json", edits: [{ find: "{}", replace: "{} // note" }] }).message).not.toMatch(/valid JSON/);
  });
});
