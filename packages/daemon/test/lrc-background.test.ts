/** PRD sections that are context, not build work, fold into one "PRD background" group at the end of the design part. */
import { describe, expect, it } from "vitest";
import { foldBackground } from "../src/quality/launchReadiness.js";

const cat = (id: string, title: string, n = 1) => ({ id, title, description: "", items: Array.from({ length: n }, (_, i) => ({ id: `${id}.${i}`, title: `t${i}`, detail: "d", status: "not_started" as const, source: "spec" as const, kind: "review" as const })) });

describe("PRD background group", () => {
  it("folds goals, users, timeline, non-goals and open questions; keeps build sections", () => {
    const out = foldBackground([
      cat("foundation", "Project foundation"),
      cat("spec.goals", "Spec · Goals", 2),
      cat("spec.functional", "Spec · Functional Requirements"),
      cat("spec.non-goals", "Spec · Non-Goals (v1)"),
      cat("spec.timeline", "Spec · Phases and Timeline (about 5 weeks)"),
      cat("spec.acceptance", "Spec · Acceptance Criteria (Release Gate)"),
      cat("spec.open", "Spec · Open Questions"),
      cat("quality", "Responsive, performance & quality"),
    ] as never);
    expect(out.map((c: { id: string }) => c.id)).toEqual(["foundation", "spec.functional", "spec.acceptance", "quality", "spec.background"]);
    const bg = out.at(-1) as { title: string; description: string; items: Array<{ id: string; detail: string }> };
    expect(bg.title).toBe("PRD background");
    expect(bg.items).toHaveLength(5);
    expect(bg.items[0]).toMatchObject({ id: "spec.goals.0", detail: "Goals. d" });
    expect(bg.description).toMatch(/^Goals, Non-Goals, Phases and Timeline, Open Questions:/);
  });
});
