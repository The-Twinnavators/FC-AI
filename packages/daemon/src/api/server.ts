/**
 * Local daemon API (§15.1). Loopback-only HTTP + SSE with a per-launch bearer token (auth boundary,
 * §8). Every body is validated with runtime schemas; errors never leak absolute paths or secrets.
 */
import { runModels } from "./runModels.js";
import { copilotDraft, DraftKind } from "./copilotDraft.js";
import { changeImpact } from "./changeImpact.js";
import { blockerAdvice } from "./blockerAdvice.js";
import { stepPatch } from "./stepPatch.js";
import { compareRuns } from "./runCompare.js";
import { pointAt } from "./pointAt.js";
import { exportSite } from "./exportSite.js";
import { watchFirstLook } from "./firstLook.js";
import { setupStatus, testAndUse, useAsCoder } from "./setup.js";
import { externalChanges, watchStops } from "../workspace/stamp.js";
import { briefIdea } from "../orchestrator/ideaScout.js";
import { isFinishedRun } from "@flowcode/contracts";
import { designTemplate } from "@flowcode/contracts";
import { execFileSync } from "node:child_process";
import { createMobileApprovals } from "./mobile.js";
import * as D from "../discovery/discovery.js";
import { listPlaybook, removeFromPlaybook, setPlaybookActive } from "../knowledge/designPlaybook.js";
import { previewArgv } from "../workspace/preflight.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import * as C from "@flowcode/contracts";
import type { App } from "../app.js";
import { listTree, readFile, searchWorkspace, gitStatus } from "../workspace/fileService.js";
import { repositoryMap, renderRepositoryMap } from "../knowledge/skills.js";
import { redact } from "../security/redaction.js";
import { PolicyError } from "../security/pathJail.js";
import { NotFoundError } from "../db/db.js";
import { ModelRouter } from "../models/router.js";
import { aiEngine, checkNetwork, environment, systemHealth, toolCatalog } from "./system.js";
import { STYLE_EDIT_RUN, editStyleToken, scanStyles, editFixedFontSize } from "../workspace/styleTokens.js";
import { setSurfaceStyle, surfaceStyleOf } from "../workspace/surfaceStyle.js";
import { applyComponentStyle, applyDesign, applyPalette, componentStylesOf, designComponents, paletteOf, setDesignComponents } from "../workspace/designStudio.js";
import { FLOWCODE_LIMITS_KEY } from "../orchestrator/stepRecovery.js";
import { browseFolder, folderRoots } from "../workspace/folderBrowser.js";
import { applyCapturedStyle, captureStyle } from "../workspace/styleCapture.js";
import { BrowserSession } from "../quality/preview.js";
import { scanComponentLibrary } from "../workspace/componentLibrary.js";
import { runPerformance } from "./performance.js";
import { disableProposal, dismissProposal, enableProposal, proposalsView, restoreProposal, scanAndPropose, watchForPatterns } from "../knowledge/skillProposals.js";
import { applySuggestion, dismissSuggestion, solveOne, solverView, watchProblems } from "../quality/problemSolver.js";
import { SearxngAdapter, WikipediaAdapter } from "../knowledge/research.js";
import { RESULT_TABS, WebSearchService, uploadDocument, type WebResult } from "../web/webSearch.js";
import { ACTIVITY_WINDOWS, agentActivity, buildGraph, type ActivityWindow } from "./graph.js";
import { askCopilot } from "./copilot.js";
import { openExternal } from "./openExternal.js";
import { runtimeOptions, setRuntimeOptions } from "../orchestrator/runtimeOptions.js";
import { addContext, CONTEXT_CATEGORIES, deleteContext, getCopilotProfile, setAddress, updateContext, setAvatar, AVATAR_MAX } from "./copilotProfile.js";
import { libraryStats } from "./libraryStats.js";
import { troubleshoot } from "../quality/troubleshoot.js";
import { getRunReview, IMPROVEMENTS_KEY, recordRunReview, type Improvement } from "../quality/runReview.js";
import { governedRoute, listDecisions, logDecision } from "../governance/decisionLog.js";
import { modelPerformance } from "../models/modelPerformance.js";
import { libraryReport } from "../orchestrator/libraryUse.js";
import { draftScreenSpec, getScreenSpecs, saveScreenSpec, screenCoverage } from "../quality/screenCoverage.js";
import { rememberFirstEstimate, runActivity } from "./runActivity.js";
import { runFacts } from "./runFacts.js";
import { askJournal, projectJournal } from "../quality/journal.js";
import { buildStopReport, watchForStops } from "../quality/stopReport.js";
import { globalSearch } from "./search.js";
import { buildAnalysisMarkdown, buildAnalysisPdf, latestBuildAnalysis, markResolved, removeHistoryEntry, runBuildAnalysis } from "../quality/buildAnalysis.js";
import { deleteProject, editRequest, isManagedWorkspace, renameProject } from "../workspace/projectAdmin.js";
import { PromptLintError, previewPrompt, setLaunchNotes, addLaunchTask, editLaunchItem, launchMarkdown, launchReadiness, launchSummaries, LRC_STATUSES, removeLaunchItem, restoreLaunchItems, setLaunchFlag, setLaunchOverride, type LrcStatus } from "../quality/launchReadiness.js";
import { prototypePlan } from "../quality/prototypePlan.js";
import { timeseries, type Range } from "./metrics.js";
import { registerFlowReportRoutes } from "../flowReport/routes.js";
/** The hosted provider the cloud coder uses (Models page → Cloud coder). */
import { ANTHROPIC_PROVIDER, CLOUD_PROVIDERS, cloudProviderId, cloudCoder as cloudCoderOf } from "../models/cloud.js";
import { brandTrio, designDirection, type DesignDirection } from "../knowledge/designDirection.js";
import { FIX_TAG, fixToSkill } from "../knowledge/fixMemory.js";
import { MAX_MCP_TOOLS_PER_STEP, MCP_PRESETS, parseMcpJson, publicServer, type McpServerConfig } from "../mcp/manager.js";

type Handler = (ctx: { params: Record<string, string>; query: URLSearchParams; body: unknown; req: http.IncomingMessage; res: http.ServerResponse }) => Promise<unknown> | unknown;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ServerHandle {
  port: number;
  token: string;
  close(): Promise<void>;
}

export async function startServer(app: App, opts: { port?: number; token?: string; host?: string; onExitRequest?: (code: number) => void | Promise<void> } = {}): Promise<ServerHandle> {
  const token = opts.token ?? randomBytes(24).toString("hex");
  // After runs finish, look for repeated failures and draft skills for them (switched off until reviewed).
  watchForPatterns(app);
  // One model problem a day: the Researcher looks into one and suggests a fix (System Health → Model problems).
  watchProblems(app);
  // Notes the workspace whenever a build stops, so a retry can say which files were edited outside FlowCode.
  watchStops(app);
  // Says "First look ready" when a build's main screens are designed, before the feature steps.
  watchFirstLook(app);
  watchForStops(app);
  const routes: Array<{ method: string; re: RegExp; keys: string[]; h: Handler }> = [];
  const add = (spec: string, handler: Handler) => {
    // Decisions made through the API (settings, models, skills, run control…) go in the decision log after they succeed.
    const gov = governedRoute(spec);
    const h: Handler = gov
      ? async (ctx) => {
          const out = await handler(ctx);
          try {
            const runId = spec.includes("/runs/:id") ? ctx.params.id : undefined;
            const projectId = spec.includes("/projects/:id") ? ctx.params.id : runId ? app.store.runs.get(runId)?.projectId : undefined;
            logDecision(app, { kind: gov.kind, actor: "user", summary: gov.summary(ctx.params, ctx.body), ...(projectId ? { projectId } : {}), ...(runId ? { runId } : {}), ref: spec });
          } catch {
            // Logging never changes the outcome of the request.
          }
          return out;
        }
      : handler;
    const [method, pattern] = spec.split(" ");
    const keys: string[] = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_m, k) => (keys.push(k), "([^/]+)"))}$`);
    routes.push({ method, re, keys, h });
  };
  const R = C.API_ROUTES;
  const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
    const r = schema.safeParse(body);
    if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
    return r.data;
  };

  // ── health & settings
  add(R.health, async () => {
    const ollama = await app.router.provider("ollama").health();
    return { ok: true, version: "0.1.0", dataDirName: "FlowCode", providers: { ollama }, migrations: app.db.appliedMigrations().map((m) => m.name) };
  });
  // Can the Visual critic see images? (Its model, and whether that model has vision.) Used by Capture a style.
  add("GET /models/critic-vision", async ({ query }) => {
    const assignment = app.router.roleAssignments(query.get("projectId") ?? undefined).critic;
    if (!assignment) return { model: null, vision: false };
    try {
      const info = await app.router.provider(assignment.providerId).describe(assignment.model);
      return { model: assignment.model, vision: !!info?.capabilities?.includes("vision") };
    } catch {
      return { model: assignment.model, vision: false };
    }
  });
  add(R.settings, () => ({ retention: app.store.getSetting("retention", { snapshotsDays: 30, eventsDays: 90 }), projectDefaults: C.ProjectSettings.parse({ ...app.store.getSetting<Record<string, unknown>>("projectDefaults", {}), persistentApprovals: [] }), roleAssignments: app.router.roleAssignments() }));
  add(R.saveSettings, ({ body }) => {
    const b = parse(z.object({ retention: z.object({ snapshotsDays: z.number().int().min(1), eventsDays: z.number().int().min(1) }).optional(), projectDefaults: C.ProjectSettings.optional() }), body);
    if (b.retention) app.store.setSetting("retention", b.retention);
    if (b.projectDefaults) app.store.setSetting("projectDefaults", { ...b.projectDefaults, persistentApprovals: [] });
    return { ok: true };
  });
  // ── System page: health, controls, environment, AI engine, tools
  add("GET /system", () => systemHealth(app));
  add("GET /system/environment", () => environment(app));
  add("POST /system/environment/check", () => checkNetwork());
  add("GET /system/models", () => aiEngine(app));
  add("GET /system/tools", () => toolCatalog());
  // ── MCP servers (Prompts & Skills → Tools): connect, test, choose roles, remove. Keys are masked in every answer.
  const mcpView = (s: McpServerConfig) => ({ ...publicServer(s), status: app.mcp.status(s.id) });
  add("GET /mcp/servers", () => ({ servers: app.mcp.list().map(mcpView), presets: MCP_PRESETS, maxToolsPerStep: MAX_MCP_TOOLS_PER_STEP }));
  const McpServerBody = z.object({
    id: z.string().max(60).default(""),
    name: z.string().min(1).max(80),
    transport: z.enum(["stdio", "http"]),
    command: z.string().max(400).optional(),
    args: z.array(z.string().max(2000)).max(40).default([]),
    env: z.record(z.string(), z.string().max(4000)).optional(),
    url: z.string().max(2000).optional(),
    headers: z.record(z.string(), z.string().max(4000)).optional(),
    enabled: z.boolean().default(false),
    roles: z.array(z.string().max(40)).max(20).default(["coder"]),
    approval: z.enum(["ask", "allow"]).default("ask"),
    disabledTools: z.array(z.string().max(200)).max(200).default([]),
    preset: z.string().max(40).optional(),
    note: z.string().max(400).optional(),
  });
  add("POST /mcp/servers", ({ body }) => {
    try {
      return { server: mcpView(app.mcp.save(parse(McpServerBody, body) as McpServerConfig)) };
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("POST /mcp/import", ({ body }) => {
    const text = parse(z.object({ json: z.string().min(2).max(200_000) }), body).json;
    let found: McpServerConfig[];
    try {
      found = parseMcpJson(text);
    } catch {
      throw new HttpError(400, "That isn't valid JSON. Paste the whole mcp.json, starting with {.");
    }
    if (!found.length) throw new HttpError(400, 'No servers found. An mcp.json looks like { "mcpServers": { "name": { "command": "npx", "args": [...] } } }.');
    // Imported servers start switched off, so nothing runs until you've looked at them.
    return { servers: found.map((s) => mcpView(app.mcp.save({ ...s, id: app.mcp.get(s.id) ? `${s.id}-2` : s.id }))) };
  });
  add("POST /mcp/servers/:id/test", async ({ params }) => {
    if (!app.mcp.get(params.id)) throw new HttpError(404, "No such MCP server");
    await app.mcp.disconnect(params.id);
    return { status: await app.mcp.connect(params.id) };
  });
  add("POST /mcp/servers/:id/delete", ({ params }) => (app.mcp.remove(params.id), { ok: true }));
  // Times a FlowCode limit (not the app) stopped a build step twice (orchestrator noteFlowCodeLimit).
  // Each stuck step names the agent that got stuck: the role of its build step (coder, debugger…).
  add("GET /system/flowcode-limits", () => ({ hits: app.store.getSetting<Array<{ taskId: string }>>(FLOWCODE_LIMITS_KEY, []).map((h) => ({ ...h, role: (app.store.tasks.get(h.taskId) as { role?: string } | undefined)?.role })) }));
  add("POST /system/flowcode-limits/clear", () => (app.store.setSetting(FLOWCODE_LIMITS_KEY, []), { hits: [] }));
  add("POST /open-external", ({ body }) => openExternal(parse(z.object({ url: z.string().url().max(4000) }), body).url));
  add("GET /settings/runtime", () => runtimeOptions(app.store));
  add("POST /settings/runtime", ({ body }) => setRuntimeOptions(app.store, parse(z.object({ fastModel: z.object({ enabled: z.boolean().optional(), model: z.string().max(120).optional(), tries: z.number().int().min(1).max(3).optional() }).optional(), rollbackBlocked: z.boolean().optional(), autoRetry: z.boolean().optional() }), body) as never));
  add("GET /copilot/profile", () => getCopilotProfile(app));
  add("POST /copilot/profile", ({ body }) => setAddress(app, parse(z.object({ address: z.string().max(40) }), body).address));
  add("POST /copilot/avatar", ({ body }) => {
    const b = parse(z.object({ image: z.string().max(AVATAR_MAX).nullable() }), body);
    try {
      return setAvatar(app, b.image);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("POST /copilot/context", async ({ body }) => { const b = parse(z.object({ text: z.string().min(1).max(4000), category: z.enum(CONTEXT_CATEGORIES).optional() }), body); return addContext(app, b.text, b.category); });
  add("POST /copilot/context/:id", ({ params, body }) => updateContext(app, params.id, parse(z.object({ text: z.string().min(1).max(4000).optional(), category: z.enum(CONTEXT_CATEGORIES).optional() }), body)));
  add("POST /copilot/context/:id/delete", ({ params }) => deleteContext(app, params.id));
  // Copilot → FlowCode Builder: the user clicked Send on a change the Copilot drafted. Starts it as a follow-up of the project's latest run.
  add("POST /copilot/send-draft", ({ body }) => {
    const b = parse(z.object({ projectId: z.string(), objective: z.string().min(1).max(20_000) }), body);
    app.store.projects.require(b.projectId);
    const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", b.projectId)[0];
    const run = app.orchestrator.createRun({ projectId: b.projectId, objective: b.objective, constraints: [], attachedKnowledgeIds: [], ...(latest ? { parentRunId: latest.id, kind: "iterate" as const } : {}) });
    void app.orchestrator.plan(run.id).catch(() => undefined);
    return run;
  });
  // Whether a build is using the local model right now (the Copilot's question then waits its turn).
  add("GET /copilot/status", () => {
    const runs = app.orchestrator.activeRunIds().map((id) => app.store.runs.get(id)).filter((r) => !!r);
    return { busy: runs.length > 0, runs: runs.map((r) => ({ id: r.id, status: r.status, projectName: app.store.projects.get(r.projectId)?.name ?? "a project" })) };
  });
  add("POST /copilot/ask", ({ body }) =>
    askCopilot(
      app,
      parse(
        z.object({
          question: z.string().min(1).max(4000),
          explain: z.string().max(120).optional(),
          part: z.object({ name: z.string().min(1).max(120), kind: z.string().max(40), context: z.string().max(300).optional() }).optional(),
          route: z.string().max(300).default("/"),
          projectId: z.string().optional(),
          runId: z.string().optional(),
          history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20).default([]),
          /** Optional local model for Copilot; default is the documenter role's model. */
          model: z.string().regex(/^[\w.:\/-]{1,120}$/).optional(),
        }),
        body,
      ),
    ),
  );
  add("GET /metrics/timeseries", ({ query }) => timeseries(app, (["7d", "30d", "90d", "all"].includes(query.get("range") ?? "") ? query.get("range") : "30d") as Range));
  // Primitives page: design suggestions per UI component, kept in the local database.
  type Suggestion = { id: string; component: string; text: string; status: "open" | "done" | "dismissed"; createdAt: string; updatedAt: string; runId?: string; projectId?: string; runStatus?: string; progress?: { done: number; total: number; current?: string; phase?: string; paused?: boolean } };
  const suggestions = () => app.store.getSetting<Suggestion[]>("ui:suggestions", []);
  // A suggestion being applied by FlowCode reports its change's live status, and completes when that change is verified.
  add("GET /primitives/suggestions", () => {
    const all = suggestions();
    let changed = false;
    for (const s of all) {
      if (!s.runId) continue;
      const run = app.store.runs.get(s.runId);
      s.runStatus = run?.status;
      if (run) {
        const tasks = app.store.tasks.where("run_id = ?", run.id).sort((a, b) => a.ordinal - b.ordinal);
        const current = tasks.find((t) => ["running", "attempted", "awaiting_approval"].includes(t.status)) ?? tasks.find((t) => t.status === "pending");
        s.progress = { done: tasks.filter((t) => t.status === "verified").length, total: tasks.filter((t) => t.status !== "skipped").length, current: current?.title, phase: run.status === "draft" ? "Planning the change" : run.status === "verifying" ? "Checking the change" : undefined, paused: run.status === "running" && !app.orchestrator.isActive(run.id) && !app.orchestrator.isProbing(run.id) };
      }
      if (run && isFinishedRun(run.status) && s.status === "open") {
        s.status = "done";
        s.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) app.store.setSetting("ui:suggestions", all.map(({ runStatus: _r, progress: _p, ...x }) => x));
    return all;
  });
  add("POST /primitives/suggestions", ({ body }) => {
    const b = parse(z.object({ component: z.string().min(1).max(80), text: z.string().min(2).max(4000) }), body);
    const now = new Date().toISOString();
    const s: Suggestion = { id: `sug_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, component: b.component, text: redact(b.text), status: "open", createdAt: now, updatedAt: now };
    app.store.setSetting("ui:suggestions", [...suggestions(), s]);
    return s;
  });
  // Apply a suggestion with FlowCode itself: FlowCode's own UI source (apps/ui) is a governed, supervised project,
  // and the suggestion becomes a planned, verified, reversible change on it.
  add("POST /primitives/suggestions/:id/apply", async ({ params, body }) => {
    const b = parse(z.object({ componentName: z.string().max(120), file: z.string().max(200), usage: z.string().max(1000).optional() }), body);
    const all = suggestions();
    const s = all.find((x) => x.id === params.id);
    if (!s) throw new HttpError(404, "Suggestion not found");
    const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/ui");
    if (!fs.existsSync(path.join(uiRoot, "src")) || !fs.existsSync(path.join(uiRoot, "package.json"))) throw new HttpError(409, "FlowCode's UI source isn't available in this installation (packaged build), so FlowCode can't edit itself here.");
    let projectId = app.store.getSetting<string | null>("self:uiProjectId", null);
    if (!projectId || !app.store.projects.get(projectId)) {
      const p = app.projects.create({ name: "FlowCode UI", workspacePath: uiRoot });
      app.projects.updateSettings(p.id, { autonomy: "supervised" });
      projectId = p.id;
      app.store.setSetting("self:uiProjectId", projectId);
    }
    const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", projectId)[0];
    if (latest && !C.TERMINAL_RUN_STATUSES.includes(latest.status) && latest.status !== "blocked") throw new HttpError(409, "FlowCode is already changing its UI. Finish or cancel that change first.");
    const objective = [
      `Apply this design suggestion to FlowCode's own UI (React + CSS in src/).`,
      `Component: ${b.componentName} — implemented in ${b.file}.`,
      b.usage ? `What the component is for: ${b.usage}` : "",
      `Suggestion: "${s.text}"`,
      `Make the smallest change that satisfies the suggestion everywhere the component is used. Prefer design tokens (CSS custom properties such as --sig-ok for the positive teal) over hard-coded values.`,
    ]
      .filter(Boolean)
      .join("\n");
    const run = app.orchestrator.createRun({ projectId, objective: redact(objective), constraints: ["Change only files under src/.", "Do not change behaviour or data; this is a visual change.", "Keep light and dark themes working and text contrast at WCAG AA."], attachedKnowledgeIds: [], ...(latest ? { parentRunId: latest.id, kind: "iterate" as const } : {}) });
    void app.orchestrator.plan(run.id).catch(() => undefined);
    s.runId = run.id;
    s.projectId = projectId;
    s.updatedAt = new Date().toISOString();
    app.store.setSetting("ui:suggestions", all);
    return { suggestion: s, run, projectId };
  });
  add("POST /primitives/suggestions/:id/delete", ({ params }) => {
    const all = suggestions();
    const s = all.find((x) => x.id === params.id);
    if (!s) throw new HttpError(404, "Suggestion not found");
    app.store.setSetting("ui:suggestions", all.filter((x) => x.id !== params.id));
    return { deleted: params.id };
  });
  add("POST /primitives/suggestions/:id", ({ params, body }) => {
    const b = parse(z.object({ status: z.enum(["open", "done", "dismissed"]) }), body);
    const all = suggestions();
    const s = all.find((x) => x.id === params.id);
    if (!s) throw new HttpError(404, "Suggestion not found");
    s.status = b.status;
    s.updatedAt = new Date().toISOString();
    app.store.setSetting("ui:suggestions", all);
    return s;
  });
  // Launch Readiness Checklist (for building the real app): tailored per project and derived from evidence on every read;
  // user state persists.
  add("GET /projects/:id/launch", ({ params }) => launchReadiness(app, params.id));
  add("GET /launch/summary", () => launchSummaries(app));
  add("GET /projects/:id/launch/markdown", async ({ params }) => launchMarkdown(await launchReadiness(app, params.id)));
  // The prototype plan a spec build follows: its steps with live status, requirements and acceptance tests.
  add("GET /projects/:id/plan", ({ params }) => prototypePlan(app, params.id));
  const Severity = z.enum(["critical", "high"]);
  const Priority = z.enum(["low", "medium", "high", "critical"]);
  const Kind = z.enum(["code", "manual", "review", "task"]);
  // A stored prompt that misses the standard is refused with every problem listed, and nothing is saved.
  const lintSafe = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof PromptLintError) throw new HttpError(400, e.message);
      throw e;
    }
  };
  add("POST /projects/:id/launch/tasks", ({ params, body }) => {
    const b = parse(z.object({ categoryId: z.string().max(80).optional(), title: z.string().min(2).max(300), detail: z.string().max(4000).optional(), gate: z.boolean().optional(), severity: Severity.optional(), priority: Priority.optional(), kind: Kind.optional(), aiPrompt: z.string().max(12_000).optional() }), body);
    lintSafe(() => addLaunchTask(app, params.id, { ...b, title: redact(b.title), detail: b.detail ? redact(b.detail) : undefined, aiPrompt: b.aiPrompt !== undefined ? redact(b.aiPrompt) : undefined }));
    return launchReadiness(app, params.id);
  });
  add("POST /projects/:id/launch/prompt-preview", ({ params, body }) => {
    const b = parse(z.object({ title: z.string().min(1).max(300), detail: z.string().max(4000).optional(), kind: Kind, gate: z.boolean().optional(), categoryId: z.string().max(80).optional() }), body);
    return { prompt: previewPrompt(app, params.id, b) };
  });
  add("POST /projects/:id/launch/items/:item", async ({ params, body }) => {
    const b = parse(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("status"), status: z.enum(LRC_STATUSES as [LrcStatus, ...LrcStatus[]]).nullable() }),
        z.object({ action: z.literal("flag"), flagged: z.boolean() }),
        z.object({ action: z.literal("edit"), title: z.string().min(2).max(300).optional(), detail: z.string().max(4000).optional(), severity: Severity.nullable().optional(), priority: Priority.optional(), gate: z.boolean().optional(), kind: Kind.optional(), aiPrompt: z.string().max(12_000).optional() }),
        z.object({ action: z.literal("notes"), notes: z.string().max(8000) }),
        z.object({ action: z.literal("remove") }),
        z.object({ action: z.literal("restore"), ids: z.array(z.string().max(200)).max(200) }),
      ]),
      body,
    );
    if (b.action === "status") setLaunchOverride(app, params.id, params.item, b.status);
    else if (b.action === "flag") setLaunchFlag(app, params.id, params.item, b.flagged);
    else if (b.action === "edit") {
      const categoryId = b.aiPrompt !== undefined ? (await launchReadiness(app, params.id)).categories.find((c) => c.items.some((i) => i.id === params.item))?.id : undefined;
      const { action: _a, ...edit } = b;
      lintSafe(() => editLaunchItem(app, params.id, params.item, { ...edit, title: b.title ? redact(b.title) : undefined, detail: b.detail !== undefined ? redact(b.detail) : undefined, aiPrompt: b.aiPrompt !== undefined ? redact(b.aiPrompt) : undefined }, categoryId));
    } else if (b.action === "notes") setLaunchNotes(app, params.id, params.item, redact(b.notes));
    else if (b.action === "remove") removeLaunchItem(app, params.id, params.item);
    else restoreLaunchItems(app, params.id, b.ids);
    return launchReadiness(app, params.id);
  });
  // Build analysis: repository-report-style findings with Claude Code prompts, PDF/Markdown export.
  add("POST /projects/:id/build-analysis", ({ params }) => runBuildAnalysis(app, params.id));
  add("GET /projects/:id/build-analysis", ({ params }) => ({ report: latestBuildAnalysis(app, params.id) ?? null }));
  add("POST /projects/:id/build-analysis/resolve", ({ params, body }) => {
    const b = parse(z.object({ key: z.string().max(200), resolved: z.boolean() }), body);
    return markResolved(app, params.id, b.key, b.resolved);
  });
  add("POST /projects/:id/build-analysis/history/remove", ({ params, body }) => removeHistoryEntry(app, params.id, parse(z.object({ at: z.string().max(40) }), body).at) ?? null);
  add("POST /projects/:id/build-analysis/pdf", ({ params }) => buildAnalysisPdf(app, params.id));
  add("GET /projects/:id/build-analysis/markdown", ({ params }) => {
    const r = latestBuildAnalysis(app, params.id);
    if (!r) throw new HttpError(404, "Run Build analysis first");
    return { markdown: buildAnalysisMarkdown(r), filename: `${r.projectName.replace(/[^\w-]+/g, "-")}-build-analysis-${r.generatedAt.slice(0, 10)}.md` };
  });
  // Choosing a folder by browsing it (Repo Report, New build): folder names only, never file contents.
  add("GET /system/folders", ({ query }) => {
    try {
      return browseFolder(query.get("path") ?? undefined);
    } catch (e) {
      throw new HttpError((e as { status?: number }).status ?? 403, (e as { status?: number }).status ? (e as Error).message : `That folder couldn't be read: ${(e as Error).message}`);
    }
  });
  add("GET /system/folders/roots", () => ({ roots: folderRoots() }));
  // Repo Report: projects, runs, findings, responses, downloads and live progress, under /flow-reports/*.
  registerFlowReportRoutes(add, { store: app.flowReports, manager: app.flowReportJobs, processes: app.processes });
  // Theme overrides edited on Primitives → Attributes (CSS custom properties; colours per theme).
  const ThemeBucket = z.record(z.string().regex(/^--[\w-]{1,60}$/), z.string().max(120).regex(/^[^;{}<>]*$/));
  add("GET /ui/theme", () => app.store.getSetting("ui:theme", null));
  add("POST /ui/theme", ({ body }) => {
    const t = parse(z.object({ all: ThemeBucket, light: ThemeBucket, dark: ThemeBucket }), body);
    app.store.setSetting("ui:theme", t);
    return t;
  });
  add("GET /search", ({ query }) => globalSearch(app, query.get("q") ?? "", query.get("projectId") || undefined));
  add("GET /graph", ({ query }) => buildGraph(app, query.get("projectId") || undefined));
  add("GET /agents/activity", ({ query }) => agentActivity(app, ACTIVITY_WINDOWS.includes(query.get("window") as ActivityWindow) ? (query.get("window") as ActivityWindow) : "24h"));
  add("POST /system/scheduler", ({ body }) => {
    const { paused } = parse(z.object({ paused: z.boolean() }), body);
    app.orchestrator.setPaused(paused);
    return { paused };
  });
  // Restart/stop are executed by the parent shell: the daemon cleans up owned processes and exits with a
  // code the desktop shell understands (75 = restart me, 76 = stopped by user).
  add("POST /system/restart", () => {
    setTimeout(() => void opts.onExitRequest?.(75), 150);
    return { restarting: true };
  });
  add("POST /system/stop", () => {
    setTimeout(() => void opts.onExitRequest?.(76), 150);
    return { stopping: true };
  });
  add(R.diagnostics, () => ({
    processes: app.store.processes.list("created_at DESC", 100),
    modelFailures: app.bus.list({ types: ["model.failed", "model.retry_scheduled"], limit: 100 }).slice(-100),
    policyRejections: app.bus.list({ types: ["policy.rejected", "tool.rejected"], limit: 200 }).slice(-100),
    commandFailures: app.store.commands.where("status IN ('failed','timed_out','blocked') ORDER BY created_at DESC LIMIT 100"),
    cleanup: app.bus.list({ types: ["process.cleanup"], limit: 100 }).slice(-50),
  }));

  // ── projects & workspace
  // A project's latest build: one that is working wins (a resumed build stays current even when a newer, cancelled
  // attempt exists), otherwise the most recent.
  add(R.listProjects, () =>
    app.store.projects.list("updated_at DESC").map((p) => {
      const recent = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 20", p.id);
      const working = recent.find((r) => ["draft", "running", "verifying", "recovering", "awaiting_approval"].includes(r.status));
      return { ...p, latestRun: working ?? recent[0] };
    }),
  );
  add(R.createProject, ({ body }) => app.projects.create(parse(C.CreateProjectInput, body)));
  add(R.getProject, ({ params }) => {
    const p = app.store.projects.require(params.id);
    return { project: p, preflight: app.projects.latestPreflight(p.id), runs: app.store.runs.where("project_id = ? ORDER BY created_at DESC", p.id), workspaceName: app.projects.jail(p).root.split(/[\\/]/).pop() };
  });
  add("POST /projects/:id/rename", ({ params, body }) => renameProject(app, params.id, redact(parse(z.object({ name: z.string().trim().min(1).max(200) }), body).name)));
  // The extras this project's builds were asked for (New build → Look and feel, or later from the Design tab).
  add("GET /projects/:id/extras", ({ params }) => {
    const asked = new Set<string>();
    for (const r of app.store.runs.where("project_id = ?", params.id)) for (const x of app.store.getSetting<{ extras?: string[] } | undefined>(`runLook:${r.id}`, undefined)?.extras ?? []) asked.add(x);
    return { asked: [...asked] };
  });
  add("GET /projects/:id/admin", ({ params }) => ({ managedWorkspace: isManagedWorkspace(app, params.id), runs: app.store.runs.where("project_id = ?", params.id).length }));
  add("POST /projects/:id/delete", ({ params, body }) => {
    const b = parse(z.object({ deleteFiles: z.boolean().optional(), confirmName: z.string() }), body);
    // Destructive: the caller must echo the project's exact name.
    if (b.confirmName.trim() !== app.store.projects.require(params.id).name.trim()) throw new HttpError(400, "Type the project's name exactly to confirm deletion");
    return deleteProject(app, params.id, { deleteFiles: b.deleteFiles });
  });
  add("POST /runs/:id/objective", ({ params, body }) => editRequest(app, params.id, redact(parse(z.object({ objective: z.string().trim().min(3).max(60_000) }), body).objective)));
  add(R.selectWorkspace, ({ params, body }) => app.projects.selectWorkspace(params.id, parse(z.object({ workspacePath: z.string().min(1) }), body).workspacePath));
  // Only the settings sent change. The partial schema still fills defaults for the rest, and those used to overwrite the
  // project's real values (turning on external research switched hosted models off and autonomy back to supervised).
  add(R.updateProjectSettings, ({ params, body }) => {
    const parsed = parse(C.ProjectSettings.partial(), body) as Record<string, unknown>;
    const sent = new Set(Object.keys((body ?? {}) as Record<string, unknown>));
    return app.projects.updateSettings(params.id, Object.fromEntries(Object.entries(parsed).filter(([k]) => sent.has(k))));
  });
  add(R.preflight, ({ params }) => app.projects.preflight(params.id));
  add(R.projectFiles, ({ params, query }) => listTree(app.projects.jail(params.id), query.get("path") ?? ".", Number(query.get("depth") ?? 4)));
  add(R.projectFile, ({ params, query }) => readFile(app.projects.jail(params.id), query.get("path") ?? ""));
  // Styles tab: the project's design tokens (CSS custom properties), editable with snapshot + undo.
  add("GET /projects/:id/styles", ({ params }) => scanStyles(app.projects.jail(params.id)));
  // Reusable parts (CSS class families with samples, React components) for the Styles tab's visual style sheet.
  // Where a run's time went: model (load / prompt / writing), commands, file tools and checks.
  add("GET /runs/:id/performance", ({ params }) => runPerformance(app, params.id));
  // Which component library pieces this build used, who chose each, and whether it reached a screen.
  // The PRD and text files a build was started from, so it can be started over from the same spec (New build, prefilled).
  add("GET /runs/:id/references", ({ params }) => {
    const run = app.store.runs.require(params.id);
    const refs = app.store.getSetting<Array<{ name: string; role: string; content: string }>>(`runRefs:${run.id}`, []);
    return { objective: run.objective, references: refs.filter((r) => r.role === "prd" || r.role === "text").map((r) => ({ name: r.name, role: r.role, content: r.content })) };
  });
  add("GET /runs/:id/library", ({ params }) => {
    const run = app.store.runs.require(params.id);
    return { pieces: libraryReport(app.store, app.projects.jail(run.projectId), run.id) };
  });
  // Which model did what in this build, and what left this computer (from its recorded model calls).
  add("GET /runs/:id/models", ({ params }) => runModels(app, params.id));
  // The Copilot's first draft for a form, from the person's idea (local model; nothing is saved here).
  add("POST /copilot/draft", ({ body }) => {
    const b = parse(z.object({ kind: DraftKind, idea: z.string().min(3).max(4000) }), body);
    return copilotDraft(app, b.kind, b.idea);
  });
  // Which screens a build's changes affect, with before and after screenshots.
  add("GET /runs/:id/impact", ({ params }) => changeImpact(app, params.id));
  // A suggested next step at a blocker, only when this computer's history of similar stops supports one.
  add("GET /runs/:id/tasks/:taskId/advice", ({ params }) => blockerAdvice(app, params.id, params.taskId));
  // Files changed outside FlowCode since its last build on this project stopped.
  add("GET /runs/:id/external-changes", ({ params }) => externalChanges(app, params.id));
  // A step's (or the whole build's) changes as a unified diff, for `git apply` in your own repository.
  // Two builds side by side: outcome, models, time, tries, checks and changes (from their records; nothing ranked).
  add("GET /runs/compare", ({ query }) => {
    const a = query.get("a");
    const b = query.get("b");
    if (!a || !b) throw new HttpError(400, "Pick two builds to compare.");
    return compareRuns(app, a, b);
  });
  add("GET /runs/:id/patch", ({ params, query }) => stepPatch(app, params.id, query.get("taskId") ?? undefined));
  add("GET /projects/:id/components", ({ params }) => scanComponentLibrary(app.projects.jail(params.id)));
  add("POST /projects/:id/styles", ({ params, body }) => {
    const b = parse(z.object({ file: z.string().max(500), name: z.string().regex(/^--[\w-]+$/), selector: z.string().max(2000), expected: z.string().max(2000), value: z.string().max(400) }), body);
    try {
      return editStyleToken(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  // Styles tab → Surface: the app's surface style (vibe), and switching it (snapshotted, so it can be undone).
  add("GET /projects/:id/styles/surface", ({ params }) => surfaceStyleOf(app.projects.jail(params.id)));
  add("POST /projects/:id/styles/surface", ({ params, body }) => {
    const b = parse(z.object({ vibe: z.string().max(40) }), body);
    try {
      return setSurfaceStyle(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b.vibe);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  // Styles → the design option this app uses: one of the visual styles (picked by you, or applied by FlowCode on New
  // build) or Custom (captured, edited by hand, or set from the PRD). Picking a style writes its colours, fonts and
  // corners into the tokens (snapshotted, so it can be undone).
  const markCustomDesign = (projectId: string) => app.store.setSetting(`designChoice:${projectId}`, { id: "custom", by: "you", at: new Date().toISOString() });
  add("GET /projects/:id/design/choice", ({ params }) => app.store.getSetting(`designChoice:${params.id}`, { id: "custom" }));
  add("POST /projects/:id/design/choice", ({ params, body }) => {
    const b = parse(z.object({ id: z.string().max(60) }), body);
    const record = { id: b.id, by: "you", at: new Date().toISOString() };
    if (b.id === "custom") return (app.store.setSetting(`designChoice:${params.id}`, record), { ...record, changed: [] });
    const t = designTemplate(b.id);
    if (!t) throw new HttpError(400, `Unknown design style "${b.id}"`);
    const c = t.colors;
    const values: Record<string, string> = {
      "--color-bg": c.bg, "--color-surface": c.surface, "--color-surface-sunken": c.surfaceSunken, "--color-text": c.text, "--color-text-muted": c.textMuted,
      "--color-border": c.border, "--color-border-strong": c.borderStrong, "--color-accent": c.accent, "--color-accent-hover": c.accentHover, "--color-on-accent": c.onAccent,
      "--color-focus": c.focus, "--color-success": c.success, "--color-danger": c.danger, "--color-danger-surface": c.dangerSurface,
      "--font-sans": t.fonts.sans, "--font-display": t.fonts.display,
      "--radius-sm": `${t.radii[0]}px`, "--radius-md": `${t.radii[1]}px`, "--radius-lg": `${t.radii[2]}px`, "--radius-xl": `${t.radii[3]}px`,
    };
    try {
      const out = applyDesign(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, { theme: "default", values });
      app.store.setSetting(`designChoice:${params.id}`, record);
      return { ...record, changed: out.changed };
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  // Styles → Design: several token values for one theme in one write (plus the web fonts to load), and the
  // building blocks picked for the app.
  add("POST /projects/:id/design", ({ params, body }) => {
    const b = parse(z.object({ theme: z.enum(["default", "dark"]), values: z.record(z.string(), z.string().max(400)), googleFonts: z.array(z.string().max(40)).max(6).optional() }), body);
    try {
      const out = applyDesign(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b);
      if (out.changed.length) markCustomDesign(params.id);
      return out;
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  // Styles → Design → Colours: the palette (saved, or started from the app's accent) and saving it.
  add("GET /projects/:id/design/palette", ({ params }) => paletteOf(app.projects.jail(params.id)));
  add("POST /projects/:id/design/palette", ({ params, body }) => {
    const hex = z.string().regex(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/);
    const b = parse(
      z.object({
        brand: z.array(z.object({ hex, name: z.string().max(40).optional(), role: z.enum(["primary", "secondary", "tertiary", "accent-1", "accent-2"]) })).min(1).max(5),
        neutral: z.enum(["brand", "warm", "cool", "pure"]).optional(),
        status: z.object({ success: hex.optional(), warning: hex.optional(), error: hex.optional(), info: hex.optional() }).optional(),
      }),
      body,
    );
    try {
      const out = applyPalette(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b);
      if (out.changed.length) markCustomDesign(params.id);
      return out;
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  // Styles → Capture a style (CSSVibes): from a website and/or images, CSS or HTML, applied as Styles edits (undoable).
  add("GET /projects/:id/design/capture", ({ params }) => ({ last: app.store.getSetting(`styleCapture:${params.id}`, null) }));
  add("POST /projects/:id/design/capture", async ({ params, body }) => {
    const b = parse(
      z.object({
        url: z.string().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Use an http or https address").optional(),
        files: z.array(z.object({ name: z.string().min(1).max(200), role: z.enum(["image", "html", "css"]), content: z.string().max(2_000_000) })).max(8).default([]),
      }),
      body,
    );
    if (!b.url && !b.files.length) throw new HttpError(400, "Give a website address or attach an image, CSS or HTML file.");
    const runId = STYLE_EDIT_RUN(params.id);
    const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", params.id)[0];
    const vision = latest?.modelAssignments.critic ?? latest?.modelAssignments.planner ?? app.router.roleAssignments(params.id).critic;
    const { style, notes } = await captureStyle({ router: app.router, launchBrowser: () => BrowserSession.launch(runId, app.processes) }, { url: b.url, files: b.files, vision }, { projectId: params.id, runId });
    // Up to three brand colours, as a build sets them: the captured ones, then companions of the main colour.
    if (style.brand.length) style.brand = brandTrio(style.brand, app.store.getSetting<DesignDirection | null>(`designDirection:${params.id}`, null) ?? designDirection(latest?.objective ?? ""));
    // Colours FlowCode added to complete the set came from no source: say so, rather than crediting one.
    for (const hex of style.brand) if (!style.origins?.some((o) => o.value.toLowerCase() === hex.toLowerCase())) style.origins?.push({ what: "Companion colour", value: hex, from: "Chosen by FlowCode to go with your main colour" });
    let applied: string[] = [];
    try {
      applied = applyCapturedStyle(app.projects.jail(params.id), app.ops, { projectId: params.id, runId }, style);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const last = { at: new Date().toISOString(), sources: style.sources, applied, notes, style, origins: style.origins ?? [] };
    app.store.setSetting(`styleCapture:${params.id}`, last);
    markCustomDesign(params.id);
    return last;
  });
  // A component's Configure: its saved choices, and saving them (CSS written into components.css).
  add("GET /projects/:id/design/component-styles", ({ params }) => componentStylesOf(app.projects.jail(params.id)));
  add("POST /projects/:id/design/component-styles", ({ params, body }) => {
    const b = parse(z.object({ block: z.string().regex(/^ui-[a-z-]+$/), values: z.record(z.string(), z.string().max(40)) }), body);
    try {
      return applyComponentStyle(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b.block, b.values);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("GET /projects/:id/design/components", ({ params }) => designComponents(app.projects.jail(params.id)));
  add("POST /projects/:id/design/components", ({ params, body }) => {
    const b = parse(z.object({ components: z.array(z.string().max(60)).max(60) }), body);
    return setDesignComponents(app.projects.jail(params.id), b.components);
  });
  add("POST /projects/:id/styles/font-size", ({ params, body }) => {
    const b = parse(z.object({ file: z.string().max(500), selector: z.string().max(2000), expected: z.string().max(100), value: z.string().max(40) }), body);
    try {
      return editFixedFontSize(app.projects.jail(params.id), app.ops, { projectId: params.id, runId: STYLE_EDIT_RUN(params.id) }, b);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add(R.projectSearch, ({ params, query }) => searchWorkspace(app.projects.jail(params.id), query.get("q") ?? "", { glob: query.get("glob") ?? undefined }));
  add(R.projectGit, ({ params }) => gitStatus(app.projects.jail(params.id)));
  // Phase 8: Git workflow with commit approval. Stages and commits through the governed runner; both
  // commands are "ask" tier, so the user sees exact argv in approval cards. Push stays forbidden.
  add("POST /projects/:id/git/commit", async ({ params, body }) => {
    const { message } = parse(z.object({ message: z.string().min(3).max(500) }), body);
    const project = app.store.projects.require(params.id);
    const jail = app.projects.jail(project);
    const status = await gitStatus(jail);
    if (!status.available) throw new HttpError(409, "This workspace is not a git repository");
    if (!status.changes.length) throw new HttpError(409, "Nothing to commit");
    const runId = `git_${project.id}`;
    // User-initiated: an explicit click is an override of earlier identical failures (FR-C4).
    const common = { jail, projectId: project.id, runId, phase: "git", preflight: app.projects.latestPreflight(project.id), overrideNoProgress: true };
    const add = await app.runner.run({ ...common, argv: ["git", "add", "--all"], reason: `Stage ${status.changes.length} change(s) for commit` });
    if (add.record.status !== "succeeded") return { status: add.record.status, step: "add" };
    const commit = await app.runner.run({ ...common, argv: ["git", "commit", "-m", message], reason: "Commit staged changes" });
    return { status: commit.record.status, step: "commit", output: commit.output.slice(-2000) };
  });
  add("GET /projects/:id/repository-map", ({ params }) => {
    const map = repositoryMap(app.projects.jail(params.id));
    return { map, markdown: renderRepositoryMap(map) };
  });
  add("GET /projects/:id/intelligence", ({ params }) => ({ markdown: app.verifier.reports.repositoryIntelligence(params.id) }));
  add(R.qualityRun, ({ params }) => app.verifier.qualityScan(params.id));

  // ── live preview (owned dev server per project, MVP DoD #9)
  const previews = new Map<string, { procId: string; url: string; commandId: string }>();
  add("GET /projects/:id/preview", ({ params }) => {
    const p = previews.get(params.id);
    if (p && !app.processes.liveForRun(`preview_${params.id}`).length) previews.delete(params.id);
    return previews.get(params.id) ?? null;
  });
  // Point-and-say: a fresh screenshot of the running app, or what's at the spot the person clicked on it.
  add("POST /projects/:id/point", async ({ params, body }) => {
    const b = parse(z.object({ size: z.enum(["phone", "tablet", "desktop"]).default("desktop"), x: z.number().min(0).max(20_000).optional(), y: z.number().min(0).max(200_000).optional(), path: z.string().max(300).optional() }), body ?? {});
    const p = previews.get(params.id);
    if (!p || !app.processes.liveForRun(`preview_${params.id}`).length) throw new HttpError(409, "Start the preview first: FlowCode looks at the running app.");
    return pointAt(app, params.id, p.url, b.size, b.x !== undefined && b.y !== undefined ? { x: b.x, y: b.y, path: b.path } : undefined);
  });
  add("POST /projects/:id/preview/start", async ({ params }) => {
    const existing = previews.get(params.id);
    if (existing && app.processes.liveForRun(`preview_${params.id}`).length) return existing;
    const project = app.store.projects.require(params.id);
    const pf = app.projects.preflight(project.id);
    if (!pf.hasNodeModules) throw new HttpError(409, "Dependencies are not installed; run the build (with an approved install) first.");
    if (pf.previewStrategy === "none") throw new HttpError(409, "No preview strategy detected for this project.");
    const { freePort } = await import("../quality/preview.js");
    const port = await freePort();
    const argv = previewArgv(pf, port);
    const res = await app.runner.run({
      jail: app.projects.jail(project),
      projectId: project.id,
      runId: `preview_${project.id}`,
      phase: "preview",
      argv,
      reason: "Live preview requested from the workspace",
      preflight: pf,
      overrideNoProgress: true,
      server: { readyPattern: /(Local:\s+https?:\/\/|ready in|started server on|Listening on)/i, readyTimeoutMs: 60_000 },
    });
    if (res.record.status === "awaiting_approval") return { awaitingApproval: res.record.approvalId };
    if (!res.serverProcId) throw new HttpError(500, `Preview server did not start (${res.record.status})`);
    const entry = { procId: res.serverProcId, url: res.serverUrl ?? `http://127.0.0.1:${port}/`, commandId: res.record.id };
    previews.set(project.id, entry);
    app.bus.emit({ type: "preview.ready", projectId: project.id, message: `Live preview running at ${entry.url}`, data: { url: entry.url } });
    return entry;
  });
  // Export the prototype as a folder to host yourself (built here, copied to FlowCode's exports folder; nothing uploaded).
  add("POST /projects/:id/export", ({ params }) => exportSite(app, params.id));
  add("POST /projects/:id/preview/stop", async ({ params }) => {
    const r = await app.processes.cleanupRun(`preview_${params.id}`, "preview stopped");
    previews.delete(params.id);
    return r;
  });

  // ── runs
  add(R.listRuns, ({ query }) => (query.get("projectId") ? app.store.runs.where("project_id = ? ORDER BY created_at DESC", query.get("projectId")) : app.store.runs.list()));
  add(R.createRun, async ({ body }) => {
    let input = parse(C.CreateRunInput, body);
    // D7: who writes this one change. "cloud" (the chat's "Use the cloud for this change", ticked) is the consent for this
    // change only; "local" pins it to the local models even when an earlier build of the project used the cloud
    // (a follow-up otherwise copies its parent's models).
    const { coder } = parse(z.object({ coder: z.enum(["local", "cloud"]).optional() }).passthrough(), body ?? {});
    if (coder === "cloud") {
      const cloud = cloudCoder();
      if (!cloud.ready) throw new HttpError(409, `The cloud model isn't ready: ${cloud.problem}. Set it up on the Models page, or leave the box unticked.`);
      app.projects.updateSettings(input.projectId, { allowHostedModels: true });
      input = { ...input, modelAssignments: { ...input.modelAssignments, planner: { ...cloud.assignment, temperature: 0.2 }, coder: cloud.assignment, debugger: cloud.assignment } };
    } else if (coder === "local") {
      const local = app.router.roleAssignments(input.projectId);
      input = { ...input, modelAssignments: { ...input.modelAssignments, planner: local.planner, coder: local.coder, debugger: local.debugger } };
    }
    const run = app.orchestrator.createRun(input);
    void app.orchestrator.plan(run.id).catch(() => undefined);
    return run;
  });
  add(R.getRun, ({ params }) => runView(app, params.id));
  // "New build": a project and a spec-driven run in one step (description + optional PRD/HTML/CSS/JSON).
  /** The cloud coder's setup, and whether a build can use it (the API key itself is never read back or stored). */
  const cloudCoder = () => cloudCoderOf(app.router, app.store);
  add("POST /builds", async ({ body }) => {
    const b = parse(
      z.object({
        description: z.string().min(1).max(20_000),
        name: z.string().max(200).optional(),
        workspacePath: z.string().optional(),
        references: z.array(C.ReferenceFile).max(20).default([]),
        autonomy: z.enum(["supervised", "assisted", "autonomous"]).default("supervised"),
        /** Starter for an empty folder: React + Vite (default) or Angular. */
        starter: z.enum(["react", "angular"]).default("react"),
        /** Who writes the code: the local coder model (default) or the cloud coder set up on the Models page. */
        coder: z.enum(["local", "cloud"]).default("local"),
        /** New build → Look and feel: a visual style (when the PRD sets none) and extras to build. */
        look: z
          .object({
            template: z.string().refine((id) => C.DESIGN_TEMPLATES.some((t) => t.id === id), "Unknown visual style").optional(),
            vibe: z.string().refine((id) => C.STYLE_VIBES.some((v) => v.id === id), "Unknown surface style").optional(),
            extras: z.array(z.string().refine((id) => C.BUILD_EXTRAS.some((x) => x.id === id), "Unknown extra")).max(20).default([]),
            /** A website to capture the style from (CSSVibes style capture). */
            styleUrl: z.string().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Use an http or https address").optional(),
          })
          .optional(),
      }),
      body,
    );
    const total = b.references.reduce((n, r) => n + r.content.length, 0);
    if (total > 6_000_000) throw new HttpError(413, "References are larger than 6 MB in total");
    const cloud = b.coder === "cloud" ? cloudCoder() : undefined;
    if (cloud && !cloud.ready) throw new HttpError(409, `The cloud coder isn't ready: ${cloud.problem}. Set it up on the Models page, or build with the local coder.`);
    const quality = C.scoreRequest(b.description, b.references.map((r) => r.role));
    const project = app.projects.create({ name: b.name?.trim() || C.suggestName(b.description) || "New build", workspacePath: b.workspacePath, createWorkspace: true });
    // Choosing the cloud coder for this build is the consent to send this project's code to that provider. Local means
    // local for every step, design and the design review included (VUS-01: "code stays here" has to be true).
    app.projects.updateSettings(project.id, { autonomy: b.autonomy, ...(cloud ? { allowHostedModels: true } : {}) });
    const pf = app.projects.preflight(project.id);
    const empty = pf.projectType === "incomplete" || pf.projectType === "unknown";
    const run = app.orchestrator.createRun({ projectId: project.id, objective: b.description, kind: empty ? "spec_build" : undefined, ...(empty && b.starter === "angular" ? { templateId: "angular-starter" } : {}), references: b.references, constraints: [], attachedKnowledgeIds: [], ...(cloud ? { modelAssignments: { planner: { ...cloud.assignment, temperature: 0.2 }, coder: cloud.assignment, debugger: cloud.assignment } } : {}) });
    if (b.look) app.store.setSetting(`runLook:${run.id}`, b.look);
    void app.orchestrator.plan(run.id).catch(() => undefined);
    return { project, run, quality };
  });
  add("POST /requests/score", ({ body }) => {
    const b = parse(z.object({ description: z.string().max(20_000), roles: z.array(z.string()).default([]) }), body);
    return { ...C.scoreRequest(b.description, b.roles), suggestedName: C.suggestName(b.description) };
  });
  add(R.approvePlan, ({ params }) => app.orchestrator.approvePlan(params.id));
  add(R.startRun, ({ params }) => app.orchestrator.start(params.id));
  // Cancelling always records why (the builder sends "you stopped it"; scripts and FlowCode itself say what they did).
  add(R.cancelRun, ({ params, body }) => app.orchestrator.cancel(params.id, parse(z.object({ reason: z.string().max(500).optional() }), body ?? {}).reason));
  add(R.resumeRun, ({ params }) => app.orchestrator.resume(params.id));
  // Pause a build between steps (the step in progress finishes), and continue it.
  // Who writes the code for the rest of a build: the cloud model (Models page) or the local coder. Choosing the cloud
  // is the consent to send this project's code to that provider, so the project allows hosted models from then on.
  add("POST /runs/:id/coder", ({ params, body }) => {
    const { coder } = parse(z.object({ coder: z.enum(["cloud", "local"]) }), body);
    const run = app.store.runs.require(params.id);
    let next: C.Run["modelAssignments"];
    if (coder === "cloud") {
      const cloud = cloudCoder();
      if (!cloud.ready) throw new HttpError(409, `The cloud model isn't ready: ${cloud.problem}. Set it up on the Models page.`);
      next = { ...run.modelAssignments, coder: cloud.assignment, debugger: cloud.assignment };
      app.projects.updateSettings(run.projectId, { allowHostedModels: true });
    } else {
      const local = app.router.roleAssignments(run.projectId);
      next = { ...run.modelAssignments, coder: local.coder, debugger: local.debugger };
    }
    const updated = app.store.runs.upsert({ ...run, modelAssignments: next });
    app.bus.emit({ type: "run.status_changed", projectId: run.projectId, runId: run.id, message: `The rest of this build is coded by ${next.coder?.model} (${coder === "cloud" ? "cloud model" : "local coder"}), as you chose` });
    return updated;
  });
  add("POST /runs/:id/pause", ({ params }) => app.orchestrator.pauseRun(params.id, true));
  add("POST /runs/:id/unpause", ({ params }) => app.orchestrator.pauseRun(params.id, false));
  // Re-run one check from the signal strip (not while the run is working).
  const rerunning = new Set<string>();
  add("POST /runs/:id/checks/:kind/rerun", async ({ params }) => {
    const run = app.store.runs.require(params.id);
    const kind = C.VerificationKind.safeParse(params.kind);
    if (!kind.success) throw new HttpError(400, "Unknown check");
    if (app.orchestrator.isActive(run.id)) throw new HttpError(409, "The run is working right now. Re-run checks once it's paused or finished.");
    const key = `${run.id}:${kind.data}`;
    if (rerunning.has(key)) throw new HttpError(409, "That check is already re-running");
    rerunning.add(key);
    try {
      const kinds = await app.verifier.rerunCheck(run, kind.data);
      return { rerun: kinds, checks: app.store.checks.where("run_id = ?", run.id).filter((c) => !c.taskId && kinds.includes(c.kind)) };
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    } finally {
      rerunning.delete(key);
    }
  });
  add(R.retryTask, ({ params, body }) => app.orchestrator.retryTask(params.id, params.taskId, parse(z.object({ guidance: z.string().max(4000).optional() }), body ?? {}).guidance));
  // Troubleshooter: evidence + pattern detectors + plain-language explanation + one-click fixes.
  // Why a build stopped: who or what stopped it and why, where it got to, a diagnosis and research for a way forward.
  // Run Review: the stored review, or one built now for a finished run (and stored). Unfinished runs: null.
  add("GET /runs/:id/review", ({ params }) => getRunReview(app, params.id) ?? recordRunReview(app, params.id) ?? null);
  // What the run is doing now, a time range (or "not enough data"), and advisory stall signals. Read-only.
  // The run's facts in plain language: status, steps, stopped steps with what FlowCode does and what you decide, checks.
  // Project Journal: retrospectives assembled from existing records, and questions answered from them.
  add("GET /projects/:id/journal", ({ params }) => projectJournal(app, params.id));
  add("POST /projects/:id/journal/ask", ({ params, body }) => {
    const b = parse(z.object({ runId: z.string().min(1), question: z.string().trim().min(2).max(500) }), body);
    return askJournal(app, params.id, b.runId, b.question);
  });
  add("GET /runs/:id/facts", ({ params }) => {
    const run = app.store.runs.require(params.id);
    return runFacts(app, run, app.store.projects.require(run.projectId), "route");
  });
  add("GET /runs/:id/activity", ({ params }) => {
    const a = runActivity(app, params.id);
    if (a.eta && !["finished", "finished_unverified", "failed", "cancelled"].includes(a.state)) rememberFirstEstimate(app, params.id, a.eta);
    return a;
  });
  add("POST /runs/:id/review", ({ params }) => recordRunReview(app, params.id) ?? null);
  // The improvement backlog: proposals only; nothing in it is applied without approval.
  add("GET /improvements", () => app.store.getSetting(IMPROVEMENTS_KEY, []));
  add("GET /runs/:id/stop-report", async ({ params, query }) => (await buildStopReport(app, params.id, { explain: query.get("explain") !== "0" })) ?? null);
  add("POST /runs/:id/troubleshoot", async ({ params, body }) => {
    const b = parse(z.object({ taskId: z.string().optional(), explain: z.boolean().default(true) }), body ?? {});
    return troubleshoot(app, params.id, b.taskId, b.explain);
  });
  add(R.rollbackTask, ({ params }) => app.orchestrator.rollbackTask(params.id, params.taskId));
  add(R.restoreCheckpoint, ({ params }) => app.orchestrator.restoreCheckpoint(params.id, params.checkpointId));
  add(R.restoreSnapshot, ({ params }) => {
    const s = app.store.snapshots.require(params.id);
    return app.snapshots.restore(s.id, app.projects.jail(s.projectId));
  });
  add("GET /snapshots/:id/diff", ({ params }) => {
    const s = app.store.snapshots.require(params.id);
    const prior = app.snapshots.priorContent(s);
    let current: string | undefined;
    try {
      current = readFile(app.projects.jail(s.projectId), s.relativePath).content;
    } catch {
      current = undefined;
    }
    return { snapshot: s, before: prior !== undefined ? redact(prior) : null, after: current ?? null };
  });
  add(R.runReport, ({ params }) => app.verifier.reports.latestReport(params.id) ?? { markdown: null });
  add(R.exportReport, async ({ params, body }) => {
    const { format } = parse(z.object({ format: z.enum(["markdown", "pdf"]) }), body);
    const rep = app.verifier.reports.latestReport(params.id);
    if (!rep) throw new HttpError(404, "No report yet");
    if (format === "markdown") return { artifactId: rep.record.id, mime: "text/markdown" };
    const pdf = await app.verifier.reports.exportPdf(params.id, rep.markdown);
    return { artifactId: pdf.id, mime: "application/pdf" };
  });
  add("GET /artifacts/:id", ({ params, query, res }) => {
    const { record, content } = app.artifacts.read(params.id);
    const ext = record.mime === "application/pdf" ? ".pdf" : record.mime === "text/markdown" ? ".md" : "";
    const filename = `${record.label.replace(/[^\w.() -]+/g, "-").trim() || "artifact"}${ext}`;
    res.writeHead(200, {
      "content-type": record.mime,
      "content-length": content.length,
      "cache-control": "no-store",
      ...(query.get("download") ? { "content-disposition": `attachment; filename="${filename}"` } : {}),
    });
    res.end(content);
    return SENT;
  });
  add("GET /runs/:id/artifacts", ({ params }) => app.artifacts.forRun(params.id));
  // A project's picture for its card (Dashboard → My Projects): the newest build's desktop screenshot, else its look
  // check's first screen. 404 when no build has taken one yet; the card then shows a placeholder.
  add("GET /projects/:id/thumbnail", ({ params, res }) => {
    const runs = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 12", params.id);
    for (const run of runs) {
      const shots = app.artifacts.forRun(run.id).filter((a) => a.kind === "screenshot" && /^image\//.test(a.mime));
      const pick = shots.filter((a) => /desktop/i.test(a.label)).at(-1) ?? shots.filter((a) => /First screen/.test(a.label)).at(-1);
      if (!pick) continue;
      const { record, content } = app.artifacts.read(pick.id);
      res.writeHead(200, { "content-type": record.mime, "content-length": content.length, "cache-control": "private, max-age=60" });
      res.end(content);
      return SENT;
    }
    throw new HttpError(404, "No screenshot yet");
  });

  // ── approvals
  add(R.listApprovals, ({ query }) => app.approvals.pending(query.get("projectId") ?? undefined));
  // Your own idea for a project: saved for later, or built now (the same follow-up path as FlowCode's ideas).
  add("POST /projects/:id/ideas", async ({ params, body }) => {
    const b = parse(z.object({ title: z.string().trim().min(3).max(200), detail: z.string().trim().max(4000).optional(), buildNow: z.boolean().optional() }), body);
    const project = app.store.projects.require(params.id);
    const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", project.id)[0];
    // The card shows your words; the coder's instruction is written by the local model (your words until it's ready).
    const yourWords = b.detail || b.title;
    const req = app.approvals.request({ projectId: project.id, ...(latest ? { runId: latest.id } : {}), kind: "enhancement_idea", action: b.title, reason: yourWords, affected: [], risk: "low", detail: yourWords, consequencesOfDenial: "Nothing changes." });
    let idea = { ...req, author: "you" as const, savedForLater: !b.buildNow };
    app.store.approvals.upsert(idea);
    const writeBrief = async () => {
      const detail = await briefIdea(app, project.id, b.title, yourWords, latest?.id);
      const now = app.store.approvals.get(idea.id);
      if (detail && now && now.status === "pending") app.store.approvals.upsert({ ...now, detail, briefBy: "planner" });
      return detail ?? yourWords;
    };
    // Building now waits for the brief so the coder gets it; saving returns at once and the brief follows.
    if (b.buildNow) idea = { ...idea, detail: await writeBrief() };
    else void writeBrief().catch(() => undefined);
    // FlowCode won't suggest the same thing again.
    const seenKey = `ideas:${project.id}`;
    app.store.setSetting(seenKey, [...app.store.getSetting<string[]>(seenKey, []), b.title].slice(-100));
    logDecision(app, { kind: "approval", actor: "user", summary: `Added your own idea${b.buildNow ? " and built it" : ""}: ${b.title}`, projectId: project.id, ref: `approval:${idea.id}` });
    if (b.buildNow) return decideApproval(idea.id, { decision: "once", action: idea.action });
    return idea;
  });
  // Keep an idea for later (or put it back with the new ideas). Only FlowCode's optional ideas can be saved.
  add("POST /approvals/:id/save", ({ params, body }) => {
    const b = parse(z.object({ saved: z.boolean() }), body);
    const a = app.store.approvals.require(params.id);
    if (a.kind !== "enhancement_idea") throw new HttpError(400, "Only ideas can be saved for later.");
    if (a.status !== "pending") throw new HttpError(409, `This idea was already ${a.status === "approved" ? "built" : "dismissed"}.`);
    const next = { ...a, savedForLater: b.saved };
    app.store.approvals.upsert(next);
    logDecision(app, { kind: "approval", actor: "user", summary: `${b.saved ? "Saved for later" : "Moved back to new ideas"}: ${a.action.slice(0, 200)}`, projectId: a.projectId, ...(a.runId ? { runId: a.runId } : {}), ref: `approval:${a.id}` });
    app.bus.emit({ type: "approval.resolved", projectId: a.projectId, ...(a.runId ? { runId: a.runId } : {}), message: `Idea ${b.saved ? "saved for later" : "moved back"}: ${a.action.slice(0, 120)}` });
    return next;
  });
  // Decided approvals, newest first: the approval history.
  add("GET /approvals/history", ({ query }) => app.store.approvals.where("status != 'pending' ORDER BY updated_at DESC LIMIT ?", Math.min(500, Number(query.get("limit") ?? 200))));
  // The decision log (approvals, settings, models, skills, recoveries, rollbacks, run control, improvements).
  add("GET /decisions", ({ query }) => listDecisions(app, { projectId: query.get("projectId") ?? undefined, runId: query.get("runId") ?? undefined, kind: query.get("kind") ?? undefined, limit: Number(query.get("limit") ?? 300) }));
  // Improvement proposals: the person moves them through their states; nothing is applied by this.
  add("POST /improvements/:id/status", ({ params, body }) => {
    const b = parse(z.object({ status: z.enum(["awaiting_approval", "approved", "in_progress", "testing", "verified", "rejected", "rolled_back", "deferred"]), note: z.string().max(1000).optional() }), body);
    const backlog = app.store.getSetting<Improvement[]>(IMPROVEMENTS_KEY, []);
    const item = backlog.find((x) => x.id === params.id);
    if (!item) throw new HttpError(404, "No such improvement");
    // "Confirmed" needs evidence from later runs: only allowed once it has been tested.
    if (b.status === "verified" && item.status !== "testing") throw new HttpError(409, "An improvement is confirmed only after it has been tested on later runs.");
    item.status = b.status;
    item.history.push({ at: new Date().toISOString(), status: b.status, note: b.note ?? "", actor: "user" });
    app.store.setSetting(IMPROVEMENTS_KEY, backlog);
    logDecision(app, { kind: "improvement", actor: "user", summary: `${item.name}: ${b.status.replace(/_/g, " ")}`, ...(b.note ? { reason: b.note } : {}), ...(item.projectId ? { projectId: item.projectId } : {}), ref: `improvement:${item.id}` });
    return item;
  });
  add(R.approvalDecision, ({ params, body }) => decideApproval(params.id, parse(C.ApprovalDecisionInput, body)));
  /** One place that acts on a decision, for the desktop and the phone approvals page alike. */
  const decideApproval = (id: string, b: C.ApprovalDecisionInput) => {
    const a = app.store.approvals.require(id);
    // Approval binds to the exact action the person reviewed: a changed or already-decided action is refused.
    if (b.action !== undefined && b.action !== a.action) throw new HttpError(409, "This approval's action changed since you looked at it. Review it again.");
    if (a.status !== "pending") throw new HttpError(409, `This approval was already ${a.status}.`);
    try {
      logDecision(app, { kind: "approval", actor: "user", summary: `${b.decision === "deny" ? "Denied" : b.decision === "project" ? "Approved for this project" : "Approved once"}: ${a.action.slice(0, 200)}`, ...(b.note ? { reason: b.note.slice(0, 300) } : {}), projectId: a.projectId, ...(a.runId ? { runId: a.runId } : {}), ref: `approval:${a.id}` });
    } catch {
      // Never blocks the decision.
    }
    // The review step's approval ("Review the prototype plan and the design"): the waiting step continues, or the
    // build stops if it's denied.
    if (a.kind === "plan" && a.taskId) {
      const decided = app.approvals.decide(a.id, b.decision, b.note);
      if (b.decision === "deny") void Promise.resolve(app.orchestrator.cancel(a.runId!, "prototype plan not approved")).catch(() => undefined);
      return decided;
    }
    if (a.kind === "plan" && b.decision !== "deny") return app.orchestrator.approvePlan(a.runId!, "user");
    if (a.kind === "plan" && b.decision === "deny") {
      app.approvals.decide(a.id, "deny", b.note);
      return app.orchestrator.cancel(a.runId!, "plan denied");
    }
    const decided = app.approvals.decide(id, b.decision, b.note);
    if (a.kind === "enhancement_idea" && decided.status === "approved" && a.detail) {
      const latest = app.store.runs.where("project_id = ? ORDER BY created_at DESC LIMIT 1", a.projectId)[0];
      const run = app.orchestrator.createRun({ projectId: a.projectId, objective: `${a.action}\n\n${a.detail}`, constraints: [], attachedKnowledgeIds: [], ...(latest ? { parentRunId: latest.id, kind: "iterate" as const } : {}) });
      void app.orchestrator.plan(run.id).catch(() => undefined);
      return { ...decided, followUpRunId: run.id };
    }
    if (a.kind === "external_research" && decided.status === "approved") {
      for (const j of app.store.research.where("project_id = ?", a.projectId).filter((x) => x.approvalId === a.id)) void app.research.execute(j.id);
    }
    return decided;
  };
  // The phone page (Settings → Phone): a separate, key-protected page on the local Wi-Fi, or on HTTPS through Tailscale
  // with notifications. It can decide approvals and retry a blocked step, nothing else.
  const mobile = createMobileApprovals(app, decideApproval, (runId, taskId, guidance) => app.orchestrator.retryTask(runId, taskId, guidance));
  void mobile.resume();
  add("GET /mobile", () => mobile.status());
  add("POST /mobile", async ({ body }) => mobile.setEnabled(parse(z.object({ enabled: z.boolean() }), body).enabled));
  add("POST /mobile/rotate", async () => mobile.rotate());
  add("POST /mobile/https", async () => mobile.useTailscale());

  // ── events (SSE with Last-Event-ID resume)
  const sse = (filter: { runId?: string; projectId?: string }) => (ctx: Parameters<Handler>[0]) => {
    const { req, res, query } = ctx;
    const after = Number(req.headers["last-event-id"] ?? query.get("after") ?? 0);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    const send = (e: C.FlowEvent) => {
      if (filter.runId && e.runId !== filter.runId) return;
      if (filter.projectId && e.projectId && e.projectId !== filter.projectId) return;
      // Backpressure: drop terminal output chunks for slow clients rather than buffering unboundedly.
      if (!res.write(`id: ${e.seq}\nevent: flow\ndata: ${JSON.stringify(e)}\n\n`) && e.type === "command.output") return;
    };
    for (const e of app.bus.list({ ...filter, afterSeq: after, limit: 5000 })) send(e);
    const unsub = app.bus.subscribe(send);
    const ping = setInterval(() => res.write(`: ping\n\n`), 15_000);
    req.on("close", () => {
      unsub();
      clearInterval(ping);
    });
    return SENT;
  };
  add(R.runEvents, (ctx) => sse({ runId: ctx.params.id })(ctx));
  add(R.globalEvents, (ctx) => sse({ projectId: ctx.query.get("projectId") ?? undefined })(ctx));
  add("GET /runs/:id/events/list", ({ params, query }) => app.bus.list({ runId: params.id, afterSeq: Number(query.get("after") ?? 0), limit: Number(query.get("limit") ?? 3000) }));

  // ── models
  add(R.listProviders, async () => Promise.all(app.router.providerConfigs().map(async (p) => ({ ...p, health: await app.router.provider(p.id).health() }))));
  add(R.saveProvider, ({ body }) => {
    const cfg = parse(C.ProviderConfig, body);
    app.router.saveProvider(cfg);
    return cfg;
  });
  add(R.listModels, async ({ params }) => app.router.provider(params.id).listModels());
  // The cloud coder a build can choose instead of the local one: an OpenAI-compatible endpoint and a model name. The
  // API key is never stored: it's read from the FLOWCODE_HOSTED_API_KEY environment variable of the daemon.
  add("GET /models/cloud-coder", () => cloudCoder());
  // Which model designs the screens: the cloud coder ("cloud", when it's ready) or each build's own coder ("coder").
  add("GET /models/design-model", () => ({ designModel: app.store.getSetting<string>("designModel", "cloud"), cloudReady: cloudCoder().ready }));
  // Measured model results on this computer (step outcomes, speed, memory fit) and a recommendation. Read-only.
  add("GET /models/performance", () => modelPerformance(app));
  // Screens: which ones a design step covered, pairs worth reviewing together, and reusable screen specs.
  add("GET /projects/:id/screens", ({ params }) => ({ ...screenCoverage(app, params.id), specs: getScreenSpecs(app, params.id) }));
  // A draft spec from a local model; nothing is saved until the person saves it.
  add("POST /projects/:id/screens/:screenId/spec/draft", ({ params }) => draftScreenSpec(app, params.id, params.screenId));
  add("POST /projects/:id/screens/:screenId/spec", ({ params, body }) => {
    const s = parse(z.object({ goal: z.string().min(3).max(500), primaryAction: z.string().max(300), hierarchy: z.array(z.string().max(300)).max(20), layout: z.string().max(1500), responsive: z.string().max(800), components: z.array(z.string().max(120)).max(40), tokens: z.array(z.string().max(120)).max(40), copy: z.array(z.string().max(300)).max(30), data: z.string().max(1000), states: z.object({ loading: z.string().max(400), empty: z.string().max(400), error: z.string().max(400), success: z.string().max(400).optional() }), accessibility: z.array(z.string().max(300)).max(20), icons: z.string().max(400), acceptance: z.array(z.string().max(400)).max(20), source: z.string().max(120).optional() }), body);
    return saveScreenSpec(app, params.id, { ...s, screenId: params.screenId, source: s.source ?? "you", updatedAt: new Date().toISOString() } as never);
  });
  add("POST /models/design-model", ({ body }) => {
    const designModel = parse(z.object({ designModel: z.enum(["cloud", "coder"]) }), body).designModel;
    app.store.setSetting("designModel", designModel);
    return { designModel, cloudReady: cloudCoder().ready };
  });
  // The API key, entered on the Models page. It goes into the user's environment variable (Windows: HKCU\Environment)
  // and this daemon's environment, never FlowCode's database, logs or events, and it's never sent back.
  add("POST /models/cloud-coder/key", ({ body }) => {
    const { key } = parse(z.object({ key: z.string().trim().min(10).max(500).regex(/^\S+$/, "The key can't contain spaces") }), body);
    const name = app.router.providerConfigs().find((p) => p.id === cloudProviderId(app.store))?.apiKeyRef ?? "FLOWCODE_HOSTED_API_KEY";
    if (process.platform === "win32") execFileSync("reg", ["add", "HKCU\\Environment", "/v", name, "/t", "REG_SZ", "/d", key, "/f"], { stdio: "ignore", windowsHide: true });
    process.env[name] = key;
    return cloudCoder();
  });
  add("POST /models/cloud-coder/key/remove", () => {
    const name = app.router.providerConfigs().find((p) => p.id === cloudProviderId(app.store))?.apiKeyRef ?? "FLOWCODE_HOSTED_API_KEY";
    if (process.platform === "win32") {
      try {
        execFileSync("reg", ["delete", "HKCU\\Environment", "/v", name, "/f"], { stdio: "ignore", windowsHide: true });
      } catch {
        /* not set */
      }
    }
    delete process.env[name];
    return cloudCoder();
  });
  // Which cloud provider the cloud model uses: OpenAI-compatible or Anthropic. Each keeps its own key and model.
  add("POST /models/cloud-coder/provider", ({ body }) => {
    const { provider } = parse(z.object({ provider: z.enum(CLOUD_PROVIDERS) }), body);
    app.store.setSetting("cloudCoder", { ...app.store.getSetting<Record<string, unknown>>("cloudCoder", {}), provider });
    return cloudCoder();
  });
  add("POST /models/cloud-coder", async ({ body }) => {
    const b = parse(z.object({ baseUrl: z.string().url().max(300).optional(), model: z.string().trim().min(1).max(120) }), body);
    const provider = cloudProviderId(app.store);
    const hosted = app.router.providerConfigs().find((p) => p.id === provider);
    if (!hosted) throw new HttpError(404, "No hosted provider configured");
    const baseUrl = provider === ANTHROPIC_PROVIDER ? hosted.baseUrl || "https://api.anthropic.com" : b.baseUrl;
    if (!baseUrl) throw new HttpError(400, "Enter the provider's endpoint URL.");
    app.router.saveProvider({ ...hosted, baseUrl, enabled: true });
    // The model name as the provider knows it: "GPT-5.6 Sol" (a display name) is the id "gpt-5.6-sol". When the key
    // can list the provider's models, the name must be one of them.
    let model = b.model;
    let models: string[] = [];
    let reach = "";
    try {
      models = (await app.router.provider(provider).listModels()).map((m) => m.name);
    } catch (e) {
      reach = (e as Error).message;
    }
    if (models.length && !models.includes(model)) {
      const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, "-");
      const match = models.find((m) => norm(m) === norm(model));
      if (!match) throw new HttpError(400, `The provider has no model "${model}". Use the model's id as the provider lists it, e.g. ${models.filter((m) => /gpt|codex|claude|llama|qwen|mistral/i.test(m)).slice(-4).join(", ") || models.slice(0, 4).join(", ")}.`);
      model = match;
    }
    const saved = app.store.getSetting<{ models?: Record<string, string> } & Record<string, unknown>>("cloudCoder", {});
    app.store.setSetting("cloudCoder", { ...saved, provider, model, models: { ...(saved.models ?? {}), [provider]: model } });
    return { ...cloudCoder(), models, reach };
  });
  // The model ids the saved key can use (for the Models page's model picker).
  add("GET /models/cloud-coder/models", async () => {
    try {
      return { models: (await app.router.provider(cloudProviderId(app.store)).listModels()).map((m) => m.name), error: "" };
    } catch (e) {
      return { models: [], error: (e as Error).message };
    }
  });
  add(R.roleAssignments, () => {
    const a = app.router.roleAssignments();
    return Object.fromEntries(Object.entries(a).map(([role, asg]) => [role, { assignment: asg, eligibility: role === "coder" ? app.lab.coderEligibility(asg) : undefined, configHash: ModelRouter.configHash(asg) }]));
  });
  add(R.setRoleAssignment, ({ body }) => {
    const b = parse(z.object({ role: C.AgentRole, assignment: C.ModelAssignment }), body);
    if (b.role === "coder") {
      const e = app.lab.coderEligibility(b.assignment);
      if (!e.eligible) throw new HttpError(409, `Cannot make ${b.assignment.model} the default Coder: ${e.reason}`);
    }
    app.router.setRoleAssignment(b.role, b.assignment);
    // Builds still going switch too (the agents use what the person just chose).
    const switched = app.orchestrator.switchRoleModel(b.role, b.assignment);
    return { ok: true, switched: switched.length };
  });
  // First-run setup: the one next step before a first build (Ollama, a model, its coder test, using it as the coder).
  add("GET /setup/status", () => setupStatus(app));
  add("POST /setup/test", ({ body }) => testAndUse(app, parse(z.object({ model: z.string().min(1).max(200) }), body).model));
  add("POST /setup/use", ({ body }) => useAsCoder(app, parse(z.object({ model: z.string().min(1).max(200) }), body).model));
  add(R.listCapabilities, () => app.store.capabilities.list("created_at DESC", 200));
  add(R.capabilityProbe, ({ body }) => {
    const b = parse(z.object({ assignment: C.ModelAssignment }), body);
    const jobId = `probe_${Date.now()}`;
    void app.lab.probeWhenFree(b.assignment, () => app.orchestrator.hasActiveBuild()).catch((err) => app.bus.emit({ type: "model.failed", message: `Capability probe failed: ${(err as Error).message}`, level: "error" }));
    // While a build runs the test waits for it, so the lab can say so.
    return { started: true, jobId, waiting: app.orchestrator.hasActiveBuild() };
  });

  // ── knowledge, prompts, skills, research
  add(R.knowledgeSearch, async ({ query }) => {
    const q = query.get("q") ?? "";
    const projectId = query.get("projectId") ?? undefined;
    if (projectId && query.get("files") !== "0") app.knowledge.indexWorkspace(projectId, app.projects.jail(projectId));
    const results = app.knowledge.search(q, { projectId, limit: 40 });
    const semantic = query.get("semantic") === "1" ? await app.knowledge.semanticSearch(q, projectId) : [];
    return { results, semantic: semantic.map((s) => ({ id: s.item.id, title: s.item.title, similarity: s.similarity, provenance: s.item.provenance })) };
  });
  // Skill proposals: repeated failures FlowCode found in its own runs, with drafted skills switched off for review.
  add("GET /skill-proposals", () => proposalsView(app));
  add("GET /model-problems/solver", () => solverView(app));
  add("POST /model-problems/solver/run", async () => solveOne(app, { force: true }));
  add("POST /model-problems/solver/:id/apply", ({ params }) => {
    try {
      return applySuggestion(app, decodeURIComponent(params.id));
    } catch (e) {
      throw new HttpError(409, (e as Error).message);
    }
  });
  add("POST /model-problems/solver/:id/dismiss", ({ params }) => {
    try {
      return dismissSuggestion(app, decodeURIComponent(params.id));
    } catch (e) {
      throw new HttpError(404, (e as Error).message);
    }
  });
  add("POST /skill-proposals/scan", () => scanAndPropose(app));
  add("POST /skill-proposals/enable", ({ body }) => {
    try {
      return enableProposal(app, parse(z.object({ id: z.string().max(80) }), body).id);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("POST /skill-proposals/dismiss", ({ body }) => {
    try {
      return dismissProposal(app, parse(z.object({ id: z.string().max(80) }), body).id);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("POST /skill-proposals/disable", ({ body }) => {
    try {
      return disableProposal(app, parse(z.object({ id: z.string().max(80) }), body).id);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("POST /skill-proposals/restore", ({ body }) => {
    try {
      return restoreProposal(app, parse(z.object({ id: z.string().max(80) }), body).id);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add("GET /knowledge", ({ query }) => (query.get("scope") === "global" ? app.store.knowledge.where("scope = 'global' ORDER BY updated_at DESC") : app.knowledge.list(query.get("projectId") ?? undefined)));
  // Move items (e.g. every part of an uploaded document) to another project, or to Global with projectId null.
  add("POST /knowledge/move", ({ body }) => {
    const b = parse(z.object({ ids: z.array(z.string().max(100)).min(1).max(5000), projectId: z.string().max(100).nullable() }), body);
    try {
      return app.knowledge.move(b.ids, b.projectId);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add(R.createKnowledge, ({ body }) => app.knowledge.create(parse(C.CreateKnowledgeInput, body)));
  add(R.updateKnowledge, ({ params, body }) =>
    app.knowledge.update(params.id, parse(z.object({ title: z.string(), content: z.string(), tags: z.array(z.string()), pinned: z.boolean(), excluded: z.boolean(), confirmedByUser: z.boolean(), durability: z.enum(["temporary", "durable"]) }).partial(), body)),
  );
  add(R.listPrompts, () => app.store.prompts.list("updated_at DESC"));
  add(R.savePrompt, ({ body }) => app.knowledge.savePrompt(parse(C.PromptSpec, body)));
  add("GET /prompts/:id/versions", ({ params }) => app.knowledge.promptVersions(params.id));
  add("GET /library/stats", ({ query }) => libraryStats(app, (["24h", "7d", "30d"] as const).find((w) => w === query.get("window")) ?? "24h"));
  add(R.listSkills, () => app.store.skills.list("updated_at DESC"));
  add(R.saveSkill, ({ body }) => app.knowledge.saveSkill(parse(C.SkillSpec, body)));
  add(R.skillVersions, ({ params }) => app.knowledge.skillVersions(params.id));
  add(R.deleteSkill, ({ params }) => {
    try {
      return app.knowledge.deleteSkill(params.id);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
  add(R.runSkill, ({ params, body }) => {
    const b = parse(z.object({ projectId: z.string() }), body);
    if (params.id !== "skill.repository-map") throw new HttpError(400, "Only skill.repository-map runs standalone; other skills run inside tasks");
    const map = repositoryMap(app.projects.jail(b.projectId));
    const md = renderRepositoryMap(map);
    const item = app.knowledge.create({ scope: "project", projectId: b.projectId, kind: "architecture", title: "Repository map", content: md, tags: ["repository-map", "skill"], provenance: [{ kind: "file", ref: "package.json" }, ...map.entryPoints.map((p) => ({ kind: "file" as const, ref: p }))], linkedEntityIds: [], durability: "durable", confirmedByUser: false, confidence: "high" });
    return { map, markdown: md, knowledgeId: item.id };
  });
  add(R.researchJobs, async ({ body }) => {
    const b = parse(z.object({ projectId: z.string(), question: z.string().min(3).max(2000) }), body);
    const job = await app.research.createJob(b.projectId, b.question);
    if (job.status === "planned") void app.research.execute(job.id);
    return job;
  });
  // ── web search (SearXNG), topics, knowledge uploads
  const web = new WebSearchService(app);
  // Research desk: SearXNG first (with the dark-web filter, blocked sites and safe search), Wikipedia as the fallback.
  app.research.adapters = [new SearxngAdapter((q) => web.search(q)), new WikipediaAdapter()];
  const fail = (e: unknown, status = 400): never => {
    throw new HttpError(status, (e as Error).message);
  };
  const WebResultSchema = z.object({ url: z.string().url(), title: z.string(), snippet: z.string().default(""), source: z.string().default(""), engine: z.string().optional(), tab: z.enum(RESULT_TABS as [string, ...string[]]), thumbnail: z.string().optional(), author: z.string().optional(), publishedAt: z.string().optional() });
  add("GET /web/status", () => web.status());
  add("GET /web/settings", () => web.settings());
  add("POST /web/settings", ({ body }) => web.saveSettings(parse(z.object({ searxUrl: z.string().max(300), blocklist: z.array(z.string().max(253)).max(2000), safeSearch: z.union([z.literal(0), z.literal(1), z.literal(2)]) }).partial(), body)));
  add("GET /web/search", async ({ query }) => {
    try {
      return await web.search(query.get("q") ?? "", Math.max(1, Math.min(5, Number(query.get("page") ?? 1) || 1)));
    } catch (e) {
      return fail(e, 502);
    }
  });
  add("GET /web/thumb", async ({ query, res }) => {
    try {
      const img = await web.thumbnail(query.get("u") ?? "");
      res.writeHead(200, { "content-type": img.type, "content-length": img.body.length, "cache-control": "private, max-age=86400" });
      res.end(img.body);
      return SENT;
    } catch (e) {
      return fail(e, 404);
    }
  });
  add("POST /web/summary", async ({ body }) => {
    const b = parse(z.object({ url: z.string().url(), title: z.string().max(400), snippet: z.string().max(2000).optional() }), body);
    try {
      return await web.summarize(b);
    } catch (e) {
      return fail(e);
    }
  });
  add("GET /web/notes", ({ query }) => web.notes(query.get("url") ?? ""));
  add("POST /web/notes", ({ body }) => {
    const b = parse(z.object({ url: z.string().url(), text: z.string().min(1).max(4000) }), body);
    return web.addNote(b.url, b.text);
  });
  add("POST /web/notes/delete", ({ body }) => {
    const b = parse(z.object({ url: z.string().url(), id: z.string() }), body);
    return web.deleteNote(b.url, b.id);
  });
  add("GET /topics", () => web.topics().map(({ results, ...t }) => ({ ...t, resultCount: results.length, thumbnail: [...t.saved, ...results].find((r) => r.thumbnail)?.thumbnail })));
  add("POST /topics", ({ body }) => {
    try {
      return web.createTopic(parse(z.object({ query: z.string().min(1).max(400), title: z.string().max(140).optional(), description: z.string().max(1000).optional(), results: z.array(WebResultSchema).max(100).optional() }), body) as { query: string; results?: WebResult[] });
    } catch (e) {
      return fail(e);
    }
  });
  add("GET /topics/:id", async ({ params, query }) => {
    try {
      return await web.refreshTopic(params.id, query.get("refresh") === "1");
    } catch (e) {
      // Offline search shouldn't hide a saved topic: return what we have, with the error.
      try {
        return { ...web.topic(params.id), refreshError: (e as Error).message };
      } catch {
        return fail(e, 404);
      }
    }
  });
  add("POST /topics/:id", ({ params, body }) => web.updateTopic(params.id, parse(z.object({ title: z.string().max(140), description: z.string().max(1000), query: z.string().max(400) }).partial(), body)));
  add("POST /topics/:id/delete", ({ params }) => web.deleteTopic(params.id));
  add("POST /topics/:id/save", ({ params, body }) => {
    const b = parse(z.object({ item: WebResultSchema, saved: z.boolean() }), body);
    try {
      return web.saveItem(params.id, b.item as WebResult, b.saved);
    } catch (e) {
      return fail(e);
    }
  });
  add("POST /topics/:id/analyze", async ({ params }) => {
    try {
      return await web.analyzeTopic(params.id);
    } catch (e) {
      return fail(e);
    }
  });
  add("POST /topics/:id/knowledge", ({ params, body }) => {
    try {
      return web.toKnowledge(params.id, parse(z.object({ projectId: z.string().optional() }), body).projectId);
    } catch (e) {
      return fail(e);
    }
  });
  // Discovery ("Let's solve a problem"): Light and Deep Research projects, stored locally.
  const disc = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof D.DiscoveryError) throw new HttpError(400, e.message);
      throw e;
    }
  };
  const discAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof D.DiscoveryError) throw new HttpError(400, e.message);
      throw e;
    }
  };
  const view = (p: C.DiscoveryProject) => ({ project: p, fitApproved: D.fitApproved(p), summary: p.mode === "light" ? D.summaryMarkdown(p) : undefined, report: p.mode === "deep" ? D.reportMarkdown(p) : undefined });
  const StepBody = z.object({ stepId: z.string().max(40) });
  add("GET /discovery", () => D.listProjects(app));
  add("POST /discovery", ({ body }) => {
    // One flow: new research starts with the core plan; "research" pre-adds optional sections, and "problem" saves the
    // problem typed on the start screen. "light" is kept for older clients.
    const b = parse(z.object({ mode: z.enum(["light", "deep"]).default("deep"), title: z.string().max(120).optional(), research: z.array(z.string().max(40)).max(20).optional(), problem: z.string().max(4000).optional() }), body ?? {});
    const p = D.createProject(app, b.mode, b.title ? redact(b.title) : undefined, b.research ?? []);
    if (b.problem?.trim()) return view(D.saveInputs(app, p.id, p.mode === "deep" ? "d_problem" : "l_problem", { problem: redact(b.problem) }).project);
    return view(p);
  });
  add("POST /discovery/:id/research", ({ params, body }) => disc(() => view(D.setResearch(app, params.id, parse(z.object({ research: z.array(z.string().max(40)).max(20) }), body).research))));
  add("GET /discovery/:id", ({ params }) => disc(() => view(D.getProject(app, params.id))));
  add("POST /discovery/:id/inputs", ({ params, body }) => {
    const b = parse(StepBody.extend({ values: z.record(z.string(), z.union([z.string().max(8000), z.array(z.string().max(2000)).max(30)])) }), body);
    const values = Object.fromEntries(Object.entries(b.values).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => redact(x)) : redact(v)]));
    return disc(() => {
      const r = D.saveInputs(app, params.id, b.stepId, values);
      return { ...view(r.project), affected: r.affected };
    });
  });
  add("POST /discovery/:id/output", ({ params, body }) => {
    const b = parse(StepBody.extend({ data: z.record(z.string(), z.unknown()) }), body);
    return disc(() => {
      const r = D.saveOutput(app, params.id, b.stepId, JSON.parse(redact(JSON.stringify(b.data))));
      return { ...view(r.project), affected: r.affected };
    });
  });
  add("POST /discovery/:id/generate", async ({ params, body }) => discAsync(async () => view(await D.generateStep(app, params.id, parse(StepBody, body).stepId))));
  add("POST /discovery/:id/followup", async ({ params, body }) => discAsync(async () => view(await D.askFollowUp(app, params.id, parse(StepBody, body).stepId))));
  add("POST /discovery/:id/followup/answer", ({ params, body }) => {
    const b = parse(StepBody.extend({ index: z.number().int().min(0).max(10), answer: z.string().max(1000).nullable() }), body);
    return disc(() => {
      const r = D.answerFollowUp(app, params.id, b.stepId, b.index, b.answer === null ? null : redact(b.answer));
      return { ...view(r.project), affected: r.affected };
    });
  });
  add("POST /discovery/:id/approve", ({ params, body }) => disc(() => view(D.approveStep(app, params.id, parse(StepBody, body).stepId))));
  add("POST /discovery/:id/keep", ({ params, body }) => disc(() => view(D.keepCurrent(app, params.id, parse(z.object({ stepIds: z.array(z.string().max(40)).max(40) }), body).stepIds))));
  add("POST /discovery/:id/open", ({ params, body }) => disc(() => view(D.openStep(app, params.id, parse(StepBody, body).stepId))));
  add("POST /discovery/:id/rename", ({ params, body }) => disc(() => view(D.renameProject(app, params.id, redact(parse(z.object({ title: z.string().min(1).max(120) }), body).title)))));
  add("POST /discovery/:id/duplicate", ({ params }) => disc(() => view(D.duplicateProject(app, params.id))));
  add("POST /discovery/:id/delete", ({ params }) => D.deleteProject(app, params.id));
  add("POST /discovery/:id/upgrade", ({ params }) => disc(() => view(D.upgradeToDeep(app, params.id))));
  add("POST /discovery/:id/doc", ({ params, body }) => {
    const b = parse(z.discriminatedUnion("action", [z.object({ action: z.literal("approve"), kind: z.enum(["prd", "report"]), version: z.number().int() }), z.object({ action: z.literal("edit"), kind: z.enum(["prd", "report"]), markdown: z.string().min(1).max(400_000) })]), body);
    return disc(() => view(b.action === "approve" ? D.approveDoc(app, params.id, b.kind, b.version) : D.editDoc(app, params.id, b.kind, redact(b.markdown))));
  });
  add("GET /discovery/:id/export", ({ params }) => disc(() => D.exportMarkdown(D.getProject(app, params.id))));
  add("POST /discovery/:id/handoff", ({ params }) => disc(() => D.handoff(app, params.id)));
  // Virtual interviews and virtual user testing: start (pick participants), one participant per call (so the page can
  // show progress), then the summary. AI-simulated throughout; never counted as real research.
  const VirtualBody = z.object({ action: z.enum(["start", "participant", "synthesize", "clear"]), index: z.number().int().min(0).max(10).optional() });
  add("POST /discovery/:id/virtual-interviews", async ({ params, body }) => {
    const b = parse(VirtualBody, body);
    return discAsync(async () =>
      view(
        b.action === "start"
          ? await D.startVirtualInterviews(app, params.id)
          : b.action === "participant"
            ? await D.interviewVirtualParticipant(app, params.id, b.index ?? 0)
            : b.action === "synthesize"
              ? await D.synthesizeVirtualInterviews(app, params.id)
              : D.clearVirtualInterviews(app, params.id),
      ),
    );
  });
  add("POST /discovery/:id/virtual-tests", async ({ params, body }) => {
    const b = parse(VirtualBody, body);
    return discAsync(async () =>
      view(
        b.action === "start"
          ? await D.startVirtualTests(app, params.id)
          : b.action === "participant"
            ? await D.testWithVirtualParticipant(app, params.id, b.index ?? 0)
            : b.action === "synthesize"
              ? await D.synthesizeVirtualTests(app, params.id)
              : D.clearVirtualTests(app, params.id),
      ),
    );
  });
  // Design playbook: uploaded design strategies the agents follow on interface steps.
  add("GET /design-playbook", () => ({ docs: listPlaybook(app) }));
  add("POST /design-playbook/active", ({ body }) => {
    const b = parse(z.object({ ids: z.array(z.string().max(80)).min(1).max(500), active: z.boolean() }), body);
    return { docs: setPlaybookActive(app, b.ids, b.active) };
  });
  // Its own path: "/knowledge/:id" would read "delete" as an item id.
  // Fix memory → a skill: a fix that worked becomes a switched-on skill for coders and debuggers (Prompts & Skills).
  add("POST /fix-memory/:id/promote", ({ params }) => {
    const item = app.store.knowledge.get(params.id);
    if (!item || !item.tags.includes(FIX_TAG)) throw new HttpError(404, "That isn't a fix in the fix memory");
    const skill = app.knowledge.saveSkill(fixToSkill(item));
    app.knowledge.update(item.id, { confirmedByUser: true, durability: "durable" });
    return { skill };
  });
  add("POST /knowledge-items/delete", ({ body }) => app.knowledge.remove(parse(z.object({ ids: z.array(z.string().max(80)).min(1).max(500) }), body).ids));
  add("POST /design-playbook/remove", ({ body }) => {
    const b = parse(z.object({ ids: z.array(z.string().max(80)).min(1).max(500) }), body);
    return { docs: removeFromPlaybook(app, b.ids) };
  });
  add("POST /knowledge-uploads", ({ body }) => {
    const b = parse(z.object({ name: z.string().min(1).max(200), content: z.string(), projectId: z.string().optional(), tags: z.array(z.string().max(40)).max(10).optional() }), body);
    try {
      const items = uploadDocument(app, b);
      return { items: items.map((i) => ({ id: i.id, title: i.title })), chunks: items.length };
    } catch (e) {
      return fail(e);
    }
  });
  add(R.listResearch, ({ query }) => app.store.research.where("project_id = ? ORDER BY created_at DESC", query.get("projectId") ?? ""));

  const server = http.createServer(async (req, res) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      res.writeHead(400).end();
      return;
    }
    const origin = req.headers.origin;
    // Only the desktop renderer (file:// → "null" origin or app://) and the local dev UI may call the daemon.
    if (origin && !/^(null|app:\/\/.*|http:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-headers", "authorization, content-type, last-event-id");
      res.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
      // So a download read with fetch can name its file and check its hash (Repo Report's downloads send both).
      res.setHeader("access-control-expose-headers", "content-disposition, x-content-sha256");
      res.setHeader("vary", "origin");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    const supplied = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
    if (!safeEqual(supplied, token)) return void json(res, 401, { error: "unauthorized" });
    const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!route) return void json(res, 404, { error: "not found" });
    const m = route.re.exec(url.pathname)!;
    try {
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      let body: unknown = undefined;
      if (req.method === "POST" || req.method === "PATCH") {
        const raw = await readBody(req, 5_000_000);
        body = raw ? JSON.parse(raw) : {};
      }
      const out = await route.h({ params, query: url.searchParams, body, req, res });
      if (out !== SENT) json(res, 200, out ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : err instanceof PolicyError ? 403 : err instanceof NotFoundError ? 404 : err instanceof SyntaxError ? 400 : 500;
      json(res, status, { error: sanitizeError(err) });
    }
  });
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, opts.host ?? "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    port,
    token,
    // Live-update (SSE) and keep-alive connections never end by themselves, so close() alone waits forever and
    // Stop/Restart daemon hang. Close them first, with a timeout as a backstop.
    close: () =>
      new Promise<void>((resolve) => {
        void mobile.close();
        const done = setTimeout(resolve, 3000);
        server.close(() => (clearTimeout(done), resolve()));
        server.closeAllConnections();
      }),
  };
}

const SENT = Symbol("sent");

function runView(app: App, id: string) {
  const run = app.store.runs.require(id);
  const tasks = app.orchestrator.graph.tasks(id);
  return {
    run,
    active: app.orchestrator.isActive(id),
    probing: app.orchestrator.isProbing(id),
    paused: app.orchestrator.isRunPaused(id),
    resumable: !app.orchestrator.isActive(id) && !app.orchestrator.isProbing(id) && !C.TERMINAL_RUN_STATUSES.includes(run.status) && (run.planApproved || (run.status === "blocked" && !tasks.length)),
    coder: app.orchestrator.coderCheck(run),
    tasks,
    checks: app.store.checks.where("run_id = ? ORDER BY updated_at ASC", id),
    commands: app.store.commands.where("run_id = ? ORDER BY created_at ASC", id),
    approvals: app.store.approvals.where("run_id = ? ORDER BY created_at ASC", id),
    snapshots: app.snapshots.forRun(id),
    checkpoints: app.store.checkpoints.where("run_id = ? ORDER BY created_at ASC", id),
    artifacts: app.artifacts.forRun(id),
    processes: app.store.processes.where("run_id = ? ORDER BY created_at DESC", id),
    toolCalls: app.store.toolCalls.where("run_id = ? ORDER BY created_at ASC", id).length,
  };
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  if (res.headersSent) return;
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, "Body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Error messages shown to the UI: redacted and with absolute paths stripped. */
export function sanitizeError(err: unknown): string {
  const msg = redact((err as Error)?.message ?? String(err));
  return msg.replace(/[A-Za-z]:\\[^\s'"]+|\/(?:Users|home|var|tmp|private)\/[^\s'"]+/g, "<path>").slice(0, 1000);
}
