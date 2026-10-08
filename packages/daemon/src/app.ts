/** Composition root: wires every daemon service together. */
import { DEFAULT_SKILLS } from "./knowledge/defaultSkills.js";
import path from "node:path";
import { Db } from "./db/db.js";
import { Store } from "./db/store.js";
import { ArtifactService, ObjectStore } from "./db/artifacts.js";
import { EventBus } from "./events/bus.js";
import { ApprovalService } from "./approvals/service.js";
import { ProcessManager } from "./commands/processManager.js";
import { CommandRunner } from "./commands/runner.js";
import { ProjectService } from "./workspace/projects.js";
import { SnapshotService } from "./workspace/snapshots.js";
import { FileOperations } from "./workspace/operations.js";
import { ModelRouter } from "./models/router.js";
import { CapabilityLab } from "./models/capabilityLab.js";
import { KnowledgeService } from "./knowledge/knowledge.js";
import { ResearchService } from "./knowledge/research.js";
import { scoutIdeas, briefIdea } from "./orchestrator/ideaScout.js";
import { BUILTIN_SKILLS } from "./knowledge/skills.js";
import { McpManager } from "./mcp/manager.js";
import { loadSavedKeys } from "./models/cloud.js";
import { ROLE_PROMPTS } from "./orchestrator/prompts.js";
import { Verifier } from "./quality/verification.js";
import { Orchestrator, type OrchestratorDeps } from "./orchestrator/orchestrator.js";
import { defaultDataDir, ensureDir } from "./util/paths.js";
import { FlowReportStore } from "./flowReport/store.js";
import { AnalysisJobManager } from "./flowReport/jobManager.js";
import { routerModel } from "./flowReport/comprehend/model.js";
import { setArtifactRoot } from "./flowReport/report/artifacts.js";
import { denyFile } from "./flowReport/scanner/pathPolicy.js";

export interface AppOptions {
  dataDir?: string;
  dbFile?: string;
}

export function createApp(opts: AppOptions = {}) {
  const dataDir = ensureDir(opts.dataDir ?? defaultDataDir());
  const db = new Db(opts.dbFile ?? path.join(dataDir, "flowcode.sqlite"));
  const store = new Store(db);
  const bus = new EventBus(db);
  const objects = new ObjectStore(path.join(dataDir, "objects"));
  const artifacts = new ArtifactService(store, objects);
  const approvals = new ApprovalService(store, bus);
  const processes = new ProcessManager(store, bus);
  const runner = new CommandRunner(store, bus, approvals, processes);
  const projects = new ProjectService(store, bus, path.join(dataDir, "workspaces"));
  const snapshots = new SnapshotService(store, objects, bus);
  const ops = new FileOperations(snapshots);
  const router = new ModelRouter(store, bus);
  // Keys saved on the Models page before this daemon's parent process started aren't inherited: read them back.
  loadSavedKeys(router.providerConfigs().filter((p) => p.hosted).map((p) => p.apiKeyRef ?? ""));
  const lab = new CapabilityLab(store, bus, router, objects, path.join(dataDir, "capability-lab"));
  const knowledge = new KnowledgeService(store, bus, router);
  const research = new ResearchService(store, bus, approvals, knowledge, router);
  const verifier = new Verifier(store, bus, artifacts, runner, processes, projects, router);
  // MCP servers you connect (Prompts & Skills → Tools): extra tools for the roles you choose.
  const mcp = new McpManager(store);
  const orchestratorDeps: OrchestratorDeps = { store, bus, router, lab, projects, snapshots, ops, runner, processes, approvals, verifier, knowledge, mcp };
  const orchestrator = new Orchestrator(orchestratorDeps);

  // Repo Report (ported from FlowAgent): its tables live in this database (migration 4), its files beside it, and it
  // reads products through the router under the repository_analyst role. A hosted model is used only for a run whose
  // "external research" setting is on. Creating the manager closes off runs a previous daemon left mid-flight: they
  // are recorded as failed with the reason, rather than left looking as if they were still going.
  setArtifactRoot(path.join(dataDir, "flow-reports"));
  denyFile(path.join(dataDir, "daemon.json"));
  const flowReports = new FlowReportStore(db);
  const flowReportJobs = new AnalysisJobManager(flowReports, { model: (s) => routerModel(router, { allowHosted: s.networkResearch }), processes });

  // Enhancement ideas after a finished build, when the project allows external research.
  bus.subscribe((e) => {
    if (e.type !== "run.done" || !e.runId) return;
    void scoutIdeas({ store, bus, approvals, router, research }, e.runId).catch(() => undefined);
  });
  // Waiting ideas whose coder instruction the Planner hasn't written yet (from before it did): it writes them now, one at a time.
  void (async () => {
    for (const idea of store.approvals.where("status = 'pending'").filter((x) => x.kind === "enhancement_idea" && !x.briefBy)) {
      const yours = idea.author === "you";
      const words = yours ? (idea.reason === "Your idea." ? idea.detail || idea.action : idea.reason) : `${idea.reason}\n\nDraft instruction: ${idea.detail ?? ""}`;
      if (yours && idea.reason === "Your idea.") store.approvals.upsert({ ...idea, reason: words });
      const detail = await briefIdea({ store, router }, idea.projectId, idea.action, words, idea.runId, yours ? "you" : "researcher").catch(() => undefined);
      const now = store.approvals.get(idea.id);
      if (detail && now?.status === "pending") store.approvals.upsert({ ...now, detail, briefBy: "planner" });
    }
  })();

  // Seed versioned built-in prompts and skills into the library (idempotent).
  const newer = (a: string, b: string) => {
    const [x, y] = [a, b].map((v) => v.split(".").map(Number));
    for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    return false;
  };
  // Changing a built-in's text needs a new version number: the library refuses one version with two texts, and an
  // install only takes a built-in with a newer version (Coder and Planner were once improved without a bump, and
  // installs kept the older text; test/builtin-versions.test.ts now guards this).
  for (const p of ROLE_PROMPTS) {
    const stored = store.prompts.get(p.id);
    const editedByYou = stored?.changelog.some((c) => /edited in library/i.test(c.note));
    if (!stored || (!editedByYou && newer(p.version, stored.version))) knowledge.savePrompt(p);
  }
  // The core built-ins, then the default skills (proposed skills that were needed, and the owner's additions).
  for (const s of [...BUILTIN_SKILLS, ...DEFAULT_SKILLS]) {
    const stored = store.skills.get(s.id);
    if (!stored) knowledge.saveSkill(s);
    // A newer built-in replaces the stored copy, unless you made it your own or edited it in the library.
    else if (stored.source !== "user" && newer(s.version, stored.version) && !stored.changelog.some((x) => /edited in library/i.test(x.note))) knowledge.saveSkill(s);
    // Stored built-ins from before roles/triggers existed get them (same version and instructions, so no new version).
    else if (stored.source !== "user" && !stored.triggers?.length && stored.version === s.version && stored.instructions === s.instructions) store.skills.upsert({ ...stored, roles: s.roles, triggers: s.triggers, enabled: stored.enabled ?? true, source: "builtin" });
  }

  const app = { dataDir, db, store, bus, objects, artifacts, approvals, processes, runner, projects, snapshots, ops, router, lab, knowledge, research, verifier, orchestrator, flowReports, flowReportJobs, mcp };
  return app;
}

export type App = ReturnType<typeof createApp>;
