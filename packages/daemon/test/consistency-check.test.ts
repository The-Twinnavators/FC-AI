/** Design-system consistency check: raw values, token scales and unstyled markup, counting only what a step added. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { consistencyProblems, consistencySnapshot } from "../src/quality/consistencyCheck.js";

const TOKENS = `:root {\n  --color-accent: #24423a;\n  --space-1: 0.25rem;\n  --space-2: 0.5rem;\n  --space-3: 0.75rem;\n  --radius-sm: 4px;\n  --radius-md: 6px;\n}\n`;

function app(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-consistency-"));
  for (const [rel, text] of Object.entries({ "src/styles/tokens.css": TOKENS, ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return {
    root,
    write: (rel: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    },
  };
}

describe("design consistency check", () => {
  it("reports colours a step adds to the tokens outside the Styles palette, not palette references", () => {
    const a = app({});
    const before = consistencySnapshot(a as never);
    a.write("src/styles/tokens.css", TOKENS.replace("}\n", "  --key-operator-bg: #d9eaff;\n  --key-equals-bg: var(--color-accent);\n  --key-clear-bg: #24423A;\n}\n"));
    const problems = consistencyProblems(a as never, ["src/styles/tokens.css"], before, "Style the calculator keys");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/#d9eaff/);
    expect(problems[0].message).toMatch(/Styles palette/);
    // A colour the request names is fine; old snapshots without a palette skip the check.
    expect(consistencyProblems(a as never, ["src/styles/tokens.css"], before, "Make operators #d9eaff")).toHaveLength(0);
    expect(consistencyProblems(a as never, ["src/styles/tokens.css"], { ...before, palette: undefined }, "x")).toHaveLength(0);
  });

  it("reports raw colours and sizes a step adds, not ones already there", () => {
    const a = app({ "src/styles/app.css": ".old { color: #ff0000; }\n" });
    const before = consistencySnapshot(a as never);
    a.write("src/styles/app.css", ".old { color: #ff0000; }\n.card { background: #fafafa; padding: 12px; border-radius: 9px; box-shadow: 0 1px 2px rgba(0,0,0,.1); }\n.pill { border-radius: 999px; margin: 0; gap: var(--space-2); }\n");
    const problems = consistencyProblems(a as never, ["src/styles/app.css"], before, "Add a card");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/#fafafa/);
    expect(problems[0].message).toMatch(/12px for padding/);
    expect(problems[0].message).toMatch(/9px for border-radius/);
    expect(problems[0].message).not.toMatch(/#ff0000|999px|rgba/);
  });

  it("reads inline styles in components but ignores hrefs and token values", () => {
    const a = app({});
    const before = consistencySnapshot(a as never);
    a.write("src/screens/Home.tsx", `import { Card } from "../components/ui";\nexport default function Home() { return <a href="#/home" style={{ color: "#123456", padding: 8, gap: "var(--space-2)" }}>Home</a>; }\n`);
    const [p] = consistencyProblems(a as never, ["src/screens/Home.tsx"], before, "Home screen");
    expect(p.message).toMatch(/#123456/);
    expect(p.message).toMatch(/8px for padding/);
    expect(p.message).not.toMatch(/#\/home|space-2/);
  });

  it("protects the token scales unless the request asks for new sizes", () => {
    const a = app({});
    const before = consistencySnapshot(a as never);
    a.write("src/styles/tokens.css", TOKENS.replace("--space-1: 0.25rem", "--space-1: 0.5rem"));
    const problems = consistencyProblems(a as never, ["src/styles/tokens.css"], before, "Rebuild the screens");
    expect(problems.map((p) => p.message).join("\n")).toMatch(/--space-1 \(0\.25rem → 0\.5rem\)/);
    expect(problems.map((p) => p.message).join("\n")).toMatch(/space scale is out of order: --space-2/);
    const asked = consistencyProblems(a as never, ["src/styles/tokens.css"], before, "Make the spacing roomier");
    expect(asked.some((p) => /didn't ask/.test(p.message))).toBe(false);
  });

  it("reports components that render plain, unstyled HTML", () => {
    const a = app({});
    const before = consistencySnapshot(a as never);
    a.write("src/GoalJar.tsx", "export default function GoalJar() { return <div><h2>Goal Jar</h2><div>Saved</div></div>; }\n");
    a.write("src/screens/Goals.tsx", `import { Card, Section } from "../components/ui";\nexport default function Goals() { return <Section title="Goals"><Card><p>Saved</p><p>Left</p><p>Due</p></Card></Section>; }\n`);
    const problems = consistencyProblems(a as never, ["src/GoalJar.tsx", "src/screens/Goals.tsx"], before, "Goals");
    expect(problems.map((p) => p.file)).toEqual(["src/GoalJar.tsx"]);
  });
});
