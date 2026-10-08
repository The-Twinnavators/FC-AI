import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_TEMPLATES, bundledFontsIn } from "@flowcode/contracts";
import { syncLocalFonts } from "../src/workspace/localFonts.js";

const app = (tokens: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-fonts-"));
  fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/styles/tokens.css"), tokens);
  return root;
};

describe("local fonts", () => {
  it("copies the fonts the tokens name, declares them, and imports them first", () => {
    const root = app(`:root {\n  --font-sans: Inter, system-ui, sans-serif;\n  --font-display: "Source Serif 4", Georgia, serif;\n}\n`);
    syncLocalFonts(root);
    expect(fs.existsSync(path.join(root, "public/fonts/inter.woff2"))).toBe(true);
    expect(fs.existsSync(path.join(root, "public/fonts/source-serif-4.LICENSE.txt"))).toBe(true);
    const faces = fs.readFileSync(path.join(root, "src/styles/fonts.css"), "utf8");
    expect(faces).toMatch(/font-family: "Inter";[\s\S]*url\("\/fonts\/inter\.woff2"\)/);
    expect(fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8").startsWith(`@import "./fonts.css";`)).toBe(true);
    expect(syncLocalFonts(root)).toEqual([]); // a second run changes nothing
  });

  it("takes bundled fonts off the Google Fonts line and keeps the others", () => {
    const root = app(`@import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Lobster:wght@400&display=swap"); /* FlowCode fonts */\n:root {\n  --font-sans: "Work Sans", sans-serif;\n  --font-display: Fraunces, serif;\n}\n`);
    syncLocalFonts(root);
    const css = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
    const [first, second] = css.split("\n");
    expect(first).toBe(`@import "./fonts.css"; /* FlowCode local fonts */`);
    expect(second).toContain("family=Lobster");
    expect(second).not.toContain("Fraunces");
    expect(fs.existsSync(path.join(root, "public/fonts/fraunces.woff2"))).toBe(true);
  });

  it("gives every visual style a bundled font for its text and its headings", () => {
    for (const t of DESIGN_TEMPLATES) {
      expect(bundledFontsIn(`--font-sans: ${t.fonts.sans};`).length, `${t.id} body`).toBeGreaterThan(0);
      expect(bundledFontsIn(`--font-display: ${t.fonts.display};`).length, `${t.id} headings`).toBeGreaterThan(0);
    }
  });
});
