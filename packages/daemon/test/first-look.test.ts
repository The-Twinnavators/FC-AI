/** "First look ready" when a build's main screens are designed, and only then (D8). */
import { describe, expect, it } from "vitest";
import { firstLookAt, watchFirstLook } from "../src/api/firstLook.js";
import { DESIGN_SCREENS } from "../src/orchestrator/templates.js";

function fakeApp(tasks: Array<{ id: string; title: string; status: string; parent?: string }>) {
  const settings = new Map<string, unknown>();
  for (const t of tasks) if (t.parent) settings.set(`splitParent:${t.id}`, t.parent);
  let handler: (e: { type: string; runId?: string; taskId?: string; projectId?: string }) => void = () => undefined;
  const emitted: string[] = [];
  const app = {
    store: {
      tasks: { get: (id: string) => tasks.find((t) => t.id === id), where: () => tasks },
      getSetting: <T>(k: string, d: T) => (settings.has(k) ? (settings.get(k) as T) : d),
      setSetting: (k: string, v: unknown) => void settings.set(k, v),
    },
    bus: { subscribe: (fn: typeof handler) => ((handler = fn), () => undefined), emit: (e: { message: string }) => void emitted.push(e.message) },
  };
  watchFirstLook(app as never);
  return { app, emitted, verify: (taskId: string) => handler({ type: "task.verified", runId: "r1", taskId, projectId: "p1" }) };
}

describe("first look", () => {
  it("fires once when the screens step passes, not for other steps", () => {
    const f = fakeApp([{ id: "t1", title: "Set up the starter", status: "verified" }, { id: "t2", title: DESIGN_SCREENS, status: "verified" }]);
    f.verify("t1");
    expect(firstLookAt(f.app as never, "r1")).toBeUndefined();
    f.verify("t2");
    f.verify("t2");
    expect(firstLookAt(f.app as never, "r1")).toBeTruthy();
    expect(f.emitted).toHaveLength(1);
  });
  it("waits for every part of a split screens step", () => {
    const tasks = [
      { id: "p", title: DESIGN_SCREENS, status: "skipped" },
      { id: "a", title: "Screens part 1", status: "verified", parent: "p" },
      { id: "b", title: "Screens part 2", status: "running", parent: "p" },
    ];
    const f = fakeApp(tasks);
    f.verify("a");
    expect(f.emitted).toHaveLength(0);
    tasks[2]!.status = "verified";
    f.verify("b");
    expect(f.emitted).toHaveLength(1);
  });
});
