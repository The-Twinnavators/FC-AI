/**
 * Styles → Design: a small design studio (after CSSVibes). Each control writes the app's design tokens, so every screen
 * and building block follows at once:
 *  - applyDesign: several token values in one write (a type scale, a corner radius, a colour), for the default or the
 *    dark theme, plus the web fonts the app loads (one managed Google Fonts @import at the top of tokens.css).
 *  - design components: the building blocks the user picked for the app (.flowcode/design.json). The sheet shows them
 *    and the builder is told to use them.
 * Token writes go through the governed, snapshotted file operations, so each change can be undone.
 */
import { syncLocalFonts } from "./localFonts.js";
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { parseCustomProperties, validTokenValue } from "./styleTokens.js";
import { darkThemeFollows, withDarkTheme } from "./darkTheme.js";
import { uiGallery } from "./componentLibrary.js";
import { resolveFrame } from "../quality/appFrame.js";
import { CONFIGURABLE_BLOCKS, buildPalette, componentStyleSpec, componentStylesCss, paletteFromTokens, rampTokens, roleTokens, type ComponentStyleValues, type Palette, type PaletteConfig } from "@flowcode/contracts";

const TOKENS = "src/styles/tokens.css";
const DESIGN = ".flowcode/design.json";
const FONT_IMPORT = /^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?[^"]*"\);\s*\/\* FlowCode fonts \*\/\r?\n?/m;
const LENGTH = /^-?\d*\.?\d+(px|rem|em|%)?$/i;

export type DesignTheme = "default" | "dark";

const isDark = (selectors: string[]) => /prefers-color-scheme:\s*dark|data-theme\s*=\s*["']?dark/i.test(selectors.join(" "));

/** Writes token values (name → value) into tokens.css for one theme, and the web fonts to load. */
export function applyDesign(
  jail: PathJail,
  ops: FileOperations,
  ctx: { projectId: string; runId: string },
  edit: { theme: DesignTheme; values: Record<string, string>; googleFonts?: string[] },
): { snapshotId?: string; changed: string[] } {
  const abs = path.join(jail.root, TOKENS);
  if (!fs.existsSync(abs)) throw new Error("This app has no src/styles/tokens.css, so its design can't be changed here.");
  const changed: string[] = [];
  const before = fs.readFileSync(abs, "utf8");
  let css = setTokenValues(before, edit.theme, edit.values, changed);
  // A new accent or secondary in the light theme: FlowCode's dark theme is rewritten from it (it kept the starter's
  // blue accent after the Look chose purple). A dark theme edited by hand is left alone.
  if (edit.theme === "default" && changed.some((n) => n === "--color-accent" || n === "--color-secondary") && darkThemeFollows(before)) {
    const withDark = withDarkTheme(css);
    if (withDark !== css) {
      css = withDark;
      changed.push("dark theme");
    }
  }
  if (edit.googleFonts) {
    const families = [...new Set(edit.googleFonts.filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f)))].slice(0, 4);
    const line = families.length
      ? `@import url("https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&")}&display=swap"); /* FlowCode fonts */\n`
      : "";
    const without = css.replace(FONT_IMPORT, "");
    const next = line + without;
    if (next !== css) {
      css = next;
      changed.push("fonts");
    }
  }
  return writeTokens(jail, ops, ctx, css, changed);
}

function writeTokens(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, css: string, changed: string[]): { snapshotId?: string; changed: string[] } {
  if (!changed.length) return { changed };
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, TOKENS, css);
  if (!r.ok) throw new Error(r.message);
  // A new font in the tokens: its file is copied in and declared locally.
  syncLocalFonts(jail.root);
  return { snapshotId: r.snapshotIds[0], changed };
}

/** Sets existing token values for one theme (the dark theme falls back to the shared declaration). */
function setTokenValues(input: string, theme: DesignTheme, values: Record<string, string>, changed: string[]): string {
  let css = input;
  // Last declaration first, so earlier offsets stay valid while values are replaced.
  const decls = parseCustomProperties(css);
  const edit = { theme, values };
  const targets: Array<{ start: number; end: number; value: string; name: string }> = [];
  // Size tokens newer apps have (--control-xl, --control-pad-*, --control-text-*) are added to older ones.
  const addable: Array<[string, string]> = [];
  for (const [name, raw] of Object.entries(edit.values)) {
    const value = raw.trim();
    if (!/^--[\w-]+$/.test(name)) throw new Error(`"${name}" isn't a design token name.`);
    if (!validTokenValue(value)) throw new Error(`${name}: keep it to a single CSS value.`);
    if (new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(value)) throw new Error(`${name} can't be set to itself.`);
    const own = decls.filter((d) => d.name === name && (edit.theme === "dark" ? isDark(d.selectors) : !isDark(d.selectors)) && d.selectors.some((s) => /:root|html/.test(s)));
    // Sizes, fonts and radii are shared by both themes: the dark theme falls back to the default declaration.
    const d = own[0] ?? (edit.theme === "dark" ? decls.find((x) => x.name === name && !isDark(x.selectors)) : undefined);
    if (!d) {
      if (theme === "default" && /^--control-(?:(?:pad|text)-)?(?:sm|md|lg|xl)$/.test(name) && LENGTH.test(value)) addable.push([name, value]);
      continue;
    }
    if (LENGTH.test(d.value) && /[a-z%]$/i.test(d.value) && !LENGTH.test(value) && !/^(calc|clamp|min|max|var)\(/.test(value)) throw new Error(`${name} is a size, so it needs a size like 2rem or 32px.`);
    if (d.value !== value) targets.push({ start: d.start, end: d.end, value, name });
  }
  for (const t of targets.sort((a, b) => b.start - a.start)) {
    css = css.slice(0, t.start) + t.value + css.slice(t.end);
    changed.push(t.name);
  }
  if (addable.length) {
    const rootEnd = css.indexOf("}", css.indexOf(":root"));
    if (rootEnd >= 0) {
      const lines = addable.map(([n, v]) => `  ${n}: ${v};`).join("\n");
      css = `${css.slice(0, rootEnd).replace(/\s*$/, "\n")}\n  /* Control sizes (CSSVibes' button sizes), added by Styles → Design */\n${lines}\n${css.slice(rootEnd)}`;
      changed.push(...addable.map(([n]) => n));
    }
  }
  return css;
}

const PALETTE_START = "  /* FlowCode palette: brand, neutral and status ramps (Styles → Design → Colours). Edited there. */";
const PALETTE_END = "  /* End of FlowCode palette */";

/**
 * Styles → Design → Colours: saves the palette (.flowcode/design.json), writes every ramp as tokens in one managed
 * block of :root, and sets the app's colour roles for the light theme and, when the app has one, the dark theme.
 * One snapshot, so Undo puts all of it back.
 */
export function applyPalette(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, cfg: PaletteConfig): { snapshotId?: string; changed: string[]; palette: Palette } {
  const abs = path.join(jail.root, TOKENS);
  if (!fs.existsSync(abs)) throw new Error("This app has no src/styles/tokens.css, so its colours can't be changed here.");
  if (!cfg.brand.length) throw new Error("Choose at least one brand colour.");
  const palette = buildPalette(cfg);
  let css = fs.readFileSync(abs, "utf8");
  const changed: string[] = [];
  // The ramp block: replaced whole when it exists, else added at the end of the first :root block.
  const block = `${PALETTE_START}\n${Object.entries(rampTokens(palette)).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n${PALETTE_END}\n`;
  const at = css.indexOf(PALETTE_START);
  const end = css.indexOf(PALETTE_END);
  let next: string;
  if (at >= 0 && end > at) next = css.slice(0, at) + block + css.slice(css.indexOf("\n", end) + 1);
  else {
    const rootEnd = css.indexOf("}", css.indexOf(":root"));
    if (rootEnd < 0) throw new Error("Couldn't find the :root block in tokens.css.");
    next = `${css.slice(0, rootEnd).replace(/\s*$/, "\n")}\n${block}${css.slice(rootEnd)}`;
  }
  if (next !== css) {
    css = next;
    changed.push("ramps");
  }
  css = setTokenValues(css, "default", roleTokens(palette, false), changed);
  // The dark theme follows the palette: written from it, switched only by data-theme (never the computer's setting).
  const withDark = withDarkTheme(css, palette);
  if (withDark !== css) {
    css = withDark;
    changed.push("dark theme");
  }
  saveDesign(jail, { palette: cfg });
  return { ...writeTokens(jail, ops, ctx, css, changed), palette };
}

const COMPONENTS_CSS = "src/styles/components.css";
const STYLES_START = "/* FlowCode component settings (Styles → Design → Configure). Edited there; written over on save. */";
const STYLES_END = "/* End of FlowCode component settings */";

/** The component settings saved for this app (block → option → choice). */
export function componentStylesOf(jail: PathJail): ComponentStyleValues {
  return (readDesign(jail).componentStyles as ComponentStyleValues | undefined) ?? {};
}

/**
 * A component's Configure: saves its choices and rewrites the managed block at the end of components.css with the CSS
 * for every configured component (one snapshot, so Undo puts it back). Works on any app built from the kit.
 */
export function applyComponentStyle(jail: PathJail, ops: FileOperations, ctx: { projectId: string; runId: string }, block: string, values: Record<string, string>): { snapshotId?: string; changed: string[]; css: string } {
  // Size works on any of the kit's components; other options only where the component has them.
  const spec = CONFIGURABLE_BLOCKS.includes(block) || block in uiGallery() ? componentStyleSpec(block) : undefined;
  if (!spec) throw new Error(`${block} has no options to configure here.`);
  const clean: Record<string, string> = {};
  for (const o of spec.options) if (values[o.id] && o.choices.some((c) => c.id === values[o.id])) clean[o.id] = values[o.id];
  const all = { ...componentStylesOf(jail), [block]: clean };
  const abs = path.join(jail.root, COMPONENTS_CSS);
  if (!fs.existsSync(abs)) throw new Error("This app has no src/styles/components.css, so its components can't be configured here.");
  const before = fs.readFileSync(abs, "utf8");
  const css = componentStylesCss(all);
  const at = before.indexOf(STYLES_START);
  const end = before.indexOf(STYLES_END);
  const base = at >= 0 && end > at ? before.slice(0, at).replace(/\s*$/, "\n") + before.slice(end + STYLES_END.length).replace(/^\s*\n/, "") : before;
  const next = css ? `${base.replace(/\s*$/, "\n")}\n${STYLES_START}\n${css}\n${STYLES_END}\n` : base;
  saveDesign(jail, { componentStyles: all });
  if (next === before) return { changed: [], css };
  const r = ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, COMPONENTS_CSS, next);
  if (!r.ok) throw new Error(r.message);
  return { snapshotId: r.snapshotIds[0], changed: [block], css };
}

/** The saved palette, or one started from the app's current accent colour. */
/**
 * What the app's tokens say now, for the named custom properties, in the light theme. Used to keep the look the
 * person or the build gave an app before a ready-made design style overwrites it, so "Custom" can put it back.
 * A name the stylesheet does not define is left out rather than guessed.
 */
export function tokenValues(jail: PathJail, names: readonly string[]): Record<string, string> {
  let decls: ReturnType<typeof parseCustomProperties>;
  try {
    decls = parseCustomProperties(fs.readFileSync(path.join(jail.root, TOKENS), "utf8"));
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const name of names) {
    const d = decls.find((x) => x.name === name && !isDark(x.selectors));
    if (d) out[name] = d.value;
  }
  return out;
}
export function paletteOf(jail: PathJail): { config: PaletteConfig; saved: boolean } {
  const saved = readDesign(jail).palette as PaletteConfig | undefined;
  if (saved?.brand?.length) return { config: saved, saved: true };
  let accent = "";
  try {
    accent = parseCustomProperties(fs.readFileSync(path.join(jail.root, TOKENS), "utf8")).find((d) => d.name === "--color-accent" && !isDark(d.selectors))?.value ?? "";
  } catch {
    /* no tokens */
  }
  return { config: paletteFromTokens({ "--color-accent": accent }), saved: false };
}

function readDesign(jail: PathJail): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(jail.root, DESIGN), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
function saveDesign(jail: PathJail, patch: Record<string, unknown>) {
  const abs = path.join(jail.root, DESIGN);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify({ ...readDesign(jail), ...patch }, null, 2)}\n`);
}

export interface DesignComponents {
  /** Building blocks the user picked; undefined until they pick (the sheet then shows the ones the app uses). */
  components?: string[];
  /** Every starter building block that can be added, with a readable name. */
  catalogue: Array<{ block: string; label: string }>;
}

const LABELS: Record<string, string> = {
  "ui-shell": "Top Nav / App Bar",
  "ui-btn": "Button",
  "ui-card": "Card",
  "ui-field": "Text field",
  "ui-badge": "Badge",
  "ui-notice": "Notice",
  "ui-tabs": "Tabs",
  "ui-switch": "Switch",
  "ui-settings": "Settings list",
  "ui-stat": "Stat",
  "ui-trend": "Trend",
  "ui-progress": "Progress bar",
  "ui-avatar": "Avatar",
  "ui-empty": "Empty state",
  "ui-skeleton": "Loading skeleton",
  "ui-page-header": "Page header",
  "ui-section": "Section",
  "ui-checklist": "Checklist",
  "ui-activity": "Activity feed",
  "ui-table": "Table",
  "ui-chart": "Chart",
  "ui-hero": "Hero",
  "ui-tile": "Tile",
  "ui-grid": "Grid",
  // The catalog classes the kit's Button, Card, ... now render (the ui-* ones above stay for apps built before the merge).
  "fl-btn": "Button",
  "fl-card": "Card",
  "fl-ctl-badge": "Badge",
  "fl-ctl-alert": "Notice",
  "fl-ctl-tabset": "Tabs",
  "fl-ctl-switch": "Switch",
  "fl-crd-kpi": "Stat",
  "fl-ctl-bar": "Progress bar",
  "fl-ctl-avatar": "Avatar",
  "fl-spec-empty": "Empty state",
  "fl-ctl-skel": "Loading skeleton",
  "fl-ctl-dlg": "Dialog",
  "fl-ctl-tbl": "Table",
};
export const blockLabel = (block: string) => LABELS[block] ?? block.replace(/^ui-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** A building block of the starter kit: a ui-* class, or a catalog class the kit's Button, Card... now render. */
const isKitBlock = (c: string) => c.startsWith("ui-") || (c in LABELS && /^fl-(ctl|crd|spec)-|^fl-(btn|card)$/.test(c));

/** Picks from the Add components catalogue that are a starter building block under another name. */
const KIT_ALIAS: Record<string, string> = { "top-nav": "ui-shell" };
const unalias = (list: string[]) => [...new Set(list.map((c) => KIT_ALIAS[c] ?? c))];

export function designComponents(jail: PathJail): DesignComponents {
  const catalogue = Object.keys(uiGallery()).map((block) => ({ block, label: blockLabel(block) }));
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(jail.root, DESIGN), "utf8")) as { components?: unknown };
    // Calendar design rebuild: "Top Nav / App Bar" was added but never shown, because the app bar is AppShell (.ui-shell).
    const components = Array.isArray(saved.components) ? unalias(saved.components.filter((x): x is string => typeof x === "string")) : undefined;
    return { components, catalogue };
  } catch {
    return { catalogue };
  }
}

export function setDesignComponents(jail: PathJail, components: string[]): DesignComponents {
  const known = new Set(Object.keys(uiGallery()));
  const clean = [...new Set(unalias(components).filter((c) => /^[\w-]{1,60}$/.test(c)))].filter((c) => known.has(c) || !isKitBlock(c)).slice(0, 60);
  const abs = path.join(jail.root, DESIGN);
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(fs.readFileSync(abs, "utf8")) as Record<string, unknown>;
  } catch {
    /* new file */
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify({ ...saved, components: clean }, null, 2)}\n`);
  return designComponents(jail);
}

/**
 * For the builder: the building blocks to build this app from. The studio's picks when the user made them, and
 * otherwise the whole starter kit, because sending nothing is what let a build improvise its own screens beside the
 * library it had been given (Prayer app: design.json held a palette and no components, so this brief was empty, the
 * step fell back to generic guidance, and the nine sections copied into src/sections were never imported).
 */
export function designBrief(jail: PathJail): string {
  const { components } = designComponents(jail);
  // The frame App.tsx actually renders (appFrame.resolveFrame): when it isn't the kit's AppShell (.ui-shell), the kit's
  // top bar isn't the app's, and naming it sent a design step to restyle rules nothing renders (Clean Cart slice eval 1:
  // its frame is LookupFrame, fl-lkf-*). The app's own frame is named instead.
  const frame = resolveFrame(jail.root);
  const ownFrame = frame && !frame.classes.some((c) => c.startsWith("ui-shell")) ? frame : undefined;
  if (!components?.length) {
    const kit = Object.keys(uiGallery()).filter((c) => !(ownFrame && c === "ui-shell"));
    return kit.length
      ? `No building blocks were picked in the design studio, so the app's whole starter kit is what to build with (use these from src/components/ui for these jobs; don't make new ones): ${kit.map((c) => `${blockLabel(c)} (.${c})`).join(", ")}.${ownFrame ? ` The app's frame (top bar and navigation) is ${ownFrame.component} (${ownFrame.file}, classes ${ownFrame.classes.slice(0, 4).map((c) => `.${c}`).join(", ")}): restyle it through those classes.` : ""}`
      : "";
  }
  const kit = components.filter(isKitBlock);
  // Picks from the Add components catalogue that the starter kit doesn't have (dropdowns, sliders, steppers…).
  const wanted = components.filter((c) => !isKitBlock(c) && /^[a-z]+(-[a-z]+)*$/.test(c));
  const parts = [
    kit.length ? `Building blocks chosen for this app in the design studio (use these from src/components/ui for these jobs; don't make new ones): ${kit.map((c) => `${blockLabel(c)} (.${c})`).join(", ")}.` : "",
    wanted.length ? `Also chosen, not in the kit yet: ${wanted.map((c) => c.replace(/-/g, " ")).join(", ")}. When a screen needs one, build it once as a reusable component in src/components/ui, styled only with the design tokens, and reuse it.` : "",
  ];
  return parts.filter(Boolean).join("\n");
}
