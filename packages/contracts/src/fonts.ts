/**
 * Fonts FlowCode ships with (SIL Open Font License, from Fontsource; files in templates/fonts and the UI's public/fonts,
 * each with its licence). A build copies the ones its tokens name into the app and declares them locally, so the
 * prototype shows the intended typeface offline, in screenshots, and without asking Google for anything. FlowCode's
 * own previews (style picker, Design tab) load the same files, so what you see there is what the app shows.
 */
export interface BundledFont {
  /** The family name used in font stacks and @font-face. */
  family: string;
  /** File stem in templates/fonts (`<file>.woff2`, `<file>.LICENSE.txt`). */
  file: string;
  kind: "sans" | "serif" | "display" | "mono";
}

export const BUNDLED_FONTS: BundledFont[] = [
  { family: "Inter", file: "inter", kind: "sans" },
  { family: "Source Sans 3", file: "source-sans-3", kind: "sans" },
  { family: "Montserrat", file: "montserrat", kind: "sans" },
  { family: "Quicksand", file: "quicksand", kind: "sans" },
  { family: "DM Sans", file: "dm-sans", kind: "sans" },
  { family: "Work Sans", file: "work-sans", kind: "sans" },
  { family: "Source Serif 4", file: "source-serif-4", kind: "serif" },
  { family: "Literata", file: "literata", kind: "serif" },
  { family: "Fraunces", file: "fraunces", kind: "serif" },
  { family: "Playfair Display", file: "playfair-display", kind: "display" },
  { family: "Oswald", file: "oswald", kind: "display" },
  { family: "JetBrains Mono", file: "jetbrains-mono", kind: "mono" },
];

const norm = (s: string) => s.trim().replace(/^["']|["']$/g, "").toLowerCase();

/** The bundled fonts a CSS font stack (or any CSS text with font stacks) names, each once. */
export function bundledFontsIn(css: string): BundledFont[] {
  const names = new Set<string>();
  for (const m of css.matchAll(/(?:font-family\s*:|--font[\w-]*\s*:)\s*([^;{}]+)/gi)) for (const part of m[1]!.split(",")) names.add(norm(part));
  return BUNDLED_FONTS.filter((f) => names.has(f.family.toLowerCase()));
}

/** @font-face rules for these fonts, with `urlFor(file)` giving each file's address. */
export function fontFaceCss(fonts: BundledFont[], urlFor: (file: string) => string): string {
  return fonts
    .map((f) => `@font-face {\n  font-family: "${f.family}";\n  src: url("${urlFor(f.file)}") format("woff2");\n  font-weight: 100 900;\n  font-style: normal;\n  font-display: swap;\n}`)
    .join("\n\n");
}
