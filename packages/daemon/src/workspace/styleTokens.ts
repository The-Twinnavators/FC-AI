/**
 * Styles tab: reads a project's design primitives — CSS custom properties in its stylesheets — grouped into colours,
 * typography, spacing, radius, shadows and motion, with their theme (default / light / dark), where they're defined
 * and how often they're used. Edits rewrite just that declaration's value through the governed file operations, so
 * every change is snapshotted and can be undone.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { flattenFiles } from "./fileService.js";
import { isReferencePath } from "../quality/tokens.js";

export type TokenGroup = "color" | "typography" | "spacing" | "radius" | "shadow" | "motion" | "other";
export type TokenTheme = "default" | "light" | "dark";

export interface StyleToken {
  name: string;
  value: string;
  group: TokenGroup;
  theme: TokenTheme;
  selector: string;
  file: string;
  line: number;
  /** Character offsets of the value in the file (for editing). */
  start: number;
  end: number;
  uses: number;
  /** For var() references: the resolved value within the same theme, when known. */
  resolved?: string;
}

const SKIP = /(^|\/)(node_modules|dist|build|out|coverage|\.git|\.next|\.flowcode[^/]*|vendor)\//;
const MAX_CSS = 60;
const MAX_CSS_BYTES = 600_000;

export function groupOf(name: string, value: string): TokenGroup {
  const n = name.toLowerCase();
  const v = value.trim().toLowerCase();
  if (/shadow|elevation/.test(n) || /\d+px\s+\d+px\s+\d+px/.test(v)) return "shadow";
  if (/radius|rounded|corner/.test(n)) return "radius";
  // A colour value (or a colour-named token) is a colour even when its name mentions text, border or font.
  if (isColor(v) || /(^|-)(color|colour)(-|$)/.test(n.replace(/^--/, ""))) return "color";
  if (/font|text-|leading|line-height|tracking|letter|weight|family|type-|typo|fs-|lh-/.test(n)) return "typography";
  if (/duration|ease|transition|motion|delay|anim/.test(n) || /^\d+(\.\d+)?m?s$/.test(v) || /cubic-bezier/.test(v)) return "motion";
  if (/space|spacing|gap|pad|margin|inset|size|width|height|gutter|^--s-\d|stack|indent/.test(n)) return "spacing";
  if (/color|colour|bg|background|fg|text|ink|brand|accent|border|line|surface|primary|secondary|success|warn|error|danger|info|sig|tint|shade|fill|stroke/.test(n) || isColor(v)) return "color";
  if (/^-?\d*\.?\d+(px|rem|em|%)$/.test(v)) return "spacing";
  return "other";
}

export function isColor(v: string): boolean {
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix|color)\(/i.test(v) || /^(transparent|white|black|currentcolor)$/i.test(v);
}

function themeOf(selectors: string[]): TokenTheme {
  const s = selectors.join(" ").toLowerCase();
  if (/prefers-color-scheme:\s*dark|data-theme\s*=\s*["']?dark|\.dark\b|theme-dark/.test(s)) return "dark";
  if (/prefers-color-scheme:\s*light|data-theme\s*=\s*["']?light|\.light\b|theme-light/.test(s)) return "light";
  return "default";
}

/** Walks a stylesheet's blocks (comment- and string-aware) and returns every `--name: value` declaration with offsets. */
export function parseCustomProperties(css: string): Array<{ name: string; value: string; selectors: string[]; start: number; end: number; line: number }> {
  const out: Array<{ name: string; value: string; selectors: string[]; start: number; end: number; line: number }> = [];
  const stack: string[] = [];
  let i = 0;
  let segStart = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close < 0 ? n : close + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const close = css.indexOf(c, i + 1);
      i = close < 0 ? n : close + 1;
      continue;
    }
    if (c === "{") {
      stack.push(css.slice(segStart, i).replace(/\/\*[\s\S]*?\*\//g, "").trim());
      segStart = i + 1;
    } else if (c === "}") {
      readDecl(segStart, i);
      stack.pop();
      segStart = i + 1;
    } else if (c === ";") {
      readDecl(segStart, i);
      segStart = i + 1;
    }
    i++;
  }
  return out;

  function readDecl(from: number, to: number) {
    if (!stack.length) return;
    const raw = css.slice(from, to);
    const m = /^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)(--[\w-]+)(\s*:\s*)([\s\S]*?)\s*$/.exec(raw);
    if (!m) return;
    const start = from + m[1].length + m[2].length + m[3].length;
    const value = m[4].replace(/\s*!important\s*$/i, "");
    out.push({ name: m[2], value: value.trim(), selectors: [...stack], start, end: start + value.trimEnd().length, line: css.slice(0, from + m[1].length).split("\n").length });
  }
}

/** For the Styles → Text panel: fonts the app really loads, and font sizes fixed in CSS (they ignore the type scale). */
export interface TextInfo {
  loadedFonts: string[];
  fixedSizes: Array<{ selector: string; value: string; file: string; line: number }>;
}

export function scanStyles(jail: PathJail): { tokens: StyleToken[]; files: string[]; scanned: number; truncated: boolean; text: TextInfo } {
  // The app's own files: reference material attached to the spec (spec/, docs/) is not part of the app.
  const all = flattenFiles(jail, 8000).filter((f) => !SKIP.test(`/${f}`) && !isReferencePath(f));
  const cssFiles = all.filter((f) => /\.(css|scss|pcss)$/i.test(f)).slice(0, MAX_CSS);
  const tokens: StyleToken[] = [];
  const files = new Set<string>();
  const text: TextInfo = { loadedFonts: [], fixedSizes: [] };
  const sheets: Array<{ rel: string; css: string }> = [];
  for (const rel of cssFiles) {
    let css: string;
    try {
      const { abs } = jail.resolve(rel);
      if (fs.statSync(abs).size > MAX_CSS_BYTES) continue;
      css = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    sheets.push({ rel, css });
    for (const d of parseCustomProperties(css)) {
      files.add(rel);
      tokens.push({ name: d.name, value: d.value, group: groupOf(d.name, d.value), theme: themeOf(d.selectors), selector: d.selectors.join(" › "), file: rel, line: d.line, start: d.start, end: d.end, uses: 0 });
    }
  }
  // Usage counts across stylesheets and markup/components.
  if (tokens.length) {
    const names = new Map<string, number>();
    const usable = all.filter((f) => /\.(css|scss|pcss|html?|tsx|jsx|vue|svelte|astro|ts|js)$/i.test(f)).slice(0, 1500);
    for (const rel of usable) {
      try {
        const { abs } = jail.resolve(rel);
        if (fs.statSync(abs).size > MAX_CSS_BYTES) continue;
        const text = fs.readFileSync(abs, "utf8");
        for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) names.set(m[1], (names.get(m[1]) ?? 0) + 1);
      } catch {
        /* unreadable */
      }
    }
    for (const t of tokens) t.uses = names.get(t.name) ?? 0;
    // Resolve one level of var() so colour swatches can show aliases.
    for (const t of tokens) {
      const ref = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(t.value)?.[1];
      if (!ref) continue;
      const target = tokens.find((x) => x.name === ref && x.theme === t.theme) ?? tokens.find((x) => x.name === ref && x.theme === "default");
      if (target) t.resolved = target.value;
    }
    for (const t of tokens) if (t.group === "other" && t.resolved && isColor(t.resolved)) t.group = "color";
  }
  text.loadedFonts = loadedFonts(jail, all, sheets);
  for (const { rel, css } of sheets) for (const d of fixedFontSizes(css)) text.fixedSizes.push({ selector: d.selector, value: d.value, line: d.line, file: rel });
  return { tokens, files: [...files], scanned: cssFiles.length, truncated: cssFiles.length >= MAX_CSS, text };
}

/** Values must stay inside one declaration: no braces, semicolons, comments or markup. */
export function validTokenValue(v: string): boolean {
  return v.trim().length > 0 && v.length <= 400 && !/[;{}<>]|\/\*|\*\//.test(v);
}

export function editStyleToken(
  jail: PathJail,
  ops: FileOperations,
  ctx: { projectId: string; runId: string },
  edit: { file: string; name: string; selector: string; expected: string; value: string },
) {
  if (!validTokenValue(edit.value)) throw new Error("That value can't be used: keep it to a single CSS value (no ; { } or comments).");
  if (!/\.(css|scss|pcss)$/i.test(edit.file) || SKIP.test(`/${edit.file}`)) throw new Error("Only project stylesheets can be edited here.");
  const { abs, rel } = jail.resolve(edit.file);
  const css = fs.readFileSync(abs, "utf8");
  const match = parseCustomProperties(css).find((d) => d.name === edit.name && d.selectors.join(" › ") === edit.selector);
  if (!match) throw new Error(`${edit.name} is no longer defined in ${rel}. Refresh the Styles tab.`);
  if (match.value !== edit.expected.trim()) throw new Error(`${edit.name} changed on disk (now "${match.value}"). Refresh the Styles tab and try again.`);
  // A size stays a size (a font list in --text-3xl breaks every heading that uses it), and a token can't point at itself.
  const LENGTH = /^-?\d*\.?\d+(px|rem|em|%|vw|vh|ch|ex|pt)?$|^(calc|clamp|min|max|var)\(/i;
  if (LENGTH.test(match.value) && /^-?\d*\.?\d+[a-z%]+$/i.test(match.value) && !LENGTH.test(edit.value.trim()))
    throw new Error(`${edit.name} is a size (now ${match.value}), so it needs a size like 2rem or 32px, not "${edit.value.trim()}".`);
  if (new RegExp(`var\\(\\s*${edit.name}\\s*[,)]`).test(edit.value)) throw new Error(`${edit.name} can't be set to itself.`);
  const after = css.slice(0, match.start) + edit.value.trim() + css.slice(match.end);
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, rel, after);
  if (!r.ok) throw new Error(r.message);
  return { file: rel, name: edit.name, value: edit.value.trim(), snapshotId: r.snapshotIds[0], diff: r.diff };
}

export const STYLE_EDIT_RUN = (projectId: string) => `style_${projectId}`;
export const isStylesheet = (p: string) => /\.(css|scss|pcss)$/i.test(path.extname(p));

/** Font families the app actually loads: Google Fonts links/imports (not ones in comments), @font-face, @fontsource packages. */
function loadedFonts(jail: PathJail, all: string[], sheets: Array<{ rel: string; css: string }>): string[] {
  const names = new Set<string>();
  const fromGoogle = (url: string) => {
    for (const m of url.matchAll(/family=([^&:"')\s]+)/g)) names.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
  };
  for (const { css } of sheets) {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of code.matchAll(/@import\s+(?:url\()?["']?([^"')]+)/g)) if (/fonts\.googleapis/.test(m[1])) fromGoogle(m[1]);
    for (const m of code.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*["']?([^;"'}]+)/g)) names.add(m[1].trim());
  }
  for (const rel of all.filter((f) => /\.html?$/i.test(f)).slice(0, 20)) {
    try {
      const html = fs.readFileSync(jail.resolve(rel).abs, "utf8").replace(/<!--[\s\S]*?-->/g, "");
      for (const m of html.matchAll(/<link[^>]+href=["']([^"']*fonts\.googleapis[^"']*)["']/g)) fromGoogle(m[1].replace(/&amp;/g, "&"));
    } catch {
      /* unreadable */
    }
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(jail.resolve("package.json").abs, "utf8")) as { dependencies?: Record<string, string> };
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      const m = /^@fontsource(?:-variable)?\/(.+)$/.exec(dep);
      if (m) names.add(m[1].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
    }
  } catch {
    /* no manifest */
  }
  return [...names].sort();
}

/** `font-size` declarations with a fixed value (not var(), inherit or a percentage), with their selector and media query. */
export function fixedFontSizes(css: string): Array<{ selector: string; value: string; line: number; start: number; end: number }> {
  const out: Array<{ selector: string; value: string; line: number; start: number; end: number }> = [];
  const stack: string[] = [];
  let segStart = 0;
  const code = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{") {
      stack.push(code.slice(segStart, i).trim());
      segStart = i + 1;
    } else if (c === "}" || c === ";") {
      const decl = /^(\s*font-size\s*:\s*)([^;]+?)\s*$/.exec(code.slice(segStart, i));
      if (decl && stack.length && !/var\(|inherit|initial|unset|%|clamp\(|calc\(/.test(decl[2])) {
        const start = segStart + decl[1].length;
        out.push({ selector: stack.join(" › ").replace(/\s+/g, " "), value: decl[2].trim(), line: code.slice(0, start).split("\n").length, start, end: start + decl[2].length });
      }
      if (c === "}") stack.pop();
      segStart = i + 1;
    }
  }
  return out;
}

/** Changes one fixed `font-size` value (found by selector and its current value), through the governed, snapshotted edit. */
export function editFixedFontSize(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, edit: { file: string; selector: string; expected: string; value: string }) {
  if (!/^\d+(\.\d+)?(px|rem|em)$/.test(edit.value.trim())) throw new Error("Use a size like 16px or 1rem.");
  if (!/\.(css|scss|pcss)$/i.test(edit.file) || SKIP.test(`/${edit.file}`)) throw new Error("Only project stylesheets can be edited here.");
  const { abs, rel } = jail.resolve(edit.file);
  const css = fs.readFileSync(abs, "utf8");
  const match = fixedFontSizes(css).find((d) => d.selector === edit.selector && d.value === edit.expected.trim());
  if (!match) throw new Error(`That size changed on disk or was removed from ${rel}. Refresh the Styles tab.`);
  const after = css.slice(0, match.start) + edit.value.trim() + css.slice(match.end);
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, rel, after);
  if (!r.ok) throw new Error(r.message);
  return { file: rel, value: edit.value.trim(), snapshotId: r.snapshotIds[0], diff: r.diff };
}
