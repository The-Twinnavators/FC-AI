/**
 * Design-system consistency check for coding steps (after CSSVibes' token audit). A step isn't done while it:
 *  - writes raw colours or sizes outside the token file (hex, rgb, hsl; px or rem for spacing, radius and font size),
 *    in stylesheets or in inline styles;
 *  - changes the spacing, radius, type or weight scale when the request didn't ask for it, or leaves a scale out of
 *    order (two spacing steps with the same size flatten the rhythm);
 *  - renders plain, unstyled markup: a component with several HTML elements, no classes and no building blocks;
 *  - adds a colour to the token file that isn't in the Styles palette (the palette is set on the Styles page; a step
 *    uses its --brand-* and --color-* tokens, it doesn't invent new shades).
 * Only what the step added counts: findings already in the app when the step started are ignored.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";

export interface ConsistencySnapshot {
  /** "file|value" keys of raw values already in the app. */
  raw: string[];
  /** Scale tokens in the token file and their values. */
  scale: Record<string, string>;
  /** Colour values in the token file (the Styles palette). Missing in snapshots taken before this existed. */
  palette?: string[];
}

export interface ConsistencyProblem {
  file: string;
  message: string;
}

const TOKEN_FILE = /(^|\/)tokens\.(css|scss)$/;
const SKIP = /(^|\/)(node_modules|dist|build|coverage|\.flowcode|spec|tests?|__tests__)\//;
const SCALE = /^--(space|radius|text|weight|leading)-[\w-]+$/;
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/gi;
const SIZE_PROPS = /^(?:border-radius|padding(?:-\w+)?|margin(?:-\w+)?|gap|row-gap|column-gap|font-size)$/;

const read = (root: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return undefined;
  }
};

function sourceFiles(root: string, dir = "src", out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (SKIP.test(`${rel}/`)) continue;
    if (e.isDirectory()) sourceFiles(root, rel, out);
    else if (/\.(css|scss|tsx|jsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(rel);
  }
  return out;
}

/** Declarations ("prop: value") outside custom-property definitions, comments removed. */
function declarations(css: string): Array<{ prop: string; value: string }> {
  const out: Array<{ prop: string; value: string }> = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, " ").matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const prop = m[1].toLowerCase();
    if (prop.startsWith("--")) continue;
    out.push({ prop, value: m[2].trim() });
  }
  return out;
}

/** camelCase inline-style props ("borderRadius: 8") as declarations. */
function inlineStyles(tsx: string): Array<{ prop: string; value: string }> {
  const out: Array<{ prop: string; value: string }> = [];
  for (const block of tsx.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    for (const m of block[1].matchAll(/([a-zA-Z]+)\s*:\s*("[^"]*"|'[^']*'|`[^`]*`|-?\d+(?:\.\d+)?)/g)) {
      const prop = m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const raw = m[2].replace(/^["'`]|["'`]$/g, "");
      // React adds "px" to bare numbers.
      out.push({ prop, value: /^-?\d+(?:\.\d+)?$/.test(raw) && raw !== "0" ? `${raw}px` : raw });
    }
  }
  return out;
}

/** Raw colours and sizes in one file, as "file|value" keys with a readable description. */
function rawValues(rel: string, text: string): Map<string, string> {
  const found = new Map<string, string>();
  // The token file holds the raw values; FlowCode's own building-block styles are verified separately.
  if (TOKEN_FILE.test(rel) || /(^|\/)src\/styles\/(components|screen-parts|surfaces)\.css$/.test(rel)) return found;
  const decls = /\.(css|scss)$/.test(rel) ? declarations(text) : inlineStyles(text);
  for (const { prop, value } of decls) {
    if (/shadow$/.test(prop) || /^(filter|mask|background-image)$/.test(prop)) continue;
    if (/^(color|background|background-color|border(?:-\w+)?-color|border|outline|outline-color|fill|stroke|accent-color|caret-color)$/.test(prop)) {
      for (const c of value.match(COLOR) ?? []) found.set(`${rel}|${c.toLowerCase()}`, `the colour ${c} in ${prop}`);
    }
    if (SIZE_PROPS.test(prop) && !/var\(/.test(value)) {
      // 0 and ±1px aren't design sizes: hairlines and the visually-hidden pattern (width: 1px; margin: -1px) that keeps
      // screen-reader text off screen have no token (Calculator app: its live region blocked a step).
      const sizes = (value.match(/-?\d*\.?\d+(?:px|rem)\b/g) ?? []).filter((s) => !/^-?0(?:px|rem)$/.test(s) && !/^-?1px$/.test(s) && !(prop === "border-radius" && parseFloat(s) >= 99));
      for (const s of sizes) found.set(`${rel}|${prop}:${s}`, `${s} for ${prop}`);
    }
  }
  return found;
}

function scaleOf(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of ["src/styles/tokens.css", "src/styles.css", "src/styles/tokens.scss"]) {
    const css = read(root, rel);
    if (!css) continue;
    // Only the first (default) definition of each scale token; theme blocks don't redefine sizes.
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (SCALE.test(m[1]) && !(m[1] in out)) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Colour literals defined in the token file(s), comments removed. */
function paletteOf(root: string): Set<string> {
  const out = new Set<string>();
  for (const rel of ["src/styles/tokens.css", "src/styles.css", "src/styles/tokens.scss"]) {
    const css = read(root, rel);
    if (!css) continue;
    for (const c of css.replace(/\/\*[\s\S]*?\*\//g, " ").match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gi) ?? []) out.add(c.toLowerCase().replace(/\s+/g, ""));
  }
  return out;
}

export function consistencySnapshot(jail: PathJail): ConsistencySnapshot {
  const raw: string[] = [];
  for (const rel of sourceFiles(jail.root)) {
    const text = read(jail.root, rel);
    if (text) raw.push(...rawValues(rel, text).keys());
  }
  return { raw, scale: scaleOf(jail.root), palette: [...paletteOf(jail.root)] };
}

const toRem = (v: string) => (/^-?\d*\.?\d+rem$/.test(v) ? parseFloat(v) : /^-?\d*\.?\d+px$/.test(v) ? parseFloat(v) / 16 : /^\d+$/.test(v) ? Number(v) : undefined);

export function consistencyProblems(jail: PathJail, changed: Iterable<string>, before: ConsistencySnapshot, objective: string): ConsistencyProblem[] {
  const out: ConsistencyProblem[] = [];
  const known = new Set(before.raw);
  // 1. Raw colours and sizes the step added.
  for (const rel of changed) {
    if (!/\.(css|scss|tsx|jsx)$/.test(rel) || SKIP.test(rel) || /\.(test|spec)\./.test(rel)) continue;
    const text = read(jail.root, rel);
    if (!text) continue;
    const added = [...rawValues(rel, text)].filter(([k]) => !known.has(k));
    if (added.length)
      out.push({
        file: rel,
        message: `${rel} uses ${added.slice(0, 3).map(([, d]) => d).join(", ")}${added.length > 3 ? ` and ${added.length - 3} more` : ""} directly. Use the design tokens in src/styles/tokens.css instead (var(--color-…), var(--space-…), var(--radius-…), var(--text-…)), so the whole app stays consistent.`,
      });
  }
  // 2. The token scales.
  const after = scaleOf(jail.root);
  const asked = /\b(spacing|space|padding|margin|gap|radius|radii|corners?|rounded|font|type|typography|text size|sizes?|bigger|smaller|larger|density|compact|roomy|weight|bold|line height|scale)\b/i.test(objective);
  const changedScale = Object.keys(before.scale).filter((k) => k in after && after[k] !== before.scale[k]);
  if (changedScale.length && !asked)
    out.push({
      file: "src/styles/tokens.css",
      message: `The step changed ${changedScale.slice(0, 3).map((k) => `${k} (${before.scale[k]} → ${after[k]})`).join(", ")}, but the request didn't ask for different sizes. Put the scale back: every screen relies on it.`,
    });
  for (const family of ["space", "radius", "text"]) {
    const steps = Object.entries(after)
      .filter(([k]) => new RegExp(`^--${family}-\\d+$`).test(k))
      .sort(([a], [b]) => Number(a.split("-").pop()) - Number(b.split("-").pop()))
      .map(([k, v]) => [k, toRem(v)] as const);
    const flat = steps.find(([, v], i) => i > 0 && v !== undefined && steps[i - 1][1] !== undefined && v <= (steps[i - 1][1] as number));
    if (flat) {
      const i = steps.indexOf(flat);
      out.push({ file: "src/styles/tokens.css", message: `The ${family} scale is out of order: ${flat[0]} isn't larger than ${steps[i - 1][0]}. Each step must be bigger than the one before it.` });
    }
  }
  // 3. New colours in the token file. The Calculator app's keys got #d9eaff, #083360 and #fef0c7 next to a palette of
  // #042935 / #14b7da / #57445e, so the app didn't look like its Styles page. A colour the request itself names is fine.
  if (before.palette) {
    const known = new Set(before.palette);
    const asked = objective.toLowerCase();
    const added = [...paletteOf(jail.root)].filter((c) => !known.has(c) && !asked.includes(c));
    if (added.length)
      out.push({
        file: "src/styles/tokens.css",
        message: `The step added ${added.slice(0, 4).join(", ")}${added.length > 4 ? ` and ${added.length - 4} more` : ""} to the design tokens, but those colours aren't in the Styles palette. Use the palette instead: define new role tokens as var(--brand-primary-…), var(--brand-secondary-…), var(--brand-tertiary-…), var(--neutral-…) (shades 50 to 900) or var(--color-…), so the app matches its Styles page.`,
      });
  }
  // 4. Plain, unstyled markup.
  for (const rel of changed) {
    if (!/\.(tsx|jsx)$/.test(rel) || SKIP.test(rel) || /\.(test|spec)\./.test(rel) || /components\/ui\//.test(rel) || /(^|\/)(main|App)\.(tsx|jsx)$/.test(rel)) continue;
    const text = read(jail.root, rel);
    if (!text) continue;
    const tags = (text.match(/<(div|section|article|p|h[1-6]|ul|ol|li|span|button|input|form|label|table)\b/g) ?? []).length;
    const styled = /className=|from\s+["'][^"']*components\/ui["']|style=\{\{/.test(text);
    if (tags >= 3 && !styled)
      out.push({ file: rel, message: `${rel} renders plain HTML with no styles (${tags} elements, no classes or building blocks). Build it from the building blocks in src/components/ui (Section, Card, Button, Field, Stat, Progress and so on).` });
  }
  return out;
}
