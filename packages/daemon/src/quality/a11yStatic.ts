/**
 * Static accessibility checks (FR-Q1, §13.3). Uses the TypeScript compiler API for JSX/TSX and parse5
 * for HTML — never regex for structured source. Results are findings, not conformance claims.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import type { Finding } from "@flowcode/contracts";
import { flattenFiles } from "../workspace/fileService.js";
import type { PathJail } from "../security/pathJail.js";
import { parseTokens, contrastRatio } from "./tokens.js";

let seq = 0;
const f = (x: Omit<Finding, "id" | "category" | "source" | "manualValidationRequired"> & Partial<Finding>): Finding => ({
  id: `a11y_${++seq}`,
  category: "accessibility",
  source: "static",
  manualValidationRequired: false,
  ...x,
});

interface JsxEl {
  tag: string;
  attrs: Map<string, ts.JsxAttributeLike>;
  node: ts.JsxElement | ts.JsxSelfClosingElement;
  hasText: boolean;
  parentTags: string[];
}

function attrName(a: ts.JsxAttributeLike): string | undefined {
  return ts.isJsxAttribute(a) ? a.name.getText() : undefined;
}

function staticAttrValue(a: ts.JsxAttributeLike | undefined): string | undefined {
  if (!a || !ts.isJsxAttribute(a) || !a.initializer) return undefined;
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
  if (ts.isJsxExpression(a.initializer) && a.initializer.expression && ts.isStringLiteral(a.initializer.expression)) return a.initializer.expression.text;
  return undefined;
}

function collectJsx(sf: ts.SourceFile): JsxEl[] {
  const out: JsxEl[] = [];
  const visit = (node: ts.Node, parents: string[]) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(sf);
      const attrs = new Map<string, ts.JsxAttributeLike>();
      for (const a of opening.attributes.properties) {
        const n = attrName(a);
        if (n) attrs.set(n, a);
        else attrs.set("{...spread}", a);
      }
      const hasText = ts.isJsxElement(node) && node.children.some((c) => (ts.isJsxText(c) && c.text.trim().length > 0) || ts.isJsxExpression(c) || ts.isJsxElement(c));
      out.push({ tag, attrs, node, hasText, parentTags: parents });
      ts.forEachChild(node, (c) => visit(c, [...parents, tag]));
      return;
    }
    ts.forEachChild(node, (c) => visit(c, parents));
  };
  visit(sf, []);
  return out;
}

export function staticAccessibility(jail: PathJail): Finding[] {
  seq = 0;
  const findings: Finding[] = [];
  const files = flattenFiles(jail).filter((p) => /\.(tsx|jsx)$/.test(p) && !/\.test\./.test(p));
  const allIds = new Set<string>();
  const labelFor = new Set<string>();
  const perFile: Array<{ rel: string; sf: ts.SourceFile; els: JsxEl[] }> = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(jail.root, rel), "utf8");
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const els = collectJsx(sf);
    perFile.push({ rel, sf, els });
    for (const e of els) {
      const id = e.attrs.get("id");
      if (id) allIds.add(staticAttrValue(id) ?? "{dynamic}");
      if (e.tag === "label" && e.attrs.get("htmlFor")) labelFor.add(staticAttrValue(e.attrs.get("htmlFor")) ?? "{dynamic}");
    }
  }
  const headingLevels: Array<{ rel: string; level: number; line: number }> = [];
  for (const { rel, sf, els } of perFile) {
    const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    for (const e of els) {
      const has = (a: string) => e.attrs.has(a) || e.attrs.has("{...spread}");
      const ariaNamed = has("aria-label") || has("aria-labelledby") || has("title");
      if (e.tag === "img" && !has("alt")) findings.push(f({ rule: "img-alt", severity: "serious", confidence: "high", message: "<img> without alt text", path: rel, line: line(e.node), recommendation: 'Add alt="" for decorative images or a description for informative ones.' }));
      if ((e.tag === "input" || e.tag === "select" || e.tag === "textarea") && staticAttrValue(e.attrs.get("type")) !== "hidden") {
        const id = staticAttrValue(e.attrs.get("id"));
        const wrapped = e.parentTags.includes("label");
        const labelled = ariaNamed || wrapped || (id !== undefined && labelFor.has(id)) || (e.attrs.get("id") && labelFor.has("{dynamic}"));
        if (!labelled) findings.push(f({ rule: "form-label", severity: "serious", confidence: id ? "high" : "medium", message: `<${e.tag}> has no associated label`, path: rel, line: line(e.node), recommendation: "Associate a <label htmlFor> with the control id, wrap it in <label>, or add aria-label." }));
      }
      if (e.tag === "button" && !e.hasText && !ariaNamed) findings.push(f({ rule: "button-name", severity: "serious", confidence: "high", message: "<button> has no accessible name", path: rel, line: line(e.node), recommendation: "Add visible text or aria-label." }));
      if ((e.tag === "div" || e.tag === "span" || e.tag === "li") && e.attrs.has("onClick") && !(e.attrs.has("role") && e.attrs.has("tabIndex") && (e.attrs.has("onKeyDown") || e.attrs.has("onKeyUp"))))
        findings.push(f({ rule: "click-events-have-key-events", severity: "serious", confidence: "high", message: `Clickable <${e.tag}> is not keyboard accessible`, path: rel, line: line(e.node), recommendation: "Use a <button>, or add role, tabIndex=0 and key handlers." }));
      if (e.tag === "a" && !e.attrs.has("href") && !e.attrs.has("{...spread}")) findings.push(f({ rule: "anchor-is-valid", severity: "moderate", confidence: "high", message: "<a> without href", path: rel, line: line(e.node), recommendation: "Use a <button> for actions; links need href." }));
      if (e.tag === "a" && !e.hasText && !ariaNamed) findings.push(f({ rule: "link-name", severity: "serious", confidence: "high", message: "Link has no accessible name", path: rel, line: line(e.node) }));
      const tabIndex = e.attrs.get("tabIndex");
      if (tabIndex && ts.isJsxAttribute(tabIndex) && tabIndex.initializer && ts.isJsxExpression(tabIndex.initializer) && tabIndex.initializer.expression && ts.isNumericLiteral(tabIndex.initializer.expression) && Number(tabIndex.initializer.expression.text) > 0)
        findings.push(f({ rule: "tabindex-positive", severity: "moderate", confidence: "high", message: "Positive tabIndex breaks natural focus order", path: rel, line: line(e.node) }));
      if (e.attrs.has("autoFocus")) findings.push(f({ rule: "no-autofocus", severity: "minor", confidence: "high", message: "autoFocus can disorient screen-reader users", path: rel, line: line(e.node) }));
      const m = /^h([1-6])$/.exec(e.tag);
      if (m) headingLevels.push({ rel, level: Number(m[1]), line: line(e.node) });
      if (e.tag === "html" && !e.attrs.has("lang")) findings.push(f({ rule: "html-lang", severity: "serious", confidence: "high", message: "<html> without lang", path: rel, line: line(e.node) }));
    }
  }
  const h1s = headingLevels.filter((h) => h.level === 1);
  if (files.length && h1s.length === 0) findings.push(f({ rule: "page-has-heading-one", severity: "moderate", confidence: "medium", message: "No <h1> found in components", recommendation: "Provide one top-level heading per page." }));
  if (h1s.length > 1) findings.push(f({ rule: "single-h1", severity: "minor", confidence: "low", message: `${h1s.length} <h1> elements found across components`, path: h1s[1].rel, line: h1s[1].line, manualValidationRequired: true }));
  const levels = [...new Set(headingLevels.map((h) => h.level))].sort();
  for (let i = 1; i < levels.length; i++)
    if (levels[i] - levels[i - 1] > 1) findings.push(f({ rule: "heading-order", severity: "moderate", confidence: "low", message: `Heading levels skip from h${levels[i - 1]} to h${levels[i]}`, manualValidationRequired: true }));

  // HTML documents.
  for (const rel of flattenFiles(jail).filter((p) => /\.html?$/.test(p) && !p.includes("node_modules"))) {
    const doc = parseHtml(fs.readFileSync(path.join(jail.root, rel), "utf8")) as DefaultTreeAdapterMap["document"];
    const html = doc.childNodes.find((n) => n.nodeName === "html") as DefaultTreeAdapterMap["element"] | undefined;
    if (html && !html.attrs.some((a) => a.name === "lang" && a.value)) findings.push(f({ rule: "html-lang", severity: "serious", confidence: "high", message: "<html> is missing a lang attribute", path: rel, line: 1 }));
    const title = findEl(doc, "title");
    if (!title || !textOf(title).trim()) findings.push(f({ rule: "document-title", severity: "serious", confidence: "high", message: "Document has no <title>", path: rel }));
    const viewport = findAll(doc, "meta").find((m) => m.attrs.some((a) => a.name === "name" && a.value === "viewport"));
    const content = viewport?.attrs.find((a) => a.name === "content")?.value ?? "";
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(content)) findings.push(f({ rule: "meta-viewport", severity: "serious", confidence: "high", message: "Viewport disables zoom", path: rel }));
  }

  // CSS: focus indicators and reduced motion.
  const cssFiles = flattenFiles(jail).filter((p) => /\.css$/.test(p));
  let hasFocusVisible = false;
  let hasMotion = false;
  let respectsReducedMotion = false;
  for (const rel of cssFiles) {
    const css = fs.readFileSync(path.join(jail.root, rel), "utf8");
    if (/:focus-visible|:focus\b/.test(css)) hasFocusVisible = true;
    if (/(animation|transition)\s*:/.test(css)) hasMotion = true;
    if (/prefers-reduced-motion/.test(css)) respectsReducedMotion = true;
    css.split("\n").forEach((l, i) => {
      if (/outline\s*:\s*(none|0)\b/.test(l) && !/focus-visible/.test(css)) findings.push(f({ rule: "focus-visible", severity: "serious", confidence: "medium", message: "outline removed without a :focus-visible replacement", path: rel, line: i + 1 }));
    });
  }
  if (cssFiles.length && !hasFocusVisible) findings.push(f({ rule: "focus-indicator", severity: "moderate", confidence: "medium", message: "No :focus/:focus-visible styles found; relying on browser defaults", manualValidationRequired: true }));
  if (hasMotion && !respectsReducedMotion) findings.push(f({ rule: "reduced-motion", severity: "minor", confidence: "medium", message: "Animations/transitions without a prefers-reduced-motion override" }));

  // Contrast against semantic token roles.
  const tokens = parseTokens(jail);
  for (const pair of tokens.contrastPairs) {
    const fg = tokens.resolve(pair.fg);
    const bg = tokens.resolve(pair.bg);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio !== undefined && ratio < pair.min)
      findings.push(f({ rule: "color-contrast-tokens", severity: pair.min >= 4.5 ? "serious" : "moderate", confidence: "high", message: `Token pair ${pair.fg} on ${pair.bg} has contrast ${ratio.toFixed(2)}:1 (< ${pair.min}:1)`, path: tokens.file, recommendation: "Adjust the token values; do not override colors in component CSS." }));
  }
  return findings;
}

/** Items automation cannot verify (§13.3). Always included in reports. */
export const MANUAL_A11Y_CHECKLIST = [
  "Screen-reader walkthrough of the primary flow (create, edit, delete) announces names, roles and state changes",
  "Dynamic updates (saved/deleted/errors) are announced appropriately via live regions without excessive verbosity",
  "Meaning is not conveyed by color alone; icons have text alternatives",
  "Content reflows at 320 CSS px and 200% zoom without loss of function",
  "Focus order follows visual order and focus is never lost after dialogs or deletes",
  "Error messages identify the field and describe how to fix it",
];

function findEl(node: DefaultTreeAdapterMap["parentNode"], tag: string): DefaultTreeAdapterMap["element"] | undefined {
  return findAll(node, tag)[0];
}

function findAll(node: DefaultTreeAdapterMap["parentNode"], tag: string, out: DefaultTreeAdapterMap["element"][] = []): DefaultTreeAdapterMap["element"][] {
  for (const c of node.childNodes ?? []) {
    if ((c as DefaultTreeAdapterMap["element"]).tagName === tag) out.push(c as DefaultTreeAdapterMap["element"]);
    if ((c as DefaultTreeAdapterMap["parentNode"]).childNodes) findAll(c as DefaultTreeAdapterMap["parentNode"], tag, out);
  }
  return out;
}

function textOf(node: DefaultTreeAdapterMap["parentNode"]): string {
  return (node.childNodes ?? []).map((c) => ((c as DefaultTreeAdapterMap["textNode"]).value !== undefined ? (c as DefaultTreeAdapterMap["textNode"]).value : (c as DefaultTreeAdapterMap["parentNode"]).childNodes ? textOf(c as DefaultTreeAdapterMap["parentNode"]) : "")).join("");
}
