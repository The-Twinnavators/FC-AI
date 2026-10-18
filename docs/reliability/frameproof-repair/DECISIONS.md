# Frameproof v1: the 38 "decisions for you", classified

**Totals:**

| Class | Count |
|---|---|
| Truly unspecified | 0 |
| Already answered by the PRD | 27 |
| Introduced by the builder | 11 |

**Why none was really a question:**
- Every one is an explicit line of the PRD.
- The question FlowCode asked ("add it to a journey, or agree it is checked on its own?") came from its own rule: a coded requirement that no planned journey cites by ID went back to the person.
- 37 of the 38 already had acceptance tests in their v1 build step. The one without, R49, was placed by FlowCode, whose step must write at least one test.

**The two classes:**
- **Already answered by the PRD:** the PRD states the behaviour, and its own journeys (A–E) or examples say how to check it.
- **Introduced by the builder:** a boundary, a visual-direction line, a layout composition or a review criterion. FlowCode made each one a coded step and then asked for a journey.

**The repair** (`experienceMap.coverageMatrix`): a requirement the build codes is "planned", proved by its step's tests. Only a requirement that nothing places is returned to the person. The replayed Frameproof plan returns none.

| Decision | Requirement (PRD) | Class | Why |
|---|---|---|---|
| R2 | Responsive, local-first web app. [2. Prototype boundaries] | Introduced by the builder | A prototype boundary (responsive, local-first), checked by the PRD's §9 responsive tests and §11 review, not a journey step; FlowCode asked to put it in a journey. |
| R16 | My Selection, with the current shortlist count. [4. Screens and navigation] | Already answered by the PRD | The declared navigation (§4); every journey uses it. |
| R34 | Shortlisted photo IDs. [Client selection state] | Already answered by the PRD | The PRD specifies this state field (§5) and Journeys B and D exercise it. |
| R35 | Editing note per photo. [Client selection state] | Already answered by the PRD | The PRD specifies this state field (§5) and Journeys B and D exercise it. |
| R36 | Selection status: Draft or Submitted. [Client selection state] | Already answered by the PRD | The PRD specifies this state field (§5) and Journeys B and D exercise it. |
| R37 | Submission timestamp, when submitted. [Client selection state] | Already answered by the PRD | The PRD specifies this state field (§5) and Journeys B and D exercise it. |
| R38 | light returns Window Light and Last Light, not Golden Hour. [R2 — Search] | Already answered by the PRD | R2's own example; Journey A (search WINDOW) and the example itself say exactly what to check. |
| R39 | WINDOW returns Window Light. [R2 — Search] | Already answered by the PRD | R2's own example; Journey A (search WINDOW) and the example itself say exactly what to check. |
| R40 | mountain produces no results. [R2 — Search] | Already answered by the PRD | R2's own example; Journey A (search WINDOW) and the example itself say exactly what to check. |
| R41 | No-results state offers a clear way to clear search. [R2 — Search] | Already answered by the PRD | R2's own example; Journey A (search WINDOW) and the example itself say exactly what to check. |
| R43 | No duplicate selections. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R44 | Count updates everywhere. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R45 | Maximum five selected photos. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R46 | Attempting to add a sixth does not remove or replace an existing selection. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R47 | Explain the limit through accessible feedback. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R48 | Removing a photo permits another to be added. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R49 | Selection status must not rely on color alone. [R5 — Shortlist behavior] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it (except R49, whose step must write one). |
| R50 | Save locally without a separate Save button. [R6 — Editing notes] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R51 | Show a character count. [R6 — Editing notes] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R52 | Notes remain attached when a photo is removed from the shortlist. [R6 — Editing notes] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R53 | Reopening a photo restores its note. [R6 — Editing notes] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R54 | Submission includes notes for selected photos only. [R6 — Editing notes] | Already answered by the PRD | Explicit behaviour in R5/R6; Journeys B and C exercise it, and v1's step had tests for it. |
| R55 | With fewer than five, explain how many more are needed. Mouse or keyboard interaction must not submit. [R8 — Submission eligibility] | Already answered by the PRD | Explicit (R8); Journey D step 1 checks it. |
| R56 | Reloading after submission must not unlock selection. [R11 — Persistence] | Already answered by the PRD | Explicit (R11); Journey D step 7 checks it. |
| R57 | Directly opening a valid photo route displays that record. [R12 — Navigation and identity] | Already answered by the PRD | Explicit, testable behaviour (R12) with v1 step tests. |
| R59 | Browser Back and Forward work. [R12 — Navigation and identity] | Already answered by the PRD | Explicit, testable behaviour (R12) with v1 step tests. |
| R60 | Photo opened from grid is the same record displayed in detail. [R12 — Navigation and identity] | Already answered by the PRD | Explicit, testable behaviour (R12) with v1 step tests. |
| R61 | Switching photos must not carry one photo’s note into another. [R12 — Navigation and identity] | Already answered by the PRD | Explicit, testable behaviour (R12) with v1 step tests. |
| R62 | Warm off-white background. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R63 | Near-black text. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R64 | Muted cobalt accent for primary actions and selected states. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R65 | Fine borders and restrained corner rounding. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R66 | Generous whitespace and clear typographic hierarchy. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R67 | Minimal chrome around photography. [Concept: Editorial contact sheet] | Introduced by the builder | A visual-direction line; the PRD's §11 says layouts are reviewed. FlowCode made it a coded step and then asked for a journey. |
| R72 | Title and selection status. [My Selection composition] | Introduced by the builder | A composition line for My Selection (§7); a layout to review, made a coded step needing a journey by FlowCode. |
| R73 | Selected photos and notes, or empty state. [My Selection composition] | Introduced by the builder | A composition line for My Selection (§7); a layout to review, made a coded step needing a journey by FlowCode. |
| R74 | Selection progress and submission action. [My Selection composition] | Introduced by the builder | A composition line for My Selection (§7); a layout to review, made a coded step needing a journey by FlowCode. |
| R124 | Desktop and phone layouts reviewed. [11. Verification and completion criteria] | Introduced by the builder | A completion criterion ("Desktop and phone layouts reviewed"), a review activity, not a feature; FlowCode asked for a journey. |
