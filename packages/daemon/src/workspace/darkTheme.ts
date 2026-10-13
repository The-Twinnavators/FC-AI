/**
 * Every app's dark theme, written by FlowCode from the app's palette: the palette's dark roles (background, surfaces,
 * text, borders, accent...) go in one managed block under :root[data-theme="dark"]. The app switches to it only when
 * told to (the preview's light/dark toggle sets data-theme), never by the computer's own setting: an app shows its
 * CSSVibes style, light by default, wherever it is opened. Written at scaffold time and whenever a palette is saved
 * (picking a style or capturing one saves one); hand edits to the dark theme in the Design tab are left alone.
 */
import { buildPalette, paletteFromTokens, roleTokens, type Palette } from "@flowcode/contracts";

const START = '/* Dark theme: written by FlowCode from the style\'s palette. It applies with data-theme="dark" (the preview\'s light/dark toggle), never from the computer\'s setting. */';
const END = "/* End of dark theme */";
/** An OS-driven dark block (the starter's, or one an older build kept): replaced by the managed one. */
const MEDIA_DARK = /\n*@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n?/g;

/** The light theme's value of a token (its first :root block). */
function lightValue(css: string, name: string): string | undefined {
  const at = css.indexOf(":root");
  if (at < 0) return undefined;
  const block = css.slice(at, css.indexOf("}", at));
  return new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

/** tokens.css with its dark theme written (or rewritten) from a palette, or from its current light colours. */
export function withDarkTheme(css: string, palette?: Palette): string {
  if (!css.includes(":root")) return css;
  const accent = lightValue(css, "--color-accent");
  const usable = !!accent && /^#[0-9a-f]{3,8}$/i.test(accent);
  if (!palette && !usable) return css.replace(MEDIA_DARK, "\n");
  const dark = roleTokens(palette ?? buildPalette(paletteFromTokens({ "--color-accent": accent!, "--color-secondary": lightValue(css, "--color-secondary") ?? "" })), true);
  let out = css.replace(MEDIA_DARK, "\n");
  const a = out.indexOf(START);
  const b = out.indexOf(END);
  if (a >= 0 && b > a) out = out.slice(0, a).replace(/\s*$/, "\n") + out.slice(b + END.length).replace(/^\s*\n/, "");
  const block = `${START}\n:root[data-theme="dark"] {\n  color-scheme: dark;\n${Object.entries(dark).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n${END}\n`;
  return `${out.replace(/\s*$/, "\n")}\n${block}`;
}
