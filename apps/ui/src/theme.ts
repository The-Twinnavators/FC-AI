/**
 * Theme overrides edited on the Primitives page (Attributes tabs). Colors are kept per theme (light/dark);
 * sizes and other attributes apply to both. Applied as one stylesheet so they beat the defaults, and saved in the
 * daemon (with a localStorage fallback when the daemon doesn't have the endpoint yet).
 */
import { api } from "./api";

export interface ThemeOverrides {
  all: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
}
const EMPTY: ThemeOverrides = { all: {}, light: {}, dark: {} };
const KEY = "fc.theme.overrides";
let current: ThemeOverrides = structuredClone(EMPTY);
const listeners = new Set<() => void>();

const block = (sel: string, vars: Record<string, string>) => {
  const body = Object.entries(vars)
    .filter(([k, v]) => /^--[\w-]+$/.test(k) && /^[^;{}<>]*$/.test(v))
    .map(([k, v]) => `${k}:${v} !important;`)
    .join("");
  return body ? `${sel}{${body}}` : "";
};

function apply() {
  let el = document.getElementById("fc-theme-overrides") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "fc-theme-overrides";
    document.head.appendChild(el);
  }
  el.textContent = [block(":root", current.all), block(':root:not([data-theme="light"])', current.dark), block(':root[data-theme="light"]', current.light)].join("\n");
  listeners.forEach((l) => l());
}

export const themeOverrides = () => current;
export const onThemeChange = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const activeTheme = (): "light" | "dark" => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/** Loads saved overrides (daemon first, then this browser) and applies them. Call once at startup. */
export async function loadThemeOverrides() {
  try {
    const saved = await api<ThemeOverrides | null>("GET", "/ui/theme");
    if (saved) current = { ...structuredClone(EMPTY), ...saved };
  } catch {
    try {
      current = { ...structuredClone(EMPTY), ...(JSON.parse(localStorage.getItem(KEY) ?? "null") ?? {}) };
    } catch {
      /* nothing saved */
    }
  }
  apply();
}

let saveTimer: number | undefined;
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable */
  }
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void api("POST", "/ui/theme", current).catch(() => undefined), 400);
}

/** Sets one attribute live; `scope` is "theme" for colors (current theme only) or "all". `null` resets it. */
export function setThemeVar(name: string, value: string | null, scope: "theme" | "all") {
  const bucket = scope === "all" ? current.all : current[activeTheme()];
  if (value === null) delete bucket[name];
  else bucket[name] = value;
  apply();
  persist();
}

export function resetThemeVars(names: string[]) {
  for (const n of names) {
    delete current.all[n];
    delete current.light[n];
    delete current.dark[n];
  }
  apply();
  persist();
}
