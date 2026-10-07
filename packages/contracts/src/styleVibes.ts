/**
 * Surface styles ("vibes", after CSSVibes): how cards, panels, buttons and inputs are drawn (border, shadow, blur,
 * corner radius and the page backdrop), independent of colours and fonts. A vibe only sets the surface tokens in the
 * starter's tokens.css; the building blocks read nothing else, so switching vibe restyles every screen at once.
 * Every value is built from the app's own colour tokens, so any vibe works with any PRD palette or design template,
 * in light and dark themes.
 */

export interface StyleVibe {
  id: string;
  name: string;
  /** One line for the picker. */
  description: string;
  /** Surface token values written into tokens.css. */
  tokens: Record<string, string>;
  /** Words in a PRD that ask for this vibe. */
  match: RegExp;
}

const T = (pct: number) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;
const W = (pct: number) => `color-mix(in srgb, #ffffff ${pct}%, transparent)`;

/** The flat defaults: every vibe starts from these and overrides what it changes. */
export const SURFACE_DEFAULTS: Record<string, string> = {
  "--surface-bg": "var(--color-surface)",
  "--surface-border": "var(--border-width) solid var(--color-border)",
  "--surface-shadow": "none",
  "--surface-shadow-hover": "0 6px 20px -12px color-mix(in srgb, var(--color-text) 35%, transparent)",
  "--surface-blur": "none",
  "--surface-radius": "var(--radius-lg)",
  "--control-radius": "var(--radius-md)",
  "--control-border": "var(--border-width) solid var(--color-border-strong)",
  "--control-shadow": "none",
  "--control-shadow-hover": "none",
  "--header-bg": "var(--color-surface)",
  "--page-backdrop": "none",
  "--heading-weight": "var(--weight-bold)",
};

export const STYLE_VIBES: StyleVibe[] = [
  {
    id: "flat",
    name: "Flat",
    description: "Clean surfaces, hairline borders and no shadows.",
    tokens: {},
    match: /\bflat (design|ui|style)\b/i,
  },
  {
    id: "glass",
    name: "Glass",
    description: "Frosted, see-through panels over a soft colour wash.",
    tokens: {
      "--surface-bg": "color-mix(in srgb, var(--color-surface) 62%, transparent)",
      "--surface-border": `1px solid color-mix(in srgb, var(--color-surface) 50%, var(--color-border))`,
      "--surface-shadow": `0 10px 32px -14px ${T(35)}, inset 0 1px 0 ${W(40)}`,
      "--surface-blur": "blur(16px) saturate(140%)",
      "--surface-radius": "14px",
      "--control-radius": "10px",
      "--header-bg": "color-mix(in srgb, var(--color-surface) 70%, transparent)",
      "--page-backdrop": "radial-gradient(60% 55% at 8% 0%, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 70%), radial-gradient(50% 50% at 100% 35%, color-mix(in srgb, var(--color-focus) 18%, transparent), transparent 70%)",
    },
    match: /glass ?morphism|frosted glass|\bglass(y)? (ui|style|look|cards?|panels?)\b/i,
  },
  {
    id: "liquid-glass",
    name: "Liquid glass",
    description: "Deeper blur, rounder panels and a shimmering multi-colour wash.",
    tokens: {
      "--surface-bg": "linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 70%, transparent), color-mix(in srgb, var(--color-surface) 42%, transparent))",
      "--surface-border": `1px solid ${W(28)}`,
      "--surface-shadow": `0 12px 36px -16px ${T(38)}, inset 0 1px 0 ${W(50)}`,
      "--surface-blur": "blur(24px) saturate(160%)",
      "--surface-radius": "22px",
      "--control-radius": "999px",
      "--header-bg": "color-mix(in srgb, var(--color-surface) 60%, transparent)",
      "--page-backdrop": "radial-gradient(55% 50% at 0% 0%, color-mix(in srgb, var(--color-accent) 26%, transparent), transparent 70%), radial-gradient(45% 45% at 100% 20%, color-mix(in srgb, var(--color-focus) 22%, transparent), transparent 70%), radial-gradient(50% 50% at 60% 100%, color-mix(in srgb, var(--color-success) 18%, transparent), transparent 70%)",
    },
    match: /liquid glass|iridescent/i,
  },
  {
    id: "neumorphism",
    name: "Soft (neumorphic)",
    description: "Surfaces pressed out of the page with soft light and shadow.",
    tokens: {
      "--surface-bg": "var(--color-bg)",
      "--surface-border": "1px solid transparent",
      "--surface-shadow": `8px 8px 18px ${T(16)}, -6px -6px 16px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--surface-radius": "16px",
      "--control-radius": "12px",
      "--control-shadow": `4px 4px 10px ${T(14)}, -3px -3px 8px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--control-shadow-hover": `2px 2px 6px ${T(14)}, -2px -2px 6px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--header-bg": "var(--color-bg)",
    },
    match: /neu?morph(ism|ic)|soft ui/i,
  },
  {
    id: "skeuomorphism",
    name: "Tactile",
    description: "Gentle gradients, raised edges and real-material depth.",
    tokens: {
      "--surface-bg": "linear-gradient(180deg, var(--color-surface), color-mix(in srgb, var(--color-surface) 90%, var(--color-text)))",
      "--surface-border": `1px solid ${T(20)}`,
      "--surface-shadow": `inset 0 1px 0 ${W(55)}, 0 2px 6px -1px ${T(24)}`,
      "--surface-radius": "8px",
      "--control-radius": "6px",
      "--control-shadow": `inset 0 1px 0 ${W(45)}, 0 1px 2px ${T(28)}`,
      "--control-shadow-hover": `inset 0 1px 0 ${W(45)}, 0 2px 5px ${T(30)}`,
    },
    match: /skeuomorph|tactile|realistic textures?/i,
  },
  {
    id: "neobrutalism",
    name: "Neo-brutalist",
    description: "Thick outlines, hard offset shadows and bold headings.",
    tokens: {
      // CSSVibes' values: 3px outlines, a 6px hard shadow, 4px corners.
      "--surface-border": "3px solid var(--color-text)",
      "--surface-shadow": "6px 6px 0 var(--color-text)",
      "--surface-shadow-hover": "8px 8px 0 var(--color-text)",
      "--surface-radius": "4px",
      "--control-radius": "4px",
      "--control-border": "3px solid var(--color-text)",
      "--control-shadow": "4px 4px 0 var(--color-text)",
      "--control-shadow-hover": "6px 6px 0 var(--color-text)",
      "--heading-weight": "800",
    },
    match: /neo[- ]?brutal/i,
  },
  {
    id: "claymorphism",
    name: "Clay",
    description: "Puffy, rounded surfaces with soft inner highlights.",
    tokens: {
      "--surface-border": "1px solid transparent",
      "--surface-shadow": `0 12px 26px -10px ${T(24)}, inset 0 -4px 8px ${T(8)}, inset 0 4px 8px ${W(55)}`,
      "--surface-radius": "24px",
      "--control-radius": "999px",
      "--control-shadow": `0 6px 14px -6px ${T(28)}, inset 0 -2px 4px ${T(10)}, inset 0 2px 4px ${W(45)}`,
      "--control-shadow-hover": `0 8px 18px -6px ${T(30)}, inset 0 -2px 4px ${T(10)}, inset 0 2px 4px ${W(45)}`,
    },
    match: /clay ?morph|\bclay (ui|style|look)\b|puffy/i,
  },
  {
    id: "brutalism",
    name: "Brutalist",
    description: "Raw and stark: square corners, plain outlines, no decoration.",
    tokens: {
      "--surface-border": "2px solid var(--color-text)",
      "--surface-shadow-hover": "none",
      "--surface-radius": "0",
      "--control-radius": "0",
      "--control-border": "2px solid var(--color-text)",
      "--heading-weight": "800",
    },
    match: /(?<!neo[- ]?)brutalis[mt]/i,
  },
  {
    id: "bauhaus",
    name: "Bauhaus",
    description: "Geometric blocks, square corners and a bold accent edge.",
    tokens: {
      "--surface-border": "2px solid var(--color-text)",
      "--surface-shadow": "0 4px 0 var(--color-accent)",
      "--surface-shadow-hover": "0 6px 0 var(--color-accent)",
      "--surface-radius": "0",
      "--control-radius": "0",
      "--control-border": "2px solid var(--color-text)",
      "--control-shadow": "0 3px 0 var(--color-text)",
      "--control-shadow-hover": "0 4px 0 var(--color-accent)",
      "--heading-weight": "800",
    },
    match: /bauhaus|geometric (style|design|blocks)/i,
  },
];

export const styleVibe = (id?: string): StyleVibe | undefined => STYLE_VIBES.find((v) => v.id === id);

/** The vibe a PRD asks for by name, if any. */
export function vibeFromText(text: string): StyleVibe | undefined {
  return STYLE_VIBES.find((v) => v.id !== "flat" && v.match.test(text)) ?? STYLE_VIBES.find((v) => v.id === "flat" && v.match.test(text));
}

/** Every surface token for a vibe: the flat defaults with the vibe's own values on top. */
export function vibeTokens(id?: string): Record<string, string> {
  return { ...SURFACE_DEFAULTS, ...(styleVibe(id)?.tokens ?? {}) };
}

/** Default surface style suggested for each design template (the user can change it). */
export const TEMPLATE_VIBES: Record<string, string> = {
  midnight: "glass",
  "neon-night": "liquid-glass",
  "playful-pastel": "claymorphism",
  "bold-editorial": "neobrutalism",
  monochrome: "brutalism",
  "nordic-calm": "neumorphism",
};
