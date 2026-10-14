/** A test-writing step gets how to work and a map of what the app's screens and used pieces show (not their demos). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { testingGuide } from "../src/orchestrator/testingGuide.js";

describe("testingGuide", () => {
  it("maps the screens and the pieces they use, leaving out piece demos and unused pieces", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-tg-"));
    fs.mkdirSync(path.join(root, "src/screens"), { recursive: true });
    fs.mkdirSync(path.join(root, "src/sections"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/screens/HomeScreen.tsx"), `import { PlaceFinder } from "../sections/PlaceFinder";\nexport default function HomeScreen() { return <h1>Food without GMOs</h1>; }`);
    fs.writeFileSync(path.join(root, "src/sections/PlaceFinder.tsx"), `export function PlaceFinder() { return <input aria-label="ZIP code" placeholder="94110" />; }\n// flowcode:sample\nfunction Demo() { return <h2>Versions</h2>; }`);
    fs.writeFileSync(path.join(root, "src/sections/Unused.tsx"), `export function Unused() { return <button>Never shown</button>; }`);
    const g = testingGuide(root);
    expect(g).toContain("Create the test file within your first few turns");
    expect(g).toContain('heading "Food without GMOs"');
    expect(g).toContain('label "ZIP code"');
    expect(g).not.toContain("Versions");
    expect(g).not.toContain("Never shown");
  });
});
