import { describe, expect, it } from "vitest";
import type { Run } from "@flowcode/contracts";
import { tasteHits } from "../src/knowledge/taste.js";

const run = (objective: string, extra: Partial<Run> = {}): Run =>
  ({ id: `run_${Math.random().toString(36).slice(2, 8)}`, projectId: "prj_a", objective, status: "done", modelAssignments: {}, planApproved: true, constraints: [], createdAt: "2026-10-07T10:00:00Z", attachedKnowledgeIds: [], referencePaths: [], parentRunId: "run_parent", origin: "you", ...extra }) as Run;

describe("taste memory", () => {
  it("learns only from change requests you typed", () => {
    const hits = tasteHits([
      run("Increase the padding on the cards"),
      run("Fix the failing design check so it passes", { origin: undefined }), // FlowCode's own repair run
      run("Add a dark mode toggle in settings", { origin: "flowcode" }), // a suggestion FlowCode built
      run("Build a booking calendar", { parentRunId: undefined }), // the first build, not a correction
    ]);
    expect(hits.map((h) => h.text)).toEqual(["Increase the padding on the cards"]);
  });

  it("sorts a request into every design area it touches", () => {
    const [h] = tasteHits([run("Make the toggle teal with no outline, and add more space between the cards")]);
    expect(h!.areas).toEqual(expect.arrayContaining(["colour", "spacing", "depth", "controls"]));
  });

  it("ignores requests that touch no design area", () => {
    expect(tasteHits([run("Why did the run stop?")])).toEqual([]);
  });
});
