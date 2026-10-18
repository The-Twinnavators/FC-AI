# Blocker 1: "Write the complete app" blocked on "sample data" (read-only diagnosis)

Run run_b789650d36dd4323aa4b. The step was blocked at 16:56:25Z. Its diff was undone and kept as artifact art_e0b34d50e95b47e5b53a (`.flowcode-data/objects/6b/6bd0837c…`). The workspace was not changed by this diagnosis.

## What was flagged
- The file is `src/sections/ResourceIndex.tsx`, a verbatim copy of FlowCode's library piece `templates/library/sections/resource-index.tsx` (one of APP_PIECES, appFiles.ts:26).
- The flagged text is the button label "Reset sample data" (template line 862). It sits in `RoleSwitch`, under "// ── The reference sheet ──" (line 836).
- `RoleSwitch` is used only by the piece's demo sheet (line 881). The app would never render it.
- The rule is contentCheck.ts:17 `/\bsample (…|data|…)\b/`. For `src/sections/*` files, the check only skips text *after* the `// flowcode:sample` marker (contentCheck.ts:70-72, from 16e2fd2).
- In resource-index.tsx that marker is at line 868, below `RoleSwitch`. So the demo button falls inside the checked part.
- The other four app pieces put their marker above their demo code. A scan of every library section against the check's patterns finds only this one file.

## The two attempts
- This step does not use the model. Both attempts logged "Wrote the app from its model" (FlowCode's deterministic generator), and both wrote the same 16 files, including the same ResourceIndex.tsx copy.
- Neither attempt changed the flagged line. Attempt 2 (debugger role) could not change the outcome.
- Typecheck passed both times.

## Classification
This is a false positive from a builder defect: a FlowCode library piece's demo-only code sits above its own sample marker. It is not unfinished generated content, and it is not an unused starter file, since the generator writes the piece on purpose and the app imports it. Retry guidance cannot fix it, because the generator ignores guidance and writes the same file again.

## Model and Look (as recorded)
- **Models:** the run's planner, coder and debugger are qwen3:8b (Ollama, 0.1, reasoning). This is the main daemon's configured assignment. The earlier evaluations pinned qwen3-coder:30b on their own daemons. Unchanged.
- **Look:**
  - The plan was approved with look choice "base".
  - `design/state` says "Base styling — no brand direction selected".
  - A direction (version 2) was selected at 16:55:58Z: primary #070817, Roboto, flat, expressive motion, secondary #002450. Its state is "Selected, not yet applied".
  - Nothing applied the PRD's editorial direction (warm off-white, muted cobalt).

## Proposed bounded fix (not applied)
1. In `templates/library/sections/resource-index.tsx`, move the `// flowcode:sample` marker up so it sits above "// ── The reference sheet ──", as the other pieces have it. This is a template-only change. The checker stays as it is.
2. Add a regression test: every library section's shown part passes `contentProblems`.

Templates are read from disk at run time, so no daemon rebuild or restart is needed. Recovery in this same run is then **Retry the step** (your click). The generator will write the corrected piece.

## Repair applied during the build (builder repair, not an unchanged evaluation)
The owner approved this at about 17:05Z, with the run blocked at "Write the complete app" and both failed attempts kept (artifact art_e0b34d50e95b47e5b53a).

- **resource-index.tsx:** the demo-only `RoleSwitch` (the reference sheet) moved below the `// flowcode:sample` marker and its `SAMPLE` block.
  - This follows app-frame's layout and has the same effect as moving the marker above the sheet.
  - It keeps `// flowcode:sample\nconst SAMPLE` adjacent, which the piece-content verification (verification.ts:167) reads. Moving only the marker would have dropped resource-index from that check.
  - Production code stays above the marker: `ResourceIndex`, `recordsToCsv` and the helpers.
  - The checker is unchanged, and no exclusion was widened.
- **Test test/library-content.test.ts:**
  - all 206 library sections pass the content check;
  - the app pieces keep every named export above the marker;
  - SAMPLE sits right after the marker;
  - placeholder text planted before the marker is still found ("Reset sample data", lorem ipsum, "Coming soon").
  - The test fails on the original template and passes with the repair.
- **Checks:** library-content and stuck-patterns tests 439/439; daemon tsc clean; typecheck:library 206 pieces.
- **Run setup:** no daemon restart (templates are read from disk), no model change, same run.
- **Separate finding, not fixed:** record-wizard's one-line SAMPLE doesn't match the regex at verification.ts:167, so the piece-content check skips it. This was already the case before this repair.
