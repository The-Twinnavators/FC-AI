import * as C from "@flowcode/contracts";
import { Db, DocRepo } from "./db.js";

/** Typed repositories for every persisted entity. */
export class Store {
  readonly projects: DocRepo<C.Project>;
  readonly preflights: DocRepo<C.PreflightRecord>;
  readonly runs: DocRepo<C.Run>;
  readonly tasks: DocRepo<C.Task>;
  readonly commands: DocRepo<C.CommandRecord>;
  readonly toolCalls: DocRepo<C.ToolCallRecord>;
  readonly approvals: DocRepo<C.Approval>;
  readonly checks: DocRepo<C.VerificationCheck>;
  readonly snapshots: DocRepo<C.Snapshot & { projectId: string; seq: number }>;
  readonly checkpoints: DocRepo<C.Checkpoint>;
  readonly processes: DocRepo<C.OwnedProcess>;
  readonly capabilities: DocRepo<C.CapabilityRecord>;
  readonly providers: DocRepo<C.ProviderConfig>;
  readonly knowledge: DocRepo<C.KnowledgeItem>;
  readonly prompts: DocRepo<C.PromptSpec>;
  readonly skills: DocRepo<C.SkillSpec>;
  readonly research: DocRepo<C.ResearchJob>;
  readonly artifacts: DocRepo<ArtifactRecord>;

  constructor(readonly db: Db) {
    const p = <T>(schema: { parse: (v: unknown) => T }) => (v: unknown) => schema.parse(v);
    this.projects = new DocRepo(db, "projects", p(C.Project));
    this.preflights = new DocRepo(db, "preflights", p(C.PreflightRecord), { project_id: (e) => e.projectId });
    this.runs = new DocRepo(db, "runs", p(C.Run), { project_id: (e) => e.projectId, status: (e) => e.status });
    this.tasks = new DocRepo(db, "tasks", p(C.Task), { run_id: (e) => e.runId, status: (e) => e.status, ordinal: (e) => e.ordinal });
    this.commands = new DocRepo(db, "commands", p(C.CommandRecord), {
      run_id: (e) => e.runId,
      task_id: (e) => e.taskId,
      status: (e) => e.status,
      fingerprint: (e) => e.errorFingerprint,
    });
    this.toolCalls = new DocRepo(db, "tool_calls", p(C.ToolCallRecord), {
      run_id: (e) => e.runId,
      task_id: (e) => e.taskId,
      idempotency_key: (e) => e.idempotencyKey,
    });
    this.approvals = new DocRepo(db, "approvals", p(C.Approval), { project_id: (e) => e.projectId, run_id: (e) => e.runId, status: (e) => e.status });
    this.checks = new DocRepo(db, "verification_checks", p(C.VerificationCheck), { run_id: (e) => e.runId, kind: (e) => e.kind });
    this.snapshots = new DocRepo(
      db,
      "snapshots",
      (v) => {
        const o = v as Record<string, unknown>;
        return { ...C.Snapshot.parse(o), projectId: String(o.projectId), seq: Number(o.seq) };
      },
      { run_id: (e) => e.runId, task_id: (e) => e.taskId, project_id: (e) => e.projectId, seq: (e) => e.seq },
    );
    this.checkpoints = new DocRepo(db, "checkpoints", p(C.Checkpoint), { run_id: (e) => e.runId });
    this.processes = new DocRepo(db, "processes", p(C.OwnedProcess), { run_id: (e) => e.runId, state: (e) => e.state });
    this.capabilities = new DocRepo(db, "capabilities", p(C.CapabilityRecord), {
      provider_id: (e) => e.providerId,
      model: (e) => e.model,
      config_hash: (e) => e.configHash,
    });
    this.providers = new DocRepo(db, "providers", p(C.ProviderConfig));
    this.knowledge = new DocRepo(db, "knowledge", p(C.KnowledgeItem), { scope: (e) => e.scope, project_id: (e) => e.projectId, kind: (e) => e.kind });
    this.prompts = new DocRepo(db, "prompts", p(C.PromptSpec), { version: (e) => e.version });
    this.skills = new DocRepo(db, "skills", p(C.SkillSpec), { version: (e) => e.version });
    this.research = new DocRepo(db, "research_jobs", p(C.ResearchJob), { project_id: (e) => e.projectId });
    this.artifacts = new DocRepo(db, "artifacts", (v) => v as ArtifactRecord, { run_id: (e) => e.runId, kind: (e) => e.kind });
  }

  getSetting<T>(key: string, fallback: T): T {
    const row = this.db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
    return row ? (JSON.parse(row.value) as T) : fallback;
  }

  setSetting(key: string, value: unknown) {
    this.db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
  }

  nextSnapshotSeq(): number {
    const row = this.db.get<{ m: number | null }>("SELECT MAX(seq) AS m FROM snapshots");
    return Number(row?.m ?? 0) + 1;
  }
}

export interface ArtifactRecord {
  id: string;
  runId?: string;
  kind: "screenshot" | "report_md" | "report_pdf" | "report_json" | "log" | "axe" | "diagnostic" | "repository_map" | "other";
  label: string;
  contentRef: string;
  mime: string;
  bytes: number;
  createdAt: string;
  meta?: Record<string, unknown>;
}
