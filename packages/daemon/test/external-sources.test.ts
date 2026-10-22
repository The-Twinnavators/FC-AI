/**
 * External component sources: the checked defaults, a link the owner adds (unchecked until they decide), and what an
 * agent is told (only allowed sources to adapt from, look-only ones as references, never a not-allowed one).
 */
import { describe, expect, it } from "vitest";
import { addExternalSource, externalSources, externalSourcesNote, removeExternalSource, updateExternalSource } from "../src/knowledge/externalSources.js";
import { makeApp } from "./helpers.js";

describe("external component sources", () => {
  it("start from the checked sources, with 21st.dev not allowed", () => {
    const { app } = makeApp();
    const list = externalSources(app.store);
    expect(list.find((s) => s.id === "hyperui")?.license).toBe("allowed");
    expect(list.find((s) => s.id === "21st-dev")?.license).toBe("not-allowed");
  });

  it("add a link as unchecked, refuse a bad or repeated one, and let the owner set its license or remove it", () => {
    const { app } = makeApp();
    const list = addExternalSource(app.store, { name: "Example UI", url: "https://ui.example.com/components" });
    const added = list[0]!;
    expect(added).toMatchObject({ name: "Example UI", license: "check", addedBy: "you" });
    expect(() => addExternalSource(app.store, { name: "", url: "not a link" })).toThrow(/https/);
    expect(() => addExternalSource(app.store, { name: "Again", url: "https://ui.example.com/components/" })).toThrow(/already/);
    expect(updateExternalSource(app.store, added.id, { license: "allowed", terms: "MIT" }).find((s) => s.id === added.id)).toMatchObject({ license: "allowed", terms: "MIT" });
    expect(removeExternalSource(app.store, added.id).some((s) => s.id === added.id)).toBe(false);
  });

  it("tell agents only the allowed sources to adapt from and the look-only ones, never a not-allowed one", () => {
    const { app } = makeApp();
    const note = externalSourcesNote(app.store);
    expect(note).toContain("HyperUI");
    expect(note).toContain("never copy code or markup");
    expect(note).toContain("For the look only");
    expect(note).not.toContain("21st.dev");
    expect(note).not.toContain("GetLayers");
  });
});
