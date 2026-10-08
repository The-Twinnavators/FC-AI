/**
 * Deterministic design-quality checks (FR-Q2, §13.2): token discipline, raw style values, inline style
 * escapes, filler copy, generic patterns, state coverage and radius limits. Subjective critique is
 * kept separate (critique.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Finding } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";
import { isReferencePath, parseTokens } from "./tokens.js";

let seq = 0;
const f = (x: Omit<Finding, "id" | "category" | "source" | "manualValidationRequired"> & Partial<Finding>): Finding => ({ id: `design_${++seq}`, category: "design", source: "static", manualValidationRequired: false, ...x });

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const FILLER = /\blorem ipsum\b|\bdolor sit amet\b|\bTODO\b|\bFIXME\b|\bcoming soon\b|\bplaceholder text\b|\bsample text\b|\bclick here\b|\bunleash\b|\bseamless(ly)?\b|\brevolutioni[sz]e\b|\belevate your\b|\bunlock your potential\b|\bnext-generation\b|\ball-in-one\b|\bgame-changing\b|\bbuilt for the future\b|\bempower your\b|\beverything you need\b|\btransform (the way you work|your workflow)\b/i;

const GEOMETRY = /^(width|height|minWidth|minHeight|maxWidth|maxHeight|top|left|right|bottom|inset|insetInline\w*|insetBlock\w*|transform|gridRow\w*|gridColumn\w*|flexBasis|--[\w-]+)$/;

/**
 * style={{ height: `${pct}%` }}: sizes and positions computed from data (a chart bar, a progress fill, an event's
 * place on a time grid) can't be tokens, so they aren't escapes. A literal value, or any non-geometry property, still is.
 */
function dataDrivenGeometry(attr: ts.JsxAttribute): boolean {
  const init = attr.initializer;
  let obj = init && ts.isJsxExpression(init) ? init.expression : undefined;
  // `{ "--i": i } as CSSProperties` (a stagger index): look through the cast or brackets at the object itself.
  while (obj && (ts.isAsExpression(obj) || ts.isParenthesizedExpression(obj) || ts.isSatisfiesExpression(obj) || ts.isTypeAssertionExpression(obj))) obj = obj.expression;
  if (!obj || !ts.isObjectLiteralExpression(obj) || obj.properties.length === 0) return false;
  return obj.properties.every((p) => {
    if (ts.isShorthandPropertyAssignment(p)) return GEOMETRY.test(p.name.text);
    if (!ts.isPropertyAssignment(p)) return false;
    const name = ts.isStringLiteral(p.name) || ts.isIdentifier(p.name) ? p.name.text : "";
    const v = p.initializer;
    const literal = ts.isStringLiteral(v) || ts.isNumericLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v);
    return GEOMETRY.test(name) && !literal;
  });
}

/** Token names FlowCode's starter defines: the Styles page (palette, roles, type, space, surfaces) writes these. */
let starterNames: Set<string> | undefined;
function starterTokenNames(): Set<string> {
  if (starterNames) return starterNames;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const roots = [process.env.FLOWCODE_TEMPLATES_DIR, path.resolve(here, "../../../../templates"), path.resolve(here, "../../../templates"), path.resolve(process.cwd(), "templates")].filter((x): x is string => !!x);
  for (const r of roots) {
    try {
      const css = fs.readFileSync(path.join(r, "react-vite-starter/src/styles/tokens.css"), "utf8");
      return (starterNames = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])));
    } catch {
      /* next */
    }
  }
  return (starterNames = new Set());
}

/**
 * Colours that aren't from the Styles page, anywhere in the app: an app token (one the Styles page doesn't write) set
 * to a raw colour, or a component stylesheet defining its own colour variable. The Calculator app's keys used
 * #d9eaff / #083360 / #fef0c7 next to a #042935 / #14b7da / #57445e palette and design QA passed, because tokens and
 * local variables were never checked. Serious, so the app doesn't pass until it uses the palette.
 */
function offPalette(jail: PathJail, tokenFile: string | undefined, files: string[]): Finding[] {
  const known = starterTokenNames();
  const out: Finding[] = [];
  const scan = (rel: string, isTokens: boolean) => {
    const css = fs.readFileSync(path.join(jail.root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
    const bad: string[] = [];
    let line: number | undefined;
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
      const [, name, value] = m;
      // The palette ramps (Styles → Colours) are the palette itself.
      if (!RAW_COLOR.test(value) || /^--(brand|neutral|status)-/.test(name)) continue;
      if (isTokens && known.size && known.has(name)) continue;
      bad.push(`${name}: ${value.trim().slice(0, 40)}`);
      line ??= css.slice(0, m.index).split("\n").length;
    }
    if (bad.length)
      out.push(
        f({
          rule: "off-palette",
          severity: "serious",
          confidence: "high",
          message: `${bad.length} colour(s) not from the Styles palette: ${bad.slice(0, 4).join("; ")}${bad.length > 4 ? "; …" : ""}`,
          path: rel,
          line,
          recommendation: "Set these to the palette: var(--brand-primary-50…900), var(--brand-secondary-…), var(--brand-tertiary-…) var(--neutral-…), var(--status-…) or var(--color-…), so the app matches its Styles page.",
        }),
      );
  };
  if (tokenFile) scan(tokenFile, true);
  for (const rel of files.filter((p) => /\.css$/.test(p) && p !== tokenFile && !isReferencePath(p) && !/(^|\/)src\/styles\/(components|screen-parts|surfaces)\.css$/.test(p))) scan(rel, false);
  return out;
}

export function designQa(jail: PathJail, opts: { requiredStates?: string[]; maxRadiusPx?: number } = {}): Finding[] {
  seq = 0;
  const findings: Finding[] = [];
  const inv = parseTokens(jail);
  const tokenFile = inv.file;
  // The cap follows the app's own radius tokens: corners set rounder in the Design studio (or pill controls) are the
  // design, not a violation. The brief's cap only applies while the tokens stay under it.
  const tokenRadii = [...inv.tokens.keys()].filter((k) => /^--(radius-[\w-]+|control-radius|surface-radius)$/.test(k)).map((k) => Number(/^(\d+(?:\.\d+)?)px$/.exec(inv.resolve(k) ?? "")?.[1] ?? NaN)).filter((n) => !Number.isNaN(n));
  const briefCap = opts.maxRadiusPx ?? inv.brief?.maxRadiusPx;
  const maxRadius = briefCap === undefined ? undefined : Math.max(briefCap, ...tokenRadii);
  if (!tokenFile) findings.push(f({ rule: "token-inventory", severity: "serious", confidence: "high", message: "No design token stylesheet (tokens.css) found", recommendation: "Define colors, spacing, radius and type scale as CSS custom properties and consume them via var()." }));
  const files = flattenFiles(jail);
  findings.push(...offPalette(jail, tokenFile, files));

  for (const rel of files.filter((p) => /\.css$/.test(p) && p !== tokenFile && !isReferencePath(p))) {
    const lines = fs.readFileSync(path.join(jail.root, rel), "utf8").split("\n");
    let inComment = false;
    // Brace depth inside an @media (prefers-reduced-motion) block: !important there is the standard way to switch motion off.
    let reducedMotion = 0;
    lines.forEach((line, i) => {
      if (line.includes("/*")) inComment = true;
      const code = inComment ? "" : line;
      if (line.includes("*/")) inComment = false;
      const depth = (code.match(/\{/g) ?? []).length - (code.match(/\}/g) ?? []).length;
      if (reducedMotion) reducedMotion += depth;
      else if (/@media[^{]*prefers-reduced-motion/.test(code)) reducedMotion = depth;
      if (/^\s*--[\w-]+\s*:/.test(code)) return; // local custom property definitions are allowed
      if (RAW_COLOR.test(code)) findings.push(f({ rule: "raw-color", severity: "moderate", confidence: "high", message: "Raw color value in component CSS; use a semantic token", path: rel, line: i + 1, evidence: code.trim().slice(0, 160), recommendation: "Use var(--color-…). To add a color, extend tokens.css via the extend_tokens workflow." }));
      if (/font-family\s*:/.test(code) && !/var\(--/.test(code) && !/inherit/.test(code)) findings.push(f({ rule: "raw-font", severity: "minor", confidence: "high", message: "Raw font-family; use the type tokens", path: rel, line: i + 1 }));
      if (/!important/.test(code) && !reducedMotion && !/(transition|animation)-duration/.test(code)) findings.push(f({ rule: "important", severity: "minor", confidence: "high", message: "!important overrides make styles brittle", path: rel, line: i + 1 }));
      const radius = /border-radius\s*:\s*([^;]+)/.exec(code);
      if (radius && maxRadius !== undefined) {
        for (const px of radius[1].matchAll(/(\d+(?:\.\d+)?)px/g)) if (Number(px[1]) > maxRadius) findings.push(f({ rule: "radius-cap", severity: "moderate", confidence: "high", message: `border-radius ${px[1]}px exceeds the ${maxRadius}px cap`, path: rel, line: i + 1 }));
      }
      if (/\b(\d{2,})px\b/.test(code) && /(margin|padding|gap)\s*:/.test(code) && !/var\(--/.test(code)) findings.push(f({ rule: "raw-spacing", severity: "minor", confidence: "medium", message: "Raw spacing value; prefer the spacing scale tokens", path: rel, line: i + 1 }));
    });
  }
  if (maxRadius !== undefined && tokenFile) {
    const css = fs.readFileSync(path.join(jail.root, tokenFile), "utf8");
    for (const m of css.matchAll(/(--radius[\w-]*)\s*:\s*(\d+(?:\.\d+)?)px/g)) if (Number(m[2]) > maxRadius) findings.push(f({ rule: "radius-cap", severity: "moderate", confidence: "high", message: `${m[1]} is ${m[2]}px (cap ${maxRadius}px)`, path: tokenFile }));
  }

  // FlowCode's own kit (src/components/ui) sets data-driven sizes inline on purpose (skeleton lines, progress, chart
  // bars); the app is judged on its own screens.
  const sourceFiles = files.filter((p) => /\.(tsx|jsx)$/.test(p) && !/\.test\./.test(p) && !/(^|\/)src\/components\/ui\//.test(p));
  const allSource: string[] = [];
  for (const rel of sourceFiles) {
    const text = fs.readFileSync(path.join(jail.root, rel), "utf8");
    allSource.push(text);
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (n: ts.Node) => {
      if (ts.isJsxAttribute(n) && n.name.getText(sf) === "style" && !dataDrivenGeometry(n)) {
        findings.push(f({ rule: "inline-style", severity: "moderate", confidence: "high", message: "Inline style escapes the token system", path: rel, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, recommendation: "Move styles into a class that uses tokens." }));
      }
      if (ts.isJsxText(n) && FILLER.test(n.text)) findings.push(f({ rule: "filler-copy", severity: "moderate", confidence: "medium", message: `Filler or generic copy: "${n.text.trim().slice(0, 80)}"`, path: rel, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 }));
      if (ts.isStringLiteral(n) && ts.isJsxAttribute(n.parent) && n.parent.name.getText(sf) === "className" && /\b(bg|text)-(purple|violet|indigo)-\d{3}\b.*\bfrom-/.test(n.text))
        findings.push(f({ rule: "generic-pattern", severity: "minor", confidence: "low", message: "Generic gradient utility pattern", path: rel, manualValidationRequired: true }));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // State coverage (designed empty/loading/error states).
  const corpus = allSource.join("\n");
  const states = opts.requiredStates ?? inv.brief?.requiredStates ?? ["empty", "loading", "error"];
  const detectors = STATE_DETECTORS;
  for (const s of states) {
    const re = detectors[s];
    if (re && sourceFiles.length && !re.test(corpus)) findings.push(f({ rule: "state-coverage", severity: "serious", confidence: "medium", message: `No designed ${s} state found in the UI source`, recommendation: `Design and render a ${s} state.` }));
  }
  return findings;
}

/** How the design check recognises a designed state in a screen's source (also used to plan a repair step). */
export const STATE_DETECTORS: Record<string, RegExp> = {
  empty: /no [\w ]{0,20}yet|nothing (here|scheduled)|empty[-_ ]?state|length === 0/i,
  loading: /loading|aria-busy|role=["']status["']/i,
  error: /role=["']alert["']|error[-_ ]?state|something went wrong|couldn.t/i,
};
