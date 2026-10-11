/**
 * Ready-made screen layouts: every version a recipe offers must exist on disk, and a screen people browse must get
 * the list layout. Without a list recipe the runtime had no layout for a browse screen and fell through to the
 * keyword picker, which seeded a Non-GMO brand finder's "Brands" screen with a chip state specimen.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUTS, layoutsDir } from "../src/orchestrator/layoutRecipes.js";

const KIT = /from "\.\.\/components\/ui"/;

describe("every layout a recipe offers", () => {
  // File shape, kit imports, sample markers and token rules are asserted in prompt-skill-system.test.ts.
  it("picks a version that it actually offers", () => {
    for (const kind of LAYOUTS) {
      const ids = kind.versions.map((v) => v.id);
      for (const text of ["", "a simple app", "orders table with status and owner", "browse brands and products"]) {
        expect(ids, `${kind.kind} picked an unknown version for "${text}"`).toContain(kind.pick(text));
      }
    }
  });

  it("has a file for every version", () => {
    for (const kind of LAYOUTS) {
      for (const v of kind.versions) {
        expect(fs.existsSync(path.join(layoutsDir(), `${v.id}.tsx`)), `${kind.kind}/${v.id}`).toBe(true);
      }
    }
  });
});
describe("a screen people browse", () => {
  const list = LAYOUTS.find((l) => l.kind === "list")!;

  it("is recognised by the words a spec uses for it", () => {
    for (const text of [
      "a list of trusted non-GMO brands",
      "Browse the product catalog",
      "A directory of local suppliers",
      "search results page",
      "the community feed",
    ]) {
      expect(list.wanted.test(text), `not matched: "${text}"`).toBe(true);
    }
  });

  it("does not claim screens that belong to another recipe", () => {
    for (const text of ["the settings screen", "sign in with an email and password", "pricing plans"]) {
      expect(list.wanted.test(text), `wrongly matched: "${text}"`).toBe(false);
    }
  });

  it("gives records a table and things a card each", () => {
    expect(list.pick("Requests with a status, an owner and a due date, sorted by most recently updated")).toBe("list-rows");
    expect(list.pick("Busy parents browse trusted non-GMO brands to choose from")).toBe("list-cards");
  });
});
