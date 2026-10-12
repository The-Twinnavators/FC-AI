/**
 * The styles a library preview runs with: FlowCode's bundled fonts, the prototype starter's tokens and one visual
 * style's colors, fonts and corners. Shared by the section preview page and the Elements grid.
 */
import { BUNDLED_FONTS, DESIGN_TEMPLATES, TEMPLATE_VIBES, fontFaceCss, templateTokens, vibeTokens } from "@flowcode/contracts";
import tokensCss from "../../../templates/react-vite-starter/src/styles/tokens.css?raw";

/**
 * One visual style as token overrides on :root ("" when the id is unknown), with its surface style: the one asked for,
 * or the style's own default, as a build gets it (outlines, shadows and corners of cards and controls).
 */
export function styleCss(styleId: string, surface?: string): string {
  const t = DESIGN_TEMPLATES.find((x) => x.id === styleId);
  if (!t) return "";
  const colors = Object.entries(templateTokens(t))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${colors};--font-sans:${t.fonts.sans};--font-display:${t.fonts.display};--radius-sm:${t.radii[0]}px;--radius-md:${t.radii[1]}px;--radius-lg:${t.radii[2]}px;--radius-xl:${t.radii[3]}px;color-scheme:${t.dark ? "dark" : "light"}}\n:root{${Object.entries(vibeTokens(surface || TEMPLATE_VIBES[styleId]))
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/** Fonts, tokens and the chosen style, ready for a preview document's <style>. */
export function previewBaseCss(styleId: string, surface?: string): string {
  return [fontFaceCss(BUNDLED_FONTS, (file) => new URL(`fonts/${file}.woff2`, document.baseURI).href), tokensCss, styleCss(styleId, surface)].join("\n\n");
}
