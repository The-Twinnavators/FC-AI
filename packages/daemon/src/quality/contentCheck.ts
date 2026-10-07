/**
 * Real-content check for coding steps. A step that changes the app's screens isn't done while it leaves placeholder
 * text ("This is the X component", "You will see your choices here", lorem ipsum, "Coming soon") or while the app's
 * entry renders the same component more than once by mistake. Comments and input placeholder hints are ignored.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";

const UI_FILE = /\.(tsx|jsx|html|vue|svelte)$/i;
const ENTRY = /^(src\/App\.(tsx|jsx)|src\/app\/app\.(html|component\.html))$/;

const PLACEHOLDERS: Array<[RegExp, string]> = [
  [/\bthis is (?:a|an|the) [\w\s'-]{0,40}?\b(?:component|section|page|screen|placeholder|sample|view)\b/i, "describes itself instead of showing real content"],
  [/\byou will (?:see|receive|find|get) [^.<"'`]{0,60}?\bhere\b/i, "promises content that isn't there yet"],
  [/\b(?:lorem ipsum|dolor sit amet)\b/i, "lorem ipsum"],
  [/\bsample (?:scenario|text|content|data|description|item)\b/i, "sample content"],
  [/\b(?:placeholder (?:text|content)|(?:content|description|text|form|list|chart|controls?|details?) (?:goes|would go|will go|go(?:es)?) here|insert [\w\s]{1,20} here)\b/i, "placeholder content"],
  [/\b(?:coming soon|under construction)\b/i, "an unfinished-feature notice"],
  [/>\s*(?:TODO|TBD|FIXME)\b/, "a TODO left on screen"],
];

/** Text that can reach the screen: comments and input placeholder hints removed. */
function visibleSource(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\bplaceholder\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/g, " ")
    .replace(/\baria-label\s*=\s*("[^"]*"|'[^']*')/g, " ");
}

export interface ContentProblem {
  file: string;
  message: string;
}

/**
 * `owned`: the files this step is responsible for (changed or planned). When given, sample content is only reported in
 * screens the step owns: a sign-in step isn't blamed for the Settings layout another step fills in (Calendar test 8).
 */
/** `samples: false` skips the ready-made layouts' sample content (App layout wires them; Design the main screens fills them). */
export function contentProblems(jail: PathJail, changed: Iterable<string>, owned?: Iterable<string>, samples = true): ContentProblem[] {
  const out: ContentProblem[] = [];
  for (const rel of changed) {
    if (!UI_FILE.test(rel) || /(^|\/)(node_modules|dist|spec|tests?|__tests__)\//.test(rel) || /\.(test|spec)\.\w+$/.test(rel)) continue;
    let src: string;
    try {
      src = fs.readFileSync(path.join(jail.root, rel), "utf8");
    } catch {
      continue;
    }
    const text = visibleSource(src);
    for (const [re, what] of PLACEHOLDERS) {
      const m = re.exec(text);
      if (m) {
        out.push({ file: rel, message: `${rel} shows "${m[0].trim().slice(0, 70)}" (${what}). Replace it with the real content, controls and data the spec describes.` });
        break;
      }
    }
    // The entry point renders each screen or section once; repeats are usually a wiring mistake.
    if (ENTRY.test(rel)) {
      const counts = new Map<string, number>();
      const body = text.replace(/\.map\([\s\S]*?\)\s*\)?\s*\}/g, " ");
      for (const m of body.matchAll(/<([A-Z][\w.]*)(?=[\s/>])/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      for (const m of body.matchAll(/<(app-[\w-]+)(?=[\s/>])/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
      const repeats = [...counts.entries()].filter(([name, n]) => n > 1 && !/^(Route|Fragment|React\.Fragment|Suspense|Link|NavLink|Button|Icon|Card)$/.test(name));
      if (repeats.length) out.push({ file: rel, message: `${rel} renders ${repeats.map(([n, c]) => `<${n}> ${c} times`).join(", ")}. Show each screen once, inside the app's layout and navigation.` });
    }
  }
  // Paths compared without the extension: a step planned as Settings.js owns Settings.tsx.
  const stem = (p: string) => p.replace(/\\/g, "/").replace(/\.(jsx?|tsx?)$/, "");
  const mine = owned ? new Set([...owned, ...changed].map(stem)) : undefined;
  if (samples) out.push(...sampleLeft(jail, changed).filter((p) => !mine || mine.has(stem(p.file))));
  return out;
}

/**
 * Ready-made layouts arrive with sample data marked "flowcode:sample". A screen the app shows must not keep it: once the
 * entry file or the screen itself changes, every shown screen that still has the marker is reported.
 */
function sampleLeft(jail: PathJail, changed: Iterable<string>): ContentProblem[] {
  const files = [...changed];
  const entry = files.find((f) => ENTRY.test(f)) ?? (files.some((f) => /^src\/screens\//.test(f)) ? "src/App.tsx" : undefined);
  if (!entry) return [];
  let app: string;
  try {
    app = fs.readFileSync(path.join(jail.root, entry), "utf8");
  } catch {
    return [];
  }
  const dir = path.join(jail.root, "src/screens");
  if (!fs.existsSync(dir)) return [];
  const out: ContentProblem[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(tsx|jsx)$/.test(f)) continue;
    const name = f.replace(/\.\w+$/, "");
    if (!new RegExp(`["'/]${name}["']`).test(app)) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (src.includes("flowcode:sample"))
      out.push({ file: `src/screens/${f}`, message: `src/screens/${f} still shows the ready-made layout's sample content. Replace every value in its SAMPLE object with the app's real content and data, then delete the "flowcode:sample" comment.` });
  }
  return out;
}
