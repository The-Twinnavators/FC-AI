/**
 * FlowCode styles the library's AppFrame itself (frameComposer.ts): a token-only stylesheet of the frame's own rules,
 * imported by App.tsx, which counts as frame evidence. Frameproof: the frame part's model wrote prose and no tool call.
 */
import { describe, expect, it } from "vitest";
import { frameCss, usesAppFrame, withFrameImport } from "../src/orchestrator/frameComposer.js";
import { cssRules, frameCssChanges } from "../src/quality/frameCheck.js";

const APP = `import type { ComponentType } from "react";
import { AppFrame } from "./sections/AppFrame";
import { store } from "./app/store";

export default function App() {
  return <AppFrame product={"Frameproof"} store={store} />;
}
`;

describe("the composed frame", () => {
  it("styles AppFrame's own rules with tokens only, and those count as frame changes", () => {
    const css = frameCss("Frameproof");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    const changed = frameCssChanges("", css, (s) => /fl-af-/.test(s));
    expect(changed).toEqual(expect.arrayContaining([".fl-af-rail", ".fl-af-item--current, .fl-af-item--current:hover", ".fl-af-top"]));
    expect(cssRules(css).size).toBeGreaterThan(8);
  });

  it("is imported by App.tsx after its last import, once, and only for an app on AppFrame", () => {
    expect(usesAppFrame(APP)).toBe(true);
    expect(usesAppFrame("export default function App() { return <main />; }")).toBe(false);
    const next = withFrameImport(APP)!;
    expect(next).toContain('import { store } from "./app/store";\nimport "./styles/frame.css";\n');
    expect(withFrameImport(next)).toBeUndefined();
  });
});
