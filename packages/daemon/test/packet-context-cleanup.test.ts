/**
 * Misleading context out of the coder's request (Clean Cart slice eval 1): the starter kit's .ui-shell top bar named
 * as the frame in a look-up app whose frame is LookupFrame, and a user playbook's worked example for a creative
 * collaboration product. The app's actual frame (appFrame.resolveFrame) is named instead; what the step needs stays.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { designBrief } from "../src/workspace/designStudio.js";
import { PathJail } from "../src/security/pathJail.js";
import { PLAYBOOK_TAG, playbookFor } from "../src/knowledge/designPlaybook.js";
import { promptById } from "../src/orchestrator/prompts.js";
import { makeApp } from "./helpers.js";

const FX = path.join(import.meta.dirname, "fixtures/apps");
function app(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fc-ctx-${name}-`));
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(".txt")) {
        const rel = path.relative(path.join(FX, name), abs).replace(/\.txt$/, "");
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(abs, path.join(root, rel));
      }
    }
  };
  walk(path.join(FX, name));
  return root;
}
const designStep = JSON.parse(fs.readFileSync(path.join(FX, "design-step.json"), "utf8")) as { title: string; objective: string };

describe("the frame the coder is told about", () => {
  it("is the look-up app's own frame, with no instruction to work on .ui-shell", () => {
    const brief = designBrief(new PathJail(app("lookup")));
    expect(brief).toContain("The app's frame (top bar and navigation) is LookupFrame (src/sections/LookupFrame.tsx, classes .fl-lkf");
    expect(brief).not.toContain("ui-shell");
    // The rest of the kit is still offered.
    expect(brief).toContain("Button (.fl-btn)");
  });

  it("stays the kit's AppShell in an app that renders it", () => {
    const brief = designBrief(new PathJail(app("shell")));
    expect(brief).toContain("Top Nav / App Bar (.ui-shell)");
    expect(brief).not.toContain("The app's frame (top bar and navigation) is");
  });
});

describe("the playbook parts a design step gets", () => {
  it("leaves out a worked example for another kind of product, and keeps it when the step is about that kind", () => {
    const { app: a } = makeApp();
    const add = (title: string, content: string) => a.store.knowledge.upsert({ id: `k_${title.length}_${content.length}`, scope: "global", title, content, kind: "note", provenance: [], tags: [PLAYBOOK_TAG], linkedEntityIds: [], durability: "temporary", confirmedByUser: false, pinned: false, excluded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    add("playbook (part 5 of 6)", "For a creative collaboration product:\n\n1. A user creates a project in the desktop workspace.\n2. A collaborator receives a notification.");
    add("playbook (part 2 of 6)", "Screens and search: put the search box first on a look-up product's home screen; show results as the person types.");
    const titles = (text: string) => playbookFor(a, text).map((p) => p.title);
    const clean = titles(`${designStep.title}\n${designStep.objective}`);
    expect(clean.some((t) => t.includes("part 5"))).toBe(false);
    expect(titles("Design the board where a creative team's collaboration happens").some((t) => t.includes("part 5"))).toBe(true);
  });
});

describe("what the coder's request keeps", () => {
  it("keeps the role's scope, approval, file-safety and tool-call rules", () => {
    const coder = promptById("role.coder").template;
    for (const rule of ["Operating rules (enforced by the runtime, not optional)", "task_complete"]) expect(coder).toContain(rule);
    expect(coder).toMatch(/approval/i);
    expect(coder).toMatch(/scope|expected paths|only the files/i);
  });
});
