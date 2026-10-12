/**
 * Design rule: no thick accent bar down the left of a card, alert, quote or row. The owner reads it as AI-generated
 * filler; a tone or a current item is shown by tint, an icon or weight instead. This scans the library's stylesheets
 * for a left border or inset left shadow of 3px or more.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS_DIR = path.resolve(__dirname, "../../../templates/library/css");
// A drawing, not a bar: the landing page's book cover has a spine.
const ALLOWED = [".fl-ld-cover"];
const THICK = /border-left(?:-width)?\s*:\s*(?:[3-9]|\d{2,})px|border-left\s*:\s*(?:0\.(?:[2-9])|[1-9])\d*(?:\.\d+)?rem|border-inline-start(?:-width)?\s*:\s*(?:[3-9]|\d{2,})px|box-shadow\s*:\s*inset\s+(?:[3-9]|\d{2,})px\s+0/;

describe("library styles have no thick left accent bars", () => {
  it("no rule draws a 3px-or-wider bar down the left", () => {
    const hits: string[] = [];
    for (const file of fs.readdirSync(CSS_DIR).filter((f) => f.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(CSS_DIR, file), "utf8");
      for (const rule of css.split("}")) {
        const [selector = "", body = ""] = rule.split("{");
        if (THICK.test(body) && !ALLOWED.some((a) => selector.includes(a))) hits.push(`${file}: ${selector.trim().split("\n").pop()}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
