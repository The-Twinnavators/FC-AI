/** A split step leaves out parts a finished step already did (Clean Cart: "Add How it works to Home" twice). */
import { describe, expect, it } from "vitest";
import { dropDoneParts } from "../src/orchestrator/stepRecovery.js";

const part = (title: string, tests: string[] = []) => ({ title, objective: `${title}, in src/screens/HomeScreen.tsx.`, files: ["src/screens/HomeScreen.tsx"], tests });

describe("dropDoneParts", () => {
  const done = ["Add How it works and Why you can trust it to Home", "Compose the Home hero from core parts"];
  it("drops a part whose title a finished step covers", () => {
    const kept = dropDoneParts([part("Write the acceptance tests"), part("Add How it works to Home"), part("Category grid, filters, sort and search results")], done);
    expect(kept.map((p) => p.title)).toEqual(["Write the acceptance tests", "Category grid, filters, sort and search results"]);
  });
  it("keeps a part that owns tests, and always keeps one", () => {
    expect(dropDoneParts([part("Add How it works to Home", ["shows How it works"])], done)).toHaveLength(1);
    expect(dropDoneParts([part("Add How it works to Home"), part("Compose the Home hero")], done)).toHaveLength(1);
  });
});
