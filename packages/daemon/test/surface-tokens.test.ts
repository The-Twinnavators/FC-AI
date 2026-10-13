/**
 * Surfaces reach every section: a card, panel, tile or bar in the library paints itself from the surface tokens
 * (--surface-bg, --surface-border, --surface-shadow, --surface-blur, --surface-radius), so choosing Glass, Liquid glass,
 * Clay or any other surface reshapes it. Before the surface pass, 28 of 39 stylesheets painted their cards straight
 * from --color-surface and the surface menu changed almost nothing. Controls (fields, buttons, chips, tabs) have their
 * own tokens, and overlays (dialogs, drawers, menus, popovers, tips, toasts) stay solid: no glass modals.
 * Also: the page wrappers paint the surface's backdrop, so a glass surface has something to show through.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS_DIR = path.resolve(__dirname, "../../../templates/library/css");
const SURFACE_BG = /(?:^|[;{\s])background(?:-color)?\s*:\s*var\(--color-surface\)\s*(?:;|$)/;
const BOX = /border-radius\s*:/;
const EDGE = /(?:^|[;\s])border\s*:|box-shadow\s*:/;
const NOT_A_SURFACE =
  /(input|select|textarea|field|search|chip|tag|badge|pill|btn|button|toggle|switch|seg|tab|radio|check|slider|thumb|knob|range|option|kbd|code|avatar|dot|swatch|handle|track|cursor|caret|step|page|label|link|icon|mark|key|kicker|flag|heart|qty|count|otp|sign|copy|opt|size|joined|action|arrow|open|play|close|more|amount|choice|role|thead|dialog|drawer|sheet|modal|lightbox|pop|menu|tip|toast|results|cookie|fl-af-panel|::before|::after|:hover|:focus|:active| span| a\b| li\b| p\b| th\b)/i;

function rules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const walk = (from: number, to: number) => {
    let i = from;
    while (i < to) {
      const open = css.indexOf("{", i);
      if (open < 0 || open >= to) return;
      const selector = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, "").trim();
      let depth = 1;
      let j = open + 1;
      while (j < to && depth) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      if (selector.startsWith("@")) {
        if (/^@(media|supports|container|layer)/.test(selector)) walk(open + 1, j - 1);
      } else out.push({ selector, body: css.slice(open + 1, j - 1) });
      i = j;
    }
  };
  walk(0, css.length);
  return out;
}

describe("the surface tokens reach every section", () => {
  it("no card, panel or tile paints itself straight from --color-surface", () => {
    const hits: string[] = [];
    for (const file of fs.readdirSync(CSS_DIR).filter((f) => f.endsWith(".css") && f !== "dialogs.css")) {
      for (const r of rules(fs.readFileSync(path.join(CSS_DIR, file), "utf8"))) {
        if (!SURFACE_BG.test(r.body) || !BOX.test(r.body) || !EDGE.test(r.body)) continue;
        if (r.selector.split(",").some((s) => NOT_A_SURFACE.test(s))) continue;
        hits.push(`${file}: ${r.selector} (use background: var(--surface-bg, var(--color-surface)) with --surface-border, --surface-shadow and --surface-blur)`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the page wrappers paint the surface's backdrop under the page color", () => {
    const page = /\.(fl-hp-page|fl-ld-page|fl-dd-page|fl-st2-page|fl-st) \{[^}]*\}/g;
    const found: string[] = [];
    for (const file of ["homepages.css", "landings.css", "docsdev.css", "sites-2.css", "sites.css"]) {
      for (const m of fs.readFileSync(path.join(CSS_DIR, file), "utf8").matchAll(page)) {
        if (!/background\s*:/.test(m[0])) continue;
        found.push(m[1]!);
        expect(m[0], m[1]).toContain("var(--page-backdrop, none)");
      }
    }
    expect(found.sort()).toEqual(["fl-dd-page", "fl-hp-page", "fl-ld-page", "fl-st", "fl-st2-page"]);
  });
});
