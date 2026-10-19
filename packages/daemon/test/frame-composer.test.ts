/**
 * FlowCode styles the library's AppFrame itself (frameComposer.ts): a token-only stylesheet of the frame's own rules,
 * imported by App.tsx, which counts as frame evidence. Frameproof: the frame part's model wrote prose and no tool call.
 */
import { describe, expect, it } from "vitest";
import { frameCss, frameKind, refreshedFrameCss, usesAppFrame, withFrameImport } from "../src/orchestrator/frameComposer.js";
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

describe("a composed frame brought up to date", () => {
  it("gains the composer's newer rules, keeps the step's own, and leaves a frame that isn't FlowCode's alone", () => {
    const old = frameCss("Frameproof").replace(".fl-af-env { color: var(--color-text); }\n", "").replace(".fl-af-top { background: var(--color-bg);", ".fl-af-top { background: var(--color-surface);");
    const next = refreshedFrameCss(old, "Frameproof")!;
    expect(next).toContain(".fl-af-env { color: var(--color-text); }");
    expect(next).toContain(".fl-af-top { background: var(--color-surface);");
    expect(refreshedFrameCss(next, "Frameproof")).toBeUndefined();
    expect(refreshedFrameCss(".fl-af-rail { color: red; }", "Frameproof")).toBeUndefined();
  });
});

describe("a sketch build's frame (the kit's AppShell)", () => {
  it("is recognised and styled through its ui-shell rules, which count as frame changes", () => {
    const app = `import { AppShell } from "./components/ui";\nexport default function App() { return <AppShell name="Calculator" screens={[]} current="calculator" onNavigate={() => {}}>{null}</AppShell>; }\n`;
    expect(frameKind(app)).toBe("appshell");
    const css = frameCss("Calculator", "appshell");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(frameCssChanges("", css)).toEqual(expect.arrayContaining([".ui-shell__header", '.ui-shell__link[aria-current="page"]']));
    expect(refreshedFrameCss(css, "Calculator")).toBeUndefined();
  });
});
