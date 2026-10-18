# Requirement extraction and source-to-plan coverage (after Frameproof evaluation 2)

**Scope:** a bounded repair. Frameproof evaluation 2 stays at its plan review: not approved, not migrated, not resumed. The PRD is unchanged.

**Not done:**
- no model calls;
- no bullet-only rule;
- no unrelated changes.

## Root cause

**Extraction:** `extractRequirements` (`quality/spec.ts`) kept only list items, table rows, drawn layouts and lines containing must/should/shall. A paragraph line was a requirement only if it used one of those words. So 51 Frameproof sentences were never requirements, including:
- the 300-character note limit;
- "Do not wrap";
- the namespaced storage key;
- recovery from unreadable data;
- the submission and Start over dialogs.

**Coverage:** the plan's coverage was counted over extracted requirements only ("all 140 placed"). Nothing compared it with the PRD itself.

## Changes

1. **Extraction** (`quality/spec.ts`).
   - **What becomes a requirement:** any substantive paragraph line, alongside list items, numbered items and table rows. Substantive means it states an obligation, limit, exception, prohibition, condition or action, or a "Label: value" property.
   - **Lines stay whole.** "With fewer than five, explain how many more are needed. Mouse or keyboard interaction must not submit." remains one requirement. Only a line over 600 characters is split, and then only between sentences.
   - **Hard-wrapped sentences are joined** (`logicalLines`), so "…carried by at / least one of them." is one requirement.
   - **Source references:** each requirement keeps its source line and heading path.
   - **Lead-ins:** a list item keeps the lead-in that gives it meaning ("Keep one shared source of truth for: Shortlisted photo IDs."). Every planner and step reads it that way (`requirementText`).
   - **Bare lead-ins** ("Accessibility:", "Use these exact records:") aren't requirements of their own; their lists and tables are.
2. **Source-to-plan coverage** (`quality/sourceCoverage.ts`).
   - Every substantive PRD passage (paragraph line, list item, table row) is traced to its requirements and to where the plan puts them: a build step, a person's check, not in this release, the app model's records, or **unmapped**.
   - **Where it shows:**
     - stored per run (`sourceCoverage:<run>`);
     - reported as hard compliance check 13 ("every substantive PRD passage is in the plan"), so an unmapped passage makes the plan not approval-ready;
     - stated in the plan's assumptions as passage counts. The plan no longer claims "all requirements placed".
3. **Limits against tests** (`planChecks.statedLimits` and `limitContradictions`, in compliance check 11). The PRD's stated limits ("up to 300 characters", "maximum five selected photos", "at most 3 files") are compared with each test's numbers:
   - a count/limit display ("20/500");
   - a stated maximum ("maximum 6 photos").

   Search and filter expectations were already checked against the real fields and records. They still are.

## Regression evidence

**Targeted tests:** 97 pass in the targeted files. New: `test/requirement-coverage.test.ts` (7).

**From the unchanged Frameproof PRD**, each omitted obligation is extracted whole, with its source line and section:
- 300 characters (line 115, "R6 — Editing notes");
- Previous/Next order (100) and no wrap (101);
- namespaced key (145) and recovery (146);
- the dialog's contents (129) and Cancel (130);
- Submitted locking (133) and browsing after submission (134);
- Start over's dialog (138), Cancel/Confirm (139), and leaving other storage alone (140).

**Context is kept:**
- sentences on one line stay together;
- list items keep their lead-in.

The only lines not extracted are the four bare lead-ins.

**Evaluation 2's captured replies, replayed through the real planning path:**
- **Setup:** the planner's own replies, with its requirement IDs moved to today's by text. No model call.
- **Result:** every omitted obligation is quoted in the build step that carries it, and its passage is "in a build step".
- **Coverage:** 184 substantive passages, **0 unmapped**:

  | Placement | Passages |
  |---|---|
  | In build steps | 148 |
  | The app's records | 19 |
  | For a person to check | 5 |
  | Not in this release | 12 |
  | Bare lead-ins | 4 |

- **Check 11 flags the demonstrated contradictions:**
  - "20/500" ("expects a limit of 500 characters; the PRD says 300");
  - "Nature" (not a category option);
  - "Outdoor" typed into search (a category, not a title).
- **The plan:** "Not approval-ready: 1 contradiction with the PRD".

**Formatting equivalence** (a non-Frameproof product): the same four requirements, with a limit, a prohibition, an exception and a "regardless", are written as bullets, paragraph lines, numbered items and hard-wrapped lines. All four forms:
- extract identical requirements;
- carry each into a build step of the assembled plan;
- leave no passage unmapped.

**Unmapped detection:** a passage nothing places is reported, with its line, and its report row reads "unmapped".

**Limits on another product:** "at most 280 characters" against "12/140", and "at most 3 files" against "up to 5 files", are both caught. Matching numbers pass.

**Updated earlier tests:** existing Frameproof and Clean Cart replays now include check 13; the Clean Cart replay maps every passage.

**Typechecks and suite:**
- **Typechecks:** contracts, daemon and UI pass, and 206 library pieces typecheck.
- **Full daemon suite, run in parallel:** 1,627 passed, 82 failed. The failures are browser, timing and integration tests under load; every failing file passes when run on its own.

**The full source-to-plan report:** `COVERAGE.md`: every PRD line, its requirements and its place in the plan.

## What still needs human review

- **In the replay, the formerly omitted obligations land in FlowCode-placed steps** ("… remaining requirements"), because the captured planner never saw them. Each such step must write at least one test per requirement.
- **In a real run, the planner receives them in its checklist batches.** Whether its tests then check the right thing is unverified until a real planning run. Contradictions the checks know (limits, search, filters, counts) are flagged.
- **The extractor's notion of "substantive" is a pattern** (obligation, limit, condition, action words, numbers, "Label: value"). A purely descriptive line with none of these isn't a requirement. It is then still a passage, so coverage reports it as unmapped rather than dropping it silently.
- **More requirements means more planner batches.** Frameproof now gives 184 requirements, up from 140, so planning takes longer.

## Can Request changes bring this code into the current build?

**Not by itself.** Request changes re-plans inside the daemon that holds the run. Evaluation 2's daemon (port 7464) runs `packages/daemon/dist-v4`, frozen at candidate 84f648f, so a revision there plans again with the old extraction.

**What it would take** is an explicit migration:
1. Build this candidate into a new folder.
2. Restart that daemon on it.
3. Press Request changes.

**Why this wouldn't start execution:**
- after a restart, a run waiting for plan approval keeps its pending plan approval ("Plan approvals are left for the user", `orchestrator.ts` startup recovery);
- Request changes re-plans only before any step starts;
- the new version needs a fresh approval.

**What changes about the evaluation:**
- the frozen candidate changes mid-evaluation;
- requirement numbering changes between plan versions;
- version 1 stays in the plan history, planned by the old code.

**Not done:** none of this was done: no build, restart, request, approval or resume. A fresh run on the new candidate measures it cleanly; migrating the current run would measure a mixed build.
