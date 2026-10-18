# Frameproof (main FlowCode): plan version 1 review

Run run_b789650d36dd4323aa4b. The plan was ready at 16:51:05Z. It was approved in the UI at 16:52:54Z ("by user", decision once, "despite 1 contradiction"). The npm install was approved at 16:53:08Z. Claude did neither; its only actions were read-only exports. A second gate, "Approve the prototype plan and the design to start building" (step 5), is pending.

## Holds to the PRD
- Records: 1 gallery and the 12 photos as given.
- Navigation: Gallery and My Selection only.
- Runtime state: one shared owner.
- Nothing the PRD excludes appears in the plan.
- Source coverage: every passage is mapped (check 13).
- Search tests (light / WINDOW / mountain) and filter counts (7 / 5) are correct.
- Previous/Next ends, the not-found route, notes kept on removal, cancel and start-over tests, and persistence with corrupted-data recovery are covered.

## Material contradictions (acceptance tests that are wrong)
1. "type 'portrait' in search → filtered results": no title contains "portrait". Flagged by check 11.
2. "select 'Portrait' category → filtered results": not a category option. Flagged by check 11.
3. "check selection progress → 30%": invented. The PRD gives a count of five, not a percentage. Not flagged.
4. "Search for 'sample' in Gallery → 1 gallery record shown": the PRD has no gallery list or gallery search. Not flagged.
5. "Select 5 photos in MySelectionScreen → status 'Submitted'": selecting does not submit (R8/R9). Not flagged.
6. "Remove one photo from My Selection → … note cleared": contradicts R6 ("Notes remain attached"). It also contradicts the plan's own "Remove photo → Note is retained". Not flagged.

## Nonblocking
- Photo category options include "All", which is a filter value, not a category.
- The photo record carries `note`, but notes are client selection state per the PRD.
- "Submit button hidden at four": the PRD says submission is unavailable and the app explains how many more photos are needed. Disabled-with-explanation is the closer reading.
- No user journeys were mapped (the experience-map reply was unusable). Journeys A–D survive only as "remaining requirements" buckets and as scattered tests.
- Look: the dialog default "Clean Minimal" (flat) is in use. The PRD asks for its own Editorial contact sheet (warm off-white, near-black, muted cobalt, fine borders), which the plan carries as a step.

## Builder gap shown
Check 11 caught 2 of 6 wrong tests. It does not check tests against:
- invented numeric targets;
- record kinds the PRD has no list or search for;
- the PRD's state transitions (select ≠ submit; remove keeps notes).
