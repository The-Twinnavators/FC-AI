/**
 * Appearance: how FlowCode picks light or dark.
 *  - toggle: the top bar's light/dark button (the choice is remembered)
 *  - system: follow the computer's light or dark setting
 *  - custom: light or dark per page; moving between pages with different modes fades the colors over half a second
 * Each theme also has a tone: dark is blue (FlowCode's navy) or grey (a neutral application grey); light is white or
 * grey. The top bar's theme menu picks a theme and tone, or System.
 * Stored in this browser (a per-person preference), like the theme itself.
 */
export type ThemeName = "light" | "dark";
export type AppearanceMode = "toggle" | "system" | "custom";
export interface Appearance {
  mode: AppearanceMode;
  /** For custom: the mode per page (by section of the address, "" is the dashboard). */
  pages: Record<string, ThemeName>;
}

export type DarkTone = "blue" | "grey";
export type LightTone = "white" | "grey";
export interface Tones {
  dark: DarkTone;
  light: LightTone;
}

const KEY = "fc.appearance";
const TONES_KEY = "fc.tones";
const THEME_KEY = "fc.theme";
export const APPEARANCE_EVENT = "fc:appearance";

/**
 * Pages people can set: every page in the sidebar, in its order, then the pages you reach from inside them. Keep this in
 * step with the navigation in App.tsx (a page missing here can't be given its own mode).
 */
export const THEMED_PAGES: Array<{ section: string; label: string }> = [
  { section: "", label: "Dashboard" },
  { section: "quality", label: "My Projects" },
  { section: "approvals", label: "Approvals" },
  { section: "discover", label: "Create PRD" },
  { section: "flowreport", label: "Repo Report" },
  { section: "library", label: "Prompts & Skills" },
  { section: "knowledge", label: "Knowledge Hub" },
  { section: "topics", label: "Topic Search" },
  { section: "agents", label: "Agents" },
  { section: "network", label: "Network Graph" },
  { section: "settings", label: "Settings" },
  { section: "about", label: "About FlowCode" },
  { section: "guide", label: "Feature guide" },
  { section: "primitives", label: "Branding" },
  { section: "system", label: "System" },
  // Reached from inside other pages.
  { section: "projects", label: "Project workspace (builder)" },
  { section: "journal", label: "Project journal" },
  { section: "search", label: "Search results" },
];

export function readAppearance(): Appearance {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Appearance> | null;
    if (raw && (raw.mode === "toggle" || raw.mode === "system" || raw.mode === "custom")) return { mode: raw.mode, pages: raw.pages ?? {} };
  } catch {
    /* storage unavailable or malformed */
  }
  return { mode: "toggle", pages: {} };
}

export function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
}

export function manualTheme(): ThemeName {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* storage unavailable */
  }
  return "dark";
}

export function saveManualTheme(t: ThemeName) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage unavailable */
  }
}

export const systemTheme = (): ThemeName => (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** The theme a page should show under the current appearance settings. */
export function themeFor(section: string, a: Appearance = readAppearance()): ThemeName {
  if (a.mode === "system") return systemTheme();
  if (a.mode === "custom") return a.pages[section] ?? manualTheme();
  return manualTheme();
}

export function readTones(): Tones {
  try {
    const raw = JSON.parse(localStorage.getItem(TONES_KEY) ?? "null") as Partial<Tones> | null;
    return { dark: raw?.dark === "grey" ? "grey" : "blue", light: raw?.light === "grey" ? "grey" : "white" };
  } catch {
    return { dark: "blue", light: "white" };
  }
}

export function saveTones(t: Tones) {
  try {
    localStorage.setItem(TONES_KEY, JSON.stringify(t));
  } catch {
    /* storage unavailable */
  }
}

/** The tone for a theme, as the root's data-tone (the stylesheet's grey palettes key off it). */
export const toneFor = (theme: ThemeName, t: Tones = readTones()) => (theme === "dark" ? t.dark : t.light);

let fadeTimer: number | undefined;
/** Applies a theme; a change fades over about half a second unless the person asked for less motion. */
export function applyTheme(next: ThemeName, fade = true) {
  const root = document.documentElement;
  const tone = toneFor(next);
  if (root.dataset.theme === next && root.dataset.tone === tone) return;
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (fade && !calm) {
    root.classList.add("theme-shift");
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => root.classList.remove("theme-shift"), 650);
  }
  root.dataset.theme = next;
  root.dataset.tone = tone;
}
