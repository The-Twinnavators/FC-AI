import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { kitFacts, tsTask, unredactLines, withoutBadChecks } from "../src/orchestrator/guards.js";

describe("withoutBadChecks", () => {
  it("drops a planned 'contains tabIndex' check (it can only pass by making the app less accessible)", () => {
    const out = withoutBadChecks([
      { description: "Keys are focusable", check: { type: "file_contains", path: "src/screens/CalculatorScreen.tsx", text: "tabIndex" } },
      { description: "Has the keypad", check: { type: "file_contains", path: "src/screens/CalculatorScreen.tsx", text: "keypad" } },
    ]);
    expect(out[0].check).toMatchObject({ type: "manual" });
    expect(out[1].check).toMatchObject({ type: "file_contains", text: "keypad" });
  });
});
import { PathJail } from "../src/security/pathJail.js";

describe("kitFacts", () => {
  it("says the kit already draws the focus ring only when the app's CSS really does (Calculator test 1)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-kit-"));
    fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
    const jail = new PathJail(root);
    expect(kitFacts(jail, "Implement visible focus ring for keyboard navigation")).toEqual([]);
    fs.writeFileSync(path.join(root, "src/styles/app.css"), ":focus-visible {\n  outline: 2px solid var(--color-focus);\n}\n");
    const facts = kitFacts(jail, "Implement visible focus ring for keyboard navigation");
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatch(/already draws a visible focus ring/);
    expect(kitFacts(jail, "Implement the calculator engine")).toEqual([]);
    // The split parts of that step are recognised too.
    for (const t of ["Add CSS styles for the focus ring using the ':focus' pseudo-class", "Ensure all interactive elements (keys) are keyboard-focusable", "Test keyboard navigation to confirm the focus ring is visible and follows the tab order"]) expect(kitFacts(jail, t)).toHaveLength(1);
    // Text scaling: true while sizes are rem tokens, withdrawn once a screen sets a px font size.
    fs.writeFileSync(path.join(root, "src/styles/tokens.css"), ":root { --text-md: 1rem; --type-h1-size: 1.5rem; }");
    expect(kitFacts(jail, "Ensure text scaling to 200% without functional loss")).toHaveLength(1);
    fs.mkdirSync(path.join(root, "src/screens"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/screens/CalculatorScreen.tsx"), `export const C = () => <output style={{ fontSize: 48 }}>0</output>;`);
    expect(kitFacts(jail, "Ensure text scaling to 200% without functional loss")).toEqual([]);
  });
});

describe("unredactLines", () => {
  const file = "export const AuthScreen: React.FC = () => {\n  const handlePasswordReset = async () => {\n    await authApi.resetPassword({ email });\n";
  it("puts back the file's real line for text copied from redacted notes (Calendar test 8)", () => {
    expect(unredactLines("  const handlePasswordReset = [REDACTED] () => {\n    if (!email) return;", file)).toBe("  const handlePasswordReset = async () => {\n    if (!email) return;");
    expect(unredactLines("export const AuthScreen: [REDACTED] = () => {", file)).toBe("export const AuthScreen: React.FC = () => {");
  });
  it("leaves lines alone when no single file line matches", () => {
    expect(unredactLines("const token = [REDACTED];", file)).toBe("const token = [REDACTED];");
    expect(unredactLines("no redaction here", file)).toBe("no redaction here");
  });
});

describe("tsTask", () => {
  it("moves a later step's .js plan onto .tsx/.ts (Calendar test 8 sign-in step)", () => {
    const t = tsTask({
      title: "Implement Sign-Up in AuthScreen.js",
      objective: "Create src/screens/AuthScreen.js and src/api/authApi.js.",
      expectedPaths: ["src/screens/AuthScreen.js", "src/api/authApi.js", "src/screens/"],
      acceptanceCriteria: [
        { description: "src/api/authApi.js exports signUp", check: { type: "file_contains", path: "src/api/authApi.js", text: "signUp" } },
        { description: "Typecheck passes", check: { type: "verification", kind: "typecheck" } },
      ],
    });
    expect(t.expectedPaths).toEqual(["src/screens/AuthScreen.tsx", "src/api/authApi.ts", "src/screens/"]);
    expect(t.title).toBe("Implement Sign-Up in AuthScreen.tsx");
    expect(t.objective).toBe("Create src/screens/AuthScreen.tsx and src/api/authApi.ts.");
    expect(t.acceptanceCriteria[0]).toEqual({ description: "src/api/authApi.ts exports signUp", check: { type: "file_contains", path: "src/api/authApi.ts", text: "signUp" } });
    expect(t.acceptanceCriteria[1].check).toEqual({ type: "verification", kind: "typecheck" });
  });

  it("points planned style scripts at the stylesheets (Calculator test 1 globalStyles.js, darkTheme.js)", () => {
    const t = tsTask({
      title: "Ensure text scaling",
      objective: "Update src/styles/globalStyles.js and src/themes/darkTheme.js.",
      expectedPaths: ["src/screens/CalculatorScreen.js", "src/styles/globalStyles.ts", "src/themes/lightTheme.js", "src/themes/darkTheme.js"],
      acceptanceCriteria: [],
    });
    expect(t.expectedPaths).toEqual(["src/screens/CalculatorScreen.tsx", "src/styles/app.css", "src/styles/tokens.css"]);
    expect(t.objective).toBe("Update src/styles/app.css and src/styles/tokens.css.");
  });
});
