# FlowCode: reliability, UX, performance and continuous improvement — plan

_7 October 2026. This plan checks the 6 October analysis ([flowcode-ai-opportunities.md](flowcode-ai-opportunities.md)) against the code and the local database (`.flowcode-data/flowcode.sqlite`). The queries are read-only and the measurements below come from recorded events, not estimates._

## 1. Verified findings

**Confidence:** **C** = confirmed by code or recorded data. **P** = plausible cause, still to test. **X** = a claim from the analysis that the data contradicts.

| # | Finding | Evidence | Confidence | User impact | Proposed response | Validation |
|---|---|---|---|---|---|---|
| F1 | Copilot treats chat history as current. History comes after the run state in the prompt, and it is not scoped to a project or run. | `api/copilot.ts`: the run state goes in the system message, then `ask.history.slice(-8)`. In the UI, `components/Copilot.tsx:62,184` keeps one global history (`fc.copilot.history.v2`), sent with no run tag. | C | Answers about the wrong run. The screenshot asked from a No BIO & GMO page (`runId=run_b76d…`) was answered about the Calculator step "Clear, accessible calculator keypad". | Tag history with project and run, drop history from other runs, and answer status questions from a fresh structured summary. | Fixture test: Calculator history plus a BIO route gives a BIO answer. |
| F2 | Copilot relays text written for the agent as a chore for the user. | `quality/verification.ts:220` records "`<file>` doesn't exist yet: write the acceptance tests first". `copilot.ts` copies it verbatim ("its acceptance tests last ran: …"). | C | The user is told to write tests that FlowCode writes itself. | Plain wording, a blocker translator, and a "FlowCode does this" owner field. | Fixture test: no "you need to write" wording. |
| F3 | Factual answers use the creative temperature, and nothing checks the names in an answer. | `copilot.ts`: `temperature: ask.explain ? 0.3 : 0.7`. There is no post-check. | C | Invented details. | Temperature 0.1 for status questions, a deterministic fact card, and a check that names in the reply exist in the facts. | Tests with an invented step name. |
| F4 | "Sir" is the default form of address. | `api/copilotProfile.ts:42`: `raw.address ?? "Sir"`. | C | An address the user never chose. | Default to none. | `copilot-profile.test.ts`. |
| F5 | A visual review that could not run is recorded as "skipped", and the run still finishes as "done", which the cards show as Ready. | `run_bfe9…`: `visual_critique` is skipped with "Critique failed … credit balance is too low", and the run status is `done`. Code: `verification.ts:662`. | C | "Ready" implies a visual review that never happened. | Separate *unavailable* (could not run) from *skipped* (not needed). Report "finished with incomplete verification". | Check-state unit tests; Run Review on `run_bfe9` shows the limitation. |
| F6 | Wrong provider in the credit-exhausted advice. | `orchestrator.ts:1210` always gives OpenAI's billing URL, even for `claude-sonnet-5-5` (task in `run_e18f…`). | C | Misleading recovery advice. | Name the provider that actually ran out. | Unit test for the message. |
| F7 | The "why it stopped" diagnosis says "No clear cause found" when planning stopped on exhausted credit. | `run_baf9…` events: `quota_exhausted` at planning, then the recovery step reported "No clear cause found in the evidence". `troubleshoot.ts:149` ignores `run.statusReason` when there is no task. | C | The cause is hidden from the user. | Use the run's status reason and detect quota and credit errors. | Test with a run blocked at planning. |
| F8 | A question typed in a build became a new run: objective "Why did the run stop?" (`run_baf9…`). That run then sat for 3.7 h with 0 model calls before it was cancelled. | Runs and events tables. | C (that it happened) / P (which input path caused it) | A wasted run and a confusing state. A long wait with nothing visible. | Phase 2: classify "question vs change request" at the input, and show "waiting / blocked since" plainly. | Reproduce the input path first. |
| F9 | Most of the main run's time went to failed work and undoing it, not slow generation. | `run_b76d…`: 14.8 h wall clock. Model 7.3 h over 1,941 calls. Waiting on approvals 2.84 h. 212 failed commands took 2.09 h vs 783 successful ones at 0.74 h. 44 attempts over 30 steps. 164 snapshot restores. | C | Long builds. | Phase 2 records time by phase. Run Review lists retries, restores and failed command time as the main time sinks. | Compare these numbers on later runs. |
| X1 | "qwen3-coder:30b is very slow because 72% runs on the CPU" | Measured from 2,067 calls: a median of **27 tokens/s** generation and 6.6 s per call. The 72% figure was a single `ollama ps` reading, not a throughput measurement. | X (as the main cause) | — | Don't promise speed-ups from a smaller context. Run a controlled benchmark in Phase 4. | Phase 4 benchmark. |
| X2 | "6 pending approvals are blocking builds" | All 6 pending items are non-blocking `enhancement_idea` suggestions (8–9 h old). Approvals that do block a build are mostly quick: 308 file approvals averaged 0.3 min and 58 command approvals 2 min. One of each took over 30 min. | X | Low for builds; the suggestions get lost. | The Phase 3 inbox separates "blocks a build" from "suggestion". | Phase 3. |
| P1 | The ETA is unreliable. | One user report ("you said 15 mins"). No stored estimates to compare against. | P | Trust. | Phase 2: ranges, plus a "not enough data" state. | Back-test against recorded runs. |
| P2 | Local models produce generic design. | User feedback on several runs. The design check found 0 issues while the user still called the screens "subpar". | P | Design quality. | Phase 5: reusable screen specs and route coverage. Cloud stays optional. | User review plus spec-fidelity checks. |

## 2. Existing infrastructure to reuse

- **Events** (`events` table, `bus.list`): model calls carry `timing` and `usage`; tool calls, commands, recoveries, approvals and status changes are all logged.
- **Run performance** (`api/performance.ts`, `GET /runs/:id/performance`): elapsed time, waiting, time by phase, busy time, model throughput, retries, slowest items. This is the measurement source for Run Review.
- **Stop report and troubleshoot** (`quality/stopReport.ts`, `quality/troubleshoot.ts`): diagnosis of stopped runs and supported fixes.
- **Supported user actions** (`contracts/api.ts`):
  - cancel run, resume run;
  - retry a step (with guidance), undo a step;
  - pause, unpause;
  - switch coder (`/runs/:id/coder`);
  - edit the request, re-run a check.
  The blocker translator only offers these.
- **Fix memory** (`knowledge/fixMemory.ts`): recurring failures and their fixes, which feed the recurrence counts.
- **Storage that needs no migration:**
  - the `artifacts` repo (free-form `kind`), used for review records;
  - the `settings` key-value table, used for the improvement backlog and its version history.
- **Approvals** (`approvals/service.ts`): already bound to one action. Persistent "always for this project" consent exists, but only as the user's own explicit choice.

## 3. Dependency-aware sequence

1. **Phase 1 — Trust (this change).** A check-state classifier, a blocker translator, grounded Copilot status, the provider-correct credit message, the troubleshoot fix, the default address, and Run Review v1 (stored at run end and readable in the run's Details).
2. **Phase 2 — Visibility.** Needs Phase 1's check states and review measurements. Adds run activity states, an ETA range from comparable history (with "not enough data"), advisory stall signals, and question-vs-change detection at the input (F8).
3. **Phase 3 — Governance.** Adds the approval inbox (blocking vs suggestion), the decision log (approvals, settings diffs, model changes, recoveries, rollbacks), and the Improvements page with approve, test and roll back.
4. **Phase 4 — Local performance.** Adds a runtime preflight (measured fit and throughput) and a benchmark harness on fixed tasks. Produces recommendations only.
5. **Phase 5 — Design quality.** Adds provider-independent screen specs, a route-coverage audit, spec-fidelity checks, and visual-QA limitation reporting.

## 4. Minimal schemas (no database migration)

```ts
// Artifact kind "run_review", one per run (replaced if the run is resumed and ends again)
interface RunReview {
  version: 1;
  runId: string; projectId: string; createdAt: string;
  level: "light" | "detailed";              // detailed if failed/blocked, recurring, or slow
  requested: string;                        // the run's request, first line
  outcome: { status: string; finished: boolean; verifiedSteps: number; totalSteps: number;
             verification: "complete" | "incomplete" | "not_run" };
  checks: Array<{ kind: string; state: "passed" | "passed_with_warnings" | "failed" | "skipped" | "unavailable" | "not_run"; note: string }>;
  worked: string[];                         // observed facts only
  limitations: string[];                    // unavailable checks, blocked steps (plain language)
  issues: Array<{ category: FailureCategory; what: string; where: string; evidence: string[];
                  cause: { text: string; status: "suspected" | "confirmed" }; recurrence: number }>;
  measurements: { wallMs?: number; waitingMs?: number; modelMs?: number; modelCalls?: number; attempts?: number;
                  restores?: number; failedCommandMs?: number };   // missing = "Not measured"
  proposals: string[];                      // ids in the improvement backlog; [] = "No new improvement identified"
}

// Settings key "improvements.v1": the backlog, with each item's history
interface Improvement {
  id: string; name: string; status: "proposed" | "awaiting_approval" | "approved" | "in_progress" | "testing" | "verified" | "rejected" | "rolled_back" | "deferred";
  relatedRuns: string[]; evidence: string[]; benefit: string; change: string; target: string; owner: string;
  priority: "now" | "next" | "later"; scope: "project" | "global"; projectId?: string;
  baseline: string; successMeasure: string; validation: string; approvalRequired: boolean; rollback: string;
  history: Array<{ at: string; status: string; note: string; actor: "flowcode" | "user" }>;
}
```

**Failure categories:** request, planning, context, tools, code, ux_design, research_data, communication, verification, performance, safety_privacy.

## 5. Files expected to change

**Phase 1**
- `packages/daemon/src/quality/checkState.ts` (new): check-state classifier.
- `packages/daemon/src/quality/blockerText.ts` (new): blocker translator.
- `packages/daemon/src/quality/runReview.ts` (new): builds and stores Run Review.
- `packages/daemon/src/api/copilot.ts`: grounded status.
- `packages/daemon/src/api/copilotProfile.ts`: default address.
- `packages/daemon/src/quality/verification.ts`: unavailable wording and agent-neutral test text.
- `packages/daemon/src/orchestrator/orchestrator.ts`: credit message names the right provider.
- `packages/daemon/src/quality/troubleshoot.ts`: run-level reason.
- `packages/daemon/src/api/server.ts`: `GET /runs/:id/review`.
- `packages/daemon/src/app.ts`: store the review when a run ends.
- `apps/ui/src/components/Copilot.tsx`: tag history with project and run.
- `apps/ui/src/components/RunReview.tsx` (new), placed in the run's Details.
- Tests: `copilot-grounding.test.ts`, `run-review.test.ts`.

## 6. Baselines and evaluation cases

**Baselines from recorded data:**
- `run_b76d…`: 14.8 h wall, 1,941 model calls, 44 attempts over 30 steps, 164 restores, 2.84 h approval wait.
- `run_bfe9…`: done, but visual critique unavailable.
- Copilot: there is no recorded question log, so the baseline is the fixtures below, not "50 recorded questions".

**Evaluation cases (fixtures, defined before the change):**
1. History about run A while the route shows run B: the answer names B's project and status only.
2. The user names another project ("how is the calculator doing?"): the answer resolves that project's latest run and says so.
3. No run in context: the answer says which project or run it needs, and invents nothing.
4. A run that finished with critique unavailable: the answer says the visual review did not run.
5. A blocked step whose check says "write the acceptance tests first": the answer says FlowCode writes the tests and offers only supported actions.
6. Unknown blocker category: a generic explanation, the category logged as unmapped, and actions limited to Details, Retry and Cancel.
7. A model reply naming a step that doesn't exist: the prose is replaced by the fact-based text.
8. A planning-stage credit stop: the diagnosis names the provider and the credit cause.

## 7. Approval and rollback

**Phase 1** changes Copilot and reporting only. It adds no new automatic actions, so there is nothing new to approve. Every behaviour change is in code with tests, and rolling back means reverting the files.

**The improvement backlog** (Phase 3 UI) works like this:
- FlowCode only *proposes*.
- Applying a proposal to prompts, skills, project instructions, models or settings needs the user's approval in the Improvements page.
- Each status change is appended to the item's history with the actor.
- "Roll back" restores the previous prompt or skill version through the existing versioned prompt and skill tables.

## 8. Deferred items and open questions

**Deferred:**
- L1–L5;
- automatic model routing;
- batch approvals;
- phone push for stalls, if it needs new infrastructure;
- cloud-assisted design (optional and separately approved);
- automatic changes to acceptance criteria.

**Open questions:**
1. Should "finished with incomplete verification" become its own run status? That touches the status enum, the UI chips and the Done gate. Phase 1 reports it in Run Review and Copilot without changing the status.
2. What should the review retention period be? The proposal is to follow the existing run retention (`db/retention.ts`).
3. F8: which input created a run from a question? To be reproduced in Phase 2 before changing that input.

---

## Phase 1 results (7 October 2026)

**What changed**
- **Copilot status questions** are answered from fresh structured facts (`api/runFacts.ts`) for the run the user means:
  1. a project they name;
  2. otherwise the run on the page;
  3. otherwise that project's latest run.

  The model may only reword the facts, at temperature 0.1. Its wording is discarded, and the plain facts used instead, if it quotes a name or file not in the facts, mentions another project, or tells the person to write tests or code. When no run is in context, the Copilot says so. Status answers show a facts card.
- **History** is tagged with project and run in the UI and filtered on the server (`scopedHistory`). Untagged old answers are no longer sent back.
- **Blocker translation** (`quality/blockerText.ts`) separates FlowCode's work from the person's decision. It only offers supported actions, never says "nothing to do" unless the step really carries on (a split step), and logs unmapped categories to `blockers.unmapped`.
- **Check states** (`quality/checkState.ts`, `checkCouldNotRun` in contracts) separate *skipped (not needed)* from *couldn't run*. The checks bar now shows "Couldn't run" for the BIO design review instead of "Skipped".
- **Credit advice** names the provider that ran out (F6). Troubleshoot uses the run's own stop reason (F7).
- **Address**: "Sir" is no longer the default. A previously stored "Sir" that the user never set is ignored. If the user wants it, they set it once in Settings.
- **Run Review** (`quality/runReview.ts`) is stored as an artifact when a run ends, or built when it is first opened. It is shown in the run's Details, collapsed unless something needs attention. Known issue types become backlog proposals (`improvements.v1`), each with a success measure, validation method and rollback. Nothing is applied automatically.

**Checks**
- `tsc` for contracts, daemon and UI: clean.
- Full test suite: 98 files, 1,122 passed, 6 skipped. 20 of these tests are new (`copilot-grounding.test.ts`), covering evaluation cases 1–8.

**Baseline vs observed**
- **Live Copilot**, asked from the BIO run with the old Calculator answer still in the history: it answered about No BIO & GMO, said the visual review couldn't run, and used no address.
- **Before**, the same question was answered about the Calculator run and told the user to write tests.
- **BIO run review:** "Verification incomplete". One proposal was raised: *Run the visual review on a local vision model when the cloud critic can't run* (status: Suggested, needs approval).

**Limitations**
- The run status still reads "done" (shown as Ready) when a check couldn't run. The Run Review and the Copilot say verification is incomplete, but the status itself is open question 1.
- The improvement backlog has no page of its own yet (Phase 3). It is visible per run in Run Review and via `GET /improvements`.
- The answer-checking is pattern-based. It catches invented quoted names, files and other projects, but not every possible paraphrase.

**Recommended next:** Phase 2 (honest status, ETA ranges and advisory stall signals), starting with reproducing F8 (a question that became a run).

---

## Open question 1 resolved: "Ready, not fully checked" (7 October 2026)

**New run status: `done_unverified`.** The Done gate (`completionGate.ts`) now sets it when every required check passed but a check couldn't run. It records those checks as `gate.unverified`.
- Shown as "Ready, not fully checked", with the "notes" badge colour.
- Counted as finished everywhere the code checks for a finished run (`isFinishedRun` in contracts).
- Kept by retention like other finished runs, and shown as WARN in reports.

**Backfill:** three past runs whose visual review couldn't run (out of Anthropic credit) were moved from `done` / `done_with_warnings` to `done_unverified`. Their reviews were rebuilt. The runs were `run_bfe9…`, `run_a5be…` and `run_afd9…`.

## Phase 2 results (7 October 2026)

**F8 — a question became a build: cause confirmed and fixed**
- **Cause:** in the project chat, a message sent while no build was running always started a new run (`ProjectChat.tsx` `send`). So "Why did the run stop?" became a run.
- **Fix:** questions are now detected (`looksLikeQuestion` in contracts) and answered by the Copilot. A change request phrased as a question ("Can you add a footer?") still counts as a change. The answer has a "Build this as a change instead" button for the cases the detector gets wrong.

**Run activity** (`api/runActivity.ts`, `GET /runs/:id/activity`, `RunActivity` in the run's Details)
- **States:** writing code; running commands and tests; waiting for your approval (optional suggestions don't count); waiting for the model service; retrying; possibly stalled; paused; planning; final checks; stopped and needs a decision; failed; cancelled; finished; finished but not fully checked.
- **Time left:** shown as a range, or "Not enough data yet". The range is the 25th–85th percentile of earlier steps' time from first start to verified or stopped. It uses the same coder model when there are at least 5 such steps, otherwise any model, and says so. The basis is in an expandable detail. Time waiting for the person is excluded and shown separately.
- **Estimate vs actual:** the first estimate is kept (`eta:first:<run>`), and the Run Review compares it with the active time the run actually took.
- **Stall warnings are advisory only.** A warning needs two signals together, or one strong one:
  - silence beyond 4× this run's usual gap (at least 10 min);
  - no FlowCode worker for a run that says it is working;
  - the same check failing the same way 3 times in a row.

  It offers Pause, Retry and Cancel (Cancel asks for confirmation on the page). It never acts on its own.

**Back-test of the estimate** (`.scratch/backtest-eta.mjs`, over 28 recorded runs)
| Rule | Runs inside the range |
|---|---|
| First rule: verified steps only, 25th–75th percentile | 10 of 27 (37%), too short |
| Shipped rule: blocked steps included, 25th–85th percentile | 17 of 28 (61%) |

The estimate is labelled "a rough range: on past builds about 6 in 10 finished inside it". The ranges are wide because step times vary a lot, and that is reported rather than hidden.

**Run Review fixes**
- Builds that stopped needing a decision (`blocked`) now get a review.
- "Final checks not run" now appears only when no checks were recorded.

**Checks**
- `tsc` for contracts, daemon and UI: clean.
- Full test suite: 99 files, 1,133 passed. New: `run-activity.test.ts` (7 tests), plus gate and review tests.
- Browser: the Calculator run shows "Stopped: needs a decision" and its review. The dashboard shows No BIO & GMO as "Ready, not fully checked".

**Not verified:** no build was running during this session, so the live time estimate and stall warning were only exercised by tests and the back-test, not on a real running build.

**Next: Phase 3** (approval inbox, decision log, Improvements page).

---

## Phase 3 results: governance (7 October 2026)

**Approvals page** (`/approvals`, in the left menu under Work)
- **Waiting on you:** requests that hold up a build, oldest first. Each shows:
  - the project;
  - what the request is, in plain words;
  - its risk level;
  - how long it has waited;
  - a link to the build;
  - the exact action, with Approve and Deny.
- **Suggestions:** FlowCode's optional ideas, kept separate. They never hold up a build.
- **Decision log:** every decision, filterable by kind. Earlier approvals sit in the same view.
- **Top bar:** the counter now counts only requests that block a build ("N waiting on you", or "N suggestions"). It turns red after 5 minutes and opens the Approvals page.

**Exact-action binding**
- The card sends back the action it showed. If the stored action differs, the server refuses the decision with 409.
- An approval that was already decided can't be decided again (also 409).
- Builder cards, the Approvals page and the phone page all use the same approval records.

**Decision log** (`governance/decisionLog.ts`, `GET /decisions`)
- **Recorded automatically when the request succeeds:** approvals and denials (with note), settings changes, model and provider changes, prompt, skill and screen-spec saves, step retries and undos, and cancel / resume / pause.
- **Also recorded:** FlowCode's own recoveries, taken from the event stream.
- **Privacy:** entries name what changed. Values whose names look secret (key, token, password…) are never stored, and API keys are logged as "value not recorded".
- **Not covered by this log:** decisions made before this change. Earlier approvals are still listed from the approval records.

**Improvements page** (`/improvements`, under Intelligence)
- Each proposal shows what changes, how we'll know, how it's tested, and which runs it was seen in.
- The baseline, rollback condition, scope, evidence and status history are in an expandable detail.
- **States:** Suggested → Approved → In progress → Being tested → Confirmed. It can also be Deferred, Rejected, or Did not help (reverted).
- **"Confirmed" requires "Being tested" first**, enforced on the server. Each change goes into the item's history and the decision log.

## Phase 4 results: local performance (7 October 2026)

**Measured on this computer** (`models/modelPerformance.ts`, `GET /models/performance`, shown on the Models page)
- For each coder model, from recorded runs:
  - steps finished;
  - passed first try, passed after retries, stopped;
  - median step time;
  - writing and reading speed from each call's own timing.
- **Lab probes:** the capability lab's fixed probes give a like-for-like comparison, because every model gets the same tasks.
- **Memory fit:** read from Ollama's `/api/ps` (the share of the model on the GPU and its context size) for models loaded right now. It says when nothing is loaded rather than guessing.

**Recommendation rule**
- Only local models with at least 10 finished steps are compared.
- They are ranked on first-try passes minus stops, with step time only as a tiebreaker.
- A cloud model is never recommended, and nothing is switched automatically.

**Current measurements**
| Model | Steps | Passed first try | Stopped | Median step | Writing speed |
|---|---|---|---|---|---|
| qwen3:14b | 32 | 56% | 7 | 8.7 min | 8.6 tok/s |
| qwen3-coder:30b | 22 | 45% | 6 | 11.5 min | 27.3 tok/s |
| qwen3:8b | 21 | 38% | 11 | 21.6 min | 22.7 tok/s |

Recommendation: qwen3:14b. **Caveat:** the projects differed in difficulty, so this is evidence, not proof.

**Not built:** a dedicated benchmark over the five task types in the brief (component, multi-file, tests, debugging, building from a spec). Today the like-for-like comparison is the capability lab's probes. A fixed-task harness is the next step if per-task-type comparisons are needed.

## Phase 5 results: design quality (7 October 2026)

**Screens** (`quality/screenCoverage.ts`, `GET /projects/:id/screens`, shown in the builder's Styles tab)
- **Screen list:** read from the starter's `SCREENS` list and from `src/screens`. Screens opened from another screen are included.
- **"Designed" means a verified design step dedicated to that screen:** one that names it, or that changes at most two screen files. A broad polish pass over every screen doesn't count.
- **Overlaps:** two tabs that show and search the same data are flagged as possibly doing the same job. They are never merged automatically.

On No BIO & GMO this reproduces exactly what you reported:
- "Find brands" and "Brand list" are flagged ("both show and search the same data (brands)").
- The brand detail screen is listed as "Only a broad polish pass".

**Screen specs** (provider-independent)
- **Contents:** goal, main action, hierarchy, layout, narrow-screen behaviour, components, tokens, copy, data, loading / empty / error / success states, accessibility, icons, and acceptance criteria.
- **Drafting:** "Draft a spec" uses a local model only (never cloud credit) and saves nothing until you press Save. Saving is recorded in the decision log.
- **Use in builds:** saved specs are added to the brief of any design step that touches that screen.
- **Validated live:** the first draft wrongly described the latest small change request. I fixed it to use the product's first request and its PRD, and the redraft for the brand detail screen described the screen correctly.

**Visual review limits:** carried over from Phase 1. A review that couldn't run is shown as "Couldn't run" and makes the run "Ready, not fully checked". It is never shown as passed.

**Checks:** `tsc` for contracts, daemon and UI is clean. Full test suite: 102 files, 1,142 passed. New test files: `governance`, `model-performance` and `screen-coverage`. The Approvals, Improvements, Models and Styles → Screens pages were checked in the browser.
