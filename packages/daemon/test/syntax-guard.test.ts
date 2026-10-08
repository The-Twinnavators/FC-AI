import { describe, expect, it } from "vitest";
import { syntaxErrors, syntaxGuard } from "../src/orchestrator/guards.js";

const good = `export default function App() {\n  return <div><PageHeader title="Lessons" action={<Button onClick={() => go("games")}>Start</Button>} /></div>;\n}\n`;
// The Kids cash app loop: an attribute value that isn't an expression and a tag left open.
const broken = `export default function App() {\n  return (\n    <div>\n      <PageHeader title="Lessons" action={<Button onClick={</Button>}>Start</Button>}>\n    </div>\n  );\n}\n`;

describe("syntax guard", () => {
  it("finds the line that doesn't parse", () => {
    expect(syntaxErrors("src/App.tsx", good)).toEqual([]);
    const errs = syntaxErrors("src/App.tsx", broken);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]!.line).toBe(4);
    expect(errs[0]!.source).toContain("onClick={</Button>}");
  });

  it("refuses an edit that breaks a file that parsed, and shows the broken line", () => {
    const msg = syntaxGuard("src/App.tsx", good, broken);
    expect(msg).toMatch(/^Not applied: this edit leaves src\/App.tsx unable to parse/);
    expect(msg).toContain("line 4:");
    expect(msg).toContain("onClick={</Button>}");
    expect(msg).toMatch(/In JSX/);
  });

  it("refuses an edit that keeps a broken file just as broken, but lets one that improves it through", () => {
    expect(syntaxGuard("src/App.tsx", broken, broken)).toMatch(/already had/);
    expect(syntaxGuard("src/App.tsx", broken, good)).toBeUndefined();
  });

  it("ignores files that aren't TypeScript or JavaScript, and new files that parse", () => {
    expect(syntaxGuard("src/styles/app.css", undefined, "a {")).toBeUndefined();
    expect(syntaxGuard("src/New.tsx", undefined, good)).toBeUndefined();
  });
});
