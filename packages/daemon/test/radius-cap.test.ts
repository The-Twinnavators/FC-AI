/**
 * Design rule from the owner: cards and text boxes curve at most 12px. Pills (buttons, chips, badges, toggles) are
 * their own shape and stay round. Checked where corners come from: every visual style's radius scale, the surface
 * styles' card, small-surface and text-box corners, the starters' tokens, and the library's own caps and fallbacks.
 */
import fs from "node:fs";
import path from "node:path";
import { DESIGN_TEMPLATES, STYLE_VIBES } from "@flowcode/contracts";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const CAP = 12;
// Drawings, not cards: the phone mockup's body and screen.
const DRAWINGS = [".fl-hp-phone"];

describe("cards and text boxes curve at most 12px", () => {
  it("every visual style's radius scale stays at 12px or less", () => {
    const over = DESIGN_TEMPLATES.filter((t) => t.radii.some((r) => r > CAP)).map((t) => `${t.id}: ${t.radii.join(", ")}`);
    expect(over).toEqual([]);
  });

  it("every surface style keeps card, small-surface and text-box corners at 12px or less", () => {
    const over: string[] = [];
    for (const v of STYLE_VIBES) {
      for (const k of ["--surface-radius", "--surface-radius-sm", "--field-radius"]) {
        const px = /^(\d+(?:\.\d+)?)px$/.exec(v.tokens[k] ?? "")?.[1];
        if (px && Number(px) > CAP) over.push(`${v.id} ${k}: ${v.tokens[k]}`);
      }
    }
    expect(over).toEqual([]);
  });

  it("the starters cap text boxes at 12px", () => {
    for (const p of ["templates/react-vite-starter/src/styles/tokens.css", "templates/angular-starter/src/styles/tokens.css"]) {
      expect(fs.readFileSync(path.join(ROOT, p), "utf8"), p).toContain("--field-radius: min(var(--control-radius), 12px)");
    }
  });

  it("the library's corners never pass 12px (pills aside)", () => {
    const dir = path.join(ROOT, "templates/library/css");
    const over: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(dir, file), "utf8");
      for (const rule of css.split("}")) {
        const [selector = "", body = ""] = rule.split("{");
        if (DRAWINGS.some((d) => selector.includes(d))) continue;
        for (const m of body.matchAll(/border-radius\s*:([^;]*)/g)) {
          const values = [...m[1]!.matchAll(/(\d+(?:\.\d+)?)(px|rem)\b/g)].map((x) => Number(x[1]) * (x[2] === "rem" ? 16 : 1)).filter((n) => n !== 999);
          if (values.some((n) => n > CAP)) over.push(`${file}: ${selector.trim().split("\n").pop()} -> ${m[1]!.trim()}`);
        }
      }
    }
    expect(over).toEqual([]);
  });
});
