/**
 * FlowCode writes the acceptance tests of a composed app's functional steps itself (acceptanceComposer.ts), from the
 * PRD's examples, the sample data and its own controls' labels; and a planned test's words are the app's exact text
 * only when the spec gives them as the app's text (lrcPlan.ts givenAsText). Frameproof planning required "Portrait",
 * "30%" and "off-white background" on screen, and its functional briefs ran to 37,000–66,000 characters.
 */
import { describe, expect, it } from "vitest";
import { composeAcceptanceFile, exampleNote, familiesFor, searchExamples } from "../src/orchestrator/acceptanceComposer.js";
import { detectSelection } from "../src/orchestrator/selectionComposer.js";
import type { AppModel } from "../src/orchestrator/appModel.js";
import { givenAsText, testKind, withoutInventedText } from "../src/quality/lrcPlan.js";

const TITLES = ["Golden Hour", "Window Light", "Walking Together", "Quiet Smile", "Garden Steps", "Soft Shadows", "Autumn Path", "Looking Back", "Linen Backdrop", "Under the Oak", "Candid Laugh", "Last Light"];
const STUDIO = new Set([2, 4, 6, 9, 11]);
const MODEL = {
  product: "Frameproof",
  roles: ["client"],
  entities: [
    { key: "gallery", label: "Gallery", plural: "Galleries", titleField: "title", fields: [{ key: "id", label: "ID", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "photographer", label: "Photographer", type: "text" }, { key: "client", label: "Client", type: "text" }, { key: "requiredSelectionCount", label: "Required Selection Count", type: "number" }] },
    { key: "photo", label: "Photo", plural: "Photos", titleField: "title", subtitleField: "category", filters: ["category"], fields: [{ key: "id", label: "ID", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "category", label: "Category", type: "select", options: ["Outdoor", "Studio", "All"] }, { key: "imageSource", label: "Image Source", type: "text" }, { key: "altText", label: "Alt Text", type: "text" }] },
  ],
  seed: {
    gallery: [{ id: "gallery-autumn", title: "Autumn Portrait Session", photographer: "Rowan Studio", client: "Maya Chen", requiredSelectionCount: 5 }],
    photo: TITLES.map((title, i) => ({ id: `photo-${String(i + 1).padStart(2, "0")}`, title, category: STUDIO.has(i + 1) ? "Studio" : "Outdoor", imageSource: `/images/${i + 1}.jpg`, altText: title })),
  },
  nav: [
    { label: "Gallery", items: [{ id: "gallery", label: "Gallery", kind: "list", entity: "photo" }, { id: "photo-detail", label: "Photo detail", kind: "detail", entity: "photo" }] },
    { label: "My Selection", items: [{ id: "my-selection", label: "My Selection", kind: "custom" }] },
  ],
} as unknown as AppModel;
const PRD = [
  "### R2 — Search",
  "- `light` returns Window Light and Last Light, not Golden Hour.",
  "- `WINDOW` returns Window Light.",
  "- `mountain` produces no results.",
  "### R7 — My Selection",
  "Client chooses exactly five photos for a shortlist. My Selection lists them. Each photo can have an optional editing note of up to 300 characters.",
  "3. Add note: “Please soften the background.”",
].join("\n");

describe("the PRD's own examples", () => {
  it("reads search examples, a no-results term and an example note", () => {
    expect(searchExamples(PRD)).toEqual({
      examples: [
        { term: "light", shows: ["Window Light", "Last Light"], hides: ["Golden Hour"] },
        { term: "WINDOW", shows: ["Window Light"], hides: [] },
      ],
      noResults: ["mountain"],
    });
    expect(exampleNote(PRD, 300)).toBe("Please soften the background.");
    expect(exampleNote("no example here", 300)).toBe("Warmer tones, please");
  });

  it("maps a requirement's section to the behaviours that check it", () => {
    expect(familiesFor("R2 — Search: Search Functionality")).toEqual(["search"]);
    expect(familiesFor("R3 — Category filters: Category Filters")).toEqual(["filter"]);
    expect(familiesFor("Journey D — Submit and lock: Submit Selection")).toEqual(["submission", "submitted"]);
    expect(familiesFor("R11 — Persistence: Persist Selection State Across Reloads")).toEqual(["shortlist", "persistence"]);
    expect(familiesFor("Verification and completion criteria: remaining requirements")).toEqual([]);
  });
});

describe("a composed app's acceptance tests", () => {
  const spec = detectSelection(MODEL, PRD);

  it("checks search and filters with the PRD's examples and the sample data's counts", () => {
    const r = composeAcceptanceFile(MODEL, spec, PRD, ["R2 — Search: Search Functionality", "R3 — Category filters: Category Filters"], "R2 — Search: Search Functionality and 1 more")!;
    expect(r.families).toEqual(["search", "filter"]);
    expect(r.content).toContain('it("search \\"light\\" shows Window Light and Last Light, not Golden Hour"');
    expect(r.content).toContain('expect(screen.queryByRole("button", { name: "Open Golden Hour" })).not.toBeInTheDocument();');
    expect(r.content).toContain('await search("mountain");');
    expect(r.content).toContain('await user.selectOptions(pick, "Outdoor");\n    expect(cards()).toHaveLength(7);');
    expect(r.content).toContain('await user.selectOptions(pick, "Studio");\n    expect(cards()).toHaveLength(5);');
    // Only what the tests use is imported (lint).
    expect(r.content).toContain('import { act, render, screen } from "@testing-library/react";');
    expect(r.content).toContain('import { beforeEach, describe, expect, it } from "vitest";');
  });

  it("checks the selection's limit, notes, submission, lock, start over and reload when the step covers them", () => {
    const r = composeAcceptanceFile(MODEL, spec, PRD, ["R5 — Shortlist behavior", "R6 — Editing notes", "Journey D — Submit and lock", "R10 — Start over", "R11 — Persistence"], "Selection")!;
    expect(r.families).toEqual(["shortlist", "notes", "submission", "submitted", "start-over", "persistence"]);
    expect(r.content).toContain('expect(screen.getByText(/already has 5 photos/)).toBeInTheDocument();');
    expect(r.content).toContain('await user.paste("Please soften the background.");');
    expect(r.content).toContain('expect(screen.getByText("29 / 300 characters")).toBeInTheDocument();');
    expect(r.content).toContain('const dialog = screen.getByRole("dialog", { name: "Submit your selection?" });');
    expect(r.content).toContain('localStorage.setItem("fl-selection:frameproof", "{not json");');
    expect(r.content).toContain("vi.resetModules();");
    expect(r.content).toContain("let selection = initial;");
    expect(r.content).toContain('import { act, cleanup, render, screen, within } from "@testing-library/react";');
  });

  it("writes nothing for an app without a list of records with pictures, or a step nothing applies to", () => {
    const plain = { ...MODEL, entities: MODEL.entities.map((e) => ({ ...e, fields: e.fields.filter((f) => f.key !== "imageSource") })) } as AppModel;
    expect(composeAcceptanceFile(plain, undefined, PRD, ["R2 — Search"], "x")).toBeUndefined();
    expect(composeAcceptanceFile(MODEL, spec, PRD, ["Out of scope: Payments"], "x")).toBeUndefined();
  });
});

describe("which planned words are the app's exact text", () => {
  const corpus = `${PRD}\n### 7. Visual direction\nA warm off-white background, near-black text and a muted cobalt accent.\n${JSON.stringify(MODEL.seed)}`;

  it("is a quoted phrase, a record's value or two words or more of one, never a single word inside a name or design words", () => {
    expect(givenAsText(corpus, "Autumn Portrait Session")).toBe(true);
    expect(givenAsText(corpus, "Window Light")).toBe(true);
    expect(givenAsText(corpus, "Please soften the background.")).toBe(true);
    expect(givenAsText(corpus, "Portrait")).toBe(false);
    expect(givenAsText(corpus, "off-white background")).toBe(false);
    expect(givenAsText(corpus, "muted cobalt accent")).toBe(false);
    expect(givenAsText(corpus, "selected image")).toBe(false);
  });

  it("classifies planned tests and drops the invented checks of a step planned before", () => {
    expect(testKind({ behaviour: "view gallery header", expect: "Autumn Portrait Session" }, corpus)).toBe("text");
    expect(testKind({ behaviour: "check selection progress", expect: "30%" }, corpus)).toBe("outcome");
    expect(testKind({ behaviour: "add 7 and 7", expect: "14" }, corpus)).toBe("text");
    const file = "src/acceptance/x.test.tsx";
    const checks = ["Autumn Portrait Session", "30%", "off-white background", "14"].map((text, i) => ({ id: `e${i}`, description: `The tests check that the app shows "${text}"`, check: { type: "file_contains", path: file, text } }));
    expect(withoutInventedText(checks, corpus).map((c) => c.check.type)).toEqual(["file_contains", "manual", "manual", "file_contains"]);
  });
});
