# How FlowCode builds a prototype

How the local models write a prototype's code, how the agents use the component library, and what happens when a step fails. Written from the code as it stands (October 2026), with Clean Cart (`run_b08ca51250e34b4a91b6`) as the running example.

---

## 1. The shape of a build

A build is a run made of **steps** (tasks). Each step has an objective, the files it is expected to touch, and **acceptance criteria** that FlowCode checks with code, not with a model.

```
Request (PRD or description)
 → Project preflight: what kind of project, which scripts run it
 → Planner: the plan, the screens, the steps and their checks
 → You approve the plan                      ← a person decides
 → Steps run one at a time, each checked
 → Final checks (type check, lint, tests, build, preview, screenshots, design)
 → Review and report
```

Clean Cart's steps, for example:

| # | Step | Who does the work |
|---|------|-------------------|
| 1 | Scaffold from verified starter template | FlowCode (no model) |
| 2 | Install dependencies | FlowCode, after your approval |
| 3 | Import spec references | FlowCode |
| 4 | Capture the style | FlowCode, with the designer for colours and type |
| 5 | Review the prototype plan and the design | Planner, reviewer |
| 6 | Add library sections | FlowCode copies the planned pieces |
| 7 | Write the complete app | FlowCode, from the app model (see 3.1) |
| 9 | Set Clean Cart's look | Coder |
| 10–12 | Compose the Home sections | Coder (split parts of "Design the main screens") |
| 14 | Write the acceptance tests and add the stylesheet rules | Coder, then Debugger |
| 18–21 | Main screens, categories, products, grocery lists | Coder |
| 22–24 | Design polish, clean up, assemble | Coder, critic |

A large share of a prototype is written by **FlowCode itself, without a model**: the starter, the app model's screens and data layer, and the library pieces. The models fill in what can't be generated: the look, the composition of each page, the copy and the feature details.

---

## 2. The models and their roles

Each role has its own model, set per build (System → Models):

| Role | What it does | Clean Cart (local) |
|------|--------------|--------------------|
| Planner | Plans the build, splits steps, drafts the app model | qwen3:8b |
| Coder | Writes and edits the app's files, one step at a time | qwen3:8b |
| Debugger | Takes over a step that failed its checks | qwen3:8b |
| Designer, reviewer, documenter, researcher, QA roles | Style, review, writing, research, checks | qwen3:14b |
| Visual critic | Looks at screenshots ("look check") | qwen2.5vl:3b |

- **Local or cloud.** The builder's Coder switch moves the planner, coder and debugger together between the local models and the cloud model (claude-sonnet-5-5). Switching takes effect at once: the attempt in progress stops and resumes on the new model.
- **Fitting the model.** A local model has a small context (qwen3:8b runs with 24k). Before each step FlowCode trims the step's brief to fit, leaving room for the model to read files and reply, and says what it left out ("Fitted the step's brief to qwen3:8b's context…"). Replies are capped at 4,096 tokens locally and 16,000 or more in the cloud.
- **Ollama.** Local models run in Ollama on 127.0.0.1:11434. If a model is missing there, FlowCode now says so in plain words (October 2026: a Docker Ollama with a different set of models had taken the port).

---

## 3. How the code gets written

### 3.1 Generated first, then shaped by the models

1. **Starter template.** A verified React + Vite app: design tokens (`src/styles/tokens.css`), the starter kit (`src/components/ui`), the theme bridge (light and dark), and a working test setup.
2. **App model.** The planner writes a JSON model of the app: its kind (Clean Cart is a *look-up* app), entities, sample data, screens and routes. FlowCode turns it into real files: `src/app/schema.ts`, `store.ts`, `lookup.ts`, `routes.ts`, one screen per destination in `src/screens/`, and `App.tsx`. For a look-up app the screens are built from the look-up pieces (`LookupFrame`, `LookupCatalog`, `LookupEntry`, `PlaceFinder`, `ListBuilder`), so search, ZIP-code places, likes, ratings and lists work before any model writes a line.
3. **Model steps.** The coder then makes the app look and read like the product: the look in the tokens, each page composed from its planned sections, real copy from the PRD, and the features the generator doesn't cover.

### 3.2 One step, inside

Each model step is an **agent loop**:

1. FlowCode builds the **brief**:
   - the step's objective and its acceptance criteria;
   - up to a few **skills** (design, testing, repair skills chosen for this step);
   - **fix memory**: fixes that worked before for similar failures;
   - the **component catalog** for interface work (section 4);
   - the **composition manifest**: which part each section of each page is built from;
   - for a step that writes tests, how to work and a **testing map** of what the screens show and label.
2. The model replies with **tool calls**, and FlowCode runs them:
   - Read: `list_files`, `search_code`, `read_file`.
   - Write: `create_file`, `apply_patch`, `replace_file`, `edit_json`, `copy_file`, `move_file`, `delete_file`.
   - Run: `run_script`, `run_command`.
   - Library: `search_catalog`, `get_catalog_contract`, `add_library_piece`, `propose_layout_change`.
   - Flow: `request_approval`, `report_blocked`, `task_complete`.
3. **Every tool is governed.** Edits stay inside the project, a snapshot is saved before each change (so any step can be rolled back), and the type check runs after each edit. A change outside the step's planned files, or a package install, stops for **your approval**.
4. The loop ends when the model calls `task_complete`, runs out of turns (30, or 50 for a test-writing step), or a guard stops it (section 6.3).
5. FlowCode then **checks the acceptance criteria itself**. "Done" from the model is a claim; the checks decide.

### 3.3 What a step's checks look like

From Clean Cart's step 14:

- `file_exists` — the test file `src/acceptance/landing-page-….test.tsx` exists.
- `file_contains` — the tests mention "How it works", "Look up a food", "94110"… (each is a piece of real content from the PRD the app must show).
- `verification: typecheck` — the project still type-checks.
- `tests:` — the step's acceptance tests pass, for the part that owns them.

A step passes only when all its checks pass.

---

## 4. How the agents use the component library

### 4.1 What the library is

About 200 pieces at four levels:

- **Components** (`c.`): buttons, fields, cards…
- **Patterns** (`p.`): the look-up frame, the catalog, the place finder…
- **Page sections** (`b.`): heroes, feature grids, pricing…
- **Page templates.**

Each piece is a React file in `templates/library/sections` plus its CSS. Every piece:

- **takes its look from the project's tokens**: colours, type, spacing, corners, and the surface tokens (`--surface-bg/border/shadow/blur/radius`). The same piece fits any style, and a *version* of a piece differs in construction, never in colours;
- **has a catalog entry**, the source of truth: what it is for, its usage line (exact import and props), what it depends on, tags, and which page types it suits;
- **works**: keyboard, states and motion, with a demo after a `// flowcode:sample` marker that the app never shows.

New pieces go to an **approval shelf** first. A build can't use a piece you haven't approved (the approval gate).

### 4.2 At planning: the composition manifest

The planner writes a **screen brief** for every page, section by section, and names the catalog part for each section (Home → *Top bar* → `p.lookup-frame`; *Featured categories* → `p.lookup-catalog.categories`). FlowCode keeps this as the **composition manifest**: page, section, part, version, why it fits, and who chose it. A section no part fits is recorded as a **gap**, never dressed up as a choice. Page-type rules check the plan, for example that a landing page doesn't get a part that only belongs on a detail page.

### 4.3 While coding

- **The catalog is in the brief** for interface work, one line per relevant part, so the coder reaches for a piece instead of writing markup.
- **`search_catalog` and `get_catalog_contract`** let an agent find a part and read its exact contract (props, usage) before using it.
- **`add_library_piece`** copies a piece into the app's `src/sections/` and records it in the manifest, so the Performance tab shows which agent used what.
- **`propose_layout_change`** is how an agent swaps or drops a planned part, with a reason. You see every change at review.

### 4.4 After coding: the layout lock

After a design step, FlowCode reads the app's files and checks each planned section: is its part really on that page, either imported by the screen file or rendered around it by `App.tsx`?

- A planned part that isn't used, and has no recorded change explaining it, **fails the step**: put the part in, or propose the change.
- Each part of a split design step is held only to the sections its title names. The whole page is checked at Design polish.

### 4.5 Helpers that keep local models on track

- **Import fixer.** When a model imports a name from the wrong file (common with qwen3:8b), FlowCode moves the import to the file that exports it.
- **Type hints.** Common TypeScript errors come with a short hint on the real API (for example how `useLookup` is meant to be used).
- **Content check** ignores the library demos, so sample text isn't mistaken for the app's content.

---

## 5. How the work is checked

**Per step:** the acceptance criteria (section 3.3).

**Look check:** after visual steps, the critic model views screenshots of the screens and reports problems ("Search appears three times on the first screen", "Text below contrast minimum 4.40:1"). Serious ones fail the step, with the exact fixes to make.

**Final checks** (the row in the builder's status bar): Ready (project preflight), Project (manifest), Packages (install), Code (type check), Style (lint), Tests, Package (build), Screens, Starts (dev server), Preview, Shots (screenshots), Design and Report. Each can be opened for its evidence and re-run.

---

## 6. The debugging process

### 6.1 Attempts

1. **Attempt 1, the Coder.** Builds the step.
2. **If the checks fail, the Debugger takes over** for the next attempt. Its brief adds what failed and the evidence: the failing checks, the type errors, the look-check findings, plus repair skills and fix memory from similar failures.
3. **Up to 3 attempts** per step (one more when a fast model was tried first, or when a guard stopped an attempt that was still making progress).

### 6.2 Recovery FlowCode does on its own

- **Split a step that is too big.** If a step runs out of turns twice, the planner splits it into 2–4 smaller steps (one or two files each), with the step's tests shared out among them. Splitting now leaves out work that finished steps already did or later steps will do (Clean Cart had duplicate steps before this). A part of a split step is never split again.
- **Keep or undo.** A failed attempt's changes are kept when a passing step changed the same files. Otherwise they can be rolled back to the last checkpoint.
- **Stop early when it's hopeless.** The same failure twice in a row ("same wall") stops the step, instead of spending the remaining attempts on it.
- **Let independent steps run.** A later step that doesn't need the stuck step's files can still go ahead.

### 6.3 Guards

Guards stop an attempt that isn't getting anywhere:

- **No progress:** many reads in a row without a change (Clean Cart step 14: "108 reads in a row and no change made").
- **Turn budget:** 30 turns, or 50 for a step that writes acceptance tests.
- **Model errors:** time-outs, a missing model, out of cloud credits. These are reported as such ("Nothing is wrong with the step's work").

### 6.4 When it stops: your decision

A blocked step shows **why it stopped** in plain words, the technical details, and **Troubleshoot**, with likely causes and fixes from this computer's history of similar stops. From there you can:

- **retry** the step;
- **switch** the build between Local and Cloud;
- **edit** the request as a follow-up;
- **roll back** a step's changes.

Approvals and final buttons are always yours.

### 6.5 Learning from failures

- **Fix memory:** a fix that worked is remembered and offered the next time a similar failure appears.
- **Proposed skills:** when the same failure keeps happening across builds, FlowCode drafts a skill to prevent it and waits for you to turn it on (Approvals → Proposed by FlowCode).
- **Model problems:** failures a skill can't fix (model crashes, time-outs) are listed on System → Model problems.
- **Stuck steps:** times FlowCode's own limits stopped a step, kept so the limits can be tuned.

---

## 7. Where the local models struggle, and what FlowCode does about it

| What happens | Example | What FlowCode does |
|--------------|---------|--------------------|
| Invents APIs or imports | qwen3:8b imported `ZipPrompt` from the wrong file, destructured `useLookup` wrongly | Import fixer, type hints, exact import lines in the brief |
| Slow replies | 66–99 s per reply on qwen3:8b | Time estimates per step, "Replies usually take 1–2 min" in Activity |
| Writes styles the app doesn't use | Tailwind classes like `text-blue-500` | Design skills, the catalog and tokens in the brief, look checks |
| Reads in circles | 211 tool calls, no test written | No-progress guard, more turns for tests, the write-as-you-go rule and testing map |
| Context too small | 24k for qwen3:8b | Brief fitted to the model, the generated app model does the heavy lifting |

The cloud model handles larger steps more reliably, at a cost per call. The usual pattern: build on local, and switch the coder to Cloud for a step that keeps stopping.

---

## 8. Clean Cart, step 14, as a worked example

1. **Attempts 1–3 (local, qwen3:8b):** the type check failed because the generated tests imported `react-router-dom`, which isn't installed. Then the model timed out: Docker's Ollama, without qwen3, had taken the port.
2. **Retry on Cloud (Claude):** ran out of 30 turns while reading the sample data and pieces. FlowCode raised the limit to 50 for test-writing steps.
3. **Next retry:** stopped by the no-progress guard after 108 reads. FlowCode added the write-as-you-go instructions and the testing map.
4. **Last retry:** stopped when the cloud account ran out of credits, still reading. Prompt guidance alone didn't change the behaviour, so the next fix is a hard rule: on a test-writing step, after about 12 reads without a write, further reads are refused until the test file is written.

The pattern repeats across builds: a failure is turned into a FlowCode fix (a rule, a check or a helper), never a hand-edit of the app.
