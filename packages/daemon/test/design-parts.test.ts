/**
 * A complete app's design step split by screen from FlowCode's own plan (designParts.ts): each page gets the PRD's
 * requirements the plan maps to its file, its composition first; behaviour the state page owns is left a place on the
 * list page; records without pictures get the image work; buildSplit keeps these parts as written.
 */
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { customScreenFiles, designScreenParts, missingImages } from "../src/orchestrator/designParts.js";
import { buildSplit } from "../src/orchestrator/stepRecovery.js";
import type { AppModel } from "../src/orchestrator/appModel.js";

const model = {
  product: "Frameproof",
  roles: ["client"],
  entities: [{ key: "photo", label: "Photo", plural: "Photos", fields: [{ key: "title" }, { key: "imageSource" }] }],
  seed: { photo: [{ id: "photo-01", title: "Golden Hour", imageSource: "" }] },
  nav: [
    { label: "Gallery", items: [{ id: "gallery", label: "Gallery", kind: "list", entity: "photo" }] },
    { label: "My Selection", items: [{ id: "my-selection", label: "My Selection", kind: "custom", purpose: "the client selection state" }] },
  ],
} as unknown as AppModel;
const requirements = [
  { id: "R110", text: "Photo grid.", section: "Gallery composition" },
  { id: "R51", text: "Search matches photo titles case-insensitively.", section: "R2 — Search" },
  { id: "R67", text: "Maximum five selected photos.", section: "R5 — Shortlist behavior" },
  { id: "R80", text: "Submission is available only with exactly five selected photos.", section: "R8 — Submission eligibility" },
];
const coverage = [
  { files: ["src/screens/GalleryScreen.tsx", "src/app/store.ts"], covers: ["R51"] },
  { files: ["src/screens/GalleryScreen.tsx", "src/screens/MySelectionScreen.tsx"], covers: ["R67"] },
  { files: ["src/screens/MySelectionScreen.tsx"], covers: ["R80"] },
];

describe("the design step split by screen", () => {
  const parts = designScreenParts(model, requirements, coverage, "spec/Frameproof-PRD.md")!;

  it("makes one part per page, then the frame and shared styles", () => {
    expect(parts.map((p) => [p.title, p.files])).toEqual([
      ["Design the Gallery screen", ["src/screens/GalleryScreen.tsx", "src/app/schema.ts", "public/images/"]],
      ["Design the My Selection screen", ["src/screens/MySelectionScreen.tsx"]],
      ["Design the frame and shared styles", ["src/styles/components.css"]],
    ]);
  });

  it("gives the list page its composition first and its own behaviour, and leaves the state page's behaviour a place", () => {
    const g = parts[0]!.objective;
    expect(g.indexOf("R110 (Gallery composition)")).toBeLessThan(g.indexOf("R51 (R2 — Search)"));
    expect(g).toMatch(/recompose the page in this file on the same store/);
    const later = g.slice(g.indexOf("Later steps"));
    expect(later).toContain("R67 (R5 — Shortlist behavior)");
    expect(g.slice(0, g.indexOf("Later steps"))).not.toContain("R67");
    expect(g).toMatch(/distinct local image in public\/images/);
    // The state page builds its own behaviour.
    expect(parts[1]!.objective).toContain("R80 (R8 — Submission eligibility)");
    expect(parts[1]!.objective).not.toContain("Later steps");
  });

  it("knows which records lack pictures and which pages own state", () => {
    expect(missingImages(model)).toEqual({ entity: "photo", field: "imageSource" });
    expect(customScreenFiles(model)).toEqual(["src/screens/MySelectionScreen.tsx"]);
  });

  it("keeps FlowCode's parts as written (no objective swapped for the parent's, no scope widened)", () => {
    const parent = { id: "t", runId: "r", title: "Design the main screens", objective: parts[0]!.objective, expectedPaths: ["src/screens/", "src/styles/"], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 0, dependsOn: [] } as unknown as Task;
    let n = 0;
    const pieces = buildSplit(parent, parts, () => `p${++n}`, {}, { asWritten: true });
    expect(pieces[0]!.objective.startsWith(parts[0]!.objective)).toBe(true);
    expect(pieces[0]!.expectedPaths).toEqual(["src/screens/GalleryScreen.tsx", "src/app/schema.ts", "public/images/"]);
  });
});
