# Isolation for a measured run

FlowCode has **no exclusive mode**. A measured run can't stop other work from starting. The existing controls below reduce the risk. Everything else is detection: the measured run is paused when competing activity begins. No broad concurrency subsystem was added.

## Existing controls

- **GPU gate** (`models/gpuGate.ts`, the 8 GB profile setting)
  - Serialises every local inference request, chat and embedding, across the app.
  - Queued requests are announced, saying what they wait behind.
  - It orders work; it doesn't refuse it. A second run would still share the GPU, slowly.
- **Supervised autonomy** (per project). After a daemon restart, a run in a supervised project waits for the person; it is never resumed automatically.
- **Pause** (`POST /runs/:id/pause`). This stops the run from starting new work, and it stays paused across a daemon restart.
- **Retry dedupe.** Retrying a step that is already running doesn't restart it.

## What a daemon restart does

From `orchestrator.reconcileOnStartup`:

| Run state | What happens on restart |
|---|---|
| `draft` with no plan | Planned again automatically |
| `running`, `recovering` or `verifying` | In assisted or autonomous projects with the plan approved: resumed automatically. In supervised projects: waits for the person. |
| `awaiting_approval` with the plan approved | Step approvals expire; the run continues as running |
| `blocked` with a recoverable interruption | Recovery is scheduled automatically |
| Paused by the person | Stays paused |

Preserved runs (eval 1 and the earlier Clean Cart builds) **must not be resumed**. On 2026-10-17:
- 25 runs were blocked.
- None had a recoverable interruption.
- None was `running`, `recovering`, `verifying`, `draft` or `awaiting_approval`.

So a restart resumes nothing today. That has to be re-checked before every restart: it depends on state, not on a lock.

## Procedure for a measured run

1. **Before starting**, run:

   ```bash
   node scripts/isolation-check.mjs
   ```

   It is read-only. It must exit 0, which means:
   - no other active run;
   - not more than one model loaded in Ollama;
   - the daemon and Ollama are reachable.
2. **Before any daemon restart**, re-check that no preserved run is in a state the restart table resumes.
3. **During the run**, check every few minutes with:

   ```bash
   node scripts/isolation-check.mjs <runId>
   ```

   On exit 1, pause the measured run with `POST /runs/<runId>/pause` and record:
   - the time;
   - the competing activity;
   - the pause.

   Continue only once the check is clear again. The paused interval is reported as an isolation interruption, not as run time.
4. **Count as interventions**, never as FlowCode's own work:
   - your approvals in the UI;
   - any resume.

## Limits

- **Activity outside FlowCode** isn't seen by the daemon:
  - other GPU processes;
  - an Ollama request from another tool.

  The check sees only what Ollama reports as loaded.
- **Detection lags.** Between checks, competing work can run unnoticed for up to one check interval.
