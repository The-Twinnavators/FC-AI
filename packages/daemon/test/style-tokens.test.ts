import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { editStyleToken, groupOf, parseCustomProperties, scanStyles } from "../src/workspace/styleTokens.js";
import { makeApp, makeProject } from "./helpers.js";

const CSS = `/* tokens */
:root {
  --brand: #8b5cf6;
  --text: var(--brand);
  --space-4: 16px;
  --radius-md: 8px;
  --font-body: "Inter", system-ui; /* body */
  --shadow-1: 0 1px 2px rgba(0,0,0,.2);
}
@media (prefers-color-scheme: dark) {
  :root { --brand: #c4b5fd; }
}
.card { color: var(--brand); padding: var(--space-4); }
`;

describe("style tokens", () => {
  it("parses custom properties with selectors and offsets", () => {
    const d = parseCustomProperties(CSS);
    expect(d.map((x) => x.name)).toEqual(["--brand", "--text", "--space-4", "--radius-md", "--font-body", "--shadow-1", "--brand"]);
    const font = d.find((x) => x.name === "--font-body")!;
    expect(CSS.slice(font.start, font.end)).toBe('"Inter", system-ui');
    expect(d[6].selectors.join(" ")).toMatch(/prefers-color-scheme: dark/);
  });
  it("groups tokens", () => {
    expect(groupOf("--brand", "#8b5cf6")).toBe("color");
    expect(groupOf("--space-4", "16px")).toBe("spacing");
    expect(groupOf("--radius-md", "8px")).toBe("radius");
    expect(groupOf("--font-body", "Inter")).toBe("typography");
    expect(groupOf("--shadow-1", "0 1px 2px #000")).toBe("shadow");
    expect(groupOf("--dur-fast", "120ms")).toBe("motion");
  });
  it("scans a project, counts uses, resolves aliases and edits with a snapshot", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/tokens.css": CSS, "src/App.tsx": "<div style={{ color: 'var(--brand)' }} />" });
    const scan = scanStyles(jail);
    const brand = scan.tokens.find((t) => t.name === "--brand" && t.theme === "default")!;
    expect(brand.uses).toBe(3);
    expect(scan.tokens.find((t) => t.name === "--brand" && t.theme === "dark")?.value).toBe("#c4b5fd");
    expect(scan.tokens.find((t) => t.name === "--text")).toMatchObject({ group: "color", resolved: "#8b5cf6" });
    const r = editStyleToken(jail, app.ops, { projectId: project.id, runId: "style_test" }, { file: "src/tokens.css", name: "--brand", selector: brand.selector, expected: "#8b5cf6", value: "#7c3aed" });
    expect(r.snapshotId).toBeTruthy();
    const after = fs.readFileSync(path.join(jail.root, "src/tokens.css"), "utf8");
    expect(after).toContain("--brand: #7c3aed;");
    expect(after).toContain("--brand: #c4b5fd;");
    expect(() => editStyleToken(jail, app.ops, { projectId: project.id, runId: "style_test" }, { file: "src/tokens.css", name: "--brand", selector: brand.selector, expected: "#8b5cf6", value: "#000" })).toThrow(/changed on disk/);
    expect(() => editStyleToken(jail, app.ops, { projectId: project.id, runId: "style_test" }, { file: "src/tokens.css", name: "--brand", selector: brand.selector, expected: "#7c3aed", value: "red; } body { display:none" })).toThrow(/single CSS value/);
    app.snapshots.restore(r.snapshotId, jail);
    expect(fs.readFileSync(path.join(jail.root, "src/tokens.css"), "utf8")).toBe(CSS);
  });
});
