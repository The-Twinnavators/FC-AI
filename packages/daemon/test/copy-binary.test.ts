/** copy_file copies pictures byte for byte (a text copy turned No BIO & GMO's new photo into a broken .jpg). */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeApp, makeProject } from "./helpers.js";
import { isBinary } from "../src/workspace/operations.js";

describe("copy_file with binary files", () => {
  it("copies a JPEG exactly, with a snapshot that restores it", () => {
    const { app } = makeApp();
    const { project, ws, jail } = makeProject(app, { "src/x.ts": "export {};\n" });
    // A JPEG header and bytes that aren't valid UTF-8.
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x80, 0x81, 0xfe, 0xff, 0xd9]);
    fs.mkdirSync(path.join(ws, "public/images"), { recursive: true });
    fs.writeFileSync(path.join(ws, "public/images/a.jpg"), jpg);
    const ctx = { jail, projectId: project.id, runId: "run_bin", taskId: "t1" };
    const res = app.ops.copy_file(ctx, { from: "public/images/a.jpg", to: "public/images/b.jpg" });
    expect(res.ok).toBe(true);
    expect(fs.readFileSync(path.join(ws, "public/images/b.jpg")).equals(jpg)).toBe(true);
    expect(app.ops.copy_file(ctx, { from: "public/images/a.jpg", to: "public/images/b.jpg" }).message).toMatch(/No change/);
    // Undo removes the new file again.
    const snap = app.snapshots.forRun("run_bin")[0]!;
    app.snapshots.restore(snap.id, jail);
    expect(fs.existsSync(path.join(ws, "public/images/b.jpg"))).toBe(false);
  });
  it("tells binary from text", () => {
    expect(isBinary("a.css", Buffer.from(".a { color: red; }\n"))).toBe(false);
    expect(isBinary("a.jpg", Buffer.from("anything"))).toBe(true);
    expect(isBinary("blob", Buffer.from([0x61, 0x00, 0x62]))).toBe(true);
    expect(isBinary("blob", Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
  });
});
