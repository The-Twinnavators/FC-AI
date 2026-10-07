/** Fixes for what the agent benchmark exposed, each replayed from the benchmark's own failures. */
import { describe, expect, it } from "vitest";
import { locatePatch } from "../src/workspace/operations.js";
import { planTooBig, snippetToName, typesFirst } from "../src/orchestrator/guards.js";
import { makeApp, makeProject } from "./helpers.js";

const CAL = ["export default function Calendar() {", "  const [view, setView] = useState('month');", "  return (", "    <div>", "      <button onClick={onToday}>Today</button>", "    </div>", "  );", "}", "function Week() {", "  return (", "    <div>", "      <button onClick={onToday}>Today</button>", "    </div>", "  );", "}", ""].join("\n");

describe("patch placement", () => {
  it("uses the line hint when the text occurs more than once", () => {
    const find = "      <button onClick={onToday}>Today</button>";
    expect(locatePatch(CAL, find)).toEqual({ ambiguous: [5, 12] });
    const hit = locatePatch(CAL, find, 12);
    expect("start" in hit && CAL.slice(0, hit.start).split("\n").length).toBe(12);
  });
  it("matches a block whose only difference is indentation, but only when there's exactly one", () => {
    const hit = locatePatch(CAL, "const [view, setView] = useState('month');\nreturn (");
    expect(hit).toMatchObject({ how: "indent" });
    expect("start" in hit && CAL.slice(hit.start, hit.end)).toBe("  const [view, setView] = useState('month');\n  return (");
    expect(locatePatch(CAL, "<div>\n<button onClick={onToday}>Today</button>")).toEqual({ ambiguous: [4, 11] });
    expect(locatePatch(CAL, "const nothing = 1;")).toEqual({ missing: true });
  });
  it("applies through the real tool, and a miss shows the closest lines with numbers", () => {
    const { app } = makeApp();
    const { project, jail } = makeProject(app, { "src/Calendar.tsx": CAL });
    const ctx = { jail, projectId: project.id, runId: "run_bench", approved: true };
    const ok = app.ops.apply_patch(ctx, { path: "src/Calendar.tsx", edits: [{ find: "      <button onClick={onToday}>Today</button>", replace: "      <button onClick={onToday} disabled={isCurrent}>Today</button>", line: 12 }] });
    expect(ok.ok).toBe(true);
    const miss = app.ops.apply_patch(ctx, { path: "src/Calendar.tsx", edits: [{ find: "const [view, setView] = useState(\"week\");", replace: "x" }] });
    expect(miss.ok).toBe(false);
    expect(miss.message).toMatch(/closest part of the file is below/);
    expect(miss.message).toMatch(/2:   const \[view, setView\] = useState\('month'\);/);
  });
});

describe("guessed snippets in checks", () => {
  it("keeps the real name a guessed snippet contains, drops it when there's none, and leaves names and copy alone", () => {
    expect(snippetToName("filteredEvents = events.filter(event => event.title.toLowerCase().includes(searchQuery.toLowerCase()))")).toBe("filteredEvents");
    expect(snippetToName("interface SearchQuery {")).toBe("SearchQuery");
    expect(snippetToName('input type="text" placeholder="Search events..."')).toBeUndefined();
    expect(snippetToName("searchEvents(title: string): Promise<Event[]>")).toBe("searchEvents");
    expect(snippetToName("useSchedule")).toBeNull();
    expect(snippetToName("Add event")).toBeNull();
  });
});

describe("plan shape", () => {
  const task = (key: string, path: string, dependsOn: string[] = []) => ({ key, expectedPaths: [path], dependsOn });
  it("moves types tasks first and makes the rest wait for them", () => {
    const plan = [task("t1", "src/components/Calendar.tsx"), task("t2", "src/lib/eventStorage.ts", ["t1"]), task("t3", "src/lib/types.ts", ["t2"])];
    const out = typesFirst(plan);
    expect(out.map((t) => t.key)).toEqual(["t3", "t1", "t2"]);
    expect(out[0].dependsOn).toEqual([]);
    expect(out[1].dependsOn).toContain("t3");
  });
  it("sends a 7-step plan for one feature back, but not a spec build", () => {
    const seven = { tasks: Array.from({ length: 7 }, (_, i) => ({ expectedPaths: [`src/f${i}.tsx`] })) };
    expect(planTooBig(seven, { specBuild: false, objective: "Let users search their events by title" })).toMatch(/7 tasks across 7 files/);
    expect(planTooBig(seven, { specBuild: true, objective: "x" })).toBeUndefined();
    expect(planTooBig({ tasks: seven.tasks.slice(0, 3) }, { specBuild: false, objective: "x" })).toBeUndefined();
  });
});

describe("checks relative to the starting state", () => {
  const before = [
    "> tsc --noEmit",
    "src/components/Calendar/Calendar.tsx(68,205): error TS2322: Type '{ eventsCount: number }' is not assignable to type 'CalendarHeaderProps'.",
    "src/components/Calendar/CalendarHeader.tsx(30,12): error TS2552: Cannot find name 'eventsCount'.",
    "Found 2 errors in 2 files.",
  ].join("\n");
  it("treats the same errors on shifted lines as already there, and spots a new one", async () => {
    const { errorLines, errorSignatures, signature } = await import("../src/quality/verification.js");
    expect(errorLines(before)).toHaveLength(2);
    const known = new Set(errorSignatures(before));
    const shifted = before.replace("(68,205)", "(71,205)").replace("(30,12)", "(33,12)");
    expect(errorLines(shifted).filter((l) => !known.has(signature(l)))).toEqual([]);
    const withNew = `${shifted}\nsrc/App.tsx(42,12): error TS1381: Unexpected token. Did you mean \`{'}'}\`?`;
    expect(errorLines(withNew).filter((l) => !known.has(signature(l)))).toEqual(["src/App.tsx(42,12): error TS1381: Unexpected token. Did you mean `{'}'}`?"]);
  });
});
