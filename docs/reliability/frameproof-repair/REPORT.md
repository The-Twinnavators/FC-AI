# Bounded repair after Frameproof plan version 1

**Background:** Frameproof plan version 1 is recorded as a planning-stage PRD-compliance failure (`docs/reliability/frameproof-eval/v1/`). Its run stays at its plan review, unanswered. This repair addresses the pipeline defects that run demonstrated.

**Not done:**
- no broad rewrite;
- no model or dependency change;
- no Clean Cart work.

## The seven repairs

1. **Explicit records, independent of the heading** (`orchestrator/prdRecords.ts`, new).
   - **Finding the tables:** every Markdown table that holds records is found by what it holds (a records, data or sample heading or prose, an ID column, or a `Field | Value` table), not by an exact heading. Screens and people tables are left alone.
   - **Matching:** each table is matched to a kind of record by heading and columns, and its columns to fields by label or key; ID columns keep the PRD's ID.
   - **Exact tables:** a table is exact when the PRD says "use these exact records", or gives one record field by field.
     - The sample-record step asks the model only to fill the fields the PRD leaves out, for those records.
     - `enforceRecords` then makes the kind's records exactly the PRD's: its IDs, values, order and count, with nothing added.
   - **Other sample tables:** the PRD's records come first, and one the model omits is written from the PRD's own values.
   - **Completeness:** `recordProblems` is part of the app model's completeness check.
2. **Option shapes** (`appModel.selectOptions`).
   - **Read:** strings, numbers and objects with a label, name, title, value, key or id.
   - **Record values:** written with a key or value ("outdoor") map to the label ("Outdoor").
   - **Anything else** is reported with the value itself, and the field becomes plain text. "[object Object]" is never emitted.
3. **Capability-driven create pages and declared navigation** (`appModel.parseAppModel`, `planScope.applyScope`).
   - **No create page is implied by a kind of record.** One is added when the PRD asks ("Users create an event") and removed when the PRD rules it out ("Photo upload or download").
   - **Single-record kinds:** a kind the PRD gives as one record, or rules out more of ("Multiple galleries"), has no list, record or create page. A declared screen that listed it lists the records it holds instead.
   - **State screens:** a declared screen named after the runtime state the PRD specifies ("My Selection" for "Client selection state") is that state's page.
   - **Navigation:** the PRD's declared navigation, now also read from numbered lists, is the primary navigation for any app whose pages include every declared destination.
4. **Library selection respects negation and scope** (`layoutRecipes.affirmed`, used by both section and layout picks).
   - Out-of-scope sections and sentences that rule something out ("Do not add … pricing page", "Avoid … pricing") no longer select pieces.
   - Hyphenated words ("no-shows") and quoted customer words aren't treated as negation.
5. **Runtime state** (`planScope.state`, `dataOwners`).
   - A PRD section headed "… state" gives the state's fields and rules.
   - The plan's owners statement names it with every field and one shared owner (`src/app/store.ts`), kept under a namespaced key.
6. **Compliance findings before approval** (`planChecks.ts`, `contracts.ImplementationPlan.compliance`, the plan card).
   - The six existing checks are now marked **structural**.
   - Six **compliance** checks are new, and they're hard:
     1. the PRD's required records;
     2. the declared navigation;
     3. excluded capabilities (create pages, ruled-out library pieces, remote assets);
     4. runtime state accounted for in the owners statement;
     5. acceptance tests agreeing with the records (search results, filter values, counts);
     6. the PRD's Look proposed, with no invented exact values.
   - **A failing hard check:**
     - makes the plan high risk, with "Not approval-ready: N contradiction(s) with the PRD" first in its risk notes;
     - stops it from ever being auto-approved;
     - shows on the plan card as a "Not approval-ready" alert listing each contradiction, with the Approve button reading "Approve version N despite N contradictions".
   - Nothing is disabled or decided for the person.
   - Separately, a requirement the build codes is no longer returned as a "decision for you". Only one that nothing places is.
7. **The stated visual direction** (`planScope.look`, `lookStatus`).
   - A PRD's visual-direction section (its concept, lines, motion level, and whether expressive effects are off) is proposed for review in the plan's Look status: "The PRD's own direction is proposed for your review…". It isn't replaced by base styling.
   - The design steps get the direction.
   - **No invented exact values:** no exact colour is invented. A test asserting a colour the PRD doesn't give becomes "uses the selected Look's colour".

## Regression evidence

**`test/frameproof-repair.test.ts`** (10 tests): the unchanged PRD, with the planner's recorded v1 replies replayed through the real `planChecklist`.

| Check | Result |
|---|---|
| Records (`replayed-plan.json`) | 12 photos `photo-01`…`photo-12` with their titles and categories in order (7 Outdoor, 5 Studio). One gallery, `gallery-autumn` (Autumn Portrait Session, Rowan Studio, Maya Chen, 5). No invented records or `https://` URLs. |
| `[object Object]` | Appears nowhere in the plan or any request. |
| Navigation | "Primary navigation: Gallery [list], My Selection [custom]". No create page. Photo detail is opened from the grid. |
| Library | No pricing piece. |
| State | The owners statement names the Client selection state with all four fields and one owner. |
| Look | The PRD's "Editorial contact sheet", balanced motion, expressive effects off, proposed. The `#3a6ea5` test became a Look check. |
| Checks | All 6 structural and 5 of 6 compliance checks pass. **Acceptance-test consistency fails**, from the model's own recorded tests (below). |
| Approval | The plan is high risk and "Not approval-ready: 1 contradiction with the PRD". |
| Decisions | 0 (v1 had 38). |

The acceptance-test consistency check fails on these model-written tests:
- "search for 'Window Light' → … Last Light";
- "type 'Outdoor' in search bar";
- "select 'Indoor' from category dropdown";
- "14 gallery records displayed".

**Also tested:**
- **Non-Frameproof cases:**
  - the same records table under another heading;
  - a screens table that isn't records;
  - a referrals app whose PRD asks for a create page (kept) and rules out document upload (removed);
  - library negation for a bakery and a gym, with pricing still picked when asked;
  - a hex colour the PRD does give, which stays exact.
- **Captured v1 plan through the checks:** all structural checks pass. Compliance checks 7–12 fail with v1's actual faults:
  - 14 photos;
  - New gallery and New photo;
  - the photo upload rule;
  - pricing-tiers;
  - `example.com` URLs;
  - no state owner;
  - the Look not proposed.

**`test/plan-contradictions-ui.test.ts`** (real UI): the card shows the alert and the contradictions, separates compliance from structure, and the Approve button names them. Screenshot: `plan-card-contradictions.png`.

**Updated tests** (to the new rules, each with its reason in the test):
- `app-model.test` and `lrc-plan.test`: no implied create page; the calendar keeps "New event" because its PRD asks for it;
- `record-identity.test`: the omitted PRD record is written from the PRD;
- `experience-map.test` and `lrc-plan.test`: a coded requirement is planned, not a decision;
- `planning-repair.test`: 12 checks, split by kind.

**Typechecks and suite:**
- **Typechecks:** contracts, daemon and UI pass, and 206 library pieces and 14 layouts typecheck.
- **Full daemon suite, run in parallel:** 1,658 passed, 55 failed. The failures are browser and timing tests under load; every failing file passes when run on its own.

**The 38 decisions:** classified in `DECISIONS.md`: 0 truly unspecified, 27 already answered by the PRD, 11 introduced by the builder.

## What still needs human review

- **The model still writes the tests.** FlowCode now flags contradicting ones as hard findings; it doesn't rewrite them. A real-planner plan can still come back "not approval-ready", which is then yours to answer with Request changes.
- **The test-consistency check reads quoted search and filter terms and counts.** Other wrong tests can pass it.
- **Images:** remote image URLs are removed from the records. Bundled or local placeholder images are left to generation (unverified until then).
- **The Look:** the PRD's direction is proposed in the plan's text. It isn't a draft on the Styles page, because no exact values are invented. The card's Look summary still shows the design state.
- **Navigation when a declared destination is missing:** when an app's pages don't include every declared destination, all pages stay in the navigation, and compliance check 8 reports it.
- **Clean Cart:** its suspected scope-note defect is untouched, as instructed.
