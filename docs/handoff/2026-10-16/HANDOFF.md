# FlowCode: handoff for an implementation and performance assessment

Prepared 2026-10-16 (19:50 EDT) from the repository at commit `7ca9b07` (branch `claude/preview-toolbar-and-library-sizes`,
211 commits, none pushed since the branch was cut), the local run database (`.flowcode-data/flowcode.sqlite`) and the
runs described below. Assessment only: no redesign proposals are included.

**Labels used throughout**
- **[Verified]**: read from the files, the database or command output, or observed in a run.
- **[Assumption]**: inferred, not checked directly.
- **[Unknown]**: not inspected, not measured or not tested.

Everything this document refers to is in this folder (`docs/handoff/2026-10-16/`), except source files, which are cited
by path in the repository.

**Updated 2026-10-19:** section 0 is the current state (the Frameproof bounded Gallery proof); sections 1–8 are the
2026-10-16 assessment, unchanged. Only this file is committed from this folder. The 2026-10-16 attachments the
earlier sections cite (`input/`, `logs/`, `output/`, `benchmarks/`, `tests/` and the zip) stay local and uncommitted.

---

## 0. Update 2026-10-19: Frameproof bounded Gallery proof (current state)

Sections 1–8 below are the 2026-10-16 assessment, unchanged. This section is the current state, prepared 2026-10-19
(about 05:10Z). Evidence for everything here is in `docs/reliability/frameproof-main/gallery-proof/` ("evidence/" below).
No model execution, fix, retry or restart has happened since the Undo in 0.8.

### 0.1 Source and running build [Verified]
- **Source:** HEAD `9d37f95`, branch `claude/preview-toolbar-and-library-sizes`, not pushed. The commits behind this
  proof:
  - `16a8465`: tool results bounded to the later-turn reserve; a split part that doesn't fit stops before the model;
    a lint-safe live-preview bridge.
  - `7869c9d`: bounded runs (`/run-steps`); a tenth of the window kept free on later turns; a design direction from
    the person's Look and the PRD; Look notes.
  - `9d37f95`: each design instruction delivered once.
- **Uncommitted, not from this work:** `apps/ui/src/components/StylesPanel.tsx`, `apps/ui/src/styles/responsive.css`.
  `.claude/launch.json` is local only (never committed).
- **Untracked:** the measurement harness `packages/daemon/test/_tmp_fit_recheck.test.ts`.
- **Running:**
  - The main daemon on `127.0.0.1:7457` (token `dev-token-flowcode`), pid 25316, started 2026-10-19T02:42:34Z from
    `packages/daemon/dist`. That build was made with `tsc -b` from `9d37f95` (contracts and daemon) at 02:42Z.
  - The UI on Vite at `localhost:5199`, served from source.
  - The Frameproof preview on `127.0.0.1:53273` (FlowCode's project preview).
- **Rollback for that activation:**
  - `packages/daemon/dist-rollback-20261019T024204Z` and `packages/contracts/dist-rollback-20261019T024204Z`: the
    `7869c9d` build.
  - Data and workspace backup: `.flowcode-data/backups/20261019T024204Z/` (`flowcode.sqlite` online backup;
    `frameproof-f6873f/` without `node_modules`).
  - Earlier rollback copies from the same night: `dist-rollback-20261019T022217Z` and `-022232Z`, and backups
    `20261019T0222*`.
- **Restarts that night:** `7869c9d` was activated with two restarts (the script crashed after the first and was run
  again; the build was identical). `9d37f95` was activated with one: the script's first try failed before restarting,
  then `restart.mjs` restarted once.
- **Model:** qwen3:8b on Ollama 0.40.6 for planner, coder and debugger. 24,576-token window, replies up to 4,096.
  Unchanged throughout.

### 0.2 Project, run and task state [Verified]
- **Project:** `prj_7dc3fb8e913b4f61840f` "Frameproof". Workspace `.flowcode-data/workspaces/frameproof-f6873f`.
- **Look:**
  - Version 3, applied by the person at 2026-10-19T04:34:46Z: light, Flat, primary `#070817`, secondary `#002450`,
    tertiary `#0087b3`, pure neutrals, Roboto for headings and text, expressive motion.
  - Locked: motion and typography. No notes.
  - Apply checks: technical passed, browser passed. The person's visual approval is pending.
- **Run `run_b789650d36dd4323aa4b`:** status `running` with no worker (`active: false`). Paused by the system at the
  bound (interruption `boundary`, active). The declared bound is still [pictures, Gallery]; its stop was recorded at
  04:44:26Z.
- **Caution:**
  - The Gallery step is `pending` again after the Undo and is still inside the declared bound, so **Continue on this
    run would start the Gallery step again**.
  - Clearing the bound (`POST /runs/:id/run-steps/clear`) and pressing Continue would run everything left, including
    the functional tasks at ordinals 14–18, which still contain the four contradictory expectations.

| # | Step | Id | Status | Attempts |
|---|---|---|---|---|
| 0–5 | Scaffold, install, import spec, capture style, review plan, library sections | | verified | 1 |
| 6 | Write the complete app | `task_ad55ec076d1b4517be13` | skipped | 1 |
| 7 | Correct the generated app | `task_312e944aa65d45ceb3d7` | verified | 1 |
| 8 | Design the main screens | `task_809f74d05cc449f0b3f0` | skipped (split into 9–13) | 0 |
| 9 | Give the records their pictures | `task_74f1991997504bda9d5d` | verified | 1 |
| 10 | Design the Gallery screen | `task_400b5e88413040b6a109` | pending (after Undo) | 1 |
| 11 | Design the Photo detail screen | `task_9a50219b1fed44ad8256` | invalidated | 0 |
| 12 | Design the My Selection screen | `task_7ff3e63de32e4f019e9d` | invalidated | 0 |
| 13 | Design the frame | `task_48e6df3418cc42f6b50f` | invalidated | 0 |
| 14 | User and context: Gallery Screen Composition and 7 more | `task_c64bd101583d4c10880c` | invalidated | 0 |
| 15 | R2 — Search: Search Functionality and 10 more | `task_153a919733fe4514b0e5` | invalidated | 0 |
| 16 | R12 — Navigation and identity | `task_da8a6259c7974a969a5f` | invalidated | 0 |
| 17 | Responsive behavior | `task_fa30f6722b91412caa2d` | invalidated | 0 |
| 18 | Screens and navigation: My Selection Screen Composition and 8 more | `task_dfbb2681d5d548dd8d91` | invalidated | 0 |
| 19–21 | Design polish, Clean up the code, Assemble the app | | invalidated | 0 |

(Ordinals 14–18 are the functional "tasks 9–13" of earlier reports.)

### 0.3 What ran [Verified, events table]
1. **2026-10-19T04:35:43Z: `POST /runs/:id/run-steps {taskIds: [design step]}`.**
   - The design step's opening request was 17,046 tokens against a 14,336 budget, so FlowCode split it by screen
     into 5 parts (`designParts.ts`) with no model call.
   - The runner stopped itself at 04:35:51Z.
2. **04:36:05–04:36:23Z: the run-level checks ran.**
   - The checks: typecheck, build, static scans, server start, preview, screenshots, accessibility (failed: 2 axe
     violations), design QA, and the journey (passed).
   - No model call (the visual critic is off).
   - The runner doesn't start these at a boundary, and the trigger wasn't recorded **[Unknown]**.
3. **04:37:32Z: `POST /runs/:id/run-steps {taskIds: [pictures, Gallery]}`.**
   - Pictures ran from 04:37:37 to 04:42:49 and was verified.
   - Gallery attempt 1 (coder) ran from 04:42:54 to 04:44:17 and failed.
   - Gallery attempt 2 (debugger) was refused at 04:44:26 before any model call.
   - The runner stopped itself at 04:44:26Z.
4. **Model calls:** completed model calls for this run went from 70 to 103 (33 calls, all qwen3:8b), over the two
   steps.

### 0.4 Who changed what
**Model-generated (qwen3:8b, through FlowCode's tools; evidence/gallery-proof-toolcalls.json):**
- `public/images/photo-01, -02, -03, -05, -06, -08, -10, -12.jpg`, from `find_image`: Openverse, CC BY 2.0, fetched
  online under the project's "allow external research" setting. The tool also recorded credits in `src/content/`.
  **Kept.**
- `src/app/schema.ts`: `imageSource` set for those 8 records, by one `apply_patch` after one ambiguous-patch failure
  (evidence/schema.diff). **Kept.**
- `src/screens/GalleryScreen.tsx`: 2 `apply_patch` calls (3 snapshots). **Undone** (0.8).

**FlowCode runtime (no model):**
- the split into 5 parts;
- the per-step checks;
- the snapshots;
- the fit refusal of attempt 2;
- the two boundary stops;
- the run-level checks in 0.3 (2).

**The person:**
- Look version 3 applied: `src/styles/tokens.css` and `src/styles/fonts.css` (snapshot seq 8458, outside any step);
- the locks.

**Developer (Claude), no hand edits to Frameproof's app files:**
- FlowCode source changes (the three commits in 0.1) and their activations;
- the two bounded commands and the preview start (API);
- fit measurements on copies;
- a demo copy (`.flowcode-design-demo`), with a Look applied there only, to measure the normal Design-page flow;
- the Gallery-step Undo (two calls, 0.8);
- the evidence files.

### 0.5 Pictures: acceptance criteria versus what was marked verified [Verified]
**The step's objective asked for:**
- a distinct local image for each record (with `find_image`, else a simple local SVG showing the record's title);
- `imageSource` set for each record;
- nothing else in the records changed;
- no remote image address at runtime.

**Its acceptance criteria, both passed, so the step was marked verified at 04:42:49Z:**
- `data-source`: the records hold the PRD's sample records, linked as the app model says.
- `typecheck`.

**Not covered by any criterion, so "verified" covers the two checks, not the objective:**
- **Every record has a picture:** 4 of 12 still have `imageSource: ""` (photo-04, -07, -09, -11). Their searches
  found nothing and no SVG was made.
- **Relevance:** "Window Light" is a scanned 1958 Sears camera advertisement, and "Golden Hour" is a night portrait.
- **Distinctness.**

### 0.6 The failed Gallery attempt [Verified]
- **Criteria, none met:**
  - typecheck;
  - `changed:src/screens/GalleryScreen.tsx|src/styles/gallery.css`;
  - `images-used:` on the same files;
  - `piece-content:src/screens/GalleryScreen.tsx`.
- **The change** (evidence/GalleryScreen.diff; the failed file as evidence/GalleryScreen.failed.tsx):
  - It kept the same `ResourceIndex` list.
  - It added `const photos = useRecords("photo")` and a `searchTerm` state passed as `search` and `onSearchChange`.
  - No `gallery.css`, no photo grid, no styling.
- **Type check** (full output in evidence/gallery-typecheck-output.txt). FlowCode's check summary showed only the
  first line:
  - `GalleryScreen.tsx(11,18): TS2554 Expected 2 arguments, but got 1` (`useRecords(store, entity)`);
  - `GalleryScreen.tsx(12,39): TS2304 Cannot find name 'useState'`;
  - `GalleryScreen.tsx(19,5): TS2322`: `search` and `onSearchChange` aren't props of `ResourceIndex`.
- **Runtime (before the Undo):** a blank app. `Uncaught TypeError: getSnapshot is not a function` at
  `useRecords → GalleryScreen` (evidence/gallery-runtime-error.txt).

### 0.7 Request measurements (qwen3:8b; tokens at the measured 3.8 characters a token; later turns counted at 80% of that)
| Request | Where | Opening (of 14,336) | Later turn (must be ≤ 24,576 − 2,457 headroom) | Outcome |
|---|---|---|---|---|
| Undivided design step | offline recheck 04:35Z; runtime 04:35:4x | 17,046 offline (2,710 over); about 17k at runtime | — | split, never sent |
| Pictures, attempt 1, coder | offline recheck on copies (evidence/fit-cmd2.json) | 12,314 | 21,895 (2,681 free) | sent and verified |
| Gallery, attempt 1, coder | offline recheck before command 2 | 12,186 | 21,734 (2,842 free) | sent |
| Gallery, attempt 1, coder | runtime, 04:42:55 | about 12.4k (system 18,688 incl. skills 8,282; tools 9,551; brief 18,694 characters) | passed the runner's check | sent |
| Gallery, attempt 2, debugger | runtime, 04:44:26 | about 12.6k (system 9,703 incl. skills 1,909; tools 13,378; brief 24,859) | 22,157 + 2,457 = 24,614 | refused, 38 over |

**Why the debugger's request is larger:**
- It is shown every tool (13,378 characters of definitions against 9,551).
- Its brief adds the located errors, three "fix memory" notes from earlier builds, and the coder's findings.

The offline recheck measured only the coder's first attempt. The saved request texts are
evidence/request-gallery-attempt1-coder.txt, request-gallery-attempt2-debugger.txt and
request-pictures-attempt1-coder.txt; tool definitions are listed by name only.

### 0.8 Undo and rollback behaviour [Verified]
**Step Undo** (`POST /runs/:id/tasks/:taskId/rollback` → `Orchestrator.rollbackTask` → `SnapshotManager.restoreTask`):
- restores that step's own unrestored snapshots, newest first;
- sets the step `pending` with no blocker;
- invalidates its verified dependents;
- doesn't touch other steps' snapshots or the Look's.

**This Undo:**
1. **2026-10-19T05:01:39Z:** restored snapshots 8462 and 8461, then failed with `EPERM` renaming
   `GalleryScreen.tsx.flowcode-restore.tmp` over the file. This was a Windows file lock; the project's Vite preview
   watches it. The step was left `blocked` and the temp file left behind.
2. **05:02:00Z:** the same Undo again restored the one remaining snapshot, 8460 (`{"restored":1}`). The temp file is
   gone and the step is `pending`.
3. **Result:**
   - `GalleryScreen.tsx` is byte-identical to the pre-proof backup.
   - `tokens.css`, `fonts.css` and `schema.ts` are unchanged (evidence/hashes-before-undo.txt, hashes-after-undo.txt).
   - The 8 images are kept.
   - The restored app renders: the Gallery list of 12 photos, 10 per page, with search; no console errors on a fresh
     load.

**Other rollback paths:**
- **Automatic undo of a blocked step's half-finished changes** (`undoBlockedStep`) runs when a step blocks on its
  attempts (unless it is nearly passing). It does **not** run when a step is stopped because it doesn't fit ("more
  tokens than…"). That is why the broken Gallery stayed in place after the stop.
- **Checkpoint restore** (`POST /runs/:id/checkpoints/:checkpointId/restore`): restores every run snapshot after a
  checkpoint.
- **Build rollback:** stop the daemon, copy `dist-rollback-<ts>` back over `dist` (daemon and contracts), and start it
  again. The data rollback is the `flowcode.sqlite` in `.flowcode-data/backups/<ts>/`, restored with the daemon stopped.

### 0.9 Commands, tests and evidence
**API** (token `dev-token-flowcode`):
- `GET` / `POST /runs/:id/run-steps` (body `{taskIds}`) and `POST /runs/:id/run-steps/clear`;
- `POST /runs/:id/tasks/:taskId/rollback`;
- `POST /system/restart`;
- `POST /projects/:id/preview/start`;
- `GET /projects/:id/design/state`;
- `GET /runs/:id`.

**Fit measurement on copies, with no model call.** From `packages/daemon`, run
`MEASURE_OUT=<file> [PART_IDS=<task ids>] [DATA_DIR=.flowcode-design-demo] npx vitest run test/_tmp_fit_recheck.test.ts`.
It copies the database (online backup) and the workspace, then runs `Orchestrator.measureRequest`. Without `PART_IDS`
it measures the parts the split would make. A copy is in evidence/scripts/fit-recheck.test.ts.txt.

**Activation:** evidence/scripts/activate.mjs (backups, rollback copies, build, restart) and restart.mjs (the restart
step alone, with retries). activate.mjs's restart step failed twice on a pooled connection the daemon had closed while
the build ran.

**Tests added:**
- `bounded-run`, `bounded-results` and `split-part-later-turn`;
- `working-headroom` and `direction-delivery`: exact duplicates, a partial overlap with a new instruction, an explicit
  override, locked groups.

All pass. The full daemon suite last ran in parallel with `7869c9d`'s changes (before `9d37f95`): 24 failures, all timeouts, and every failing
file passed when rerun serially. After `9d37f95` only the related suites were run (all pass serially).

**Evidence:**
- evidence/ (this proof);
- `docs/reliability/frameproof-main/` (earlier blockers, MEASUREMENT.md, SPLIT-PROPOSAL.md, RECOVERY-ACCEPTANCE.md);
- `docs/design-direction-demo/` (the Design direction page demo).

### 0.10 Defects this proof showed (none fixed)
1. A step stopped for fit keeps its half-finished changes; other blocked steps are undone.
2. The pre-run fit recheck covers only the coder's first attempt, not the larger retry and debugger requests.
3. A type-check result's summary shows only the first error.
4. The pictures step's criteria check neither that every record has a picture nor the picture's relevance.
5. `find_image` kept images that don't show what was searched for.
6. Undo isn't resilient to a Windows file lock: a partial restore leaves the step blocked until it is invoked again.
7. Run-level checks ran after a boundary stop, and their trigger wasn't recorded.
8. In its two edits, qwen3:8b made no design attempt on the Gallery (no grid, no stylesheet). Whether this model can
   do this screen's design at this request size is unproven.

### 0.11 Unresolved
**The build:**
- The four contradictory expectations in the functional tasks (ordinals 14 and 18): not corrected.
- The oversized functional tasks (ordinals 14–18): not resized.
- The Gallery, Photo detail, My Selection and frame design: not done.

**V2 capabilities, not done:**
- fonts beyond the 12 bundled ones;
- richer natural-language direction;
- reference images and brand capture;
- component alternatives and variants;
- screen- and component-scoped changes;
- layout and composition control. This includes choosing between composition concepts: the three-concept Home picker
  is offered only for look-up apps, so Frameproof was never offered one.
- complete PRD design guidance, including motion;
- before/after UX validation;
- live font preview in the packaged desktop app.

**V2 user-experience requirements, not validated against their metrics:**
- reduce friction;
- responsive;
- the preview central;
- human control;
- no internal orchestration in the main experience;
- consistency.

**Not claimed:** neither the full Frameproof prototype nor V2 is complete.

---

## 1. Goal and success criteria

**What it is supposed to do [Verified, README.md and docs/how-flowcode-builds.md]**
- FlowCode is a local-first desktop app (Electron + React UI + a Node daemon).
- The person gives it a product request or PRD. It plans the build, writes a working web-app prototype with local
  language models (or a cloud model if the person chooses), checks every step with code rather than model claims,
  and hands back a runnable, inspectable, reversible result, or a precise explanation of what blocked it.
- The person approves the plan and any risky action. Models propose; the runtime governs tools, scope, approvals,
  snapshots and the "Done gate".

**What "flow code" means here [Verified, partly]**
- "FlowCode" is the product name (package `flowcode`, description "local-first, AI-native IDE with a governed
  multi-agent runtime"). The PRD it implements calls the product "Forge IDE" (`docs/PRD.md`).
- I found no other definition of the term in the files read. **[Unknown]** whether it carries a further meaning.

**Smallest end-to-end result being pursued [Verified as the stated aim; never yet achieved with local models]**
- A PRD goes in. Out comes a React + Vite + TypeScript prototype in a local workspace in which every planned step is
  verified and the run-level checks pass:
  `typecheck`, `lint`, `tests`, `build`, `server_start`, `preview_health`, `screenshots`, `design_qa`, `app_wiring`,
  `final_report` (the list in this run's `strategy.requiredChecks`).
- The screens must show the PRD's product and content, not template or library demo content.

**One concrete expected output [Verified: the PRD exists; the output has never been produced]**
- Input: `input/non-gmo-market-prd.md` ("Clean Cart", 9.4 KB).
- Expected: a working prototype with these screens:
  - Home: what Clean Cart is, a search box, featured categories and products, "how it works";
  - Categories;
  - Category: a product grid with certification, dietary and "near me" filters, and sort;
  - Search, including a no-results state;
  - Product: why it qualifies, ingredients, stores near a ZIP code, like, save, rate, comment, add to list;
  - Grocery lists;
  - Choose a store by ZIP;
  - Saved.
- Data is simulated in the browser (sample products, stores in ZIP-code areas, ratings). Visitor and member roles.

---

## 2. Current environment

**Hardware and OS [Verified, command output]**

| | |
|---|---|
| OS | Windows 11 Home 10.0.26200 |
| CPU | Intel Core Ultra 9 275HX |
| RAM | 31.4 GB |
| GPU | NVIDIA GeForce RTX 5070 Laptop GPU, 8,151 MiB VRAM, driver 592.07 |

**Runtimes and main packages [Verified, installed versions]**

| Item | Version / detail |
|---|---|
| Node | 24.14.0 |
| npm | 11.9.0 |
| TypeScript | 5.9.3 |
| Vitest | 5.0.3 |
| React | 19.3.0 |
| Vite | 7.3.6 |
| Electron | 38.8.6 |
| Zod | 4.6.5 |
| Playwright | 1.63.0 |
| Daemon | Node's built-in `node:sqlite` |
| Daemon dependencies | `@modelcontextprotocol/sdk`, `diff`, `parse5`, `smol-toml`, `web-push`, `yaml`, `@axe-core/playwright` |
| Generated apps | built from `templates/react-vite-starter` (React + Vite + TS, Vitest + Testing Library) |

**Models and providers [Verified, `/models/roles` and `ollama list`]**

| Provider | Detail |
|---|---|
| Ollama 0.40.5 at 127.0.0.1:11434 (local) | Installed models: `qwen3:8b` (digest 500a1f067a9f), `qwen3:14b`, `qwen3-coder:30b`, `gpt-oss:20b`, `qwen2.5vl:3b`, `qwen2.5-coder:7b`, `qwen2.5:7b`, `llama3.1:8b`, `gemma2:2b`, `nomic-embed-text` |
| Ollama environment (user level) | `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`. `OLLAMA_NUM_PARALLEL` is not set at user level; **[Unknown]** whether it's set elsewhere |
| Hosted providers configured and enabled | Anthropic (`hosted-anthropic`) and an OpenAI-compatible endpoint (`hosted-openai-compatible`). Earlier runs used `claude-sonnet-5-5` and `gpt-5.6-sol`. Keys are stored by the app; I did not read or print them |

Current role assignments:

| Role | Model |
|---|---|
| Planner, coder, debugger | `qwen3:8b` (reasoning flag on; routine coding turns run with thinking off) |
| Repository analyst, researcher, reviewer, designer, documenter, security QA, accessibility QA, compliance triage | `qwen3:14b` |
| Visual critic | `qwen2.5vl:3b` |

**Local versus cloud [Verified, code and settings]**
- Everything runs locally unless a build's coder is switched to a hosted model. That switch moves planner, coder and
  debugger together.
- A project must allow hosted models before any hosted call.
- Optional design research and image search reach the internet only with project consent. **[Unknown]** exactly
  which external sites; not traced for this handoff.
- The representative run (section 4) used local models only.

**Current runtime options [Verified, `/settings/runtime`]**

```json
{
  "fastModel": { "enabled": false, "model": "qwen3:8b", "tries": 2 },
  "rollbackBlocked": true,
  "autoRetry": true,
  "investigationBudget": 0,
  "visualCritic": "off",
  "routineThinking": false,
  "gpuProfile": "standard",
  "profileContext": 16384,
  "profileSupportModel": "qwen3:8b",
  "coderCorrections": 2
}
```

**How it's launched and tested [Verified, README.md and package.json]**
- Development:
  - daemon: `node --disable-warning=ExperimentalWarning scripts/dev-daemon.mjs` (port 7457, dev token);
  - UI: `npm run dev -w @flowcode/ui` (port 5199).
- Desktop: `npm run build`, then `npm run start -w @flowcode/desktop`.
- Tests: `npx vitest run`, which covers `packages/*/test/**/*.test.ts`. `FLOWCODE_SKIP_BROWSER=1` skips the
  Playwright-dependent tests.
- CI: `.github/workflows` has one workflow, a macOS .dmg build that also runs the tests. **[Unknown]** whether it has
  run recently.

---

## 3. Current implementation

**Size [Verified]**
- 1,095 tracked files.
- `packages/daemon/src`: 67,592 lines.
- Largest files: `orchestrator/orchestrator.ts` (3,453 lines), `api/server.ts` (1,727), `quality/verification.ts`
  (1,152).

**Tree (tracked source, dependencies and generated data excluded)**

```
apps/
  desktop/            Electron shell: window, daemon lifecycle (src/, scripts/)
  ui/src/             React UI: views/ (25), components/ (117), flowReport/, styles/
packages/
  contracts/src/      Zod schemas, event types, tool schemas, API routes, section library catalog (sectionLibrary.ts)
  daemon/src/
    index.ts, app.ts  entry point and wiring
    api/              HTTP API (server.ts), runActivity.ts, performance.ts
    orchestrator/     orchestrator.ts (run and step lifecycle), agentLoop.ts (tool loop), tools.ts, prompts.ts,
                      handoff.ts (step packet), requestBudget.ts, taskContract.ts, stepRecovery.ts,
                      investigation.ts, guards.ts, recoveryRouting.ts, interruptions.ts, appModel.ts,
                      runtimeOptions.ts, screenPlan.ts, sectionRecipes.ts, testingGuide.ts, toolSelection.ts
    models/           router.ts, ollama.ts, hosted providers, preflight.ts, gpuGate.ts, errors.ts
    quality/          verification.ts (all checks), designQa, look checks, launchReadiness
    knowledge/        skills.ts (built-in skills and selection), fixMemory.ts, retrieval
    workspace/        path jail, file ops, preflight (script classification)
    commands/         command runner, policy tiers, no-progress fingerprinting
    db/               SQLite store and migrations
    flowReport/, reports/, mcp/, security/, approvals/, governance/
  daemon/test/        143 test files plus fixtures
templates/
  react-vite-starter/ verified starter for generated apps
  library/            component library: sections/ (203 files), css/ (45)
  layouts/, angular-starter/, fonts/, brand/
scripts/              dev-daemon, bench-steps.mjs, build-baseline.mjs, ollama-speed.mjs, think-bench.mjs, audits
docs/                 PRD, architecture, ADRs, reliability/ (measurements), how-flowcode-builds.md
```

**Entry point and core flow [Verified, code]**
- `packages/daemon/src/index.ts` and `app.ts`: create the store, router, orchestrator and verifier; start the API.
- `orchestrator/orchestrator.ts` runs the build:
  - `plan()`: preflight, provider check, planner, plan checks, approval;
  - `executeTask()`: one attempt of one step;
  - `agentAttempt()`: builds the packet and runs `agentLoop`.
- `orchestrator/agentLoop.ts`: the model ↔ tool loop with its guards.
- `quality/verification.ts` (`checkCriteria`): decides whether a step passes.

```
PRD / request
  → project preflight (scripts, stack)          workspace/preflight
  → provider check (models present, service up) models/preflight
  → planner (qwen3:8b): plan, steps, checks;
    screen plan; app model (JSON) for complete
    apps; composition manifest (catalog part
    per page section)                            orchestrator.plan, appModel.ts
  → plan checks: task contract, deliverable
    checks, unpassable-check replacement         taskContract.ts
  → approval (person, or policy under Assisted)
  → steps in dependency order:
      runtime steps (no model): scaffold, install,
        library pieces, generated app/layout     orchestrator (TEMPLATES/APP_STEPS…)
      model steps: packet (objective, checks,
        requirements, files, skills, catalog,
        contracts, findings) → agentLoop (tools:
        read/search/create/patch/replace/run/
        catalog/approval/task_complete)
        → checkCriteria + content, deliverable,
          consistency, look, layout-lock and
          app-guard checks
        → pass: checkpoint │ fail: route the next
          attempt / split / block                stepRecovery.ts, recoveryRouting.ts
  → run-level checks (typecheck, lint, tests,
    build, server, preview, screenshots,
    design QA, wiring)
  → Done gate (deterministic) → report
    (Markdown + JSON) → human design review
```

**How the pieces connect [Verified, code]**

| Piece | Where | How it's used |
|---|---|---|
| Prompts | Role prompts in `orchestrator/prompts.ts`, versioned and editable in the app (`prompts` table) | `role.coder` is 4,474 characters, `role.debugger` 1,862 |
| Skills | Built-ins in `knowledge/skills.ts` (about 45 ids) | Chosen per step: a workflow skill (test-first, systematic debugging and others), design skills for interface steps, stack skills, and repair skills learned from failures. Capped and budgeted by `requestBudget.ts` |
| Component library | About 200 pieces in `templates/library/sections`; catalog entries in `packages/contracts/src/sectionLibrary.ts` | Interface steps get the catalog in their packet. Tools: `search_catalog`, `get_catalog_contract`, `add_library_piece`, `propose_layout_change`. The "layout lock" and "placed pieces" checks enforce the use of planned parts |
| Tools | Typed tool schemas in contracts; implemented in `orchestrator/tools.ts` | Advertised per step by `toolSelection.ts` |
| State | SQLite tables `runs`, `tasks`, `events`, `snapshots`, `checkpoints`, `verification_checks`, `settings` | Every file change is snapshotted; verified steps are checkpointed |

**Validation, retry, repair and fallback logic [Verified, code; real-build behaviour noted where observed]**
- **Per step:**
  - acceptance criteria are checked by code;
  - a `task_complete` claim is re-verified up to 3 times inside an attempt;
  - a type check runs after every edit and new errors are fed back.
- **Attempts:** 3 per step, plus extras: fast model, guard relaxation, and coder corrections (max 2).
- **Recovery routing (`recoveryRouting.ts`, commit `7ca9b07`, today):**
  - located errors go back to the coder as focused corrections;
  - persistent failures go to the debugger with an escalation record.
  - **Not yet exercised in any real build** (section 7).
  - Before it, every attempt after the first ran as the debugger.
- **Splitting:** a step too large for its context, or out of turns twice, is split into parts.
- **Separation:** a mixed tests-and-stylesheet step is separated.
- **Guards:** read and investigation budget, the same failing call 3 times, the same failure twice ("same wall"),
  patch versus rewrite guards, a cap of 8 edits per reply, truncation detection.
- **Provider failures** never use an attempt: the step is retried or paused.
- **Unattended recovery (`interruptions.ts`):** recorded stops, bounded automatic recovery, an orphan watchdog.
- **A blocked step's changes are undone** (unless nearly done); later steps are invalidated.
- **autoRetry:** one clarified follow-up run is offered or started after a block.
- **Fallbacks:** if no app model is usable, FlowCode designs the main screens instead of writing the complete app.
  If no catalog part fits a page section, it is recorded as a "gap".

**External services [Verified, configuration]**
- Ollama (local).
- Optional hosted LLM APIs: Anthropic, and an OpenAI-compatible endpoint.
- Optional MCP servers (for example Figma, Context7 tool names appeared in a run).
- Playwright Chromium for screenshots and look checks.
- **[Unknown]** which external sites the research and image tools contact by default.

---

## 4. One representative run: `run_73d6f4dd581f4b0d80dc` ("Clean Cart (controlled build)")

Chosen because it is the latest full build and it failed.

**Input and configuration [Verified]** (files: `input/non-gmo-market-prd.md`, `input/run-config.json`)
- **Objective:** "Clean Cart: an information app that helps people find food with no GMO and no bio-engineered
  ingredients, see which stores near their ZIP code carry it, and keep grocery lists. Build the complete working
  prototype from the attached PRD."
- **Reference:** `spec/non-gmo-market-prd.md`.
- **Strategy:** `spec_build`, template `react-vite-scheduler`, `buildMode: complete`, autonomy Assisted.
- **Models:** planner, coder and debugger `qwen3:8b`; support roles `qwen3:14b`; critic `qwen2.5vl:3b`.
- **Context:** 24k for coding (logged per attempt); GPU profile "standard".
- **Thinking:** routine-turn thinking was turned off mid-run (commit `19f3725`).

**Code version [Verified, partly]**
- The run was created 2026-10-16 02:06 UTC and ended blocked at 20:42:57 UTC.
- The daemon was rebuilt and restarted several times during it, so attempts ran on different commits, roughly
  `0c93d17` → `c03678b`/`50e51d3`.
- The last attempts (18:18 to 20:42 UTC) ran on the daemon started at 16:33 UTC (code at `50e51d3`).
  **[Assumption]** later `dist` rebuilds weren't picked up by that process: it loads modules at start, but lazy imports
  were not checked.
- **[Unknown]** the exact commit for each attempt: the daemon records no commit per event.
- The daemon restarted again at 19:44 EDT (not by me) and now runs `7ca9b07`.

**Expected output**: see section 1.

**Actual output [Verified]**
- **Steps:** 8 of 21 verified. All 8 are runtime steps that need no model: scaffold, install, references, style
  capture, plan review, layouts, library sections, app layout.
- **Blocked:** "Design App Frame and Navigation" (part 1 of 4 of "Design the main screens"), after 4 attempts.
- **Invalidated:** 11 later steps.
- **Run-level checks:** all blocked as downstream of the block.
- **Final report:** `output/final-report-blocked.md`.
- **Blocker text:** "Acceptance criteria not met after 4 attempts: agent outcome: no_action (Model replied with prose
  only and did not invoke a tool or report a structured blocker.)"
- **Unmet criteria at the end:**
  - the project type-checks (failing: `src/App.tsx(19,43): TS2741 Property 'onNavigate' is missing…`);
  - the frame is designed (`ui-shell__*` rules restyled or the frame replaced).
- **Met criterion:** "changes its own files".
- **Undo:** the block undid the step's 22 file changes.
- **Screenshots:** `output/screenshots/*.png`, from the look check at 10:53 UTC, before the last two sessions.
  - Home shows the library's demo landing page ("Make something lumpy and love it anyway", a pottery studio), not
    Clean Cart.
  - Category shows the shop piece's demo ("Studio wear", aprons and tees).
  - The navigation bar carries the Clean Cart name and the PRD's screen names.
  - **[Unknown]** what the screens look like after the final undo; not captured.

**Stages and logs [Verified]** (files: `logs/run-events.txt` with 1,998 events, `logs/run-tasks.json`,
`logs/run-performance.json`)

The blocked step's sessions:

| When (UTC) | Attempt | What happened |
|---|---|---|
| 06:16 | 1 (coder) | Ended; brief fitted from 61k characters |
| 06:28 | 2 (debugger) | Blocked by "library pieces no longer used" (ShopProductCards on Home); 4 changes undone |
| 10:43 | 1 (coder) | — |
| 10:53 | 2 | Passed as "already done" on generic checks only (the false pass found in round 2) |
| 11:53 | Revalidation | Deliverable checks were added and the step reopened |
| 11:54 | 1 (coder) | Opening request about 14k of 14k tokens (system 18,897 characters with skills 8,407; tools 15,808; brief 24,484). The type check failed throughout on pre-existing errors in `HomeLandingPageScreen.tsx` (another screen) |
| 15:09 and 18:18 | 2–3 (debugger) | Spent on those pre-existing errors in another file. 4 out-of-scope approval requests for `HomeLandingPageScreen.tsx` |
| 19:28 | 4 (debugger) | 3 replies whose edits failed or weren't run (one cut off at the output limit with 26 tool calls); 12 further approval requests for the other screen; then `App.tsx` TS2741; then a prose-only reply ended the attempt |

**Reproducibility [Verified]**
- The frame step failed to complete in every session today: 06:16, 10:43 (a false pass), 11:54, 15:09, 18:18 and
  19:28 UTC.
- The earlier Clean Cart builds also never completed:
  - `run_b08ca512` (cloud coder): cancelled at 11 of 24 steps;
  - `run_80ecc0c4`: cancelled at 5 of 16 steps.
- **[Unknown]** whether the newest fixes, made after these attempts, change the outcome; not yet run on this step.

---

## 5. Observed performance (measured only)

**Representative run [Verified, `/runs/:id/performance` and the run database]**

| Measure | Value |
|---|---|
| Wall time | 21.6 h (02:06 to 23:45 UTC). This includes: |
| — waiting for approval | 4.4 h |
| — paused | 4.8 h |
| — maintenance (benchmarks) | 0.8 h |
| — blocked, waiting for the person | 3.0 h |
| Busy time | model 284 min; tools 81 min; commands 3 min |
| Model calls | 220 (167 to `qwen3:8b`, 53 to `qwen2.5vl:3b`); 5 failed, 5 retried |
| `qwen3:8b` time split | 260 min generating, 13 min prompt processing, 11 min loading; 30 cold loads; 10 model switches |
| Tokens | 2,791,362 prompt, 208,645 output; generation speed about 13.4 tokens/s |
| Prompt size per call | 46,797 characters on average, 87,152 at most |
| Commands | 61 run, 31 failed (mostly the type check failing on the pre-existing errors) |
| The blocked step | 96 model calls, 172 model-minutes, 867 min elapsed (including pauses) |
| Earlier step "Define Screen Layouts and Sections" | 560 min elapsed, 27 model-minutes |
| Recovery numbers (computed retroactively) | 8 of 11 steps passed first time (all runtime steps); 7 debugger attempts; no coder corrections (that feature didn't exist yet) |

- **API cost:** none (local run). FlowCode records no dollar cost for any run; only tokens.
- **RAM/VRAM in this run:** **[Unknown]**, not recorded.

**Earlier cloud and local runs [Verified, run database; cost unknown]**
- `run_b08ca512` (Clean Cart, coder switched to `claude-sonnet-5-5` part-way):
  - 1,234 model calls; 72.7M prompt tokens and 0.77M output tokens (all models combined); 36.4 h wall time;
  - cancelled after 11 of 19 steps that ran.
  - Baseline analysis: `benchmarks/baseline-clean-cart.json`. Of 1,348 file reads, 1,147 were repeats of unchanged
    files.
- **Completed runs (`done_with_warnings`):**
  - `run_2680009c` (Build test 3, sonnet, 16 of 16);
  - `run_e124d106` ("Build a clickable", sonnet, 18 of 18);
  - `run_534cd84c` (No BIO & GMO, `qwen3:14b`, a 2-step run).
- Every other run in the last 40 was cancelled, blocked or `done_unverified`. **[Unknown]** why most were cancelled:
  they were stopped by the person and no reason is recorded.

**Model speed versus context on this GPU [Verified, `benchmarks/speed-qwen3-8b.json`, `scripts/ollama-speed.mjs`]**

| Window | On GPU | Short prompt | Long prompt |
|---|---|---|---|
| 8k | 100% | 54 tokens/s | — |
| 16k | 78% | 30 tokens/s | — |
| 24k | 69% | 26 tokens/s | — |
| 32k | 59% | 22 tokens/s | 7.9 tokens/s (17k-token prompt) |
| 24k with flash attention + q8_0 cache | 83% | 41 tokens/s | 13.5 tokens/s |
| 16k with flash attention + q8_0 cache | 92% | 43 tokens/s | — |
| 12k with flash attention + q8_0 cache | 100% | 51 tokens/s | — |

**Thinking on vs off [Verified, `benchmarks/think-bench-qwen3-8b.json`]**: 6 routine cases × 2 runs, `qwen3:8b`, 24k.
- Both settings passed 12 of 12.
- On: 5,636 tokens, 160 s. Off: 736 tokens, 20 s.

**Step benchmark matrix [Verified, `benchmarks/bench-steps.jsonl`, revision `6105767`, `scripts/bench-steps.mjs`]**
- **How it was run:** each run used a fresh copy of the controlled build's workspace and database.
- **Tasks:**
  - patch: a one-line reword;
  - compose: add a 4-button section;
  - tests: write 3 acceptance tests.
- **Success:** the step's checks pass (its own tests, the type check, file checks), judged by FlowCode's verifier.
- **Repetition:** n = 1 per cell; the planned repeats were not run.

| Config | Patch | Compose | Tests |
|---|---|---|---|
| 24k, thinking on | ✓ 93 s, 3 calls | ✓ 189 s, 2 calls | ✓ 415 s, 6 calls |
| 24k, thinking off | ✓ 39 s, 2 calls | ✓ 70 s, 3 calls | ✓ 51 s, 2 calls |
| 8GB profile, 16k | ✓ 34 s, 2 calls | ✓ 230 s, 12 calls (split) | ✓ 212 s, 6 calls (split) |
| 8GB profile, 12k | ✓ 30 s, 2 calls | ✓ 362 s, 17 calls | ✗ blocked, 647 s, 46 calls |

- Peak VRAM sampled during these runs: 6.7–7.7 GB of 8.15 GB.
- **Excluded:** the two "plan" (app model) runs and one warm patch repeat overlapped the live build on the same GPU.
  Their timings are invalid, and both plan runs also hit bugs that were fixed afterwards (`9271d9d`, `5a94f4e`) and
  not re-measured.

**Manual interventions required [Verified, run events, 18:18–20:33 UTC]**
- **Approved by hand:** 1 out-of-scope `edit_json` on `tsconfig.json`, and 7 out-of-scope `replace_file` requests
  on `src/screens/HomeLandingPageScreen.tsx`.
- **Auto-approved by the Assisted policy** (edits inside `src/`): 7 out-of-scope `apply_patch` requests on the same
  file.
- **Plan approvals:** 2 (05:49–05:50 UTC).
- **Run controls:** Continue once (18:18 UTC); resumes at 10:43, 11:53 and 17:23 UTC, each with no attribution
  recorded.
- **No hand edits** were made to the generated app: a standing rule is to fix FlowCode, never the apps it builds.

---

## 6. Previous attempts

### Implemented and tested

Unless noted, "tested" means unit or scripted-orchestration tests, not a real build.

| Change tried | Problem it targeted | Observed result | Still in code? |
|---|---|---|---|
| Component library (~200 pieces), catalog in packets, `add_library_piece`, composition manifest, layout lock (`66dfe15`, `2829a91`, `5b5c2bc` and others, Oct 8–13) | Models hand-writing markup; generic UI | Pieces are used, but their demo content stays on screen (the screenshots in section 4). The placed-pieces rule blocked a step for another screen's pieces (fixed in `6105767`) | Yes |
| Complete-app mode: app model JSON → generated store, routes, screens (`b5a0dc9`) | Models failing to write whole apps | Generated steps verify. Real `qwen3:8b` app-model runs were unusable in the benchmark (missing ZIP areas; reply cut off) | Yes, with fixes |
| App model in bounded parts; areas asked separately; records in batches of 10 (`b60e565`, `9271d9d`, `5a94f4e`) | App model unusable on `qwen3:8b` | Unit tests pass. **Not re-measured on a real model** | Yes |
| Reliability phase 1: provider and model preflight; provider failures don't use attempts (`77fb5ae`) | Timeouts and credit errors consuming attempts and undoing work | 9 tests pass. Not observed in a real outage since | Yes |
| Phase 2: task contract check, test/stylesheet separation, testing packet and scaffold, `tests-run` check (`3721e90`) | Step 14 bundling and impossible checks; test steps importing uninstalled packages | Tests pass; verified on a workspace copy with real vitest | Yes |
| Phase 3: structured investigation check instead of fixed read counts (`594bd9f`) | 1,147 repeated reads; attempts ending with nothing learned | 10 tests pass. **[Unknown]** effect in a real build | Yes |
| Phase 4: visual critic off by default (advisory only); human design review as the design gate (`e558145`) | AI taste blocking steps | Tests pass | Yes |
| Deliverable checks for steps with only generic checks; revalidation of earlier passes (`0c93d17`) | False passes ("already done" on the type check alone) | It caught the frame step's false pass in the representative run (reopened at 11:53) | Yes |
| Whole-request token budget; packet fitting by priority; max 8 edits per reply; truncation handling (`0c93d17`) | Requests overflowing the window; cut-off edits | Request about 18.2k → 14.3k tokens on one rebuilt step. Truncated replies still occurred (section 4, 19:42) | Yes |
| Thinking off on routine turns (`19f3725`) | Slow generation | Benchmark: same pass rate, 4–8× faster on the measured tasks (n = 1) | Yes |
| Ollama `FLASH_ATTENTION=1`, `KV_CACHE_TYPE=q8_0` (environment, not code) | Model partly on the CPU at 24k | Long-prompt speed 7.9 → 13.5 tokens/s at 24k | Yes (environment) |
| 8GB GPU profile: one local request at a time, support roles on `qwen3:8b`, fixed context, app model in parts (`b60e565`) | `qwen3:14b` at 3 tokens/s; competing requests | Benchmark at 16k/12k: bigger steps get split and run 3–6× slower than standard at 24k. **Not enabled** (`gpuProfile: standard`) | Yes (opt-in) |
| Patch/rewrite guard conflict fix; unbounded split loop fix (`75e10e2`, `275be6f`) | 51-minute guard deadlock; an infinite split refund | Tests pass | Yes |
| Unattended builds: recorded stops, bounded recovery, orphan watchdog (`c03678b`) | Silent pauses; a "running" build with no worker | Tests pass. The orphaned run was recovered by converting it to maintenance | Yes |
| Copy-only steps skip design skills and the catalog; pre-existing errors don't fail a step under the repeat guard; placed pieces scoped to changed screens (`f46ccb1`, `16fdb62`, `6105767`) | A one-line reword not fitting 16k; steps blamed for other files' errors | Benchmark patch went from 343 s with a policy stop to 35 s verified (n = 1) | Yes |
| Recovery routing: classify the failure, coder corrections, purposeful debugger escalation, recovery metrics (`7ca9b07`) | Every retry going to the debugger | 9 tests including 2 scripted builds. **Never run in a real build** | Yes |
| Fast model first (`fastModel`) | Slow main model | **[Unknown]** effect; currently disabled | Yes (off) |

### Suggested or discussed, never implemented or tested

| Suggestion | Status |
|---|---|
| Buying or testing a 16 GB GPU | Discussed. Not tested |
| A larger context (24k) for the 8GB profile | A benchmark configuration was added (`gpu8-24k`). Never run |
| Repeating the benchmark configurations before choosing a default context | Planned. Not run |
| "Force a write after 12 reads" | Proposed earlier. Never built |
| Artifact-level dependency tracking; dependency-aware rollback; render-path verification | Backlog only (`docs/reliability/README.md`) |
| A smaller role prompt and catalog for every step | Only the copy-edit case was done |

---

## 7. Current blockers and limits

**Definitely broken or failing [Verified]**
- **No complete Clean Cart build with local models.** The controlled build is blocked at the frame step after 4
  attempts across six sessions.
- **Library demo content stays on screen.** Generated screens show the library pieces' demo content (pottery studio,
  "Studio wear") instead of the PRD's content at the latest captured point.
- **Pre-existing errors bleed into later steps.** Type errors in `HomeLandingPageScreen.tsx` (left by earlier work)
  made the frame step's type check fail. The debugger then spent attempts editing that out-of-scope file, causing
  repeated approval prompts. A fix for one cause (`16fdb62`) landed after those attempts; not yet observed in a real
  build.
- **`qwen3:8b` behaviour on large design steps** (observed):
  - replies with up to 26 tool calls, cut off at the 4,096-token output cap;
  - failed patches;
  - a final prose-only reply instead of a tool call.

**Runs but performs poorly [Verified]**
- **Generation speed:** local generation is about 92% of model time at about 13 tokens/s on 24k prompts.
- **Prompt size:** prompts are large (47k characters on average in the representative run).
- **Wall time:** builds take many hours, much of it pauses, approvals and blocks.
- **Benchmark (n = 1):** the 16k/12k profile completes small steps fastest but splits larger ones, which costs more
  calls and time.

**Unimplemented [Verified]**
- Cost tracking in dollars.
- Per-event code-version stamping.
- The backlog items in section 6.
- A chosen default context for the 8GB profile.
- Benchmark repeats.

**Suspected causes**

| Cause | Status | Evidence |
|---|---|---|
| Model capacity: `qwen3:8b` on long design steps | Evidence, not proof | Truncated replies, failed patches, prose-only end. Cloud runs also failed to complete (cancelled for unknown reasons), so the model is not the only cause |
| Packet size relative to the window | Evidence | Opening requests at about 14k of 14k tokens; the brief always fitted by cutting knowledge and the PRD |
| Errors carried between steps | Evidence | The representative run |
| The new recovery routing will reduce debugger time | Hypothesis | Untested in a real build |
| Library demo content left in place is a planning or packet problem | Hypothesis | Not investigated in this handoff |

**Hardware as a bottleneck [Verified, measurements]**
- On this 8 GB card, `qwen3:8b` at the 24k window FlowCode used runs 69–83% on the GPU. Speed drops with context
  (table above).
- Generation dominates local model time, so speed is measurably hardware-bound.
- **[Unknown]** whether more VRAM would change success rates. Outcomes were not measured on other hardware, and cloud
  runs (no local hardware limit) also mostly did not complete.

---

## 8. Files for the handoff

**In this folder**
- `input/non-gmo-market-prd.md`: sample input.
- `input/run-config.json`: the run's configuration. It holds no keys.
- `output/final-report-blocked.md`: FlowCode's report for the run.
- `output/screenshots/`: look-check screenshots, 2026-10-16 10:53 UTC.
- `logs/run-events.txt`: every event except command output and stream starts, one line each.
- `logs/run-tasks.json`: steps, checks, blockers, objectives.
- `logs/run-performance.json`.
- `benchmarks/`: `bench-steps.jsonl` (the matrix; plan rows contaminated, see section 5), `speed-qwen3-8b.json`,
  `think-bench-qwen3-8b.json`, `baseline-clean-cart.json`.
- `tests/daemon-tests.txt`: 170 files, 1,468 passed, 9 skipped (browser tests skipped), commit `7ca9b07`, run
  2026-10-16 23:46 UTC.
- `tests/ui-typecheck.txt`: no errors.

**In the repository (cite by path)**
- **Manifests:** `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`.
- **Core:**
  - `packages/daemon/src/orchestrator/{orchestrator,agentLoop,tools,handoff,requestBudget,taskContract,stepRecovery,recoveryRouting,investigation,guards,appModel,prompts,runtimeOptions}.ts`
  - `packages/daemon/src/quality/verification.ts`
  - `packages/daemon/src/models/{router,ollama,gpuGate,preflight}.ts`
- **Prompts and skills:** `packages/daemon/src/orchestrator/prompts.ts`, `packages/daemon/src/knowledge/skills.ts`.
  The user's edited versions live in the database's `prompts` and `skills` tables, which were not exported.
- **Component definitions:** `packages/contracts/src/sectionLibrary.ts`, `templates/library/sections/`,
  `templates/react-vite-starter/`.
- **Measurement scripts:** `scripts/bench-steps.mjs`, `scripts/build-baseline.mjs`, `scripts/ollama-speed.mjs`,
  `scripts/think-bench.mjs`.
- **Previous findings:** `docs/reliability/README.md`, `docs/how-flowcode-builds.md`.

**Not included**
- No `.env.example` exists. Configuration lives in the SQLite `settings` table.
- API keys, tokens and the database itself are excluded.
- The generated app's full source is in `.flowcode-data/workspaces/clean-cart-controlled-build-d804f3/src` (66 files,
  1.4 MB). It is not copied here; it reflects the state after the last undo.
