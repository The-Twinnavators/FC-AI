/**
 * The library pieces FlowCode writes into apps pass its own content check (Frameproof main build: "Write the complete
 * app" was blocked twice because resource-index's reference-sheet "Reset sample data" button sat above its
 * flowcode:sample marker). The marker only hides the demo sheet: every piece's working exports stay above it, and
 * placeholder text in the working code is still found.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentProblems } from "../src/quality/contentCheck.js";
import { APP_PIECES } from "../src/orchestrator/appFiles.js";
import { PathJail } from "../src/security/pathJail.js";

const LIB = path.resolve(__dirname, "../../../templates/library/sections");
const MARKER = /\/\/\s*flowcode:sample\b/;
const pieces = fs.readdirSync(LIB).filter((f) => f.endsWith(".tsx"));

const written = (files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fc-lib-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return new PathJail(root);
};
const check = (name: string, text: string) => contentProblems(written({ [`src/sections/${name}`]: text }), [`src/sections/${name}`]);

describe("library sections as written into an app", () => {
  it.each(pieces)("%s passes the content check", (f) => {
    expect(check(f, fs.readFileSync(path.join(LIB, f), "utf8"))).toEqual([]);
  });

  it.each(APP_PIECES)("%s keeps its working exports above the sample marker", (id) => {
    const src = fs.readFileSync(path.join(LIB, `${id}.tsx`), "utf8");
    const [shown, sheet = ""] = src.split(MARKER);
    expect(sheet).not.toBe("");
    // Only the demo sheet (the default export) and its sample values come after the marker.
    expect([...sheet.matchAll(/^export (?!default\b)\S+ (\w+)/gm)].map((m) => m[1])).toEqual([]);
    expect(shown).toMatch(/^export (?:function|const) \w+/m);
  });

  it.each(pieces)("%s keeps its SAMPLE block right after the marker, where the piece-content check reads it", (f) => {
    const src = fs.readFileSync(path.join(LIB, f), "utf8").replace(/\r\n/g, "\n");
    if (!/^const SAMPLE\b/m.test(src)) return;
    expect(src).toMatch(/\/\/ flowcode:sample\nconst SAMPLE\b/);
  });

  it("still finds placeholder text in a piece's working code, before the marker", () => {
    const src = fs.readFileSync(path.join(LIB, "resource-index.tsx"), "utf8");
    const at = src.search(MARKER);
    for (const text of ["Reset sample data", "Lorem ipsum dolor sit amet", "Coming soon"]) {
      const planted = `${src.slice(0, at)}export function Planted() {\n  return <p>${text}</p>;\n}\n\n${src.slice(at)}`;
      expect(check("ResourceIndex.tsx", planted).map((p) => p.file)).toEqual(["src/sections/ResourceIndex.tsx"]);
    }
  });
});
