/**
 * What a coding step must actually hand over. Two ways a step reported success without doing the work, both seen on the
 * Non-GMO brand finder build: it declared src/screens/NonGMOBrandsScreen.tsx in its plan and wrote only a test file, and
 * that test rendered its own markup instead of the app's, so it passed whatever the app did. The step's own acceptance
 * criteria were met both times, so these are checked separately before a step counts as verified.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";

const CODE_FILE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|vue|svelte|css|scss|pcss|html|json)$/i;
const TEST_FILE = /\.(test|spec)\.(tsx?|jsx?|mts|mjs)$/i;

export interface Deliverable {
  file: string;
  message: string;
}

/** A planned path that names one file, rather than a folder the step may fill with anything. */
const isFile = (p: string) => !p.endsWith("/") && CODE_FILE.test(p);

/**
 * Files the step's plan named and never created. The plan is what the person approved, so a step that quietly skips one
 * of its files isn't done: it either writes the file or reports a blocker saying why the plan was wrong. A path the step
 * renamed counts as missing too - the message names it, so the next attempt can say so.
 */
export function missingDeliverables(jail: PathJail, expectedPaths: readonly string[]): Deliverable[] {
  const wanted = expectedPaths.filter(isFile);
  if (!wanted.length) return [];
  return wanted
    .filter((p) => !fs.existsSync(path.join(jail.root, p)))
    .map((p) => ({
      file: p,
      message: `${p} is in this step's plan but was never written. Create it, or report a blocker explaining what the plan should say instead.`,
    }));
}

/** An import that reaches the app's own source rather than a package: "./x", "../x", "src/x", "@/x", "~/x". */
const OWN_SOURCE = /^(\.{1,2}\/|src\/|@\/|~\/)/;

/** Every module specifier the file imports, from static imports, `export … from`, `import()` and `require()`. */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\b(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\b(?:vi|jest)\s*\.\s*mock\s*\(\s*["']([^"']+)["']/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

/**
 * Tests that cannot fail for the right reason. A test file that imports nothing from the app renders its own markup and
 * asserts that it is there, so it passes whether or not the app works - it is not evidence that the step is done.
 * Comments are stripped first so a commented-out import doesn't count.
 */
export function hollowTests(jail: PathJail, files: Iterable<string>): Deliverable[] {
  const out: Deliverable[] = [];
  for (const rel of new Set([...files])) {
    if (!TEST_FILE.test(rel)) continue;
    let src: string;
    try {
      src = fs.readFileSync(path.join(jail.root, rel), "utf8");
    } catch {
      continue;
    }
    const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
    if (specifiers(code).some((s) => OWN_SOURCE.test(s))) continue;
    out.push({
      file: rel,
      message: `${rel} imports nothing from the app, so it passes whatever the app does. Import the screen or component this step built and assert against what it renders.`,
    });
  }
  return out;
}
