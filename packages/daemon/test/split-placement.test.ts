/**
 * A split's checks go to the parts that can pass them, each part's paths hold the files its objective names, and each
 * part has its own objective. Fixture: the Clean Cart slice eval 2 split, recorded (parent "Design the main screens"
 * with type check, records and frame checks; part 1 the Product and Saved screens with the parent's opening as its
 * objective; part 2 the look, naming tokens.css and components.css but given tokens.css and app.css). Part 1 held the
 * frame check it couldn't pass and part 2 never had the frame's stylesheet: both used every attempt.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { buildSplit, copiesParent, ownObjective } from "../src/orchestrator/stepRecovery.js";

const FX = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/apps/eval2-split.json"), "utf8")) as { parent: Task; parts: Array<{ title: string; objective: string; files: string[] }>; frame: { component: string; file: string } };
const kinds = (t: Task) => t.acceptanceCriteria.map((c) => (c.check as { kind?: string }).kind ?? c.check.type);
let n = 0;
const split = () => buildSplit(FX.parent, FX.parts, () => `p${++n}`, { completeApp: true, frame: FX.frame });

describe("the recorded eval-2 split, rebuilt", () => {
  it("gives the frame check to the part with the frame's stylesheet, never to the screens part", () => {
    const [screens, look] = split();
    expect(kinds(screens!)).not.toContain("frame-designed");
    expect(kinds(look!)).toContain("frame-designed");
    expect(look!.expectedPaths).toContain("src/styles/components.css");
  });

  it("keeps every check of the step somewhere, and the records check on the last part", () => {
    const parts = split();
    const all = parts.flatMap(kinds);
    for (const k of ["frame-designed", "data-source"]) expect(all.filter((x) => x === k)).toHaveLength(1);
    expect(kinds(parts.at(-1)!)).toContain("data-source");
    for (const p of parts) expect(kinds(p)).toContain("typecheck");
  });

  it("gives the screens part its own objective: the clauses about its two files, not the whole step", () => {
    expect(copiesParent(FX.parts[0]!.objective, FX.parent.objective)).toBe(true);
    expect(copiesParent(FX.parts[1]!.objective, FX.parent.objective)).toBe(false);
    const [screens, look] = split();
    const own = screens!.objective.split("\n\n")[0]!;
    expect(own.startsWith("Work on src/screens/ProductScreen.tsx and src/screens/SavedScreen.tsx")).toBe(true);
    expect(own).toContain("Product [entry] in src/screens/ProductScreen.tsx");
    expect(own).not.toContain("CategoriesScreen");
    expect(own.length).toBeLessThan(FX.parts[0]!.objective.length);
    // The look part kept its own objective (it wasn't a copy).
    expect(look!.objective.startsWith(FX.parts[1]!.objective)).toBe(true);
  });

  it("adds the files an objective names outright, and leaves a part's own paths alone otherwise", () => {
    const [screens, look] = split();
    expect(screens!.expectedPaths).toEqual(["src/screens/ProductScreen.tsx", "src/screens/SavedScreen.tsx"]);
    expect(look!.expectedPaths).toEqual(expect.arrayContaining(["src/styles/app.css", "src/styles/tokens.css", "src/styles/components.css"]));
  });

  it("puts the stylesheet with the part about the look when no part has the frame's files", () => {
    const parts = [
      { title: "Screens", objective: "Compose Home in src/screens/LandingScreen.tsx from the PRD's words.", files: ["src/screens/LandingScreen.tsx"] },
      { title: "Look", objective: "Give the app its colours and type through the design tokens.", files: ["src/styles/tokens.css"] },
    ];
    const [a, b] = buildSplit(FX.parent, parts, () => `q${++n}`, { completeApp: true, frame: FX.frame });
    expect(kinds(a!)).not.toContain("frame-designed");
    expect(kinds(b!)).toContain("frame-designed");
    expect(b!.expectedPaths).toContain("src/styles/components.css");
    expect(ownObjective("Restyle the frame. Rewrite the hero on LandingScreen with the PRD's promise.", ["src/screens/LandingScreen.tsx"])).toBe("Work on src/screens/LandingScreen.tsx: Rewrite the hero on LandingScreen with the PRD's promise.");
  });
});
