/**
 * Guards that keep a run from wasting attempts on avoidable mistakes:
 *  - alignCheckNames: plan checks must use the project's real CSS custom property names. An invented name
 *    ("--accent-color" in a project that has "--color-accent") is mapped to the real one, or the check is dropped.
 *  - editGuard: refuses an edit that rewrites a large file to change a few lines, or that declares the same CSS
 *    custom property twice in one block. The refusal tells the agent exactly what to do instead.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parseCustomProperties } from "../workspace/styleTokens.js";
import { locatePatch } from "../workspace/operations.js";
import { flattenFiles } from "../workspace/fileService.js";
import { isReferencePath } from "../quality/tokens.js";
import type { PathJail } from "../security/pathJail.js";

const words = (name: string) => name.replace(/^--/, "").toLowerCase().split(/[-_]+/).filter(Boolean);

/** The real token an invented name most likely means, or undefined when nothing is close. */
export function closestToken(name: string, known: Iterable<string>): string | undefined {
  const want = words(name);
  const wantKey = [...want].sort().join("-");
  let best: { name: string; score: number } | undefined;
  for (const k of known) {
    const have = words(k);
    if ([...have].sort().join("-") === wantKey) return k; // same words, different order: --accent-color → --color-accent
    const shared = want.filter((w) => have.includes(w)).length;
    const score = shared / new Set([...want, ...have]).size;
    if (score > (best?.score ?? 0)) best = { name: k, score };
  }
  return best && best.score >= 0.6 ? best.name : undefined;
}

/**
 * Fixes a plan check's text against the project's real token names.
 * Returns the (possibly corrected) text and a note, or drop=true when it names a token that doesn't exist and the
 * request didn't ask to create it.
 */
export function alignCheckNames(text: string, path: string, known: Set<string>, objective: string): { text: string; note?: string; drop?: boolean } {
  let t = text.trim();
  const notes: string[] = [];
  // `var(--x, teal)` is how a value is used, not how a token is set: check the declaration instead.
  const fallback = /^var\(\s*(--[\w-]+)\s*,\s*([^)]+?)\s*\)$/.exec(t);
  if (fallback && /\.(css|scss|pcss)$/i.test(path)) {
    t = `${fallback[1]}: ${fallback[2]}`;
    notes.push(`checks the declaration "${t}" instead of "${text.trim()}"`);
  }
  const asked = objective.toLowerCase();
  for (const name of [...new Set(t.match(/--[a-zA-Z][\w-]*/g) ?? [])]) {
    if (known.has(name) || asked.includes(name.toLowerCase())) continue;
    const real = closestToken(name, known);
    if (!real) return { text: t, drop: true, note: `"${name}" isn't a token in this project` };
    t = t.split(name).join(real);
    notes.push(`uses the project's token ${real} (the plan said ${name})`);
  }
  return { text: t, note: notes.length ? notes.join("; ") : undefined };
}

/** Text with all whitespace removed, for "contains" checks that shouldn't depend on spacing. */
export const squash = (s: string) => s.replace(/\s+/g, "");

/** Applies apply_patch edits in memory (first occurrence), or undefined when a find text isn't there. */
function simulatePatch(before: string, edits: Array<{ find: string; replace: string; line?: number }>): string | undefined {
  return afterEdit("apply_patch", before, { edits });
}

/** CSS custom properties declared more than once in the same block. */
function duplicateDeclarations(css: string): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  for (const d of parseCustomProperties(css)) {
    const key = `${d.selectors.join(" › ")}|${d.name}`;
    seen.set(key, [...(seen.get(key) ?? []), d.line]);
  }
  return new Map([...seen].filter(([, lines]) => lines.length > 1));
}

/**
 * Checks a file edit before it is applied. Returns a message to send back to the agent instead of applying it, or
 * undefined when the edit is fine.
 */
export function editGuard(tool: "apply_patch" | "replace_file", path: string, before: string | undefined, args: Record<string, unknown>, opts: { patchMisses: number }): string | undefined {
  if (before === undefined) return undefined; // new file: nothing to compare against
  const after = tool === "replace_file" ? String(args.content ?? "") : simulatePatch(before, (args.edits as Array<{ find: string; replace: string }>) ?? []);
  if (after === undefined) return undefined; // the operation itself reports a missed patch

  if (tool === "replace_file") {
    const oldLines = before.split("\n");
    const newLines = after.split("\n");
    const oldSet = new Set(oldLines.map((l) => l.trim()));
    const changed = newLines.filter((l) => !oldSet.has(l.trim())).length + Math.max(0, oldLines.length - newLines.length);
    // A large file rewritten to change a handful of lines: slow to write and easy to damage. Patch those lines instead.
    // Not after two missed patches on the file: then a rewrite is the way out (Calendar test 6: a 140-line file whose
    // patches kept missing and whose rewrite was refused).
    if (!(opts.patchMisses >= 2 && changed > 3) && oldLines.length > 120 && changed <= Math.max(12, oldLines.length * 0.15)) {
      const sample = newLines.filter((l) => !oldSet.has(l.trim())).slice(0, 3).map((l) => l.trim()).filter(Boolean);
      return `Not applied: this rewrites all ${oldLines.length} lines of ${path} to change about ${changed}. Use apply_patch with just the lines that change${opts.patchMisses ? ": read_file first and copy the find text exactly from it (including spaces), with one or two neighbouring lines so it is unique" : ""}.${sample.length ? ` The lines you want: ${sample.map((l) => `\`${l.slice(0, 80)}\``).join(", ")}.` : ""}`;
    }
  }

  if (tool === "apply_patch") {
    const again = reinsertion(before, (args.edits as Array<{ find: string; replace: string; line?: number }>) ?? []);
    if (again) return again;
  }

  // A second top-level `const screens = …` (or function/class of the same name): the model re-adding a block instead
  // of changing the one that is there. The app then fails to compile ("Identifier has already been declared").
  if (/\.(tsx?|jsx?)$/i.test(path)) {
    const dupes = (src: string) => {
      const seen = new Map<string, number>();
      for (const m of src.matchAll(/^(?:export\s+)?(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
      return seen;
    };
    const had = dupes(before);
    for (const [name, n] of dupes(after)) {
      if (n < 2 || (had.get(name) ?? 0) >= n) continue;
      return `Not applied: this would declare \`${name}\` ${n} times at the top level of ${path}, which doesn't compile ("already declared"). Change the existing \`${name}\` instead of adding another one (put the current declaration in find).`;
    }
  }

  if (/\.(css|scss|pcss)$/i.test(path)) {
    const had = duplicateDeclarations(before);
    for (const [key, lines] of duplicateDeclarations(after)) {
      if ((had.get(key)?.length ?? 0) >= lines.length) continue;
      const [selector, name] = key.split("|");
      return `Not applied: ${name} would be declared ${lines.length} times in the same block (${selector || "top level"}, lines ${lines.join(", ")}). Change the existing ${name} line instead of adding another one.`;
    }
    const hadRules = repeatedDeclarations(before);
    for (const [key, n] of repeatedDeclarations(after)) {
      if ((hadRules.get(key) ?? 0) >= n) continue;
      const [selector, decl] = key.split("|");
      return `Not applied: \`${decl}\` would appear ${n} times in \`${selector}\`. It is already there: change that block's existing lines (put the block as it is now in find) instead of adding them again.`;
    }
  }
  return undefined;
}

/**
 * Building blocks live in one index file (src/components/ui/index.tsx, plus screen-parts.tsx it re-exports). Models
 * guess per-component files ("../components/ui/AppShell") or a path that doesn't resolve from the file's folder; the
 * build then fails on the import. Returns the exact import to use instead, or undefined when the imports are fine.
 */
/** The starter's building blocks (src/components/ui), to recognise imports of them from a made-up package. */
const KIT_NAMES = new Set(["AppShell", "PageHeader", "Section", "Card", "Button", "Field", "EmptyState", "Skeleton", "Stat", "Badge", "Notice", "Dialog", "Grid", "Trend", "Progress", "BarChart", "DataTable", "Checklist", "Avatar", "ActivityList", "Hero", "ActionTile", "Tabs", "SettingsList", "SettingRow", "Switch"]);

export function buildingBlockImports(file: string, text: string): string | undefined {
  if (!/\.(tsx|jsx|ts|js)$/.test(file) || !file.startsWith("src/") || file.startsWith("src/components/ui/")) return undefined;
  const dir = file.split("/").slice(0, -1);
  const resolve = (spec: string) => {
    const parts = [...dir];
    for (const seg of spec.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== ".") parts.push(seg);
    }
    return parts.join("/");
  };
  const toUi = (() => {
    const target = ["src", "components", "ui"];
    let common = 0;
    while (common < dir.length && common < target.length && dir[common] === target[common]) common++;
    const up = dir.length - common;
    const rest = target.slice(common).join("/");
    return `${up ? "../".repeat(up) : "./"}${rest}`.replace(/\/$/, "");
  })();
  const bad: string[] = [];
  const names = new Set<string>();
  for (const m of text.matchAll(/import\s+([^;]+?)\s+from\s+["']([^"']+)["']/g)) {
    const spec = m[2];
    // A package-style path for the building blocks ("@flowcode/ui", "@/components/ui", "components/ui"): no such
    // package exists, they are a local folder (Calendar test 4 lost 45 minutes to `from "@flowcode/ui"`).
    if (!spec.startsWith(".") && /(^|\/)ui(\/[\w-]+)?$|components\/ui/.test(spec)) {
      const imported = m[1].replace(/[{}]/g, " ").split(/[\s,]+/).filter((n) => /^[A-Z]\w*$/.test(n));
      if (imported.some((n) => KIT_NAMES.has(n))) {
        bad.push(m[0].trim());
        for (const n of imported) names.add(n);
      }
      continue;
    }
    if (!/components\/ui|(^|\/)ui(\/|$)/.test(spec) || !spec.startsWith(".")) continue;
    const target = resolve(spec);
    const ok = target === "src/components/ui" || target === "src/components/ui/index" || target === "src/components/ui/screen-parts";
    if (ok) continue;
    // Only imports that point at a building-block path, right or wrong.
    if (!/components\/ui(\/|$)/.test(target) && !/(^|\/)ui\/[A-Z]\w*$/.test(target)) continue;
    bad.push(m[0].trim());
    for (const n of m[1].replace(/[{}]/g, " ").split(/[\s,]+/)) if (/^[A-Z]\w*$/.test(n)) names.add(n);
    const last = target.split("/").pop() ?? "";
    if (/^[A-Z]\w*$/.test(last)) names.add(last);
  }
  if (!bad.length) return undefined;
  // Names from other UI libraries (shadcn's DialogContent, DialogHeader…) aren't in the kit: say so, and how the
  // kit's version works, or the model keeps resending them (Calendar test 6, Event Creation Dialog).
  const missing = [...names].filter((n) => !KIT_NAMES.has(n));
  if (missing.length) {
    const usage = /^Dialog/.test(missing.join(" ")) ? ` The kit's Dialog is one component: <Dialog open={open} title="New event" onClose={close} actions={<><Button onClick={close}>Cancel</Button><Button variant="primary" type="submit">Save</Button></>}>…form fields…</Dialog>.` : "";
    return `Not applied: ${missing.join(", ")} ${missing.length === 1 ? "isn't a building block" : "aren't building blocks"} in this project (they come from another UI library). Use only: ${[...KIT_NAMES].join(", ")}.${usage} Import from "${toUi}".`;
  }
  return `Not applied: ${bad.length === 1 ? "this import doesn't" : "these imports don't"} resolve: ${bad.slice(0, 3).map((b) => `\`${b.slice(0, 90)}\``).join(", ")}. Every building block comes from one file (named exports, no per-component files). From ${file} use exactly: import { ${[...names].join(", ") || "AppShell, PageHeader, Button"} } from "${toUi}";`;
}

/**
 * In a TypeScript React project, a planned src/… .js/.jsx file becomes .tsx (components, screens, pages, anything
 * capitalised) or .ts (other code). Config files at the root ("vite.config.js") are left alone.
 */
export function toTsPath(p: string): string {
  const m = /^(src\/.+?)\.jsx?$/.exec(p.replace(/\\/g, "/"));
  if (!m) return p;
  const base = m[1].split("/").pop() ?? "";
  return /\/(components|screens|pages|views)\//.test(`${m[1]}/`) || /^[A-Z]/.test(base) || p.endsWith(".jsx") ? `${m[1]}.tsx` : `${m[1]}.ts`;
}

/**
 * Lines the model copied from redacted context ("handlePasswordReset = [REDACTED] () => {") put back to the file's real
 * line, when exactly one line of `current` matches with each [REDACTED] standing for some text. Lines with no unique
 * match stay as they are (Calendar test 8: notes from earlier attempts kept showing the redacted line, and every patch
 * copied from them missed).
 */
export function unredactLines(text: string, current: string): string {
  if (!text.includes("[REDACTED]")) return text;
  const lines = current.replace(/\r\n/g, "\n").split("\n");
  return text
    .split("\n")
    .map((l) => {
      if (!l.includes("[REDACTED]")) return l;
      const re = new RegExp(`^\\s*${l.trim().split("[REDACTED]").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+?")}\\s*$`);
      const hits = [...new Set(lines.filter((c) => re.test(c)))];
      if (hits.length !== 1) return l;
      // Keep the model's indentation; take the rest from the file.
      return (/^\s*/.exec(l)?.[0] ?? "") + hits[0].trim();
    })
    .join("\n");
}

/**
 * What the building-block kit already does for a step's subject, checked against the app's own CSS (never assumed).
 * A step like "visible focus ring" is often finished by the kit; without this the coder read for three attempts,
 * looking for a Button.tsx that doesn't exist, and never concluded it was done (Calculator test 1).
 */
const KIT_FACTS: Array<{ about: RegExp; proof: RegExp; spoiler?: RegExp; fact: string }> = [
  {
    about: /focus[\s-](?:ring|indicator|outline|visible|style)|:focus\b|keyboard[\s-](?:focus|navigation|navigable)|tab order/i,
    proof: /:focus-visible\s*\{[^}]*(?:outline|box-shadow)/,
    fact: "The kit already draws a visible focus ring on every control (src/styles/app.css :focus-visible, and .ui-btn/.ui-input/.ui-switch :focus-visible in the kit's CSS). Buttons, inputs and links built from the kit or plain HTML controls get it automatically. Only add a rule for a custom element you made focusable yourself (tabIndex) that has no ring. If there is none, this part is done: say so and call task_complete.",
  },
  {
    about: /reduce[ds]? motion|prefers-reduced-motion|motion (?:sensitivity|preference)/i,
    proof: /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    fact: "The kit already respects reduced motion (@media (prefers-reduced-motion: reduce) in src/styles/app.css and the kit's CSS). Only animations you add yourself need the same media query.",
  },
  {
    about: /text scaling|scal(?:e|ing) text|200\s*%|text (?:size|zoom)|zoom(?:ed)? to|browser zoom|resiz(?:e|able|ing) text/i,
    proof: /--(?:text|type)-[\w-]*(?:size|md|sm|lg)?\s*:\s*[\d.]+rem/,
    spoiler: /font-size\s*:\s*\d+(?:\.\d+)?px|fontSize\s*:\s*(?:\d|["']\d+(?:\.\d+)?px)/i,
    fact: "Text sizes, control heights and spacing are tokens in rem (src/styles/tokens.css), so they grow with the browser's text size and zoom. Only sizes written in px in your own screens or CSS don't scale: use the tokens or rem there. If your screens use the tokens, this is done: say so and call task_complete.",
  },
  {
    // Calculator app: the worker was registered from src/, the dev server answered with the HTML page, and the
    // preview check failed ("unsupported MIME type ('text/html')").
    about: /offline|service ?worker|\bpwa\b|installable|web app manifest/i,
    proof: /[\s\S]/,
    fact: "A service worker must be served as a plain JS file: put it in public/service-worker.js (Vite serves public/ as-is, at /service-worker.js) and register it only in production builds: if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js'). A worker under src/ isn't served as a file by the dev server, so registering it there fails in the preview. The web app manifest goes in public/ too, linked from index.html.",
  },
  {
    about: /touch target|tap target|44\s*(?:x|×|by)\s*44|target size/i,
    proof: /min-height:\s*var\(--control-(?:md|lg)/,
    fact: "Kit buttons and inputs are already at least --control-md tall (2.5rem = 40px; use size=\"lg\" for 48px). For 44px targets, use Button size=\"lg\" or set min-height: 44px on your own custom controls.",
  },
];
export function kitFacts(jail: { resolve(p: string): { abs: string } }, text: string): string[] {
  const facts = KIT_FACTS.filter((k) => k.about.test(text));
  if (!facts.length) return [];
  const read = (f: string) => {
    try {
      return fs.readFileSync(jail.resolve(f).abs, "utf8");
    } catch {
      return "";
    }
  };
  const css = ["src/styles/tokens.css", "src/styles/app.css", "src/styles/components.css", "src/styles/screen-parts.css"].map(read).join("\n");
  // The app's own screens can undo what the kit does (a px font size doesn't scale); then the fact isn't true here.
  let screens = read("src/App.tsx");
  try {
    const dir = jail.resolve("src/screens").abs;
    for (const f of fs.readdirSync(dir)) if (/\.(tsx|jsx|css)$/.test(f)) screens += read(`src/screens/${f}`);
  } catch {
    /* no screens folder */
  }
  return facts.filter((k) => k.proof.test(css) && !(k.spoiler && k.spoiler.test(screens))).map((k) => k.fact);
}

/**
 * Planned checks that demand something the app shouldn't have become manual notes. "File contains tabIndex": buttons
 * and inputs are focusable already, and tabIndex on them is an accessibility anti-pattern, so the check could only
 * pass by making the app worse (Calculator test 1: the focus-ring step blocked on it after the kit had done the work).
 */
const BAD_CHECK_TEXT = /^\s*tab-?index\s*$/i;
export function withoutBadChecks<C extends { description: string; check: object }>(criteria: C[]): C[] {
  return criteria.map((c) => {
    const k = c.check as { type?: string; text?: string };
    return k.type === "file_contains" && typeof k.text === "string" && BAD_CHECK_TEXT.test(k.text)
      ? ({ ...c, check: { type: "manual", note: `Was "contains ${k.text}"; controls are focusable without it, so it isn't required.` } } as C)
      : c;
  });
}

/** A TypeScript React workspace: planned .js files should be .tsx/.ts. */
export function isTsReact(jail: { resolve(p: string): { abs: string } }): boolean {
  return fs.existsSync(jail.resolve("tsconfig.json").abs) && fs.existsSync(jail.resolve("src/main.tsx").abs);
}

type PlannedStep = { title: string; objective: string; expectedPaths: string[]; acceptanceCriteria: Array<{ description: string; check: object }> };
/** A step's paths, file checks and wording moved from .js to .tsx/.ts (returns the changed fields). */
export function tsTask<T extends PlannedStep>(t: T): Pick<T, "title" | "objective" | "expectedPaths" | "acceptanceCriteria"> {
  const text = (s: string) => toCssText(toTsText(s));
  const file = (p: string) => toCssPath(toTsPath(p));
  return {
    title: text(t.title),
    objective: text(t.objective),
    expectedPaths: [...new Set(t.expectedPaths.map(file))],
    acceptanceCriteria: t.acceptanceCriteria.map((c) => ({
      ...c,
      description: text(c.description),
      check: "path" in c.check && typeof c.check.path === "string" ? { ...c.check, path: file(c.check.path) } : c.check,
    })) as T["acceptanceCriteria"],
  };
}

/**
 * Styles in the starter are CSS: theme values in tokens.css, everything else in app.css. A planned script file for
 * styles (src/styles/globalStyles.js, src/themes/darkTheme.js) becomes the stylesheet that holds them (Calculator
 * test 1: the coder kept reading a src/styles/globalStyles.ts that nothing needed).
 */
export function toCssPath(p: string): string {
  const m = /^src\/(styles|themes?)\/[\w./-]+\.(?:jsx?|tsx?)$/.exec(p.replace(/\\/g, "/"));
  if (!m) return p;
  return m[1].startsWith("theme") || /theme|token|colou?r|palette/i.test(p) ? "src/styles/tokens.css" : "src/styles/app.css";
}
function toCssText(s: string): string {
  return s.replace(/\bsrc\/(?:styles|themes?)\/[\w./-]+\.(?:jsx?|tsx?)\b/g, (x) => toCssPath(x));
}

/** src/ .js/.jsx files that contain JSX (and have no .tsx twin), as workspace-relative paths. */
export function jsxInJsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (/\.jsx?$/.test(e.name) && !fs.existsSync(path.join(dir, e.name.replace(/\.jsx?$/, ".tsx")))) {
        try {
          const text = fs.readFileSync(path.join(dir, e.name), "utf8");
          if (/<[A-Z][\w.]*[\s/>]|<\/?(div|span|button|main|section|ul|li|p|h[1-6]|form|label|input)\b/.test(text)) out.push(r);
        } catch {
          /* unreadable */
        }
      }
    }
  };
  walk(path.join(root, "src"), "src");
  return out;
}

/** The same for file names written in step titles and checks ("CalendarMonth.js", "src/lib/dates.js"). */
export function toTsText(s: string): string {
  return s.replace(/\b(src\/[\w/.-]+?\.jsx?)\b/g, (x) => toTsPath(x)).replace(/(^|[\s"'`(])([A-Z]\w*)\.jsx?\b/g, "$1$2.tsx");
}

/**
 * React Native code in a web app: imports from react-native packages, or its components (Calendar test 6: the
 * model wrote TouchableOpacity, StyleSheet and react-native-calendars into a Vite web app).
 */
export function nativeInWebApp(file: string, after: string): string | undefined {
  if (!/\.(tsx?|jsx?)$/.test(file)) return undefined;
  const native = [...after.matchAll(/^\s*import\s[^;]*?from\s+["'](react-native[^"']*|@react-native[^"']*|expo[^"']*)["']/gm)].map((m) => m[1]);
  if (!native.length) return undefined;
  return `Not applied: ${file} imports ${[...new Set(native)].join(", ")}, which is React Native (mobile). This app is a web app (React + Vite): use HTML elements and the building blocks from src/components/ui (Button, Card, Field, Grid, DataTable…) instead of View, Text, TouchableOpacity or StyleSheet, and style with the CSS classes and tokens.`;
}

/**
 * Edits that hide a problem instead of fixing it, or that pull app code into the starter kit (No GMO App: a
 * `// @ts-ignore` above a failing line, and `import { useScreen } from "./screen-parts"` added to the kit's index).
 * Compares the file before and after, so only what the edit adds counts.
 */
export function coverUpEdit(file: string, before: string | undefined, after: string): string | undefined {
  const added = (re: RegExp) => (after.match(re)?.length ?? 0) > (before?.match(re)?.length ?? 0);
  if (/\.(tsx?|jsx?|mts|cts)$/.test(file) && added(/@ts-(ignore|nocheck|expect-error)\b/g))
    return `Not applied: this edit adds a @ts-ignore / @ts-nocheck comment, which hides the type error instead of fixing it. Fix the line the error names (the "How to fix" notes say how), then run the type check again.`;
  if (/^src\/components\/ui\/(index|screen-parts)\.tsx$/.test(file)) {
    // React imports are fine (a new component in the kit may need a hook); anything else pulls app code in.
    const newImports = after.split("\n").filter((l) => /^\s*import\s/.test(l) && !(before ?? "").includes(l.trim()) && !/from\s+["']react(-dom)?["']/.test(l));
    if (newImports.length)
      return `Not applied: ${file} is the starter kit's building-block file. It only imports React and its own parts, so don't add imports to it. Import what you need where you use it instead (for example in src/App.tsx: import { useScreen } from "./lib/screens"). If you already added a line here, remove it.`;
  }
  return undefined;
}

/**
 * A patch that inserts, after its find text, lines that already sit right after it: the model treating each patch as
 * replacing its previous one. Seen in a benchmark: 29 "successful" patches re-inserting a growing block after
 * `.cal-head__title {`, stacking the same declarations dozens of times.
 */
export function reinsertion(before: string, edits: Array<{ find: string; replace: string; line?: number }>): string | undefined {
  const text = before.replace(/\r\n/g, "\n");
  const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find(Boolean);
  for (const e of edits) {
    const find = e.find.replace(/\r\n/g, "\n");
    const replace = e.replace.replace(/\r\n/g, "\n");
    if (!find.trim() || !replace.startsWith(find) || replace.length <= find.length) continue;
    const hit = locatePatch(text, find, e.line);
    if (!("start" in hit)) continue;
    const added = firstLine(replace.slice(find.length));
    const next = firstLine(text.slice(hit.end));
    if (added && next && added === next && added.length > 2 && !/^[})\];,]+$/.test(added)) {
      const line = text.slice(0, hit.end).split("\n").length;
      return `Not applied: \`${added.slice(0, 80)}\` is already on the line after \`${firstLine(find)?.slice(0, 60)}\` (line ${line + 1}). apply_patch inserts text; it doesn't replace your previous patch. To change that block, read_file, then put the block as it is now in find and the block as you want it in replace.`;
    }
  }
  return undefined;
}

/** Ordinary declarations repeated in one rule: the same property and value twice, or any property three times. */
function repeatedDeclarations(css: string): Map<string, number> {
  const out = new Map<string, number>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().split("\n").pop()!.trim().slice(0, 80);
    const props = new Map<string, number>();
    const pairs = new Map<string, number>();
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i < 1) continue;
      const prop = d.slice(0, i).trim().toLowerCase();
      if (!/^-?[a-z][\w-]*$/.test(prop) || prop.startsWith("--")) continue;
      const value = d.slice(i + 1).trim().replace(/\s+/g, " ").toLowerCase();
      props.set(prop, (props.get(prop) ?? 0) + 1);
      pairs.set(`${prop}: ${value}`, (pairs.get(`${prop}: ${value}`) ?? 0) + 1);
    }
    for (const [pair, n] of pairs) if (n > 1) out.set(`${selector}|${pair}`, Math.max(out.get(`${selector}|${pair}`) ?? 0, n));
    for (const [prop, n] of props) if (n > 2) out.set(`${selector}|${prop}`, Math.max(out.get(`${selector}|${prop}`) ?? 0, n));
  }
  return out;
}

// ───────────────────────── Tokens still in use ─────────────────────────

/** Where each CSS custom property is used (`var(--x)` without a fallback) and defined, across the app's own files. */
export interface TokenUsage {
  uses: Map<string, string[]>;
  defined: Map<string, string[]>;
}

/** Builds token usage from the app's files (pass already-read text; dependencies, build output and spec/ excluded by the caller). */
export function tokenUsage(files: Array<{ rel: string; text: string }>): TokenUsage {
  const uses = new Map<string, string[]>();
  const defined = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, rel: string) => m.set(k, [...(m.get(k) ?? []), rel]);
  for (const { rel, text } of files) {
    // A var() with a fallback still renders when the token is missing, so only bare uses count.
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) add(uses, m[1], rel);
    if (/\.(css|scss|pcss)$/i.test(rel)) for (const d of parseCustomProperties(text)) add(defined, d.name, rel);
  }
  return { uses, defined };
}

/** Tokens the app uses that nothing defines. */
export function undefinedTokens(u: TokenUsage): Array<{ name: string; uses: number; files: string[] }> {
  return [...u.uses]
    .filter(([name]) => !u.defined.has(name))
    .map(([name, where]) => ({ name, uses: where.length, files: [...new Set(where)] }))
    .sort((a, b) => b.uses - a.uses);
}

/**
 * An edit that removes a token's last definition while the app still uses it. Returns the refusal message, or undefined.
 * `usage` describes the workspace before the edit.
 */
export function removesTokenInUse(path: string, before: string, after: string, usage: TokenUsage): string | undefined {
  if (!/\.(css|scss|pcss)$/i.test(path)) return undefined;
  const had = new Set(parseCustomProperties(before).map((d) => d.name));
  const has = new Set(parseCustomProperties(after).map((d) => d.name));
  for (const name of had) {
    if (has.has(name)) continue;
    const elsewhere = (usage.defined.get(name) ?? []).filter((f) => f !== path);
    const used = usage.uses.get(name) ?? [];
    if (elsewhere.length || !used.length) continue;
    const files = [...new Set(used)];
    return `Not applied: this removes ${name}, which the app still uses ${used.length} time${used.length === 1 ? "" : "s"} (${files.slice(0, 4).join(", ")}${files.length > 4 ? ", …" : ""}). Removing it would break those styles. Keep ${name}; remove only the lines the task names, and only tokens nothing uses.`;
  }
  return undefined;
}

/** The text an edit would leave behind (apply_patch simulated in memory), or undefined when it can't be simulated. */
export function afterEdit(tool: "apply_patch" | "replace_file", before: string, args: Record<string, unknown>): string | undefined {
  if (tool === "replace_file") return String(args.content ?? "");
  let s = before.replace(/\r\n/g, "\n");
  for (const e of (args.edits as Array<{ find: string; replace: string; line?: number }>) ?? []) {
    const hit = locatePatch(s, e.find.replace(/\r\n/g, "\n"), e.line);
    if (!("start" in hit)) return undefined;
    s = s.slice(0, hit.start) + e.replace + s.slice(hit.end);
  }
  return s;
}

/** Token usage across the app's own stylesheets and components. */
export function workspaceTokenUsage(jail: PathJail): TokenUsage {
  const files = flattenFiles(jail, 8000)
    .filter((f) => /\.(css|scss|pcss|tsx|jsx|ts|js|html?|vue|svelte)$/i.test(f) && !/(^|\/)(node_modules|dist|build|\.flowcode[^/]*|coverage)\//.test(`/${f}`) && !isReferencePath(f))
    .slice(0, 1500)
    .flatMap((rel) => {
      try {
        const abs = path.join(jail.root, rel);
        return fs.statSync(abs).size > 600_000 ? [] : [{ rel, text: fs.readFileSync(abs, "utf8") }];
      } catch {
        return [];
      }
    });
  return tokenUsage(files);
}

// ───────────────────────── Plan checks and plan shape ─────────────────────────

/** Built-in and DOM names that say nothing about whether the requested change exists. */
const GENERIC_NAMES = new Set("placeholder className onChange onClick onSubmit onBlur onKeyDown toLowerCase toUpperCase includes filter forEach useState useEffect useMemo useCallback useRef addEventListener querySelector getElementById setTimeout preventDefault JSON stringify Promise Array Object String Number Boolean console length value target event events props children default export import return function interface const type string number boolean undefined null true false async await".split(" "));

/**
 * A "contains" check text that is a guessed code snippet (spaces plus code punctuation, e.g.
 * `filteredEvents = events.filter(e => ...)` or `input type="text" placeholder="Search events..."`) can't be matched
 * word for word. Keep the one name in it that would really appear (a declared name first, then a specific camelCase
 * name); return undefined when there's none, so the check is dropped. Short names and plain copy are left as they are.
 */
export function snippetToName(text: string): string | undefined | null {
  const t = text.trim();
  const looksLikeCode = /\s/.test(t) && (/[=(){};<>]|=>/.test(t) || /\w+="[^"]*"/.test(t));
  if (!looksLikeCode) return null; // not a snippet: leave the check alone
  const declared = /\b(?:interface|type|function|class|const|let|enum)\s+([A-Za-z_$][\w$]*)/.exec(t)?.[1];
  if (declared && !GENERIC_NAMES.has(declared)) return declared;
  const names = (t.match(/[A-Za-z_$][\w$]*/g) ?? []).filter((n) => n.length >= 5 && !GENERIC_NAMES.has(n) && (/[a-z][A-Z]|^[A-Z][a-z]+[A-Z]|_/.test(n)));
  return names.sort((a, b) => b.length - a.length)[0];
}

const TYPES_PATH = /(^|\/)(types?|models?|interfaces?|schema)(\.d)?\.(ts|tsx)$|(^|\/)(types|models)\//i;

/**
 * Plan shape rules: tasks that only create shared types or models go first (nothing may use a type before it exists),
 * and their dependencies on later tasks are dropped so the order can't loop.
 */
export function typesFirst<T extends { key: string; expectedPaths: string[]; dependsOn: string[] }>(tasks: T[]): T[] {
  const isTypes = (t: T) => t.expectedPaths.length > 0 && t.expectedPaths.every((p) => TYPES_PATH.test(p.split("\\").join("/")));
  const first = tasks.filter(isTypes);
  // Nothing to move when there are no types tasks, or they already come first.
  if (!first.length || first.every((t, i) => tasks[i] === t)) return tasks;
  const firstKeys = new Set(first.map((t) => t.key));
  for (const t of first) t.dependsOn = t.dependsOn.filter((k) => firstKeys.has(k));
  const rest = tasks.filter((t) => !isTypes(t));
  // Everything else that touches code waits for the types.
  for (const t of rest) for (const k of firstKeys) if (!t.dependsOn.includes(k)) t.dependsOn.push(k);
  return [...first, ...rest];
}

/** Why a plan is too spread out for the request, or undefined. Small requests shouldn't become 5+ steps across files. */
export function planTooBig(plan: { tasks: Array<{ expectedPaths: string[] }> }, opts: { specBuild: boolean; objective: string }): string | undefined {
  if (opts.specBuild) return undefined;
  const files = new Set(plan.tasks.flatMap((t) => t.expectedPaths));
  const limit = opts.objective.length > 400 ? 6 : 4;
  if (plan.tasks.length <= limit) return undefined;
  return `The plan has ${plan.tasks.length} tasks across ${files.size} files for a single change. Use at most ${limit}: change only the files the requirement needs, and put changes to the same file in one task.`;
}

export { testFailureDigest } from "../quality/testDigest.js";

/** Syntax errors in a TypeScript/JavaScript file's text (it doesn't parse), first ones first, one per line. */
export function syntaxErrors(file: string, text: string): Array<{ line: number; col: number; message: string; source: string }> {
  const kind = /\.tsx$/i.test(file) ? ts.ScriptKind.TSX : /\.jsx$/i.test(file) ? ts.ScriptKind.JSX : /\.(m|c)?js$/i.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const diags = (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
  const lines = text.split(/\r?\n/);
  const out: Array<{ line: number; col: number; message: string; source: string }> = [];
  for (const d of diags) {
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    if (out.some((o) => o.line === line + 1)) continue;
    out.push({ line: line + 1, col: character + 1, message: ts.flattenDiagnosticMessageText(d.messageText, " "), source: lines[line] ?? "" });
  }
  return out;
}

/**
 * Refuses an edit that leaves a TS/JS file unable to parse, unless the file already didn't parse and the edit makes it
 * better. A file that doesn't parse gives the type check dozens of vague follow-on errors ("Expression expected"), and
 * small models answer those by rewriting the file with the same mistake (Kids cash app: `onClick={</Button>}` written
 * again round after round, 2-3 minutes each). The file stays as it was, and the agent sees the exact broken lines.
 */
export function syntaxGuard(file: string, before: string | undefined, after: string): string | undefined {
  if (!/\.(tsx?|jsx?|mts|cts|mjs|cjs)$/i.test(file)) return undefined;
  const now = syntaxErrors(file, after);
  if (!now.length) return undefined;
  const was = before === undefined ? 0 : syntaxErrors(file, before).length;
  if (was && now.length < was) return undefined;
  const shown = now.slice(0, 3).map((e) => {
    const src = e.source.length > 160 ? e.source.slice(Math.max(0, e.col - 80), e.col + 60).trim() : e.source.trim();
    return `line ${e.line}: ${e.message}\n  ${src}`;
  });
  const jsx = /\.(tsx|jsx)$/i.test(file)
    ? '\nIn JSX: a value in { } must be a JavaScript expression (onClick={() => go("games")}, not onClick={</Button>}); every tag is closed (<PageHeader … /> or <PageHeader>…</PageHeader>); text with > or { goes in a string.'
    : "";
  const already = was ? ` (it already had ${was}; an edit must reduce them)` : "";
  return `Not applied: this edit leaves ${file} unable to parse (${now.length} syntax error${now.length === 1 ? "" : "s"}), so the file is unchanged${already}. Fix these lines and send the edit again:\n${shown.join("\n")}${jsx}`;
}

/**
 * A planned step whose whole job is reading ("Read the HTML file to extract the glassmorphism styles") can never pass:
 * it changes nothing, so it loops until it's blocked (Calculator app, three attempts each on two such steps). The
 * planner is told not to plan these; small models still do. Each one is folded into the step that uses what it read
 * (the first step that depends on it, or the next step), as that step's first instruction. Returns the titles folded.
 */
export function foldReadOnlySteps<T extends { key: string; title: string; objective: string; dependsOn: string[]; expectedPaths: string[] }>(tasks: T[], fixed: (t: T) => boolean = () => false): { tasks: T[]; folded: string[] } {
  const reading = /^(read|review|inspect|study|analy[sz]e|understand|examine|look (at|through|over)|explore|investigate|identify|extract|gather|research)\b/i;
  const writes = /\b(create|add|write|update|change|implement|apply|replace|modify|edit|build|make|remove|delete|rename|wire|style|refactor|fix)\b/i;
  const folded: string[] = [];
  let list = [...tasks];
  for (const t of tasks) {
    // FlowCode's own steps (Review the plan, Capture the style…) are never folded.
    if (fixed(t) || !reading.test(t.title.trim()) || writes.test(t.title)) continue;
    const i = list.indexOf(t);
    if (i < 0) continue;
    const next = list.find((x) => x !== t && x.dependsOn.includes(t.key)) ?? list[i + 1];
    if (!next) continue;
    next.objective = `First, ${t.objective.replace(/^\s*[A-Z]/, (c) => c.toLowerCase()).replace(/\.?\s*$/, ".")} Then:\n${next.objective}`;
    next.expectedPaths = [...new Set([...next.expectedPaths, ...t.expectedPaths])];
    for (const x of list) if (x.dependsOn.includes(t.key)) x.dependsOn = [...new Set([...x.dependsOn.filter((k) => k !== t.key), ...t.dependsOn.filter((k) => k !== x.key)])];
    list = list.filter((x) => x !== t);
    folded.push(t.title);
  }
  return { tasks: list, folded };
}
