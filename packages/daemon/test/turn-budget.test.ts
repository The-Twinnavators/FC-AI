/** Steps that write an acceptance-test file get more turns (Clean Cart: 30 ran out four times on 24 Home tests). */
import { describe, expect, it } from "vitest";
import { turnBudget } from "../src/orchestrator/stepRecovery.js";

const crit = (check: Record<string, unknown>) => ({ id: "c", description: "", check, met: false }) as never;

describe("turnBudget", () => {
  it("gives a test-writing step 50 turns", () => {
    expect(turnBudget({ acceptanceCriteria: [crit({ type: "file_exists", path: "src/acceptance/home.test.tsx" })] })).toBe(50);
    expect(turnBudget({ acceptanceCriteria: [crit({ type: "verification", kind: "tests:src/acceptance/home.test.tsx" })] })).toBe(50);
  });
  it("keeps 30 for every other step", () => {
    expect(turnBudget({ acceptanceCriteria: [crit({ type: "file_exists", path: "src/screens/Home.tsx" }), crit({ type: "verification", kind: "typecheck" })] })).toBe(30);
  });
});
