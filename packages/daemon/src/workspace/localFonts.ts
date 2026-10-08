/**
 * Local fonts for a prototype: the bundled fonts its tokens.css names are copied into public/fonts and declared in
 * src/styles/fonts.css, which tokens.css imports. Fonts that aren't bundled (a captured site's own typeface) keep
 * their Google Fonts line; bundled ones are taken off it, so the app doesn't depend on the internet for them.
 */
import fs from "node:fs";
import path from "node:path";
import { bundledFontsIn, fontFaceCss } from "@flowcode/contracts";
import { templatesRoot } from "../orchestrator/templates.js";

const TOKENS = "src/styles/tokens.css";
const FONTS_CSS = "src/styles/fonts.css";
const IMPORT_LINE = `@import "./fonts.css"; /* FlowCode local fonts */`;
const GOOGLE = /^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?([^"]*)"\);\s*\/\* FlowCode fonts \*\/\r?\n?/m;

/** Brings an app's local fonts in line with its tokens. Returns the files it wrote (empty when nothing changed). */
export function syncLocalFonts(root: string): string[] {
  const tokensAbs = path.join(root, TOKENS);
  if (!fs.existsSync(tokensAbs)) return [];
  let css = fs.readFileSync(tokensAbs, "utf8");
  const google = GOOGLE.exec(css);
  // Fonts named in the tokens, plus any the Google line asks for (a captured style's fonts).
  const googleNames = google ? [...google[1]!.matchAll(/family=([^:&]+)/g)].map((m) => decodeURIComponent(m[1]!.replace(/\+/g, " "))) : [];
  const fonts = bundledFontsIn(`${css}\n--font-g: ${googleNames.join(", ")};`);
  const written: string[] = [];
  if (!fonts.length) return written;

  // The files, from FlowCode's bundled set.
  const src = path.join(templatesRoot(), "fonts");
  fs.mkdirSync(path.join(root, "public", "fonts"), { recursive: true });
  for (const f of fonts) {
    for (const ext of [".woff2", ".LICENSE.txt"]) {
      const from = path.join(src, `${f.file}${ext}`);
      const to = path.join(root, "public", "fonts", `${f.file}${ext}`);
      if (fs.existsSync(from) && !fs.existsSync(to)) {
        fs.copyFileSync(from, to);
        written.push(`public/fonts/${f.file}${ext}`);
      }
    }
  }
  const face = `/* Fonts bundled with FlowCode (SIL Open Font License; licences in public/fonts). Generated from tokens.css. */\n\n${fontFaceCss(fonts, (file) => `/fonts/${file}.woff2`)}\n`;
  const facesAbs = path.join(root, FONTS_CSS);
  if (!fs.existsSync(facesAbs) || fs.readFileSync(facesAbs, "utf8") !== face) {
    fs.writeFileSync(facesAbs, face);
    written.push(FONTS_CSS);
  }

  // tokens.css: import fonts.css first; keep the Google line only for fonts that aren't bundled.
  let next = css;
  if (google) {
    const bundled = new Set(fonts.map((f) => f.family.toLowerCase()));
    const keep = google[1]!.split("&").filter((part) => !part.startsWith("family=") || !bundled.has(decodeURIComponent(part.slice(7).split(":")[0]!.replace(/\+/g, " ")).toLowerCase()));
    const families = keep.filter((p) => p.startsWith("family="));
    next = next.replace(GOOGLE, families.length ? `@import url("https://fonts.googleapis.com/css2?${keep.join("&")}"); /* FlowCode fonts */\n` : "");
  }
  if (!next.includes(IMPORT_LINE)) next = `${IMPORT_LINE}\n${next}`;
  // @import rules must come before everything else: local fonts line, then any Google line.
  const g = GOOGLE.exec(next);
  if (g) next = `${IMPORT_LINE}\n${g[0].trimEnd()}\n${next.replace(IMPORT_LINE + "\n", "").replace(GOOGLE, "")}`;
  if (next !== css) {
    fs.writeFileSync(tokensAbs, next);
    written.push(TOKENS);
  }
  return written;
}
