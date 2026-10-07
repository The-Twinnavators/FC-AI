/** Clean up the code: FlowCode lists what nothing uses, the step removes exactly that, and the check proves it. */
import { describe, expect, it } from "vitest";
import { cleanupBlocking, cleanupReport, isRootScratch, scanCleanup } from "../src/quality/cleanupScan.js";
import { cleanupTask, polishTask } from "../src/orchestrator/templates.js";
import { makeApp, makeProject } from "./helpers.js";

describe("clean-up scan", () => {
  it("finds unused files, root scratch files, debug calls and unused CSS, never the kit or the tests", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "package.json": "{}",
      "index.html": "<div id=root></div>",
      // First Calendar build: the coder saved test results in the project root while reading them.
      "vitest-results.json": "{}",
      "current-results-2.json": "{}",
      "src/main.tsx": `import App from "./App";\nimport "./styles/calendar.css";\nApp();`,
      "src/App.tsx": `import { fmt } from "./lib/fmt";\nexport default function App() {\n  console.log("rendered");\n  return <div className={\`cal-grid cal-grid--\${"week"}\`}>{fmt()}</div>;\n}`,
      "src/lib/fmt.ts": "export const fmt = () => 'x';",
      "src/lib/oldFormat.ts": "export const old = () => 'y';",
      // .cal-grid--week is built from parts (`cal-grid--${view}`), so it counts as used.
      "src/styles/calendar.css": ".cal-grid { display: grid; }\n.cal-grid--week { gap: 0; }\n.cal-legacy { color: red; }",
      "src/components/ui/index.tsx": "export const Button = () => null;",
      "src/acceptance/app.test.tsx": "it('x', () => {});",
    });
    const scan = scanCleanup(jail);
    expect(scan.unusedFiles).toEqual(["src/lib/oldFormat.ts"]);
    expect(scan.strayFiles.sort()).toEqual(["current-results-2.json", "vitest-results.json"]);
    expect(scan.debugCalls).toEqual([{ file: "src/App.tsx", line: 3, text: 'console.log("rendered");' }]);
    expect(scan.unusedClasses).toEqual([{ file: "src/styles/calendar.css", cls: "cal-legacy" }]);
    expect(cleanupBlocking(scan)).toBe(4);
    expect(cleanupReport(scan)).toMatch(/Files nothing imports[\s\S]*src\/lib\/oldFormat\.ts[\s\S]*vitest-results\.json[\s\S]*src\/App\.tsx:3/);
  });

  it("tells scratch output from the project's own root files", () => {
    for (const f of ["vitest-results.json", "core-results.json", "debug.log", "tmp-output.txt"]) expect(isRootScratch(f)).toBe(true);
    for (const f of ["package.json", "tsconfig.app.json", "README.md", "src/results.json", "vite.config.ts"]) expect(isRootScratch(f)).toBe(false);
  });

  it("runs after Design polish and is proved by the clean-up check, the tests and the type check", () => {
    const polish = polishTask(["lrc_5"]);
    const cleanup = cleanupTask([polish.key]);
    expect(cleanup.title).toBe("Clean up the code");
    expect(cleanup.dependsOn).toEqual(["polish"]);
    expect(cleanup.acceptanceCriteria.map((c) => (c.check.type === "verification" ? c.check.kind : c.check.type))).toEqual(["code_cleanup", "tests", "typecheck"]);
  });
});

describe("clean-up scan: pictures and credits", () => {
  it("finds pictures nothing uses and credits that are duplicated, stale or for unused pictures", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "package.json": "{}",
      "index.html": "<div id=root></div>",
      "src/main.tsx": `import App from "./App";\nApp();`,
      "src/App.tsx": `export default function App() { return <img src="/images/soup.jpg" alt="Soup" />; }`,
      "public/images/soup.jpg": "jpg",
      // No BIO & GMO: leftovers from repeated image searches, and a credit appended instead of replaced.
      "public/images/soup-2.jpg": "jpg",
      "public/favicon.svg": "<svg/>",
      "src/content/image-credits.json": JSON.stringify([
        { file: "/images/soup.jpg", title: "old photo" },
        { file: "/images/soup.jpg", title: "new photo" },
        { file: "/images/soup-2.jpg", title: "extra" },
        { file: "/images/gone.jpg", title: "deleted" },
      ]),
    });
    const scan = scanCleanup(jail);
    expect(scan.unusedImages).toEqual(["public/images/soup-2.jpg"]);
    expect(scan.badCredits.map((c) => c.file)).toEqual(["/images/soup.jpg", "/images/soup-2.jpg", "/images/gone.jpg"]);
    expect(scan.badCredits[0]!.why).toMatch(/listed 2 times/);
    expect(cleanupReport(scan)).toMatch(/Pictures nothing in the app uses/);
  });
});
