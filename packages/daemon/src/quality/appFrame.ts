/**
 * The app's frame as it is actually rendered, read from the app itself (no per-component list): App.tsx's outermost
 * wrapping component (the element that encloses the screens), followed through its import to the component's own
 * source, and the CSS classes that component renders. The starter's AppShell (one function in the kit's index.tsx),
 * a complete app's LookupFrame or AppFrame, or a frame component the app wrote: each is found the same way.
 *
 * Used by the frame check (frameCheck.ts) to tell frame rules from other rules, and to name the frame in the check's
 * wording, so a step isn't pointed at ui-shell__* rules in an app whose frame is LookupFrame (Clean Cart slice eval 1).
 */
import fs from "node:fs";
import path from "node:path";

export interface ResolvedFrame {
  /** The component's name (LookupFrame, AppShell…). */
  component: string;
  /** Its source file, workspace-relative. */
  file: string;
  /** The CSS classes it renders (from its className literals), the frame's own selectors. */
  classes: string[];
}

const read = (root: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return "";
  }
};

/** The source of one exported component in a file: from its declaration to the next top-level export. */
export function componentSource(src: string, name: string): string {
  const at = src.search(new RegExp(`export\\s+(default\\s+)?(function|const)\\s+${name}\\b`));
  if (at < 0) return "";
  const next = src.slice(at + 1).search(/\nexport\s+(default\s+)?(function|const|class)\b/);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

/** Class names a component's className attributes name (string and template literals; interpolations dropped). */
export function renderedClasses(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/className=(?:"([^"]+)"|\{\s*`([^`]+)`\s*\}|\{\s*"([^"]+)"\s*\})/g)) {
    const text = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    for (const c of text.split(/\s+/)) if (/^[a-z][\w-]*$/i.test(c)) out.add(c);
  }
  return [...out];
}

/**
 * The frame App.tsx renders: its outermost capitalized element that has a closing tag (so it wraps the screens),
 * resolved through App.tsx's import of it. Undefined when App.tsx has none, or the import can't be followed.
 */
export function resolveFrame(root: string): ResolvedFrame | undefined {
  const appFile = ["src/App.tsx", "src/App.jsx"].find((f) => fs.existsSync(path.join(root, f)));
  if (!appFile) return undefined;
  const app = read(root, appFile);
  const body = componentSource(app, "App") || app;
  // Wrapping elements in source order: the first one opened is the outermost.
  const wrappers = [...body.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]!).filter((n, i, all) => all.indexOf(n) === i && body.includes(`</${n}>`));
  for (const name of wrappers) {
    const imp = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']|import\\s+${name}\\s+from\\s*["']([^"']+)["']`).exec(app);
    const spec = imp?.[1] ?? imp?.[2];
    if (!spec || !spec.startsWith(".")) continue;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(appFile), spec));
    const file = [`${base}.tsx`, `${base}.jsx`, `${base}/index.tsx`, `${base}/index.jsx`, base].find((f) => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile());
    if (!file) continue;
    const src = componentSource(read(root, file), name);
    const classes = renderedClasses(src);
    if (classes.length) return { component: name, file, classes };
  }
  return undefined;
}

/** Whether a CSS selector targets the resolved frame: it names one of the classes the frame renders. */
export function isFrameSelector(frame: ResolvedFrame, selector: string): boolean {
  return frame.classes.some((c) => new RegExp(`\\.${c.replace(/[-\\]/g, "\\$&")}(?![\\w-])`).test(selector));
}
