/** Every app's dark theme: written from its colours, switched only by data-theme, rewritten when the colours change. */
import { describe, expect, it } from "vitest";
import { darkThemeFollows, withDarkTheme } from "../src/workspace/darkTheme.js";

const light = (accent: string) => `:root {\n  --color-bg: #ffffff;\n  --color-text: #111111;\n  --color-accent: ${accent};\n}\n`;

describe("the app's dark theme", () => {
  it("is written once, from the light accent, under data-theme only", () => {
    const out = withDarkTheme(`${light("#2f6f5e")}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-bg: #000000;\n  }\n}\n`);
    expect(out).not.toMatch(/prefers-color-scheme/);
    expect(out.match(/:root\[data-theme="dark"\]/g)).toHaveLength(1);
    const block = out.slice(out.indexOf(':root[data-theme="dark"]'));
    for (const role of ["--color-bg", "--color-surface", "--color-text", "--color-accent", "--color-border"]) expect(block, role).toContain(`${role}:`);
    // The light theme is untouched.
    expect(out.startsWith(light("#2f6f5e"))).toBe(true);
  });

  it("follows a new accent instead of stacking another block", () => {
    const once = withDarkTheme(light("#2f6f5e"));
    const again = withDarkTheme(once.replace("--color-accent: #2f6f5e", "--color-accent: #b4235a"));
    expect(again.match(/:root\[data-theme="dark"\]/g)).toHaveLength(1);
    const darkAccent = (css: string) => /:root\[data-theme="dark"\][\s\S]*?--color-accent: ([^;]+);/.exec(css)?.[1];
    expect(darkAccent(again)).not.toBe(darkAccent(once));
  });

  it("is FlowCode's own until edited by hand, and only then is left alone", () => {
    const once = withDarkTheme(light("#2f6f5e"));
    expect(darkThemeFollows(once)).toBe(true);
    // The light accent changed without the dark theme: the calculator's purple Look kept a blue dark accent.
    expect(darkThemeFollows(once.replace("--color-accent: #2f6f5e", "--color-accent: #a82fd3"))).toBe(false);
    const edited = once.replace(/(:root\[data-theme="dark"\][\s\S]*?--color-bg: )[^;]+;/, "$1#000000;");
    expect(darkThemeFollows(edited)).toBe(false);
    expect(darkThemeFollows(light("#2f6f5e"))).toBe(false);
  });
});
