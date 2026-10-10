/**
 * The styles a library preview runs with: FlowCode's bundled fonts, the prototype starter's tokens and one visual
 * style's colors, fonts and corners. Shared by the section preview page and the Elements grid.
 */
import { BUNDLED_FONTS, DESIGN_TEMPLATES, fontFaceCss } from "@flowcode/contracts";
import tokensCss from "../../../templates/react-vite-starter/src/styles/tokens.css?raw";

/** One visual style as token overrides on :root ("" when the id is unknown). */
export function styleCss(styleId: string): string {
  const t = DESIGN_TEMPLATES.find((x) => x.id === styleId);
  if (!t) return "";
  const c = t.colors;
  return `:root{--color-bg:${c.bg};--color-surface:${c.surface};--color-surface-sunken:${c.surfaceSunken};--color-text:${c.text};--color-text-muted:${c.textMuted};--color-border:${c.border};--color-border-strong:${c.borderStrong};--color-accent:${c.accent};--color-accent-hover:${c.accentHover};--color-on-accent:${c.onAccent};--color-focus:${c.focus};--color-success:${c.success};--color-danger:${c.danger};--color-danger-surface:${c.dangerSurface};--font-sans:${t.fonts.sans};--font-display:${t.fonts.display};--radius-sm:${t.radii[0]}px;--radius-md:${t.radii[1]}px;--radius-lg:${t.radii[2]}px;--radius-xl:${t.radii[3]}px;color-scheme:${t.dark ? "dark" : "light"}}`;
}

/** Fonts, tokens and the chosen style, ready for a preview document's <style>. */
export function previewBaseCss(styleId: string): string {
  return [fontFaceCss(BUNDLED_FONTS, (file) => new URL(`fonts/${file}.woff2`, document.baseURI).href), tokensCss, styleCss(styleId)].join("\n\n");
}
