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
import { foldReadOnlySteps } from "../src/orchestrator/guards.js";
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
