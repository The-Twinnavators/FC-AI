# Plan traceability — acceptance criteria → evidence

Every phase acceptance criterion in PRD §18 and every MVP Definition-of-Done item in §19, with the evidence that
proves it. Automated tests live in `packages/daemon/test/` (`npm test`).

## Phase acceptance (§18)

| Phase | Acceptance criterion | Evidence |
|---|---|---|
| 0 | App launches | `FLOWCODE_SMOKE=1` Electron launch: daemon handshake, UI loaded, bridge connected, clean exit (exit 0) |
| 0 | Database migrates | `db/migrations.ts` (3 migrations) run on every start; listed on Diagnostics page |
| 0 | Project creation/listing works | Projects view; `phase1`/`phase4` tests create projects through `ProjectService` |
| 0 | Architecture decisions documented | `docs/adr/0001…0006`, `docs/architecture.md` |
| 1 | Escape, symlink, secret tests pass | `phase1-workspace.test.ts` → *path jail* (traversal, absolute, NUL, junction escape, secret deny) |
| 1 | Malformed-manifest, patch-mismatch, rollback tests pass | `phase1-workspace.test.ts` → *governed file operations* |
| 2 | Commands run only within workspace | `phase2-commands.test.ts` → *runs within the workspace…* + policy tier tests |
| 2 | Installs await approval | `phase2-commands.test.ts` → *waits for approval on installs* |
| 2 | Cancellation kills child processes | `phase2-commands.test.ts` → *cancellation kills the child process tree* (grandchild verified dead) |
| 2 | Repeated failures block | `phase2-commands.test.ts` → *blocks repeated identical failures until a material change* |
| 2 | Output is redacted | `phase2-commands.test.ts` → redaction + streaming redaction + stored command output |
| 3 | Non-tool-calling model rejected for Coder | `phase3-models.test.ts`; real models: `qwen2.5-coder:7b` (tool JSON as text) and `gemma2:2b` (no tools) rejected 0/8 (ADR-0005) |
| 3 | Passing model completes read/edit/manifest/command/repair probes | `phase3-models.test.ts` (scripted ideal); real model **`qwen3:14b` passed 8/8** |
| 4 | Mocked agent completes a multi-task change | `phase4-orchestration.test.ts` → *completes a multi-task change* |
| 4 | Interruption resumes at correct task | `phase4-orchestration.test.ts` → *resumes … after a daemon restart* (task 1 not re-executed) |
| 4 | Blocked prerequisite invalidates downstream | `phase4-orchestration.test.ts` → *a blocked prerequisite invalidates downstream tasks* |
| 5 | Two clean runs produce working app, screenshots, command evidence, final report | `benchmarks/runs/<stamp>/RESULTS.md` (see "Golden path" below) |
| 6 | Retrieve a prior decision/source/skill and attach it with provenance | `phase6-knowledge.test.ts` → *retrieves a prior decision and attaches it…* |
| 7 | Golden-path report contains evidence-backed results | `phase7-quality.test.ts` browser suite (reference scheduler: typecheck/lint/build/server/preview/screenshots/axe/smoke flow, each with evidence refs) + benchmark reports |
| 7 | No critical product-UI accessibility defects | `scripts/audit-ui.mjs`: **0 critical/serious** axe violations on all 9 screens × 2 themes |
| 7 | Exports redact secrets | `phase7-quality.test.ts` → *exports redact secrets and keep repository-relative paths*; PDF export verified (`%PDF`) |
| 8 | (ongoing) | Implemented: vision critique (qwen2.5vl), git commit with approval, live preview. Not yet: LSP/editor, debugger integration, multi-repo, template catalog, plugin SDK, team knowledge |

## MVP Definition of Done (§19)

| # | A user can… | Where |
|---|---|---|
| 1 | Select or create a local workspace | Projects → *Open local folder…* (native dialog) or managed empty workspace |
| 2 | Choose a coder model that passed the in-product capability test | Models & capability lab; runs are blocked at Coder preflight otherwise |
| 3 | Submit a bounded feature request | Workspace → New request |
| 4 | Review and approve a structured plan | Plan approval card (goal, assumptions, tasks, risk, validation, rollback) |
| 5 | Watch an agent safely inspect, edit and run approved commands | Agent conversation, Activity, Terminal; approvals for installs/out-of-scope edits |
| 6 | See command output, activity, diffs, snapshots, approvals, verification states | Terminal / Activity / Changes (diff + restore) / Approvals / signal strip |
| 7 | Cancel safely and resume from a known checkpoint | Cancel (process-tree cleanup) / Resume; checkpoints restorable in Changes |
| 8 | Recover from a blocked dependency/build/test failure without blind retries | Bounded repair (Debugger, max 3), error fingerprints + no-progress block, Retry after user change |
| 9 | Receive a running local preview | Preview → Start preview (owned Vite server, iframe) |
| 10 | Receive a final report backed by evidence | Reports → Markdown/PDF export; deterministic completion gate section |

## Success metrics (§2.3) — status in this build

| Metric | Status |
|---|---|
| Coder capability preflight visible before every run | Coder status shown in every run header; capability records persisted per config |
| Unsafe operation prevention 100% in test suite | All policy/security tests pass |
| Protected-file corruption 0 | Manifest validated before write; protected tool allow-lists; snapshots |
| False "Done" claims 0 | Gate is record-based; real-model false completion claims were caught (ADR-0005) |
| Cancellation cleanup ≥ 99% | Process-tree kill verified in tests; cleanup result recorded per run |
| Critical/serious a11y issues in product UI = 0 | `scripts/audit-ui.mjs` → 0 |
| Golden-path completion rate ≥ 70% | See benchmark RESULTS.md (2 runs on the reference machine) |
| Mean recovery clarity < 2 min | Requires a moderated usability test (not automatable) |
