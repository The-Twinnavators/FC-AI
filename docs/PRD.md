# Local-First LLM IDE — Product Requirements, Technical Specification & Implementation Plan

**Document status:** Draft v1.0  
**Date:** 2026-10-01  
**Audience:** Product, design, engineering, security, and AI-platform teams  
**Working name:** Forge IDE (replace with product name)

---

## 1. Executive Summary

Forge IDE is a local-first, AI-native integrated development environment that helps a developer or product builder move from an idea, bug report, design reference, or existing repository to a working, verified software change.

It combines the core surfaces of an IDE—workspace, files, editor integration, terminal, preview, test output, Git changes, and debugging context—with a governed multi-agent runtime. Agents can research, plan, implement, validate, critique, document, and iterate, but they operate through explicit tools, permissions, checkpoints, and evidence-backed completion gates.

The product must not confuse plausible model narration with completed work. A request is considered complete only when the required artifacts and verification evidence exist: source changes, command records, test/build results, preview health, screenshots when relevant, and a final report.

### Product promise

> Give Forge a request, approve meaningful risk, watch it work, intervene at any point, and receive a runnable, inspectable, reversible result—or a precise explanation of what blocked it.

### Non-goals for v1

- Fully unattended execution on arbitrary production infrastructure
- Silent dependency installation, deployment, database migration, or Git push
- Replacing a mature language-specific IDE/editor on day one
- Claiming legal compliance, security certification, or accessibility conformance solely from static analysis
- Sending repository source code to external model/research providers without explicit user consent

---

## 2. Goals and Success Metrics

### 2.1 Product goals

1. **End-to-end delivery:** Convert bounded requests into working, locally verifiable code changes.
2. **Local control:** Keep workspace control, tool execution, logs, and artifacts on the user’s machine by default.
3. **Trust through evidence:** Show exactly what agents read, changed, ran, learned, and could not verify.
4. **Safe autonomy:** Let agents work independently inside a constrained workspace while requiring approval for consequential operations.
5. **Persistent intelligence:** Store reusable project knowledge, skills, prompts, decisions, research, and run history.
6. **Quality by design:** Make accessibility, privacy, security, visual quality, and product requirements first-class checks.

### 2.2 North-star metric

**Verified Build Completion Rate:** percentage of eligible, bounded build requests that reach `Done` with all required verification gates passing.

### 2.3 Initial success metrics

| Metric | MVP target | Measurement |
|---|---:|---|
| Coder capability preflight pass rate | Visible before every run | Persistent capability profile |
| Golden-path completion rate | ≥ 70% on supported template + tested model | Clean workspace benchmark runs |
| Unsafe operation prevention | 100% in test suite | Policy/security regression tests |
| Protected-file corruption | 0 | Snapshot/validator records |
| False “Done” claims | 0 | Completion-gate audit |
| Cancellation cleanup | ≥ 99% tracked processes stopped | Process ownership records |
| Mean recovery clarity | User can identify next action in < 2 minutes | Moderated usability test |
| Critical/serious accessibility issues in product UI | 0 | Automated axe + manual review |

---

## 3. Users and Jobs

### 3.1 Primary users

| User | Primary job | Need |
|---|---|---|
| Product builder | Turn a product request into a working prototype | Planning, code generation, visual review, clear checkpoints |
| Front-end/full-stack developer | Implement, debug, refactor, and verify changes faster | Files, diffs, terminal, tests, controlled agent collaboration |
| UX/product designer | Convert flows and references into high-quality UI | Design directions, screenshot review, accessibility and visual QA |
| Technical founder | Maintain several codebases with limited engineering bandwidth | Repository intelligence, task planning, reliable automation, reports |
| Engineering lead | Review agent work safely | Evidence, approvals, diffs, policy, audit history |

### 3.2 Jobs to be done

- When I have a feature request, help me turn it into a scoped implementation plan, then implement and verify it.
- When a build or test fails, identify the smallest evidence-backed root cause and attempt bounded repairs.
- When I inherit a repository, map the architecture, workflows, risks, and next actions.
- When I need research, collect trustworthy sources, extract findings, and retain reusable knowledge.
- When I need to modify code, let me approve changes and restore a known-good checkpoint.
- When I need UI quality, evaluate responsive behavior, accessibility, design-system adherence, and visual regressions.
- When a task cannot be completed safely, tell me why, what was tried, what changed, and what I should decide next.

---

## 4. Product Scope

### 4.1 Core modules

1. **Workspace & File Management**
2. **Agent Workbench**
3. **Task Planning & Orchestration**
4. **Model Router & Capability Lab**
5. **Knowledge, Search, Prompts & Skills**
6. **Governed Execution Runtime**
7. **Verification & Quality Assurance**
8. **Preview, Screenshots & Visual Review**
9. **Reports, Audit Trail & Handoff**
10. **Settings, Permissions & Provider Connections**

### 4.2 Product surfaces

| Surface | User purpose |
|---|---|
| Home / Projects | Open, create, import, and monitor workspaces |
| Workspace | Files, task, chat, diff, terminal, preview, tests, activity, approvals |
| Agent panel | Assign roles, inspect plans, monitor agent handoffs |
| Knowledge hub | Search sources, notes, decisions, snippets, skills, project memory |
| Prompt & Skill library | Create, version, test, share, and attach reusable workflows |
| Quality center | Accessibility, design QA, security, compliance, SEO, architecture checks |
| Reports | Export run, project, quality, and repository intelligence reports |
| Settings | Models, providers, permissions, workspace defaults, retention, privacy |

---

## 5. Core User Flows

### 5.1 New build request

```text
User creates project / selects workspace
→ enters request, constraints, and optional references
→ system classifies scope and runs project/model preflight
→ planner produces implementation plan and acceptance criteria
→ user approves plan and consequential operations
→ orchestrator executes checkpointed tasks
→ coder uses governed tools to inspect/edit/run
→ verifier validates each task
→ user reviews preview, diffs, screenshots, and approvals
→ quality agents run required checks
→ Done report and run instructions are generated
```

### 5.2 Existing repository feature request

```text
Open local repository
→ repository map + project-type preflight
→ request entered
→ planner reads relevant files and proposes bounded plan
→ user approves scope
→ agent implements task-by-task with snapshots
→ checks run based on verified project scripts
→ user reviews diff and preview
→ task completes, blocks, or awaits user decision
```

### 5.3 Debug request

```text
User pastes error / selects failed command / asks for diagnosis
→ debugger gathers command records, logs, relevant files, and recent diffs
→ proposes ranked hypotheses with evidence
→ user approves repair scope if needed
→ agent applies one bounded repair attempt
→ verifier reruns targeted check
→ result is recorded; repeated failure is blocked rather than looped
```

### 5.4 Research and knowledge flow

```text
User asks a question or starts a research brief
→ researcher creates query plan
→ user approves external research if required
→ search adapters retrieve sources
→ extractor stores claims, citations, timestamps, and summaries
→ curator creates reusable knowledge cards and links them to projects/tasks
→ planner can retrieve only relevant, cited knowledge for future work
```

### 5.5 Iterate on an existing result

```text
User opens a completed or blocked task
→ asks for a focused change
→ system loads task context, accepted decisions, relevant files, and checkpoints
→ planner produces delta plan
→ agent changes only approved scope
→ targeted verification runs
→ user sees new diff, evidence, and updated report
```

---

## 6. Functional Requirements

### 6.1 Workspace and repository management

**FR-W1 — Local workspace selection**
- Support native folder selection for local repositories/workspaces.
- Canonicalize selected paths; store secure local references, not exposed absolute paths in reports.
- Detect repository/project types: static HTML, Node package, Vite, React, Next.js, Electron, Tauri, Python, monorepo, unknown/incomplete.

**FR-W2 — Safe file boundary**
- All read/write paths must resolve within the selected workspace root.
- Reject traversal and symlink escapes.
- Deny `.env*`, keys, certificates, credentials, and configurable secret patterns by default.

**FR-W3 — File explorer and changes**
- Show file tree, search, changed files, Git status where available, snapshots, and semantic/text diffs.
- Support file-level and task-level rollback.

**FR-W4 — Project preflight**
- Before command execution, persist detected project type, manifest validity, package manager, known scripts, preview strategy, allowed checks, and missing prerequisites.
- Do not run Node package-manager commands without a valid recognized manifest.
- Do not run a script until it is present, classified, and allowed/approved.

### 6.2 Agent workbench

**FR-A1 — Agent roles**
- Support configurable roles: Planner, Researcher, Coder, Debugger, Reviewer, Designer, Critic, Security QA, Accessibility QA, Compliance Triage, Documenter.
- A role may use a different model/provider.
- Store model/provider/version used for every agent action.

**FR-A2 — Task plan before mutation**
- Before write/command activity, produce a structured plan with goal, assumptions, relevant files, expected changes, risk, validation plan, and rollback strategy.
- Require user approval for medium/high-risk plans.

**FR-A3 — Agent handoffs**
- Handoffs must include a compact, structured evidence packet—not entire raw chat history.
- Include task objective, accepted decisions, current state, relevant artifacts, findings, and open blockers.

**FR-A4 — Action-required contract**
- During implementation/repair, agents must either invoke an allowed tool or return a structured blocked/approval-needed result.
- Prose-only instructions, pseudo tool JSON, or attempted policy bypasses must not be treated as completed work.

### 6.3 Model routing and capability lab

**FR-M1 — Provider abstraction**
- Support local providers (e.g., Ollama) and optional hosted providers through a uniform interface.
- Model configuration is role-specific and project-overridable.

**FR-M2 — Capability preflight**
- Before a model can act as a Coder, run a disposable-workspace capability benchmark:
  - structured `read_file`
  - structured `create_file`
  - contextual patch
  - protected manifest edit
  - tool-result follow-up
  - approval request
  - safe command result interpretation
  - bounded repair loop
- Persist results by provider/model/version/configuration.
- Prevent models that fail native tool-call output from becoming default Coder models.

**FR-M3 — Typed provider errors**
- Classify cancellation, timeout, connection refusal/reset, DNS failure, rate limit, invalid response, context limit, tool-call invalidity, and unknown errors.
- Preserve sanitized cause chains and retry decisions.

**FR-M4 — Retry policy**
- Cancellation is terminal and never retries.
- Retry only bounded, explicitly retryable transport failures.
- Do not re-run side-effecting tool/command operations merely because a model request failed.

### 6.4 Prompt, skill, and knowledge management

**FR-K1 — Prompt library**
- Store prompts with title, purpose, owner, tags, version, input schema, output schema, model guidance, examples, evaluation cases, and changelog.
- Support project-scoped and global prompts.

**FR-K2 — Skill library**
- A skill is a versioned workflow: instructions, allowed tools, input/output schemas, policies, tests, and artifacts.
- Example skills: `repository-map`, `fix-typescript-error`, `audit-accessibility`, `generate-component`, `prepare-release-notes`.

**FR-K3 — Knowledge store**
- Store research sources, notes, decisions, architecture maps, glossary terms, code snippets, entities, and claims.
- Every externally sourced claim retains URL, title, retrieval date, quote/snippet, and confidence.
- Support links among knowledge items, projects, tasks, files, and decisions.

**FR-K4 — Search and retrieval**
- Provide local full-text search across files, notes, prompts, skills, run history, and knowledge cards.
- Support semantic retrieval using embeddings stored locally where practical.
- Retrieval results must show provenance and allow user pinning/exclusion.

**FR-K5 — Memory policy**
- Separate durable project facts from temporary agent context.
- Never promote speculative agent conclusions to durable memory without evidence and/or user confirmation.

### 6.5 Governed file operations

**FR-F1 — Typed operations**
- `create_file`: new path only.
- `apply_patch`: exact/contextual patch; atomic failure if context mismatches.
- `edit_json`, `edit_yaml`, `edit_toml`: parse, structured operation, validate, write.
- `edit_package_manifest`: semantic dependency/script operations only.
- `replace_file`: explicit high-risk operation with diff/snapshot/approval.
- `move_file`, `delete_file`: boundary checked, policy governed.

**FR-F2 — Snapshots**
- Snapshot existing file content before mutation.
- Store pre/post hash, operation ID, tool call ID, timestamp, task/run ID.
- Support restore of file, task, or latest safe checkpoint.

**FR-F3 — Protected files**
- Define policies for `package.json`, lockfiles, TypeScript configs, build configs, CI workflows, Docker files, secrets, and provider configurations.
- Validate protected files before and after changes.
- Reject invalid package manifests before disk write.

### 6.6 Command execution and process lifecycle

**FR-C1 — Command policy**
- Spawn using argv arrays with `shell: false`.
- Lock cwd to workspace.
- Use scrubbed environment, timeout, output cap, and process tracking.
- Policy tiers:
  - Auto: explicitly verified safe/read-only checks.
  - Ask: installs, upgrades, migrations, network actions, unknown scripts, broad deletes.
  - Never: outside-workspace access, system changes, credential access, arbitrary shell chaining, disabling checks, Git push by default.

**FR-C2 — Command record**
- Persist command ID, run/task/phase, argv, relative cwd, policy, approval, status, timestamps, duration, exit code, output hash, redacted output, error fingerprint, and retry relation.

**FR-C3 — Process ownership**
- Track child processes by run ID, port, PID, command, and lifecycle.
- Cancel/app shutdown must terminate owned processes and record cleanup result.

**FR-C4 — No-progress control**
- Normalize command failures into fingerprints.
- Stop after configurable repeated same-fingerprint attempts (default 3).
- Require material change, revised hypothesis, or user override before retry.

### 6.7 Verification and completion

**FR-V1 — Verification matrix**
- Track status for project preflight, manifest validation, install, typecheck, lint, tests, build, server start, preview health, accessibility, screenshots, visual critique, security scan, and final report.
- Status values: pending, running, passed, passed_with_warnings, failed, blocked, skipped, not_run.

**FR-V2 — Completion gate**
- `Done` is computed by deterministic policy, never declared by model prose.
- Required checks vary by project strategy, but every requirement must map to evidence.

**FR-V3 — Implementation dependency graph**
- Persist task dependencies and exit criteria.
- Example: `scaffold → dependencies → domain → features → views → polish → verification`.
- A blocked prerequisite invalidates downstream verification and prevents downstream claims of completion.

### 6.8 Quality assurance agents

**FR-Q1 — Accessibility QA**
- Static checks for semantics, labels, heading hierarchy, keyboard affordances, focus states, contrast/token use.
- Browser checks with axe where preview exists.
- Manual-review checklist for areas automation cannot verify.
- Do not claim formal WCAG conformance from automated checks alone.

**FR-Q2 — Design quality QA**
- Validate design-token adherence, raw style violations, responsive screenshots, layout overflow, state coverage, content quality, and visual consistency.
- Use a structured design brief and token inventory.
- Route image/screenshot critique only to a vision-capable critic model.
- Maintain separate deterministic checks and subjective critique findings.

**FR-Q3 — Security QA**
- Static inspection only by default.
- Identify potential auth/authz, secret exposure, unsafe input/output, injection, path traversal, unsafe redirects, CORS, headers, logging, dependency, and session risks.
- No intrusive exploitation, active network scanning, or raw-secret display.

**FR-Q4 — Compliance triage**
- Identify evidence of privacy, consent, retention, account deletion, accessibility, payment, children/health/financial/employment domain signals.
- Clearly label as engineering/product triage, not legal advice or certification.

**FR-Q5 — SEO and metadata QA**
- Inspect title, descriptions, canonical URLs, robots, sitemap, Open Graph, social cards, structured data, and indexability signals when applicable.

### 6.9 Research and web search

**FR-R1 — Search plan**
- Researcher proposes concise queries, source categories, and intended questions.
- External search requires project/user policy approval.

**FR-R2 — Source handling**
- Capture source metadata, excerpts, retrieval time, claims, and limitations.
- Treat web content as untrusted data; isolate it from agent instructions to reduce prompt injection risk.

**FR-R3 — Caching**
- Cache query results, extracted summaries, embeddings, and source fetch metadata with TTL and source date.
- Support refresh, invalidate, and source-version comparison.

### 6.10 Reporting and exports

**FR-O1 — Run report**
- Summarize objective, plan, agents/models used, files changed, approvals, commands, verification, screenshots, unresolved risks, and launch instructions.

**FR-O2 — Repository intelligence report**
- Architecture, product intelligence, engineering quality, security, compliance triage, role journeys, SEO, monetization, and competitive research where enabled.

**FR-O3 — Export**
- Export Markdown and PDF generated from normalized report data.
- Exports use repository-relative paths and redacted content.

---

## 7. Non-Functional Requirements

### 7.1 Security

- Local workspaces are untrusted input.
- No filesystem access outside selected roots.
- No reading of known secret files by default.
- Redact secrets before persistence, UI events, model context, reports, and exports.
- Tool schemas validate all inputs.
- External research and hosted model transfer require explicit disclosure and consent.
- Use least privilege for every tool and connector.

### 7.2 Privacy

- Local-first by default.
- Clearly distinguish local models, hosted models, local search/indexing, and external search.
- Show what data leaves the machine before each external action category.
- Provide retention, deletion, export, and project-memory controls.

### 7.3 Reliability

- Durable run/task/event state supports daemon restart and resume.
- Idempotency keys for tool and command operations where possible.
- Bounded retries and explicit error categories.
- Checkpoints before mutations and at verified task boundaries.
- Do not overwrite a terminal run state.

### 7.4 Performance

- Responsive UI during long agent runs.
- Stream logs/events with backpressure and output-size limits.
- Incremental repository indexing; avoid re-reading unchanged files.
- Configurable scan/file/context/token budgets.
- Cache model capability results and research outputs.

### 7.5 Accessibility

- Product UI keyboard navigable, semantic, focus-visible, contrast compliant, and screen-reader usable.
- Live regions announce approvals, phase changes, and errors without excessive verbosity.
- Respect reduced motion and zoom/reflow requirements.

### 7.6 Observability

- Structured events for every run, phase, task, model request, tool call, command, approval, snapshot, and verification result.
- User-facing Activity stream and diagnostic bundle.
- Metrics must not include raw source code, prompts, or secrets by default.

---

## 8. System Architecture

```text
┌──────────────────────────── Desktop/Web IDE UI ───────────────────────────┐
│ Projects · Workspace · Files · Agent chat · Plan · Diff · Terminal         │
│ Activity · Approvals · Preview · Tests · Knowledge · Reports · Settings    │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ IPC / HTTPS / SSE / WebSocket
┌──────────────────────────────────▼────────────────────────────────────────┐
│ Application API / Local Daemon                                              │
│ Auth boundary · Project service · Event stream · Artifact service           │
└──────────────┬───────────────────┬──────────────────────┬─────────────────┘
               │                   │                      │
┌──────────────▼────────────┐ ┌────▼─────────────────┐ ┌─▼─────────────────┐
│ Orchestrator              │ │ Knowledge Service     │ │ Model Router       │
│ Run DAG · tasks · resume  │ │ Search · RAG · skills │ │ local/hosted       │
│ approvals · policies      │ │ prompts · citations   │ │ capabilities       │
└──────────────┬────────────┘ └────┬─────────────────┘ └─┬─────────────────┘
               │                   │                      │
┌──────────────▼───────────────────▼──────────────────────▼─────────────────┐
│ Governed Runtime                                                              │
│ File service · snapshots · protected-file validators · command policy       │
│ process manager · redaction · browser/preview · tool dispatcher             │
└──────────────┬────────────────────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────────────────────┐
│ Local Workspace + Artifact Store                                              │
│ Repositories · sandbox workspaces · SQLite/Postgres metadata · object files │
│ local embeddings index · reports · screenshots · snapshots                  │
└───────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Recommended deployment model

**Preferred v1:** Desktop application with a local daemon.

- **Desktop shell:** Electron or Tauri.
- **Frontend:** React + TypeScript.
- **Daemon:** Node.js + TypeScript initially; separate process from renderer.
- **Database:** SQLite for local metadata, migrations, command/task records, and knowledge index metadata.
- **Artifacts:** Local file store with content-addressed snapshots.
- **Browser automation:** Playwright launched and owned by daemon.
- **Local model provider:** Ollama adapter.
- **Hosted providers:** Optional adapters; disabled until configured.

### 8.2 Why desktop + daemon

A browser-only application cannot safely provide native local file selection, process management, terminal execution, child-process cleanup, project sandboxing, or local-model integration at IDE depth. A daemon isolates privileged operations from the UI and creates a clean audit boundary.

---

## 9. Core Data Model

```ts
export type RunStatus =
  | "draft"
  | "awaiting_approval"
  | "running"
  | "recovering"
  | "verifying"
  | "done"
  | "done_with_warnings"
  | "blocked"
  | "failed"
  | "cancelled";

export type TaskStatus =
  | "pending"
  | "running"
  | "attempted"
  | "awaiting_approval"
  | "blocked"
  | "failed"
  | "verified"
  | "invalidated"
  | "skipped";

export interface Project {
  id: string;
  name: string;
  workspaceRef: string;
  projectType?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
}

export interface Run {
  id: string;
  projectId: string;
  objective: string;
  status: RunStatus;
  strategy?: ExecutionStrategy;
  modelAssignments: Record<AgentRole, ModelAssignment>;
  currentTaskId?: string;
  startedAt?: string;
  completedAt?: string;
  safeCheckpointId?: string;
}

export interface Task {
  id: string;
  runId: string;
  parentTaskId?: string;
  title: string;
  objective: string;
  status: TaskStatus;
  dependsOn: string[];
  expectedPaths: string[];
  actualPaths: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  validationPlan: VerificationPlan;
  checkpointId?: string;
  blocker?: Blocker;
}

export interface CommandRecord {
  id: string;
  runId: string;
  taskId?: string;
  phase?: string;
  argv: string[];
  cwdRelativePath: string;
  policyTier: "auto" | "ask" | "never";
  status: "queued" | "awaiting_approval" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled" | "blocked";
  approvalId?: string;
  exitCode?: number;
  durationMs?: number;
  outputPreview?: string;
  outputHash?: string;
  errorFingerprint?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ToolCallRecord {
  id: string;
  runId: string;
  taskId?: string;
  agentRole: AgentRole;
  modelAssignment: ModelAssignment;
  toolName: string;
  argsRedacted: unknown;
  resultSummaryRedacted?: string;
  status: "requested" | "completed" | "rejected" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
}

export interface VerificationCheck {
  id: string;
  runId: string;
  taskId?: string;
  kind: VerificationKind;
  required: boolean;
  status: "pending" | "running" | "passed" | "passed_with_warnings" | "failed" | "blocked" | "skipped" | "not_run";
  evidenceRefs: string[];
  summary: string;
}

export interface Snapshot {
  id: string;
  runId: string;
  taskId?: string;
  relativePath: string;
  contentHash: string;
  priorContentRef?: string;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  scope: "global" | "project" | "run";
  kind: "source" | "claim" | "decision" | "note" | "architecture" | "skill" | "prompt" | "snippet";
  title: string;
  content: string;
  provenance: Provenance[];
  confidence?: "high" | "medium" | "low";
  tags: string[];
  linkedEntityIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 10. Agent Architecture

### 10.1 Agent roles

| Agent | Responsibilities | Default permissions |
|---|---|---|
| Planner | Scope, requirements, tasks, risks, acceptance criteria | Read repository/knowledge; no writes/commands |
| Researcher | Search, source evaluation, synthesis, citations | External search only with approval |
| Repository Analyst | Map files, architecture, dependencies, workflows | Read-only local analysis |
| Coder | Implement bounded tasks using tools | Governed file edits and approved commands |
| Debugger | Diagnose logs/tests, propose and verify repairs | Read, targeted edits, approved commands |
| Designer | Generate design brief, directions, tokens, content strategy | No direct code execution by default |
| Critic | Evaluate screenshots against rubric | Vision model required |
| Accessibility QA | Static/browser accessibility checks | Read/verification tools |
| Security QA | Static security triage | Read/verification tools, no exploitation |
| Compliance Triage | Product/engineering controls review | Read-only, disclaimer required |
| Documenter | Release notes, README, handoff reports | Read and artifact generation |

### 10.2 Orchestration principles

- One orchestrator owns run state; agents do not independently transition phases.
- Agents cannot grant themselves permissions.
- Every agent action maps to a plan/task/acceptance criterion.
- Model output must conform to role-specific schemas.
- Every tool call is mediated by policy and logged.
- Handoff context is curated and evidenced, not raw conversation dumping.

### 10.3 Task execution loop

```text
Select next unblocked task
→ Gather minimal relevant context
→ Ask model for structured plan/action
→ Validate action against schemas, policy, task scope, and cancellation state
→ Snapshot if mutation
→ Execute tool/command
→ Store result and redacted evidence
→ Re-evaluate acceptance criteria
→ Mark verified, retry with bounded repair, block, or request approval
```

---

## 11. Prompt and Skill System

### 11.1 Prompt specification

```yaml
id: coder.repair-typescript-error
version: 1.0.0
purpose: Repair one bounded TypeScript error with evidence
roles: [coder, debugger]
inputs:
  - task
  - errorRecord
  - relevantFiles
  - projectConventions
constraints:
  - Inspect before editing
  - Use governed tools only
  - Do not refactor unrelated code
  - Use existing test patterns
outputs:
  schema: RepairResult
examples:
  - fixture: ts2322-string-date
 evaluations:
  - mustUseTool: true
  - maxFilesChanged: 4
  - requiredVerification: [typecheck]
```

### 11.2 Skill specification

```yaml
id: skill.repository-map
version: 1.0.0
purpose: Build a repository architecture map
allowedTools: [list_files, search_code, read_file]
inputSchema: RepositoryMapInput
outputSchema: RepositoryMap
policies:
  network: denied
  filesystem: read_workspace_only
acceptance:
  - Must identify package manager/project type when evidence exists
  - Must distinguish verified facts from inferences
  - Must cite repository-relative paths
```

### 11.3 Prompt caching

Cache immutable prompt components by version:

- System/role instructions
- Project conventions
- Tool schemas
- Design rules
- Verified architecture summaries
- Approved knowledge packets

Do **not** cache transient secrets, raw command outputs, user-private source content for external providers, or stale generated claims without provenance.

---

## 12. Search, Research, and Knowledge Design

### 12.1 Search types

- Workspace full-text search
- Symbol/code search
- Git/history search
- Knowledge-card search
- Prompt/skill search
- External web search
- Semantic similarity search

### 12.2 Research pipeline

```text
Question
→ Query plan
→ Approval for external research (if needed)
→ Search adapters
→ Source fetch/extract
→ Claim extraction
→ Citation/provenance validation
→ Knowledge cards
→ Retrieval packet for planner/coder
```

### 12.3 Prompt injection protection

Treat repository files, web pages, fetched documentation, user HTML, command output, and external search snippets as **data**, not instructions.

- Delimit untrusted content in agent prompts.
- Do not let fetched content modify system policy/tool permissions.
- Strip/flag instruction-like content in sources.
- Require the orchestrator—not source text—to choose tools.

---

## 13. Quality Gates

### 13.1 Build completion gate

| Gate | Required evidence | Failure behavior |
|---|---|---|
| Workspace preflight | Project type + manifest/strategy record | Block commands |
| Plan approval | Structured approved plan | Await approval |
| Protected-file validation | Valid parsed configuration | Reject mutation |
| Dependency resolution | Package/alias evidence + install record | Block downstream tasks |
| Core implementation | Task acceptance criteria met | Retry or block |
| Typecheck | Command record | Block or warning by policy |
| Lint | Command record | Block or warning by policy |
| Tests | Command record | Block or warning by policy |
| Build/start | Build or preview health record | Block for runnable apps |
| Accessibility | Axe/static results + exceptions | Warning/block per severity |
| Design QA | Token/static/screenshot results | Block for configured errors |
| Final report | Generated artifact linked to evidence | Cannot enter Done |

### 13.2 Design quality system

- Maintain a structured brief: subject, audience, primary job, domain vernacular, required states.
- Compile design tokens from structured inputs.
- Lint token discipline, raw values, inline style escapes, generic patterns, filler copy, and state coverage.
- Provide an explicit `extend_tokens` workflow; do not ask models to invent raw color values in consumer CSS.
- Generate screenshots at desktop/tablet/mobile widths.
- Use vision critique only when a capable model is configured; otherwise show limitation.

### 13.3 Accessibility system

- Static semantic checks during code review.
- Browser-based axe checks in preview.
- Keyboard walkthrough tests for essential flows.
- Contrast checks against semantic token roles.
- Manual review checklist for dynamic content, screen-reader flow, and interaction meaning.

### 13.4 Security and compliance posture

- Static detection with confidence labels.
- Findings include evidence, impact, recommendation, and “manual validation required” status.
- Prominent disclaimer for compliance: product/engineering triage, not legal advice.

---

## 14. UX Requirements

### 14.1 Workspace layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Project switcher · global search · provider status · notifications   │
├───────────────┬───────────────────────────┬─────────────────────────┤
│ Files         │ Task / Plan / Work        │ Preview / Changes       │
│ Knowledge     │ Agent conversation        │ Activity / Terminal     │
│ Skills        │ Current checkpoint        │ Approvals / Diagnostics │
├───────────────┴───────────────────────────┴─────────────────────────┤
│ Verification matrix · status · run controls · checkpoint controls    │
└─────────────────────────────────────────────────────────────────────┘
```

### 14.2 Required states

Every run/task panel must support:

- Empty
- Drafting
- Awaiting approval
- Running
- Recovering
- Verifying
- Completed
- Completed with warnings
- Blocked
- Failed
- Cancelled
- Resumable after restart

### 14.3 Activity vs Terminal

- **Activity:** agent/phase/task/model/tool/checkpoint/policy events in plain language.
- **Terminal:** sanitized stdout/stderr of spawned commands only.
- **Approvals:** explicit pending/routed decisions.
- **Changes:** diff, snapshots, restore actions.
- **Diagnostics:** provider causes, command fingerprints, policy rejections, cleanup status.

### 14.4 Approval design

Approval cards must show:

- Exact action
- Agent’s stated reason
- Affected files/packages/commands
- Risk level
- Diff or package list
- Scope: allow once / allow for project / deny
- Consequences of denial

---

## 15. API and Event Contracts

### 15.1 Core endpoints/IPC operations

```text
POST   /projects
GET    /projects/:id
POST   /projects/:id/workspace/select
POST   /projects/:id/preflight
POST   /runs
GET    /runs/:id
POST   /runs/:id/cancel
POST   /runs/:id/resume
POST   /runs/:id/tasks/:taskId/retry
POST   /runs/:id/tasks/:taskId/rollback
POST   /approvals/:id/decision
GET    /runs/:id/events
GET    /runs/:id/report
POST   /models/capabilities/probe
GET    /knowledge/search
POST   /research/jobs
```

### 15.2 Event types

```text
run.created
run.status_changed
preflight.started
preflight.completed
preflight.blocked
plan.proposed
plan.approved
phase.started
phase.completed
task.started
task.verified
task.blocked
task.invalidated
model.requested
model.completed
model.failed
model.retry_scheduled
tool.requested
tool.completed
tool.rejected
command.queued
command.awaiting_approval
command.started
command.completed
command.failed
command.cancelled
approval.requested
approval.resolved
snapshot.created
snapshot.restored
verification.started
verification.completed
preview.ready
screenshot.captured
report.ready
run.done
```

---

## 16. Recommended Technology Stack

| Layer | Recommended starting choice | Notes |
|---|---|---|
| Desktop shell | Electron | Mature native dialogs, process control, Chromium preview; Tauri is a viable future alternative |
| UI | React + TypeScript | Component ecosystem and strong typing |
| Styling | Existing tokenized CSS / CSS Modules / Tailwind generated from tokens | Avoid arbitrary runtime styles in critical UI |
| Local daemon | Node.js + TypeScript | Reuse tool/agent ecosystem; isolate from renderer |
| API/events | IPC for desktop + SSE/WebSocket internally | Use typed contracts |
| Local database | SQLite + migration tool | Durable runs, tasks, events, knowledge metadata |
| Artifact storage | Local content-addressed file store | Snapshots, screenshots, reports, logs |
| Validation | Zod or equivalent runtime schemas | Validate every untrusted boundary |
| Browser automation | Playwright | Preview health, screenshots, accessibility integration |
| Accessibility | axe-core with Playwright | Automatable baseline checks |
| Parsing | TypeScript compiler API, Babel/SWC, parse5, JSON/YAML/TOML parsers | Never regex structured source/config where parser exists |
| Search | SQLite FTS + local embeddings index | Start deterministic; add semantic layer progressively |
| Git | Native git CLI through governed command runner or library | Keep commands policy-controlled |
| Local models | Ollama adapter | Capability probe required per model/tag/config |

---

## 17. Security Threat Model

### 17.1 Primary threats

| Threat | Control |
|---|---|
| Path traversal / symlink escape | Canonical path jail and realpath validation |
| Prompt injection in repo/web content | Treat all artifacts as data; orchestrator controls tools |
| Secret disclosure in logs/model context | Deny secret files; redact before storage/display/context |
| Arbitrary shell execution | argv only, shell false, policy tiers, workspace cwd lock |
| Malicious package script | Inspect script command content, not only script name |
| Corrupt config/manifest | Structured edits + runtime schemas + snapshots |
| Infinite retries/cost loops | Error fingerprints, budgets, retry caps, block states |
| Zombie processes | Run-owned process manager and cancellation cleanup |
| Unauthorized external transfer | Explicit consent and routing disclosure |
| False completion | Deterministic evidence-based Done gate |

### 17.2 Secret redaction requirements

Redact before any persistence/event/model handoff/export:

- `KEY=value` for secret-like keys
- Bearer/auth headers
- URL credentials
- common provider token formats
- private key blocks
- JSON secret fields
- multiline secret patterns using streaming rolling buffer plus whole-record pass

---

## 18. Implementation Plan

### Phase 0 — Foundation and decisions (1–2 weeks)

**Outcome:** A runnable desktop shell and documented architecture.

- Create monorepo/app structure.
- Choose Electron/Tauri, data store, daemon boundary, artifact paths, and updater strategy.
- Implement design tokens, app shell, routing, project list, settings shell.
- Create ADRs for security boundary, provider abstraction, persistence, and process model.
- Define typed contracts and migrations.

**Acceptance:** App launches; database migrates; project creation/listing works; architecture decisions documented.

### Phase 1 — Workspace safety and file management (2–3 weeks)

**Outcome:** Safe local project opening and reversible file changes.

- Native folder selection.
- Workspace canonicalization/path jail/symlink protection.
- File tree/search/read service.
- Snapshots and rollback.
- Typed create/patch/structured JSON operations.
- Protected-file registry and manifest validator.

**Acceptance:** Escape, symlink, secret, malformed-manifest, patch-mismatch, and rollback tests pass.

### Phase 2 — Governed command runtime (2–3 weeks)

**Outcome:** Safe, observable command execution.

- Command policy engine.
- Approval service/UI.
- Command record persistence.
- Redaction service.
- Process manager and cancellation cleanup.
- No-progress fingerprints and blocked records.
- Activity/Terminal/Approvals UI.

**Acceptance:** Commands run only within workspace, installs await approval, cancellation kills child processes, repeated failures block, output is redacted.

### Phase 3 — Model router and capability lab (2 weeks)

**Outcome:** Only proven models can drive critical agent roles.

- Local/hosted provider interfaces.
- Typed errors/retries/cancellation.
- Role configuration.
- Disposable-workspace coder capability benchmark.
- Model capability records/UI.

**Acceptance:** A non-tool-calling model is rejected for Coder; a passing model completes read/edit/manifest/command/repair probe.

### Phase 4 — Task orchestration and minimal agent loop (3–4 weeks)

**Outcome:** Bounded implementation tasks can be planned, executed, resumed, and verified.

- Task DAG and checkpoints.
- Planner/Coder/Debugger roles.
- Task plans, scopes, acceptance criteria, invalidation.
- Action-required model contract.
- Event stream and durable resume.

**Acceptance:** Mocked agent integration test completes a multi-task change; interruption resumes at correct task; blocked prerequisite invalidates downstream tasks.

### Phase 5 — Golden-path application build (3–4 weeks)

**Outcome:** One real request completes end to end.

- Create one verified React/Vite local-first starter template.
- Implement a minimal personal scheduler benchmark:
  - create/edit/delete/list
  - local persistence
  - empty/loading/error states
  - responsive layout
- Preflight template/model before run.
- Run real local build repeatedly from clean workspaces.

**Acceptance:** At least two clean runs produce a working local app, screenshots, command evidence, and final report.

### Phase 6 — Knowledge, search, prompts, and skills (3–4 weeks)

**Outcome:** Reusable intelligence across projects.

- Prompt/skill library with versioning/evaluations.
- Repository map skill.
- Local full-text search and knowledge cards.
- Research plan, consent, citations, caching.
- Project memory with provenance.

**Acceptance:** User can retrieve a prior decision/source/skill and attach it to a new task with clear provenance.

### Phase 7 — Quality agents and reports (4–6 weeks)

**Outcome:** Quality is checked, not merely narrated.

- Typecheck/lint/test/build adapters.
- Playwright preview/screenshots.
- axe accessibility checks.
- Token/design quality checks.
- Security/compliance/SEO static triage.
- Markdown/PDF reports.

**Acceptance:** Golden-path report contains evidence-backed results; no critical product-UI accessibility defects; exports redact secrets.

### Phase 8 — Advanced multi-agent and IDE capabilities (ongoing)

- Visual critique loop with supported vision model.
- Rich editor/LSP integrations.
- Debugger integrations.
- Git workflows and optional commit approval.
- Multi-repo context.
- Template catalog.
- Plugin/skill SDK.
- Team/shared knowledge, if privacy model permits.

---

## 19. MVP Definition of Done

The MVP is done only when a user can:

1. Select or create a local workspace.
2. Choose a coder model that has passed the in-product capability test.
3. Submit a bounded feature request.
4. Review and approve a structured implementation plan.
5. Watch an agent safely inspect, edit, and run approved commands.
6. See actual command output, activity, diffs, snapshots, approvals, and verification states.
7. Cancel safely and resume from a known checkpoint.
8. Recover from a blocked dependency/build/test failure without repeated blind retries.
9. Receive a running local preview for the supported starter template.
10. Receive a final report backed by actual command/verification evidence.

### MVP proof build

> Build a local-first personal scheduler with create, edit, delete, list view, local persistence, responsive mobile/desktop layouts, and designed empty/loading/error states.

Required evidence:

- Valid project manifest
- Approved install record, if install is required
- Dev server/preview health record
- Screenshots at mobile and desktop widths
- Create/edit/delete/persistence tests or reproducible smoke-test evidence
- Typecheck/lint/test/build results
- Accessibility baseline result
- Final Markdown report
- Task/run record with snapshots and commands

---

## 20. Open Questions

1. Is the first release strictly local-only, or should it support opt-in hosted models at launch?
2. Which operating system is the initial target: Windows-only, macOS, or cross-platform?
3. Which project templates are supported in v1 beyond React/Vite?
4. What is the default retention policy for logs, snapshots, screenshots, and knowledge artifacts?
5. Which actions can receive persistent project-level approval?
6. How should external research consent be represented per project and per source?
7. What level of editor capability is needed in v1: file preview/diff only, Monaco editor, or native VS Code extension integration?
8. Should Flow/Forge support import of existing VS Code settings, tasks, and workspace files?

---

## 21. First Engineering Backlog

1. Create desktop shell + daemon process boundary.
2. Define runtime schemas and SQLite migrations for Project, Run, Task, Event, CommandRecord, Snapshot, Approval, VerificationCheck, KnowledgeItem.
3. Implement workspace path jail and native folder selection.
4. Implement file snapshots + restore.
5. Implement typed `edit_package_manifest` with schema validation.
6. Implement command runner with policy tiers, process manager, output caps, and redaction.
7. Implement Activity, Terminal, Approvals, Changes, and Diagnostics panels.
8. Implement provider adapter and typed error classification.
9. Implement Coder capability probe in disposable workspace.
10. Implement task DAG and explicit Done gate.
11. Create verified scheduler starter template.
12. Run and document the first golden-path benchmark.

---

## 22. Product Principles

1. **Evidence over narration.** No claim of completion without records.
2. **Small verified steps beat large heroic runs.** Checkpointed tasks are the default.
3. **Local by default, external by consent.** Make data movement visible.
4. **Models propose; the runtime governs.** Tools, policies, and validators own side effects.
5. **A safe failure is not the final goal.** The goal is a successful, useful result.
6. **Do not hide uncertainty.** Show limitations, confidence, skipped checks, and blockers.
7. **Quality is a system.** Product, UX, accessibility, security, compliance, and engineering checks are connected—not afterthoughts.
8. **User control is continuous.** Approve, pause, inspect, redirect, resume, or rollback at every consequential point.
