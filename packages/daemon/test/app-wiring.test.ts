import { describe, expect, it } from "vitest";
import { analyzeAppWiring } from "../src/quality/appWiring.js";
import { assembleTask } from "../src/orchestrator/templates.js";
import { makeApp, makeProject } from "./helpers.js";

const MAIN = 'import App from "./App";\ncreateRoot(root).render(<App />);\n';

describe("app wiring check", () => {
  it("fails when App.tsx is still the starter placeholder and pages are orphaned", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "src/main.tsx": MAIN,
      "src/App.tsx": "export default function App() { return <p>Start building here.</p>; }",
      "src/components/Calendar/Calendar.tsx": "export function Calendar() { return null; }",
      "src/pages/SignIn.tsx": "export function SignIn() { return null; }",
    });
    const w = analyzeAppWiring(jail);
    expect(w.status).toBe("failed");
    expect(w.placeholder).toBe("Start building here");
    expect(w.unreachablePages).toEqual(["src/pages/SignIn.tsx"]);
    expect(w.unreachableComponents).toEqual(["src/components/Calendar/Calendar.tsx"]);
  });

  it("passes when everything is reachable through imports (including index files and nested imports)", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "src/main.tsx": MAIN,
      "src/App.tsx": 'import { Calendar } from "./components/Calendar";\nimport { SignIn } from "./pages/SignIn";\nexport default function App() { return <><SignIn /><Calendar /></>; }',
      "src/components/Calendar/index.ts": 'export { Calendar } from "./Calendar";',
      "src/components/Calendar/Calendar.tsx": 'import { Day } from "./Day";\nexport function Calendar() { return <Day />; }',
      "src/components/Calendar/Day.tsx": "export function Day() { return null; }",
      "src/pages/SignIn.tsx": "export function SignIn() { return null; }",
      "src/components/Calendar/Day.test.tsx": "",
    });
    const w = analyzeAppWiring(jail);
    expect(w).toMatchObject({ status: "passed", unreachablePages: [], unreachableComponents: [] });
  });

  it("spec builds end with an assembly task verified by the wiring check", () => {
    const t = assembleTask(["m_a", "m_b"]);
    expect(t.dependsOn).toEqual(["m_a", "m_b"]);
    expect(t.acceptanceCriteria.map((c) => c.check)).toContainEqual({ type: "verification", kind: "app_wiring" });
  });
});
