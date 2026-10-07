# FlowCode coding agent: performance review and library recommendations

Date: 2026-10-02. Based on FlowCode's own records: 17 runs, 57 steps, 903 tool calls, 1,096 model calls and 204 commands
across the Calendar app, PDA Companion, Rebuild the companion and Personal scheduler projects.

## Verdict: not at peak performance

The agent finishes most steps, but it gets there through retries rather than first-try correctness. The most recent run
(the clean-up with the new guards) shows what peak looks like: 1 try, 14 model calls, 0 failures, 1.6 minutes. Most
history looks nothing like that.

| Measure | Value | What it says |
|---|---|---|
| Runs that ended "done" with no warnings | 0 of 17 | 5 done with warnings, 4 blocked, 8 cancelled |
| Steps verified | 34 of 57 | 4 blocked, 6 left mid-attempt, 13 never started (their run was cancelled) |
| Steps that needed more than one try | 16 of 47 that ran | Each retry is several minutes of model time |
| Tool calls that failed | 259 of 903 (29%) | Each failure costs a model round trip |
| `apply_patch` misses | 98 of 250 (39%) | 85 "find text not found", 13 "ambiguous" |
| `task_complete` rejected by checks | 70 of 124 (56%) | The agent claims done before its checks pass |
| `run_script` failures | 43 of 67 (64%) | Wrong or missing script names, failing checks |
| Model calls that failed | 74 (47 Ollama crashes, 18 time-outs) | Crashes now addressed by one-model-in-memory |
| Model time | 618 min (10.3 h) | 84% of it on qwen3:14b, which doesn't fit the 8 GB GPU |
| Prompt tokens vs written tokens | 7.9 M read, 0.27 M written (30 : 1) | Context is the dominant cost after model choice |
| Command time | 5 min total over 204 commands | Commands are not a bottleneck |
| File-operation approvals asked of you | 46 | Flow stops for each one under "assisted" autonomy |

## Bottlenecks

1. **The big model.** qwen3:14b did 519 of 618 model minutes as coder and debugger. It doesn't fit the 8 GB GPU, so it
   writes at about 10 tokens per second, against about 25 for qwen3:8b. The 8b model passed the clean-up on its first try.
2. **Re-reading context.** Prompts read 30 tokens for every token written. Every step of a spec build is told to read the
   whole PRD (30 KB, about 8,000 tokens, for the Calendar app), and `read_file` was called 275 times.
3. **Patch retry loops.** 98 missed patches. Each one means another model call, usually another `read_file`, and often a
   second miss on the same file.
4. **Claiming done too early.** 70 rejected `task_complete` calls. Each sends the agent back with failure text and
   usually ends in another attempt (a new prompt of 25 to 65 thousand characters).
5. **Approval interruptions.** 46 file-operation approvals. Most were rewrites the agent requested because a patch kept
   missing. The new edit guards remove most of these.

## Repeated errors and workflow gaps

| Pattern | Evidence | Status |
|---|---|---|
| Patch find-text copied loosely (spacing, quotes, stale content) | 85 not found, 13 ambiguous | Partly addressed: after 2 misses the agent is told to re-read and copy exactly; no up-front protocol |
| Plan checks that can't pass (invented names, `var(--x, v)` snippets, scripts that don't exist) | Teal run looped 4 tries; "required script to verify font styles is not available" blocker | Addressed for CSS token names; still open for component names, file names, script names |
| Checks that confirm the change but not that nothing broke | First clean-up deleted `--color-accent` and `--color-border` and passed | Addressed for CSS tokens; open for removed exports, routes, functions |
| Types used before they exist; files left with duplicate definitions | 2 of 4 blocked steps ("State type is not defined", "duplicate function definitions") | Open |
| Whole-file rewrites to change a few lines | Teal run asked to replace 343 lines | Addressed (guard) |
| Skills pulled in by loose words | extend-tokens applied 26 times, mostly to value changes it doesn't cover | Addressed (triggers retuned) |
| Blocked steps have no category | All 4 blockers are "unknown" | Open: the agent's `report_blocked` doesn't classify |
| No repository instructions read | No `AGENTS.md` / `README` / contribution notes are read as instructions | Open |
| Whole PRD handed to every step | Spec builds add "read the reference files" to every step | Open (see PRD intake below) |
| Python projects have no automatic checks | Checks run through npm scripts only | Open |

## Recommended library additions

FlowCode's agents run on small local models with a 16k-token window. So each skill below is short and specific, and
where a deterministic step can do the work (finding PRD sections, listing scripts), the skill relies on code rather
than asking the model to search.

### 1. PRD intake brief (planner)

- **Problem it solves:** Spec builds hand every step the whole PRD. The planner reads it whole too, and nothing separates
  confirmed requirements from assumptions. Steps then re-read 8,000 tokens each attempt, and plans contain checks the PRD
  never asked for.
- **When to use it:** The run has an attached or in-repo PRD (`spec/`, `docs/prd/`, `*.prd.md`), or the request names a
  feature described in one.
- **Inputs required:** A section index of the PRD (headings with numbers, built by code from the Markdown, plus
  the extracted requirement and acceptance-criteria lines). `AGENTS.md` or `README.md` if present (first 1,500
  characters). The request. The workspace tree and design tokens (already provided).
- **Prompt or skill definition:**

  ```text
  Before planning, build a requirements brief from the PRD section index. Do not ask for the whole PRD.
  1. Name the exact feature, route, component or service the request changes.
  2. Pick only the PRD sections that govern it (by number). Always include the acceptance criteria and non-goals
     sections when they exist. Follow a "see section X" link only if the picked text needs it.
  3. For each requirement you will build, quote it as one testable sentence with its section number.
  4. List separately: assumptions you are making, ambiguities, and requests that the PRD marks out of scope.
  5. Conflicts: the request wins, then PRD acceptance criteria, then AGENTS.md/README, then the existing code and
     tests, then other docs. Name every conflict; never pick silently.
  6. Stop and ask (report the question instead of planning) when a choice changes permissions, sign-in, stored data
     or schema, payments, security, compliance, or deletes anything.
  7. Every task gets the section numbers it implements. Every acceptance criterion maps to a check.
  ```

- **Expected output:** A `brief` object added to the plan JSON: `feature`, `sections` (numbers read), `requirements`
  (`{text, section}`), `assumptions`, `ambiguities`, `outOfScope`, `conflicts`, `questions`. Each task carries
  `sections`. Acceptance: no task without a section reference on a spec build; no assumption about the stop-and-ask
  topics; every PRD acceptance criterion in scope maps to at least one task check.
- **How FlowCode applies it (code, not prompt):** Coding steps receive only their cited sections, not "read the
  reference files", plus the brief's requirement lines. The plan approval card shows the brief, so you see what was
  read, what was assumed, and what was left out before anything changes.
- **Value:** Faster and more accurate. It should cut prompt size on spec builds by the size of the PRD per step (about
  8,000 tokens on the Calendar app), remove checks the PRD never asked for, and give traceability from code to section.
- **Priority:** High.
- **Validation:** Run the same 3 spec-build requests against the Calendar PRD with the skill off and on. Compare the
  average prompt characters per coding call (Performance tab), the first-try pass rate, the number of checks dropped or
  corrected at plan time, and whether the approval card's brief cites the right sections (spot-check against the PRD).

### 2. Exact patch protocol (coder, debugger)

- **Problem it solves:** 39% of patches miss. The agent writes `find` text from memory or from a stale read.
- **When to use it:** Every coding step that edits an existing file (all coder and debugger roles; always on).
- **Inputs required:** The file's current content with line numbers (already in the step's files when listed in
  `expectedPaths`).
- **Prompt or skill definition:**

  ```text
  Editing an existing file:
  1. Copy `find` text character for character from the most recent read of that file, including indentation,
     quotes and trailing punctuation. Never retype it from memory.
  2. Include one unchanged neighbouring line so the text occurs exactly once.
  3. One edit per change; keep each `find` under 6 lines.
  4. If you changed the file earlier in this step, read it again before the next patch.
  5. After a miss, read the file once, then patch again. Do not try the same `find` twice.
  ```

- **Expected output:** `apply_patch` calls whose `find` text matches once. Acceptance: patch miss rate below 10% on
  the benchmark.
- **Value:** Fewer round trips, fewer rewrite approvals, fewer broken half-applied edits.
- **Priority:** High.
- **Validation:** Patch miss rate (misses divided by `apply_patch` calls) across the benchmark, before and after. The
  current baseline is 39%.

### 3. Acceptance check writer (planner)

- **Problem it solves:** 56% of "done" claims fail their checks, and several checks could never pass (invented
  names, missing scripts, snippets with guessed spacing).
- **When to use it:** Every plan (always on for the planner).
- **Inputs required:** Real script names from `package.json` (preflight already has them). Real token, component and
  file names (workspace tree, design tokens, reusable-parts list). The PRD brief's acceptance criteria.
- **Prompt or skill definition:**

  ```text
  Write checks that a correct change passes and a wrong change fails:
  - A check may name only files, components, tokens and scripts that exist, or that the task itself creates.
  - "Contains" text: one short exact name or declaration (`--color-accent: teal`, `export function useSchedule`),
    never a whole rule or a guessed snippet.
  - Removing something: use file_not_contains for what goes, and keep a check that what stays is still there.
  - Use a verification check (typecheck, lint, tests, build) only if that script exists in package.json.
  - Each check says which acceptance criterion it proves.
  ```

- **Expected output:** Acceptance criteria where every `file_*` path exists or is created by the task, and every
  verification kind has a script. FlowCode validates this in code and drops or fixes the rest, listing them on the
  approval card.
- **Value:** Fewer impossible loops (the teal run's 4 tries), fewer false passes (the first clean-up).
- **Priority:** High.
- **Validation:** `task_complete` rejection rate (currently 56%) and the share of tasks verified on attempt 1
  (currently 31 of 47) on the benchmark.

### 4. Design token change (coder)

- **Problem it solves:** Every styling request in the history struggled: the font, light mode, accent and clean-up
  runs. The agent invents token names, adds duplicates, or deletes tokens still in use.
- **When to use it:** Requests that change, rename or remove an existing colour, font, size, spacing or radius value.
  Triggers: "change the … colour/font/size", "make … teal/larger", "remove the unused … token".
- **Inputs required:** The token list with values and where each is used (FlowCode's Styles scan already has it).
- **Prompt or skill definition:**

  ```text
  Change design values in the token file, not in components.
  - Find the existing token for the thing named (accent → --color-accent). Edit its value in place, in every theme
    block that defines it.
  - Never add a second declaration of a token, and never create a new token for a value change.
  - Remove a token only when nothing uses it (the token list shows uses); otherwise leave it.
  - Leave every other line of the file as it is.
  ```

- **Expected output:** A one-line-per-theme edit to the token file. Acceptance: no new undefined tokens, no duplicate
  declarations, and the named token has the new value.
- **Value:** Turns the most common request type into a one-try task. The clean-up proved the shape: 1 try, 1.6 min.
- **Priority:** Medium. The guards already catch the damage; this makes the first try right.
- **Validation:** 3 token requests (change the accent, change the body font, remove an unused token): first-try pass
  rate and elapsed time.

### 5. Types-first plan ordering (planner)

- **Problem it solves:** Steps that use a type or module before any step creates it. That caused 2 of the 4 blocked
  steps ("State type is not defined", an import that doesn't resolve).
- **When to use it:** Plans with more than one task that create new modules or types (spec builds, new features).
- **Inputs required:** The plan's tasks and their `expectedPaths`.
- **Prompt or skill definition:**

  ```text
  Order tasks so nothing is used before it exists: shared types and data models first, then storage and services,
  then hooks and state, then components, then pages and routing. A task that imports from a file another task
  creates must depend on that task.
  ```

- **Expected output:** A dependency graph where creators come before users. FlowCode can check this in code: for each
  task's paths, imports from files that a later task creates are flagged.
- **Value:** Fewer blocked spec builds.
- **Priority:** Medium.
- **Validation:** Re-plan the PDA Companion spec build. Count steps blocked on undefined types or imports.

### 6. Repair a broken file (debugger)

- **Problem it solves:** Files left with duplicate definitions, a self-import or half-applied edits after several
  attempts ("duplicate function definitions and unused imports").
- **When to use it:** A type check or build fails with duplicate identifier, redeclaration, cannot find name, or an
  import loop, in a file changed during this run.
- **Inputs required:** The failing check output, the file, and the snapshot diff since the run started (FlowCode has
  snapshots).
- **Prompt or skill definition:**

  ```text
  The file was damaged by earlier edits in this run. Compare it with the diff since the run started.
  Remove duplicate declarations (keep the most complete one), remove imports of the file itself, and finish or
  revert half-applied edits. Then run the type check. Under 120 lines you may rewrite the file; above that, patch.
  ```

- **Expected output:** A passing type check and a diff touching only the damaged lines.
- **Value:** Turns a blocked step into a recovered one.
- **Priority:** Medium. This replaces the debugger prompt's older advice to rewrite the whole file after two misses.
- **Validation:** Replay the blocked "routing and page shell" step from its failing snapshot. Did it recover in one
  attempt?

### 7. Script discovery before running (coder, debugger)

- **Problem it solves:** 64% of `run_script` calls failed, some for scripts that don't exist.
- **When to use it:** Before any `run_script` (always on).
- **Inputs required:** The project's script list (preflight).
- **Prompt or skill definition:**

  ```text
  Run only scripts listed in the project's package.json. Run the narrowest one that proves your change (typecheck
  for type changes, the test file for logic). If the check you need has no script, say so in task_complete instead
  of inventing one.
  ```

- **Expected output:** `run_script` calls that name real scripts.
- **Value:** Fewer wasted calls. Narrower checks are faster.
- **Priority:** Medium. Partly code: FlowCode can refuse unknown script names with the real list.
- **Validation:** `run_script` failure rate excluding genuine check failures.

### 8. Evidence-based completion report (coder)

- **Problem it solves:** "Done" claims without saying what was verified. Blocked reports without a category (all 4
  are "unknown").
- **When to use it:** Every `task_complete` and `report_blocked`.
- **Inputs required:** The step's acceptance criteria and the commands run.
- **Prompt or skill definition:**

  ```text
  task_complete: list each acceptance criterion with pass/fail and the evidence (command and result, or file and
  line). Do not call task_complete while any criterion fails.
  report_blocked: give one category (missing_requirement, check_unpassable, environment, dependency, scope,
  model_limit), the evidence, and the single smallest next action.
  ```

- **Expected output:** Structured completion fields that FlowCode stores and shows in the run.
- **Value:** Fewer premature completions; blockers you can act on.
- **Priority:** Medium.
- **Validation:** Share of `task_complete` calls rejected (target below 25%); share of blockers with a category.

### 9. Ask before deciding (planner, coder)

- **Problem it solves:** Nothing tells the agent which decisions belong to you. It used `request_approval` twice in 903
  tool calls.
- **When to use it:** Always on. It matters most in requests touching sign-in, roles, stored data, payments, security,
  privacy or deletion.
- **Inputs required:** None beyond the request.
- **Prompt or skill definition:**

  ```text
  Stop and ask (request_approval with one short question and the options) before choosing any of: who can see or
  change what, what data is stored or its shape, payment or billing behaviour, security or privacy behaviour,
  anything that deletes data, or a new external service. Do not assume a default for these.
  ```

- **Expected output:** One targeted question instead of an assumption.
- **Value:** Safety and trust; fewer reverted runs.
- **Priority:** Medium.
- **Validation:** Send 3 requests with a deliberate permission or data ambiguity. Did it ask instead of guessing?

### 10. Python checks (runtime, low)

- **Problem it solves:** Python projects get no automatic checks.
- **When to use it:** The project type is Python.
- **Inputs required:** `pyproject.toml` or `requirements.txt`; whether pytest, ruff or mypy are configured.
- **Prompt or skill definition:** Mostly code: run `python -m pytest -q`, `ruff check` and `mypy` when configured,
  through the same governed runner and approval tiers as the npm scripts. The skill text: "Use pytest for checks; add a
  test beside the module you change."
- **Expected output:** Typecheck, lint and test checks for Python projects.
- **Value:** Lets FlowCode prove Python work the way it proves TypeScript work.
- **Priority:** Low (until you start a Python project).
- **Validation:** A small Python project with one failing test: does the run detect and fix it?

## PRD format

The 15-heading PRD template you supplied (Summary through Related documents, with FR-xx and AC-xx IDs) suits this
pipeline well. Recommendations:

- Use it as the default when FlowCode's "New build" writes or accepts a PRD. Add a PRD check that warns when Acceptance
  criteria, Non-goals or Users and permissions are missing, or when criteria aren't numbered.
- The Calendar PRD already has numbered headings (1 to 6.6) and a single acceptance-criteria section (3.4), so the
  section index works on it today. It has no FR or AC IDs, so the brief cites section numbers instead.
- Keep one primary PRD per feature. Link supporting docs by relative path. The intake skill follows links only when
  needed.

## Keep human-reviewed

These should stay with you even as the agent improves:

- Plan approval for anything touching sign-in, roles and permissions, stored data or schema, payments, or deletion.
- Installing or upgrading dependencies.
- Deleting files or data, and any rollback across more than one step.
- Validating security and compliance findings. The scanners are static and the tests show false positives (secret,
  SQL, children's data).
- Manual launch sign-offs (sign-in tested, data survives an update, access control). FlowCode writes the steps; you
  run them.
- Spec ambiguities and conflicts the intake brief raises.
- Visual and design acceptance. The vision critic is a 3B model and only gives rough feedback.
- Accepting FlowCode's spec review "met" verdicts on launch-gate items.
- Git commits and anything that leaves the machine (research queries, hosted models).

## Duplicate and overlapping skills to consolidate

| Overlap | Recommendation |
|---|---|
| `extend-tokens`, the token rules inside `avoid-ai-slop`, and the "use tokens" line in `generate-component` | One **design tokens** skill with modes: use existing, change a value, add a token, remove an unused one (addition 4 replaces `extend-tokens`). `avoid-ai-slop` and `generate-component` point to it instead of restating it. |
| `audit-accessibility` and the accessibility section of `avoid-ai-slop` | Keep `audit-accessibility` for audits and fixes. Trim `avoid-ai-slop` to one line that defers to it. |
| `repository-map` skill, the two "Repository map" knowledge items, and the reusable-parts brief | One cached **project context** (repo map, scripts, conventions, reusable parts) regenerated when the tree changes. Remove the duplicate knowledge item. |
| The debugger prompt's "rewrite the whole file after two misses" and the new edit guards | Replace it with addition 6, so prompt and guards agree. |
| `prepare-release-notes` and the run's final report | Low priority. Have release notes start from the final report rather than re-deriving from events. |

## Top three for quality and speed

1. **PRD intake brief (1).** It removes the biggest avoidable context cost on spec builds, and stops plans checking for
   things the PRD never asked for. You see what was read and assumed before approving.
2. **Exact patch protocol (2).** The single most frequent failure (98 misses), each one a model round trip plus often an
   approval.
3. **Acceptance check writer (3).** It goes straight at the 56% of rejected "done" claims, and at both failure shapes
   seen this week: checks that can never pass, and checks that pass while something breaks.

Outside the library, the largest single speed gain is configuration: keep the coder and debugger on qwen3:8b, and let
the 14b model take over only after a failed attempt, if at all. On this GPU, 14b writes at about 10 tokens per second
against 25, and accounted for 84% of all model time.

## How to measure

Use the Performance tab and a fixed benchmark of 5 requests on the Calendar app: a token change, a component
addition, a bug fix, a removal, and one PRD-driven feature. Run each 3 times before and after enabling a skill. Skills
can be switched on and off in Prompts & Skills, so A/B runs need no code changes. Track, per run:

- Steps verified on the first try
- Patch miss rate
- `task_complete` rejection rate
- Model minutes and prompt characters per call
- Failed model calls
- Approvals requested

Do not credit an improvement without the before-and-after numbers.
