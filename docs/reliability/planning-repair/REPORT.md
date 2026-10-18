# Planning-pipeline diagnosis and repair (after the planning-only validation)

## How the validation was accepted

The planning-only validation (`docs/reliability/planning-validation/`) is accepted as follows:

- **Review and versioning workflow:** passed.
- **Substantive plan revision:** failed.
- **App generation:** no result.

All of its evidence is kept: both plan versions, the exact feedback, the configuration, and the timing and usage.

**Not done in this work:**
- no real planner was run;
- no app was generated;
- no dependencies were installed;
- no models were changed;
- no motion work (phases 3–4).

The diagnosis used only the captured artifacts. `v2/raw/` holds the run's own planning intermediates, read from the validation daemon's database by `export-raw.mjs`.

## Source map: where each failure came from

**Main finding: the revision never reached the PRD planning path.**

- `planReview.ts:135` puts the person's request into `run.constraints`.
- Only two places read the constraints:
  - the planner prompt for builds without a PRD (`orchestrator.ts:698`);
  - the PRD-less spec plan (`orchestrator.ts:791`).
- A build with a PRD goes through `planChecklist` (`orchestrator.ts:1279`). None of its stages read the constraints:
  - the app model (`:1087`, `:1163`);
  - the checklist batches (`:1299`);
  - the experience map (`:983`);
  - the screen briefs (`:947`).

So version 2 was the same pipeline run again. Its differences were run-to-run variation, not the request.

The 0e47443 tests passed because their scripted run had no PRD, and so used the path that does read constraints.

| # | Failure | Where the decision originated | Stages that read the feedback | Later overwrite or reintroduction | Final wording comes from |
|---|---|---|---|---|---|
| 1 | Scope expansion | `parseAppModel` adds every look-up destination: Categories, Lists, List, "Find a place" (`appModel.ts:289`). This runs whatever the model or PRD says, and the PRD's "Not in this release" section was never read. The FlowCode filler turned the "Stores: Name, ZIP code" record line into a build step (`placeBySection`, `lrcPlan.ts:170`). | none | Yes: the app model re-adds the set on every parse. Screen purposes (`appFiles.ts:308`) and the design step (`appFiles.ts:331`) re-promise ZIP code, categories, likes, sharing, ratings, comments and lists. | deterministic expansion and templates |
| 2 | Home as a marketing funnel | `pickSections` reads "product page" in the PRD as a website pitch (`sectionRecipes.ts:49`, via `templates.ts:415`). That adds navbar, hero, CTA banner and footer. | none | Yes: the model typed Home as "marketing", which `pageTypeOf` accepts (`screenBrief.ts:145`). The composition check then removed the right part (`t.app-storefront`) as "not for a marketing page". | deterministic plus model (page type) |
| 3 | Placeholder phrases as visible text | The model wrote descriptive `expect` values, as `BATCH_SYSTEM` asks ("expect is what appears on screen"). `isExactValue` (`lrcPlan.ts:467`) accepted anything short. | none | Yes: `testBrief` (`:443`) rendered them as `the app shows "…"`, `stepsFromGroups` (`:501`) made them `file_contains` criteria, and `featurePrompt` (`:324`) repeated `shows "…"`. | model text turned into requirements by deterministic expansion |
| 4 | No complete save journey | The model's experience map gave four partial journeys. Nothing structural checked a journey (`EXPERIENCE_SYSTEM`, `experienceMap.ts:41`). | none | R19 (persistence) was then left as a "decision for you" (`scopeDecisions`, `:198`) instead of being journeyed. | model |
| 5 | Two state layers; detail page in the navigation | `appModelNote` (`appModel.ts:329-331`) printed every destination, Product Detail included, as "Navigation". It said "Likes, saves, ratings, comments and lists live in the look-up layer … beside the store". The model assigned `src/app/store.ts` to the persistence step. `BATCH_SYSTEM` (`lrcPlan.ts:208`) and the test brief (`:452`) point at `src/sim`. | none | The frame actually hides the entry page (`lookupFiles.ts:162`), so the plan text contradicted the build. | templates plus model (file list) |
| 6 | Look status | Fixed template text: "Apply the direction you selected" (`templates.ts:456`) and "approve the prototype plan and the design set on the Styles page" (`templates.ts:466`), whatever the design state was. | not applicable | not applicable | template |

**Not prompt-following failures:**
- 1, 2, 5 (navigation) and 6 are deterministic: the model wasn't involved, or was overruled.
- 3 is the model's text promoted by FlowCode's own classifier.
- 4 is the only one that comes purely from the model, and nothing checked it.

## Bounded changes

1. **Scope reaches every stage** (`orchestrator/planScope.ts`, new). One deterministic decision from the PRD and the run's revision requests:
   - **Capabilities:** each library capability (categories, places, lists, ratings, comments, sharing, likes) is "in scope" only when the PRD's in-scope text asks for it. It is "deferred" when the PRD's non-goals or a negated revision sentence names it (quoted examples are ignored), and "not requested" otherwise. A clash between the PRD and a revision is recorded for the person.
   - **Supporting data:** requirements under records or sample-data headings become supporting data, not build steps.
   - **Navigation:** the PRD's declared links become the primary navigation.
   - **Where it is applied:**
     - The app model (`applyScope`, in `decideAppModel`): left-out destinations are removed; ratings, lists and likes sample data are dropped; `lookup.omit` is recorded; the PRD's screen purposes are used.
     - Navigation (`inPrimaryNav`): record pages are never links; a look-up app shows the declared links only.
     - Library selection (`dropFunnel`), and the entry page, Home and frame sources (`lookupFiles.ts`). There is a new `omit` prop on the `lookup-entry` piece; the default behaviour is unchanged.
     - Concept problems (`homeConceptOffer.ts`).
     - Feature planning: `planDirectives` goes into the checklist, app model, experience map and brief requests.
     - Final assembly: a scope note in the plan's assumptions.
2. **Page purpose and composition agree** (`pageTypes.ts`, `screenBrief.ts`).
   - There is a new `home` page type (an app's front page; the marketing funnel is in its "avoid" list).
   - In an app, "marketing" from the planner, or an untyped Home or landing page, becomes `home`. Websites are unchanged.
   - An app's library step drops the website header, hero, CTA and footer that the PRD's wording matched.
3. **Tests: three kinds** (`lrcPlan.ts`: `testKind`, `testLine`).
   - **Exact text:** only text the PRD or the app's records contain, or a number. Only exact text becomes "the app shows" and a `file_contains` criterion.
   - **Outcome:** described results (to observe the record, a list's contents, a control's state or a dialog).
   - **Identifier:** a named screen or page. The test checks it by that page's own heading, record or controls.
   - The test brief points at the app's real data for complete apps.
4. **The complete save journey** (`experienceMap.ts`: `ensureSaveJourney`, `isCompleteSaveJourney`).
   - **When it applies:** the app has a saved page and a saving requirement, and no planned journey already goes all the way.
   - **What FlowCode adds:** search a real record → open it → Save while signed out (asked to sign in) → sign in → Save → Saved lists it → reload → still listed → Save again (unsave) → no longer listed.
   - **Start state:** the journey has an explicit `start`.
   - The planner's own journeys stay, and the assembly's journey tests include it.
5. **One owner each** (`dataOwners`, `withOwners`).
   - **Named owners:** product records belong to `src/app/store.ts`; saved state belongs to `src/app/lookup.ts` in a look-up app (the store in an app of records).
   - **In the plan:** every feature step reads the owners. A save step's `store.ts` path moves to the owner, and `src/sim` paths are dropped.
   - **Wording fixes:**
     - the app model note now separates "Primary navigation" from "Opened from other pages";
     - the assembly step no longer says every screen is in the navigation.
6. **The Look as it is** (`lookStatus.ts`). The status is "selected (version, surface, motion)", "proposed and awaiting your pick (the Home directions)" or "none".
   - The style and review steps and the plan's assumptions say which.
   - The review step now approves only the plan.
7. **Explicit plan checks** (`planChecks.ts`).
   - Six structural checks run on the assembled plan.
   - They are stored as `planChecks:<run>` and announced as a warning when any fails. Planning isn't blocked.

## Regression evidence

`packages/daemon/test/planning-repair.test.ts` has 13 tests, all passing.

**The captured failed plan fails all six checks.** The tests run on `v2/plan.json`, with the exact problems the owner named:
- the `[categories]`, `[places]` and `[lists]` pages;
- the hero, CTA banner and footer, and "marketing page";
- "Sign-in prompt appears" and "product added to Saved list";
- no complete journey;
- no owners, `store.ts` for saves, and `Product Detail [entry]` in the navigation;
- "says a direction was selected" and "implies the design is approved".

**The same run, replayed through the real `planChecklist`.**
- **Setup:**
  - the planner answers with its captured version-2 outputs (app model, records, activity, checklist tasks, journeys, Home brief);
  - the run carries the person's real revision request.
- **Outcome:**
  - The request is in every stage's request.
  - The assembled plan passes all six checks.
  - The plan is saved as `replayed-plan.json` (plan, checks, scope, journeys, briefs, coverage, events).
- **What the replayed plan shows:**
  - navigation is Home, Search, Saved; Product Detail opens from results;
  - no Categories, Lists, List or Store Finder;
  - no hero, CTA or footer, and Home is typed "App home";
  - "Oat Milk Original" stays exact, and the placeholder phrases become outcomes;
  - FlowCode added the save journey, starting signed out as the Visitor;
  - the persistence step names `src/app/lookup.ts`;
  - no scope decisions are left, because R12 is supporting data and R19 is journeyed;
  - Look: "no direction is selected. Proposed for your choice on the plan card…".

**The same run without any revision passes too.** The PRD alone gives the scope.

**Other products:**
- A recipe finder that asks for shopping lists and ratings keeps them. Its save journey starts from a Guest's signed-out state.
- A website keeps its marketing page and sections.
- An app of records gets exact text only from its spec, outcomes and screen names as non-text, and one store owning everything.
- A revision alone can defer a capability, and its clash with the PRD is flagged for the person.

**Typechecks and existing tests:**
- **Typechecks:** daemon, UI and contracts pass with no output (`dist/` was not rebuilt, so eval 5's daemon isn't touched), and 206 library pieces typecheck.
- **Existing tests:** `lrc-plan.test.ts` changed one expected phrase (the new outcome wording). The full daemon suite result is in the commit message.

## Still needs human review

- **Model wording:** the checks prove structure, not prose. The replayed brief still titles a section "Search and Categories", and one test searches for "flour", which no record has. In a real run the planner now receives the scope, but whether it follows it in prose is not checked.
- **Full-page Home designs:** the storefront, magazine and listings designs keep their built-in sections. A deferred capability they show is now listed as a problem on the concept card, not removed from the design. "Bold aisle" (the one picked) shows a ZIP code and stores near you, which this build leaves out.
- **Ratings panel:** the entry page hides it only when both ratings and comments are left out.
- **Primary navigation from the PRD:** applied to look-up apps only. Apps of records keep every page in their navigation.
- **Outcome tests:** the plan says what to observe; whether the coder's tests then observe it is checked only when they run.
- **Planning is not blocked by failing plan checks.** They are reported in the build log, not shown on the plan card. Showing them there is a UI change, not done here.
- **Not proven:** a real-planner run of this repair. That's the next validation, for you to authorise.

## The validation run after the export (recorded, not caused by this work)

On the validation daemon (7461), after the version-2 export at 11:05:
- the Home direction "Bold aisle" was picked (11:11:40);
- a Look, version 1 (flat surfaces, balanced motion), was selected (11:13:45);
- plan version 2 was approved from the UI (11:13:57, "Approved plan version 2 with look version 1").

Execution then started:
- the starter scaffold ran;
- the coder capability probe ran automatically;
- the dependency-install permission opened (pending).

Given the instruction not to approve version 2 or generate, I paused that run at about 11:26. The install permission stays pending and unanswered.

Snapshot: `docs/reliability/planning-validation/v2-after-approval/`.

## Full suite

- **Full daemon run in parallel:** 1,566 passed and 88 failed, across 28 files. The failing files were browser, render and timing tests under parallel load.
- **Each failing file run on its own:** every file passes except `builtin-versions.test.ts`.
  - **Cause:** the page-composition skill embeds the page-type guide, which now lists `home`.
  - **Fix:** the skill was bumped to 1.0.1 and the fingerprints were updated with `scripts/update-builtin-hashes.mjs`. It now passes.

## Eval 5 (untouched): observed state

Run `run_7fe7e67ef0a94668b4e0` on the main daemon (7457), observed at 12:06Z:

| | |
|---|---|
| Deadline expired | 11:54:02Z |
| Recorded stop | 11:54:04Z (`stoppedAt`) |
| Deadline record | "the deadline was reached while it worked" |
| In progress | "Install dependencies (approved)" |
| Waiting | `dependency_install` approval, pending since 10:06:02Z |
| Status | still reads `running`, with `paused=true` |

The run never reaches a terminal status while paused: the status isn't moved when the deadline expires during a pause. That is a separate defect, not fixed here.
