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

## Backlog (not in scope; only with a separately approved narrow fix)

- Artifact-level dependency tracking (which step produced which file and what depends on it).
- Dependency-aware rollback (undo a step and exactly what was built on it).
- Render-path verification (prove a screen is reachable and rendered from the app's entry, not only that it compiles).
