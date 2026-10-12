// Ships the catalog components the starter's kit draws (templates/react-vite-starter/src/components/ui) inside the
// starter: each piece and every library piece it imports go to src/sections/<Pascal>.tsx exactly as FlowCode's library
// step copies them into an app, icons.tsx keeps its name, and src/styles/library.css holds only the library styles
// those files use. Run from the repo root after changing a catalog component the kit uses:
//   npx tsc -b packages/daemon && node scripts/starter-library.mjs
// packages/daemon/test/starter-library.test.ts fails when the starter's copies drift from the catalog.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STARTER = path.join(root, "templates/react-vite-starter");

/** The catalog pieces the kit's components are drawn with. */
export const STARTER_PIECES = [
  "buttons-variants",
  "cards-variants",
  "badges-status",
  "alerts-states",
  "modals-dialogs",
  "empty-states",
  "skeleton-loading",
  "card-kpi",
  "progress-indicators",
  "tables-states",
  "avatars-variants",
  "tabs-variants",
  "switches-states",
];

/**
 * Every file the starter gets, as { "src/sections/Button....tsx": text, "src/styles/library.css": text }. Takes the
 * daemon's pieceFiles and libraryStyles (built dist for this script, the TypeScript source in the test).
 */
export function starterLibraryFiles({ pieceFiles, libraryStyles }) {
  const files = {};
  const seen = new Set();
  for (const id of STARTER_PIECES) for (const f of pieceFiles(id, seen)) files[f.rel] = f.content;
  files["src/sections/icons.tsx"] = fs.readFileSync(path.join(root, "templates/library/sections/icons.tsx"), "utf8");
  // The same text FlowCode's sync builds from an app's src/sections/, so a fresh app's library.css is already current.
  const used = Object.values(files).join("\n");
  files["src/styles/library.css"] = libraryStyles(used);
  return files;
}

async function main() {
  const { pieceFiles, libraryStyles } = await import(pathToFileURL(path.join(root, "packages/daemon/dist/orchestrator/sectionRecipes.js")).href);
  const files = starterLibraryFiles({ pieceFiles, libraryStyles });
  // src/sections/ holds only these copies: anything else there is a piece the kit no longer uses.
  const sections = path.join(STARTER, "src/sections");
  fs.mkdirSync(sections, { recursive: true });
  let removed = 0;
  for (const f of fs.readdirSync(sections)) {
    if (!files[`src/sections/${f}`]) {
      fs.rmSync(path.join(sections, f), { recursive: true, force: true });
      removed++;
    }
  }
  let written = 0;
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(STARTER, rel);
    const now = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
    if (now === content) continue;
    fs.writeFileSync(abs, content);
    written++;
  }
  // The app loads the library's styles right after its tokens (the line FlowCode's library step looks for).
  const mainRel = path.join(STARTER, "src/main.tsx");
  const mainText = fs.readFileSync(mainRel, "utf8");
  if (!mainText.includes('import "./styles/library.css";')) {
    fs.writeFileSync(mainRel, mainText.replace(/(import "\.\/styles\/tokens\.css";\r?\n)/, '$1import "./styles/library.css";\n'));
    written++;
  }
  console.log(`starter library: ${Object.keys(files).length} file(s), ${written} written, ${removed} stale removed`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
