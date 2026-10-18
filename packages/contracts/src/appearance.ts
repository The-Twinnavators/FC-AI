/**
 * A project's appearance: the visual direction a person edits (theme, surface, colours, typography), separate from the
 * layout concept (which Home page). One model for every place it is edited: the plan card, the design review and the
 * Design tab. Its tokens come from FlowCode's existing deterministic machinery (the palette's ramps and roles, the
 * surface styles, the bundled fonts), so the preview in the UI and what the daemon writes are the same values.
 *
 * FlowCode suggests and starts from Flat or Tactile surfaces only; another surface style is used only when the person
 * asks for it for that project (an explicit exception, recorded with the project's design state).
 */
import { BUNDLED_FONTS } from "./fonts.js";
import { DESIGN_TEMPLATES, designTemplate } from "./designTemplates.js";
import { STYLE_VIBES, vibeTokens } from "./styleVibes.js";
import { motionProblems, motionTokens, type MotionSetting } from "./motion.js";
import { buildPalette, contrastRatio, normalizeHex, roleTokens, type BrandColor, type NeutralTone, type StatusKind } from "./palette.js";

/** The surfaces FlowCode suggests and starts from. Others need the person's explicit request for the project. */
/** Style capture (a website, or attached images, CSS or HTML) stays off until it has consent and address/destination
 * protections; every entry point refuses with this, and captures already made are kept. */
export const STYLE_CAPTURE_OFF = "Style capture is turned off until it asks for consent and protects which addresses it may open. Captures already made are kept.";

export const DEFAULT_SURFACES = ["flat", "skeuomorphism"] as const;

export interface TypePair {
  id: string;
  label: string;
  display: string;
  body: string;
  mood: string;
}

/** Typography pairs from the bundled (offline, licensed) fonts. */
export const TYPE_PAIRS: TypePair[] = [
  { id: "inter", label: "Inter", display: "Inter", body: "Inter", mood: "Neutral, clear sans throughout" },
  { id: "dm-sans", label: "DM Sans", display: "DM Sans", body: "DM Sans", mood: "Friendly geometric sans" },
  { id: "work-source", label: "Work Sans + Source Sans 3", display: "Work Sans", body: "Source Sans 3", mood: "Open, practical" },
  { id: "montserrat-source", label: "Montserrat + Source Sans 3", display: "Montserrat", body: "Source Sans 3", mood: "Confident geometric headings" },
  { id: "source-serif-inter", label: "Source Serif 4 + Inter", display: "Source Serif 4", body: "Inter", mood: "Calm serif headings, sans text" },
  { id: "fraunces-work", label: "Fraunces + Work Sans", display: "Fraunces", body: "Work Sans", mood: "Warm, humanist serif" },
  { id: "playfair-source", label: "Playfair Display + Source Sans 3", display: "Playfair Display", body: "Source Sans 3", mood: "Editorial, high contrast" },
  { id: "literata", label: "Literata", display: "Literata", body: "Literata", mood: "Bookish, for reading" },
  { id: "oswald-dm", label: "Oswald + DM Sans", display: "Oswald", body: "DM Sans", mood: "Condensed, punchy headings" },
  { id: "quicksand", label: "Quicksand", display: "Quicksand", body: "Quicksand", mood: "Soft, rounded" },
  { id: "roboto", label: "Roboto", display: "Roboto", body: "Roboto", mood: "Familiar system-like sans" },
];

export interface Appearance {
  /** The FlowCode theme it started from, if any (a preset: editing it is still this appearance). */
  theme?: string;
  mode: "light" | "dark";
  /** A surface style (STYLE_VIBES id): flat or skeuomorphism (Tactile) unless the project has an exception. */
  surface: string;
  primary: string;
  neutral: NeutralTone;
  secondary?: string;
  tertiary?: string;
  /** The primary action drawn as a gradient from the primary to the secondary (or a lighter primary). */
  gradient?: boolean;
  /** Status colours the person set; the others are suggested from the palette. */
  status?: Partial<Record<StatusKind, string>>;
  fonts: { display: string; body: string };
  /**
   * How much the app moves (motion.ts). Unset on directions made before motion existed: applying one of those leaves
   * the app's motion as it is. New directions start Balanced with no expressive capability.
   */
  motion?: MotionSetting;
}

const KIND_FALLBACK: Record<string, string> = { sans: "system-ui, sans-serif", serif: "Georgia, serif", display: "Georgia, serif", mono: "ui-monospace, monospace" };
const bundled = (family: string) => BUNDLED_FONTS.find((f) => f.family.toLowerCase() === family.trim().toLowerCase());
const stack = (family: string) => `"${family}", ${KIND_FALLBACK[bundled(family)?.kind ?? "sans"]}`;
const firstFamily = (s: string) => (s.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");

/** FlowCode's starting point for a new direction: a neutral, Flat appearance (not a brand). */
export const BASE_APPEARANCE: Appearance = { mode: "light", surface: "flat", primary: "#2f5bd3", neutral: "pure", fonts: { display: "Inter", body: "Inter" }, motion: { level: "balanced" } };

/** A FlowCode theme as an appearance preset. Its surface is Flat or Tactile (never its old suggested vibe). */
export function appearanceFromTheme(id: string, surface: string = "flat"): Appearance | undefined {
  const t = designTemplate(id);
  if (!t) return undefined;
  const c = t.colors;
  const warm = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, b = n & 255;
    return r - b;
  };
  const tint = warm(c.bg);
  const neutral: NeutralTone = Math.abs(tint) < 6 ? "pure" : tint > 0 ? "warm" : "cool";
  return { theme: t.id, mode: t.dark ? "dark" : "light", surface, primary: c.accent, secondary: c.secondary, neutral, fonts: { display: firstFamily(t.fonts.display), body: firstFamily(t.fonts.sans) }, motion: { level: "balanced" } };
}

export const APPEARANCE_THEMES = DESIGN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, dark: t.dark }));

/** What stops an appearance from being used: an invalid colour, a font FlowCode can't ship, a surface not allowed. */
export function appearanceProblems(a: Appearance, allowedSurfaces: readonly string[] = DEFAULT_SURFACES): string[] {
  const out: string[] = [];
  for (const [label, hex] of [["primary", a.primary], ["secondary", a.secondary], ["tertiary", a.tertiary], ...Object.entries(a.status ?? {}).map(([k, v]) => [`${k} colour`, v])] as const)
    if (hex !== undefined && !normalizeHex(hex)) out.push(`the ${label} "${hex}" isn't a colour (use #rrggbb)`);
  for (const [role, family] of [["heading", a.fonts.display], ["text", a.fonts.body]] as const)
    if (!bundled(family)) out.push(`the ${role} font "${family}" isn't one FlowCode bundles; choose one of ${BUNDLED_FONTS.map((f) => f.family).join(", ")}`);
  if (!STYLE_VIBES.some((v) => v.id === a.surface)) out.push(`surface style "${a.surface}" doesn't exist`);
  else if (!allowedSurfaces.includes(a.surface)) out.push(`the ${STYLE_VIBES.find((v) => v.id === a.surface)?.name} surface style is used only when you ask for it for this project; FlowCode starts from Flat or Tactile`);
  if (a.motion) out.push(...motionProblems(a.motion));
  return out;
}

const brandOf = (a: Appearance): BrandColor[] =>
  [
    { hex: normalizeHex(a.primary) ?? "#2f5bd3", role: "primary" as const },
    ...(a.secondary && normalizeHex(a.secondary) ? [{ hex: normalizeHex(a.secondary)!, role: "secondary" as const }] : []),
    ...(a.tertiary && normalizeHex(a.tertiary) ? [{ hex: normalizeHex(a.tertiary)!, role: "tertiary" as const }] : []),
  ];

/** The token values an appearance gives the app (colour roles, fonts, surface style, gradient, motion). Deterministic. */
export function appearanceTokens(a: Appearance): Record<string, string> {
  const palette = buildPalette({ brand: brandOf(a), neutral: a.neutral, status: a.status });
  const roles = roleTokens(palette, a.mode === "dark");
  const t: Record<string, string> = { ...roles, "--font-display": stack(a.fonts.display), "--font-sans": stack(a.fonts.body), ...vibeTokens(a.surface) };
  if (a.gradient) {
    const to = a.secondary && normalizeHex(a.secondary) ? normalizeHex(a.secondary)! : `color-mix(in srgb, ${roles["--color-accent"]} 70%, #ffffff)`;
    t["--accent-bg"] = `linear-gradient(135deg, ${roles["--color-accent"]}, ${to})`;
  }
  if (a.motion) Object.assign(t, motionTokens(a.motion.level));
  return t;
}

export interface AppearanceCheck {
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  ok: boolean;
}

/** The colour pairs the app really draws, from the appearance's own tokens, each with its ratio and target. */
export function appearanceChecks(a: Appearance): AppearanceCheck[] {
  const t = appearanceTokens(a);
  const pairs: Array<[string, string, string, number]> = [
    ["Text on the page", "--color-text", "--color-bg", 4.5],
    ["Text on cards", "--color-text", "--color-surface", 4.5],
    ["Secondary text on the page", "--color-text-muted", "--color-bg", 4.5],
    ["Secondary text on cards", "--color-text-muted", "--color-surface", 4.5],
    ["Button text on the primary colour", "--color-on-accent", "--color-accent", 4.5],
    ["Primary colour (links, focus) on the page", "--color-accent", "--color-bg", 3],
    ["Success on cards", "--color-success", "--color-surface", 4.5],
    ["Warning on cards", "--color-warning", "--color-surface", 4.5],
    ["Error on cards", "--color-danger", "--color-surface", 4.5],
    ["Error text on its alert", "--color-danger", "--color-danger-surface", 4.5],
    ["Text on the secondary colour", "--color-on-secondary", "--color-secondary", 4.5],
  ];
  return pairs
    .filter(([, fg, bg]) => /^#[0-9a-f]{6}$/i.test(t[fg] ?? "") && /^#[0-9a-f]{6}$/i.test(t[bg] ?? ""))
    .map(([label, fg, bg, min]) => {
      const ratio = Math.round(contrastRatio(t[fg]!, t[bg]!) * 100) / 100;
      return { label, fg: t[fg]!, bg: t[bg]!, ratio, min, ok: ratio >= min };
    });
}

/** Two appearances are the same direction (for "unchanged" and "differs" comparisons). */
export const sameAppearance = (a?: Appearance, b?: Appearance) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
