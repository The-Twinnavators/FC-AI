# Approval-workflow repair (after eval 5)

**Scope (authorized):** a bounded repair of the plan approval workflow.

**Not done:**
- no planner rewrite;
- no dependencies;
- no motion phases 3–4;
- no evaluation run.

Eval 5 stays paused, untouched; its terminal state is reported separately, when it actually stops.

**Recording:** `approval-revision-flow.webm` (15 s, desktop 1280×800, test daemon with a scripted planner). It shows:
1. plan version 1 in the step review;
2. Request changes;
3. version 2 with its revision outcome;
4. a look edit and a status colour picked inside the card;
5. Approve, refused until the unconfirmed edits are answered;
6. "Use my edits";
7. the acknowledgement, with late presses doing nothing;
8. the install permission opened on purpose, arming before its buttons work.

## What changed

1. **Request changes, before execution, within the same build.**
   - Every proposed plan is a version with a content hash (`orchestrator/planReview.ts`, setting `planVersions:<run>`).
   - Request changes is refused once any step has started, while planning, or after the deadline. When it's allowed:
     - the waiting approval becomes **superseded** and can't be decided again;
     - the version keeps the request;
     - the request reaches the existing planner through the run's constraints;
     - the next version needs a **fresh approval**.
   - The new version records its outcome: steps added, removed and kept; risk; the number of decisions for you. The card shows it, and earlier versions are kept.
   - Endpoints: `POST /runs/:id/plan/request-changes`, `GET /runs/:id/plan/versions`.
2. **Approval bound to the exact plan version and the selected Look.**
   - The decision must carry the plan version and hash, the gate (`kind: "plan"`) and the look version it was shown. A superseded, changed or different-version plan is refused with a reason.
   - Unconfirmed look edits need an explicit choice: use the edits (they're selected, then approved), discard them, or go back to editing. The daemon refuses an approval without one. A logged warning is no longer the only safeguard.
   - The binding is recorded (`planApproval:<run>`): plan version, hash, look version and choice.
   - The direct `POST /runs/:id/plan/approve` goes through the same checks.
   - Rejected decisions are no longer logged as "Approved" (the log is written after the checks).
3. **Unmistakable outcomes and gates.**
   - After approving, the pop-up shows an acknowledgement ("Plan version 2 approved. The build has started.", plus the look it was bound to), at the same size and place as the review. The next decision opens only through "Review the next decision". Late presses where Approve was land on empty space.
   - The next gate is labelled as an **execution permission** (for example "Execution permission: install dependencies"), and its buttons arm after 1.2 s.
   - Every decision carries its gate kind, and the daemon refuses one meant for another gate.
   - A persistent status line under the build's request shows "Plan version N approved 10:06 · look version 1", "Revising plan version N…", or "waiting for your approval".
   - The phone approvals page can no longer approve a plan, because it can't show the version or look; deny still works there.
4. **A wider, step-based review.**
   - Up to 1,200 px wide, with steps **Scope → Look and layout → Permissions → Review and decide**.
   - The left column shows the steps with their state and a summary of what approving binds to (plan, look, Home layout).
   - **Scope:** the goal, the revision outcome, decisions for you, requirement counts (built, sign-off, not in this release) and build steps with their acceptance tests. The full plan text stays available.
   - **Permissions:** what approving allows, and what is still asked separately.
   - **Actions:** Approve (naming the version), Request changes and Deny are always in the footer.
   - Narrow windows stack the steps into a row.
5. **Colour drafts and the picker.**
   - **Drafts with one status colour now save.** The draft schema required all four status colours (zod 4 `z.record` with enum keys); it's now `z.partialRecord`.
   - **The scrolling issue, reproduced first.** The picker opened below and left of the card's scrolling area (picker at x 80–328, y 659–915; card body at x 170–930, y 94–652). A press on the colour square actually hit the backdrop (`elementFromPoint` → `DIV.modal-scrim`), which dismissed the whole card.
   - **Picker fix:** it now measures the area that scrolls around it and opens fully inside, left or right and below or above, scrolling itself into view once on short windows. Verified: a press lands on the square, the scroll position is unchanged and the card stays.
   - **Second defect found and fixed:** Escape inside the picker closed the entire approval pop-up. The pop-up now lets an open popover handle Escape first.
   - **Also:** the card shows the daemon's own refusals as written, instead of a generic error.

## Tests

- **`plan-review.test.ts`** (6, through the API):
  - versions and hashes;
  - Request changes: old version kept with the request, re-planned, fresh approval, the outcome recorded;
  - superseded, changed and stale-version approvals refused;
  - the right version approved and bound;
  - unconfirmed edits refused without a choice; use edits binds the new look version; discard keeps the selected look;
  - a look changed since review refused;
  - wrong-gate decisions refused both ways;
  - Request changes refused after a step started;
  - a single status colour saves.
- **`approval-review-ui.test.ts`** (2, real UI):
  - the whole flow above, including the picker inside the card, keyboard on the colour square, the forced look choice, the acknowledgement and late presses not deciding the install permission, and the gate arming;
  - short (1024×560) and narrow (700 px) windows with the actions in view, and every step reachable by keyboard.
  - Run 3 times: passed each time.
- **`approval-look-ui.test.ts`:** updated to the step layout; still passes.
- **`mobile-approvals.test.ts`:** a plan can't be approved from the phone.
- **Full suites:**
  - daemon 1,624 passed;
  - browser files one at a time: 88 passed across 17 files;
  - typechecks: contracts, daemon, UI and 206 library pieces.

## Remaining limitations

- **The revision reaches the planner as a constraint**, the existing input. The screen decision and the app model don't see it directly, so a revised plan can still miss part of a request. The card says so, and shows the outcome for the person to check.
- **No diff of individual step contents between versions:** only steps added, removed and kept, by title, plus risk and decisions.
- **Plan approvals are only possible on the plan card** (the workspace pop-up and the Approvals page). The phone can only deny them.
- **Every pending decision's buttons arm after 1.2 s.** This applies to every gate shown by this card (not only after a plan), by design.
- **Coverage:** Chromium only, through Playwright; no screen-reader check of the step review or the acknowledgement.
- **The plan card also appears in the run panel**, as before, besides the pop-up. Both copies stay consistent through the daemon.

## Planning defects from eval 5: separate findings, not addressed by this repair

From the owner's review of the eval-5 plan (`docs/reliability/eval5/plan.json`, `REVISION-REQUEST.md`). This UI repair gives a way to request the corrections; it doesn't make the planner produce them.

1. **Scope expansion beyond the PRD and brief:** library capabilities (working lists, ratings, comments, sharing, store management) added to a slice whose core is Home → Search → Product → Save → Saved.
2. **Home classification:** the App Storefront / marketing-page contradiction, and marketing parts (hero, CTA banner, footer) not justified by the screen brief.
3. **Acceptance tests** that assert internal screen identifiers or descriptive placeholder phrases as visible text, instead of real records, fields, navigation, saved membership, removal and persistence.
4. **No complete save journey:** visitor and member start states, search, result, product, save (or sign in), Saved, reload, unsave. R6 and R17 were left as scope decisions.
5. **Contradictory state ownership:** parallel state in `store.ts`, `lookup.ts` and `src/sim`, and product detail routes in primary navigation.
6. **The Look wasn't presented on the card as a proposed direction.** This repair now shows the look and its version on the card, but it doesn't make FlowCode propose one.
