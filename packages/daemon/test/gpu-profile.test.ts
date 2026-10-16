/** The 8GB GPU profile: one local request at a time app-wide, text support roles on qwen3:8b (vision kept), the step's
 * own tools, a hard context ceiling, and the app model in bounded parts. */
import { describe, expect, it } from "vitest";
import { acquireGpu, gpuGateState, setGpuGatePolicy } from "../src/models/gpuGate.js";
import { stepTools } from "../src/orchestrator/toolSelection.js";
import { ROLE_TOOLS, type ToolName } from "@flowcode/contracts";
import { setRuntimeOptions } from "../src/orchestrator/runtimeOptions.js";
import type { ChatRequest } from "../src/models/types.js";
import { makeApp } from "./helpers.js";

describe("one local request at a time", () => {
  it("queues the second and third requests, announces them, and lets one cancelled while waiting leave", async () => {
    const queued: string[] = [];
    setGpuGatePolicy(() => true, (label, behind, position) => queued.push(`${label} behind ${behind} #${position}`));
    const first = await acquireGpu("coder for Clean Cart");
    let secondIn = false;
    const second = acquireGpu("reviewer for NOBIO").then((r) => ((secondIn = true), r));
    const abort = new AbortController();
    const third = acquireGpu("researcher", abort.signal).catch(() => "cancelled");
    await new Promise((r) => setTimeout(r, 10));
    expect(secondIn).toBe(false);
    expect(queued).toEqual(["reviewer for NOBIO behind coder for Clean Cart #1", "researcher behind coder for Clean Cart #2"]);
    abort.abort();
    expect(await third).toBe("cancelled");
    first();
    (await second)();
    expect(secondIn).toBe(true);
    expect(gpuGateState()).toEqual({ waiting: [] });
    setGpuGatePolicy(() => false);
  });
});

describe("the step's tools", () => {
  it("shows a styling step its controls and editing tools, not file moves or package edits; keeps catalog tools when it uses the catalog", () => {
    const coder = ROLE_TOOLS.coder as ToolName[];
    const css = stepTools(coder, { title: "Add the stylesheet rules", objective: "Stack .steps at 375px.", expectedPaths: ["src/styles/app.css"] }, { catalog: false, designStep: false });
    for (const t of ["task_complete", "report_blocked", "request_approval", "read_file", "apply_patch", "replace_file", "create_file", "run_script"]) expect(css).toContain(t);
    for (const t of ["move_file", "delete_file", "edit_package_manifest", "find_image", "add_library_piece"]) expect(css).not.toContain(t);
    expect(css.length).toBeLessThan(coder.length);
    const ui = stepTools(coder, { title: "Implement Real Imagery", objective: "Put real photos on Home.", expectedPaths: ["src/screens/Home.tsx"] }, { catalog: true, designStep: true });
    for (const t of ["find_image", "add_library_piece", "get_catalog_contract"]) expect(ui).toContain(t);
  });
});

describe("support roles and the context ceiling in the profile", () => {
  it("runs a text support role on qwen3:8b, keeps the vision model for a request with images, and caps long replies", async () => {
    const { app } = makeApp();
    setRuntimeOptions(app.store, { gpuProfile: "8gb", profileContext: 12288, profileSupportModel: "qwen3:8b" });
    const seen: Array<{ model: string; num: number | undefined; ctx: number | undefined }> = [];
    app.router.register({
      config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
      chat: async (req: ChatRequest) => (seen.push({ model: req.model, num: req.maxOutputTokens, ctx: req.contextWindow }), { content: "{}", toolCalls: [], model: req.model, durationMs: 1 }),
      listModels: async () => [],
      describe: async () => undefined,
      health: async () => ({ ok: true, detail: "" }),
    });
    await app.router.chat({ role: "reviewer" }, { providerId: "ollama", model: "qwen3:14b" }, { messages: [{ role: "user", content: "review" }] });
    await app.router.chat({ role: "researcher" }, { providerId: "ollama", model: "qwen2.5vl:3b" }, { messages: [{ role: "user", content: "what's in this", images: ["aGk="] }] });
    await app.router.chat({ role: "planner" }, { providerId: "ollama", model: "qwen3:8b", contextWindow: 32768 }, { messages: [{ role: "user", content: "plan" }], maxOutputTokens: 8000 });
    expect(seen[0]!.model).toBe("qwen3:8b");
    expect(seen[1]!.model).toBe("qwen2.5vl:3b");
    expect(seen[2]).toEqual({ model: "qwen3:8b", num: 4096, ctx: 12288 });
    // The thinking setting is recorded on every call.
    expect(app.bus.list({ types: ["model.completed"] }).every((e) => typeof (e.data as { think?: unknown }).think === "boolean")).toBe(true);
  });
});

async function modelInParts(dropAreas = false, failSecondEntries = false) {
  const { app } = makeApp();
  setRuntimeOptions(app.store, { gpuProfile: "8gb" });
  const asked: Array<{ part: string; max?: number; think?: boolean }> = [];
  const structure = {
    shape: "lookup",
    product: "Clean Cart",
    roles: ["Shopper"],
    entities: [
      { key: "product", label: "Product", plural: "Products", idPrefix: "PRD", titleField: "name", fields: [{ key: "name", label: "Name", type: "text" }, { key: "category", label: "Category", type: "select", options: ["Produce", "Dairy"] }] },
      { key: "store", label: "Store", plural: "Stores", idPrefix: "STR", titleField: "name", fields: [{ key: "name", label: "Name", type: "text" }, { key: "zip", label: "ZIP", type: "text" }] },
    ],
    nav: [{ label: "Clean Cart", items: [{ id: "home", label: "Home", kind: "landing" }] }],
    lookup: { entries: "product", places: "store", categoryField: "category", placesField: "carriedBy", areas: [{ zip: "94110", label: "San Francisco, CA", lat: 37.75, lng: -122.41 }], placeWord: "store", carryWord: "carries", detailFields: ["category"], facets: ["category"] },
  };
  app.router.register({
    config: { id: "ollama", kind: "ollama", label: "stub", enabled: true, hosted: false },
    chat: async (req: ChatRequest) => {
      const sys = String(req.messages[0]?.content ?? "");
      const user = String(req.messages[1]?.content ?? "");
      const part = sys.includes("Write it in parts") ? "structure" : sys.includes("ZIP code areas a look-up app") ? "areas" : sys.startsWith("You write realistic sample records") ? (user.includes("Stores") ? "places" : "entries") : "social";
      asked.push({ part, max: req.maxOutputTokens, think: req.think });
      if (failSecondEntries && part === "entries" && user.includes("records 11 to 20")) return { content: '{"records": [', toolCalls: [], model: req.model, durationMs: 1, doneReason: "length" };
      const body =
        part === "structure"
          ? dropAreas
            ? { ...structure, lookup: { ...structure.lookup, areas: [] } }
            : structure
          : part === "areas"
            ? { areas: structure.lookup.areas }
          : part === "places"
            ? { records: Array.from({ length: 8 }, (_, i) => ({ name: `Store ${i}`, zip: "94110" })) }
            : part === "entries"
              ? { records: Array.from({ length: 20 }, (_, i) => ({ name: `Apples ${i}`, category: "Produce", carriedBy: user.includes("STR-1001") ? ["STR-1001", "STR-1002"] : [] })) }
              : { ratings: [{ entry: "PRD-1001", who: "Ana R.", stars: 5, text: "Crisp", at: "2026-03-01", helpful: 2 }], lists: [{ name: "Weekly", place: "STR-1001", items: [{ entry: "PRD-1002", qty: 2, done: false }] }], likes: { "PRD-1001": 12 }, saves: {} };
      return { content: JSON.stringify(body), toolCalls: [], model: req.model, durationMs: 1, doneReason: "stop" };
    },
    listModels: async () => [],
    describe: async () => undefined,
    health: async () => ({ ok: true, detail: "" }),
  });
  for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, { providerId: "ollama", model: "qwen3:8b" });
  const { makeProject } = await import("./helpers.js");
  const { project } = makeProject(app, { "README.md": "# demo\n" });
  const run = app.orchestrator.createRun({ projectId: project.id, objective: "Clean Cart", constraints: [], attachedKnowledgeIds: [] });
  const got = await (app.orchestrator as unknown as { appModelInParts: (...a: unknown[]) => Promise<{ model?: { seed: Record<string, Array<Record<string, unknown>>>; lookup?: { ratings: unknown[]; lists: unknown[] } }; problems: string[] }> }).appModelInParts(app.store.runs.require(run.id), "PRD", [], "", "", new AbortController().signal);
  return { asked, got };
}

describe("the app model in parts", () => {
  it("asks for the structure, then the places, then the entries naming them, then ratings, each reply capped; and assembles a valid model", async () => {
    const { asked, got } = await modelInParts();
    expect(asked.map((a) => a.part)).toEqual(["structure", "places", "entries", "entries", "social"]);
    expect(asked.every((a) => (a.max ?? 0) <= 3500 && a.think === false)).toBe(true);
    expect(got.model!.seed.product!.length).toBe(20);
    expect(got.model!.seed.product![0]!.carriedBy).toEqual(["STR-1001", "STR-1002"]);
    expect(got.model!.lookup!.ratings.length).toBe(1);
    expect(got.problems.filter((p) => /carry|ZIP|sample/.test(p))).toEqual([]);
  });

  it("asks for a look-up app's ZIP code areas on their own when the structure leaves them out", async () => {
    const { asked, got } = await modelInParts(true);
    expect(asked.map((a) => a.part)).toEqual(["structure", "areas", "places", "entries", "entries", "social"]);
    expect(asked.every((a) => (a.max ?? 0) <= 3500 && a.think === false)).toBe(true);
    expect(got.model!.seed.product!.length).toBe(20);
    expect(got.problems.filter((p) => /ZIP/.test(p))).toEqual([]);
  });

  it("writes records in batches of ten, and keeps the first batch when a later one is cut off", async () => {
    const { asked, got } = await modelInParts(false, true);
    // The cut-off batch is tried twice, then the model goes on with ten products (a noted problem, not a lost model).
    expect(asked.map((a) => a.part)).toEqual(["structure", "places", "entries", "entries", "entries", "social"]);
    expect(got.model!.seed.product!.length).toBe(10);
    expect(got.problems.some((p) => /Only 10 sample products/.test(p))).toBe(true);
  });
});

describe("a paused build across a daemon restart", () => {
  it("stays paused and idle after the restart, and Continue resumes it", async () => {
    const { app } = makeApp();
    const { makeProject } = await import("./helpers.js");
    const { project } = makeProject(app, { "README.md": "# demo\n" });
    app.projects.updateSettings(project.id, { autonomy: "assisted" });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "g", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), status: "running", planApproved: true });
    app.orchestrator.pauseRun(run.id, true);
    // A fresh orchestrator over the same data is what a restart is.
    const resumed: string[] = [];
    const orch = app.orchestrator as unknown as { resume: (id: string) => unknown; reconcileOnStartup: () => Promise<void> };
    orch.resume = (id: string) => (resumed.push(id), undefined);
    await orch.reconcileOnStartup();
    expect(resumed).toEqual([]);
    expect(app.bus.list({ runId: run.id, types: ["run.status_changed"] }).some((e) => /stays paused, as you left it/.test(e.message))).toBe(true);
    app.orchestrator.pauseRun(run.id, false);
    expect(resumed).toEqual([run.id]);
  });
});
