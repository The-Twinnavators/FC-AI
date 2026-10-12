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
  // Extra traits any style can set. The defaults reproduce the flat look; `initial` means "not set", so each
  // component keeps its own colour (e.g. a variant's accent border) until a style provides one.
  "--control-bg": "var(--color-surface)", // fill of fields, secondary buttons, chips
  "--accent-bg": "var(--color-accent)", // fill of the primary action (a style can make it a gradient)
  "--control-edge": "initial", // outline colour of every filled control, overriding the variant's own
  "--surface-edge": "initial", // outline colour of tinted surfaces (alerts, selected cards), overriding the tone's own
  "--control-shadow-active": "var(--control-shadow-hover)", // shadow while a control is pressed
  "--control-shadow-focus": "var(--focus-ring)", // shadow while a control has keyboard focus (keep the ring in it)
  "--well-shadow": "var(--control-shadow)", // shadow of fields and tracks (an inset for soft styles)
  "--surface-shadow-selected": "0 0 0 1px var(--color-accent)", // shadow of a picked card or row
  "--surface-shadow-overlay": "initial", // shadow of menus, popovers, dialogs, toasts; unset keeps the component's own
  "--surface-radius-sm": "var(--radius-md)", // corners of small surfaces (toasts, banners, menus, wells)
  "--control-radius-sm": "var(--radius-sm)", // corners of small controls (page numbers, menu items)
  "--pill-radius": "999px", // corners of chips, badges and toggles
  // Corners of text boxes (inputs, textareas, selects, comboboxes): the control radius, but never past 24px, so a
  // pill-shaped button style never turns a textarea into a pill.
  "--field-radius": "min(var(--control-radius), 24px)",
  "--edge-width": "var(--border-width)", // thickness of tab, divider and small-control outlines
  "--overlay-border": "initial", // outline of dialogs, drawers and sheets; unset draws none
  "--hover-lift": "-1px", // controls rise this far on hover
  "--press-scale": "0.98", // controls shrink to this on press
  "--tag-tilt": "0deg", // tilt of a card's corner tag
  "--hover-shift": "none", // extra diagonal move on hover, e.g. -2px -2px
  "--press-shift": "none", // extra diagonal move on press, e.g. 4px 4px
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
      "--control-bg": "color-mix(in srgb, var(--color-surface) 55%, transparent)",
      "--surface-shadow-overlay": `0 18px 48px -14px ${T(45)}, inset 0 1px 0 ${W(40)}`,
      "--surface-shadow-selected": `0 0 0 1px var(--color-accent), 0 10px 32px -14px ${T(35)}`,
      "--surface-radius-sm": "10px",
      "--control-radius-sm": "8px",
      "--overlay-border": `1px solid color-mix(in srgb, var(--color-surface) 50%, var(--color-border))`,
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
      "--control-bg": "color-mix(in srgb, var(--color-surface) 45%, transparent)",
      "--surface-shadow-overlay": `0 22px 56px -16px ${T(42)}, inset 0 1px 0 ${W(50)}`,
      "--surface-shadow-selected": `0 0 0 1px var(--color-accent), 0 12px 36px -16px ${T(38)}`,
      "--surface-radius-sm": "16px",
      "--control-radius-sm": "999px",
      "--field-radius": "14px",
      "--overlay-border": `1px solid ${W(28)}`,
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
      "--control-bg": "var(--color-bg)",
      "--control-border": "1px solid transparent",
      "--control-edge": "transparent",
      "--well-shadow": `inset 3px 3px 7px ${T(16)}, inset -3px -3px 7px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--control-shadow-active": `inset 3px 3px 8px ${T(16)}, inset -3px -3px 8px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--surface-shadow-selected": `inset 5px 5px 12px ${T(16)}, inset -4px -4px 10px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--surface-shadow-overlay": `12px 12px 28px ${T(20)}, -8px -8px 22px color-mix(in srgb, #ffffff 70%, var(--color-bg))`,
      "--surface-radius-sm": "12px",
      "--control-radius-sm": "8px",
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
      "--control-bg": "linear-gradient(180deg, var(--color-surface), color-mix(in srgb, var(--color-surface) 88%, var(--color-text)))",
      "--accent-bg": "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 86%, #ffffff), var(--color-accent))",
      "--well-shadow": `inset 0 1px 3px ${T(28)}`,
      "--control-shadow-active": `inset 0 2px 4px ${T(30)}`,
      "--surface-shadow-overlay": `0 8px 24px -6px ${T(35)}, inset 0 1px 0 ${W(55)}`,
      "--surface-radius-sm": "6px",
      "--overlay-border": `1px solid ${T(20)}`,
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
      "--control-edge": "var(--color-text)",
      "--surface-edge": "var(--color-text)",
      "--control-shadow-active": "0 0 0 var(--color-text)",
      "--control-shadow-focus": "4px 4px 0 var(--color-text), var(--focus-ring)",
      "--surface-shadow-selected": "8px 8px 0 var(--color-text)",
      "--surface-shadow-overlay": "8px 8px 0 var(--color-text)",
      "--surface-radius-sm": "4px",
      "--control-radius-sm": "4px",
      "--hover-lift": "0px",
      "--press-scale": "1",
      "--hover-shift": "-2px -2px",
      "--press-shift": "4px 4px",
      "--edge-width": "3px",
      "--overlay-border": "3px solid var(--color-text)",
      "--tag-tilt": "6deg",
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
      "--control-border": "1px solid transparent",
      "--control-edge": "transparent",
      "--well-shadow": `inset 0 3px 6px ${T(12)}, inset 0 -2px 4px ${W(40)}`,
      "--control-shadow-active": `inset 0 3px 6px ${T(18)}`,
      "--surface-shadow-selected": `0 0 0 2px var(--color-accent), 0 12px 26px -10px ${T(24)}`,
      "--surface-shadow-overlay": `0 20px 40px -12px ${T(30)}, inset 0 4px 8px ${W(55)}`,
      "--surface-radius-sm": "18px",
      "--control-radius-sm": "12px",
      "--field-radius": "16px",
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
      "--surface-radius": "0px",
      "--control-radius": "0px",
      "--control-border": "2px solid var(--color-text)",
      "--heading-weight": "800",
      "--surface-shadow-overlay": "none",
      "--surface-radius-sm": "0px",
      "--control-radius-sm": "0px",
      "--pill-radius": "0px",
      "--edge-width": "2px",
      "--overlay-border": "2px solid var(--color-text)",
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
      "--surface-radius": "0px",
      "--control-radius": "0px",
      "--control-border": "2px solid var(--color-text)",
      "--control-shadow": "0 3px 0 var(--color-text)",
      "--control-shadow-hover": "0 4px 0 var(--color-accent)",
      "--heading-weight": "800",
      "--control-shadow-active": "0 0 0 var(--color-text)",
      "--surface-shadow-selected": "0 0 0 2px var(--color-accent), 0 4px 0 var(--color-accent)",
      "--surface-shadow-overlay": "0 8px 0 var(--color-accent)",
      "--surface-radius-sm": "0px",
      "--control-radius-sm": "0px",
      "--pill-radius": "0px",
      "--press-shift": "0 3px",
      "--edge-width": "2px",
      "--overlay-border": "2px solid var(--color-text)",
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
