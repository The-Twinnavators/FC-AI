import { describe, expect, it } from "vitest";
import { screenFromHash } from "./screens";

describe("screenFromHash", () => {
  const ids = ["home", "goals", "settings"] as const;
  it("reads the screen from the hash", () => {
    expect(screenFromHash("#/goals", ids)).toBe("goals");
    expect(screenFromHash("#settings", ids)).toBe("settings");
  });
  it("falls back to the first screen", () => {
    expect(screenFromHash("", ids)).toBe("home");
    expect(screenFromHash("#/nope", ids)).toBe("home");
  });
});
