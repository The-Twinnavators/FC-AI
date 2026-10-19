/**
 * FlowCode composes a standard screen itself (screenComposer.ts): a list of records with pictures becomes a picture
 * grid on the app's own store, with the collection's heading, search by title, a filter per filter field, a count, cards
 * opening the record's page and an empty state; styled only with tokens. Only a screen still as FlowCode generated it
 * is composed, once; a design part's model then refines it, and the picture check accepts pictures from the records.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Task } from "@flowcode/contracts";
import { composable, composeListScreen } from "../src/orchestrator/screenComposer.js";
import type { AppModel } from "../src/orchestrator/appModel.js";
import { appModelKey } from "../src/orchestrator/appModel.js";
import { ScriptedProvider, call } from "../src/models/scripted.js";
import type { ChatMessage } from "../src/models/types.js";
import { ModelRouter } from "../src/models/router.js";
import { idealProbeSolver } from "./scripted-agents.js";
import { makeApp, makeProject, waitFor } from "./helpers.js";

const MODEL = {
  product: "Frameproof",
  roles: ["client"],
  entities: [
    { key: "gallery", label: "Gallery", plural: "Galleries", titleField: "title", subtitleField: "photographer", fields: [{ key: "id", label: "ID", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "photographer", label: "Photographer", type: "text" }, { key: "client", label: "Client", type: "text" }, { key: "requiredSelectionCount", label: "Required Selection Count", type: "number" }] },
    { key: "photo", label: "Photo", plural: "Photos", titleField: "title", subtitleField: "category", filters: ["category"], fields: [{ key: "id", label: "ID", type: "text" }, { key: "title", label: "Title", type: "text" }, { key: "category", label: "Category", type: "select", options: ["Outdoor", "Studio", "All"] }, { key: "imageSource", label: "Image Source", type: "text" }, { key: "altText", label: "Alt Text", type: "text" }] },
  ],
  seed: {
    gallery: [{ id: "gallery-autumn", title: "Autumn Portrait Session", photographer: "Rowan Studio", client: "Maya Chen", requiredSelectionCount: 5 }],
    photo: [{ id: "photo-01", title: "Golden Hour", category: "Outdoor", imageSource: "/images/photo-01.jpg", altText: "A portrait at golden hour" }],
  },
  nav: [
    { label: "Gallery", items: [{ id: "gallery", label: "Gallery", kind: "list", entity: "photo" }, { id: "photo-detail", label: "Photo detail", kind: "detail", entity: "photo" }] },
    { label: "My Selection", items: [{ id: "my-selection", label: "My Selection", kind: "custom" }] },
  ],
} as unknown as AppModel;
const gallery = MODEL.nav[0]!.items[0]!;

describe("composing a list of records with pictures", () => {
  it("writes a picture grid on the app's store with the collection's heading, search, filter, count and empty state", () => {
    const c = composeListScreen(MODEL, gallery)!;
    expect(c.files.map((f) => f.path)).toEqual(["src/screens/GalleryScreen.tsx", "src/styles/gallery.css"]);
    const tsx = c.files[0]!.content;
    expect(tsx).toContain('const records = useRecords(store, "photo");');
    expect(tsx).toContain('const context = useRecords(store, "gallery")[0];');
    expect(tsx).toContain('String(r["title"] ?? "").toLowerCase().includes(q)');
    expect(tsx).toContain('(!f0 || r["category"] === f0)');
    expect(tsx).toContain('{["Outdoor","Studio"].map((o) => (');
    expect(tsx).not.toContain('"All","');
    expect(tsx).toContain('go("photo-detail", r.id)');
    expect(tsx).toContain('alt={String(r["altText"] ?? title)}');
    expect(tsx).toContain('import "../styles/gallery.css";');
    expect(tsx).toContain("Composed by FlowCode");
    const css = c.files[1]!.content;
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    expect(css).toContain("grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr))");
    expect(c.summary).toBe("Gallery: photos as a grid of their pictures, search by title, category filter, the gallery's heading, each opening its page");
  });

  it("composes only a list with pictures that is still the generated screen", () => {
    expect(composable(MODEL, gallery, "/** Built by FlowCode from the app model */")).toBe(true);
    expect(composable(MODEL, gallery, "/** Composed by FlowCode … Built by FlowCode from the app model */")).toBe(false);
    expect(composable(MODEL, gallery, "export default function GalleryScreen() {} // someone's own")).toBe(false);
    expect(composable(MODEL, MODEL.nav[0]!.items[1]!)).toBe(false);
  });
});

describe("a design part for a standard screen", () => {
  it("starts from the composed screen, and the model's request says so", async () => {
    const { app } = makeApp();
    let firstBrief = "";
    app.router.register(
      new ScriptedProvider({ id: "scripted", kind: "scripted", label: "s", enabled: true, hosted: false }, async (_req, h: ChatMessage[]) => {
        if (!firstBrief) firstBrief = String(h.find((m) => m.role === "user")?.content ?? "");
        return { toolCalls: [call("report_blocked", { reason: "Missing information: test stop", nextAction: "-" })] };
      }),
    );
    app.router.register(idealProbeSolver("scripted-ideal"));
    // The Frameproof window (24k): the default 16k is too small for a design part with its skills.
    const asg = { providerId: "scripted", model: "agent", contextWindow: 24_576 };
    const lab = await app.lab.probe({ providerId: "scripted-ideal", model: "agent" });
    app.store.capabilities.upsert({ ...lab, id: "cap_copy", providerId: "scripted", model: "agent", configHash: ModelRouter.configHash(asg) });
    for (const role of ["planner", "coder", "debugger"] as const) app.router.setRoleAssignment(role, asg);
    const generated = '/**\n * Gallery\n * Built by FlowCode from the app model; it reads and writes the app\'s one store (src/app/store.ts).\n */\nimport { ResourceIndex } from "../sections/ResourceIndex";\nexport default function GalleryScreen() {\n  return null;\n}\n';
    const { project, ws } = makeProject(app, { "README.md": "# demo\n", "src/screens/GalleryScreen.tsx": generated });
    const run = app.orchestrator.createRun({ projectId: project.id, objective: "demo", constraints: [], attachedKnowledgeIds: [] });
    app.store.runs.upsert({ ...app.store.runs.require(run.id), planApproved: true });
    app.store.setSetting(appModelKey(run.id), MODEL);
    const task = { id: "t1", runId: run.id, title: "Design the Gallery screen", objective: "Design the Gallery screen.", status: "pending", dependsOn: [], expectedPaths: ["src/screens/GalleryScreen.tsx", "src/styles/gallery.css"], actualPaths: [], acceptanceCriteria: [], validationPlan: { kinds: [] }, role: "coder", ordinal: 1, attempts: 0 } as unknown as Task;
    app.store.tasks.upsert(task);
    app.store.setSetting("splitParent:t1", "Design the main screens");
    app.store.setSetting("splitPart:t1", true);
    app.orchestrator.start(run.id);
    await waitFor(() => (firstBrief ? true : undefined), 30_000);
    const now = fs.readFileSync(path.join(ws, "src/screens/GalleryScreen.tsx"), "utf8");
    expect(now).toContain("Composed by FlowCode");
    expect(fs.existsSync(path.join(ws, "src/styles/gallery.css"))).toBe(true);
    expect(firstBrief).toContain("FlowCode composed this screen already");
    expect(app.bus.list({ runId: run.id, types: ["recovery.action"] }).some((e) => e.message.startsWith('FlowCode composed "Gallery" itself, with no model'))).toBe(true);
    // Its writes aren't the step's own: undoing the step's edits goes back to the composed screen.
    expect(app.store.snapshots.where("task_id = ?", "t1").length).toBe(0);
    await app.orchestrator.cancel(run.id).catch(() => undefined);
  }, 60_000);
});
