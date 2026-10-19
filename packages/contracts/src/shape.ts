/**
 * A direction's shape and type scale: corners, density, border weight and the text sizes, as the app's own tokens
 * (CSSVibes' names: --radius-*, --space-*, --control-*, --border-width, --text-*). The Design Studio's corner and type
 * scale controls use the same functions, so the Look and the Studio agree on every value.
 */
export const rem = (px: number) => `${Math.round((px / 16) * 1000) / 1000}rem`;

export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type Density = (typeof DENSITIES)[number];
export const DENSITY_LABEL: Record<Density, { name: string; detail: string }> = {
  compact: { name: "Compact", detail: "Tighter spacing and smaller controls: more on screen" },
  comfortable: { name: "Comfortable", detail: "The app's standard spacing and control sizes" },
  spacious: { name: "Spacious", detail: "Generous whitespace and larger controls" },
};

export const BORDER_WEIGHTS = ["fine", "strong"] as const;
export type BorderWeight = (typeof BORDER_WEIGHTS)[number];

export interface ShapeSetting {
  /** The largest corner radius in px (cards); smaller parts get a share of it. 0 is square. */
  radius: number;
  density: Density;
  borders: BorderWeight;
}
export interface TypeScaleSetting {
  /** Body text size in px. */
  base: number;
  /** How much each heading level grows (1.125 calm to 1.5 dramatic). */
  ratio: number;
}

export const MAX_RADIUS = 32;
export const TYPE_RATIOS: Array<{ ratio: number; label: string }> = [
  { ratio: 1.125, label: "Calm" },
  { ratio: 1.2, label: "Balanced" },
  { ratio: 1.25, label: "Clear" },
  { ratio: 1.333, label: "Bold" },
  { ratio: 1.5, label: "Dramatic" },
];

/** Corners: the radius scale from the largest corner. */
export const radiusTokens = (r: number): Record<string, string> => ({ "--radius-sm": `${Math.round(r * 0.4)}px`, "--radius-md": `${Math.round(r * 0.6)}px`, "--radius-lg": `${Math.round(r * 0.8)}px`, "--radius-xl": `${r}px` });

/** The text sizes from a body size and a heading ratio. */
export function typeScaleTokens(base: number, ratio: number): Record<string, string> {
  return {
    "--text-xs": rem(Math.round(base / ratio / ratio)),
    "--text-sm": rem(Math.round(base / ratio)),
    "--text-md": rem(base),
    "--text-lg": rem(Math.round(base * ratio)),
    "--text-xl": rem(Math.round(base * ratio ** 2)),
    "--text-2xl": rem(Math.round(base * ratio ** 3)),
    "--text-3xl": rem(Math.round(base * ratio ** 4)),
  };
}

// The app's standard spacing (px) and CSSVibes' control heights; density scales both.
const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 96];
const CONTROLS: Record<"sm" | "md" | "lg" | "xl", number> = { sm: 32, md: 40, lg: 48, xl: 56 };
const DENSITY_SCALE: Record<Density, { space: number; control: number }> = { compact: { space: 0.75, control: -4 }, comfortable: { space: 1, control: 0 }, spacious: { space: 1.333, control: 4 } };

export function shapeTokens(s: ShapeSetting): Record<string, string> {
  const d = DENSITY_SCALE[s.density];
  return {
    ...radiusTokens(Math.max(0, Math.min(MAX_RADIUS, Math.round(s.radius)))),
    ...Object.fromEntries(SPACE.map((px, i) => [`--space-${i + 1}`, rem(Math.round(px * d.space))])),
    ...Object.fromEntries(Object.entries(CONTROLS).map(([k, px]) => [`--control-${k}`, rem(px + d.control)])),
    "--border-width": s.borders === "strong" ? "2px" : "1px",
  };
}

export function shapeProblems(s?: ShapeSetting, t?: TypeScaleSetting): string[] {
  const out: string[] = [];
  if (s && (!Number.isFinite(s.radius) || s.radius < 0 || s.radius > MAX_RADIUS)) out.push(`corners must be 0 to ${MAX_RADIUS}px`);
  if (s && !DENSITIES.includes(s.density)) out.push(`density "${s.density}" isn't one of ${DENSITIES.join(", ")}`);
  if (s && !BORDER_WEIGHTS.includes(s.borders)) out.push(`border weight "${s.borders}" isn't one of ${BORDER_WEIGHTS.join(", ")}`);
  if (t && (!(t.base >= 12 && t.base <= 22) || !(t.ratio >= 1.05 && t.ratio <= 1.6))) out.push("the type scale needs a body size of 12 to 22px and a heading ratio of 1.05 to 1.6");
  return out;
}
