/**
 * Component library: the reusable parts a project already has, so the Styles tab can show them as a visual style
 * sheet and coding agents reuse them instead of writing new ones.
 *  - Primitives: CSS class families (block, block--modifier, block__element) from the app's own stylesheets, with
 *    real usage samples taken from the JSX (tag, classes, text) for a static preview rendered with the app's CSS.
 *  - Components: exported React components with their props, summary, where they're used and a usage example.
 * Results are cached per workspace until a source file changes.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { PathJail } from "../security/pathJail.js";
import { isReferencePath } from "../quality/tokens.js";
import { flattenFiles } from "./fileService.js";
import { localizeSample, readProjectWords } from "./projectWords.js";
import { fileURLToPath } from "node:url";
import { designBrief } from "./designStudio.js";

/**
 * Real markup for the starter's building blocks (templates/ui-gallery.json, made by npm run build:ui-gallery from the
 * actual components). The Components view draws these with the app's own stylesheets, so a preview shows a real
 * button, tab bar or card in the app's surface style instead of a class name scraped from the code.
 */
type Gallery = Record<string, UiSample[]>;
let gallery: Gallery | undefined;
export function uiGallery(): Gallery {
  if (gallery) return gallery;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dirs = [process.env.FLOWCODE_TEMPLATES_DIR, path.resolve(here, "../../../../templates"), path.resolve(here, "../../../templates"), path.resolve(process.cwd(), "templates")].filter((d): d is string => !!d);
  for (const d of dirs) {
    try {
      gallery = JSON.parse(fs.readFileSync(path.join(d, "ui-gallery.json"), "utf8")) as Gallery;
      return gallery;
    } catch {
      /* try the next place */
    }
  }
  gallery = {};
  return gallery;
}

/** Building-block components and the CSS block each one renders, so <Button> counts as a use of .ui-btn. */
const COMPONENT_BLOCK: Record<string, string> = {
  AppShell: "ui-shell", PageHeader: "ui-page-header", Section: "ui-section", Card: "ui-card", Button: "ui-btn", Field: "ui-field", EmptyState: "ui-empty", Skeleton: "ui-skeleton", Stat: "ui-stat", Badge: "ui-badge", Notice: "ui-notice", Dialog: "ui-dialog",
  Grid: "ui-grid", Trend: "ui-trend", Progress: "ui-progress", BarChart: "ui-chart", DataTable: "ui-table", Checklist: "ui-checklist", Avatar: "ui-avatar", ActivityList: "ui-activity", Hero: "ui-hero", ActionTile: "ui-tile", Tabs: "ui-tabs", SettingsList: "ui-settings", SettingRow: "ui-setting", Switch: "ui-switch",
};
/** The building blocks' own definitions: their markup is the block, not a use of it. */
const isKitFile = (rel: string) => /(^|\/)components\/ui\//.test(rel);

export interface UiProp {
  name: string;
  optional: boolean;
  type?: string;
}
export interface UiComponent {
  name: string;
  file: string;
  line: number;
  kind: "component" | "page";
  summary?: string;
  props: UiProp[];
  uses: number;
  usedIn: string[];
  example?: string;
  /** Angular: the tag that places it, e.g. app-event-card. */
  selector?: string;
}
export interface UiSample {
  label: string;
  html: string;
}
export interface UiPrimitive {
  block: string;
  file: string;
  line: number;
  modifiers: string[];
  elements: string[];
  uses: number;
  samples: UiSample[];
}
export interface ComponentLibrary {
  components: UiComponent[];
  primitives: UiPrimitive[];
  /** The app's stylesheets, concatenated, for rendering previews. */
  css: string;
  cssFiles: string[];
  /** A compact list for coding agents: what exists and should be reused. */
  brief: string;
}

const SKIP = /(^|\/)(node_modules|dist|build|out|coverage|\.git|\.next|\.flowcode[^/]*|vendor)\//;
const MAX_CSS_BYTES = 400_000;
const cache = new Map<string, { sig: string; lib: ComponentLibrary }>();

const appFiles = (jail: PathJail) => flattenFiles(jail, 8000).filter((f) => !SKIP.test(`/${f}`) && !isReferencePath(f));

function signature(jail: PathJail, files: string[]): string {
  let latest = 0;
  for (const f of files) {
    try {
      latest = Math.max(latest, fs.statSync(path.join(jail.root, f)).mtimeMs);
    } catch {
      /* gone */
    }
  }
  return `${files.length}:${latest}`;
}

export function scanComponentLibrary(jail: PathJail): ComponentLibrary {
  const files = appFiles(jail);
  const relevant = files.filter((f) => /\.(css|scss|tsx|jsx)$/i.test(f) || /\.component\.(ts|html)$/i.test(f));
  const sig = signature(jail, [...relevant, ...files.filter((f) => /^spec\/[^/]+\.md$/i.test(f))]);
  // The building blocks picked in the design studio lead the brief (read fresh: the cache follows source files only).
  const withDesign = (lib: ComponentLibrary): ComponentLibrary => {
    const design = designBrief(jail);
    return design ? { ...lib, brief: `${design}
${lib.brief}` } : lib;
  };
  const hit = cache.get(jail.root);
  if (hit && hit.sig === sig) return withDesign(hit.lib);

  const read = (rel: string) => {
    try {
      const abs = path.join(jail.root, rel);
      return fs.statSync(abs).size > MAX_CSS_BYTES ? "" : fs.readFileSync(abs, "utf8");
    } catch {
      return "";
    }
  };
  const sources = relevant.filter((f) => /\.(tsx|jsx)$/i.test(f) && !/\.(test|spec|stories)\./.test(f)).map((rel) => ({ rel, text: read(rel) }));
  const cssFiles = relevant.filter((f) => /\.(css|scss)$/i.test(f));
  const css = cssFiles.map((rel) => ({ rel, text: read(rel) }));

  const angular = relevant.filter((f) => /\.component\.(ts|html)$/i.test(f) && !/\.spec\./.test(f)).map((rel) => ({ rel, text: read(rel) }));
  const components = [...findComponents(sources), ...findAngularComponents(angular)];
  const primitives = findPrimitives(css, sources);
  // Kit samples speak the project's language (its PRD or screens) instead of the kit's calendar example.
  const words = readProjectWords(jail.root);
  if (words) for (const p of primitives) p.samples = p.samples.map((x) => ({ ...x, html: localizeSample(x.html, words) }));
  const lib: ComponentLibrary = {
    components,
    primitives,
    css: css.map((c) => `/* ${c.rel} */\n${c.text}`).join("\n").slice(0, MAX_CSS_BYTES),
    cssFiles: css.map((c) => c.rel),
    brief: "",
  };
  lib.brief = reuseBrief(lib);
  cache.set(jail.root, { sig, lib });
  return withDesign(lib);
}

// ───────────────────────── React components ─────────────────────────

function findComponents(sources: Array<{ rel: string; text: string }>): UiComponent[] {
  const out: UiComponent[] = [];
  for (const { rel, text } of sources) {
    // Entry points and the root App aren't reusable parts.
    if (/(^|\/)(main|index|App)\.(tsx|jsx)$/.test(rel)) continue;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const types = new Map<string, ts.TypeElement[] | ts.TypeNode>();
    for (const st of sf.statements) {
      if (ts.isInterfaceDeclaration(st)) types.set(st.name.text, [...st.members]);
      else if (ts.isTypeAliasDeclaration(st)) types.set(st.name.text, ts.isTypeLiteralNode(st.type) ? [...st.type.members] : st.type);
    }
    const exported = (n: ts.Node) => !!ts.getCombinedModifierFlags(n as ts.Declaration) && (ts.getCombinedModifierFlags(n as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
    const consider = (name: string, fn: ts.SignatureDeclaration & { body?: ts.Node }, at: ts.Node) => {
      if (!/^[A-Z]/.test(name) || !fn.body || !hasJsx(fn.body)) return;
      out.push({
        name,
        file: rel,
        line: sf.getLineAndCharacterOfPosition(at.getStart(sf)).line + 1,
        kind: /(^|\/)(pages?|views?|routes?|screens?)\//i.test(rel) ? "page" : "component",
        summary: jsdoc(at, sf),
        props: propsOf(fn, types, sf),
        uses: 0,
        usedIn: [],
      });
    };
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name && exported(st)) consider(st.name.text, st, st);
      else if (ts.isVariableStatement(st) && exported(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) consider(d.name.text, d.initializer, st);
        }
      }
    }
  }
  // Where each component is used, with the first usage as an example.
  for (const c of out) {
    const re = new RegExp(`<${c.name}(?=[\\s/>])`, "g");
    for (const { rel, text } of sources) {
      if (rel === c.file) continue;
      const n = (text.match(re) ?? []).length;
      if (!n) continue;
      c.uses += n;
      c.usedIn.push(rel);
      if (!c.example) {
        const m = new RegExp(`<${c.name}[\\s\\S]*?\\/?>`).exec(text);
        if (m) c.example = m[0].replace(/\s+/g, " ").slice(0, 220);
      }
    }
  }
  return out.sort((a, b) => Number(a.kind === "page") - Number(b.kind === "page") || b.uses - a.uses || a.name.localeCompare(b.name));
}

// ───────────────────────── Angular components ─────────────────────────

/**
 * Angular components: classes decorated with @Component, their selector, inputs (@Input() properties and input()
 * signals) and where their tag appears in templates (.component.html files and inline templates).
 */
export function findAngularComponents(files: Array<{ rel: string; text: string }>): UiComponent[] {
  const out: UiComponent[] = [];
  const templates = files.filter((f) => /\.html$/i.test(f.rel));
  for (const { rel, text } of files.filter((f) => /\.ts$/i.test(f.rel))) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const st of sf.statements) {
      if (!ts.isClassDeclaration(st) || !st.name) continue;
      const deco = ts.getDecorators(st)?.find((d) => ts.isCallExpression(d.expression) && d.expression.expression.getText(sf) === "Component");
      if (!deco || !ts.isCallExpression(deco.expression)) continue;
      const meta = deco.expression.arguments[0];
      const prop = (name: string) => (meta && ts.isObjectLiteralExpression(meta) ? meta.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === name) : undefined);
      const sel = prop("selector")?.initializer;
      const selector = sel && ts.isStringLiteralLike(sel) ? sel.text : undefined;
      const inline = prop("template")?.initializer;
      if (inline && (ts.isStringLiteralLike(inline) || ts.isNoSubstitutionTemplateLiteral(inline))) templates.push({ rel, text: inline.text });
      const props: UiProp[] = [];
      for (const m of st.members) {
        if (!ts.isPropertyDeclaration(m) || !m.name) continue;
        const name = m.name.getText(sf);
        const decorated = ts.getDecorators(m)?.some((d) => /^Input\b/.test(d.expression.getText(sf)));
        const init = m.initializer && ts.isCallExpression(m.initializer) ? m.initializer.expression.getText(sf) : "";
        if (decorated) props.push({ name, optional: !!m.questionToken || !!m.initializer, type: m.type?.getText(sf).slice(0, 60) });
        else if (init === "input" || init === "input.required" || init === "model" || init === "model.required")
          props.push({ name, optional: !init.endsWith("required"), type: (m.initializer as ts.CallExpression).typeArguments?.[0]?.getText(sf).slice(0, 60) });
      }
      out.push({
        name: st.name.text,
        file: rel,
        line: sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1,
        kind: /(^|\/)(pages?|views?|routes?|screens?)\//i.test(rel) || /Page(Component)?$/.test(st.name.text) ? "page" : "component",
        summary: jsdoc(st, sf),
        props,
        uses: 0,
        usedIn: [],
        selector,
      });
    }
  }
  for (const c of out) {
    if (!c.selector || !/^[a-z][\w-]*$/.test(c.selector)) continue;
    const tag = new RegExp(`<${c.selector}(?=[\\s/>])`, "g");
    for (const t of templates) {
      if (t.rel.replace(/\.(ts|html)$/, "") === c.file.replace(/\.ts$/, "")) continue;
      const n = (t.text.match(tag) ?? []).length;
      if (!n) continue;
      c.uses += n;
      if (!c.usedIn.includes(t.rel)) c.usedIn.push(t.rel);
      if (!c.example) {
        const m = new RegExp(`<${c.selector}[\\s\\S]*?>`).exec(t.text);
        if (m) c.example = m[0].replace(/\s+/g, " ").slice(0, 220);
      }
    }
  }
  return out;
}

function hasJsx(node: ts.Node): boolean {
  let found = false;
  const walk = (n: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    else ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

function jsdoc(node: ts.Node, sf: ts.SourceFile): string | undefined {
  const ranges = ts.getLeadingCommentRanges(sf.text, node.getFullStart()) ?? [];
  const doc = ranges.map((r) => sf.text.slice(r.pos, r.end)).filter((t) => t.startsWith("/**")).at(-1);
  if (!doc) return undefined;
  const text = doc.replace(/^\/\*\*|\*\/$/g, "").split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join(" ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 200) : undefined;
}

function propsOf(fn: ts.SignatureDeclaration, types: Map<string, ts.TypeElement[] | ts.TypeNode>, sf: ts.SourceFile): UiProp[] {
  const p = fn.parameters[0];
  if (!p) return [];
  const fromMembers = (members: readonly ts.TypeElement[]) =>
    members
      .filter((m): m is ts.PropertySignature => ts.isPropertySignature(m) && !!m.name)
      .map((m) => ({ name: m.name.getText(sf), optional: !!m.questionToken, type: m.type ? m.type.getText(sf).replace(/\s+/g, " ").slice(0, 60) : undefined }));
  if (p.type) {
    if (ts.isTypeLiteralNode(p.type)) return fromMembers(p.type.members);
    if (ts.isTypeReferenceNode(p.type)) {
      const t = types.get(p.type.typeName.getText(sf));
      if (Array.isArray(t)) return fromMembers(t);
    }
  }
  if (ts.isObjectBindingPattern(p.name)) return p.name.elements.map((e) => ({ name: e.name.getText(sf), optional: !!e.initializer }));
  return [];
}

// ───────────────────────── CSS primitives ─────────────────────────

/** The base of a BEM-style class: "button--ghost" → "button", "field__input" → "field". */
const blockOf = (cls: string) => cls.split(/__|--/)[0];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Layout and state classes that aren't reusable parts on their own.
const NOT_PRIMITIVE = /^(is|has|js|u|sr|visually)-|^(sr-only|hidden|active|open|selected|disabled|container|wrapper|row|col)$/;

function findPrimitives(css: Array<{ rel: string; text: string }>, sources: Array<{ rel: string; text: string }>): UiPrimitive[] {
  const blocks = new Map<string, UiPrimitive>();
  for (const { rel, text } of css) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
    for (const m of clean.matchAll(/([^{}@;]+)\{/g)) {
      const line = clean.slice(0, m.index).split("\n").length;
      for (const c of m[1].matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
        const cls = c[1];
        const block = blockOf(cls);
        if (!block || NOT_PRIMITIVE.test(block) || NOT_PRIMITIVE.test(cls)) continue;
        const b = blocks.get(block) ?? { block, file: rel, line, modifiers: [], elements: [], uses: 0, samples: [] };
        const mod = /--([\w-]+)$/.exec(cls)?.[1];
        const el = /__([\w-]+?)(?:--|$)/.exec(cls)?.[1];
        if (mod && !b.modifiers.includes(mod)) b.modifiers.push(mod);
        if (el && !b.elements.includes(el)) b.elements.push(el);
        blocks.set(block, b);
      }
    }
  }
  // Usage and real samples from the JSX: tag, static classes and text.
  for (const { rel, text } of sources) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      const open = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined;
      if (open && ts.isIdentifier(open.tagName) && COMPONENT_BLOCK[open.tagName.text] && !isKitFile(rel)) {
        const b = blocks.get(COMPONENT_BLOCK[open.tagName.text]);
        if (b) b.uses++;
      }
      if (open && ts.isIdentifier(open.tagName) && /^[a-z]/.test(open.tagName.text) && !isKitFile(rel)) {
        const classes = staticClasses(open, sf);
        const families = [...new Set(classes.map(blockOf))].filter((b) => blocks.has(b));
        for (const fam of families) {
          const b = blocks.get(fam)!;
          b.uses++;
          // One sample per variant (class combination), up to four.
          const label = classes.filter((c) => blockOf(c) === fam).join(" ");
          if (b.samples.length < 4 && !b.samples.some((s) => s.label === label)) {
            b.samples.push({ label, html: sampleHtml(open.tagName.text, classes.filter((c) => blockOf(c) === fam), ts.isJsxElement(n) ? childText(n, sf) : "", fam) });
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // Modifiers that never appeared in a sample get one built from the base sample.
  for (const b of blocks.values()) {
    // Build from the plain block sample when there is one, so "button--danger" isn't also "button--ghost".
    const base = b.samples.find((s) => s.label === b.block) ?? b.samples[0];
    if (!base) continue;
    for (const mod of b.modifiers) {
      if (b.samples.length >= 6 || b.samples.some((s) => s.label.includes(`${b.block}--${mod}`))) continue;
      const plain = base.label.split(" ").filter((c) => !c.startsWith(`${b.block}--`)).join(" ");
      const html = base.html.replace(/class="([^"]*)"/, () => `class="${plain} ${b.block}--${mod}"`);
      b.samples.push({ label: `${b.block} ${b.block}--${mod}`, html });
    }
  }
  // Blocks from the starter's kit show its real markup instead of scraped samples.
  const kit = uiGallery();
  for (const b of blocks.values()) if (kit[b.block]?.length) b.samples = kit[b.block].map((x) => ({ ...x }));
  return [...blocks.values()].filter((b) => b.uses > 0).sort((a, b) => b.uses - a.uses || a.block.localeCompare(b.block)).slice(0, 40);
}

/** Static class names on a JSX element: string literals, and the fixed parts of template literals. */
function staticClasses(open: ts.JsxOpeningLikeElement, sf: ts.SourceFile): string[] {
  const attr = open.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "className");
  const init = attr?.initializer;
  if (!init) return [];
  const parts: string[] = [];
  const take = (e: ts.Node) => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) parts.push(e.text);
    else if (ts.isTemplateExpression(e)) {
      parts.push(e.head.text);
      // Only the text before a ${…} on each span counts when it ends in whitespace (a separate class).
      for (const s of e.templateSpans) parts.push(s.literal.text.replace(/^\S*/, ""));
    } else if (ts.isJsxExpression(e) && e.expression) take(e.expression);
  };
  take(init);
  return parts.join(" ").split(/\s+/).filter((c) => /^-?[a-zA-Z_][\w-]*$/.test(c));
}

function childText(n: ts.JsxElement, sf: ts.SourceFile): string {
  const bits: string[] = [];
  for (const c of n.children) {
    if (ts.isJsxText(c)) bits.push(c.getText(sf));
    else if (ts.isJsxExpression(c) && c.expression && (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression))) bits.push(c.expression.text);
    else if (ts.isJsxElement(c)) bits.push(childText(c, sf));
  }
  return bits.join(" ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function sampleHtml(tag: string, classes: string[], text: string, block: string): string {
  const cls = esc(classes.join(" "));
  const label = esc(text || block.replace(/[-_]/g, " "));
  if (tag === "input") return `<input class="${cls}" value="${label}" readonly>`;
  if (tag === "textarea") return `<textarea class="${cls}" readonly>${label}</textarea>`;
  if (tag === "select") return `<select class="${cls}"><option>${label}</option></select>`;
  if (["img", "br", "hr", "svg", "canvas", "video", "iframe"].includes(tag)) return `<div class="${cls}"></div>`;
  return `<${tag} class="${cls}">${label}</${tag}>`;
}

// ───────────────────────── For coding agents ─────────────────────────

/** A short, prompt-sized list of what to reuse. */
export function reuseBrief(lib: ComponentLibrary, maxChars = 1600): string {
  const comps = lib.components.filter((c) => c.kind === "component");
  if (!comps.length && !lib.primitives.length) return "";
  const compLines = comps.map((c) => `- ${c.name}${c.selector ? ` <${c.selector}>` : ""} (${c.file})${c.props.length ? `: ${c.props.map((p) => p.name + (p.optional ? "?" : "")).join(", ")}` : ""}${c.summary ? `. ${c.summary.split(/(?<=\.)\s/)[0].replace(/\.$/, "").slice(0, 70)}` : ""}`);
  const classLines = lib.primitives.map((p) => {
    const extra = [p.modifiers.length ? `variants ${p.modifiers.map((m) => `--${m}`).join(" ")}` : "", p.elements.length ? `parts ${p.elements.slice(0, 6).map((e) => `__${e}`).join(" ")}` : ""].filter(Boolean).join("; ");
    return `- .${p.block}${extra ? ` (${extra})` : ""}`;
  });
  // Components and classes share the budget, so neither crowds the other out.
  const fit = (title: string, list: string[], budget: number) => {
    let out = "";
    for (const l of list) {
      if (out.length + l.length + 1 > budget) break;
      out += `${l}\n`;
    }
    return out ? `${title}\n${out}` : "";
  };
  const head = "REUSABLE PARTS ALREADY IN THIS PROJECT. Use and extend these; don't write new components or CSS classes that do the same job.\n";
  const room = maxChars - head.length;
  const compBudget = classLines.length ? Math.floor(room * 0.55) : room;
  const compText = fit("Components:", compLines, compBudget);
  const classText = fit("CSS classes:", classLines, room - compText.length);
  return (head + compText + classText).trimEnd();
}
