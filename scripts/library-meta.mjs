// Writes each library piece's use cases, jobs to be done and keywords from the catalog (packages/contracts
// sectionLibrary.ts, built to dist) into a header block at the top of its file, so the piece carries what it's for
// into every app it's copied into. Run after changing the catalog: `npm run build -w @flowcode/contracts` then
// `node scripts/library-meta.mjs`. The test library-meta.test.ts fails when a file and the catalog disagree.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_SECTIONS, PROPOSED_SECTIONS, SECTION_CATEGORIES } from "../packages/contracts/dist/index.js";
import { metaBlock, META_START } from "../packages/contracts/dist/libraryMeta.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "templates/library/sections");
let changed = 0;
// The shelf's pieces carry the same block, so approving one changes nothing about it.
const all = [...LIBRARY_SECTIONS, ...PROPOSED_SECTIONS];
for (const s of all) {
  const file = path.join(dir, `${s.id}.tsx`);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  // Replace an existing block, or put one first.
  const start = text.indexOf(META_START);
  const rest = start === 0 ? text.slice(text.indexOf("*/", start) + 2).replace(/^\r?\n/, "") : text;
  const next = `${metaBlock(s, SECTION_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category)}\n${rest}`;
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed++;
  }
}
console.log(`library meta: ${changed} file(s) updated, ${LIBRARY_SECTIONS.length} in the catalog and ${PROPOSED_SECTIONS.length} awaiting approval`);
