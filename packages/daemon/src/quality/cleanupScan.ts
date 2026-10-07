/**
 * Clean-up scan: what a build left behind that nothing uses. FlowCode lists the candidates itself, so the clean-up step
 * removes exactly those and nothing else, and the code_cleanup check proves they're gone.
 *  - files under src/ nothing imports (from the same import walk as the app wiring check);
 *  - scratch files in the project root (the first Calendar build left core-results.json, current-results.json,
 *    current-results-2.json and vitest-results.json there while reading test output);
 *  - debug calls (console.log, console.debug, debugger) in the app's own code;
 *  - CSS classes the app's own stylesheets define but no source file uses (advice, not a failure: a class can be
 *    built from parts at run time).
 * The starter kit's own files are never candidates: an unused building block is there for later steps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";
import { entryOf, reachableFrom } from "./appWiring.js";

export interface CleanupScan {
  unusedFiles: string[];
  strayFiles: string[];
  debugCalls: Array<{ file: string; line: number; text: string }>;
  unusedClasses: Array<{ file: string; cls: string }>;
  /** Pictures in public/ that nothing in the app refers to (left over from image searches). */
  unusedImages: string[];
  /** Credits (src/content/image-credits.json) for a picture listed twice, or for one that's gone or unused. */
  badCredits: Array<{ file: string; why: string }>;
}

const CREDITS_FILE = "src/content/image-credits.json";
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Paths the starter kit ships (src/components/ui/index.tsx, src/sim/index.ts, src/styles/tokens.css…). */
let kitPaths: Set<string> | undefined;
function starterPaths(): Set<string> {
  if (kitPaths) return kitPaths;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [process.env.FLOWCODE_TEMPLATES_DIR, path.resolve(here, "../../../../templates"), path.resolve(here, "../../../templates"), path.resolve(process.cwd(), "templates")].filter((x): x is string => !!x);
  for (const r of roots) {
    const dir = path.join(r, "react-vite-starter");
    if (!fs.existsSync(dir)) continue;
    const out = new Set<string>();
    const walk = (rel: string) => {
      for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(p);
        else out.add(p);
      }
    };
    walk("");
    return (kitPaths = out);
  }
  return (kitPaths = new Set());
}

const TEST_FILE = /(^|\/)(test|tests|__tests__|acceptance)\/|\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$/;
/** Root files a build may keep: the project's own config and docs. */
const ROOT_KEEP = /^(package(-lock)?\.json|tsconfig(\.[\w-]+)?\.json|vite\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s|eslint\.config\.[cm]?js|\.eslintrc(\.\w+)?|\.prettierrc(\.\w+)?|index\.html|README\.md|LICENSE(\.md)?|\.gitignore|\.npmrc|\.nvmrc|\.env\.example|components\.json)$/i;
/** Root files that are a tool's scratch output, not part of the project. */
const SCRATCH = /(^|[-_.])(results?|output|out|tmp|temp|scratch|debug|dump)([-_.\d]|$)|\.(log|out)$/i;

/** A file in the project root that is a tool's scratch output (vitest-results.json, debug.log). */
export const isRootScratch = (rel: string) => {
  const p = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  return !p.includes("/") && !ROOT_KEEP.test(p) && SCRATCH.test(p) && /\.(json|txt|log|out)$/i.test(p);
};

export function scanCleanup(jail: PathJail): CleanupScan {
  const root = jail.root;
  const kit = starterPaths();
  const files = flattenFiles(jail, 5000);
  const entry = entryOf(root);
  const reachable = entry ? reachableFrom(root, entry) : new Set<string>();

  const own = (f: string) => f.startsWith("src/") && !kit.has(f) && !TEST_FILE.test(f);
  const unusedFiles = entry ? files.filter((f) => own(f) && /\.(tsx?|jsx?|mjs|css)$/.test(f) && !reachable.has(f)) : [];

  const strayFiles = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && isRootScratch(e.name))
    .map((e) => e.name);

  const debugCalls: CleanupScan["debugCalls"] = [];
  // Every file the app runs (App.tsx starts as a kit file but is the build's own), except the kit's building blocks.
  for (const f of files.filter((x) => x.startsWith("src/") && !TEST_FILE.test(x) && !/^src\/components\/ui\//.test(x) && /\.(tsx?|jsx?)$/.test(x) && reachable.has(x))) {
    fs.readFileSync(path.join(root, f), "utf8")
      .split(/\r?\n/)
      .forEach((l, i) => {
        if (/^\s*\/\//.test(l)) return;
        if (/\bconsole\.(log|debug|trace)\s*\(|^\s*debugger\s*;?\s*$/.test(l)) debugCalls.push({ file: f, line: i + 1, text: l.trim().slice(0, 120) });
      });
  }

  const source = files
    .filter((f) => f.startsWith("src/") && /\.(tsx?|jsx?)$/.test(f) && !TEST_FILE.test(f))
    .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
    .join("\n");
  const unusedClasses: CleanupScan["unusedClasses"] = [];
  for (const f of files.filter((x) => own(x) && x.endsWith(".css"))) {
    const css = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const defined = new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)(?=[^{}]*\{)/g)].map((m) => m[1]));
    // A modifier built from parts (`calendar-grid--${view}`) counts as used when its "block--" prefix is in the source.
    const builtFromParts = (cls: string) => cls.includes("--") && source.includes(`${cls.slice(0, cls.lastIndexOf("--"))}--$`);
    for (const cls of defined) if (!source.includes(cls) && !builtFromParts(cls)) unusedClasses.push({ file: f, cls });
  }
  // Pictures: used when the app's code, styles or page name the file (credits don't count as use).
  const uses = [
    source,
    ...files.filter((f) => f.startsWith("src/") && f.endsWith(".css")).map((f) => fs.readFileSync(path.join(root, f), "utf8")),
    fs.existsSync(path.join(root, "index.html")) ? fs.readFileSync(path.join(root, "index.html"), "utf8") : "",
  ].join("\n");
  const images = files.filter((f) => f.startsWith("public/") && IMAGE.test(f) && !/^public\/(favicon|icons?\/|apple-touch|og-image)/.test(f));
  const used = (f: string) => uses.includes(f.replace(/^public/, "")) || uses.includes(path.posix.basename(f));
  const unusedImages = images.filter((f) => !used(f));

  const badCredits: CleanupScan["badCredits"] = [];
  try {
    const credits = JSON.parse(fs.readFileSync(path.join(root, CREDITS_FILE), "utf8")) as Array<{ file?: string; title?: string }>;
    const seen = new Map<string, number>();
    credits.forEach((c, i) => c.file && seen.set(c.file, (seen.get(c.file) ?? 0) + 1));
    const reported = new Set<string>();
    for (const c of credits) {
      if (!c.file || reported.has(c.file)) continue;
      const rel = `public${c.file}`;
      const why = (seen.get(c.file) ?? 0) > 1 ? `listed ${seen.get(c.file)} times: keep only the entry for the picture that's there now` : !fs.existsSync(path.join(root, rel)) ? "the picture no longer exists: remove its credit" : !used(rel) ? "nothing in the app uses this picture: remove the picture and its credit" : "";
      if (why) {
        badCredits.push({ file: c.file, why });
        reported.add(c.file);
      }
    }
  } catch {
    /* no credits file */
  }
  return { unusedFiles, strayFiles, debugCalls: debugCalls.slice(0, 30), unusedClasses: unusedClasses.slice(0, 40), unusedImages: unusedImages.slice(0, 40), badCredits: badCredits.slice(0, 40) };
}

/** What must go for the clean-up to pass (unused CSS classes are advice). */
export const cleanupBlocking = (s: CleanupScan) => s.unusedFiles.length + s.strayFiles.length + s.debugCalls.length + (s.unusedImages?.length ?? 0) + (s.badCredits?.length ?? 0);

/** The scan as instructions for the clean-up step. */
export function cleanupReport(s: CleanupScan): string {
  const parts = [
    s.unusedFiles.length ? `Files nothing imports (delete each with delete_file after confirming with search_code that nothing uses it):\n${s.unusedFiles.map((f) => `- ${f}`).join("\n")}` : "",
    s.strayFiles.length ? `Scratch files in the project root, not part of the app (delete them):\n${s.strayFiles.map((f) => `- ${f}`).join("\n")}` : "",
    s.debugCalls.length ? `Debug calls to remove:\n${s.debugCalls.map((d) => `- ${d.file}:${d.line} ${d.text}`).join("\n")}` : "",
    s.unusedImages?.length ? `Pictures nothing in the app uses (delete each with delete_file):\n${s.unusedImages.map((f) => `- ${f}`).join("\n")}` : "",
    s.badCredits?.length ? `Photo credits to fix in ${CREDITS_FILE} (the credits must match the pictures the app shows):\n${s.badCredits.map((c) => `- ${c.file}: ${c.why}`).join("\n")}` : "",
    s.unusedClasses.length ? `CSS classes no source file uses (remove the rules for those that really are unused; keep any built from parts at run time):\n${s.unusedClasses.map((c) => `- .${c.cls} (${c.file})`).join("\n")}` : "",
  ].filter(Boolean);
  return parts.length ? `FlowCode's clean-up scan found:\n${parts.join("\n\n")}` : "FlowCode's clean-up scan found nothing to remove.";
}
