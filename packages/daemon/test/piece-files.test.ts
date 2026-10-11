/**
 * A piece goes into an app with the pieces it's built from: the SaaS homepage template brings its hero block and the
 * Button, each at its src/sections/ name, with the imports pointed at those names.
 */
import { describe, expect, it } from "vitest";
import { pieceFiles, sectionFile } from "../src/orchestrator/sectionRecipes.js";

describe("pieceFiles", () => {
  it("brings a template's blocks and components, with imports pointed at the copied names", () => {
    const files = pieceFiles("home-saas");
    expect(files.map((f) => f.id)).toEqual(expect.arrayContaining(["home-saas", "hero-centered", "buttons-variants"]));
    const page = files.find((f) => f.id === "home-saas")!;
    expect(page.rel).toBe(sectionFile("home-saas"));
    expect(page.content).toContain('from "./HeroCentered"');
    expect(page.content).toContain('from "./ButtonsVariants"');
    expect(page.content).toContain('from "./icons"');
    // No import is left pointing at a library file name the app doesn't have.
    for (const f of files) expect(f.content).not.toMatch(/from "\.\/[a-z0-9]+(?:-[a-z0-9]+)+"/);
  });

  it("copies each piece once, even when two pieces import it", () => {
    const ids = pieceFiles("home-saas").map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
