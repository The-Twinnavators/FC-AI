/**
 * FlowCode composes a basic calculator from its PRD (calculatorComposer.ts): the engine, the screen, its stylesheet and
 * acceptance tests. On a copy of the calculator build, the composed app type-checks, lints and passes all 9 tests.
 */
import { describe, expect, it } from "vitest";
import { COMPOSED_CALC, engineFile, isCalculatorPrd, screenFile, sheetFile, testsFile } from "../src/orchestrator/calculatorComposer.js";

describe("the composed calculator", () => {
  it("is used for a basic calculator's PRD only", () => {
    expect(isCalculatorPrd("A fast, minimal calculator. F1 Addition, subtraction, multiplication, division.")).toBe(true);
    expect(isCalculatorPrd("Frameproof: a client photo proofing gallery; choose five photos.")).toBe(false);
    expect(isCalculatorPrd("A tip calculator for splitting bills.")).toBe(false);
  });

  it("is marked as FlowCode's, styled in tokens only, and its tests use the keys by name", () => {
    expect(engineFile()).toContain(COMPOSED_CALC);
    expect(screenFile("Calculator")).toContain(COMPOSED_CALC);
    expect(sheetFile()).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    const tests = testsFile("Core Calculator Operations");
    expect(tests).toContain('press("2", "Add", "3", "Multiply", "4", "Equals")');
    expect(tests).toContain("Can't divide by zero");
  });
});
