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
import { BUNDLED_FONTS, DEFAULT_SURFACES, STYLE_VIBES, buildPalette, contrastRatio, luminance, paletteFromTokens, roleTokens, vibeTokens } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import type { FileOperations } from "./operations.js";
import { applyDesign } from "./designStudio.js";
import { withDarkValues } from "./darkTheme.js";
import { setSurfaceStyle } from "./surfaceStyle.js";
import { parseCustomProperties } from "./styleTokens.js";
import type { AppModel } from "../orchestrator/appModel.js";
import { appFiles, screenFileOf } from "../orchestrator/appFiles.js";
import { homePieces, type HomeLayout } from "../orchestrator/lookupFiles.js";
import { pieceFiles, sectionsDir, syncedLibraryCss } from "../orchestrator/sectionRecipes.js";

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
  /** The approved dark palette, when the design was dark: the app's dark theme (its light theme is derived). */
  darkPalette?: DesignSpec["palette"];
  surface: {
    /** A surface style (STYLE_VIBES id): how cards, panels and controls are drawn. */
    vibe: string;
    /** --radius-sm, -md, -lg, -xl in px; cards and text boxes never over 12. */
    radii: [number, number, number, number];
    borderWidth: 0 | 1 | 2 | 3;
  };
  composition: {
    contentWidth: "narrow" | "regular" | "wide";
    /** The Home page's layout, composed from the library's pieces (look-up apps). Deterministic: no coder step. */
    home?: HomeLayout;
    /** Changes to how screens are laid out that tokens can't make: work for the coder, each naming its screen or part. */
    changes: Array<{ target: string; change: string }>;
  };
  /** The one product-specific detail people should remember. */
  signature: string;
  responsive: string[];
  sources: Array<{ kind: "selected-style" | "prd" | "reference" | "internal"; ref: string; confidence: "high" | "medium" | "low" }>;
}

/** Who implements each requirement of a spec: the app's tokens, the library's layouts (composed by FlowCode), the coder, or nothing here. */
export type Responsibility = "tokens" | "library" | "coder" | "unsupported";

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
/** `allowedSurfaces`: Flat and Tactile unless the person asked for another style in this project. */
export function specProblems(s: DesignSpec, allowedSurfaces: readonly string[] = DEFAULT_SURFACES): string[] {
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
  if (STYLE_VIBES.some((v) => v.id === s.surface.vibe) && !allowedSurfaces.includes(s.surface.vibe)) out.push(`the ${STYLE_VIBES.find((v) => v.id === s.surface.vibe)?.name} surface style is used only when the person asks for it in this project (FlowCode uses Flat or Tactile)`);
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

/** The palette roles as their tokens. */
export function paletteTokens(p: DesignSpec["palette"]): Record<string, string> {
  return {
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
  };
}

/**
 * Apps are light by default with a dark theme behind the light/dark toggle, so a design whose palette is dark is made
 * light-first: its own colors become the dark theme, and the light theme is derived from its accent and secondary
 * (FlowCode's palette builder, contrast checked). ShelfSure's approved design was dark, was written in as the light
 * theme, and "light mode felt like dark mode".
 */
export function lightFirst(s: DesignSpec): DesignSpec {
  if (s.darkPalette || luminance(s.palette.bg) > 0.35) return s;
  const l = roleTokens(buildPalette(paletteFromTokens({ "--color-accent": s.palette.accent, "--color-secondary": s.palette.secondary })), false);
  return {
    ...s,
    darkPalette: s.palette,
    palette: {
      bg: l["--color-bg"]!,
      surface: l["--color-surface"]!,
      surfaceSunken: l["--color-surface-sunken"]!,
      text: l["--color-text"]!,
      textMuted: l["--color-text-muted"]!,
      border: l["--color-border"]!,
      borderStrong: l["--color-border-strong"]!,
      accent: l["--color-accent"]!,
      accentHover: l["--color-accent-hover"]!,
      onAccent: l["--color-on-accent"]!,
      secondary: l["--color-secondary"]!,
    },
  };
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
  const h = s.composition.home;
  if (h)
    req.push({ id: "home-layout", aspect: "composition", statement: h.design ? `Home: the library's ${h.design} page, filled from the app's data` : `Home: a ${h.hero} opening, then ${h.order.join(", ")}; categories as ${h.categories}, most liked as ${h.list}`, by: "library" });
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
  /** The app model with the Home layout recorded, for later builds to keep (when the layout was applied). */
  model?: AppModel;
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
  targets: { frameCss: string; screens: string[]; model?: AppModel; allowedSurfaces?: readonly string[]; layoutOnly?: boolean } = { frameCss: "src/styles/components.css", screens: [] },
): SpecApplication {
  s = lightFirst(s);
  const problems = specProblems(s, targets.allowedSurfaces);
  if (problems.length) throw new Error(`The design spec "${s.name}" can't be applied: ${problems.join("; ")}`);
  const tokens = specTokens(s);
  const applied: string[] = [];
  // layoutOnly: the person chose the look (the project's design state); the concept brings only its Home layout and
  // never replaces their colours, fonts or surface.
  if (!targets.layoutOnly) {
    // The surface style first: it sets its own heading weight and corners, which the spec's tokens then override.
    setSurfaceStyle(jail, ops, ctx, s.surface.vibe);
    applied.push(`surface style: ${s.surface.vibe}`);
    const res = applyDesign(jail, ops, ctx, { theme: "default", values: tokens });
    if (res.changed.length) applied.push(`tokens: ${res.changed.length} changed`);
    // A dark design is the dark theme, exactly as approved (lightFirst derived the light one).
    if (s.darkPalette) {
      const css = fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8");
      const next = withDarkValues(css, paletteTokens(s.darkPalette));
      if (next !== css && ops.replaceContent({ jail, projectId: ctx.projectId, runId: ctx.runId, approved: false }, "src/styles/tokens.css", next).ok) applied.push("dark theme: the approved dark palette (light theme derived from its accent)");
    }
  } else applied.push("look: kept (your selected direction)");
  // A token this app doesn't declare can't be set (the token writer only changes existing ones): unsupported here.
  const declared = new Set(parseCustomProperties(fs.readFileSync(path.join(jail.root, "src/styles/tokens.css"), "utf8")).map((d) => d.name));
  const missing = Object.keys(tokens).filter((n) => !declared.has(n));
  // The Home layout: the landing page and the frame rewritten from the app model with the layout, and the library
  // pieces it uses copied in. Only for a look-up app written from its model; otherwise the layout is unsupported here.
  const home = s.composition.home;
  const model = home && targets.model?.lookup ? { ...targets.model, home } : undefined;
  if (model && home) {
    const landing = model.nav.flatMap((g) => g.items).find((v) => v.kind === "landing");
    const files = appFiles(model).filter((f) => f.path === "src/App.tsx" || (landing && f.path === screenFileOf(landing)));
    const op = { jail, projectId: ctx.projectId, runId: ctx.runId, approved: false };
    // The pieces it uses, and the catalog piece itself when the app's copy predates what they read from it (its layouts
    // and the shared useCatalog hook).
    const seen = new Set<string>();
    // Each refreshed only when the app's copy lacks what the new pieces use: the catalog's shared useCatalog hook, the
    // icon set's bookmark (Save). Otherwise an existing piece is kept (it may have been reshaped for the app).
    const pieces = [
      ...[...homePieces(home), "lookup-catalog"].flatMap((id) => pieceFiles(id, seen).map((p) => ({ path: p.rel, content: p.content, ...(p.id === "lookup-catalog" ? { needs: "export function useCatalog" } : {}) }))),
      { path: "src/sections/icons.tsx", content: fs.readFileSync(path.join(sectionsDir(), "sections/icons.tsx"), "utf8"), needs: "bookmark:" },
    ];
    for (const f of [...pieces, ...files]) {
      const abs = path.join(jail.root, f.path);
      const stale = "needs" in f && typeof f.needs === "string" && fs.existsSync(abs) && !fs.readFileSync(abs, "utf8").includes(f.needs);
      if (f.path.startsWith("src/sections/") && fs.existsSync(abs) && !stale) continue;
      if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === f.content) continue;
      const r = fs.existsSync(abs) ? ops.replaceContent(op, f.path, f.content) : ops.create_file(op, { path: f.path, content: f.content });
      if (!r.ok) throw new Error(r.message ?? `Couldn't write ${f.path}`);
    }
    const css = syncedLibraryCss(jail.root);
    if (css !== undefined) {
      const r = ops.replaceContent(op, "src/styles/library.css", css);
      if (!r.ok) throw new Error(r.message ?? "Couldn't update the library styles");
    }
    applied.push(home.design ? `home: the ${home.design} page` : `home layout: ${home.hero} opening, categories as ${home.categories}, most liked as ${home.list}`);
  }
  const requirements = specRequirements(s).filter((r) => !(targets.layoutOnly && r.by === "tokens")).map((r) =>
    r.by === "tokens" && r.tokens?.some((n) => missing.includes(n))
      ? { ...r, by: "unsupported" as const, missing: r.tokens.filter((n) => missing.includes(n)) }
      : r.by === "library" && !model
        ? { ...r, by: "unsupported" as const, missing: ["a look-up app written from its app model"] }
        : r,
  );
  const filesFor = (r: SpecRequirement) => {
    const named = targets.screens.filter((f) => r.statement.toLowerCase().includes(f.replace(/^.*\//, "").replace(/(Screen)?\.[a-z]+$/i, "").toLowerCase()));
    return r.aspect === "composition" || r.aspect === "responsive" ? (named.length ? named : [targets.frameCss]) : [targets.frameCss];
  };
  const coderWork = requirements.filter((r) => r.by === "coder").map((r) => ({ requirement: r.id, statement: r.statement, files: filesFor(r) }));
  return { specId: s.id, version: 1, applied, tokens, missing, requirements, coderWork, ...(model ? { model } : {}), humanApproval: "pending" };
}
