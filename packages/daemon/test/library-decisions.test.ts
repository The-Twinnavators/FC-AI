/**
 * Accept and Decline on the Component library's approval shelf (workspace/libraryDecisions.ts): Accept moves a piece's
 * catalog entry into the library and dates it; Decline removes the entry, the piece's file and its relations.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideProposed } from "../src/workspace/libraryDecisions.js";

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-lib-"));
  fs.mkdirSync(path.join(root, "packages/contracts/src"), { recursive: true });
  fs.mkdirSync(path.join(root, "templates/library/sections"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "packages/contracts/src/sectionLibrary.ts"),
    [
      "export const LIBRARY_SECTIONS: LibrarySection[] = [",
      '  { id: "old-piece", ref: "c.old" },',
      "];",
      "export const PROPOSED_SECTIONS: LibrarySection[] = [",
      '  { id: "chart-bar", ref: "c.bar-chart" },',
      '  { id: "video-grid", ref: "p.video-grid" },',
      "];",
      "export const ADDED_ON: Record<string, string> = {",
      '  "old-piece": "2026-10-01",',
      "};",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(root, "packages/contracts/src/catalogRelations.ts"), ['export const RELATIONS = {', '  "p.video-grid": { provides: ["media"] },', '  "c.old": { provides: ["x"] },', "};"].join("\n"));
  for (const f of ["chart-bar", "video-grid"]) fs.writeFileSync(path.join(root, "templates/library/sections", `${f}.tsx`), "// piece\n");
  return root;
}

describe("library approval shelf decisions", () => {
  it("accept moves the entry into the library and dates it", () => {
    const root = repo();
    decideProposed(root, "chart-bar", "accept", "2026-10-21", false);
    const s = fs.readFileSync(path.join(root, "packages/contracts/src/sectionLibrary.ts"), "utf8");
    const lib = s.slice(s.indexOf("LIBRARY_SECTIONS"), s.indexOf("PROPOSED_SECTIONS"));
    const shelf = s.slice(s.indexOf("PROPOSED_SECTIONS"), s.indexOf("ADDED_ON"));
    expect(lib).toContain('id: "chart-bar"');
    expect(shelf).not.toContain("chart-bar");
    expect(s).toContain('"chart-bar": "2026-10-21"');
    expect(fs.existsSync(path.join(root, "templates/library/sections/chart-bar.tsx"))).toBe(true);
  });

  it("decline removes the entry, the file and its relations, and leaves the rest", () => {
    const root = repo();
    decideProposed(root, "video-grid", "decline", "2026-10-21", false);
    const s = fs.readFileSync(path.join(root, "packages/contracts/src/sectionLibrary.ts"), "utf8");
    expect(s).not.toContain("video-grid");
    expect(s).toContain('id: "chart-bar"');
    expect(fs.existsSync(path.join(root, "templates/library/sections/video-grid.tsx"))).toBe(false);
    const rel = fs.readFileSync(path.join(root, "packages/contracts/src/catalogRelations.ts"), "utf8");
    expect(rel).not.toContain("p.video-grid");
    expect(rel).toContain('"c.old"');
  });

  it("refuses a piece that isn't on the shelf, and odd ids", () => {
    const root = repo();
    expect(() => decideProposed(root, "old-piece", "decline", "2026-10-21", false)).toThrow(/isn't waiting/);
    expect(() => decideProposed(root, "../x", "accept", "2026-10-21", false)).toThrow(/Not a piece id/);
  });
});
