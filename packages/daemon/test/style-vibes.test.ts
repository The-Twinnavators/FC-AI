/** Surface styles (vibes): chosen in New build or named in the PRD, written into the starter's surface tokens. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STYLE_VIBES, SURFACE_DEFAULTS, TEMPLATE_VIBES, DESIGN_TEMPLATES, vibeFromText, vibeTokens } from "@flowcode/contracts";
import { applyVibe, personalizeStarterFile, starterIdentity, withVibe } from "../src/orchestrator/starterIdentity.js";
import { templatesRoot } from "../src/orchestrator/templates.js";

const tokens = () => fs.readFileSync(path.join(templatesRoot(), "react-vite-starter/src/styles/tokens.css"), "utf8");

describe("surface styles", () => {
  it("only sets surface tokens the starter defines, built from its colour tokens", () => {
    const css = tokens();
    for (const name of Object.keys(SURFACE_DEFAULTS)) expect(css).toContain(`${name}:`);
    for (const v of STYLE_VIBES) {
      for (const [name, value] of Object.entries(v.tokens)) {
        expect(Object.keys(SURFACE_DEFAULTS)).toContain(name);
        // Colours come from the theme (plus white highlights), so a vibe fits any palette.
        expect(value.replace(/#ffffff/g, "")).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      }
    }
    for (const id of Object.values(TEMPLATE_VIBES)) expect(STYLE_VIBES.some((v) => v.id === id)).toBe(true);
    for (const id of Object.keys(TEMPLATE_VIBES)) expect(DESIGN_TEMPLATES.some((t) => t.id === id)).toBe(true);
  });

  it("recognises a vibe named in a PRD", () => {
    expect(vibeFromText("Cards use glassmorphism over a gradient")?.id).toBe("glass");
    expect(vibeFromText("A neo-brutalist look with chunky outlines")?.id).toBe("neobrutalism");
    expect(vibeFromText("Raw brutalism, no decoration")?.id).toBe("brutalism");
    expect(vibeFromText("Soft UI with neumorphic buttons")?.id).toBe("neumorphism");
    expect(vibeFromText("A simple to-do list")).toBeUndefined();
  });

  it("writes the vibe into tokens.css, chosen over the PRD over the template's suggestion", () => {
    const id = starterIdentity([], "Planner", "Build a planner");
    expect(withVibe(id, { extras: [], vibe: "bauhaus", template: "midnight" }, "glassmorphism").vibe?.id).toBe("bauhaus");
    expect(withVibe(id, { extras: [], template: "midnight" }, "glassmorphism").vibe?.id).toBe("glass");
    expect(withVibe(id, { extras: [], template: "playful-pastel" }, "").vibe?.id).toBe("claymorphism");
    expect(withVibe(id, { extras: [] }, "").vibe).toBeUndefined();

    const css = personalizeStarterFile("src/styles/tokens.css", tokens(), withVibe(id, { extras: [], vibe: "neobrutalism" }, ""));
    expect(css).toMatch(/--surface-border: 3px solid var\(--color-text\);/);
    expect(css).toMatch(/--control-shadow: 4px 4px 0 var\(--color-text\);/);
    expect(css).toMatch(/Surface style: Neo-brutalist/);
    // Flat values stay the defaults.
    const flat = applyVibe(tokens(), STYLE_VIBES[0]);
    expect(flat).toContain(`--surface-border: ${vibeTokens("flat")["--surface-border"]};`);
  });
});
