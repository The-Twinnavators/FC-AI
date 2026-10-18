# Frameproof main build: state at the budget stop, and the minimum acceptance conditions for future recovery work

These are recorded at the owner's request. They do not authorize implementing anything.

## State at 22:18:58Z (paused; the run is blocked/incomplete)
- **No agent working.** The last tool call and agent event were at 22:18:58Z. FlowCode then reported "Paused: the step in progress finished". The run's work loop is idle, waiting on the pause.
- **Correction step:** "Correct the generated app" is at attempted/3, with the next attempt (debugger) queued behind the pause.
- **Guidance:** none of the owner's guidance reached the task. No guided retry request was recorded, and taskFindings has no "Guidance from the user". Every attempt since the restart was unguided.
- **Bad clipboard edit:** the coder's 21:11Z edit removed `?.` and with it the no-clipboard path. It was undone by FlowCode when the step blocked at 21:40Z.
- **Current source:** the later unguided attempts only reformatted the statement. It still reads `navigator.clipboard?.writeText(…).then(copied, refused) ?? toast(id)`, now with broken indentation at line 635. The behaviour is the original's; the lint error remains.
- **Lint now:** 1 error at `src/sections/RecordDetail.tsx` 635:1 (@typescript-eslint/no-unused-expressions), plus 2 warnings that were already there.
- **Checks that passed on the current source** (step-level, 22:14Z): typecheck, build, tests, and functional_journey 1/1. That journey's only step is "Gallery opens from the top bar".
- **Run-level checks that passed:** install, project_preflight, manifest_validation. The rest are pending.
- **Not verified:** PRD journeys A–D, and the first visible checkpoint (12 photos, title search, opening a photo's detail).

## Minimum acceptance conditions for future recovery work
1. **Exact guidance delivered to the explicitly selected task.** Guidance entered in any retry control reaches that task's findings verbatim. The retry event records `guided: true` and the task ID.
2. **A missing task target produces a visible error.** A retry-with-guidance action with no task attached (as in the run-level Troubleshoot panel) fails visibly instead of doing nothing.
3. **Fresh file context on every attempt.** Every attempt's brief shows the failing file's code as it is on disk at that attempt's start, never an excerpt captured earlier.
4. **Repeated failing or no-op edits terminate promptly.** An identical failing or no-op patch sent again ends the attempt with that evidence, instead of the attempt running on.

A per-rule lint fix hint is a separate, unproven idea. Nothing here shows it would make recovery autonomous.
