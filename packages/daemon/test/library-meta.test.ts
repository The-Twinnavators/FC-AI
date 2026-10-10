/**
 * Every library piece says what it's for, in the words FlowCode matches a PRD against: use cases, jobs to be done and
 * keywords, in the catalog and in a header block at the top of its file (written by scripts/library-meta.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_SECTIONS, PROPOSED_SECTIONS, SECTION_CATEGORIES, metaBlock } from "@flowcode/contracts";

// Pieces on the approval shelf carry the same block, so approving one is only a move between lists.
const ALL = [...LIBRARY_SECTIONS, ...PROPOSED_SECTIONS];

const dir = path.resolve(__dirname, "../../../templates/library/sections");

describe("library pieces say what they're for", () => {
  it("every piece has use cases, jobs to be done and keywords in the catalog", () => {
    const thin = ALL.filter((s) => (s.useCases?.length ?? 0) < 3 || (s.jobs?.length ?? 0) < 2 || s.tags.length < 2).map((s) => s.id);
    expect(thin).toEqual([]);
  });

  it("every piece's file starts with the same block as the catalog (run node scripts/library-meta.mjs after changing it)", () => {
    const stale = ALL.filter((s) => {
      const file = path.join(dir, `${s.id}.tsx`);
      if (!fs.existsSync(file)) return true;
      const label = SECTION_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category;
      return !fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").startsWith(`${metaBlock(s, label)}\n`);
    }).map((s) => s.id);
    expect(stale).toEqual([]);
  });
});
