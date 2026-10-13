/**
 * Visual design templates for new builds, offered in New build when the PRD doesn't set its own look, and the extras a
 * user can ask for ("Would you like to add…"). A template is a full theme: semantic colours (all pairs pass WCAG AA),
 * fonts and corner radii; the runtime writes it into the starter's tokens.css when it scaffolds the app.
 *
 * Colour follows 60/30/10: neutrals for 60% (bg, surfaces), a secondary traced from the accent by a stated harmony for
 * 30% (supporting areas), and the accent for 10% (the main action, links, focus).
 */
import { secondaryTokens, warningOn, type HarmonyKind } from "./palette.js";

export interface DesignTemplate {
  id: string;
  name: string;
  /** One line for the picker. */
  description: string;
  /** Dark-first theme (dark background at the root). */
  dark: boolean;
  colors: {
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
    focus: string;
    success: string;
    danger: string;
    dangerSurface: string;
    /**
     * The 30% colour (60/30/10 rule): traced from the accent by `secondaryHarmony`, calmer than the accent. Its fill,
     * hover, text, tint and border tokens are computed by templateTokens() with WCAG AA checks.
     */
    secondary: string;
  };
  /** Which harmony the secondary comes from (hue offset from the accent, OKLCH degrees). */
  secondaryHarmony: { kind: HarmonyKind; offset: number };
  fonts: { sans: string; display: string };
  /** --radius-sm, --radius-md, --radius-lg, --radius-xl in px. */
  radii: [number, number, number, number];
}

const NEO = `Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif`;
const HUMANIST = `"Source Sans 3", Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif`;
const GEOMETRIC = `Montserrat, Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif`;
const ROUNDED = `Quicksand, ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif`;
const OLDSTYLE = `"Source Serif 4", "Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif`;
const TRANSITIONAL = `Literata, Charter, "Bitstream Charter", "Sitka Text", Cambria, serif`;
const DIDONE = `"Playfair Display", Didot, "Bodoni MT", "Noto Serif Display", "URW Palladio L", P052, Sylfaen, serif`;
const ROBOTO = `Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif`;
const DMSANS = `"DM Sans", Inter, "Helvetica Neue", Arial, sans-serif`;
const WORKSANS = `"Work Sans", "Helvetica Neue", Arial, sans-serif`;
const FRAUNCES = `Fraunces, "Iowan Old Style", Georgia, serif`;
const OSWALD = `Oswald, "Arial Narrow", "Roboto Condensed", sans-serif-condensed, Impact, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    description: "White space, crisp type and a single blue accent.",
    dark: false,
    // Analogous (−30°): the blue accent's cooler neighbour, a calm teal-blue for tags and tinted panels.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#ffffff", surface: "#f7f8fa", surfaceSunken: "#eef0f4", text: "#111827", textMuted: "#4b5563", border: "#e5e7eb", borderStrong: "#6b7280", accent: "#2563eb", accentHover: "#1d4ed8", onAccent: "#ffffff", focus: "#2563eb", success: "#15803d", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#197aa3" },
    fonts: { sans: NEO, display: NEO },
    radii: [4, 6, 8, 10],
  },
  {
    id: "soft-neutral",
    name: "Soft Neutral",
    description: "Warm greys, gentle curves and a terracotta accent.",
    dark: false,
    // Split-complementary (−150°): a dusty blue beside terracotta's opposite, soft contrast for warm greys.
    secondaryHarmony: { kind: "split-complementary", offset: -150 },
    colors: { bg: "#faf8f5", surface: "#ffffff", surfaceSunken: "#f1ede7", text: "#2b2622", textMuted: "#5f5650", border: "#e6dfd6", borderStrong: "#857a70", accent: "#b4532a", accentHover: "#974321", onAccent: "#ffffff", focus: "#b4532a", success: "#3f7a4f", danger: "#b3261e", dangerSurface: "#fbeae7", secondary: "#4f77a3" },
    fonts: { sans: HUMANIST, display: OLDSTYLE },
    radii: [6, 10, 14, 18],
  },
  {
    id: "nordic-calm",
    name: "Nordic Calm",
    description: "Cool whites, slate text and a quiet teal.",
    dark: false,
    // Analogous (+30°): the teal's slate-blue neighbour, quiet and cohesive.
    secondaryHarmony: { kind: "analogous", offset: 30 },
    colors: { bg: "#f6f8f9", surface: "#ffffff", surfaceSunken: "#eaeff1", text: "#1c2b33", textMuted: "#4a5b63", border: "#dbe3e7", borderStrong: "#6d7f88", accent: "#0f766e", accentHover: "#0b5d57", onAccent: "#ffffff", focus: "#0f766e", success: "#15803d", danger: "#b42318", dangerSurface: "#fdecea", secondary: "#36707e" },
    fonts: { sans: HUMANIST, display: HUMANIST },
    radii: [4, 8, 12, 16],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark navy with soft indigo highlights.",
    dark: true,
    // Analogous (−30°): a sky blue next to the indigo, cool and calm on navy.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#0f1420", surface: "#171d2b", surfaceSunken: "#0b0f18", text: "#e8ebf3", textMuted: "#a3acc0", border: "#283044", borderStrong: "#6b7591", accent: "#818cf8", accentHover: "#a5b4fc", onAccent: "#0f1420", focus: "#a5b4fc", success: "#4ade80", danger: "#f87171", dangerSurface: "#3a1d22", secondary: "#569edd" },
    fonts: { sans: NEO, display: NEO },
    radii: [6, 8, 10, 14],
  },
  {
    id: "playful-pastel",
    name: "Playful Pastel",
    description: "Cream background, rounded type and a bright purple.",
    dark: false,
    // Triadic (−120°): a muted teal a third of the wheel from the purple, playful but calmer than the accent.
    secondaryHarmony: { kind: "triadic", offset: -120 },
    colors: { bg: "#fffaf3", surface: "#ffffff", surfaceSunken: "#f6eee2", text: "#2d2140", textMuted: "#5c4f6e", border: "#ece2f5", borderStrong: "#8b7aa3", accent: "#7c3aed", accentHover: "#6425d0", onAccent: "#ffffff", focus: "#7c3aed", success: "#15803d", danger: "#c2255c", dangerSurface: "#fdeaf1", secondary: "#19816a" },
    fonts: { sans: ROUNDED, display: ROUNDED },
    radii: [8, 12, 16, 24],
  },
  {
    id: "bold-editorial",
    name: "Bold Editorial",
    description: "Magazine headlines, sharp corners and a red accent.",
    dark: false,
    // Split-complementary (−150°): an ink blue beside the red's opposite, the classic editorial pairing.
    secondaryHarmony: { kind: "split-complementary", offset: -150 },
    colors: { bg: "#ffffff", surface: "#fafafa", surfaceSunken: "#f0f0f0", text: "#0a0a0a", textMuted: "#4a4a4a", border: "#e2e2e2", borderStrong: "#6e6e6e", accent: "#c8102e", accentHover: "#a00d25", onAccent: "#ffffff", focus: "#0a0a0a", success: "#1e7a3c", danger: "#c8102e", dangerSurface: "#fdebee", secondary: "#19759c" },
    fonts: { sans: NEO, display: DIDONE },
    radii: [0, 2, 2, 4],
  },
  {
    id: "botanical",
    name: "Botanical",
    description: "Sage tones, deep green and a bookish serif.",
    dark: false,
    // Analogous (−30°): a moss olive next to the deep green, earthy and leafy.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#f4f7f2", surface: "#ffffff", surfaceSunken: "#e8eee4", text: "#1d2a20", textMuted: "#4b5c4f", border: "#d7e1d2", borderStrong: "#6d806f", accent: "#2f6b4f", accentHover: "#245540", onAccent: "#ffffff", focus: "#2f6b4f", success: "#2f6b4f", danger: "#b3261e", dangerSurface: "#fbeae7", secondary: "#526441" },
    fonts: { sans: HUMANIST, display: TRANSITIONAL },
    radii: [4, 8, 10, 14],
  },
  {
    id: "sunset-warm",
    name: "Sunset Warm",
    description: "Ivory and coral with friendly geometric type.",
    dark: false,
    // Split-complementary (+150°): a sea teal beside coral's opposite, warm and cool in balance (amber would read as a warning).
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#fff8f3", surface: "#ffffff", surfaceSunken: "#fbeee4", text: "#2a1a14", textMuted: "#66493d", border: "#f2dccd", borderStrong: "#9b7363", accent: "#c2410c", accentHover: "#9a3412", onAccent: "#ffffff", focus: "#c2410c", success: "#3f7a4f", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#0c847d" },
    fonts: { sans: GEOMETRIC, display: GEOMETRIC },
    radii: [6, 10, 14, 20],
  },
  {
    id: "corporate-trust",
    name: "Corporate Trust",
    description: "Navy and light grey: steady and businesslike.",
    dark: false,
    // Analogous (−30°): a steel blue next to the navy, steady and businesslike.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#f5f7fa", surface: "#ffffff", surfaceSunken: "#e9edf3", text: "#13213a", textMuted: "#46546b", border: "#d8dee8", borderStrong: "#66748b", accent: "#1e3a8a", accentHover: "#172e6e", onAccent: "#ffffff", focus: "#1e3a8a", success: "#166534", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#095c81" },
    fonts: { sans: NEO, display: NEO },
    radii: [2, 4, 6, 8],
  },
  {
    id: "neon-night",
    name: "Neon Night",
    description: "Near-black with electric cyan for bold, techy apps.",
    dark: true,
    // Split-complementary (+150°): a muted orchid beside the cyan's opposite, neon contrast without a second shout.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#0b0b12", surface: "#14141f", surfaceSunken: "#08080d", text: "#f1f1f7", textMuted: "#a6a6bf", border: "#262636", borderStrong: "#6c6c88", accent: "#22d3ee", accentHover: "#67e8f9", onAccent: "#071318", focus: "#f0abfc", success: "#4ade80", danger: "#fb7185", dangerSurface: "#3a1420", secondary: "#c28395" },
    fonts: { sans: GEOMETRIC, display: GEOMETRIC },
    radii: [4, 6, 10, 14],
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Black, white and greys with Roboto headings.",
    dark: false,
    // Analogous (−30°) from a cool slate base (the accent is black, so it has no hue of its own): an ink slate that keeps the look monochrome.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#ffffff", surface: "#f6f6f6", surfaceSunken: "#ececec", text: "#111111", textMuted: "#4d4d4d", border: "#dddddd", borderStrong: "#737373", accent: "#111111", accentHover: "#333333", onAccent: "#ffffff", focus: "#111111", success: "#166534", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#3f5a63" },
    fonts: { sans: NEO, display: ROBOTO },
    radii: [0, 2, 4, 6],
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Airy blues and soft curves, calm and open.",
    dark: false,
    // Analogous (−30°): a deep sea teal next to the ocean blue, airy and open.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#f3f9fc", surface: "#ffffff", surfaceSunken: "#e3f0f7", text: "#0c2533", textMuted: "#3e5a69", border: "#cfe3ee", borderStrong: "#5f7f90", accent: "#0369a1", accentHover: "#075985", onAccent: "#ffffff", focus: "#0369a1", success: "#047857", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#186f7e" },
    fonts: { sans: HUMANIST, display: HUMANIST },
    radii: [6, 10, 14, 18],
  },
  {
    id: "forest-night",
    name: "Forest Night",
    description: "A deep pine night with fern green, lantern gold and a soft serif.",
    dark: true,
    // Analogous (−30°): an olive gold beside the fern, like lantern light under the trees.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#0e1a13", surface: "#16261c", surfaceSunken: "#0a130e", text: "#ecf3e6", textMuted: "#a7b9a0", border: "#25392b", borderStrong: "#66826c", accent: "#a3d977", accentHover: "#bfe69a", onAccent: "#14240a", focus: "#bfe69a", success: "#4ade80", danger: "#f87171", dangerSurface: "#3a1d1f", secondary: "#a59b48" },
    fonts: { sans: DMSANS, display: FRAUNCES },
    radii: [8, 12, 16, 22],
  },
  {
    id: "espresso",
    name: "Espresso",
    description: "Dark coffee browns with a warm caramel accent.",
    dark: true,
    // Split-complementary (+150°): a dusty blue across from the caramel, cool relief on the browns.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#17110d", surface: "#211913", surfaceSunken: "#100b08", text: "#f3ebe4", textMuted: "#bba99a", border: "#352920", borderStrong: "#7d6858", accent: "#e0a458", accentHover: "#ecbd7f", onAccent: "#241405", focus: "#ecbd7f", success: "#6fcf8f", danger: "#f28b82", dangerSurface: "#3b1e1a", secondary: "#65a3b7" },
    fonts: { sans: WORKSANS, display: FRAUNCES },
    radii: [4, 8, 12, 16],
  },
  {
    id: "lavender-fields",
    name: "Lavender Fields",
    description: "Lilac whites, a deep plum accent and an elegant serif.",
    dark: false,
    // Analogous (−30°): a rosy mauve beside the plum, soft and cohesive.
    secondaryHarmony: { kind: "analogous", offset: -30 },
    colors: { bg: "#faf7fd", surface: "#ffffff", surfaceSunken: "#f1ebf8", text: "#261b33", textMuted: "#5b4d6b", border: "#e6dcf0", borderStrong: "#8a7a9c", accent: "#7b3f9e", accentHover: "#642f83", onAccent: "#ffffff", focus: "#7b3f9e", success: "#2f7a4f", danger: "#b3261e", dangerSurface: "#fbeaea", secondary: "#55559f" },
    fonts: { sans: DMSANS, display: DIDONE },
    radii: [8, 12, 16, 22],
  },
  {
    id: "citrus-fresh",
    name: "Citrus Fresh",
    description: "Bright off-white with a zesty olive-lime and clean geometric type.",
    dark: false,
    // Analogous (+30°): a leafy green-teal next to the lime, fresh without a second shout.
    secondaryHarmony: { kind: "analogous", offset: 30 },
    colors: { bg: "#fbfdf5", surface: "#ffffff", surfaceSunken: "#f1f6e3", text: "#1c2410", textMuted: "#4f5b3e", border: "#e0e9cc", borderStrong: "#7a8667", accent: "#4d7c0f", accentHover: "#3f6212", onAccent: "#ffffff", focus: "#4d7c0f", success: "#15803d", danger: "#b91c1c", dangerSurface: "#fef2f2", secondary: "#207f59" },
    fonts: { sans: DMSANS, display: GEOMETRIC },
    radii: [6, 10, 14, 20],
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Near-black with signal teal and monospace headings, for developer tools.",
    dark: true,
    // Split-complementary (+150°): an orchid magenta across from the teal, the classic terminal pairing on near-black.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#091010", surface: "#101818", surfaceSunken: "#060b0b", text: "#e0f4f2", textMuted: "#94b0ad", border: "#1d2b2a", borderStrong: "#577572", accent: "#2dd4bf", accentHover: "#5eead4", onAccent: "#042f2a", focus: "#5eead4", success: "#4ade80", danger: "#f87171", dangerSurface: "#3a1717", secondary: "#b686ae" },
    fonts: { sans: NEO, display: MONO },
    radii: [2, 4, 6, 8],
  },
  {
    id: "rose-blush",
    name: "Rose Blush",
    description: "Blush pinks, a rich rose accent and a high-contrast serif.",
    dark: false,
    // Split-complementary (+150°): a sea teal across from the rose, balanced and fresh.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#fff7f9", surface: "#ffffff", surfaceSunken: "#fbe9ef", text: "#2e1520", textMuted: "#6b4655", border: "#f3dbe3", borderStrong: "#9a7180", accent: "#be185d", accentHover: "#9d174d", onAccent: "#ffffff", focus: "#be185d", success: "#2f7a4f", danger: "#b91c1c", dangerSurface: "#fdecec", secondary: "#1f7e49" },
    fonts: { sans: HUMANIST, display: DIDONE },
    radii: [6, 10, 16, 22],
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description: "Sand and parchment with an ochre accent and a bookish serif.",
    dark: false,
    // Split-complementary (−150°): a slate blue across from the ochre, like stone and sky.
    secondaryHarmony: { kind: "split-complementary", offset: -150 },
    colors: { bg: "#f8f4ec", surface: "#fffdf9", surfaceSunken: "#efe7d8", text: "#2a2217", textMuted: "#5e5240", border: "#e5dac6", borderStrong: "#8c7b62", accent: "#8a5a00", accentHover: "#6f4800", onAccent: "#ffffff", focus: "#8a5a00", success: "#3f7a4f", danger: "#b3261e", dangerSurface: "#fbeae7", secondary: "#60618a" },
    fonts: { sans: HUMANIST, display: TRANSITIONAL },
    radii: [4, 6, 10, 14],
  },
  {
    id: "retro-pop",
    name: "Retro Pop",
    description: "Cream paper, deep teal and tall condensed headlines.",
    dark: false,
    // Triadic (+120°): a plum a third of the wheel from the teal, a retro two-ink print.
    secondaryHarmony: { kind: "triadic", offset: 120 },
    colors: { bg: "#fdf6e3", surface: "#fffbf0", surfaceSunken: "#f5ead0", text: "#1f1a14", textMuted: "#5a4f40", border: "#eadfc4", borderStrong: "#8a7b60", accent: "#0f6b74", accentHover: "#0b545b", onAccent: "#ffffff", focus: "#0f6b74", success: "#2f7a4f", danger: "#b3261e", dangerSurface: "#fbeae7", secondary: "#6d556d" },
    fonts: { sans: WORKSANS, display: OSWALD },
    radii: [0, 4, 6, 10],
  },
  {
    id: "royal-plum",
    name: "Royal Plum",
    description: "Deep plum night with gold highlights and a classic serif.",
    dark: true,
    // Split-complementary (+150°): a muted blue across from the gold, regal and calm.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#150f1c", surface: "#1e1627", surfaceSunken: "#0e0a13", text: "#f1eaf6", textMuted: "#b3a5c0", border: "#30253c", borderStrong: "#786a88", accent: "#e3b85c", accentHover: "#eecb83", onAccent: "#22170a", focus: "#eecb83", success: "#6fcf8f", danger: "#f28b82", dangerSurface: "#3b1c22", secondary: "#6aa0bf" },
    fonts: { sans: HUMANIST, display: DIDONE },
    radii: [4, 8, 12, 16],
  },
  {
    id: "slate-ember",
    name: "Slate Ember",
    description: "Charcoal slate with a glowing ember orange, for focused tools.",
    dark: true,
    // Split-complementary (+150°): a steel blue across from the ember, cool against the warm accent.
    secondaryHarmony: { kind: "split-complementary", offset: 150 },
    colors: { bg: "#111418", surface: "#1a1e24", surfaceSunken: "#0b0d10", text: "#eceff3", textMuted: "#a5adb8", border: "#2a3038", borderStrong: "#6c7682", accent: "#fb923c", accentHover: "#fdba74", onAccent: "#1f1206", focus: "#fdba74", success: "#4ade80", danger: "#f87171", dangerSurface: "#3a1b1b", secondary: "#41a9b5" },
    fonts: { sans: WORKSANS, display: GEOMETRIC },
    radii: [4, 6, 10, 14],
  },
];

export interface BuildExtra {
  id: string;
  label: string;
  /** Short explanation under the checkbox. */
  hint: string;
  /** What the planner is told to build. */
  guidance: string;
  /** A PRD that mentions this already asks for it (pre-ticked). */
  match: RegExp;
}

export const BUILD_EXTRAS: BuildExtra[] = [
  { id: "micro-animations", label: "Micro-animations", hint: "Small hover, press and focus feedback on buttons, cards and fields.", guidance: "Add subtle micro-animations (120–200 ms) for hover, press and focus on buttons, cards and inputs, using the --duration-fast and --easing tokens.", match: /micro[- ]?animation|micro[- ]?interaction|hover (state|effect)s?|press feedback/i },
  { id: "page-transitions", label: "Page transitions", hint: "Screens fade or slide into each other instead of switching abruptly.", guidance: "Animate changes between screens or views with a short fade or slide (about 200 ms).", match: /page transition|view transition|screen transition/i },
  { id: "skeleton-loading", label: "Skeleton loading", hint: "Grey placeholder shapes while content loads.", guidance: "While data loads, show skeleton placeholders shaped like the content (cards, rows, text lines) instead of a spinner or blank space.", match: /skeleton/i },
  { id: "lazy-loading", label: "Lazy loading", hint: "Images and heavy screens load only when needed.", guidance: "Lazy-load images (loading=\"lazy\" with width and height set) and split large screens so they load on demand.", match: /lazy[- ]?load/i },
  { id: "theme-toggle", label: "Light and dark mode switch", hint: "A toggle between light and dark, remembered on this device.", guidance: "Add a light/dark theme switch: a second palette for the other mode in tokens.css under [data-theme], a toggle control, and the choice remembered in local storage (defaulting to the system setting).", match: /dark mode|light mode|theme (toggle|switch)/i },
  { id: "toasts", label: "Toast messages", hint: "Short confirmations like \"Saved\" that fade away.", guidance: "Add toast messages for confirmations and errors (\"Saved\", \"Couldn't save\"), announced to screen readers and dismissing on their own after a few seconds.", match: /toast|snackbar/i },
  { id: "empty-states", label: "Friendly empty states", hint: "Helpful messages and a next step when a list is empty.", guidance: "Design every empty list or screen with a short friendly message, a simple illustration or icon, and the next action as a button.", match: /empty state/i },
  { id: "scroll-reveal", label: "Scroll reveal", hint: "Sections fade in gently as you scroll to them.", guidance: "Fade and slide sections in gently as they scroll into view (IntersectionObserver), once per section.", match: /scroll(-| )?reveal|animate on scroll|reveal on scroll/i },
  { id: "sticky-header", label: "Sticky header", hint: "The top bar stays visible while scrolling.", guidance: "Keep the app header and main navigation visible while scrolling (position: sticky), with a subtle shadow once the page has scrolled.", match: /sticky (header|nav)/i },
  { id: "keyboard-shortcuts", label: "Keyboard shortcuts", hint: "Quick keys for the main actions, with a help list.", guidance: "Add keyboard shortcuts for the main actions, shown in a help dialog opened with ?, and never overriding the browser's or screen reader's own keys.", match: /keyboard shortcut|hotkey/i },
  { id: "installable", label: "Install as an app", hint: "Add to home screen and work offline (PWA).", guidance: "Make the app installable: a web app manifest with name, icons and theme colours, and a service worker that caches the app shell so it opens offline.", match: /\bpwa\b|installable|web app manifest|add to home screen/i },
];

/** A template's colour tokens as CSS custom properties (the starter's tokens.css names), secondary tokens included. */
export function templateTokens(t: DesignTemplate): Record<string, string> {
  const c = t.colors;
  return {
    "--color-bg": c.bg,
    "--color-surface": c.surface,
    "--color-surface-sunken": c.surfaceSunken,
    "--color-text": c.text,
    "--color-text-muted": c.textMuted,
    "--color-border": c.border,
    "--color-border-strong": c.borderStrong,
    "--color-accent": c.accent,
    "--color-accent-hover": c.accentHover,
    "--color-on-accent": c.onAccent,
    "--color-focus": c.focus,
    "--color-success": c.success,
    // Warning badges, alerts and progress use it; an amber that reads on this theme's surface.
    "--color-warning": warningOn(c.surface, t.dark, c.bg),
    "--color-danger": c.danger,
    "--color-danger-surface": c.dangerSurface,
    ...secondaryTokens(c.secondary, t.dark ? "dark" : "light", { surface: c.surface, text: c.text }),
  };
}

export const designTemplate = (id?: string): DesignTemplate | undefined => DESIGN_TEMPLATES.find((t) => t.id === id);
