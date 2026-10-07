import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selfComparingTests } from "../src/quality/verification.js";

describe("selfComparingTests", () => {
  it("finds tests that compare a value with itself (Calculator app's offline step) and nothing else", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fc-fake-")), "a.test.tsx");
    fs.writeFileSync(
      file,
      [
        'expect(JSON.parse(manifest).display).toBe("standalone");',
        'expect("standalone display").toBe("standalone display");',
        "expect(4).toEqual(4);",
        'expect(display.textContent).toBe("14");',
      ].join("\n"),
    );
    expect(selfComparingTests(file)).toEqual(['line 2: expect("standalone display").toBe("standalone display");', "line 3: expect(4).toEqual(4);"]);
    expect(selfComparingTests(path.join(path.dirname(file), "missing.test.tsx"))).toEqual([]);
  });
});

describe("parked acceptance tests", () => {
  it("finds it.todo, .skip, xit and describe.skip", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const { parkedTests } = await import("../src/quality/verification.js");
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fc-parked-")), "a.test.tsx");
    fs.writeFileSync(f, `it.todo("creates Dentist");\nit.skip('shows details', () => {});\nxit("finds by description", () => {});\ndescribe.skip("later", () => {});\nit("real one", () => {});\ntest("another real one", () => {});`);
    expect(parkedTests(f)).toEqual(["creates Dentist", "shows details", "finds by description", "later"]);
    expect(parkedTests(path.join(path.dirname(f), "missing.test.tsx"))).toEqual([]);
  });
});
