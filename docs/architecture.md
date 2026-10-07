# FlowCode architecture

FlowCode implements the PRD in `docs/PRD.md` ("Forge IDE", product name FlowCode). This document maps the PRD's
architecture (§8) to code.

```
apps/desktop      Electron shell — window, folder picker, daemon lifecycle (ADR-0001, 0003)
apps/ui           React + TypeScript UI — Projects, Workspace, Knowledge, Library, Quality, Reports, Models, Settings, Diagnostics
packages/contracts  Zod runtime schemas + types, event types, tool schemas, API routes (shared by daemon and UI)
packages/daemon   Local daemon
  api/            loopback HTTP + SSE, token auth (§15)
  db/             SQLite (node:sqlite), migrations, document repos, content-addressed object store
  events/         durable event bus (§15.2)
  security/       path jail, secret patterns, redaction (§17)
  workspace/      projects, preflight, file service, typed file ops, protected files, snapshots (FR-W*, FR-F*)
  commands/       policy tiers, governed runner, process manager, error fingerprints (FR-C*)
  approvals/      approval records + waiters, project-level persistence (§14.4)
  models/         provider abstraction, Ollama / OpenAI-compatible / scripted, router, typed errors, capability lab (FR-M*)
  orchestrator/   run lifecycle, task DAG, agent loop (action-required contract), tool dispatcher, handoff packets,
                  role prompts, templates/golden-path plan, deterministic completion gate (FR-A*, FR-V*, §10)
  knowledge/      knowledge store, FTS + embeddings search, prompt/skill library, repository-map skill, research (FR-K*, FR-R*)
  quality/        verifier (verification matrix), static a11y, design QA, security/compliance/SEO triage,
                  Playwright preview/screenshots/axe/keyboard/smoke flow, vision critique (FR-Q*, §13)
  reports/        run report data → Markdown → PDF; repository intelligence report (FR-O*)
  bench/          golden-path benchmark (Phase 5)
templates/react-vite-starter   verified React + Vite + TypeScript starter (Phase 5)
```

## Run lifecycle
`draft → (preflight, strategy, plan) → awaiting_approval → running ⇄ recovering → verifying → done | done_with_warnings | blocked | failed | cancelled`.
Terminal states are never overwritten; iterations create a new run linked by `parentRunId`.

## Task execution loop (§10.3)
For each unblocked task in DAG order: checkpoint → runtime step or agent loop (Coder; Debugger on repair
attempts) with a structured handoff packet → governed tool calls (scope check → policy → approval →
snapshot → execute → record) → **runtime verification of acceptance criteria** → verified (safe checkpoint) |
bounded repair (max 3 attempts, no-progress fingerprints) | blocked (downstream invalidated).

## Completion
`evaluateCompletionGate` computes Done from task states, acceptance-criteria evidence, the required
verification matrix for the strategy, and the final report artifact.
