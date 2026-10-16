# Reliability and performance effort

Four phases plus a performance investigation, measured against the Clean Cart build (`run_b08ca51250e34b4a91b6`).
`node scripts/build-baseline.mjs <runId> --json out.json` re-measures any build from its recorded events (read-only,
no model calls).

## Baseline: Clean Cart (cancelled after step 14)

Full numbers: [baseline-clean-cart.json](baseline-clean-cart.json).

| Measure | Value |
| --- | --- |
| Wall time | 36.4 h (includes overnight waits on blocks) |
| Model time | 7.6 h over 1,234 calls; 28 failed calls (13 timeouts, 1 out of credit, 14 other) |
| Tool calls | 2,319: 1,348 reads, 734 searches, 46 listings; 133 writes (94 patches, 32 replacements, 7 new files) |
| Repeated reads | 1,147 of 1,348 reads were of a file the step had already read with no write since |
| Steps | 11 verified of 19 that ran; 22 attempts in total |
| First verified model step | 74 min after the run started |
| Step 14 (tests and stylesheet) | 692 model calls, 120 model minutes, blocked: out of credit |
| Step 10 (Home hero) | 241 model calls, 276 model minutes, 3 attempts |

| Model | Calls | Median reply | Generation share | Generation speed | Avg prompt |
| --- | --- | --- | --- | --- | --- |
| qwen3:8b (coder, debugger) | 133 | 91 s | 95% | 8.3 tok/s | 16,226 tok |
| qwen3:14b (support) | 24 | 226 s | 95% | 3.0 tok/s | 18,662 tok |
| qwen2.5vl:3b (critic) | 15 | 1.3 s | 2% | 118 tok/s | 2,075 tok |
| claude-sonnet-5-5 (switched coder) | 1,062 | 3.4 s | n/a | n/a | 65,960 tok |

What the baseline says: almost all local model time is generation; reading dominates the tool calls, and most reads
are repeats; one step (14) used more than half of all model calls.

## Phase 1: failure classification and provider/model preflight

**Root cause.** A model-service failure went down the same path as a failure of the work: a timeout, a missing model
or an empty credit balance used up one of the step's three attempts and handed the step to the debugger, and when the
build stopped, the end-of-run cleanup undid the step's work. A missing Ollama model was reported as `invalid_response`.

**Changed.**
- `contracts`: error kinds `model_missing` and `auth_failed`; `Blocker.failureClass` (`provider`, `environment`,
  `task_contract`, `code`, `test_harness`, `product_behavior`, `design`, `policy`, `unknown`); event `provider.checked`.
- `models/errors.ts`: classifies missing models and refused sign-ins; `isProviderFailure()`.
- `models/preflight.ts` (new): checks each service a build's roles use (reachable, every model listed), records what
  answered (Ollama version and address, model digests) and what it can't confirm (which Ollama process; a cloud
  account's credit). Free calls only: no downloads, no provider switch, no paid request.
- `orchestrator.ts`: the check runs before planning (planner, coder and debugger must be ready; support roles warn)
  and before each model attempt (reused for 5 minutes unless the models changed; a daemon restart starts fresh;
  rerun after any provider failure). A provider failure gives the attempt back, never reaches the debugger, keeps the
  work (also at end of run), and either retries once the service answers again (twice at most) or pauses the step
  with a specific next action. A retry after a provider pause tells the coder to carry on, not to change approach.
  A fast model that can't be used hands over to the coder without costing an attempt.

**Evidence.** `test/provider-failures.test.ts` (9 tests): classification; the check with a missing model, an
unreachable service, a refused cloud key and an unlisted cloud alias; and in a real orchestration: out of credit
mid-step (paused, 0 attempts, no debugger call, file kept, resumes to verified), unreachable service (paused before any
model call), missing model at planning and mid-build, and a passing timeout (retried without an attempt).

**Limits.** Credit can't be checked ahead of time without a paid call, so it's caught on the first failing call. The
check can't tell which Ollama process holds the port; it records version, address and digests instead.

## Phase 2: task construction and testing packets

**Root cause.** Step 14 was a split part that bundled two deliverables (all 24 acceptance tests and two stylesheet
rules), said the tests mostly wouldn't pass, and was checked only by words appearing in the test file plus the type
check. The coder had no reliable facts about the test setup: it imported `react-router-dom` (not installed) and spent
its turns reading to discover routing, data and helpers.

**Changed.**
- `orchestrator/taskContract.ts` (new): before a coder step's first model call, `contractProblems` finds a step made
  only of test and stylesheet files (separated into "write the tests" then "add the stylesheet rules", every check owned
  by exactly one, the type check by both, later steps wait on the second) and a step whose checks require all tests to
  pass while its brief says most won't (stops as `task_contract`, no attempt used). A feature step that builds screens
  and proves them with its own tests stays one step.
- New check `tests-run:<file>` for test-writing steps: the file loads and its tests run (failing assertions are
  expected until later steps build what they check), no parked, self-comparing or expect-less tests. Reasons name the
  cause (e.g. `Failed to resolve import "react-router-dom"`).
- The separated stylesheet step gets the stylesheet tests from the written file as its own passing check, so it isn't
  verified by the type check alone.
- `orchestrator/testingGuide.ts`: a testing packet read from the project (installed and not-installed libraries, setup
  file, render without providers, hash routing with the real screen ids, the reset, real fixture names, one working
  test from the project, the targeted command), and a scaffold FlowCode writes before the first attempt (imports,
  reset, `openAt(hash)`, one passing test). No scaffold when providers wrap the app.
- `orchestrator.ts`: `replaceWithParts` shared by splitting and separation; `isRuntimeStep`.

**Evidence.** `test/task-contract.test.ts` (9 tests) on step 14's real shape, plus an orchestration run where the
mixed step is separated with no model call and no attempt. On a copy of the Clean Cart workspace at its last
checkpoint (real vitest, no FlowCode data changed): step 14 separates into two tasks with every check owned; the
scaffold passes and type-checks; a file importing `react-router-dom` is reported as not running; tests written on the
scaffold run (2 pass, the not-yet-built stylesheet rule fails as expected); renaming "How it works" on Home makes the
Home test fail (the tests detect wrong behaviour); no dependency added; navigation is by URL hash.

**Limits.** A model still writes the tests; the packet and scaffold make that cheaper but don't guarantee it. Steps
already split before this change are checked when they next run, not rewritten in the database.

## Phase 3: structured recovery for unproductive investigation

**Root cause.** The agent loop ended an attempt at fixed counts (the same file 4 times, 8 read-only turns, 60 reads
without an edit) without asking why, and counted a re-read of an unchanged file the same as reading something new.
The retry started over with nothing learned. (The "force a write after 12 reads" idea was only ever proposed, never
built, so there was nothing to remove.)

**Changed.**
- `orchestrator/investigation.ts` (new): counts new investigation (a file or search read for the first time, or after
  its content changed, by hash) apart from repeats of unchanged content, and turns that only re-read. Budget is a
  runtime option (`investigationBudget`; automatic: 40 new reads for a local model, 120 for a cloud one; repeats and
  re-read turns scale with it; three times the room when FlowCode's guards already stopped the step twice).
- `agentLoop.ts`: over budget, the attempt pauses once for one JSON answer (no tool runs until it's given):
  `ready_to_implement` (fresh budget; three re-read turns at most before the attempt ends), `missing_information`
  (FlowCode supplies the named files or where a name appears, bounded to 12,000 characters, once),
  `ambiguous_task`, `broken_baseline` (recorded for the next attempt) or `split_required`. No answer after two asks, or
  a second overrun, ends the attempt. It never asks for an edit to show progress. The "same failing call 3 times"
  guard, approvals and `report_blocked` are unchanged.
- `orchestrator.ts`: an ambiguous step or information only a person has stops as `task_contract` without using an
  attempt; `split_required` splits the step now (the attempt is given back) instead of after two more attempts.

**Evidence.** `test/investigation.test.ts` (10 tests): repeat vs new counting; budgets; answer parsing; a repetitive-
read scenario that pauses once, answers "ready" and makes its own change; "ready" then more re-reading ends the attempt;
ambiguous and split routes; 30 different files over 30 turns with no interruption; a past-budget investigation that
gets the file it needs and then writes; bounded supply that stays in the project; and an orchestration run where an
ambiguous answer blocks for the person with 0 attempts used. Two older tests were updated from "stop at N reads" to
the new behaviour (pause, then end with no answer).

**Limits.** Whether a local model answers the check well is only known from a real build; an unparseable answer counts
as no answer.

## Backlog (not in scope; only with a separately approved narrow fix)

- Artifact-level dependency tracking (which step produced which file and what depends on it).
- Dependency-aware rollback (undo a step and exactly what was built on it).
- Render-path verification (prove a screen is reachable and rendered from the app's entry, not only that it compiles).
