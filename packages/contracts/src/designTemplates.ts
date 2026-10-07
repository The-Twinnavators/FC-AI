/**
 * Visual design templates for new builds, offered in New build when the PRD doesn't set its own look, and the extras a
 * user can ask for ("Would you like to add…"). A template is a full theme: semantic colours (all pairs pass WCAG AA),
 * fonts and corner radii; the runtime writes it into the starter's tokens.css when it scaffolds the app.
 */

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
  };
  fonts: { sans: string; display: string };
  /** --radius-sm, --radius-md, --radius-lg, --radius-xl in px. */
  radii: [number, number, number, number];
}

const NEO = `Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif`;
const HUMANIST = `Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif`;
const GEOMETRIC = `Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif`;
const ROUNDED = `ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif`;
const OLDSTYLE = `"Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif`;
const TRANSITIONAL = `Charter, "Bitstream Charter", "Sitka Text", Cambria, serif`;
const DIDONE = `Didot, "Bodoni MT", "Noto Serif Display", "URW Palladio L", P052, Sylfaen, serif`;
const INDUSTRIAL = `Bahnschrift, "DIN Alternate", "Franklin Gothic Medium", "Nimbus Sans Narrow", sans-serif-condensed, sans-serif`;

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    description: "White space, crisp type and a single blue accent.",
    dark: false,
    colors: { bg: "#ffffff", surface: "#f7f8fa", surfaceSunken: "#eef0f4", text: "#111827", textMuted: "#4b5563", border: "#e5e7eb", borderStrong: "#6b7280", accent: "#2563eb", accentHover: "#1d4ed8", onAccent: "#ffffff", focus: "#2563eb", success: "#15803d", danger: "#b91c1c", dangerSurface: "#fef2f2" },
    fonts: { sans: NEO, display: NEO },
    radii: [4, 6, 8, 10],
  },
  {
    id: "soft-neutral",
    name: "Soft Neutral",
    description: "Warm greys, gentle curves and a terracotta accent.",
    dark: false,
    colors: { bg: "#faf8f5", surface: "#ffffff", surfaceSunken: "#f1ede7", text: "#2b2622", textMuted: "#5f5650", border: "#e6dfd6", borderStrong: "#857a70", accent: "#b4532a", accentHover: "#974321", onAccent: "#ffffff", focus: "#b4532a", success: "#3f7a4f", danger: "#b3261e", dangerSurface: "#fbeae7" },
    fonts: { sans: HUMANIST, display: OLDSTYLE },
    radii: [6, 10, 14, 18],
  },
  {
    id: "nordic-calm",
    name: "Nordic Calm",
    description: "Cool whites, slate text and a quiet teal.",
    dark: false,
    colors: { bg: "#f6f8f9", surface: "#ffffff", surfaceSunken: "#eaeff1", text: "#1c2b33", textMuted: "#4a5b63", border: "#dbe3e7", borderStrong: "#6d7f88", accent: "#0f766e", accentHover: "#0b5d57", onAccent: "#ffffff", focus: "#0f766e", success: "#15803d", danger: "#b42318", dangerSurface: "#fdecea" },
    fonts: { sans: HUMANIST, display: HUMANIST },
    radii: [4, 8, 12, 16],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark navy with soft indigo highlights.",
    dark: true,
    colors: { bg: "#0f1420", surface: "#171d2b", surfaceSunken: "#0b0f18", text: "#e8ebf3", textMuted: "#a3acc0", border: "#283044", borderStrong: "#6b7591", accent: "#818cf8", accentHover: "#a5b4fc", onAccent: "#0f1420", focus: "#a5b4fc", success: "#4ade80", danger: "#f87171", dangerSurface: "#3a1d22" },
    fonts: { sans: NEO, display: NEO },
    radii: [6, 8, 10, 14],
  },
  {
    id: "playful-pastel",
    name: "Playful Pastel",
    description: "Cream background, rounded type and a bright purple.",
    dark: false,
    colors: { bg: "#fffaf3", surface: "#ffffff", surfaceSunken: "#f6eee2", text: "#2d2140", textMuted: "#5c4f6e", border: "#ece2f5", borderStrong: "#8b7aa3", accent: "#7c3aed", accentHover: "#6425d0", onAccent: "#ffffff", focus: "#7c3aed", success: "#15803d", danger: "#c2255c", dangerSurface: "#fdeaf1" },
    fonts: { sans: ROUNDED, display: ROUNDED },
    radii: [8, 12, 16, 24],
  },
  {
    id: "bold-editorial",
    name: "Bold Editorial",
    description: "Magazine headlines, sharp corners and a red accent.",
    dark: false,
    colors: { bg: "#ffffff", surface: "#fafafa", surfaceSunken: "#f0f0f0", text: "#0a0a0a", textMuted: "#4a4a4a", border: "#e2e2e2", borderStrong: "#6e6e6e", accent: "#c8102e", accentHover: "#a00d25", onAccent: "#ffffff", focus: "#0a0a0a", success: "#1e7a3c", danger: "#c8102e", dangerSurface: "#fdebee" },
    fonts: { sans: NEO, display: DIDONE },
    radii: [0, 2, 2, 4],
  },
  {
    id: "botanical",
    name: "Botanical",
    description: "Sage tones, deep green and a bookish serif.",
    dark: false,
    colors: { bg: "#f4f7f2", surface: "#ffffff", surfaceSunken: "#e8eee4", text: "#1d2a20", textMuted: "#4b5c4f", border: "#d7e1d2", borderStrong: "#6d806f", accent: "#2f6b4f", accentHover: "#245540", onAccent: "#ffffff", focus: "#2f6b4f", success: "#2f6b4f", danger: "#b3261e", dangerSurface: "#fbeae7" },
    fonts: { sans: HUMANIST, display: TRANSITIONAL },
    radii: [4, 8, 10, 14],
  },
  {
    id: "sunset-warm",
    name: "Sunset Warm",
    description: "Ivory and coral with friendly geometric type.",
    dark: false,
    colors: { bg: "#fff8f3", surface: "#ffffff", surfaceSunken: "#fbeee4", text: "#2a1a14", textMuted: "#66493d", border: "#f2dccd", borderStrong: "#9b7363", accent: "#c2410c", accentHover: "#9a3412", onAccent: "#ffffff", focus: "#c2410c", success: "#3f7a4f", danger: "#b91c1c", dangerSurface: "#fef2f2" },
    fonts: { sans: GEOMETRIC, display: GEOMETRIC },
    radii: [6, 10, 14, 20],
  },
  {
    id: "corporate-trust",
    name: "Corporate Trust",
    description: "Navy and light grey: steady and businesslike.",
    dark: false,
    colors: { bg: "#f5f7fa", surface: "#ffffff", surfaceSunken: "#e9edf3", text: "#13213a", textMuted: "#46546b", border: "#d8dee8", borderStrong: "#66748b", accent: "#1e3a8a", accentHover: "#172e6e", onAccent: "#ffffff", focus: "#1e3a8a", success: "#166534", danger: "#b91c1c", dangerSurface: "#fef2f2" },
    fonts: { sans: NEO, display: NEO },
    radii: [2, 4, 6, 8],
  },
  {
    id: "neon-night",
    name: "Neon Night",
    description: "Near-black with electric cyan for bold, techy apps.",
    dark: true,
    colors: { bg: "#0b0b12", surface: "#14141f", surfaceSunken: "#08080d", text: "#f1f1f7", textMuted: "#a6a6bf", border: "#262636", borderStrong: "#6c6c88", accent: "#22d3ee", accentHover: "#67e8f9", onAccent: "#071318", focus: "#f0abfc", success: "#4ade80", danger: "#fb7185", dangerSurface: "#3a1420" },
    fonts: { sans: GEOMETRIC, display: GEOMETRIC },
    radii: [4, 6, 10, 14],
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Black, white and greys with condensed headings.",
    dark: false,
    colors: { bg: "#ffffff", surface: "#f6f6f6", surfaceSunken: "#ececec", text: "#111111", textMuted: "#4d4d4d", border: "#dddddd", borderStrong: "#737373", accent: "#111111", accentHover: "#333333", onAccent: "#ffffff", focus: "#111111", success: "#166534", danger: "#b91c1c", dangerSurface: "#fef2f2" },
    fonts: { sans: NEO, display: INDUSTRIAL },
    radii: [0, 2, 4, 6],
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Airy blues and soft curves, calm and open.",
    dark: false,
    colors: { bg: "#f3f9fc", surface: "#ffffff", surfaceSunken: "#e3f0f7", text: "#0c2533", textMuted: "#3e5a69", border: "#cfe3ee", borderStrong: "#5f7f90", accent: "#0369a1", accentHover: "#075985", onAccent: "#ffffff", focus: "#0369a1", success: "#047857", danger: "#b91c1c", dangerSurface: "#fef2f2" },
    fonts: { sans: HUMANIST, display: HUMANIST },
    radii: [6, 10, 14, 18],
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

export const designTemplate = (id?: string): DesignTemplate | undefined => DESIGN_TEMPLATES.find((t) => t.id === id);
