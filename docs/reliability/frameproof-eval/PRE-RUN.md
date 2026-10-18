# Frameproof end-to-end evaluation: pre-run record

**What this is:**
- A different PRD (`Frameproof-PRD.md`, copied unchanged from the owner's Downloads; its SHA-256 is in `freeze.json`) is the only source of truth.
- It's separate from Clean Cart, whose failed evaluations and evidence stay as they are.
- Passing this says nothing about the Clean Cart failure.

## Code under test

**Commit:** `8d0a72d`. It is compiled into `packages/daemon/dist-v3` and run as its own daemon:
- port 7463;
- empty data directory `.flowcode-frameproof`;
- no project, design state, concept, scope or revision from any earlier run.

**Changes since 0e47443:**
- **a2b1bfa, the planning-pipeline repair.** A deterministic scope from the PRD (non-goals, supporting data, declared navigation) and revision requests reaches every planning stage. Also:
  - app home page type, with no marketing funnel in an app;
  - tests split into exact text, outcomes and screen names;
  - the complete save journey for apps with a saved page;
  - data owners named;
  - the Look status stated;
  - explicit plan checks.
- **8d0a72d, new for this run.** The planner's replies during planning are kept per run (`planningReplies:<runId>`):
  - each stage's request and reply;
  - secrets redacted, capped at 30k/60k characters;
  - with a test.
  - Disclosed here as the only code change made for this evaluation. It records; it doesn't change what is planned or built.

## Known relevant limitations (found offline from this PRD, before any model call)

1. **The 12 photo records aren't recognised as the PRD's sample data.**
   - FlowCode looks for a sample-data heading, and this PRD's is "Data model and sample content".
   - So the sample-record step isn't given the exact table, and the completeness check won't insist on those 12 titles.
   - The model sees the full PRD only in the structure request.
   - **Risk:** invented or altered photo records, which would break R2, R3 and the journeys (Window Light, seven Outdoor, five Studio).
2. **Supporting data.** The Gallery fields and the photo-record lines (R17–R33) are classed as supporting data: held by the app model, not build steps. "Client selection state" stays a feature.
3. **The declared navigation isn't parsed.** The list is numbered ("1. Gallery. 2. My Selection"), so the scope records no declared navigation. This only matters to look-up apps; the screen check still accepts a "Gallery" page.
4. **An app of records gets list, create and detail pages per kind of record.** A "new photo" page would contradict "no photo upload". If it appears in the plan, it will be reported, not hidden.
5. **Scope-note defect suspected in Clean Cart validation 2.** The scope note may lead the app-model stage to drop data that a look-up app needs. This PRD is unlikely to be planned as a look-up app. If the app model is rejected, the recorded replies now show why.
6. **Capability words only affect look-up apps.** The scope marks "categories" and "likes" as asked for (category filters; "favorites"), and ratings, comments and sharing as deferred.
7. **PRD size and planning time.** 140 requirement lines are extracted (127 go to the planner in batches), so planning will be longer than Clean Cart's.

## Configuration

**Models:**
- Planner, coder and debugger: pinned on the run to qwen3-coder:30b at temperature 0.1 (as in eval 5 and both validations).
- Support roles: copied from the main daemon (qwen3:14b; critic qwen2.5vl:3b).
- Runtime options: copied from the main daemon (standard GPU profile, no automatic retry, visual critic off).
- Exact values, and the Ollama model digests, are in `freeze.json`.

**Run settings:**
- Supervised project.
- Spec build, complete mode.
- No deadline.
- The coder's capability probe runs automatically when execution first starts (that is FlowCode's normal behaviour).

## Procedure

PRD → plan → Look review → **your** approval → installation permission (**yours**) → generation → verification → running-app review.

- Claude presses no approval and no permission.
- Normal agent retries and repairs are recorded from the run's events.
- If the run is blocked, the evidence is kept and the failure reported; no restart, no builder patch.
