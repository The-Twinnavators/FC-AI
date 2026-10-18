# Eval 4, attempt 1: run_3d280f4b376f44fa877b

**Evaluation setup deviated: required human plan approval and concept selection were bypassed.**

This attempt is neither a design success nor a design failure. The concept-selection evaluation was never exercised.

| | |
|---|---|
| Project | prj_2f083343dc8242a08ee4, "Clean Cart slice (eval 4)" |
| Candidate commit | 68338ff32b06da1ddf3ba85f99de0961cafd3f40 (freeze in `freeze.json`) |
| Created | 01:47:49Z |
| Deadline | 03:47:49Z, set before planning; not reached |
| Cancelled | 02:00:31Z, by the owner's instruction: "Evaluation setup deviated: required human plan approval and concept selection were bypassed (cancelled by the owner)" |

## What deviated

1. **The plan was auto-approved by the Assisted policy** at 01:52:49: "auto-approved by assisted policy: medium-risk plan". **The owner did not approve the plan.** No plan approval request was created, so the plan card never stopped.
2. **Bold aisle was not selected or applied.** Concepts can be picked only while the plan waits for approval. FlowCode recorded the Home direction as `{ kind: "none", outstanding: true, why: "The plan was approved without choosing a Home direction" }`.
3. **The intended concept-selection evaluation was therefore not exercised.**

## Also recorded (not caused by the setup, disclosed)

- **The review step ("Approve the prototype plan and the design") was approved at 01:55:50Z** through FlowCode's approval decision. The decision log records actor "user". FlowCode doesn't record an origin for approval decisions, so the log can't say whether it came from the UI. It didn't come from the evaluator's session. This was before the owner's instruction not to approve it arrived.
- **What ran after that approval:** "Add library sections" (verified) and "Write the complete app" (started; not finished). Neither makes model calls. 0 model calls ran after the review approval.
- **The daemon restarted at 01:59:41Z**, which wasn't planned or made by the evaluator. Under the Assisted policy the run resumed automatically ("Daemon restarted: resuming automatically (assisted policy)"). The cause isn't established; the UI dev server restarts the daemon when it restarts.
- **At cancellation:** 2 of 2 owned processes stopped. The latest safe checkpoint is the verified "Add library sections". No active or queued work remained; the graph showed no active runs.

## Preserved here

- `run.json`: the run, its strategy and model assignments.
- `events.json`: every event except command output.
- `approvals.json`: the dependency install (auto-approved by policy) and the review step (approved 01:55:50Z).
- `tasks.json`: the 16 steps and their states.
- `checks.json`, `tool-calls.json`, `commands.json`.
- `settings.json`: the deadline, Home direction, concept choice (none), concept timings, interruption and app model.
- `freeze.json`: the configuration recorded before the run.

The generated source stays in the project's workspace (`.flowcode-data/workspaces/`, project prj_2f083343dc8242a08ee4), with its snapshots.
