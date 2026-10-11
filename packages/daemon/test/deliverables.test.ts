/**
 * What a step must hand over. Both cases are from the Non-GMO brand finder build, where two steps were marked verified
 * without building anything: each planned src/screens/NonGMOBrandsScreen.tsx and wrote only a test, and the test
 * rendered its own markup rather than the app's, so it would have passed against an empty project.
 */
import { describe, expect, it } from "vitest";
import { hollowTests, missingDeliverables } from "../src/quality/deliverables.js";
import { makeApp, makeProject } from "./helpers.js";

// The test the coder actually wrote for "Functional requirements: Display list of non-GMO brands".
const HOLLOW = `import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Non GMO Brands Screen', () => {
  it('shows the list', async () => {
    render(<div><div>Brand A</div><div>Brand B</div></div>);
    await waitFor(() => expect(screen.getByText('Brand A')).toBeInTheDocument());
  });
});`;

const REAL = `import { render, screen } from '@testing-library/react';
import { NonGMOBrandsScreen } from '../screens/NonGMOBrandsScreen';

it('shows the list', () => {
  render(<NonGMOBrandsScreen />);
  expect(screen.getByText('Brand A')).toBeInTheDocument();
});`;

describe("files a step planned and never wrote", () => {
  it("reports the screen a step declared but skipped, and says what to do instead", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "package.json": "{}",
      "src/acceptance/functional-requirements.test.tsx": REAL,
    });
    const missing = missingDeliverables(jail, ["src/screens/NonGMOBrandsScreen.tsx", "src/acceptance/functional-requirements.test.tsx"]);
    expect(missing.map((m) => m.file)).toEqual(["src/screens/NonGMOBrandsScreen.tsx"]);
    expect(missing[0].message).toMatch(/never written/);
    expect(missing[0].message).toMatch(/report a blocker/);
  });

  it("says nothing when every planned file is there", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "package.json": "{}", "src/screens/Brands.tsx": "export default () => null;" });
    expect(missingDeliverables(jail, ["src/screens/Brands.tsx"])).toEqual([]);
  });

  it("leaves folders alone: a step planned as src/screens/ may fill it with anything", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "package.json": "{}" });
    expect(missingDeliverables(jail, ["src/screens/", "src/sim/", "src/styles/"])).toEqual([]);
  });
});

describe("tests that cannot fail for the right reason", () => {
  it("reports a test that imports nothing from the app", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "package.json": "{}", "src/acceptance/brands.test.tsx": HOLLOW });
    const hollow = hollowTests(jail, ["src/acceptance/brands.test.tsx"]);
    expect(hollow.map((h) => h.file)).toEqual(["src/acceptance/brands.test.tsx"]);
    expect(hollow[0].message).toMatch(/imports nothing from the app/);
  });

  it("accepts a test that renders the screen the step built", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "package.json": "{}", "src/acceptance/brands.test.tsx": REAL });
    expect(hollowTests(jail, ["src/acceptance/brands.test.tsx"])).toEqual([]);
  });

  it("does not count an import that is commented out", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "package.json": "{}",
      "src/acceptance/brands.test.tsx": `// import { Brands } from "../screens/Brands";\n${HOLLOW}`,
    });
    expect(hollowTests(jail, ["src/acceptance/brands.test.tsx"]).length).toBe(1);
  });

  it("accepts the other ways a test reaches the app", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, {
      "package.json": "{}",
      "src/acceptance/lazy.test.tsx": `import { it } from "vitest";\nit("x", async () => { await import("../screens/Brands"); });`,
      "src/acceptance/mocked.test.tsx": `import { vi } from "vitest";\nvi.mock("src/api/brands");\nit("x", () => {});`,
    });
    expect(hollowTests(jail, ["src/acceptance/lazy.test.tsx", "src/acceptance/mocked.test.tsx"])).toEqual([]);
  });

  it("only looks at test files", () => {
    const { app } = makeApp();
    const { jail } = makeProject(app, { "package.json": "{}", "src/screens/Brands.tsx": "export default () => null;" });
    expect(hollowTests(jail, ["src/screens/Brands.tsx"])).toEqual([]);
  });
});
