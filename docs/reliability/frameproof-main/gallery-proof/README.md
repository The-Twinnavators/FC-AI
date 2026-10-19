# Frameproof: bounded Gallery proof (2026-10-19)

Build: FlowCode 9d37f95 on the main daemon. Look: version 3 as applied by the person (light, Flat, primary #070817,
secondary #002450, tertiary #0087b3, pure neutrals, Roboto; motion and typography locked; no notes). Model: qwen3:8b,
24k window, unchanged.

## Commands
1. `POST /runs/run_b789650d36dd4323aa4b/run-steps {taskIds:[design step]}`, 04:35:43Z. The step was refused at its
   opening (17,046 tokens of 14,336) and split by FlowCode into 5 parts, with no model call; the runner stopped itself at
   04:35:51Z.
2. `POST .../run-steps {taskIds:[pictures, Gallery]}`, 04:37:32Z. The runner stopped itself at 04:44:26Z.

Fit rechecks on copies before each command: `fit-live-parent.json` and `fit-cmd2.json` (pictures 2,681 and Gallery 2,842
tokens free on a later turn, against 2,457 of headroom; these measure the coder's first attempt only).

## What the model did (`gallery-proof-toolcalls.json`)
- **Give the records their pictures** (verified, about 5 min): 16 tool calls. Of 12 find_image searches (Openverse,
  CC BY 2.0, under the project's "allow external research"), 8 were saved and 4 found nothing. One patch to
  `src/app/schema.ts` set those 8 image paths (`schema.diff`). The 4 others are left empty (the step asked for a local
  SVG fallback). The images often don't match their records ("Window Light" is a 1958 Sears camera advertisement).
- **Design the Gallery screen** (blocked): attempt 1 made 2 patches to `src/screens/GalleryScreen.tsx`
  (`GalleryScreen.diff`). They keep the same list component and add a search state, with `useRecords("photo")` missing
  its store argument and `useState` not imported. The type check failed 3 times with the same error. No `gallery.css`,
  no grid, no styling. Attempt 2 (the debugger) was refused before any model call: its request needs 38 tokens more than
  the window leaves with the headroom (22,157 of 24,576; the debugger is shown all tools, 13,378 characters of them).

## Result
The Gallery is the first screen and doesn't render: the page is blank, with "TypeError: getSnapshot is not a function"
from `GalleryScreen` (useRecords called without the store). Nothing outside the two named steps ran; the parts after
Gallery and tasks 9–13 are untouched (pending, then invalidated behind the blocked step).

## After: the Gallery step's Undo (2026-10-19 05:01–05:02Z)
The failed file is kept here as `GalleryScreen.failed.tsx`, with the full type-check output
(`gallery-typecheck-output.txt`) and the runtime error (`gallery-runtime-error.txt`). FlowCode's step Undo
(`POST /runs/:id/tasks/:taskId/rollback`) restored the step's three snapshots of `src/screens/GalleryScreen.tsx`. The
first call restored two and failed on a Windows file lock (`EPERM`); the second restored the last one. The file is now
byte-identical to the pre-proof backup. The Look's files, `schema.ts` and the 8 images are unchanged
(`hashes-before-undo.txt` and `hashes-after-undo.txt`). The restored app renders the previous Gallery list with no
console errors. The step is `pending` inside the still-declared bound: Continue would start it again. The full state is
in `docs/handoff/2026-10-16/HANDOFF.md`, section 0.

## Defects this showed
- A part stopped for fit leaves its half-finished changes in place (other blocked steps are undone), so the app is broken.
- The fit recheck covered the first attempt only, not the retry roles' larger requests.
- The run-level checks ran again 14 s after the first stop; the runner doesn't start them at a boundary, and the
  trigger wasn't recorded.
