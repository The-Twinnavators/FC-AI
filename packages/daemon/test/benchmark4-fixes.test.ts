/** Fixes for what benchmark 4 exposed, replayed from its own failures. */
import { describe, expect, it } from "vitest";
import { editGuard, reinsertion } from "../src/orchestrator/guards.js";

const CSS = [".cal-head {", "  display: flex;", "}", "", ".cal-head__title {", "  font-size: var(--text-lg);", "  margin: 0;", "}", ""].join("\n");
const patch = (lines: string[]) => ({ path: "src/styles/calendar.css", edits: [{ find: ".cal-head__title {", line: 5, replace: [".cal-head__title {", ...lines].join("\n") }] });

describe("patches that re-insert what the previous patch added", () => {
  it("lets the first insertion through and stops the second, explaining how to edit the block", () => {
    expect(editGuard("apply_patch", "src/styles/calendar.css", CSS, patch(["  position: relative;"]), { patchMisses: 0 })).toBeUndefined();
    const once = CSS.replace(".cal-head__title {", ".cal-head__title {\n  position: relative;");
    const refused = editGuard("apply_patch", "src/styles/calendar.css", once, patch(["  position: relative;", "  padding-right: 2rem;"]), { patchMisses: 0 });
    expect(refused).toMatch(/`position: relative;` is already on the line after `.cal-head__title {`/);
    expect(refused).toMatch(/doesn't replace your previous patch/);
  });

  it("works for code too, and doesn't flag an ordinary insertion or a closing brace", () => {
    const ts = "export function total(items: number[]) {\n  let sum = 0;\n  return sum;\n}\n";
    expect(reinsertion(ts, [{ find: "export function total(items: number[]) {", replace: "export function total(items: number[]) {\n  let sum = 0;\n  for (const i of items) sum += i;" }])).toMatch(/already on the line after/);
    expect(reinsertion(ts, [{ find: "  let sum = 0;", replace: "  let sum = 0;\n  for (const i of items) sum += i;" }])).toBeUndefined();
    expect(reinsertion("a {\n}\n", [{ find: "a {", replace: "a {\n}" }])).toBeUndefined();
  });
});

describe("repeated CSS declarations", () => {
  it("refuses an edit that repeats a declaration already in the rule", () => {
    const edit = { path: "x.css", edits: [{ find: "  margin: 0;", replace: "  margin: 0;\n  font-size: var(--text-lg);" }] };
    expect(editGuard("apply_patch", "x.css", CSS, edit, { patchMisses: 0 })).toMatch(/`font-size: var\(--text-lg\)` would appear 2 times in `.cal-head__title`/);
  });

  it("allows fallbacks with different values, and repeats that were already there", () => {
    const fallback = { path: "x.css", edits: [{ find: "  margin: 0;", replace: "  margin: 0;\n  height: 100vh;\n  height: 100dvh;" }] };
    expect(editGuard("apply_patch", "x.css", CSS, fallback, { patchMisses: 0 })).toBeUndefined();
    const messy = CSS.replace("  margin: 0;", "  margin: 0;\n  margin: 0;");
    const unrelated = { path: "x.css", edits: [{ find: "  display: flex;", replace: "  display: flex;\n  gap: var(--space-2);" }] };
    expect(editGuard("apply_patch", "x.css", messy, unrelated, { patchMisses: 0 })).toBeUndefined();
  });
});
