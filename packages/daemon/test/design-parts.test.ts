/**
 * A complete app's design step split by screen from FlowCode's own plan (designParts.ts): the records' pictures on
 * their own, each page with its own stylesheet and the PRD's requirements the plan maps to it (composition first), then
 * the frame in a stylesheet of its own; no part takes the shared state or a shared stylesheet; buildSplit keeps these
 * parts as written and gives the frame check to the frame part.
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
  { id: "R40", text: "Keep one shared source of truth for the shortlist and notes.", section: "Client selection state" },
];
const coverage = [
  { files: ["src/screens/GalleryScreen.tsx", "src/app/store.ts"], covers: ["R51"] },
  { files: ["src/screens/GalleryScreen.tsx", "src/screens/MySelectionScreen.tsx"], covers: ["R67"] },
  { files: ["src/screens/MySelectionScreen.tsx"], covers: ["R80", "R40"] },
];
const parts = designScreenParts(model, requirements, coverage, "spec/Frameproof-PRD.md")!;
const leaves = (o: string) => o.slice(o.indexOf("built by later steps"));

describe("the design step split by screen", () => {
  it("makes the pictures part, one part per page with a stylesheet of its own, then the frame: no shared stylesheet, no store", () => {
    expect(parts.map((p) => [p.title, p.files])).toEqual([
      ["Give the records their pictures", ["src/app/schema.ts", "public/images/"]],
      ["Design the Gallery screen", ["src/screens/GalleryScreen.tsx", "src/styles/gallery.css"]],
      ["Design the My Selection screen", ["src/screens/MySelectionScreen.tsx", "src/styles/my-selection.css"]],
      ["Design the frame", ["src/styles/frame.css", "src/App.tsx"]],
    ]);
    expect(parts.some((p) => p.files.includes("src/app/store.ts") || p.files.includes("src/styles/components.css"))).toBe(false);
  });

  it("gives each page its composition first and its own behaviour; the shared state stays with the later steps on every page", () => {
    const g = parts[1]!.objective;
    expect(g.indexOf("R110 (Gallery composition)")).toBeGreaterThan(-1);
    expect(g.indexOf("R110 (Gallery composition)")).toBeLessThan(g.indexOf("R51 (R2 — Search)"));
    expect(g).toMatch(/recompose the page in this file on the same store/);
    expect(leaves(g)).toContain("R5 — Shortlist behavior");
    expect(g).not.toContain("R67 (");
    expect(parts[0]!.objective).toContain("distinct local image in public/images");
    // The state page composes itself and leaves its state (and the state's own section) to the later steps too.
    const s = parts[2]!.objective;
    expect(s).not.toContain("R80 (");
    expect(s).not.toContain("R40 (");
    expect(leaves(s)).toContain("R8 — Submission eligibility");
    expect(leaves(s)).toContain("Client selection state");
  });

  it("knows which records lack pictures and which pages own state", () => {
    expect(missingImages(model)).toEqual({ entity: "photo", field: "imageSource" });
    expect(customScreenFiles(model)).toEqual(["src/screens/MySelectionScreen.tsx"]);
  });

  it("keeps FlowCode's parts as written and gives the frame check to the frame part", () => {
    const parent = {
      id: "t",
      runId: "r",
      title: "Design the main screens",
      objective: parts[1]!.objective,
      expectedPaths: ["src/screens/", "src/styles/"],
      acceptanceCriteria: [{ id: "f", description: "The app frame is designed", check: { type: "verification", kind: "frame-designed" }, evidenceRefs: [] }],
      validationPlan: { kinds: [] },
      role: "coder",
      ordinal: 1,
      attempts: 0,
      dependsOn: [],
    } as unknown as Task;
    let n = 0;
    const pieces = buildSplit(parent, parts, () => `p${++n}`, {}, { asWritten: true });
    expect(pieces[1]!.objective.startsWith(parts[1]!.objective)).toBe(true);
    expect(pieces[1]!.expectedPaths).toEqual(["src/screens/GalleryScreen.tsx", "src/styles/gallery.css"]);
    const withFrame = pieces.filter((p) => p.acceptanceCriteria.some((c) => (c.check as { kind?: string }).kind === "frame-designed"));
    expect(withFrame.map((p) => p.title)).toEqual(["Design the frame"]);
    expect(withFrame[0]!.expectedPaths).toEqual(["src/styles/frame.css", "src/App.tsx"]);
  });
});
