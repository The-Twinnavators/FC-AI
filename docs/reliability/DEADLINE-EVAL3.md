# Eval 3 deadline breach: root cause and proposed repair

**Run:** `run_c303ae3be5ef473ba2aa` (Clean Cart slice, eval 3).

| | Time (UTC) |
|---|---|
| Started | 06:37:25 |
| Two-hour deadline | 08:37:25 |
| Stopped | 11:14:58 (blocked) |
| Overrun | 2 h 37 min |

The recorded outcome is unchanged:
- a verified functional baseline;
- design part 1 verified;
- design part 2 blocked;
- no final checks.

## Trace

**Where the deadline was stored.**
- In FlowCode, nowhere. No run field, setting or check represents a run deadline. The run, its strategy and its settings carry none.
- The only copy was a command-line argument to a scratch watcher script I ran outside FlowCode (`watch-run.mjs <run> 2026-10-17T08:37:25Z`), plus the chat.

**What enforced it.**
- Nothing in FlowCode. The watcher only observed. It polled every 45 s and exited when it saw "time limit reached" (08:37:50).
- I then paused the run by hand at 08:38:13 through `POST /runs/:id/pause`. FlowCode recorded that as "Paused by you", because the pause API attributes every pause to the user.
- Before that, the watcher had already missed the step-level approval requested at 07:30:44. It stopped only on run-level `awaiting_approval`, and the run's status stayed `running` while one of its steps waited.

**What happened during approval waits.**

| Approval | Requested | Resolved | Wait |
|---|---|---|---|
| Plan | 06:42:34 | 07:29:57 | 47 min |
| "Approve the prototype plan and the design" (step-level) | 07:30:44 | 10:38:24 | 3 h 8 min |

No clock ran during either. Approval waits count toward elapsed time, but nothing checked elapsed time.

**What the pause and Continue did.**
- The pause held through the second approval. When that approval was resolved at 10:38:24, the step in progress finished (verified) and the run paused (10:38:26), as designed.
- At 10:38:37 Continue was pressed. With no deadline in FlowCode, Continue resumed the run freely.

**What Retry did.**
- At 10:53:50 Retry reopened 9 tasks and resumed.
- No budget exists to consume or check, so Retry had no budget effect.

**What the two daemon restarts did.**
- Both restarts (10:53:10 and 10:58:03) came from the FlowCode UI dev server being restarted; the dev server launches the daemon.
- After each restart, `reconcileOnStartup` resumed the run automatically (Assisted policy: "Daemon restarted: resuming automatically"). There was no deadline to consult.
- The first restart interrupted part 2's debugger attempt mid-flight, and its next model call got `connection_refused`.

**Work that started after expiry.** All build work, about 36 min (10:38:37–11:14:58):
- Add library sections.
- Write the complete app, with its functional baseline.
- The design split.
- Part 1, verified at 10:45.
- Part 2: coder attempt, debugger attempt, Retry, a reattempt, a second restart, a reattempt.
- Final verification and reports.

Model time for the whole run: 128 calls, about 35 min.

## Root cause

The measured-run deadline was an operator convention outside FlowCode, not a FlowCode control. Everything that can start work ignored it because it didn't exist in FlowCode:
- Continue;
- Retry;
- recovery;
- startup reconciliation;
- approval resolution.

## Proposed narrow repair (existing machinery, no new framework)

1. **Persist an absolute deadline.**
   - Store `runDeadline:<runId>` (`{ at, setAt, setBy, reason, extensions: [] }`) in the settings store.
   - Set it with an optional `deadlineAt` on run creation, or `POST /runs/:id/deadline`.
   - Show it in the run-start record.
   - It survives waits, retries and restarts because it lives in the store, not in memory.
2. **Check it wherever work starts.** One helper, `deadlinePassed(store, runId)`, is consulted before:
   - the scheduler starts a task (`runTask`);
   - each agent-loop model turn and each tool dispatch;
   - `start`, `resume` and Continue (`pauseRun(false)`);
   - Retry and `recoverNow`/`scheduleRecovery`;
   - the auto-resume in `reconcileOnStartup`;
   - resuming after an approval is resolved.

   An expired run never starts or resumes work there.
3. **At expiry,** a timer per active run fires at `at`. Restarts re-arm it from the stored value.
   - **Interruptible work** is aborted through the run's existing abort signal: model requests, commands and browser checks already honour it.
   - **Non-interruptible work** settles: an edit being written, a snapshot, a check record.
   - **No further work is scheduled.** The run is then paused through the existing pause path (`runPaused` and `pausedRuns`, kept across restarts). An interruption records cause `deadline`, marked as needing the person and not recoverable.
   - **Pending approvals** stay pending; resolving one after expiry starts no work.
4. **Record any overrun.**
   - An event and a setting record when it expired and when work actually stopped.
   - They also record what was running or waiting at the time (for example "step-level approval pending since 07:30:44"), and the overrun duration.
5. **Extend only explicitly.**
   - `POST /runs/:id/deadline/extend { until, reason }` records who extended it, when and why.
   - Continue, Retry and resume on an expired run are refused with a clear message until an extension is recorded.
6. **Fix pause attribution separately.**
   - A pause made by a script or by FlowCode (`by: "system"`) should not be recorded as "Paused by you".
   - This is a one-line use of the existing `by` parameter at the API: let the caller say who it is.

**Tests to accompany it:**
- expiry during an approval wait;
- expiry during a model call (aborted);
- expiry during a file write (settles);
- Continue, Retry and resume refused when expired;
- a restart doesn't resume an expired run, and re-arms the timer for one that hasn't expired;
- an extension is recorded and then allows resume;
- the overrun record names what was in progress.
