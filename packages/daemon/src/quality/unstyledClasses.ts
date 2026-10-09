/**
 * Class names a screen uses that no stylesheet in the app defines: those elements render unstyled. NOBIO: the coder
 * wrote library-looking names (fl-card__title, fl-screen, fl-snv-filters) without copying any library piece, so the
 * brand list showed bare inputs and plain boxes, while its type check and tests passed.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

/** Every class name the app's stylesheets define (any selector that names it). */
export function definedClasses(jail: PathJail): Set<string> {
  const out = new Set<string>();
  for (const rel of flattenFiles(jail, 4000).filter((f) => /\.(css|scss)$/i.test(f) && !/(^|\/)(node_modules|dist|build)\//.test(`/${f}`))) {
    let css = "";
    try {
      css = fs.readFileSync(path.join(jail.root, rel), "utf8");
    } catch {
      continue;
    }
    // Comments and url(...) values hold dots that aren't selectors.
    css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)/g, "");
    for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]!);
  }
  return out;
}

/** The static class names in a component file's className attributes (template parts with ${…} are skipped). */
export function usedClasses(source: string): string[] {
  const out = new Set<string>();
  const add = (text: string) => {
    for (const c of text.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (/^-?[_a-zA-Z][\w-]*$/.test(c)) out.add(c);
  };
  for (const m of source.matchAll(/className\s*=\s*"([^"]*)"/g)) add(m[1]!);
  for (const m of source.matchAll(/className\s*=\s*\{\s*["'`]([^"'`]*)["'`]\s*\}/g)) add(m[1]!);
  // Strings inside a className={…} expression: cond ? "a b" : "c".
  for (const m of source.matchAll(/className\s*=\s*\{([^}]*)\}/g)) for (const s of m[1]!.matchAll(/["'`]([^"'`]*)["'`]/g)) add(s[1]!);
  return [...out];
}

/** Per file (of the given files under src/, outside the library and the UI kit): the classes no stylesheet defines. */
export function unstyledClasses(jail: PathJail, files: string[]): Array<{ file: string; classes: string[] }> {
  const defined = definedClasses(jail);
  return files
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => /^src\/.*\.(tsx|jsx)$/.test(f) && !f.startsWith("src/sections/") && !f.startsWith("src/components/ui/") && !/\.test\.(tsx|jsx)$/.test(f))
    .flatMap((file) => {
      let source = "";
      try {
        source = fs.readFileSync(path.join(jail.root, file), "utf8");
      } catch {
        return [];
      }
      // State classes a stylesheet may target in combination (is-open, has-error) count as defined when any rule names them.
      const classes = usedClasses(source).filter((c) => !defined.has(c));
      return classes.length ? [{ file, classes }] : [];
    });
}

/** The step's failure message, or undefined when (almost) everything it uses is styled. */
export function unstyledMessage(found: Array<{ file: string; classes: string[] }>, min = 3): string | undefined {
  const total = found.reduce((n, f) => n + f.classes.length, 0);
  if (total < min) return undefined;
  const fl = found.flatMap((f) => f.classes).filter((c) => c.startsWith("fl-"));
  return `These class names have no styles anywhere in the app, so those elements render unstyled: ${found
    .slice(0, 4)
    .map((f) => `${f.file} (${f.classes.slice(0, 8).join(", ")}${f.classes.length > 8 ? ", …" : ""})`)
    .join("; ")}. ${fl.length ? `fl- names come from the component library: copy the real piece from .flowcode/sections/ (see .flowcode/sections/INDEX.md) into src/sections/ and use it, rather than writing its class names by hand. ` : ""}For your own class names, add their rules to the app's stylesheet (src/styles/app.css) using the design tokens, or use the UI kit's components from src/components/ui.`;
}
