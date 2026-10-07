/** When FlowCode's own no-progress guard stops a step twice, the step gets one attempt with the guard relaxed. */
import { describe, expect, it } from "vitest";
import { guardOf, guardStops } from "../src/orchestrator/stepRecovery.js";
import { makeApp } from "./helpers.js";

describe("FlowCode limits", () => {
  it("counts only FlowCode's guard stops, and names the guard", () => {
    const findings = [
      "agent outcome: no_action (No progress: 18 reads in a row and no change made. Either the step is already done (call task_complete) or it needs an edit.)",
      "typecheck failed: src/App.tsx(3,1)",
      "agent outcome: no_action (No progress: 20 reads in a row and no change made. Either the step is already done (call task_complete) or it needs an edit.)",
      "agent outcome: no_action (Model replied with prose only and did not invoke a tool or report a structured blocker.)",
    ];
    expect(guardStops(findings)).toBe(2);
    expect(guardOf(findings)).toBe("20 reads in a row and no change made");
  });

  it("gives a relaxed attempt three times the reading room", async () => {
    const { runAgentLoop } = await import("../src/orchestrator/agentLoop.js");
    const { ScriptedProvider, call } = await import("../src/models/scripted.js");
    const run = async (relaxGuards: boolean) => {
      const { app } = makeApp();
      let n = 0;
      app.router.register(new ScriptedProvider({ id: "reader", kind: "scripted", label: "reader", enabled: true, hosted: false }, () => ({ toolCalls: [call("read_file", { path: `src/f${n++}.ts` })] })));
      return runAgentLoop({ router: app.router, store: app.store, bus: app.bus, role: "coder", assignment: { providerId: "reader", model: "m" }, system: "s", user: "u", runId: "run_relax", maxTurns: 60, relaxGuards, executor: async () => ({ ok: true, content: "x" }) });
    };
    // A local model reading a different file each turn: 8 read-only turns end it (on turn 9), or 24 when relaxed.
    expect((await run(false)).turns).toBe(9);
    expect((await run(true)).turns).toBe(25);
  });
});

describe("test failure digest", () => {
  it("lists every failing test with its first reason, without colour codes", async () => {
    const { testFailureDigest } = await import("../src/orchestrator/guards.js");
    const out = [
      " \u001b[31m×\u001b[39m suite > saves an event 120ms",
      "   → expected undefined to be 'evt-1001' // Object.is equality",
      " ✓ suite > defaults isAllDay to false 5ms",
      " × suite > shows the heading 300ms",
      "TestingLibraryElementError: Unable to find role=\"heading\" and name \"Calendar\"",
      "      Tests  2 failed | 1 passed (3)",
    ].join("\n");
    const d = testFailureDigest(out);
    expect(d).toContain("Failing tests (2 failed | 1 passed (3)):");
    expect(d).toContain("- suite > saves an event: expected undefined to be 'evt-1001'");
    expect(d).toContain('- suite > shows the heading: TestingLibraryElementError: Unable to find role="heading"');
    expect(d).not.toMatch(/\u001b/);
    expect(testFailureDigest(" ✓ all good\n Tests 3 passed (3)")).toBe("");
    expect(d).not.toMatch(/shared cause/);
  });

  it("points at one shared cause when most failures can't find something on screen", async () => {
    // Calendar design rebuild: event details stopped opening and 9 of 12 tests couldn't find the dialog or its Edit button.
    const { testFailureDigest } = await import("../src/orchestrator/guards.js");
    const fail = (n: string, why: string) => [` × suite > ${n} 50ms`, `TestingLibraryElementError: ${why}`];
    const out = [
      ...fail("edits Dentist", 'Unable to find an accessible element with the role "button" and name "Edit"'),
      ...fail("opens Planning", 'Unable to find an accessible element with the role "dialog" and name "Planning"'),
      ...fail("shows details", "Unable to find an element with the text: Bring insurance card"),
      " × suite > counts events 10ms",
      "   → expected 3 to be 4",
      "      Tests  4 failed | 20 passed (24)",
    ].join("\n");
    expect(testFailureDigest(out)).toMatch(/^Failing tests \(4 failed \| 20 passed \(24\)\):\n3 of these 4 can't find something on screen: usually one shared cause/);
  });
});
