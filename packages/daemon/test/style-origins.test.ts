/** Style capture says which source each value came from (D9). */
import { describe, expect, it } from "vitest";
import { mergeStyles } from "../src/workspace/styleCapture.js";

describe("style origins", () => {
  it("credits each colour, font and corner to the source that supplied it", () => {
    const s = mergeStyles([
      { source: "mockup.png", colors: [{ hex: "#e4572e", weight: 10 }], fonts: {}, radiusPx: 12 },
      { source: "site.css", colors: [{ hex: "#1f6feb", weight: 3 }], background: "#ffffff", fonts: { display: "Fraunces", body: "Inter Tight" } },
    ]);
    const by = Object.fromEntries((s.origins ?? []).map((o) => [o.what, o]));
    expect(by["Main brand colour"]).toMatchObject({ value: "#e4572e", from: "mockup.png" });
    expect(by["Brand colour 2"]).toMatchObject({ value: "#1f6feb", from: "site.css" });
    expect(by["Corners"]).toMatchObject({ value: "12px", from: "mockup.png" });
    expect(by["Heading font"]).toMatchObject({ value: "Fraunces", from: "site.css" });
    expect(by["Background"]).toMatchObject({ value: "#ffffff", from: "site.css" });
  });
});
