/**
 * Styles → Design → a component's Configure (after CSSVibes' component canvases): the options each starter-kit
 * component offers, and the CSS they produce. The CSS is written into one managed block at the end of the app's
 * components.css, so it works on every app built from the kit, old or new; the live preview uses the same CSS.
 * Selectors start with :root so they win over the kit's own rules whatever order the stylesheets load in.
 * Only choices that differ from the kit's default produce CSS.
 */

export interface ComponentOption {
  id: string;
  label: string;
  choices: Array<{ id: string; label: string }>;
  /** The kit's own look; choosing it writes nothing. */
  default: string;
}
export interface ComponentStyleSpec {
  title: string;
  options: ComponentOption[];
  css: (v: Record<string, string>) => string;
}
export type ComponentStyleValues = Record<string, Record<string, string>>;

const RADIUS: Record<string, string> = { square: "0", soft: "var(--radius-sm)", rounded: "var(--radius-md)", round: "var(--radius-lg)", pill: "999px" };
const shape = (dflt: string, pill = true): ComponentOption => ({
  id: "shape",
  label: "Corners",
  default: dflt,
  choices: [
    { id: "square", label: "Square" },
    { id: "soft", label: "Soft" },
    { id: "rounded", label: "Rounded" },
    { id: "round", label: "Round" },
    ...(pill ? [{ id: "pill", label: "Pill" }] : []),
  ],
});
const rule = (sel: string, decls: Array<string | false | undefined>) => {
  const d = decls.filter(Boolean);
  return d.length ? `:root ${sel} { ${d.join("; ")}; }` : "";
};
const changed = (v: Record<string, string>, o: ComponentOption) => (v[o.id] && v[o.id] !== o.default ? v[o.id] : undefined);

const SPECS: Record<string, ComponentStyleSpec> = {
  "ui-btn": {
    title: "Buttons",
    options: [
      shape("rounded"),
      { id: "weight", label: "Weight", default: "medium", choices: [{ id: "regular", label: "Regular" }, { id: "medium", label: "Medium" }, { id: "semibold", label: "Semibold" }, { id: "bold", label: "Bold" }] },
      { id: "border", label: "Border", default: "thin", choices: [{ id: "none", label: "None" }, { id: "thin", label: "Thin" }, { id: "thick", label: "Thick" }] },
      { id: "shadow", label: "Shadow", default: "none", choices: [{ id: "none", label: "None" }, { id: "soft", label: "Soft" }, { id: "raised", label: "Raised" }] },
      { id: "case", label: "Text", default: "normal", choices: [{ id: "normal", label: "Normal" }, { id: "upper", label: "Uppercase" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-btn"].options;
      const sh = changed(v, o[0]);
      const w = changed(v, o[1]);
      const b = changed(v, o[2]);
      const s = changed(v, o[3]);
      const c = changed(v, o[4]);
      return [
        rule(".ui-btn", [
          sh && `border-radius: ${RADIUS[sh]}`,
          w && `font-weight: var(--weight-${w})`,
          b && `border-width: ${b === "none" ? "0" : "2px"}`,
          s && `box-shadow: ${s === "soft" ? "0 1px 2px color-mix(in srgb, var(--color-text) 18%, transparent)" : "0 6px 16px -6px color-mix(in srgb, var(--color-text) 40%, transparent)"}`,
          c && "text-transform: uppercase; letter-spacing: 0.04em",
        ]),
      ].join("\n");
    },
  },
  "ui-card": {
    title: "Cards",
    options: [
      { id: "style", label: "Style", default: "basic", choices: [{ id: "basic", label: "Basic" }, { id: "elevated", label: "Elevated" }, { id: "outlined", label: "Outlined" }, { id: "filled", label: "Filled" }] },
      shape("round", false),
      { id: "padding", label: "Padding", default: "regular", choices: [{ id: "compact", label: "Compact" }, { id: "regular", label: "Regular" }, { id: "roomy", label: "Roomy" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-card"].options;
      const st = changed(v, o[0]);
      const sh = changed(v, o[1]);
      const p = changed(v, o[2]);
      return rule(".ui-card", [
        st === "elevated" && "border-color: transparent; box-shadow: 0 10px 28px -14px color-mix(in srgb, var(--color-text) 45%, transparent)",
        st === "outlined" && "border: 2px solid var(--color-border-strong); box-shadow: none",
        st === "filled" && "border-color: transparent; background: var(--color-surface-sunken); box-shadow: none",
        sh && `border-radius: ${RADIUS[sh]}`,
        p && `padding: ${p === "compact" ? "var(--space-4)" : "var(--space-6)"}`,
      ]);
    },
  },
  "ui-field": {
    title: "Text fields",
    options: [
      { id: "style", label: "Style", default: "outlined", choices: [{ id: "outlined", label: "Outlined" }, { id: "filled", label: "Filled" }, { id: "underlined", label: "Underlined" }] },
      shape("soft", false),
      { id: "border", label: "Border", default: "thin", choices: [{ id: "thin", label: "Thin" }, { id: "thick", label: "Thick" }] },
      { id: "label", label: "Label", default: "medium", choices: [{ id: "regular", label: "Regular" }, { id: "medium", label: "Medium" }, { id: "semibold", label: "Semibold" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-field"].options;
      const st = changed(v, o[0]);
      const sh = changed(v, o[1]);
      const b = changed(v, o[2]);
      const l = changed(v, o[3]);
      return [
        rule(".ui-input", [
          st === "filled" && "background: var(--color-surface-sunken); border-color: transparent; border-bottom-color: var(--color-border-strong)",
          st === "underlined" && "border-width: 0 0 2px; border-radius: 0; background: transparent; padding-left: 0; padding-right: 0",
          st !== "underlined" && sh && `border-radius: ${RADIUS[sh]}`,
          st !== "underlined" && b && "border-width: 2px",
        ]),
        rule(".ui-field__label", [l && `font-weight: var(--weight-${l})`]),
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  "ui-badge": {
    title: "Badges",
    options: [
      { id: "style", label: "Style", default: "outline", choices: [{ id: "outline", label: "Outline" }, { id: "soft", label: "Soft" }] },
      shape("soft"),
      { id: "case", label: "Text", default: "normal", choices: [{ id: "normal", label: "Normal" }, { id: "upper", label: "Uppercase" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-badge"].options;
      const st = changed(v, o[0]);
      const sh = changed(v, o[1]);
      const c = changed(v, o[2]);
      return rule(".ui-badge", [
        st === "soft" && "border-color: transparent; background: color-mix(in srgb, currentColor 14%, transparent)",
        sh && `border-radius: ${RADIUS[sh]}`,
        c && "text-transform: uppercase; letter-spacing: 0.05em",
      ]);
    },
  },
  "ui-notice": {
    title: "Alerts",
    options: [
      { id: "style", label: "Style", default: "soft", choices: [{ id: "soft", label: "Soft" }, { id: "outlined", label: "Outlined" }, { id: "tinted", label: "Tinted" }] },
      shape("rounded", false),
    ],
    css: (v) => {
      const o = SPECS["ui-notice"].options;
      const st = changed(v, o[0]);
      const sh = changed(v, o[1]);
      const tint = (mod: string, color: string) => rule(`.ui-notice--${mod}`, [`background: color-mix(in srgb, ${color} 10%, var(--color-surface))`]);
      return [
        rule(".ui-notice", [st === "outlined" && "background: var(--color-surface); border-width: 2px", sh && `border-radius: ${RADIUS[sh]}`]),
        st === "tinted" ? [tint("success", "var(--color-success)"), tint("warning", "var(--color-focus)"), tint("error", "var(--color-danger)")].join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  "ui-tabs": {
    title: "Tabs",
    options: [
      { id: "variant", label: "Style", default: "underline", choices: [{ id: "underline", label: "Underline" }, { id: "pills", label: "Pills" }, { id: "enclosed", label: "Enclosed" }] },
      { id: "indicator", label: "Underline", default: "medium", choices: [{ id: "thin", label: "Thin" }, { id: "medium", label: "Medium" }, { id: "thick", label: "Thick" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-tabs"].options;
      const va = changed(v, o[0]);
      const ind = changed(v, o[1]);
      if (va === "pills")
        return [
          rule(".ui-tabs__list", ["border-bottom: 0", "gap: var(--space-2)"]),
          rule(".ui-tabs__tab", ["border-radius: 999px"]),
          rule('.ui-tabs__tab[aria-selected="true"]', ["box-shadow: none", "background: color-mix(in srgb, var(--color-accent) 14%, transparent)", "color: var(--color-text)"]),
        ].join("\n");
      if (va === "enclosed")
        return [
          rule(".ui-tabs__list", ["gap: 0"]),
          rule(".ui-tabs__tab", ["border: var(--border-width) solid transparent", "border-bottom: 0", "margin-bottom: calc(-1 * var(--border-width))"]),
          rule('.ui-tabs__tab[aria-selected="true"]', ["box-shadow: none", "background: var(--color-surface)", "border-color: var(--color-border)"]),
        ].join("\n");
      return ind ? rule('.ui-tabs__tab[aria-selected="true"]', [`box-shadow: inset 0 -${ind === "thin" ? 2 : 4}px 0 var(--color-accent)`]) : "";
    },
  },
  "ui-shell": {
    title: "Top Nav / App Bar",
    options: [
      { id: "bar", label: "Bar", default: "surface", choices: [{ id: "surface", label: "Surface" }, { id: "tinted", label: "Tinted" }, { id: "brand", label: "Brand colour" }] },
      { id: "current", label: "Current page", default: "underline", choices: [{ id: "underline", label: "Underline" }, { id: "pill", label: "Pill" }, { id: "text", label: "Accent text" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-shell"].options;
      const bar = changed(v, o[0]);
      const cur = changed(v, o[1]);
      const brand = bar === "brand";
      // On the brand bar, links and the current page are drawn in the accent's text colour.
      const ink = brand ? "var(--color-on-accent)" : "var(--color-accent)";
      return [
        bar === "tinted" ? rule(".ui-shell__header", ["background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))"]) : "",
        brand ? rule(".ui-shell__header", ["background: var(--color-accent)", "color: var(--color-on-accent)", "border-bottom-color: transparent"]) : "",
        brand ? rule(".ui-shell__tagline, :root .ui-shell__link", ["color: color-mix(in srgb, var(--color-on-accent) 78%, transparent)"]) : "",
        brand ? rule(".ui-shell__link:hover", ["background: color-mix(in srgb, var(--color-on-accent) 14%, transparent)", "color: var(--color-on-accent)"]) : "",
        brand && !cur ? rule('.ui-shell__link[aria-current="page"]', ["color: var(--color-on-accent)", `box-shadow: inset 0 -3px 0 ${ink}`]) : "",
        cur === "pill" ? rule('.ui-shell__link[aria-current="page"]', ["box-shadow: none", `background: color-mix(in srgb, ${ink} ${brand ? 22 : 14}%, transparent)`, `color: ${brand ? ink : "var(--color-text)"}`]) : "",
        cur === "text" ? rule('.ui-shell__link[aria-current="page"]', ["box-shadow: none", "background: transparent", `color: ${ink}`, "font-weight: var(--weight-bold)"]) : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  "ui-switch": {
    title: "Switches",
    options: [{ id: "size", label: "Size", default: "md", choices: [{ id: "sm", label: "Small" }, { id: "md", label: "Medium" }, { id: "lg", label: "Large" }] }],
    css: (v) => {
      const sz = changed(v, SPECS["ui-switch"].options[0]);
      if (!sz) return "";
      const [w, h, k] = sz === "sm" ? [2.25, 1.25, 0.875] : [3.25, 1.75, 1.375];
      return [
        rule(".ui-switch__thumb", [`width: ${w}rem`, `height: ${h}rem`]),
        rule(".ui-switch__thumb::after", [`width: ${k}rem`, `height: ${k}rem`]),
        rule('.ui-switch[aria-checked="true"] .ui-switch__thumb::after', [`transform: translate(${w - k - 0.375}rem, -50%)`]),
      ].join("\n");
    },
  },
  "ui-table": {
    title: "Tables",
    options: [
      { id: "rows", label: "Rows", default: "lines", choices: [{ id: "lines", label: "Lines" }, { id: "zebra", label: "Zebra" }, { id: "plain", label: "Plain" }] },
      { id: "density", label: "Density", default: "regular", choices: [{ id: "compact", label: "Compact" }, { id: "regular", label: "Regular" }, { id: "roomy", label: "Roomy" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-table"].options;
      const r = changed(v, o[0]);
      const d = changed(v, o[1]);
      return [
        r === "zebra" ? rule(".ui-table tbody tr:nth-child(even)", ["background: var(--color-surface-sunken)"]) : "",
        r === "plain" ? rule(".ui-table td", ["border-top-color: transparent"]) : "",
        d ? rule(".ui-table th, :root .ui-table td", [`padding: ${d === "compact" ? "var(--space-2) var(--space-3)" : "var(--space-4) var(--space-5)"}`]) : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  "ui-progress": {
    title: "Progress",
    options: [
      { id: "height", label: "Height", default: "regular", choices: [{ id: "thin", label: "Thin" }, { id: "regular", label: "Regular" }, { id: "thick", label: "Thick" }] },
      { id: "shape", label: "Ends", default: "soft", choices: [{ id: "square", label: "Square" }, { id: "soft", label: "Soft" }, { id: "pill", label: "Round" }] },
    ],
    css: (v) => {
      const o = SPECS["ui-progress"].options;
      const h = changed(v, o[0]);
      const sh = changed(v, o[1]);
      return rule(".ui-progress__track", [h && `height: ${h === "thin" ? "0.25rem" : "0.75rem"}`, sh && `border-radius: ${RADIUS[sh]}`]);
    },
  },
  "ui-avatar": {
    title: "Avatars",
    options: [{ id: "shape", label: "Shape", default: "circle", choices: [{ id: "circle", label: "Circle" }, { id: "rounded", label: "Rounded" }, { id: "square", label: "Square" }] }],
    css: (v) => {
      const sh = changed(v, SPECS["ui-avatar"].options[0]);
      return sh ? rule(".ui-avatar", [`border-radius: ${sh === "rounded" ? "var(--radius-md)" : "0"}`]) : "";
    },
  },
};

/**
 * Size, on every component: Compact, Regular (the kit) or Large. It scales the kit's text, spacing and control tokens
 * on that component only, so its padding, text and controls grow or shrink together and the rest of the app keeps
 * its size (the user asked to size buttons and alerts from Styles → Configure).
 */
const SIZE: ComponentOption = { id: "size", label: "Size", default: "regular", choices: [{ id: "compact", label: "Compact" }, { id: "regular", label: "Regular" }, { id: "large", label: "Large" }] };
const SIZE_FACTOR: Record<string, number> = { compact: 0.875, large: 1.2 };
/** The kit's sizes in rem (tokens.css), scaled per component. */
const KIT_SIZES: Record<string, number> = {
  "--text-xs": 0.75, "--text-sm": 0.875, "--text-md": 1, "--text-lg": 1.25, "--text-xl": 1.75,
  "--space-1": 0.25, "--space-2": 0.5, "--space-3": 0.75, "--space-4": 1, "--space-5": 1.5, "--space-6": 2, "--space-7": 3,
  "--control-sm": 2, "--control-md": 2.5, "--control-lg": 3, "--control-xl": 3.5,
  "--control-pad-sm": 1, "--control-pad-md": 1.25, "--control-pad-lg": 1.5, "--control-pad-xl": 1.75,
  "--control-text-sm": 0.8125, "--control-text-md": 0.875, "--control-text-lg": 1, "--control-text-xl": 1.125,
};
/** Where a component's size applies when its block class isn't the part to scale (AppShell wraps the whole app). */
const SIZE_ROOT: Record<string, string> = { "ui-shell": ".ui-shell__header" };
const sizeCss = (block: string, v: Record<string, string>) => {
  const f = SIZE_FACTOR[changed(v, SIZE) ?? ""];
  if (!f) return "";
  const n = (x: number) => `${Number((x * f).toFixed(4))}rem`;
  return rule(SIZE_ROOT[block] ?? `.${block}`, [`font-size: ${f}em`, ...Object.entries(KIT_SIZES).map(([k, x]) => `${k}: ${n(x)}`)]);
};
const titleOf = (block: string) => block.replace(/^ui-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** A component's options: Size, then its own. Any kit component (ui-…) can at least be sized. */
export const componentStyleSpec = (block: string): ComponentStyleSpec | undefined => {
  const own = SPECS[block] ?? (/^ui-[a-z-]+$/.test(block) ? { title: titleOf(block), options: [], css: () => "" } : undefined);
  if (!own) return undefined;
  return { ...own, options: [SIZE, ...own.options], css: (v) => [sizeCss(block, v), own.css(v)].filter(Boolean).join("\n") };
};
export const CONFIGURABLE_BLOCKS = Object.keys(SPECS);

/** The CSS for every configured component (the managed block's content). */
export function componentStylesCss(values: ComponentStyleValues): string {
  return Object.entries(values)
    .map(([block, v]) => (componentStyleSpec(block)?.css(v) ?? "").split("\n").filter((l) => l.trim()).join("\n"))
    .filter(Boolean)
    .join("\n");
}
