# Planning-only validation 2 (a2b1bfa): planning blocked before a plan existed

**What this is:**
- One authorized planning-only run with the real planner.
- Same Clean Cart brief, PRD and pinned models as the first validation: qwen3-coder:30b at 0.1 for the planner, coder and debugger.
- The recorded revision feedback was ready in `revision-feedback.txt`.
- It's a new run: not a continuation of eval 5 or of the first validation.

**Setup:**
- A separate daemon on port 7462, built from a2b1bfa into `packages/daemon/dist-v2`.
- Its own data in `.flowcode-validation-2`.
- The other daemons and their `dist/` were untouched.

## Result

**Planning blocked at the first stage, the app model.**
- Run: `run_00ebcbf990c7462c8a25`, at 12:42:42Z, 48 s after it started.
- Planner calls: 2 (structure 39.4 s, then a 7.3 s follow-up), none failed.
  - 3,101 prompt tokens and 875 output tokens.
  - One cold load (19.0 s).
- Planner context: 8k.

**FlowCode's reason:**

> The app model for the complete app isn't usable: Only 0 sample products; Only 0 sample stores; Products have no category (a select field); The look-up app's lookup section isn't usable.

**Consequences:**
- No plan version was proposed, so there was nothing to review and the revision feedback could not be submitted.
- The six corrections can't be checked against a plan: none was produced.
- Nothing was retried, approved, installed or generated.
- The builder was not patched during the run.

## Likely cause: a defect in a2b1bfa (inferred; the model's reply wasn't recorded)

**What the stage was told:**
- `v1-blocked/app-model-request.txt` is the app-model request, rebuilt offline from the a2b1bfa build with the run's own inputs. It is 5,999 characters, matching the run's recorded 6,000-character first prompt.
- New in a2b1bfa, the request includes the scope note:
  - "Deferred … a store finder (choosing a place by ZIP code…)";
  - "Left out … a Categories page (browsing by category)".

**What the look-up app model needs:**
- A category select field on the products.
- A places entity with ZIP-code areas (it is the supporting data: "Which stores carry it", "Stores: Name, ZIP code").

**What came back:**
- Exactly those were missing: no category select field, an unusable lookup section and no stores.
- The 7-second follow-up fits FlowCode's separate ZIP-areas request, which it makes when the structure has no usable areas.

**Comparison with the first validation:** on 0e47443, the same model and inputs, without the scope note, produced a usable structure twice.

**Why the replay didn't catch it:** the replay test fed back the captured app model whatever the prompt said. It couldn't see how the scope note changes the model's answer.

**What the defect is:**
- The scope note doesn't distinguish leaving out a *page or feature* from removing the *data* the app needs.
- The PRD's own "Records" section keeps stores and categories as data.

This is an inference from one run. Proving it would need another model call, which isn't authorized.

## The disclosed mismatches

Layout, test data and capabilities could not be assessed: no plan, brief or tests were produced.

## Evidence

- `freeze.json`: commit a2b1bfa, the daemon build, the PRD hash, the roles, runtime options, model digests and the pinned models.
  - The daemon-level default planner differs from the first validation daemon's (qwen3:14b vs qwen3:8b), but the run pins the planner, so the default isn't used.
- `v1-blocked/`:
  - the run, events, models, performance, deadline and stop report;
  - `raw/`: the run's scope, inputs and model selection;
  - `app-model-request.txt`.
- Scripts:
  - `setup.mjs`, `export.mjs`, `export-raw.mjs`: as in the first validation, pointed at 7462;
  - `app-model-request.mjs`;
  - `inspect.mjs`: prepared for plan inspection, unused.
