/** A retry notices files changed outside FlowCode since the build stopped (C5). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { externalChanges, stampWorkspace } from "../src/workspace/stamp.js";

function fakeApp(root: string) {
  const settings = new Map<string, unknown>();
  const project = { id: "p1" };
  return {
    store: {
      projects: { get: () => project, require: () => project },
      runs: { require: () => ({ id: "r1", projectId: "p1" }) },
      getSetting: <T>(k: string, d: T) => (settings.has(k) ? (settings.get(k) as T) : d),
      setSetting: (k: string, v: unknown) => void settings.set(k, v),
    },
    projects: { jail: () => ({ root }) },
  } as never;
}

describe("external edits", () => {
  it("lists changed, added and removed files since the stop, and skips node_modules", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-stamp-"));
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.writeFileSync(path.join(root, "src/a.ts"), "a");
    fs.writeFileSync(path.join(root, "src/b.json"), "{}");
    fs.writeFileSync(path.join(root, "src/gone.ts"), "x");
    const app = fakeApp(root);
    stampWorkspace(app, "p1", "r1");
    expect(externalChanges(app, "r1")).toMatchObject({ changed: [], added: [], removed: [] });
    fs.writeFileSync(path.join(root, "src/b.json"), '{"date":"2026-10-07"}');
    fs.writeFileSync(path.join(root, "src/new.ts"), "n");
    fs.rmSync(path.join(root, "src/gone.ts"));
    fs.writeFileSync(path.join(root, "node_modules/x.js"), "ignored");
    const x = externalChanges(app, "r1");
    expect(x.changed).toEqual(["src/b.json"]);
    expect(x.added).toEqual(["src/new.ts"]);
    expect(x.removed).toEqual(["src/gone.ts"]);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
