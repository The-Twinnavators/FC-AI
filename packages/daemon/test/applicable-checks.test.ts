/**
 * Deliverable checks fit the app they check. The frame is resolved from the app itself (App.tsx's wrapping component
 * and the classes it renders): a complete app's LookupFrame and an app on the starter kit's AppShell, without a list
 * of library components. A complete app's records are checked in the source FlowCode generated, for the PRD's named
 * records and the places carrying them. Fixtures: the Clean Cart slice's generated app (eval 1) and the controlled
 * build's App.tsx on the starter kit.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { isFrameSelector, resolveFrame } from "../src/quality/appFrame.js";
import { frameEvidence, frameCssChanges } from "../src/quality/frameCheck.js";
import { dataSourceProblems, readGeneratedData } from "../src/quality/appData.js";
import { deliverableChecks } from "../src/orchestrator/taskContract.js";

const FX = path.join(import.meta.dirname, "fixtures/apps");
/** A fixture app in a temporary folder (the .txt fixtures without their .txt). */
function app(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fc-${name}-`));
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else {
        const rel = path.relative(path.join(FX, name), abs).replace(/\.txt$/, "");
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(abs, path.join(root, rel));
      }
    }
  };
  walk(path.join(FX, name));
  return root;
}

describe("the frame, resolved from the app", () => {
  it("finds a complete app's LookupFrame and the starter kit's AppShell the same way", () => {
    const lookup = resolveFrame(app("lookup"))!;
    expect(lookup).toMatchObject({ component: "LookupFrame", file: "src/sections/LookupFrame.tsx" });
    expect(lookup.classes).toContain("fl-lkf-bar");
    const shell = resolveFrame(app("shell"))!;
    expect(shell).toMatchObject({ component: "AppShell", file: "src/components/ui/index.tsx" });
    expect(shell.classes).toEqual(expect.arrayContaining(["ui-shell", "ui-shell__nav"]));
    // Only AppShell's own classes, not every component in the kit's index.tsx.
    expect(shell.classes).not.toContain("ui-card");
    expect(shell.classes).not.toContain("ui-btn");
  });

  it("counts a restyle of the rendered frame's rules, and not unrelated rules or another frame's", () => {
    const f = resolveFrame(app("lookup"))!;
    const isFrame = (s: string) => isFrameSelector(f, s);
    const before = ".fl-lkf-bar { background: white; }\n.fl-card { padding: 8px; }\n.ui-shell__header { color: red; }\n";
    expect(frameCssChanges(before, before.replace("background: white", "background: var(--color-accent)"), isFrame)).toEqual([".fl-lkf-bar"]);
    expect(frameCssChanges(before, before.replace("padding: 8px", "padding: 16px"), isFrame)).toEqual([]);
    // The starter's ui-shell isn't this app's frame: restyling it is not frame evidence here.
    expect(frameCssChanges(before, before.replace("color: red", "color: blue"), isFrame)).toEqual([]);
    const ev = frameEvidence([{ file: "src/styles/app.css", before, now: before.replace("color: red", "color: blue") }], [], { ...f, isFrame });
    expect(ev).toEqual({ ok: false, problem: expect.stringMatching(/don't touch the frame: no rule of LookupFrame \(src\/sections\/LookupFrame\.tsx/) });
  });

  it("counts a change to the frame component's own file, and not a frame component nothing renders", () => {
    const f = resolveFrame(app("lookup"))!;
    const frame = { ...f, isFrame: (s: string) => isFrameSelector(f, s) };
    expect(frameEvidence([], [], frame, true)).toMatchObject({ ok: true, component: "src/sections/LookupFrame.tsx" });
    expect(frameEvidence([], [{ file: "src/components/MyFrame.tsx", rendered: false }], frame)).toEqual({ ok: false, problem: expect.stringMatching(/isn't rendered: App\.tsx doesn't import it/) });
  });
});

describe("a complete app's records, in the generated source", () => {
  const required = ["Oat Milk Original", "Sourdough Country Loaf", "Rolled Oats", "Pear Puree", "Black Bean Chips", "Greek Yogurt Plain"];
  const lookup = { entries: "product", places: "store", placesField: "carriedBy" };

  it("finds every PRD record and the places carrying it in the slice's generated schema", () => {
    const data = readGeneratedData(app("lookup"))!;
    expect(data.entities.map((e) => e.key)).toEqual(["product", "store"]);
    expect(dataSourceProblems(data, required, lookup)).toEqual([]);
  });

  it("names a missing PRD record, an entry no existing place carries, and a kind with no records", () => {
    const data = readGeneratedData(app("lookup"))!;
    expect(dataSourceProblems(data, ["Kale Chips"], lookup)).toEqual(['the PRD\'s record "Kale Chips" isn\'t in src/app/schema.ts']);
    const oat = data.seed.product!.find((r) => r.name === "Oat Milk Original")!;
    for (const r of data.seed.product!) if (r.name === "Oat Milk Original") r.carriedBy = ["STR-9999"];
    expect(oat).toBeTruthy();
    expect(dataSourceProblems(data, ["Oat Milk Original"], lookup)).toEqual(['"Oat Milk Original" isn\'t carried by any place in the data (carriedBy names none that exists)']);
    expect(dataSourceProblems({ ...data, seed: { ...data.seed, store: [] } }, [], lookup)).toContain("no stores in src/app/schema.ts");
  });

  it("is the data check a complete app's step gets; others keep the seeded-collection check", () => {
    const t = { id: "t", title: "Design the main screens", objective: "Seed the sample records into the collections and compose the app frame and navigation.", expectedPaths: ["src/screens/"] } as unknown as Task;
    const kinds = (ctx: Parameters<typeof deliverableChecks>[1]) => deliverableChecks(t, ctx).map((c) => (c.check as { kind: string }).kind);
    expect(kinds({ completeApp: true, frame: { component: "LookupFrame", file: "src/sections/LookupFrame.tsx" } })).toEqual(["data-source", "frame-designed"]);
    expect(kinds({})).toEqual(["data-seeded:8", "frame-designed"]);
    expect(deliverableChecks(t, { completeApp: true, frame: { component: "LookupFrame", file: "src/sections/LookupFrame.tsx" } }).find((c) => (c.check as { kind: string }).kind === "frame-designed")!.description).toMatch(/^The app frame \(LookupFrame, src\/sections\/LookupFrame\.tsx\) is designed/);
  });
});
