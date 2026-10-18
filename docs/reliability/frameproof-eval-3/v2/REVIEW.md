# Frameproof evaluation 3, plan version 2 (after one Request changes): review

**Request:**
- `revision-feedback.txt`, the owner's four corrections, submitted through the plan card's Request changes at 15:41Z.
- Recorded in `request-changes.webm`, `v1-card.png`, `v1-card-request.png`, `after-request.png` and `request-submitted.json`.

**Version 2:** ready at 15:53:34Z. Revision planning took 12.3 min. Run totals: 30 planner calls, none failed, no retries, 85,487 prompt and 44,369 output tokens.

**FlowCode's checks:** all 13 pass.

**Status:** not approved. The run is waiting at version 2's review.

**Outcome:** this one revision leaves material contradictions, so per the owner's instruction the evaluation stops here, without another repair loop.

## The four corrections

| # | Correction | Result in version 2 |
|---|---|---|
| 1 | No per-photo workflow status; one shared selection state; empty initial state | **Applied.** The photo record has no statuses, and no sample photo has a status. Step text: "Add a shared clientSelectionState to the store with empty shortlist, no notes, Draft status, and no timestamp". The owners statement names the state's four fields. |
| 2 | No gallery list, gallery detail, Smith search or John Doe filter | **Applied.** None appears. Navigation is Gallery [photo grid] and My Selection, with Photo detail opened from the grid. |
| 3 | `light` returns exactly Window Light and Last Light; Outdoor is a filter | **Applied** as to results: no "only one" and no "Outdoor in search". **But** three tests assert the phrase "Window Light and Last Light" as exact on-screen text (below). |
| 4 | "Seven photos appear" and "Previously saved note remains" as behaviour, not text | **Partly applied.** "Seven photos appear" is no longer required text, and one test now checks the saved note. **But** step 9 still has `the app shows "saved note remains"`, and the "Window Light and Last Light" text tests have the same flaw. |

**Kept:**
- the 12 exact records, in order (7 Outdoor, 5 Studio);
- the one gallery;
- the declared navigation and scope;
- the five PRD journeys in the assembly step.

## Remaining material contradictions

1. **Step 13: "select 7 photos and submit → Submission successful with timestamp".** This contradicts the maximum of five selected photos and "submission is available only with exactly five". A coder making it pass would have to allow seven.
2. **Step 10: "navigate directly to photo detail URL with ID 123 → photo with ID 123 is displayed".** No such record exists. R12 says an unknown photo ID shows a not-found state with a Gallery link.
3. **Descriptions required as visible text, against correction 4.** Step 9 has `the app shows "saved note remains"` and `the app shows "Submitted status"`. Steps 9, 12 and 13 have `the app shows "Window Light and Last Light"`. These are descriptions, not interface text: two separate results can't show as one string.

**Why the checks missed these:**
- **Check 11** reads limits stated as "maximum N" or "N/M", not a selection count in a test's action. It doesn't check that an ID in a test exists.
- **Text phrases:** they pass as exact text because the same words appear in the PRD's journeys and examples.

## Nonblocking

- **Invented messages, phrased as outcomes:** "You need 1 more photo to submit" and "At least 5 photos required".
- **Ambiguous:** "Submitted status is shown for all selected photos".
- **Repetition:** some tests are repeated across steps.

## Look

Unchanged and not selected: the PRD's "Editorial contact sheet" direction, with Balanced motion and expressive effects off, is proposed for the owner's explicit selection on the Styles page.

**Review link:** http://localhost:5199/?port=7465&token=frameproof-token-3&temp=1#/projects/prj_cb315e70e0b74335ada7/runs/run_05368827afde426eac8b
