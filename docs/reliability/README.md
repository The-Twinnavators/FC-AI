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

## Phase 4: human design authority; optional visual critic

**Root cause.** AI taste was on the blocking path: on design steps the vision "look review" findings were serious,
and the cloud "design crit" always sent a step back once; the run's final verification always asked a vision model for
a critique. Measured contrast silently skipped text over images or gradients, so those read as passing.

**Changed.**
- Runtime option `visualCritic` (`off` by default, or `advisory`), in Settings → Speed & recovery as "AI design notes
  (optional)". Off: no look review, no design crit, no run-level critique (recorded as skipped: "the screenshots are
  for your design review"). Advisory: they run and their notes are recorded, never serious, never a repair loop.
- Measured checks keep their severity (placeholder text, repeated sections, unstyled defaults, low contrast, overflow,
  broken images, axe rules). Contrast that can't be measured from colours (an image or gradient behind the text, a
  see-through layer, a blend mode) is reported as `contrast-uncertain`, non-blocking, "check it by eye".
- Human review was already in place and is now the design gate: a passing prototype opens a review
  (`ready_for_review`: technically verified, ready for design review) with one item per planned page and user
  journey; `changes_requested` turns the notes into one follow-up build scoped to those pages' files, whose checks run
  again; `signed_off` only by the person, only when every page and journey is approved on the current version.
- Settings also exposes the phase 3 investigation budget.

**Evidence.** `test/design-authority.test.ts`: the critic defaults to off and can be set to advisory; in a real
browser, measured low contrast stays blocking while text over a gradient is reported as uncertain. `test/human-review.
test.ts` (6 tests) covers the review states, sign-off rules and change requests becoming a scoped follow-up build that
comes back for another look. Settings verified in the app: the toggle saves (`visualCritic: "advisory"`) and was set
back to `off`.

**Limits.** Two vision calls remain because they check content, not taste: a stock photo `find_image` chose must show
what was searched for, and style capture reads a reference image when one is given. A build with neither makes no
vision call before human review.

## Performance: why qwen3:8b wrote about 8–11 tokens a second

Measured on this machine (RTX 5070 Laptop, 8 GB VRAM; Core Ultra 9 275HX; 31 GB RAM; Ollama 0.40.3, no runtime
tuning set) with `scripts/ollama-speed.mjs` and the build's own telemetry. Full rows: [speed-qwen3-8b.json](speed-qwen3-8b.json).

| Window | On GPU | Short prompt | 17k-token prompt |
| --- | --- | --- | --- |
| 8k | 100% | 54 tok/s | — |
| 16k | 78% | 30 tok/s | 19 tok/s (10k prompt) |
| 24k | 69% | 26 tok/s | — |
| 32k | 59% | 22 tok/s | **7.9 tok/s** (the build saw 8.3) |
| 24k, flash attention + q8_0 KV (temporary test server) | 83% | 41 tok/s | 13.5 tok/s |
| 16k, flash attention + q8_0 KV | 92% | 43 tok/s | — |
| 12k, flash attention + q8_0 KV | 100% | 51 tok/s | — |

**Model speed.** The slowdown is placement, not the model: Ollama keeps about 1 GB of the card free, so roughly
5.8 GB is usable. qwen3:8b's weights take about 4.6 GB, and the key/value cache for the window FlowCode needs does
not fit beside them, so 30–40% of the model runs on the CPU, and it gets slower still as a long prompt fills the
window. FlowCode's coder prompts were 11.7k (p10), 16.7k (median), 21.6k (p90) and up to 24.5k tokens, which is why
`gpuMemory.ts` keeps a 24k floor (a smaller window silently cuts the prompt). Generation is 95% of local model time;
prompt processing is 3% and loading 1%.

**Orchestration waste.** It multiplies the slow calls: 1,147 of 1,348 reads were repeats of unchanged files, each one a
model turn that re-sent ~16k tokens; one step (10) took 241 calls and 276 model minutes; step 14 took 692 calls.
qwen3:14b (support roles) can't fit on an 8 GB card at any useful window and ran at 3 tok/s: 24 calls, 94 minutes.
Phase 3 targets the repeats; the controlled build measures the effect.

**Not changed (each needs your decision).**
1. Ollama settings `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` (environment variables for Ollama; free,
   no download): 24k window with a long prompt from 7.9 to 13.5 tok/s in the test above. q8_0 KV has a small quality
   cost.
2. Smaller coder prompts (system prompt, catalog, skills, history) so a 12–16k window holds them: up to ~50 tok/s, but
   a prompt-size change across FlowCode, so a separate piece of work.
3. A support model that fits the card (for example qwen3:8b instead of qwen3:14b for support roles): a model change.

## Round 2: false passes, request budgeting, truncated edits (controlled build, run_73d6f4dd)

**What the trace showed.** Two design parts ("Design App Frame and Navigation", "Implement Real Imagery") and then
"Seed Sample Data" passed on attempt 2 as "already done" with only a type check: the frame step had changed two
background lines, the imagery step saved 15 photos and put none on a screen, and Home still showed the Neobrutal
landing's pottery-studio demo. Their opening requests were about 18.2k tokens of a 24k window (33.1k-character system
prompt with 24.8k of skills, 12.6k of tool definitions, a 27.9k brief); fitting dropped the two files the step edits and
the PRD while keeping an 11.2k list of every file every earlier step touched. One reply carried 55 edits, hit the
4,096-token output limit, applied 2 and failed 5.

**Changed.**
- Verification integrity: a step whose checks are all generic (type check, lint, build, whole suite) gets checks for its
  own deliverable, added openly (event and record): it changed its own files; its screens show the photos in
  public/images; sample data is seeded (8+ records); the app frame is restyled or replaced; the library pieces its
  screens render don't still show their demo. "Already done" needs a check about the step itself. On resume, steps
  that passed on generic checks are revalidated: ones whose deliverable holds stay passed, the rest reopen (only them).
  Planning keeps checks the starter's scripts provide and records every dropped check with its reason.
- Whole-request budget (`requestBudget.ts`): window minus reply minus a working reserve, at the model's measured
  characters per token (4.1–4.2 for qwen3:8b), counting system, skills, tool definitions and brief. Fitting by
  priority: knowledge, design guidance, tree, other files, finished-work lists, then the step's own files are shortened
  (never dropped); task, checks and cited requirements are never cut; what still doesn't fit splits the step.
- Packet: spec builds record their PRD; steps get the requirement text for the IDs they name; split parts carry a
  one-sentence summary of their step plus its sections about their own screens; finished work is only what the step
  builds on; skills come from metadata (test-first only for steps whose checks run tests) within a budget by model;
  catalog contracts of the step's files go in upfront; binary files are never attached as source.
- Edits: at most 8 per reply, the last edit of a cut-off reply isn't run, later edits to a file wait once one to it
  fails, and each reply reports applied / failed / not run / malformed; an attempt that ends records its applied edits
  so the next one continues instead of resending them.

**Before and after, same step (Implement Real Imagery, rebuilt in an isolated copy):**

| | Before | After |
| --- | --- | --- |
| Opening request | ~18.2k tokens | ~14.3k tokens (budget 14.3k) |
| Skills | 5, 24.8k characters (incl. test-first) | 2, 8.4k (3 named as left out) |
| Step's own files | dropped | both included |
| Requirement text | none | 16 requirements quoted |
| Component contract | none | ShopProductCards |
| Finished-work list | 11.2k characters | 0.3k |

**Thinking on vs off** (`scripts/think-bench.mjs`, 6 routine cases × 2, qwen3:8b, 24k window, placement read from
`/api/ps`: 83% on GPU): both 12/12 passed with valid calls, none truncated; thinking on wrote 5,636 tokens in 160 s,
off 736 tokens in 20 s. Reasoning stays as configured: routine turns don't need it, but the sample says nothing about
hard steps.

## Backlog (not in scope; only with a separately approved narrow fix)

- Artifact-level dependency tracking (which step produced which file and what depends on it).
- Dependency-aware rollback (undo a step and exactly what was built on it).
- Render-path verification (prove a screen is reachable and rendered from the app's entry, not only that it compiles).
