/**
 * App wiring check: is what the agents built actually reachable from the app's entry point? Walks relative imports
 * from src/main.* and reports pages/components that nothing imports, and a starter placeholder left in App.tsx.
 * Catches the "every task verified, but the app still shows the starter screen" failure.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

const EXT = [".tsx", ".ts", ".jsx", ".js", ".mjs"];
const ENTRY = ["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js", "src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js"];
const UI_DIRS = /^src\/(components|pages|views|screens|features|routes)\//;
const PLACEHOLDER = /Start building here|Edit src\/App\.tsx|Vite \+ React|count is \{count\}/;

export interface AppWiring {
  entry?: string;
  reachable: number;
  unreachablePages: string[];
  unreachableComponents: string[];
  placeholder?: string;
  status: "passed" | "passed_with_warnings" | "failed" | "not_run";
  summary: string;
}

function resolveImport(root: string, from: string, spec: string): string | undefined {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const candidates = [base, ...EXT.map((e) => base + e), ...EXT.map((e) => `${base}/index${e}`)];
  // "./x.js" in TS source may point at x.ts
  if (/\.(m?js|jsx)$/.test(base)) candidates.push(...[".ts", ".tsx"].map((e) => base.replace(/\.(m?js|jsx)$/, e)));
  return candidates.find((c) => !c.startsWith("..") && fs.existsSync(path.join(root, c)) && fs.statSync(path.join(root, c)).isFile());
}

/** Every file reachable from the entry by relative imports (code and the CSS it imports). */
export function reachableFrom(root: string, entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    let src: string;
    try {
      src = fs.readFileSync(path.join(root, f), "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|import\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      const target = spec ? resolveImport(root, f, spec) : undefined;
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

/** The app's entry file (src/main.*, src/index.*), if it has one. */
export const entryOf = (root: string) => ENTRY.find((e) => fs.existsSync(path.join(root, e)));

export function analyzeAppWiring(jail: PathJail): AppWiring {
  const root = jail.root;
  const entry = ENTRY.find((e) => fs.existsSync(path.join(root, e)));
  if (!entry) return { reachable: 0, unreachablePages: [], unreachableComponents: [], status: "not_run", summary: "No src/main or src/index entry file" };
  const seen = reachableFrom(root, entry);
  const ui = flattenFiles(jail, 5000).filter((f) => UI_DIRS.test(f) && /\.(tsx|jsx)$/.test(f) && !/\.(test|spec|stories)\./.test(f));
  const unreachable = ui.filter((f) => !seen.has(f));
  const unreachablePages = unreachable.filter((f) => /^src\/(pages|views|screens|routes)\//.test(f));
  const unreachableComponents = unreachable.filter((f) => !unreachablePages.includes(f));
  const app = ["src/App.tsx", "src/App.jsx"].find((a) => fs.existsSync(path.join(root, a)));
  const placeholder = app ? PLACEHOLDER.exec(fs.readFileSync(path.join(root, app), "utf8"))?.[0] : undefined;
  const failed = !!placeholder || unreachablePages.length > 0 || (ui.length > 0 && unreachableComponents.length === ui.length);
  const status = failed ? "failed" : unreachableComponents.length ? "passed_with_warnings" : "passed";
  const parts = [
    placeholder ? `${app} still shows the starter placeholder ("${placeholder}")` : "",
    unreachablePages.length ? `${unreachablePages.length} page(s) not reachable from ${entry}: ${unreachablePages.slice(0, 6).join(", ")}` : "",
    unreachableComponents.length ? `${unreachableComponents.length} component(s) never imported: ${unreachableComponents.slice(0, 6).join(", ")}` : "",
  ].filter(Boolean);
  return {
    entry,
    reachable: seen.size,
    unreachablePages,
    unreachableComponents,
    placeholder,
    status,
    summary: parts.length ? parts.join("; ") : `All ${ui.length} pages/components are reachable from ${entry}`,
  };
}

/** The same screen under two file names (learn-coins.tsx and LearnCoinsScreen.tsx): kebab or Pascal, with or without "Screen". */
export const screenKey = (file: string) =>
  path.basename(file).replace(/\.(tsx|jsx|ts|js)$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(screen|page|view)$/, "");

/**
 * Leftover copies of a screen: a page file nothing reaches whose twin in the same folder (the same screen under another
 * name) is the one the app uses. Kids cash app: the plan made learn-coins.tsx, a later step made and wired
 * LearnCoinsScreen.tsx, and the leftover blocked the clean-up and the final assembly for hours.
 */
export function duplicateScreens(jail: PathJail): Array<{ file: string; twin: string }> {
  const root = jail.root;
  const entry = entryOf(root);
  if (!entry) return [];
  const seen = reachableFrom(root, entry);
  const pages = flattenFiles(jail, 5000).filter((f) => /^src\/(pages|views|screens|routes)\/[^/]+\.(tsx|jsx)$/.test(f) && !/\.(test|spec|stories)\./.test(f));
  const out: Array<{ file: string; twin: string }> = [];
  for (const f of pages) {
    if (seen.has(f)) continue;
    const twin = pages.find((o) => o !== f && seen.has(o) && path.posix.dirname(o) === path.posix.dirname(f) && screenKey(o) === screenKey(f));
    if (twin) out.push({ file: f, twin });
  }
  return out;
}
