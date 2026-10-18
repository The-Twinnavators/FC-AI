# Eval 4: criteria, intended roles, proposed corrections and freeze

**Status:** not started. The run starts only after you separately confirm all three of these:
- which library concepts you approve;
- the concept selected for Clean Cart;
- authorization for one two-hour eval.

After the run, FlowCode stops: no repeats and no automatic repairs.

## 1. Outcomes, reported separately

Each outcome is reported on its own. None stands in for another, and none is averaged into a single score.

| Outcome | What it means | How it's judged |
|---|---|---|
| **Functional baseline** | The app written from its model works before design. | The baseline after "Write the complete app": typecheck, lint, tests (when test files exist), build, data source and the browser journey. All must pass, as in eval 3. |
| **Design implementation** | The design steps did their scoped work in the selected direction. | Each design step is verified or blocked, and its result is shown. The concept's token and Home-layout requirements are read from the rendered app. The coder's remaining work items are each listed as done or not done. "Applied" never counts as "designed". |
| **Final technical and behavioural verification** | The app works **after** design, not only before it. | Each step's own checks run at that step's boundary. The complete final suite runs **once**, after the last step, on the final post-design source: typecheck, lint, tests, build, server start, preview health, screenshots, design QA, app wiring, the functional journey, and the final report. That is how the verification phase already works; nothing is repeated or added. A check that doesn't run (for example, tests with no test files) is reported as **not run**, not as passed. |
| **Deadline enforcement** | The absolute deadline held. | The deadline was set and verified before planning. No work started after it without a recorded extension. If it expired, the record shows when, what was running or waiting, and when work stopped. **A deadline stop means the run is incomplete. A recorded overrun is still an overrun.** |
| **Human visual approval** | You approve the generated app's look. | **Pending until you give it.** Neither the concept's selection nor its application sets it. |

## 2. Intended typography and control roles

Pages of different kinds are meant to differ in some ways. These are intended, not defects.

| Role | Intended | Where |
|---|---|---|
| Page display heading | The largest heading on a page whose job is to introduce (Home's masthead or hero). | Home |
| Page title | One level below the display heading. | Catalog, Saved, Lists, Stores |
| Record title | The product's name as the page's subject, which may be large. | Product |
| Section heading | Below page titles. | "Most liked", "Where to find it", "Ratings" |
| Card title | Body size or one step up. | Product cards |
| Meta text | The small step of the scale: maker, rating, counts, kind. | Cards, lists |
| Hero action | The large button size, once, in Home's opening. | Home |
| Standard action | The medium button size. | Everywhere else |
| Toggle actions | Quiet buttons with a pressed state: Like (heart), Save (bookmark), Share, Add to list. | Product, cards |

**Reading the review's measurements against these roles:**
- **Heading sizes:** they differ between page types by role (display heading, page title, record title). That is intended. They become defects only if two pages with the *same* role differ. Within a concept they don't: Catalog and Saved match.
- **Product title:** Editorial's record title (45px) is larger than its page titles (32px). That is a deliberate choice of the expressive scale, which you can accept or reject.
- **Button heights:** 48px is the hero action, 40px the standard action. Both are intended.
- **12px meta text:** this is the small step of each concept's scale. It isn't presented as an accessibility threshold either way: the muted text it uses passes WCAG AA on the page, the cards and the sunken surfaces in every concept (5.7:1 at the lowest; Bold aisle 8.8:1), and size is for you to judge at phone distance.

## 3. Narrow corrections (A and B approved and applied; C and D need no change)

### A. Saved uses the heart, which elsewhere means Like
- **Problem:** the phone's bottom bar shows Saved with a heart. On the Product page the heart is Like and the bookmark is Save, and the save toggles are bookmarks.
- **Correction:** the frame's icon for the Saved destination becomes the bookmark. One map entry in `orchestrator/appFiles.ts` (`DEFAULT_ICON.saved`), plus one override in `lookupLinks` so a model-given heart for Saved also becomes the bookmark.
- **Test:** the frame's Saved link uses the bookmark.

### B. Duplicated ZIP prompts and the oversized phone banner
- **Problem:** the frame's "Find it near you" banner shows on every page except Home. On Product it duplicates the page's own "Where to find it" form. On a phone it takes most of the first screen.
- **Correction, two parts:**
  1. No frame banner on Product: in `lookupAppSource` (`orchestrator/lookupFiles.ts`), the condition `screen === landing ? undefined : <ZipPrompt/>` also excludes the record page.
  2. No frame banner at phone width (`templates/library/css/lookupframe.css`, `.fl-lkf-prompt` at ≤760px). The top bar's "Add your ZIP code" control stays on every page at every width, so the ZIP code can still be set.
- **Test:** Product shows one ZIP form. At 390px no banner shows, and the ZIP code can still be set from the top bar.

### C. Product-image continuity: your decision; no change proposed yet
- **What differs:** Home and Catalog draw a tinted tile with the category's icon. The Product page draws a tile with the product's initials ("OM"). The category icons are assigned by category order, not by meaning: Beverages gets the generic picture icon.
- **The views:** see the review page's "Product image continuity" section.
- **Options, if you want a change:** use one treatment everywhere (the initials tile or the category tile), or leave it as it is.

### D. "Search" is active while viewing a Product: intended, no change
The frame highlights a record page's parent section, and the product's parent is the catalog. The PRD names that screen "Search", so the catalog was made an explicit alias in the app model: Search is the catalog page. Highlighting it on Product tells you which section you're in, the way a breadcrumb would. It isn't a label mismatch to correct.

## 4. Deadline coverage

The deadline mechanism is in `orchestrator/runDeadline.ts`. Its tests:
- `run-deadline.test.ts`: expiry during a model call; Continue, Retry, resume and recovery refused until an extension is recorded; expiry during the plan approval; a restart doesn't resume an expired run and re-arms an unexpired run's timer; a script's pause isn't recorded as the person's.
- `run-deadline-approvals.test.ts`:
  - expiry while a step waits on its own approval (the file it waited for isn't written; the step is recorded as in progress and waiting);
  - an approval given after expiry is recorded, nothing it waited for runs, and Continue is still refused;
  - a restart with the expired run's approval still pending neither resumes the run nor acts on it;
  - expiry during the review step's approval ("Review the prototype plan and the design", eval 3's wait), where a late approval starts no step.

**Disclosed, untested:** a file write in progress at expiry. It is expected to settle before the run stops, because writes are synchronous within a tool call, but no test interrupts one mid-write.

## 5. Freeze (after any corrections you approve, before planning)

1. **Record the evaluated commit:** the final SHA, with a clean working tree for tracked files.
2. **Rebuild and restart:** `npx tsc -b packages/contracts packages/daemon`, then System → Restart daemon, then confirm the health check.
3. **Confirm no active runs:** none running, queued, verifying, recovering or awaiting approval.
4. **Record the effective configuration:**
   - **Prompts and skills:** `packages/daemon/test/fixtures/builtin-hashes.json` (version and hash of every role prompt and skill) and its own sha256.
   - **Model settings:** role assignments (`GET /settings`), runtime options (`GET /settings/runtime`) and Ollama model digests.
   - **Fixture:** the PRD's sha256.

   Current values, before any correction:

   | Item | Value |
   |---|---|
   | PRD `docs/handoff/slice/clean-cart-slice-prd.md` | cf5d0f245f07eee4… |
   | builtin-hashes.json | f0f8beb3cc757431… |
   | qwen3-coder:30b | 06c1097efce0 |
   | qwen3:14b | bdbd181c33f2 |
   | qwen3:8b | 500a1f067a9f |
   | qwen2.5vl:3b | 79d497978752 |
   | nomic-embed-text | 0a109f422b47 |
   | Runtime options | gpuProfile standard, context 16384, support model qwen3:8b, fast model off, coderCorrections 2, autoRetry off, visual critic off |

5. **Set the deadline:** the run is created with `deadlineAt` = creation + 2 h and a reason. `GET /runs/:id/deadline` is checked to return it before planning starts. If it doesn't, the run is cancelled before planning.
6. **Run configuration:**
   - Project: a new project, "Clean Cart slice eval 4", built from the PRD as a complete app.
   - Policy: Assisted.
   - Models: qwen3-coder:30b for planner, coder and debugger at temperature 0.1; the support models above; no downloads.
   - Approvals: the plan and any steps are approved only by you; concepts are offered only for pages you approved.
7. **Observation:** a read-only watcher only. No code changes, daemon restarts or approvals by me during the run.

Repair commits stay narrow. Unrelated footer or housekeeping changes are not included.
