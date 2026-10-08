/**
 * The fonts FlowCode bundles for prototypes, registered with this page too, so the style picker and the Design tab
 * show the real typeface rather than a fallback. Each file loads only when something on the page uses its family.
 */
import { BUNDLED_FONTS } from "@flowcode/contracts";

export function registerBundledFonts(): void {
  if (typeof FontFace === "undefined") return;
  for (const f of BUNDLED_FONTS) {
    try {
      // Relative to the page, so it works from the dev server and from the desktop app's files alike.
      const url = new URL(`fonts/${f.file}.woff2`, document.baseURI).href;
      document.fonts.add(new FontFace(f.family, `url("${url}") format("woff2")`, { weight: "100 900", style: "normal", display: "swap" }));
    } catch {
      /* a font that can't be registered falls back to the next one in its stack */
    }
  }
}
