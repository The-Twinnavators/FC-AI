/** The Components sheet speaks the project's language: kit samples are reworded from its PRD or its screens. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localizeSample, readProjectWords } from "../src/workspace/projectWords.js";

const PRD = `# People need a way to: product requirements document (PRD)

## 1. Product summary

The product will be a simple list of trusted non-GMO brands.

## 4. Product promise

Help people make healthier choices quickly by providing a reliable list of non-GMO brands they can trust.

## 12. Main screens and screen responsibilities

| Screen | Responsibility |
| --- | --- |
| Home Screen | Show the list of trusted non-GMO brands |
| Brand Detail Screen | Show details about a specific non-GMO brand |

## 13. Functional requirements

**Must have**
- **R1** Show a list of trusted non-GMO brands (the user can: see them)

**Should have later**
- **R2** Allow users to filter brands by category or type (the user can: filter)
`;

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "fc-words-"));

describe("project words", () => {
  it("reads the main thing, list, promise, screens and features from a FlowCode PRD", () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, "spec"));
    fs.writeFileSync(path.join(root, "spec", "app-prd.md"), PRD);
    const w = readProjectWords(root)!;
    expect(w).toMatchObject({ noun: "brand", plural: "brands", listTitle: "Trusted non-GMO brands", screens: ["Home", "Brand detail"] });
    expect(w.tagline).toMatch(/^Help people make healthier choices/);
    expect(w.features).toEqual(["Filter brands by category or type"]);
  });

  it("falls back to screen file names without a PRD, and gives up when there's nothing to go on", () => {
    const root = tmp();
    expect(readProjectWords(root)).toBeUndefined();
    fs.mkdirSync(path.join(root, "src", "screens"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "screens", "RecipeListScreen.tsx"), "");
    expect(readProjectWords(root)).toMatchObject({ noun: "recipe", plural: "recipes" });
  });

  it("rewrites only the visible text of a kit sample, keeping classes and markup", () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, "spec"));
    fs.writeFileSync(path.join(root, "spec", "app-prd.md"), PRD);
    const w = readProjectWords(root)!;
    const hero = `<section class="ui-hero"><h1 class="ui-hero__title">Your week at a glance</h1><p>Three events today, the first at 09:00.</p><a class="ui-btn">Open calendar</a></section>`;
    const out = localizeSample(hero, w);
    expect(out).toContain(`<h1 class="ui-hero__title">Your brands at a glance</h1>`);
    expect(out).toContain("Help people make healthier choices");
    expect(out).toContain(`<a class="ui-btn">View brands</a>`);
    expect(localizeSample(`<p class="ui-empty">No events yet</p>`, w)).toBe(`<p class="ui-empty">No brands yet</p>`);
    expect(localizeSample(`<label>Event title</label><p>Shown on the calendar.</p>`, w)).toBe(`<label>Brand name</label><p>Shown in the trusted non-GMO brands list.</p>`);
  });
});
