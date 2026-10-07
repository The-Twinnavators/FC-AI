/**
 * Styles → Design → Colours: up to five brand colours, each with a 10-step ramp (50–900), neutrals and status colours
 * picked from them, WCAG contrast checks with the nearest passing shade, and the mapping onto the app's colour tokens.
 * Shared by the UI (live preview) and the daemon (writes tokens.css), so both always agree.
 *
 * Ramps are built in OKLCH (perceptual lightness), so steps look even across hues; the user's own colour is kept
 * exactly at its nearest step. After CSSVibes' palette, which uses three different HSL ramps; this uses one.
 */

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStep = (typeof RAMP_STEPS)[number];
export type Ramp = Record<RampStep, string>;

/** Target OKLCH lightness for each step (50 is near white, 900 near black). */
const RAMP_L: Record<RampStep, number> = { 50: 0.975, 100: 0.94, 200: 0.88, 300: 0.8, 400: 0.71, 500: 0.62, 600: 0.53, 700: 0.45, 800: 0.37, 900: 0.29 };
/** How much of the colour's chroma each step keeps (pale and very dark steps carry less colour). */
const RAMP_C: Record<RampStep, number> = { 50: 0.18, 100: 0.34, 200: 0.58, 300: 0.8, 400: 0.95, 500: 1, 600: 0.96, 700: 0.88, 800: 0.76, 900: 0.62 };

export type BrandRole = "primary" | "secondary" | "tertiary" | "accent-1" | "accent-2";
export const BRAND_ROLES: BrandRole[] = ["primary", "secondary", "tertiary", "accent-1", "accent-2"];
export const MAX_BRAND_COLORS = 5;

export interface BrandColor {
  hex: string;
  name?: string;
  role: BrandRole;
}
export type NeutralTone = "brand" | "warm" | "cool" | "pure";
export type StatusKind = "success" | "warning" | "error" | "info";
export const STATUS_KINDS: StatusKind[] = ["success", "warning", "error", "info"];

/** What the user chose; everything else is computed from it. */
export interface PaletteConfig {
  brand: BrandColor[];
  neutral?: NeutralTone;
  /** Status colours the user set themselves (otherwise picked from the brand colours). */
  status?: Partial<Record<StatusKind, string>>;
}

export interface Palette {
  brand: Array<BrandColor & { ramp: Ramp; baseStep: RampStep }>;
  neutral: Ramp;
  status: Record<StatusKind, { hex: string; ramp: Ramp; from: "brand" | "generated" | "you" }>;
}

// ───────────────────────── colour maths (sRGB ↔ OKLab ↔ OKLCH) ─────────────────────────

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export function normalizeHex(v: string): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}
function hexToRgb(hex: string): [number, number, number] {
  const h = (normalizeHex(hex) ?? "#000000").slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export interface Oklch {
  l: number;
  c: number;
  h: number;
}
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-4 ? 0 : (Math.atan2(B, A) * 180) / Math.PI + (Math.atan2(B, A) < 0 ? 360 : 0) };
}
function oklchToLinearRgb({ l: L, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** OKLCH → hex, lowering chroma until the colour fits in sRGB (keeps lightness and hue). */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  let rgb = oklchToLinearRgb({ ...color, c });
  for (let i = 0; i < 30 && !inGamut(rgb); i++) {
    c *= 0.9;
    rgb = oklchToLinearRgb({ ...color, c });
  }
  return `#${rgb.map((v) => Math.round(clamp(fromLinear(clamp(v))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG 2 relative luminance and contrast ratio. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
export type ContrastLevel = "AAA" | "AA" | "AA large" | "Fail";
export const contrastLevel = (ratio: number): ContrastLevel => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fail");

// ───────────────────────── ramps ─────────────────────────

/** The step whose target lightness is closest to the colour's own. */
export function nearestStep(hex: string): RampStep {
  const { l } = hexToOklch(hex);
  return RAMP_STEPS.reduce((best, s) => (Math.abs(RAMP_L[s] - l) < Math.abs(RAMP_L[best] - l) ? s : best), 500 as RampStep);
}

/** A 10-step ramp around a colour: even lightness steps, the colour itself exactly at its nearest step. */
export function makeRamp(hex: string, opts: { chroma?: number } = {}): { ramp: Ramp; baseStep: RampStep } {
  const base = normalizeHex(hex) ?? "#808080";
  const o = hexToOklch(base);
  const chroma = opts.chroma ?? o.c;
  const baseStep = nearestStep(base);
  const ramp = {} as Ramp;
  for (const s of RAMP_STEPS) ramp[s] = s === baseStep && opts.chroma === undefined ? base : oklchToHex({ l: RAMP_L[s], c: chroma * RAMP_C[s], h: o.h });
  return { ramp, baseStep };
}

// ───────────────────────── neutrals and status colours ─────────────────────────

function meanHue(hexes: string[]): number | undefined {
  const cols = hexes.map(hexToOklch).filter((o) => o.c > 0.02);
  if (!cols.length) return undefined;
  const x = cols.reduce((a, o) => a + Math.cos((o.h * Math.PI) / 180), 0);
  const y = cols.reduce((a, o) => a + Math.sin((o.h * Math.PI) / 180), 0);
  const h = (Math.atan2(y, x) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

/** Greys tinted toward the brand's average hue (a hint of colour so they sit with the brand), or warm, cool, pure. */
export function neutralRamp(brandHexes: string[], tone: NeutralTone = "brand"): Ramp {
  const hue = tone === "warm" ? 70 : tone === "cool" ? 250 : (meanHue(brandHexes) ?? 250);
  const c = tone === "pure" ? 0 : tone === "brand" ? 0.012 : 0.018;
  const ramp = {} as Ramp;
  for (const s of RAMP_STEPS) ramp[s] = oklchToHex({ l: s === 50 ? 0.985 : s === 900 ? 0.21 : RAMP_L[s], c: c * (s >= 800 ? 1.4 : 1), h: hue });
  return ramp;
}

/** Each status colour's home hue (OKLCH) and the band a brand colour must fall in to be reused for it. */
const STATUS_HUE: Record<StatusKind, { hue: number; band: number; l: number }> = {
  success: { hue: 150, band: 30, l: 0.6 },
  warning: { hue: 75, band: 20, l: 0.72 },
  error: { hue: 27, band: 18, l: 0.58 },
  info: { hue: 245, band: 30, l: 0.6 },
};
const hueDist = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** A brand colour in the status colour's hue band if there is one, else one generated in harmony with the primary. */
export function statusColor(kind: StatusKind, brand: BrandColor[]): { hex: string; from: "brand" | "generated" } {
  const want = STATUS_HUE[kind];
  const match = brand.map((b) => ({ b, o: hexToOklch(b.hex) })).find(({ o }) => o.c > 0.08 && hueDist(o.h, want.hue) <= want.band);
  if (match) return { hex: normalizeHex(match.b.hex)!, from: "brand" };
  const primary = brand[0] ? hexToOklch(brand[0].hex) : undefined;
  // Nudge the hue a little toward the primary (at most 6°) and match its colourfulness, so the set feels related
  // without an error red drifting into orange.
  const delta = primary && primary.c > 0.02 ? ((primary.h - want.hue + 540) % 360) - 180 : 0;
  const h = (want.hue + clamp(delta * 0.08, -6, 6) + 360) % 360;
  const c = clamp(primary?.c ?? 0.15, 0.12, 0.19);
  return { hex: oklchToHex({ l: want.l, c, h }), from: "generated" };
}

export function buildPalette(cfg: PaletteConfig): Palette {
  const brand = cfg.brand.slice(0, MAX_BRAND_COLORS).filter((b) => normalizeHex(b.hex)).map((b, i) => ({ ...b, hex: normalizeHex(b.hex)!, role: BRAND_ROLES[i], ...makeRamp(b.hex) }));
  const neutral = neutralRamp(brand.map((b) => b.hex), cfg.neutral);
  const status = {} as Palette["status"];
  for (const k of STATUS_KINDS) {
    const own = cfg.status?.[k] ? normalizeHex(cfg.status[k]!) : undefined;
    const pick = own ? { hex: own, from: "you" as const } : statusColor(k, brand);
    status[k] = { ...pick, ramp: makeRamp(pick.hex).ramp };
  }
  return { brand, neutral, status };
}

// ───────────────────────── accessible shades and the app's tokens ─────────────────────────

/** The shade of a ramp closest to `prefer` that reaches `min` contrast against `bg` (searching both ways). */
export function accessibleStep(ramp: Ramp, bg: string, min: number, prefer: RampStep = 500): RampStep | undefined {
  const i = RAMP_STEPS.indexOf(prefer);
  for (let d = 0; d < RAMP_STEPS.length; d++) {
    for (const j of [i + d, i - d]) {
      const s = RAMP_STEPS[j];
      if (s !== undefined && contrastRatio(ramp[s], bg) >= min) return s;
    }
  }
  return undefined;
}
const pick = (ramp: Ramp, bg: string, min: number, prefer: RampStep, fallback: string) => {
  const s = accessibleStep(ramp, bg, min, prefer);
  return s ? ramp[s] : fallback;
};
/** White or near-black text, whichever reads better on a colour. */
export const textOn = (bg: string) => (contrastRatio("#ffffff", bg) >= contrastRatio("#111111", bg) ? "#ffffff" : "#111111");

/**
 * The app's colour tokens (src/styles/tokens.css) for the light (default) or dark theme. Text roles reach 4.5:1, the
 * accent (buttons, links, focus) reaches 3:1 on surfaces with its button text at 4.5:1.
 */
export function roleTokens(p: Palette, dark = false): Record<string, string> {
  const n = p.neutral;
  const bg = dark ? n[900] : n[50];
  const surface = dark ? oklchToHex({ ...hexToOklch(n[900]), l: 0.26 }) : "#ffffff";
  const sunken = dark ? oklchToHex({ ...hexToOklch(n[900]), l: 0.18 }) : n[100];
  const primary = p.brand[0];
  const accent = primary ? pick(primary.ramp, surface, 4.5, dark ? 300 : primary.baseStep, dark ? "#ffffff" : "#111111") : dark ? n[200] : n[800];
  // Hover is one step further from the background (darker on light, lighter on dark).
  const accentStep = primary ? RAMP_STEPS.find((s) => primary.ramp[s] === accent) : undefined;
  const hoverStep = accentStep ? RAMP_STEPS[Math.max(0, Math.min(RAMP_STEPS.length - 1, RAMP_STEPS.indexOf(accentStep) + (dark ? -1 : 1)))] : undefined;
  const accentHover = primary && hoverStep ? primary.ramp[hoverStep] : accent;
  const status = (k: StatusKind) => pick(p.status[k].ramp, surface, 4.5, dark ? 300 : 600, dark ? "#ffffff" : "#111111");
  return {
    "--color-bg": bg,
    "--color-surface": surface,
    "--color-surface-sunken": sunken,
    "--color-text": dark ? n[50] : n[900],
    "--color-text-muted": pick(n, surface, 4.5, dark ? 300 : 600, dark ? n[200] : n[700]),
    "--color-border": dark ? n[700] : n[200],
    "--color-border-strong": pick(n, surface, 3, dark ? 500 : 500, dark ? n[400] : n[600]),
    "--color-accent": accent,
    "--color-accent-hover": accentHover,
    "--color-on-accent": textOn(accent),
    "--color-focus": primary ? pick(primary.ramp, bg, 3, dark ? 300 : 500, accent) : accent,
    "--color-success": status("success"),
    "--color-danger": status("error"),
    "--color-danger-surface": dark ? p.status.error.ramp[900] : p.status.error.ramp[50],
  };
}

/** Every ramp as CSS custom properties: --brand-primary-500, --neutral-200, --status-error-600 … */
export function rampTokens(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of p.brand) for (const s of RAMP_STEPS) out[`--brand-${b.role}-${s}`] = b.ramp[s];
  for (const s of RAMP_STEPS) out[`--neutral-${s}`] = p.neutral[s];
  for (const k of STATUS_KINDS) for (const s of RAMP_STEPS) out[`--status-${k}-${s}`] = p.status[k].ramp[s];
  return out;
}

export interface ContrastCheck {
  id: string;
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  need: number;
  pass: boolean;
  /** A passing colour from the same ramp, closest to the current one, when this check fails. */
  suggestion?: { hex: string; step: RampStep; ratio: number };
}

/** The checks that matter for an app's colours, each with the nearest passing shade when it fails. */
export function contrastAudit(p: Palette, tokens: Record<string, string>): ContrastCheck[] {
  const t = (k: string) => tokens[k];
  const rows: Array<[string, string, string, string, number, Ramp | undefined]> = [
    ["text-bg", "Text on the page", t("--color-text"), t("--color-bg"), 4.5, p.neutral],
    ["text-surface", "Text on cards", t("--color-text"), t("--color-surface"), 4.5, p.neutral],
    ["muted-surface", "Muted text on cards", t("--color-text-muted"), t("--color-surface"), 4.5, p.neutral],
    ["muted-bg", "Muted text on the page", t("--color-text-muted"), t("--color-bg"), 4.5, p.neutral],
    ["on-accent", "Button text on the accent", t("--color-on-accent"), t("--color-accent"), 4.5, undefined],
    ["accent-surface", "Accent links on cards", t("--color-accent"), t("--color-surface"), 4.5, p.brand[0]?.ramp],
    ["focus-bg", "Focus ring on the page", t("--color-focus"), t("--color-bg"), 3, p.brand[0]?.ramp],
    ["success-surface", "Success text on cards", t("--color-success"), t("--color-surface"), 4.5, p.status.success.ramp],
    ["danger-surface", "Error text on cards", t("--color-danger"), t("--color-surface"), 4.5, p.status.error.ramp],
    ["danger-on-tint", "Error text on its tint", t("--color-danger"), t("--color-danger-surface"), 4.5, p.status.error.ramp],
    ["border-surface", "Strong borders on cards", t("--color-border-strong"), t("--color-surface"), 3, p.neutral],
  ];
  return rows
    .filter(([, , fg, bg]) => fg && bg)
    .map(([id, label, fg, bg, need, ramp]) => {
      const ratio = contrastRatio(fg, bg);
      const pass = ratio >= need;
      let suggestion: ContrastCheck["suggestion"];
      if (!pass && ramp) {
        const near = RAMP_STEPS.reduce((best, s) => (Math.abs(luminance(ramp[s]) - luminance(fg)) < Math.abs(luminance(ramp[best]) - luminance(fg)) ? s : best), 500 as RampStep);
        const s = accessibleStep(ramp, bg, need, near);
        if (s) suggestion = { hex: ramp[s], step: s, ratio: contrastRatio(ramp[s], bg) };
      }
      return { id, label, fg, bg, ratio, need, pass, suggestion };
    });
}

/** A starting palette from an app's current accent (and status colours), before the user has chosen any. */
export function paletteFromTokens(tokens: Record<string, string>): PaletteConfig {
  const accent = normalizeHex(tokens["--color-accent"] ?? "") ?? "#6d28d9";
  return { brand: [{ hex: accent, role: "primary" }], neutral: "brand" };
}
