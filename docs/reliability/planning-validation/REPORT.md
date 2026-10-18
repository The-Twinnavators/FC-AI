# Planning-only validation of the Request changes workflow (after 0e47443)

**What this is:** a new validation that reuses eval 5's Clean Cart brief and PRD. It is not a continuation of eval 5, and it is not a completion of eval 5.

**Setup:**
- One run on a separate daemon (port 7461, data in `.flowcode-validation`, commit 0e47443), so eval 5's daemon and records stay untouched.
- The real planner: qwen3-coder:30b at temperature 0.1, pinned for the planner, coder and debugger, as in eval 5.
- Support roles and runtime options were copied from the main daemon (`freeze.json`).

**What was done:**
- No generation, no dependency installation, no builder or model changes, and no repeated planner attempts.
- Nothing was approved. Plan version 2 waits at its review.

## Sequence and evidence

| | Plan version | Hash | State | Files |
|---|---|---|---|---|
| Original | 1 | 07ecd9dae4b17be7 | superseded 11:00:47Z (Request changes) | `v1/` |
| Revised | 2 | 8d1344977525627b | current, plan approval **pending** | `v2/` |

**Exact feedback:**
- The text is in `revision-feedback.txt` (six corrections, condensed from `docs/reliability/eval5/REVISION-REQUEST.md`).
- It was submitted through the real review card: Request changes → "Send and plan again". The script is `request-changes.mjs`.
- Evidence: `request-changes.webm`, `v1-card-scope.png`, `v1-card-request.png`, `after-request.png` and `request-submitted.json`.
- The status line afterwards read "Revising plan version 1 as you asked: version 2 comes back for your approval".

**Models:** `v2/models.json`. The planner, coder and debugger were qwen3-coder:30b; the support roles were qwen3:14b. Everything was local (Ollama).

**Timing and usage** (`v2/performance.json`; planner only):
- Calls: 22 model calls, none failed.
- Model time: 557 s, of which 515 s was generation.
- Tokens: 24,836 prompt and 20,157 output; one cold load.
- Planning phases: version 1 took 310 s and version 2 took 248 s.

**Revision outcome recorded by FlowCode:**
- 4 steps added, 4 removed and 12 kept.
- Risk: medium → medium.
- Decisions for the person: 5 → 2 (R12 ZIP code; R19 persistence not in a journey).

**Reading the plan:** step numbers refer to `v2/plan.json` tasks. The Home brief and journeys are in steps 14 and 16; screen-level detail is in `v2/prototype-plan.json`.

## Correction by correction (version 2)

| # | Correction | Result | Where in plan version 2 |
|---|---|---|---|
| 1 | Reconcile the required slice with supporting data and deferred library capabilities | **Missing** | Step 8 still says sharing, ratings, comments and lists work. Step 7's navigation still includes Categories, Lists, List and Store Finder. No section separates the required slice, supporting data, deferred features and library capabilities. |
| 2 | Home as a branded product-discovery page, no marketing funnel | **Missing** | Step 6 still adds `hero-centered`, `cta-banner` and `footer-simple`. Step 14's Home brief still reads "Page type: Marketing page". The offered Home concept, "Bold aisle", centres on a search hero, stores near you and the ZIP code. |
| 3 | Tests check what a person sees, not placeholder phrases | **Partial** | Step 12 now uses a real record ("Oat Milk Original"), and step 13 checks save → reload → still saved. Steps 10, 11 and 13 still assert descriptive phrases as outcomes: "Sign-in prompt appears", "Product appears on Saved screen", "product added to Saved list" and "product removed from Saved list". |
| 4 | One complete journey: search → product → save/sign-in → Saved → reload → unsave, with visitor and member states | **Partial** | The journeys are split: "Search for Product", "View Product Details", "Save Product" (starts on Product Detail; "If signed in, product is saved; if not signed in, prompted to sign in") and "View Saved Products". No journey runs end to end, none states its starting authentication state, and unsave appears in no journey (only as a step 13 test). R19 is still left as a decision for you. |
| 5 | One product store and one saved-state persistence layer; no detail routes in navigation | **Missing** | Step 7 keeps likes, saves, ratings, comments and lists in `lookup.ts`, and step 13 also writes `src/app/store.ts`, so there are still two state layers. Product Detail is still in step 7's navigation list. |
| 6 | Present the Look: direction, surface, Home composition, Balanced motion, expressive effects off | **Missing** | `v2/design-state.json` shows "No brand direction selected", no checks and no motion. One Home concept is offered (`v2/concepts.json`, "Bold aisle": flat surfaces on a light yellow ground), but it isn't chosen, and it states no motion level or effects setting. FlowCode doesn't propose a Look for approval. |

**Summary:** 0 satisfied, 2 partial, 4 missing. The approval workflow itself worked as designed:
- the request was submitted through the card;
- version 1 was superseded with the request kept;
- version 2 needs a fresh approval;
- the outcome was recorded.

The planner didn't apply most of the content. This matches the limitation recorded in `docs/reliability/approval-repair/REPORT.md`: the request reaches the planner only as a constraint.

**Stopped here, as instructed:**
- no further revision attempts;
- no planner patch;
- no approval.

The decision on version 2 is the owner's.

## Accepted outcome and what happened after the export (added 2026-10-18)

**Accepted outcome:**
- The review and versioning workflow passed.
- The substantive plan revision failed.
- There is no app-generation result.

**After the version-2 export (11:05)**, these happened on the validation daemon from the UI, not by Claude:
- the Home direction "Bold aisle" was picked at 11:11:40;
- Look version 1 (flat surfaces, balanced motion) was selected at 11:13:45;
- plan version 2 was approved at 11:13:57.

**What ran after the approval:**
- the starter scaffold;
- the automatic coder capability probe;
- the dependency-install permission opened and is still pending.

**Pause:** because the owner's instruction was not to approve version 2 or generate, the run was paused at about 11:26. Nothing else was pressed.

**Evidence:**
- `v2-after-approval/`: the state after the approval.
- `v2/raw/`: the planning intermediates (`export-raw.mjs`).

The diagnosis and repair that followed are in `docs/reliability/planning-repair/REPORT.md`.
