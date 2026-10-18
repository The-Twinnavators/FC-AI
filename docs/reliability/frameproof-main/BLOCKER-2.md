# Blocker 2: "Correct the generated app" blocked (read-only diagnosis)

The owner retried at 18:22:48Z after the BLOCKER-1 repair. "Write the complete app" then ran FlowCode's deterministic generator again.
- **Content check:** passed. The BLOCKER-1 repair worked.
- **Typecheck, build and tests:** passed.
- **Functional baseline:** failed on two points, so FlowCode added one model step, "Correct the generated app" (qwen3:8b). That step made no change in 3 attempts and was blocked at 18:44:16Z.

The workspace is as generated, kept unverified at checkpoint cp_f23f1db5d0d148f6bc52. This diagnosis did not change it.

## Failure 1: lint error in FlowCode's own library piece
- `src/sections/RecordDetail.tsx:635`, rule `@typescript-eslint/no-unused-expressions`.
- The code is `navigator.clipboard?.writeText(…).then(…) ?? toast(…)`, used as a statement.
- The file is byte-identical to `templates/library/sections/record-detail.tsx:635`.
- The library's own check (`typecheck:library`) runs tsc only, never the starter's eslint config, so this never surfaced.

## Failure 2: journey "Gallery in the top bar is disabled"
- **The generated nav** (`src/app/routes.ts`) has one group per destination, each named like its only item: group "Gallery" holds item "Gallery", and group "My Selection" holds item "My Selection". The planner's app model named the groups that way, and appFiles.ts:119 copies them as they are.
- **The frame** (app-frame.tsx:191-201) renders each group heading as a button. The heading of the group holding the current page gets `aria-disabled`.
- **The journey** (appJourney.ts:123) takes the first button or link named "Gallery". That is the disabled group heading, not the nav item.
- **The result:** two controls share each name. That is a real accessibility defect as well as a check failure.

## Why the correction step could not fix it
- The failure summary kept "635:21 error …" but dropped the file name, which sits on the line above in eslint's output.
- The step's brief listed `src/app/schema.ts` and `src/App.tsx` as its files. Neither contains the error.
- qwen3:8b spent all 3 attempts editing schema.ts. Every edit was refused as unparseable or not matching, and the last reply was prose only.

## Classification
Both failures are generated-code defects in FlowCode: a library template and the generator's nav grouping. A third defect, the failure summary losing the lint file name, sent the correction step to the wrong files. None of this is unfinished model work.

## Recovery options
- **A. This run, no builder change:** Retry the step with guidance that names the exact two edits. The model then does the repair (qwen3:8b; its patching was weak in this step).
- **B. Builder repair (bounded), then Retry:**
  1. In `templates/library/sections/record-detail.tsx:635`, replace the expression statement with an if/else.
  2. In `appFiles.ts`, stop emitting a nav group named like its own item: groups that each hold one same-named item become one group named after the product.
  3. Keep the lint file name in the failure summary.
  4. Add tests: the app pieces pass the starter's eslint, and generated NAV has no group label equal to an item label.

  A retry reopens only "Correct the generated app". It does not regenerate, so the run's own files still need fixing, by guidance as in A.

## What the failed correction attempts received (evidence: blocker-2/)
- **Brief** (`correction-task.json`): failures "Lint: failed: npm run lint failed: 635:21 error Expected an assignment…" (no file) and "Journey: … Gallery … is disabled". Its scope (expectedPaths) was `src/app/schema.ts` and `src/App.tsx`, and the objective named "the records in src/app/schema.ts".
- **Routing:** attempt 1 was classified "a FlowCode guard or tool refusal". Attempts 2 and 3 were "a failure with no located error" and went to the debugger. FlowCode's LINT_ERROR pattern only matched relative forward-slash paths, so ESLint's Windows path line (`C:\…\src\sections\RecordDetail.tsx`) was never located.
- **Tool calls** (`correction-tool-calls.txt`): all were on schema.ts. The model tried to fill the records' empty imageSource/altText/note (none of the failures).
  - First, one find text that occurs 12 times was rejected as ambiguous.
  - Then the same edits with line numbers left the file unparseable (12 errors), so they were refused, three times.
  - The debugger's edits found no matching text.
  - Each attempt ended in prose with no tool call: nothing it was told to fix was in the files it was given.
- **Conclusion:** the failed edits and the prose endings follow from the routing and context defect (the wrong file, no located diagnostic, no code context). The model was not changed (qwen3:8b).

## Builder repair (owner-authorized; builder changes, separate from generated-app changes)
1. **record-detail template:** the clipboard expression statement became `if (!navigator.clipboard) { toast(id); return; } navigator.clipboard.writeText(id).then(copied, refused)`. All three outcomes are kept.
   - Test `generated-pieces-lint.test.ts`: the starter's no-unused-expressions rule (default options), checked with TypeScript's parser on every app piece *as written into the app* (pieceFiles). It includes a control that flags the old snippet and the three outcomes.
   - The test fails on the old template and passes on the new one.
   - The real ESLint with the app's config (read-only via stdin in the run's workspace) shows no errors in any app piece.
2. **Menu check** (`appJourney.ts`): the top-bar step clicks the screen's enabled navigation control. It skips disclosures (aria-expanded group headings) and disabled controls, and still fails when the only control is disabled.
   - Test `journey-nav-control.test.ts`, in a browser: one case where a group and a link share the label, and one where the only control is disabled.
   - The old check reproduces the run's exact failure ("Gallery" … disabled).
   - The generator's nav grouping was not changed.
   - On a copy of this run's generated app, the fixed journey passes: Gallery opens from the top bar, 1/1 (`blocker-2/journey-on-generated-app.json`).
3. **Correction targeting:**
   - `diagnosticsOf` reads ESLint's stylish output with absolute Windows or POSIX paths.
   - A failed lint check's summary names the file, followed by ESLint's own error line. TypeScript summaries are unchanged; a first version changed them and broke routing (recovery-routing test), so that was reverted.
   - The step baseline keeps located diagnostics.
   - A baseline-correction step, at each first attempt (so also after a retry), gets "Located errors now" in its brief: each file:line diagnostic with its current code (±4 lines). Their files join its scope, and the list is replaced, not appended.
   - New correction steps name schema.ts only for a records failure, and src/app/routes.ts for a journey failure.
   - Test `correction-targeting.test.ts` uses the recorded lint output.
4. **Checks:** daemon tsc is clean. The full daemon suite run serially: 2154 passed, 0 failed. The parallel run shows timing flakes in unrelated files; each flaky file passes serially.
