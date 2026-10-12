/**
 * Builds assemble screens from FlowCode's catalog: interface steps get the catalog as one line per part, the agent
 * adds a part with add_library_piece (which finds the piece a catalog ID names and the import line for it), and the
 * library step no longer guesses an app's screen count from the words in its PRD.
 */
import { describe, expect, it } from "vitest";
import { catalogBrief, catalogPiece, pickSections, pieceImport } from "../src/orchestrator/sectionRecipes.js";

describe("catalogPiece", () => {
  it("finds the file that implements a component, from its ID or a variant's", () => {
    expect(catalogPiece("c.button")?.id).toBe("buttons-variants");
    expect(catalogPiece("c.button.primary")?.id).toBe("buttons-variants");
    expect(catalogPiece("hero-split")?.ref).toBe("b.hero-split");
  });

  it("brings a pattern's implementation, not a wrapper that shares one of its variant IDs", () => {
    expect(catalogPiece("p.side-nav")?.id).toBe("sidebar-nav-variants");
  });

  it("finds nothing for a name the catalog doesn't have", () => {
    expect(catalogPiece("c.teleporter")).toBeUndefined();
  });

  it("gives the import line an app uses from src/screens/", () => {
    expect(pieceImport(catalogPiece("c.button")!)).toBe('import { Button } from "../sections/ButtonsVariants";');
  });
});

describe("catalogBrief", () => {
  const brief = catalogBrief("Home screen: brand list with search, filter by category and type, sort by trust; brand detail page");

  it("lists the core components and the patterns that fit the step, and says how to add them", () => {
    expect(brief).toContain("add_library_piece");
    expect(brief).toContain("- c.button:");
    expect(brief).toContain("- c.text-field:");
    expect(brief).toMatch(/- p\.(filter-panel|filterable-list|resource-table):/);
  });

  it("stays small enough for a local model's context", () => {
    expect(brief.length).toBeLessThanOrEqual(3800);
  });
});

describe("pickSections and the app's screens", () => {
  it("doesn't add a sidebar from the words in a PRD when the screen count isn't known", () => {
    const prd = "Two screens: a Home screen and a Brand detail screen. Each screen shows a page title. The page lists brands; the detail page shows one. Tabs on the page switch views.";
    expect(pickSections(prd).some((p) => p.id.startsWith("sidebar-"))).toBe(false);
  });

  it("adds one when the app really has several screens", () => {
    expect(pickSections("A budgeting app: Home, Spending, Budgets, Goals, Settings", "", 5).some((p) => p.id.startsWith("sidebar-"))).toBe(true);
  });
});
