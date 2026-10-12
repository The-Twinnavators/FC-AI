/**
 * The starter's kit draws the catalog's components, shipped in templates/react-vite-starter/src/sections/ with their
 * styles in src/styles/library.css (written by scripts/starter-library.mjs). These must stay the catalog's own copies:
 * a catalog change without re-running the script would leave every new app on the old component.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { libraryStyles, pieceFiles } from "../src/orchestrator/sectionRecipes.js";
// @ts-expect-error: a plain Node script without type declarations.
import { STARTER, starterLibraryFiles } from "../../../scripts/starter-library.mjs";

const lf = (s: string) => s.replace(/\r\n/g, "\n");
const FIX = "run `npx tsc -b packages/daemon && node scripts/starter-library.mjs`";

describe("the starter ships the catalog's components as they are", () => {
  const want = starterLibraryFiles({ pieceFiles, libraryStyles }) as Record<string, string>;

  it(`src/sections/ and src/styles/library.css match the catalog (${FIX})`, () => {
    const stale = Object.entries(want)
      .filter(([rel, text]) => {
        const abs = path.join(STARTER, rel);
        return !fs.existsSync(abs) || lf(fs.readFileSync(abs, "utf8")) !== lf(text);
      })
      .map(([rel]) => rel);
    expect(stale).toEqual([]);
  });

  it(`src/sections/ holds nothing else (${FIX})`, () => {
    const extra = fs
      .readdirSync(path.join(STARTER, "src/sections"))
      .map((f) => `src/sections/${f}`)
      .filter((rel) => !(rel in want));
    expect(extra).toEqual([]);
  });

  it("the app loads the library's styles right after its tokens", () => {
    expect(lf(fs.readFileSync(path.join(STARTER, "src/main.tsx"), "utf8"))).toContain('import "./styles/tokens.css";\nimport "./styles/library.css";\n');
  });
});
