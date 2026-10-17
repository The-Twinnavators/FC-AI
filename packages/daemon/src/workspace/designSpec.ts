/**
 * The design specification: a selected style or approved direction, written down once (versioned) and applied to the
 * app. Part of it is applied deterministically through the app's existing tokens and surface styles (typography,
 * hierarchy, palette, density, corners and borders, surfaces, content width); the rest becomes bounded work for the
 * coder (composition changes, the signature detail, responsive changes), each with its target files. Nothing here
 * judges whether the design is good: whether the spec was implemented is checked in the rendered app
 * (quality/designSpecCheck.ts), and whether it looks right is the person's call.
 *
 * Clean Cart evals 1-3: every build kept the starter's components.css and the category's default palette, because the
 * only path from a direction to the app was a coder step asked to "give it the look", which never finished.
 */
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_FONTS, STYLE_VIBES, contrastRatio, vibeTokens } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { applyDesign } from "./designStudio.js";
import { setSurfaceStyle } from "./surfaceStyle.js";
import { parseCustomProperties } from "./styleTokens.js";

export type Density = "compact" | "regular" | "airy";
export type TypeScale = "compact" | "regular" | "expressive";

export interface DesignSpec {
  version: 1;
  /** Stable id of this spec (a selected style's id, or the approved direction's). */
  id: string;
  name: string;
  /** One or two sentences: what the product should feel like and why. */
  thesis: string;
  typography: {
    /** Bundled families only (BUNDLED_FONTS): available offline and licensed (SIL OFL) for the app. */
    display: string;
    body: string;
    /** How far headings step up from body text: the hierarchy. */
    scale: TypeScale;
    headingWeight: 400 | 500 | 600 | 700 | 800;
    headingCase: "normal" | "upper";
  };
  palette: {
    bg: string;
    surface: string;
    surfaceSunken: string;
    text: string;
    textMuted: string;
    border: string;
    borderStrong: string;
    accent: string;
    accentHover: string;
    onAccent: string;
    secondary: string;
  };
  density: Density;
  surface: {
    /** A surface style (STYLE_VIBES id): how cards, panels and controls are drawn. */
    vibe: string;
    /** --radius-sm, -md, -lg, -xl in px; cards and text boxes never over 12. */
    radii: [number, number, number, number];
    borderWidth: 0 | 1 | 2 | 3;
  };
  composition: {
    contentWidth: "narrow" | "regular" | "wide";
    /** Changes to how screens are laid out that tokens can't make: work for the coder, each naming its screen or part. */
    changes: Array<{ target: string; change: string }>;
  };
  /** The one product-specific detail people should remember. */
  signature: string;
  responsive: string[];
  sources: Array<{ kind: "selected-style" | "prd" | "reference" | "internal"; ref: string; confidence: "high" | "medium" | "low" }>;
}

/** Who implements each requirement of a spec. */
export type Responsibility = "tokens" | "coder" | "unsupported";

export interface SpecRequirement {
  id: string;
  aspect: "typography" | "hierarchy" | "palette" | "density" | "surface" | "composition" | "signature" | "responsive";
  statement: string;
  by: Responsibility;
  /** Tokens that implement it, when by tokens. */
  tokens?: string[];
  /** Tokens the app doesn't declare, when unsupported. */
  missing?: string[];
}

const SCALES: Record<TypeScale, { ratio: number }> = { compact: { ratio: 1.125 }, regular: { ratio: 1.25 }, expressive: { ratio: 1.414 } };
const DENSITY: Record<Density, number> = { compact: 0.8, regular: 1, airy: 1.3 };
const BASE_SPACE = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6];
const WIDTH = { narrow: "60rem", regular: "72rem", wide: "90rem" };
const KIND_FALLBACK: Record<string, string> = { sans: "system-ui, sans-serif", serif: "Georgia, serif", display: "Georgia, serif", mono: "ui-monospace, monospace" };
const round = (n: number) => Math.round(n * 1000) / 1000;

const bundled = (family: string) => BUNDLED_FONTS.find((f) => f.family.toLowerCase() === family.trim().toLowerCase());
const stack = (family: string) => `"${family}", ${KIND_FALLBACK[bundled(family)?.kind ?? "sans"]}`;

/** What stops a spec from being applied: fonts FlowCode can't ship, colour pairs below WCAG AA, corners over 12px. */
export function specProblems(s: DesignSpec): string[] {
  const out: string[] = [];
  for (const [role, family] of [["display", s.typography.display], ["body", s.typography.body]] as const)
    if (!bundled(family)) out.push(`${role} font "${family}" isn't one FlowCode bundles (with its licence); choose one of ${BUNDLED_FONTS.map((f) => f.family).join(", ")}`);
  const p = s.palette;
  for (const [fg, bg, label, min] of [
    [p.text, p.bg, "text on the background", 4.5],
    [p.text, p.surface, "text on surfaces", 4.5],
    [p.textMuted, p.bg, "muted text on the background", 4.5],
    [p.onAccent, p.accent, "text on the accent", 4.5],
    [p.accent, p.bg, "the accent on the background", 3],
  ] as const) {
    const r = contrastRatio(fg, bg);
    if (!(r >= min)) out.push(`${label}: contrast ${r.toFixed(2)}:1, needs ${min}:1 (WCAG AA)`);
  }
  if (s.surface.radii.some((r) => r > 12)) out.push("corners over 12px: cards, containers and text boxes curve at most 12px (pills stay round)");
  // A surface style that draws its outlines at a fixed width contradicts a different border width in the spec.
  const outline = /^(\d+)px\b/.exec(vibeTokens(s.surface.vibe)["--surface-border"] ?? "");
  if (outline && Number(outline[1]) !== s.surface.borderWidth) out.push(`the ${s.surface.vibe} surface style draws ${outline[1]}px outlines but the spec says ${s.surface.borderWidth}px borders; choose one`);
  if (!STYLE_VIBES.some((v) => v.id === s.surface.vibe)) out.push(`surface style "${s.surface.vibe}" doesn't exist; choose one of ${STYLE_VIBES.map((v) => v.id).join(", ")}`);
  return out;
}

/** The token values a spec sets (deterministic: the same spec gives the same tokens). */
export function specTokens(s: DesignSpec): Record<string, string> {
  const t: Record<string, string> = {};
  t["--font-display"] = stack(s.typography.display);
  t["--font-sans"] = stack(s.typography.body);
  // Hierarchy: a modular scale from a 1rem body.
  const r = SCALES[s.typography.scale].ratio;
  const step = (n: number) => `${round(Math.pow(r, n))}rem`;
  // Small text never under 13px, however steep the scale.
  Object.assign(t, { "--text-sm": `${Math.max(round(1 / r), 0.8125)}rem`, "--text-md": "1rem", "--text-lg": step(1), "--text-xl": step(2), "--text-2xl": step(3), "--text-3xl": step(4) });
  t["--heading-weight"] = String(s.typography.headingWeight);
  t["--tracking-tight"] = s.typography.headingCase === "upper" ? "0.04em" : "-0.02em";
  // Palette roles.
  const p = s.palette;
  Object.assign(t, {
    "--color-bg": p.bg,
    "--color-surface": p.surface,
    "--color-surface-sunken": p.surfaceSunken,
    "--color-text": p.text,
    "--color-text-muted": p.textMuted,
    "--color-border": p.border,
    "--color-border-strong": p.borderStrong,
    "--color-accent": p.accent,
    "--color-accent-hover": p.accentHover,
    "--color-on-accent": p.onAccent,
    "--color-focus": p.accent,
    "--color-secondary": p.secondary,
  });
  // Density: the spacing scale.
  BASE_SPACE.forEach((v, i) => (t[`--space-${i + 1}`] = `${round(v * DENSITY[s.density])}rem`));
  // Surfaces and shape.
  const [sm, md, lg, xl] = s.surface.radii;
  Object.assign(t, { "--radius-sm": `${sm}px`, "--radius-md": `${md}px`, "--radius-lg": `${lg}px`, "--radius-xl": `${xl}px`, "--border-width": `${s.surface.borderWidth}px` });
  // The spec's corners win over the surface style's own (some styles fix cards at 4px).
  Object.assign(t, { "--surface-radius": "var(--radius-lg)", "--control-radius": "var(--radius-md)" });
  t["--content-max"] = WIDTH[s.composition.contentWidth];
  return t;
}

/** Every token value the app should have once the spec is applied: the surface style's, then the spec's on top. */
export function expectedTokens(s: DesignSpec): Record<string, string> {
  return { ...vibeTokens(s.surface.vibe), ...specTokens(s) };
}

/** Each requirement of the spec and who implements it. A change list for the coder is not deterministic translation. */
export function specRequirements(s: DesignSpec): SpecRequirement[] {
  const req: SpecRequirement[] = [
    { id: "type-families", aspect: "typography", statement: `Headings in ${s.typography.display}, text in ${s.typography.body}`, by: "tokens", tokens: ["--font-display", "--font-sans"] },
    { id: "type-scale", aspect: "hierarchy", statement: `A ${s.typography.scale} type scale (headings step up ${SCALES[s.typography.scale].ratio}x per level), headings at weight ${s.typography.headingWeight}`, by: "tokens", tokens: ["--text-lg", "--text-xl", "--text-2xl", "--text-3xl", "--heading-weight"] },
    { id: "palette", aspect: "palette", statement: `Background ${s.palette.bg}, text ${s.palette.text}, accent ${s.palette.accent}`, by: "tokens", tokens: ["--color-bg", "--color-text", "--color-accent", "--color-surface"] },
    { id: "density", aspect: "density", statement: `${s.density} spacing`, by: "tokens", tokens: ["--space-4", "--space-5", "--space-6"] },
    { id: "shape", aspect: "surface", statement: `Corners ${s.surface.radii.join("/")}px, ${s.surface.borderWidth}px borders`, by: "tokens", tokens: ["--radius-md", "--radius-lg", "--border-width", "--surface-radius"] },
    { id: "surfaces", aspect: "surface", statement: `${STYLE_VIBES.find((v) => v.id === s.surface.vibe)?.name ?? s.surface.vibe} surfaces`, by: "tokens", tokens: ["--surface-shadow", "--surface-border"] },
    { id: "content-width", aspect: "composition", statement: `${s.composition.contentWidth} content width`, by: "tokens", tokens: ["--content-max"] },
  ];
  // Headings in capitals: no token sets text-transform, so it's the coder's (on the app's own heading rules).
  if (s.typography.headingCase === "upper") req.push({ id: "heading-case", aspect: "typography", statement: "Headings in capitals, tracked", by: "coder" });
  s.composition.changes.forEach((c, i) => req.push({ id: `composition-${i + 1}`, aspect: "composition", statement: `${c.target}: ${c.change}`, by: "coder" }));
  if (s.signature) req.push({ id: "signature", aspect: "signature", statement: s.signature, by: "coder" });
  s.responsive.forEach((r, i) => req.push({ id: `responsive-${i + 1}`, aspect: "responsive", statement: r, by: "coder" }));
  return req;
}

export interface SpecApplication {
  specId: string;
  version: 1;
  applied: string[];
  tokens: Record<string, string>;
  /** Spec tokens the app doesn't declare (not applied). */
  missing: string[];
  requirements: SpecRequirement[];
  /** Bounded work for the coder: each requirement it implements, with the files to change. */
  coderWork: Array<{ requirement: string; statement: string; files: string[] }>;
  /** Implementation evidence comes from the rendered app; approval is the person's and starts pending. */
  humanApproval: "pending";
}

/**
 * Applies the deterministic part of a spec through the app's existing machinery (the Styles page's token writer and
 * surface styles) and lists the rest as bounded coder work. A spec with problems isn't applied.
 */
export function applyDesignSpec(
  jail: PathJail,
  ops: FileOperations,
  ctx: { projectId: string; runId: string },
  s: DesignSpec,
  targets: { frameCss: string; screens: string[] } = { frameCss: "src/styles/components.css", screens: [] },
): SpecApplication {
  const problems = specProblems(s);
  if (problems.length) throw new Error(`The design spec "${s.name}" can't be applied: ${problems.join("; ")}`);
  const tokens = specTokens(s);
  const applied: string[] = [];
  // The surface style first: it sets its own heading weight and corners, which the spec's tokens then override.
  setSurfaceStyle(jail, ops, ctx, s.surface.vibe);
  applied.push(`surface style: ${s.surface.vibe}`);
  const res = applyDesign(jail, ops, ctx, { theme: "default", values: tokens });
  if (res.changed.length) applied.push(`tokens: ${res.changed.length} changed`);
  // A token this app doesn't declare can't be set (the token writer only changes existing ones): unsupported here.
  const declared = new Set(parseCustomProperties(fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8")).map((d) => d.name));
  const missing = Object.keys(tokens).filter((n) => !declared.has(n));
  const requirements = specRequirements(s).map((r) => (r.by === "tokens" && r.tokens?.some((n) => missing.includes(n)) ? { ...r, by: "unsupported" as const, missing: r.tokens.filter((n) => missing.includes(n)) } : r));
  const filesFor = (r: SpecRequirement) => {
    const named = targets.screens.filter((f) => r.statement.toLowerCase().includes(f.replace(/^.*\//, "").replace(/(Screen)?\.[a-z]+$/i, "").toLowerCase()));
    return r.aspect === "composition" || r.aspect === "responsive" ? (named.length ? named : [targets.frameCss]) : [targets.frameCss];
  };
  const coderWork = requirements.filter((r) => r.by === "coder").map((r) => ({ requirement: r.id, statement: r.statement, files: filesFor(r) }));
  return { specId: s.id, version: 1, applied, tokens, missing, requirements, coderWork, humanApproval: "pending" };
}
