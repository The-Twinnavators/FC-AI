/**
 * The patterns that stopped the Kids cash app and the Calculator app, as reusable guards: a second copy of a screen,
 * content that names pictures the app doesn't have, and a planned step whose whole job is reading.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duplicateScreens, screenKey } from "../src/quality/appWiring.js";
import { contentProblems } from "../src/quality/contentCheck.js";
import { foldReadOnlySteps, syntaxGuard } from "../src/orchestrator/guards.js";
import { failureSignature, sameFailureTwice } from "../src/orchestrator/stepRecovery.js";
import { PathJail } from "../src/security/pathJail.js";

const project = (files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-stuck-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return new PathJail(root);
};

describe("a second copy of a screen", () => {
  it("names learn-coins.tsx and LearnCoinsScreen.tsx as one screen", () => {
    expect(screenKey("src/screens/learn-coins.tsx")).toBe(screenKey("src/screens/LearnCoinsScreen.tsx"));
    expect(screenKey("GamesScreen.tsx")).not.toBe(screenKey("LearnCoinsScreen.tsx"));
  });

  it("finds the copy nothing uses when its twin is the one the app uses", () => {
    const jail = project({
      "src/main.tsx": `import App from "./App";\nexport default App;\n`,
      "src/App.tsx": `import LearnCoinsScreen from "./screens/LearnCoinsScreen";\nexport default function App() { return <LearnCoinsScreen />; }\n`,
      "src/screens/LearnCoinsScreen.tsx": "export default function LearnCoinsScreen() { return null; }\n",
      "src/screens/learn-coins.tsx": "export default function LearnCoins() { return null; }\n",
      "src/screens/GamesScreen.tsx": "export default function GamesScreen() { return null; }\n",
    });
    expect(duplicateScreens(jail)).toEqual([{ file: "src/screens/learn-coins.tsx", twin: "src/screens/LearnCoinsScreen.tsx" }]);
  });
});

describe("content that names pictures the app doesn't have", () => {
  it("flags them, and passes pictures that exist, web addresses and inline art", () => {
    const jail = project({
      "src/content/coins.json": JSON.stringify([{ name: "Penny", image: "penny.jpg" }, { name: "Dime", image: "/images/dime.png" }, { name: "Web", image: "https://example.com/x.png" }]),
      "public/images/dime.png": "png",
    });
    const problems = contentProblems(jail, ["src/content/coins.json"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/names 1 picture\(s\) the app doesn't have \(e\.g\. "penny\.jpg"\)/);
  });
});

describe("a planned step whose whole job is reading", () => {
  it("is folded into the step that uses what it read", () => {
    const tasks = [
      { key: "a", title: "Read the HTML file to extract the glassmorphism styles", objective: "Read styles.html and note the blur and colours.", dependsOn: [], expectedPaths: ["styles.html"] },
      { key: "b", title: "Apply the extracted glassmorphism styles to the calculator", objective: "Apply them to the calculator.", dependsOn: ["a"], expectedPaths: ["src/styles/app.css"] },
      { key: "c", title: "Add keyboard support", objective: "Keys work.", dependsOn: ["b"], expectedPaths: ["src/App.tsx"] },
    ];
    const { tasks: out, folded } = foldReadOnlySteps(tasks);
    expect(folded).toEqual(["Read the HTML file to extract the glassmorphism styles"]);
    expect(out.map((t) => t.key)).toEqual(["b", "c"]);
    expect(out[0].objective).toMatch(/^First, read styles\.html and note the blur and colours\. Then:\nApply them/);
    expect(out[0].dependsOn).toEqual([]);
    expect(out[0].expectedPaths).toEqual(["src/styles/app.css", "styles.html"]);
  });

  it("leaves steps that read and then change something", () => {
    const tasks = [{ key: "a", title: "Review and fix the form validation", objective: "Fix it.", dependsOn: [], expectedPaths: ["src/Form.tsx"] }, { key: "b", title: "Add tests", objective: "Tests.", dependsOn: ["a"], expectedPaths: [] }];
    expect(foldReadOnlySteps(tasks).folded).toEqual([]);
  });
});

describe("a screen state no step planned", () => {
  it("becomes one repair step on the screen that shows data, checked by what the design check looks for", async () => {
    const { stateRepairTask } = await import("../src/orchestrator/stepRecovery.js");
    const screens = [
      { path: "src/screens/GamesScreen.tsx", text: "export default function GamesScreen() { return <PageHeader title=\"Games\" />; }" },
      { path: "src/screens/LearnCoinsScreen.tsx", text: "if (loading) return <Skeleton />; if (coins.length === 0) return <EmptyState />;" },
    ];
    const t = stateRepairTask(screens, ["error"], { id: "run_1" }, undefined, 9, () => "task_x")!;
    expect(t.title).toBe("Add the missing screen states");
    expect(t.expectedPaths).toEqual(["src/screens/LearnCoinsScreen.tsx"]);
    expect(t.objective).toMatch(/role="alert"/);
    expect(t.acceptanceCriteria[0].check).toEqual({ type: "file_contains", path: "src/screens/LearnCoinsScreen.tsx", text: 'role="alert"' });
    expect(stateRepairTask(screens, [], { id: "run_1" }, undefined, 9, () => "task_y")).toBeUndefined();
  });
});

describe("a brief bigger than the model's room to work", () => {
  it("leaves out knowledge, then stylesheets, names what it left out, and keeps the screen", async () => {
    const { fitHandoff, renderHandoff } = await import("../src/orchestrator/handoff.js");
    const css = (n: number) => `.a { color: red; }\n`.repeat(n);
    const packet = {
      runObjective: "Build NOBIO",
      task: { title: "Design the main screens", objective: "Design each main screen. ".repeat(160), expectedPaths: ["src/screens/", "src/styles/"], acceptanceCriteria: ["Typecheck passes"] },
      acceptedDecisions: [],
      constraints: ["Requirements for this step: " + "R1: show brands. ".repeat(200)],
      completedTasks: [],
      relevantFiles: [
        { path: "src/styles/components.css (line-numbered; line prefixes are not part of the file)", excerpt: css(400) },
        { path: "src/styles/tokens.css (line-numbered; line prefixes are not part of the file)", excerpt: css(300) },
        { path: "src/screens/BrandsListScreen.tsx (line-numbered; line prefixes are not part of the file)", excerpt: "export default function BrandsListScreen() { return null; }" },
      ],
      findings: [],
      openBlockers: [],
      knowledge: [1, 2, 3].map((i) => ({ title: `Playbook ${i}`, content: "x".repeat(1400), provenance: "" })),
    };
    const full = renderHandoff(packet, "src/\n".repeat(140), []);
    expect(full.length).toBeGreaterThan(25_000);
    const fitted = fitHandoff(packet, "src/\n".repeat(140), [], 12_000);
    expect(fitted.text.length).toBeLessThan(full.length / 2);
    expect(fitted.dropped.slice(0, 4)).toEqual(['knowledge "Playbook 3"', 'knowledge "Playbook 2"', "src/styles/components.css", "src/styles/tokens.css"]);
    expect(fitted.text).toContain("Not attached, to leave room to work (read one with read_file only if you need it): src/styles/components.css, src/styles/tokens.css");
    expect(fitted.text).toContain("export default function BrandsListScreen()");
    // A brief that fits is left as it is.
    expect(fitHandoff(packet, "src/", [], 100_000)).toEqual({ text: renderHandoff(packet, "src/", []), dropped: [] });
  });
});

describe("a prop a UI kit component doesn't take, reported over two lines", () => {
  it("gets a hint to wrap it, not to change the kit (NOBIO: <Card className> failed six type checks)", async () => {
    const { typeErrorHints } = await import("../src/quality/typeHints.js");
    const jail = project({
      "src/screens/BrandsListScreen.tsx": 'import { Card } from "../components/ui";\nexport default function B() {\n  return <Card className="brand">x</Card>;\n}\n',
    });
    const errors = [
      "src/screens/BrandsListScreen.tsx(3,10): error TS2322: Type '{ children: string; className: string; }' is not assignable to type 'IntrinsicAttributes & { title?: ReactNode; children: ReactNode; }'.",
      "  Property 'className' does not exist on type 'IntrinsicAttributes & { title?: ReactNode; children: ReactNode; }'.",
    ];
    const [hint] = typeErrorHints(jail, errors);
    expect(hint).toMatch(/<Card> is part of the app's UI kit/);
    expect(hint).toContain("put the className on a <div> around it (<div className=…><Card>…</Card></div>)");
  });
});

describe("a designed screen whose class names nothing styles", () => {
  it("is named with its classes, and fl- names are pointed back to the library (NOBIO)", async () => {
    const { unstyledClasses, unstyledMessage } = await import("../src/quality/unstyledClasses.js");
    const jail = project({
      "src/styles/app.css": ".brand-list { display: grid; } .brand-list .is-active { color: red; } /* .not-a-rule */ .hero { background: url(a.b.png); }",
      "src/screens/Brands.tsx": 'export default function B({ on }: { on: boolean }) {\n  return <div className="brand-list fl-screen"><h2 className="fl-card__title">x</h2><p className={on ? "is-active" : "fl-card__meta"}>y</p><span className={`fl-card-link ${on ? "a" : ""}`}>z</span></div>;\n}\n',
      "src/sections/ListStacked.tsx": 'export default function L() { return <div className="fl-unknown-in-library" />; }',
    });
    const found = unstyledClasses(jail, ["src/screens/Brands.tsx", "src/sections/ListStacked.tsx"]);
    expect(found).toEqual([{ file: "src/screens/Brands.tsx", classes: ["fl-screen", "fl-card__title", "fl-card__meta", "fl-card-link"] }]);
    expect(found[0]!.classes).not.toContain("brand-list");
    expect(found[0]!.classes).not.toContain("is-active");
    expect(unstyledMessage(found, 4)).toMatch(/copy the real piece from \.flowcode\/sections\//);
    expect(unstyledMessage([{ file: "x.tsx", classes: ["a", "b"] }], 4)).toBeUndefined();
  });
});

describe("the same failure attempt after attempt", () => {
  // The debugger runs on every attempt after the first and is the single biggest cost in a build (46.8% of model
  // calls). A retry that ends in the identical complaint spends that cost for nothing, so two in a row stops the step.
  it("reads two attempts that failed the same way as the same failure", () => {
    const first = failureSignature(["src/App.tsx renders <DashboardScreen> 5 times. Show each screen once."]);
    const again = failureSignature(["src/App.tsx renders <DashboardScreen> 7 times. Show each screen once."]);
    expect(again).toBe(first);
    expect(sameFailureTwice([first, again])).toBe(true);
  });

  it("does not stop a step that is failing a different way each time", () => {
    const a = failureSignature(["typecheck failed: Cannot find name 'Field'"]);
    const b = failureSignature(["3 of 12 acceptance tests fail"]);
    expect(sameFailureTwice([a, b])).toBe(false);
    expect(sameFailureTwice([a])).toBe(false);
    expect(sameFailureTwice([])).toBe(false);
  });

  it("ignores line numbers, paths and quoted snippets, which vary without the failure differing", () => {
    const one = failureSignature(['tokens.css line 161: unknown word "contrast"']);
    const two = failureSignature(['tokens.css line 204: unknown word "color-mix"']);
    expect(sameFailureTwice([one, two])).toBe(true);
  });

  it("treats the order of several failures as the same failure", () => {
    const a = failureSignature(["typecheck failed", "2 tests fail"]);
    const b = failureSignature(["9 tests fail", "typecheck failed"]);
    expect(sameFailureTwice([a, b])).toBe(true);
  });
});

describe("a stylesheet an edit leaves unparseable", () => {
  // tokens.css line 161 held a word PostCSS could not read. Every build failed from then on, so no acceptance test
  // could pass whatever the agent wrote; it spent four attempts on App.tsx, which was never the cause, then stopped
  // using its tools. syntaxGuard refused exactly this shape of breakage already, but only for .ts/.tsx files.
  const ok = ":root {\n  --color-accent: #15803d;\n}\n";

  it("refuses a declaration with no value, the shape that broke tokens.css", () => {
    const msg = syntaxGuard("src/styles/tokens.css", ok, ":root {\n  --color-accent: #15803d;\n  contrast;\n}\n");
    expect(msg, "expected a refusal").toBeTruthy();
    expect(msg).toContain("line 3");
  });

  it("refuses unbalanced braces", () => {
    expect(syntaxGuard("src/styles/app.css", ok, ".a { color: red;\n")).toBeTruthy();
  });

  it("leaves valid stylesheets alone, including nesting, at-rules and comments", () => {
    const fine = "@media (min-width: 40rem) {\n  .a { color: red; }\n}\n/* note */\n.b { &:hover { color: blue; } }\n@import url('x.css');\n";
    expect(syntaxGuard("src/styles/app.css", ok, fine)).toBeUndefined();
  });

  it("does not block an edit that reduces the damage it inherited", () => {
    const broken = ".a { color: red;\n.b { color: blue;\n";
    expect(syntaxGuard("src/styles/app.css", broken, ".a { color: red; }\n.b { color: blue;\n")).toBeUndefined();
  });
});