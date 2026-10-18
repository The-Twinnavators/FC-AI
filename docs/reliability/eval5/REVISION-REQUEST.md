# Eval 5: the owner's revision request (received after the plan approval had already registered at 10:06:01Z)

Recorded as given. It couldn't be applied through the existing workflow; see `STATUS.md`.

1. **Reconcile the scope with the original PRD and creation brief.** Clearly distinguish required slice behaviour, supporting data, deferred features and generic library capabilities.
   - The required core is Home → Search → Product → Save → Saved, including visitor sign-in behaviour, unsave and persistence.
   - Don't silently remove PRD requirements, but don't add working lists, ratings, comments, sharing or store-management experiences merely because the library supports them.
2. **Correct Home's classification.** Treat it as a branded consumer product-discovery homepage with search, featured products and access to Saved. Resolve the App Storefront / marketing-page contradiction, and justify any marketing hero, CTA banner or footer against the actual screen brief.
3. **Correct the acceptance tests.**
   - Don't require internal screen identifiers or descriptive placeholder phrases as visible text.
   - Verify actual product names, fields, navigation, saved membership, removal and persistence using the app's real records.
4. **Add the complete save journey:** Home search → matching result → product detail → save (or sign in if needed) → Saved contains that product → reload preserves it → unsave removes it.
   - Specify the visitor and signed-in member starting states.
   - R6's homepage content can be checked on its own and at the start of the Home journey. R17 must be covered by the complete save journey.
5. **Resolve state ownership and implementation conflicts.**
   - Name the authoritative product store and saved-state persistence layer, with no parallel state in `store.ts`, `lookup.ts` and `src/sim`.
   - Don't put each product detail route into primary navigation.
   - Clarify how design may compose the approved screens without duplicating data or replacing working behaviour unnecessarily.
6. **Present the actual Look for review.** The card says no brand direction is selected. Show the proposed direction, surface, Home composition and Balanced motion setting, with Expressive features off.

**Constraints:**
- Use only the existing plan-revision workflow.
- Don't change builder code, prompts, templates, models or tests during this measured run.
- Record the request and the time spent awaiting approval.
- If the workflow can't revise the plan, stop and report the limitation rather than restarting or patching around it.
