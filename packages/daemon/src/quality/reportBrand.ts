/**
 * FlowCode's style guide as constants for the PDF reports (Build analysis and the Compliance report).
 *
 * Transcribed from apps/ui/src/styles/tokens.css (the dark canvas, the text ramps, the borders, the signal colours)
 * and from the sidebar Logo in apps/ui/src/components/ui.tsx (the purple bolt and the "FlowCode AI" wordmark), so a
 * printed report looks like the product it came from. If a token changes there, change it here: the two are not
 * independent.
 *
 * Each state carries two values, one for the dark cover and one for paper. A ramp tuned for a navy canvas is a pale
 * smear at 8pt on white, so the light values are the app's own light-theme tokens rather than the dark ones lightened.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import type { Severity } from "./buildAnalysis.js";

/** The cover: --bg-0 and the navy hero surface, with the app's own --bg-gradient over it. */
export const CANVAS = "#0d1119";
export const CANVAS_TOP = "#151b26";
export const COVER_GRADIENT = "radial-gradient(1200px 640px at 50% -18%, rgba(58, 96, 196, 0.4), transparent 64%), radial-gradient(900px 600px at 105% 40%, rgba(95, 127, 208, 0.1), transparent 60%), linear-gradient(180deg, #151b26 0%, #111620 55%, #0d1119 100%)";

/** The text ramp on dark (--text-0/1/2). */
export const TEXT_PRIMARY = "#ffffff";
export const TEXT_SECONDARY = "#c3c7d0";
export const TEXT_TERTIARY = "#8f96a6";

/** And on paper (the light theme's --text-0/1/2). */
export const INK = "#151b26";
export const INK_SECONDARY = "#424a5c";
export const INK_TERTIARY = "#5a6274";

export const BORDER_DARK = "rgba(190, 200, 222, 0.11)";
export const BORDER_DARK_STRONG = "rgba(190, 200, 222, 0.22)";
export const BORDER_LIGHT = "#dde0e7";
export const BORDER_LIGHT_STRONG = "#cbd0da";
/** Light --bg-2 and --bg-3: the fills behind prompts, notes and table stripes. */
export const WASH = "#f7f8fa";
export const WASH_STRONG = "#eaecf1";

/** The interface blue (--brand-1, and --brand-3 on dark). */
export const BRAND_BLUE = "#3a60c4";
export const BRAND_BLUE_ON_DARK = "#84a0db";

/**
 * The purple of the mark and of the "AI" in the wordmark (.brand-ai). It is the one accent that touches type on the
 * printed page (kickers, numbers, icons); severity has its own colours, so a heading never reads as a warning.
 */
export const ACCENT = "#a78bfa";
export const ACCENT_ON_LIGHT = "#6d28d9";
const MARK_STOPS = ["#c4b5fd", "#8b5cf6", "#4f46e5"];

/**
 * Severity, from the signal tokens (--sig-bad, --sig-warn, --sig-run, --sig-ok) with informational in the slate text
 * colour: a note rather than a lesser problem. Five steps of one hue cannot be told apart at 9pt, so each takes its own.
 */
export const SEVERITY_COLOUR: Record<Severity, { dark: string; light: string }> = {
  critical: { dark: "#ff6b6b", light: "#d0342c" },
  high: { dark: "#f2b33d", light: "#a86400" },
  medium: { dark: "#84a0db", light: "#3a60c4" },
  low: { dark: "#2fc4b2", light: "#0f766e" },
  informational: { dark: "#8f96a6", light: "#5a6274" },
};

/** --sig-ok, for a healthy score. */
export const SUCCESS = { dark: "#2fc4b2", light: "#0f766e" };

/**
 * The type is the app's own (Manrope, Martian Mono), embedded from the UI's @fontsource packages. The PDF is printed
 * from a page loaded with setContent and no network, so a face fetched from Google Fonts would silently fall back;
 * a face on disk cannot. When the packages are not installed the stacks fall back to system faces, which still says
 * everything true and is reported as missing rather than failing the export.
 */
export const HEADING_STACK = `'Manrope', 'Segoe UI', system-ui, sans-serif`;
export const BODY_STACK = `'Manrope', 'Segoe UI', system-ui, sans-serif`;
export const MONO_STACK = `'Martian Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace`;

const FACES = [
  { family: "Manrope", weight: "200 800", spec: "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2" },
  { family: "Martian Mono", weight: "400", spec: "@fontsource/martian-mono/files/martian-mono-latin-400-normal.woff2" },
];

let cached: { css: string; missing: string[] } | undefined;

/** The faces as inline @font-face rules (base64), plus the names of any that were not on disk. */
export function reportFontFace(): { css: string; missing: string[] } {
  if (cached) return cached;
  const require = createRequire(import.meta.url);
  const css: string[] = [];
  const missing: string[] = [];
  for (const f of FACES) {
    try {
      const b64 = fs.readFileSync(require.resolve(f.spec)).toString("base64");
      css.push(`@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
    } catch {
      missing.push(f.family);
    }
  }
  cached = { css: css.join(""), missing };
  return cached;
}

let markSeq = 0;

/** The FlowCode bolt (the sidebar Logo's path and gradient), at a height in px. A plain gradient prints cleanly; no filters. */
export function boltMark(size: number): string {
  const id = `fcmark${++markSeq}`;
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${MARK_STOPS[0]}"/><stop offset="0.45" stop-color="${MARK_STOPS[1]}"/><stop offset="1" stop-color="${MARK_STOPS[2]}"/></linearGradient></defs>` +
    `<path d="M9.5 2.5h17.2c.9 0 1.4 1 .9 1.7l-3.6 5.1c-.4.5-1 .8-1.6.8h-7.2l-1.9 4.6h8.2c.9 0 1.4 1 .8 1.7L9.6 29.3c-.8.9-2.2.1-1.8-1l2.9-8.4H6.3c-.7 0-1.2-.7-1-1.3L7.6 4c.3-.9 1-1.5 1.9-1.5Z" fill="url(#${id})"/></svg>`
  );
}

/** "FlowCode AI", with the AI in the brand purple and italic as in the app. Semibold, not the app's 800: the PDF never goes above 600. */
export function wordmark(onDark: boolean): string {
  return `<span class="wordmark">FlowCode <em style="font-style:italic;color:${onDark ? ACCENT : ACCENT_ON_LIGHT}">AI</em></span>`;
}
