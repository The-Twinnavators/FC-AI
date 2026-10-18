# Frameproof evaluation 2, plan version 1: evidence for the owner's review

**Run:**
- `run_5183234fc4e84cceac86`, candidate `84f648f` (`packages/daemon/dist-v4`, port 7464).
- The PRD and configuration are unchanged (`freeze.json`).
- Planning took 7.3 min (13:47:57 to 13:55:08Z): 11 planner calls, none failed, no retries, 26,884 prompt and 14,514 output tokens.
- Replies are in `raw/planningReplies.json`.
- FlowCode placed 9 requirements the planner left out.

**Status:** waiting for review; nothing approved.

**Verdict: still a planning-stage PRD-compliance failure.**
- The plan card flags it **Not approval-ready** for one contradiction.
- A larger requirement-extraction gap, found by reading the plan, isn't flagged by any check.

## Against the owner's list

| Asked to preserve | Plan version 1 | Guaranteed or unverified |
|---|---|---|
| The 12 exact photo records, in order | **Kept:** `photo-01`…`photo-12`, PRD titles, categories and orientations, in order. `imageSource` is empty (no remote URLs). Alt text was written by the model. | Guaranteed: FlowCode writes the records from the app model in step 7, and compliance check 7 passes. |
| Seven Outdoor, five Studio | **Kept:** category options Outdoor and Studio, 7 and 5 records. | Guaranteed (step 7). |
| One gallery | **Kept:** `gallery-autumn`, Autumn Portrait Session, Rowan Studio, Maya Chen, 5. | Guaranteed (step 7). |
| Gallery and My Selection only in primary navigation | **Kept:** Gallery [list of photos], My Selection [custom: the Client selection state]. Photo Detail is opened from the grid. | Guaranteed: the frame is written from this (check 8 passes). |
| No upload or create-photo workflow | **Kept:** no create page, no gallery list or detail. | Guaranteed (check 9 passes). |
| Shared selection state | **Stated:** "The PRD's Client selection state (Shortlisted photo IDs; Editing note per photo; Selection status: Draft or Submitted; Submission timestamp) is one shared state owned by src/app/store.ts… under a namespaced key". | The owner statement is guaranteed in the plan. The state itself is written by feature steps 9–13: unverified. |
| Five-photo limit | Tests: "try to select a 6th photo", "attempt to add a sixth photo → limit message", "remove one → can select another". Journey "Select, annotate, and persist". | Unverified. Two tests require invented wording ("Maximum 5 selections allowed" and "Maximum 5 photos allowed", phrased as outcomes). |
| Notes | A test expects the character count to read **"20/500"**. The PRD says notes are **up to 300 characters**, but that sentence was never extracted (below), so nothing in the plan states 300. | **Contradiction, not flagged by any check.** |
| Submission locking | Journey "Submit and lock"; tests for Submitted status. The confirmation dialog contents (R8) were never extracted. | Unverified. Part is missing. |
| Persistence | Reload tests and journeys. "Use a namespaced storage key" appears only in the owners statement. "If saved data cannot be read, recover…" was never extracted and is in no step. | Unverified. Recovery is **missing**. |
| Start over | Journey "Start over" (cancel, then confirm). | Unverified. |
| Photo detail: Previous/Next without wrapping | "Previous/next" appears in a test, but "Do not wrap: disable Previous on photo-01 and Next on photo-12" was never extracted and is in no step. | **Missing.** |
| Editorial Look, Balanced motion, expressive off | **Proposed:** "The PRD's own direction is proposed for your review: 'Editorial contact sheet': warm off-white background; near-black text; muted cobalt accent…; balanced motion, expressive effects off". Nothing is selected; base styling until a Look is selected on the Styles page. No invented colour is required. | Proposed, not selected. Selecting it is yours on the Styles page; the card binds the selected Look version. |

## Flagged by FlowCode before approval

**Compliance check 11 (hard) fails.** The plan is high risk: "Not approval-ready: 1 contradiction with the PRD".
- "enter 'Outdoor' in search field" is a category used as a title search.
- "select 'Nature' from category dropdown": there is no Nature category.

**All other checks pass:**
- the 6 structural checks;
- compliance checks 7–10 and 12.

**Decisions for you:** 0 (v1 had 38).

## Not flagged: a requirement-extraction gap (new finding, not in the authorized repair)

**What happens:** FlowCode extracts requirements only from list items and must/should sentences. **51 PRD sentences never became requirements** (`unextracted.txt`). Most of §6's functional requirements are paragraphs, so they're among them, including:
- R1 (the gallery overview contents);
- R3 ("Provide All, Outdoor, and Studio filters", "Outdoor contains seven…", "does not alter shortlist or notes");
- R4 (Previous/Next order, no wrap, Gallery state kept);
- R6 (300 characters);
- R7 (My Selection contents, empty state);
- R8 (exactly five; the confirmation dialog; Cancel);
- R9 (Submitted status, timestamp, lock, no external requests);
- R10 (the Start over dialog; don't clear other storage);
- R11 (survive reload; namespaced key; recovery from unreadable data);
- §8 motion;
- the 390 px phone width.

**Consequences:**
- These sentences are in no requirement, so the coverage matrix, the compliance checks and "decisions for you" can't see them.
- Where the plan covers them, it's because the model read the PRD text itself.
- The same extractor ran in Frameproof v1; this repair didn't address it.

## Recommendation

Use Request changes or deny. The plan contradicts the PRD on notes (500 vs 300), and it misses behaviour the PRD requires.

A revision request reaches the checklist planner, but not the extraction. So it can add tests, while the coverage and checks still won't see those sentences.

## Review link

http://localhost:5199/?port=7464&token=frameproof-token-2&temp=1#/projects/prj_e8a2176cf74946bbb974/runs/run_5183234fc4e84cceac86
