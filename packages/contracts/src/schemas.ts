/**
 * Runtime schemas for every persisted entity and untrusted boundary (PRD §9, §16 "Validation").
 * Types are inferred from schemas so the runtime contract and the static contract never drift.
 */
import { z } from "zod";

export const IsoDate = z.string();
export const Id = z.string().min(1);

// ───────────────────────────── Status enums ─────────────────────────────

export const RunStatus = z.enum([
  "draft",
  "awaiting_approval",
  "running",
  "recovering",
  "verifying",
  "done",
  "done_with_warnings",
  // Finished, but a check couldn't run (no credit, model unreachable): that part of the work is not verified.
  "done_unverified",
  "blocked",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatus>;
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ["done", "done_with_warnings", "done_unverified", "failed", "cancelled"];
/** Runs that finished their work (whether or not every check could run). */
export const FINISHED_RUN_STATUSES: readonly RunStatus[] = ["done", "done_with_warnings", "done_unverified"];
export const isFinishedRun = (status?: string) => !!status && (FINISHED_RUN_STATUSES as readonly string[]).includes(status);

export const TaskStatus = z.enum([
  "pending",
  "running",
  "attempted",
  "awaiting_approval",
  "blocked",
  "failed",
  "verified",
  "invalidated",
  "skipped",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const AgentRole = z.enum([
  "planner",
  "researcher",
  "repository_analyst",
  "coder",
  "debugger",
  "reviewer",
  "designer",
  "critic",
  "security_qa",
  "accessibility_qa",
  "compliance_triage",
  "documenter",
]);
export type AgentRole = z.infer<typeof AgentRole>;

export const RiskLevel = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

// ───────────────────────────── Projects ─────────────────────────────

export const ProjectType = z.enum([
  "static_html",
  "node_package",
  "vite",
  "react",
  "nextjs",
  "angular",
  "electron",
  "tauri",
  "python",
  /** Uses PostgreSQL (detected alongside the project type, never the type itself). */
  "postgres",
  "monorepo",
  "unknown",
  "incomplete",
]);
export type ProjectType = z.infer<typeof ProjectType>;

export const ProjectSettings = z.object({
  allowExternalResearch: z.boolean().default(false),
  allowHostedModels: z.boolean().default(false),
  maxSameFingerprintAttempts: z.number().int().min(1).max(10).default(3),
  commandTimeoutMs: z.number().int().min(1000).max(3_600_000).default(300_000),
  outputCapBytes: z.number().int().min(1024).max(50_000_000).default(2_000_000),
  extraSecretPatterns: z.array(z.string()).default([]),
  modelOverrides: z.record(z.string(), z.lazy(() => ModelAssignment)).default({}),
  persistentApprovals: z.array(z.string()).default([]),
  /**
   * Autonomy level (PRD §5.1 "approve meaningful risk", open question 5). Hard limits never change:
   * never-tier commands are blocked and data-leaving-the-machine actions always ask.
   */
  autonomy: z.enum(["supervised", "assisted", "autonomous"]).default("supervised"),
});
export type ProjectSettings = z.infer<typeof ProjectSettings>;

export const Project = z.object({
  id: Id,
  name: z.string().min(1).max(200),
  workspaceRef: z.string(),
  projectType: ProjectType.optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  settings: ProjectSettings,
});
export type Project = z.infer<typeof Project>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(200),
  workspacePath: z.string().optional(),
  createWorkspace: z.boolean().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const PackageManager = z.enum(["npm", "pnpm", "yarn", "bun", "pip", "none"]);
export type PackageManager = z.infer<typeof PackageManager>;

export const ScriptClass = z.enum(["typecheck", "lint", "test", "build", "dev", "start", "preview", "format", "install_hook", "unknown"]);
export type ScriptClass = z.infer<typeof ScriptClass>;

export const ScriptRecord = z.object({
  name: z.string(),
  command: z.string(),
  classification: ScriptClass,
  policy: z.enum(["auto", "ask", "never"]),
  reasons: z.array(z.string()),
  /** Run this command directly instead of `<package manager> run <name>` (checks FlowCode adds, or a safer form). */
  argv: z.array(z.string()).optional(),
  /** Added by FlowCode because the project has no script for this check (not in package.json). */
  builtIn: z.boolean().optional(),
});
export type ScriptRecord = z.infer<typeof ScriptRecord>;

export const PreviewStrategy = z.enum(["vite_dev", "next_dev", "angular_dev", "static_server", "npm_start", "none"]);
export type PreviewStrategy = z.infer<typeof PreviewStrategy>;

export const PreflightRecord = z.object({
  id: Id,
  projectId: Id,
  projectType: ProjectType,
  detectedTypes: z.array(ProjectType),
  manifestValid: z.boolean(),
  manifestErrors: z.array(z.string()),
  packageManager: PackageManager,
  scripts: z.array(ScriptRecord),
  previewStrategy: PreviewStrategy,
  allowedChecks: z.array(z.string()),
  missingPrerequisites: z.array(z.string()),
  hasNodeModules: z.boolean(),
  gitAvailable: z.boolean(),
  createdAt: IsoDate,
});
export type PreflightRecord = z.infer<typeof PreflightRecord>;

// ───────────────────────────── Models ─────────────────────────────

export const ProviderKind = z.enum(["ollama", "openai_compatible", "anthropic", "scripted"]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const ModelAssignment = z.object({
  providerId: z.string(),
  model: z.string(),
  version: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  contextWindow: z.number().int().optional(),
  /** Model-side reasoning ("thinking") for models that support it. Part of the capability config. */
  reasoning: z.boolean().optional(),
});
export type ModelAssignment = z.infer<typeof ModelAssignment>;

export const ProviderConfig = z.object({
  id: z.string(),
  kind: ProviderKind,
  label: z.string(),
  baseUrl: z.string().optional(),
  /** Hosted providers are disabled until configured and consented (PRD §8.1). */
  enabled: z.boolean(),
  hosted: z.boolean(),
  apiKeyRef: z.string().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const ProviderErrorKind = z.enum([
  "cancelled",
  "timeout",
  "connection_refused",
  "connection_reset",
  "dns_failure",
  "rate_limited",
  "quota_exhausted",
  "invalid_response",
  "context_limit",
  "tool_call_invalid",
  "out_of_memory",
  "unknown",
]);
export type ProviderErrorKind = z.infer<typeof ProviderErrorKind>;

export const CapabilityProbeName = z.enum([
  "structured_read_file",
  "structured_create_file",
  "contextual_patch",
  "protected_manifest_edit",
  "tool_result_follow_up",
  "approval_request",
  "safe_command_result_interpretation",
  "bounded_repair_loop",
]);
export type CapabilityProbeName = z.infer<typeof CapabilityProbeName>;

export const CapabilityProbeResult = z.object({
  probe: CapabilityProbeName,
  passed: z.boolean(),
  detail: z.string(),
  durationMs: z.number(),
});
export type CapabilityProbeResult = z.infer<typeof CapabilityProbeResult>;

export const CapabilityRecord = z.object({
  id: Id,
  providerId: z.string(),
  model: z.string(),
  modelVersion: z.string().optional(),
  configHash: z.string(),
  /** Whether the probe ran with the model's reasoning on. The config hash counts it, so a record only fits an assignment that matches. */
  reasoning: z.boolean().optional(),
  passed: z.boolean(),
  nativeToolCalls: z.boolean(),
  vision: z.boolean(),
  results: z.array(CapabilityProbeResult),
  createdAt: IsoDate,
});
export type CapabilityRecord = z.infer<typeof CapabilityRecord>;

// ───────────────────────────── Runs, tasks, plans ─────────────────────────────

export const AcceptanceCriterion = z.object({
  id: z.string(),
  description: z.string(),
  /** How the criterion is proven: a path must exist, a command must pass, a file must contain text, or a verification kind must pass. */
  check: z.discriminatedUnion("type", [
    z.object({ type: z.literal("file_exists"), path: z.string() }),
    z.object({ type: z.literal("file_contains"), path: z.string(), text: z.string() }),
    /** For removals: the file must no longer contain the text (a missing file counts as not containing it). */
    z.object({ type: z.literal("file_not_contains"), path: z.string(), text: z.string() }),
    z.object({ type: z.literal("verification"), kind: z.string() }),
    z.object({ type: z.literal("manual"), note: z.string() }),
  ]),
  met: z.boolean().optional(),
  evidenceRefs: z.array(z.string()).default([]),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterion>;

export const VerificationKind = z.enum([
  "code_cleanup",
  "project_preflight",
  "manifest_validation",
  "install",
  "typecheck",
  "lint",
  "tests",
  "build",
  "server_start",
  "preview_health",
  "accessibility",
  "screenshots",
  "visual_critique",
  "design_qa",
  "security_scan",
  "compliance_triage",
  "seo",
  "spec_fidelity",
  "app_wiring",
  "final_report",
]);
export type VerificationKind = z.infer<typeof VerificationKind>;

export const VerificationPlan = z.object({
  kinds: z.array(VerificationKind),
  notes: z.string().optional(),
});
export type VerificationPlan = z.infer<typeof VerificationPlan>;

export const Blocker = z.object({
  reason: z.string(),
  category: z.enum(["prerequisite", "policy", "approval_denied", "no_progress", "model", "verification", "user", "unknown"]),
  evidenceRefs: z.array(z.string()).default([]),
  nextAction: z.string(),
});
export type Blocker = z.infer<typeof Blocker>;

export const Task = z.object({
  id: Id,
  runId: Id,
  parentTaskId: z.string().optional(),
  title: z.string(),
  objective: z.string(),
  status: TaskStatus,
  dependsOn: z.array(z.string()),
  expectedPaths: z.array(z.string()),
  actualPaths: z.array(z.string()),
  acceptanceCriteria: z.array(AcceptanceCriterion),
  validationPlan: VerificationPlan,
  checkpointId: z.string().optional(),
  /** PRD section ids this task implements. */
  specSections: z.array(z.string()).optional(),
  blocker: Blocker.optional(),
  role: AgentRole.default("coder"),
  ordinal: z.number().int().default(0),
  attempts: z.number().int().default(0),
});
export type Task = z.infer<typeof Task>;

export const ExecutionStrategy = z.object({
  kind: z.enum(["template_build", "spec_build", "existing_repo_change", "debug", "research", "iterate"]),
  previewStrategy: PreviewStrategy,
  requiredChecks: z.array(VerificationKind),
  templateId: z.string().optional(),
});
export type ExecutionStrategy = z.infer<typeof ExecutionStrategy>;

export const PlanTask = z.object({
  key: z.string(),
  title: z.string(),
  objective: z.string(),
  dependsOn: z.array(z.string()).default([]),
  expectedPaths: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(AcceptanceCriterion.omit({ met: true, evidenceRefs: true })).default([]),
  verification: z.array(VerificationKind).default([]),
  role: AgentRole.default("coder"),
  /** PRD section ids this task implements (e.g. "3.3"); the step receives only these sections. */
  sections: z.array(z.string()).optional(),
});
export type PlanTask = z.infer<typeof PlanTask>;

/** What the planner read in the PRD and what it is (and isn't) going to build, shown on the plan approval card. */
/** How a request was classified when it was planned (agent prompt, skill and specification system). */
export const PlanClassification = z.object({
  primary: z.enum(["task_note", "saved_prompt", "feature_spec", "product_spec"]),
  label: z.string(),
  concepts: z.array(z.string()).default([]),
  /** Skills every coding step of this run gets, whatever its wording. */
  skills: z.array(z.string()).default([]),
  /** Build prompts (request templates) whose guidance the planner got, e.g. parallax-scroll. */
  prompts: z.array(z.string()).default([]),
  specNeeded: z.boolean(),
  specAttached: z.boolean().default(false),
  note: z.string().optional(),
  words: z.number().optional(),
});
export type PlanClassification = z.infer<typeof PlanClassification>;

export const PlanBrief = z.object({
  feature: z.string().default(""),
  sections: z.array(z.string()).default([]),
  requirements: z.array(z.object({ text: z.string(), section: z.string().default("") })).default([]),
  assumptions: z.array(z.string()).default([]),
  ambiguities: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});
export type PlanBrief = z.infer<typeof PlanBrief>;

/** FR-A2: structured plan before any mutation. */
export const ImplementationPlan = z.object({
  goal: z.string(),
  assumptions: z.array(z.string()),
  relevantFiles: z.array(z.string()),
  expectedChanges: z.array(z.string()),
  risk: RiskLevel,
  riskNotes: z.array(z.string()).default([]),
  validationPlan: z.array(VerificationKind),
  rollbackStrategy: z.string(),
  tasks: z.array(PlanTask).min(1),
  brief: PlanBrief.optional(),
  classification: PlanClassification.optional(),
});
export type ImplementationPlan = z.infer<typeof ImplementationPlan>;

export const Run = z.object({
  id: Id,
  projectId: Id,
  objective: z.string(),
  status: RunStatus,
  strategy: ExecutionStrategy.optional(),
  modelAssignments: z.record(z.string(), ModelAssignment),
  currentTaskId: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  /** Why the build is in its current state, in plain words (who stopped it and why, what it is waiting for). */
  statusReason: z.string().max(2000).optional(),
  safeCheckpointId: z.string().optional(),
  plan: ImplementationPlan.optional(),
  planApproved: z.boolean().default(false),
  constraints: z.array(z.string()).default([]),
  createdAt: IsoDate,
  parentRunId: z.string().optional(),
  /** Who asked for this change: "you" when the person typed it (taste memory learns only from these), absent otherwise. */
  origin: z.enum(["you", "flowcode"]).optional(),
  attachedKnowledgeIds: z.array(z.string()).default([]),
  /** Workspace-relative paths of imported reference files (spec/…, src/content/…). */
  referencePaths: z.array(z.string()).default([]),
});
export type Run = z.infer<typeof Run>;

/** A file supplied with a request (PRD, design reference, content, styles) — §5.1 "optional references". */
export const ReferenceFile = z.object({
  name: z.string().min(1).max(200),
  /** "image": a screenshot or mockup (base64) the style is captured from; it isn't copied into the workspace. */
  role: z.enum(["prd", "html", "css", "json", "text", "image"]),
  content: z.string().max(2_000_000),
});
export type ReferenceFile = z.infer<typeof ReferenceFile>;

export const CreateRunInput = z.object({
  projectId: Id,
  objective: z.string().min(1).max(20_000),
  constraints: z.array(z.string()).default([]),
  kind: ExecutionStrategy.shape.kind.optional(),
  templateId: z.string().optional(),
  parentRunId: z.string().optional(),
  origin: z.enum(["you", "flowcode"]).optional(),
  attachedKnowledgeIds: z.array(z.string()).default([]),
  modelAssignments: z.record(z.string(), ModelAssignment).optional(),
  references: z.array(ReferenceFile).max(20).default([]),
});
export type CreateRunInput = z.input<typeof CreateRunInput>;

// ───────────────────────────── Commands, tools ─────────────────────────────

export const PolicyTier = z.enum(["auto", "ask", "never"]);
export type PolicyTier = z.infer<typeof PolicyTier>;

export const CommandStatus = z.enum(["queued", "awaiting_approval", "running", "succeeded", "failed", "timed_out", "cancelled", "blocked"]);
export type CommandStatus = z.infer<typeof CommandStatus>;

export const CommandRecord = z.object({
  id: Id,
  runId: Id,
  taskId: z.string().optional(),
  phase: z.string().optional(),
  argv: z.array(z.string()),
  cwdRelativePath: z.string(),
  policyTier: PolicyTier,
  policyReasons: z.array(z.string()).default([]),
  status: CommandStatus,
  approvalId: z.string().optional(),
  exitCode: z.number().optional(),
  durationMs: z.number().optional(),
  outputPreview: z.string().optional(),
  outputHash: z.string().optional(),
  errorFingerprint: z.string().optional(),
  retryOf: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: IsoDate,
});
export type CommandRecord = z.infer<typeof CommandRecord>;

export const ToolCallStatus = z.enum(["requested", "completed", "rejected", "failed", "cancelled"]);
export const ToolCallRecord = z.object({
  id: Id,
  runId: Id,
  taskId: z.string().optional(),
  agentRole: AgentRole,
  modelAssignment: ModelAssignment,
  toolName: z.string(),
  argsRedacted: z.unknown(),
  resultSummaryRedacted: z.string().optional(),
  status: ToolCallStatus,
  idempotencyKey: z.string().optional(),
  startedAt: IsoDate,
  completedAt: z.string().optional(),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecord>;

// ───────────────────────────── Approvals ─────────────────────────────

/** enhancement_idea: an improvement FlowCode found (external research on); approving it starts a follow-up request. */
export const ApprovalKind = z.enum(["plan", "command", "file_operation", "external_research", "hosted_model", "retry_override", "dependency_install", "enhancement_idea"]);
export type ApprovalKind = z.infer<typeof ApprovalKind>;

export const ApprovalScope = z.enum(["once", "project", "deny"]);
export type ApprovalScope = z.infer<typeof ApprovalScope>;

/** PRD §14.4 approval card fields. */
export const Approval = z.object({
  id: Id,
  runId: z.string().optional(),
  projectId: Id,
  taskId: z.string().optional(),
  kind: ApprovalKind,
  action: z.string(),
  reason: z.string(),
  affected: z.array(z.string()),
  risk: RiskLevel,
  detail: z.string().optional(),
  consequencesOfDenial: z.string(),
  status: z.enum(["pending", "approved", "denied", "expired"]),
  decisionScope: ApprovalScope.optional(),
  persistKey: z.string().optional(),
  /** An idea kept for later: still pending, listed under "Saved for later" until built or dismissed. */
  savedForLater: z.boolean().optional(),
  /** Who suggested an idea: FlowCode (default) or the person. */
  author: z.enum(["flowcode", "you"]).optional(),
  /** Which agent wrote an idea's instruction for the coder (the Planner, once it has). */
  briefBy: z.literal("planner").optional(),
  createdAt: IsoDate,
  resolvedAt: z.string().optional(),
});
export type Approval = z.infer<typeof Approval>;

export const ApprovalDecisionInput = z.object({
  decision: ApprovalScope,
  note: z.string().max(2000).optional(),
  /** The exact action the person saw. If it no longer matches the record, the decision is refused. */
  action: z.string().max(20_000).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInput>;

// ───────────────────────────── Verification ─────────────────────────────

export const VerificationStatus = z.enum(["pending", "running", "passed", "passed_with_warnings", "failed", "blocked", "skipped", "not_run"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const VerificationCheck = z.object({
  id: Id,
  runId: Id,
  taskId: z.string().optional(),
  kind: VerificationKind,
  required: z.boolean(),
  status: VerificationStatus,
  evidenceRefs: z.array(z.string()),
  summary: z.string(),
  updatedAt: IsoDate,
});
export type VerificationCheck = z.infer<typeof VerificationCheck>;

// ───────────────────────────── Snapshots ─────────────────────────────

export const Snapshot = z.object({
  id: Id,
  runId: z.string(),
  taskId: z.string().optional(),
  relativePath: z.string(),
  /** Hash of content before mutation ("absent" when the file did not exist). */
  contentHash: z.string(),
  postContentHash: z.string().optional(),
  priorContentRef: z.string().optional(),
  operationId: z.string(),
  toolCallId: z.string().optional(),
  operation: z.string(),
  restoredAt: z.string().optional(),
  createdAt: IsoDate,
});
export type Snapshot = z.infer<typeof Snapshot>;

export const Checkpoint = z.object({
  id: Id,
  runId: Id,
  taskId: z.string().optional(),
  label: z.string(),
  safe: z.boolean(),
  /** Snapshot ids created up to this point; restoring the checkpoint rewinds every later snapshot. */
  snapshotSeq: z.number().int(),
  createdAt: IsoDate,
});
export type Checkpoint = z.infer<typeof Checkpoint>;

// ───────────────────────────── Knowledge ─────────────────────────────

export const Provenance = z.object({
  kind: z.enum(["url", "file", "run", "task", "user", "agent"]),
  ref: z.string(),
  title: z.string().optional(),
  retrievedAt: z.string().optional(),
  quote: z.string().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

export const KnowledgeKind = z.enum(["source", "claim", "decision", "note", "architecture", "skill", "prompt", "snippet", "glossary", "entity"]);
export const KnowledgeItem = z.object({
  id: Id,
  scope: z.enum(["global", "project", "run"]),
  projectId: z.string().optional(),
  kind: KnowledgeKind,
  title: z.string(),
  content: z.string(),
  provenance: z.array(Provenance),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  tags: z.array(z.string()),
  linkedEntityIds: z.array(z.string()),
  /** FR-K5: durable facts require evidence and/or user confirmation. */
  durability: z.enum(["temporary", "durable"]).default("temporary"),
  confirmedByUser: z.boolean().default(false),
  pinned: z.boolean().default(false),
  excluded: z.boolean().default(false),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type KnowledgeItem = z.infer<typeof KnowledgeItem>;

export const CreateKnowledgeInput = KnowledgeItem.pick({ scope: true, kind: true, title: true, content: true, tags: true }).extend({
  projectId: z.string().optional(),
  provenance: z.array(Provenance).default([]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  linkedEntityIds: z.array(z.string()).default([]),
  durability: z.enum(["temporary", "durable"]).default("temporary"),
  confirmedByUser: z.boolean().default(false),
});
export type CreateKnowledgeInput = z.infer<typeof CreateKnowledgeInput>;

export const PromptSpec = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  purpose: z.string(),
  owner: z.string().default("local"),
  scope: z.enum(["global", "project"]).default("global"),
  projectId: z.string().optional(),
  roles: z.array(AgentRole),
  tags: z.array(z.string()).default([]),
  inputs: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  template: z.string(),
  outputSchema: z.string().optional(),
  modelGuidance: z.string().optional(),
  examples: z.array(z.object({ fixture: z.string() })).default([]),
  evaluations: z.array(z.record(z.string(), z.unknown())).default([]),
  changelog: z.array(z.object({ version: z.string(), date: z.string(), note: z.string() })).default([]),
});
export type PromptSpec = z.infer<typeof PromptSpec>;

export const SkillSpec = z.object({
  id: z.string(),
  version: z.string(),
  purpose: z.string(),
  instructions: z.string(),
  allowedTools: z.array(z.string()),
  inputSchema: z.string(),
  outputSchema: z.string(),
  policies: z.object({
    network: z.enum(["denied", "approval_required"]),
    filesystem: z.enum(["read_workspace_only", "governed_write"]),
  }),
  acceptance: z.array(z.string()),
  tests: z.array(z.object({ name: z.string(), fixture: z.string(), expect: z.string() })).default([]),
  changelog: z.array(z.object({ version: z.string(), date: z.string(), note: z.string() })).default([]),
  /** Agent roles this skill applies to; empty = any role. */
  roles: z.array(z.string()).default([]),
  /** Words or phrases that make this skill relevant to a task (matched against the task title and objective). */
  triggers: z.array(z.string()).default([]),
  /** Disabled skills stay in the library but are never given to agents. */
  enabled: z.boolean().default(true),
  source: z.enum(["builtin", "user"]).default("builtin"),
});
export type SkillSpec = z.infer<typeof SkillSpec>;

export const ResearchJob = z.object({
  id: Id,
  projectId: Id,
  question: z.string(),
  status: z.enum(["planned", "awaiting_approval", "running", "completed", "blocked", "failed"]),
  queryPlan: z.object({
    queries: z.array(z.string()),
    sourceCategories: z.array(z.string()),
    intendedQuestions: z.array(z.string()),
  }),
  approvalId: z.string().optional(),
  resultKnowledgeIds: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  createdAt: IsoDate,
});
export type ResearchJob = z.infer<typeof ResearchJob>;

// ───────────────────────────── Quality findings ─────────────────────────────

export const Finding = z.object({
  id: z.string(),
  category: z.enum(["accessibility", "design", "security", "compliance", "seo", "architecture", "quality"]),
  rule: z.string(),
  severity: z.enum(["critical", "serious", "moderate", "minor", "info"]),
  confidence: z.enum(["high", "medium", "low"]),
  message: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  evidence: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  manualValidationRequired: z.boolean().default(false),
  source: z.enum(["static", "browser", "critique"]),
});
export type Finding = z.infer<typeof Finding>;

// ───────────────────────────── Process ownership ─────────────────────────────

export const OwnedProcess = z.object({
  id: Id,
  runId: z.string(),
  commandId: z.string().optional(),
  pid: z.number(),
  port: z.number().optional(),
  argv: z.array(z.string()),
  kind: z.enum(["command", "server", "browser"]),
  state: z.enum(["running", "exited", "killed", "kill_failed"]),
  cleanupResult: z.string().optional(),
  startedAt: IsoDate,
  endedAt: z.string().optional(),
});
export type OwnedProcess = z.infer<typeof OwnedProcess>;
