/**
 * Each design instruction reaches the build once, without losing the person's own (designContext.ts). With the
 * Frameproof PRD's real visual direction, read on the Design page as the person would ("Use the PRD's direction", then
 * "Read my direction"): notes that repeat the PRD word for word aren't sent twice; a note that overlaps the PRD but adds
 * an instruction is kept whole; an explicit override is kept, marked, and ranked above the PRD; locked groups are
 * stated and notes touching them say so; a screen's step gets its own screen's composition.
 */
import { describe, expect, it } from "vitest";
import { BASE_APPEARANCE, interpretDirection, type ReferenceFile } from "@flowcode/contracts";
import { designDirectionContext, distinctNotes, prdDirectionRequirement } from "../src/orchestrator/designContext.js";
import { visualDirection } from "../src/orchestrator/starterIdentity.js";
import type { DesignState } from "../src/workspace/designState.js";

const DIRECTION = `### Concept: Editorial contact sheet
- Warm off-white background.
- Near-black text.
- Muted cobalt accent for primary actions and selected states.
- Fine borders and restrained corner rounding.
- Generous whitespace and clear typographic hierarchy.
- Minimal chrome around photography.

Use available fonts and assets. Add no font package.
Avoid dashboard KPI cards, gradients as the main identity, marketing heroes, testimonials, pricing, promotional CTA banners, and excessive badges or repeated instructions.

### Gallery composition
1. Compact product header and primary navigation.
2. Gallery title, photographer, and selection progress.
3. Search and category controls.
4. Photo grid.

### My Selection composition
1. Title and selection status.
2. Selected photos and notes, or empty state.
3. Selection progress and submission action.

At phone width, keep submission easy to find without obscuring content.`;
const prd = { role: "prd", name: "Frameproof-PRD.md", content: `# Frameproof\n\n## 9. Visual direction\n\n${DIRECTION}\n\n## 10. Data\n- photos\n` } as unknown as ReferenceFile;
// What the Design page's "Use the PRD's direction" puts in the box (the server strips the headings' # marks).
const pageText = DIRECTION.replace(/^#+\s*/gm, "");
// "Read my direction": the build notes the page keeps with the draft.
const notesFrom = (text: string, locks: string[] = []) => interpretDirection(text, BASE_APPEARANCE, locks).understood.filter((u) => u.group === "build").map((u) => u.words);
const applied = (notes: string[], locks: string[] = []): DesignState => ({
  base: { source: "starter", detail: "" },
  surfaceExceptions: [],
  locks,
  applied: { appearance: { ...BASE_APPEARANCE, primary: "#3b5bdb", fonts: { display: "Playfair Display", body: "Source Sans 3" } }, version: 3, appliedAt: "", snapshotIds: [], notes },
});
const all = (s: DesignState, screen?: string) => designDirectionContext(s, [prd], 1600, screen).requirements.join("\n\n");
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe("delivering the design direction once", () => {
  it("1. drops notes that repeat the PRD's direction word for word, and says so", () => {
    const notes = notesFrom(pageText);
    expect(notes.length).toBeGreaterThanOrEqual(10);
    expect(distinctNotes(notes, visualDirection([prd])).kept).toEqual([]);
    const text = all(applied(notes));
    expect(text).toContain(`The person read the PRD's direction for this Look (${notes.length} notes, all in the PRD's direction below: given once there).`);
    for (const line of ["Minimal chrome around photography", "Compact product header and primary navigation", "Photo grid"]) expect(count(text, line)).toBe(1);
  });

  it("2. keeps a note that overlaps the PRD but adds an instruction, whole and in the person's words", () => {
    const own = "Photo grid with four columns on desktop and two on phones";
    const notes = [...notesFrom(pageText), own, "Photo grid"];
    const { kept, repeated } = distinctNotes(notes, visualDirection([prd]));
    expect(kept).toEqual([own]);
    expect(repeated).toContain("Photo grid");
    const text = all(applied(notes));
    expect(text).toContain(`- ${own}`);
    expect(text).toMatch(/more of their notes repeat the PRD's direction word for word: given once, below\./);
  });

  it("3. keeps an explicit override, marks it, and ranks the person above the PRD", () => {
    const override = "A dense list of rows instead of the photo grid";
    const reqs = designDirectionContext(applied([...notesFrom(pageText), override]), [prd], 1600, "Gallery").requirements;
    const notesAt = reqs.findIndex((r) => r.startsWith("The person's own notes"));
    const prdAt = reqs.findIndex((r) => r.startsWith("Visual direction from the PRD"));
    expect(notesAt).toBeGreaterThan(-1);
    expect(notesAt).toBeLessThan(prdAt);
    expect(reqs[notesAt]).toContain("where they differ from the PRD's direction, follow the person");
    expect(reqs[notesAt]).toContain(`- ${override} (overrides the PRD's direction)`);
    expect(reqs[0]).toContain("Where the PRD's direction names other colours, fonts or shapes, the Look wins.");
  });

  it("4. states locked groups; a locked group's phrases don't become notes, and a note touching one says so", () => {
    // Read with colours locked: the colour phrases are kept as the Look has them, not turned into build notes.
    const reading = interpretDirection(pageText, BASE_APPEARANCE, ["colors"]);
    expect(reading.understood.filter((u) => u.group === "colors").every((u) => u.locked)).toBe(true);
    const own = "A thin cobalt rule under the gallery title";
    const text = all(applied([...notesFrom(pageText, ["colors"]), own], ["colors", "type"]));
    expect(text).toContain("Locked by the person: colours, typography. Keep these exactly as the Look sets them, whatever the PRD's direction or a note says about them.");
    expect(text).toContain(`- ${own} (colours locked: keep the Look's values; follow the rest)`);
  });

  it("gives a screen's step its own screen's section of the composition, and keeps the general lines", () => {
    const gallery = prdDirectionRequirement([prd], 1600, "Gallery");
    expect(gallery).toContain("### Gallery composition");
    expect(gallery).toContain("4. Photo grid.");
    expect(gallery).not.toContain("My Selection composition");
    expect(gallery).not.toContain("Selected photos and notes, or empty state");
    expect(gallery).toContain("Minimal chrome around photography.");
    // The PRD puts this in My Selection's section (it is about submitting): that screen's step gets it.
    expect(gallery).not.toContain("At phone width");
    expect(prdDirectionRequirement([prd], 1600, "My Selection")).toContain("At phone width, keep submission easy to find without obscuring content.");
    // A step for every screen (the frame) gets all of it.
    expect(prdDirectionRequirement([prd], 2400)).toContain("Selected photos and notes, or empty state");
    // A My Selection note isn't repeated on the Gallery step: the PRD gives it to My Selection's step.
    expect(all(applied(notesFrom(pageText)), "Gallery")).not.toContain("Selected photos and notes");
  });

  it("doesn't repeat a PRD line the step's objective already quotes, and keeps the ones it doesn't", () => {
    const objective = "The PRD's requirements for this screen:\n- R99 (Concept: Editorial contact sheet): Warm off-white background.\n- R109 (Gallery composition): Search and category controls.\n- R110 (Gallery composition): Photo grid.";
    const text = designDirectionContext(applied(notesFrom(pageText)), [prd], 1600, "Gallery", objective).requirements.join("\n\n");
    for (const quoted of ["Warm off-white background", "Search and category controls", "Photo grid"]) expect(count(`${objective}\n${text}`, quoted)).toBe(1);
    for (const kept of ["Near-black text.", "Minimal chrome around photography.", "1. Compact product header and primary navigation.", "Use available fonts and assets. Add no font package."]) expect(text).toContain(kept);
    expect(text).toContain("### Gallery composition");
    // Every line of a heading quoted elsewhere: the heading goes too.
    const allQuoted = `${objective}\n- R106: Compact product header and primary navigation.\n- R107: Gallery title, photographer, and selection progress.`;
    expect(designDirectionContext(applied([]), [prd], 1600, "Gallery", allQuoted).requirements.join("\n")).not.toContain("### Gallery composition");
  });
});
