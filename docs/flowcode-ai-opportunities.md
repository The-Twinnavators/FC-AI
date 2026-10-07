# FlowCode: product, workflow and UX analysis — AI and automation opportunities

_6 October 2026. Based on the current code (daemon, UI and Copilot) and on what the No BIO & GMO, Calendar and Calculator builds showed over the last week._

## 1. Who uses FlowCode and where it hurts

**Primary user: a product owner or designer-founder.**
They bring a PRD or an idea and want a clickable, good-looking prototype without writing code. They are not watching logs. They check in from the dashboard, the phone view or the Copilot, and they judge the result mostly on **how it looks** and **how long it took**.

**Secondary user: the same person acting as a reviewer.**
They answer approvals, give design feedback, request follow-up changes and decide when to hand off (Launch readiness).

### Recurring tasks and decision points

| Stage | What the user does | Decision point | Observed friction |
|---|---|---|---|
| Start | Writes or pastes a PRD, attaches style references, picks autonomy and models | Local or cloud, which style, how hands-on | Same choices re-entered every build. Model choice has no cost or speed preview. |
| Plan | Approves the prototype plan (Supervised/Assisted) | Is the plan complete? | Hard to see which screens are missing or duplicated (e.g. the "Brand list" tab duplicated "Find brands"). |
| Build | Waits and checks progress | Is it stuck? Should I intervene? | A build ran for 3+ hours with step 20 "stuck". The ETA promised 15 minutes and was wrong. A local 30B model at 32k context runs about 72% on the CPU of an 8 GB GPU. |
| Exceptions | Answers approvals and retries blocked steps | Approve, retry, change PRD | One approval waited 2 hours unnoticed. Blocker text is written for the agent ("write the acceptance tests first"), not for the person. |
| Design review | Looks at screenshots and asks for changes | Is this good enough? | "Same AI slop" after several rounds. Visual critique is silently skipped when the cloud has no credit. |
| Follow-ups | Requests targeted changes | What exactly to change, and what must not change | Change requests are typed by hand. Element-level picking exists in the dev tooling, not in FlowCode. |
| Ask | Uses Copilot to understand state | Trust the answer? | **Copilot answered wrongly** (see below). |

### Why the Copilot answer in the screenshot was wrong

Traced in `packages/daemon/src/api/copilot.ts`:

1. **Stale conversation beats live state.** The page was showing the No BIO & GMO run, but the answer described the Calculator run. The last 8 chat turns (`ask.history.slice(-8)`) are sent after the BACKGROUND block. Earlier Calculator answers in the history outweigh the current run.
2. **Agent-facing text relayed as user instructions.** Each step's `blocker.reason` / `nextAction` is copied into BACKGROUND verbatim. That text is addressed to the coding agent ("write the acceptance tests first"). The Copilot passed it on to the person as "you need to write the tests", but FlowCode writes those tests itself.
3. **Settings tuned for creativity, not fact.** The default answer uses temperature 0.7 on the small local "documenter" model. Factual run questions need ~0.1, and ideally a stronger model.
4. **"Sir" by default.** `copilotProfile.ts` falls back to `address: "Sir"` when the user never set one. The default should be no form of address.
5. **No grounding check.** Nothing verifies that the run, step and file names in the answer exist in BACKGROUND before it is shown.

---

## 2. Group 1 — Quick wins (current app performance and quality)

### Q1. Grounded Copilot run answers
1. **Experience:** Grounded run answers ("What's happening with this build?").
2. **Problem:** The Copilot answers about the wrong run and turns agent instructions into user chores, which erodes trust in the one place the user goes to understand state.
3. **AI behaviour:**
   - Build a structured run summary (project, run, status, the active or blocked step, attempts, and a *user-facing* next action) and put it **last**, after history, marked "authoritative".
   - Drop history turns that mention a different run.
   - Answer run questions at temperature 0.1.
   - Post-check the answer: any step, file or project name it mentions must appear in the summary; otherwise regenerate or fall back to a deterministic template.
4. **Trigger → response:** "What's happening with this build?" →
   > "No BIO & GMO finished at 14:02. All 24 steps passed and the design check found 0 issues. The visual critique was skipped because the Anthropic credit ran out. Next: top up the credit or switch the critic to local, then run Polish."
5. **Inputs:** `liveState`, the task blockers mapped through a user-facing action table (Q8), and the route's runId.
6. **Human point:** None — read-only. "Show me" links open the step.
7. **UI:**
   - A status card at the top of the reply (run, status, step, ETA) with the prose below it.
   - A small "based on run X" footnote and a "That's wrong" button that logs the miss.
8. **Value:** Removes wrong guidance; fewer pointless retries; the user trusts Copilot instead of asking a developer.
9. **Risk:** Templates can feel robotic. Keep the prose, but ground the facts.
10. **Effort:** Low.
11. **Priority:** Now.

### Q2. Honest ETA and stall detector
1. **Experience:** "Is it stuck?" answered before it is asked.
2. **Problem:**
   - Builds run 1–3+ hours on local models, and estimates were off by about 10×.
   - The user cannot tell slow from stuck.
3. **AI behaviour:**
   - Estimate time per step from recorded history for the same model, context size and step type (tokens/s × expected tokens × attempts).
   - Flag a stall when there is no file change, test run or tool call for N× the median step time, or when the GPU offload is above 50%.
4. **Trigger → response:** On every step change, the ETA updates with a range ("40–70 min left, local qwen at ~6 tok/s"). On a stall, a banner says "Step 20 has made no change for 18 min (3 retries of the same test)", with buttons Retry with cloud / Skip / Pause.
5. **Inputs:** Event log, `checks`, model throughput (Ollama `eval_count`/`eval_duration`), GPU offload from `ollama ps`.
6. **Human point:** The user picks the recovery option. Autonomous mode may auto-retry once.
7. **UI:** The ETA chip in the top bar and on project cards (next to the existing BuildTimer). A stall banner in the builder and a phone notification.
8. **Value:** Turns hours of silent waiting into minutes. Sets honest expectations, so "you said 15 mins" doesn't recur.
9. **Risk:** Early estimates are noisy. Always show a range and the basis ("based on 12 earlier steps").
10. **Effort:** Low–Medium.
11. **Priority:** Now.

### Q3. Approval inbox with explain, batch and escalate
1. **Experience:** One inbox for everything waiting on the user.
2. **Problem:**
   - 6 approvals are pending.
   - One blocked a build for 2 hours.
   - Each approval is a raw action string (an `mcp:` tool, run_command, a file move).
3. **AI behaviour:**
   - Each approval gets a one-line plain explanation, a risk level (read-only, workspace edit, outside workspace, network, spend) and a recommendation.
   - Low-risk approvals of the same kind can be approved together.
   - Unanswered approvals escalate: a phone push at 5 min; at 30 min, a cheaper alternative path where one exists (e.g. run_script instead of run_command).
4. **Trigger → response:** An approval appears → inbox badge plus "Move BrandListScreen.tsx into src/screens (workspace edit, low risk). Recommended: approve."
5. **Inputs:** The approvals store, the tool registry's risk metadata, persistKey history ("you approved this 4 times before").
6. **Human point:** Always the user's. Batch approval only within the same risk tier; never batch spend or outside-workspace actions.
7. **UI:**
   - A right-side drawer with groups (This build / Other builds / Enhancements), Approve / Deny / Ask Copilot buttons, and keyboard shortcuts.
   - On mobile: swipe to approve low-risk items.
8. **Value:** Removes the largest idle-time source in autonomous builds.
9. **Risk:** Over-trusting batch approval. Show the exact action on expand and keep the audit trail (H7).
10. **Effort:** Low–Medium.
11. **Priority:** Now.

### Q4. Model-fit preflight
1. **Experience:** "This model will be slow on your machine."
2. **Problem:** qwen3-coder:30b at 32k on an 8 GB GPU spills ~72% to the CPU. Builds take hours and the user only learns that by waiting.
3. **AI behaviour:**
   - Before a build, estimate VRAM fit from the model size, quantisation and num_ctx, and run a 10-second speed probe.
   - Recommend a fitting setup, e.g. "qwen3-coder:30b at 16k fits 60% on GPU, ~2× faster", a smaller coder for routine steps, or cloud for design steps.
4. **Trigger → response:** Clicking Start build with a slow setup shows an inline card: "Expected 2–3 h. Faster options: …"
5. **Inputs:** `ollama show`, `ollama ps`, GPU memory, earlier throughput.
6. **Human point:** The user picks. FlowCode never switches to a paid model on its own.
7. **UI:** Step 4 of New build (models), with a speed/cost/quality triangle per option.
8. **Value:** Saves hours per build and avoids GPU out-of-memory failures at planning.
9. **Risk:** Hardware probes vary. Label them as estimates.
10. **Effort:** Low.
11. **Priority:** Now.

### Q5. PRD missing-data linter
1. **Experience:** PRD check before planning.
2. **Problem:**
   - Vague PRDs produce generic screens and duplicate routes.
   - Missing content forces the model to invent data, and invented data looks like slop.
3. **AI behaviour:**
   - Score the PRD against a rubric: users, primary job, list of screens, data entities with sample records, tone and brand, must-not-do items.
   - Highlight gaps and offer to fill each from context (earlier projects, the attached JSON, a website style capture).
4. **Trigger → response:** On upload or paste: "Missing: sample data for Brand (name, certification, photo); no detail screen described. [Generate 12 sample brands] [Add detail screen]."
5. **Inputs:** PRD text, the attached JSON and images, the Knowledge Hub, PRD templates.
6. **Human point:** The user accepts or edits each suggested addition before planning.
7. **UI:** An inline checklist beside the PRD in New build step 1, using the same pattern as Launch readiness.
8. **Value:** Better plans on the first pass, fewer follow-up runs and less rework.
9. **Risk:** Over-nagging. Only block on the 2–3 gaps that most affect the result; the rest are advisory.
10. **Effort:** Low.
11. **Priority:** Now.

### Q6. Predictive quick-fill in New build
1. **Experience:** "Same as last time" defaults.
2. **Problem:** Every build re-asks for autonomy, models, research on/off, style, hosted consent and design model, and the user usually picks the same values.
3. **AI behaviour:**
   - Pre-fill from the user's last 3 builds and the project's settings.
   - Suggest a style from earlier projects in the same domain (food, productivity), and explain each pre-fill on hover.
4. **Trigger → response:** Opening New build → all four steps arrive pre-filled with "from Calendar prototype" tags. One click starts the build.
5. **Inputs:** Project settings history, the user profile, model assignments.
6. **Human point:** Nothing is applied silently that costs money. Hosted consent is always re-confirmed per project.
7. **UI:** Ghost-filled fields with a small "suggested" tag and a "Reset to blank" link.
8. **Value:** Cuts New build from about 4 minutes to about 30 seconds, and fewer misconfigurations such as research left off.
9. **Risk:** Silently carrying over a costly setting. Spend settings stay explicit.
10. **Effort:** Low.
11. **Priority:** Next.

### Q7. Route coverage and duplicate-screen check
1. **Experience:** Plan sanity check.
2. **Problem:**
   - Design steps covered only some routes, so the detail page stayed basic.
   - A duplicate "Brand list" tab shipped.
3. **AI behaviour:**
   - After planning and after each design step, list the app's routes and screens.
   - Flag routes with no design step, and screens whose component tree or screenshots are more than 80% similar.
   - Add the missing design steps to the plan automatically (shown as plan diffs).
4. **Trigger → response:** On plan approval: "2 screens have no design step (Brand detail, Settings). 'Brand list' duplicates 'Find brands'. [Merge] [Keep both]."
5. **Inputs:** Router file, layout recipes, screenshots (perceptual hash), the plan.
6. **Human point:** The user confirms merges. Adding design steps is automatic in Autonomous mode.
7. **UI:** A plan-review panel with a route map thumbnail grid. Uncovered routes are greyed out.
8. **Value:** Directly addresses "subpar" secondary screens.
9. **Risk:** False duplicates, such as list and grid variants. Keep the threshold conservative.
10. **Effort:** Low–Medium.
11. **Priority:** Now.

### Q8. Blocker translator with next best action
1. **Experience:** "What do I do now?" for every blocked step.
2. **Problem:** Blocker text is written for agents (e.g. "contradictory test, re-read file"). Users either retry blindly or read wrong guidance through Copilot.
3. **AI behaviour:**
   - A fixed table from blocker category to user explanation and 1–3 actions: retry with the same model, retry with cloud, edit the PRD line, accept as is, or "nothing — FlowCode will retry".
   - The model only fills in names. It never invents actions.
4. **Trigger → response:** A step blocks → the card shows "The tests for the keypad step don't exist yet. FlowCode writes them first on the next try — nothing for you to do. [Retry now]".
5. **Inputs:** `task.blocker.category`, fix memory (similar earlier fixes), recovery history.
6. **Human point:** Retry with cloud (spend) needs confirmation.
7. **UI:** A blocked-step card in Details and the Activity tab. The same text feeds Copilot (Q1).
8. **Value:** Fewer wrong interventions and faster recovery.
9. **Risk:** The table needs maintenance as new categories appear. Log unmapped categories.
10. **Effort:** Low.
11. **Priority:** Now.

---

## 3. Group 2 — High-value workflow improvements (product or integration work)

### H1. Split the design and build roles: a design-spec step
1. **Experience:** "Cloud designs, local builds".
2. **Problem:**
   - Local models produce generic UI (the "AI slop" complaint).
   - Cloud for everything is costly, and the credit ran out mid-project.
3. **AI behaviour:**
   - A design-spec step runs once per screen on the strongest available model (Sonnet). It uses the research references and outputs a structured spec: layout grid, components, tokens, copy, states and image needs.
   - Local or cheaper models (qwen, Haiku) implement against that spec.
   - The visual critic compares the screenshot to the spec.
4. **Trigger → response:** On plan approval → "Designing 6 screens with Claude (~$0.40), building with local qwen." Each spec is previewable before code is written.
5. **Inputs:** PRD, design research, style capture, Figma (MCP) if linked, a budget cap.
6. **Human point:** The user approves the specs in Supervised/Assisted modes. The budget cap is set by the user.
7. **UI:** A "Design specs" tab per screen (wireframe plus tokens plus copy) with "Approve all" and per-screen comments.
8. **Value:** Most of the design-quality gain for about 10–20% of the full-cloud cost. Cheaper coders work faster with a precise spec.
9. **Risk:**
   - The spec and the code drift apart; mitigate with a spec-fidelity check (it already exists as `spec_fidelity`).
   - Credit exhaustion mid-run; mitigate with a preflight balance check and graceful fallback.
10. **Effort:** Medium.
11. **Priority:** Now (highest-impact design item).

### H2. Step-level model routing by difficulty
1. **Experience:** Right model per step.
2. **Problem:** One coder model does everything, so boilerplate is slow on a large local model and hard design and debug steps are weak on a small one.
3. **AI behaviour:**
   - Classify each step (scaffold, wiring, styling, debugging, design, tests).
   - Route by policy: a small fast local model for scaffold and tests, the large local model for wiring, cloud for design and for a third failed attempt.
   - Learn from verified-on-first-try rates per model and category.
4. **Trigger → response:** On planning: "Routing: 14 steps local-small, 7 local-large, 3 cloud (est. $0.60, 55 min)." Escalation reason shown at a step: "Escalated to Claude after 2 failed attempts".
5. **Inputs:** Model lab results, fix memory, the cost ledger (H6), throughput (Q2).
6. **Human point:** The user sets the policy and spend cap. Escalation to paid models respects the cap.
7. **UI:** A Models page "Routing policy" table, plus a per-step model chip in the builder.
8. **Value:** Shorter builds (big local models only where they matter) and fewer failed retries.
9. **Risk:** Hidden cost creep. Use a hard cap and per-run cost display.
10. **Effort:** Medium.
11. **Priority:** Now.

### H3. Document and design extraction into a structured PRD and data
1. **Experience:** "Drop anything, get a PRD".
2. **Problem:** Users have PDFs, Docs, Figma files, screenshots of competitor apps and spreadsheets of products. Today they rewrite them into a PRD by hand.
3. **AI behaviour:**
   - Extract entities, screens, flows and sample records from PDF, DOCX, XLSX/CSV, Figma frames (MCP) and screenshots (vision, plus markitdown MCP).
   - Produce a PRD draft and simulation-data JSON with the source of each section.
4. **Trigger → response:** Drop a file into New build or Create PRD → "Found 5 screens, 3 data types, 42 product rows. Draft PRD ready — 2 sections need your input."
5. **Inputs:** markitdown, Figma and playwright MCPs (already presets), vision models.
6. **Human point:** The user reviews the PRD draft; extracted rows are previewed before becoming sim data.
7. **UI:** A split view — source on the left, the extracted PRD with source highlights on the right.
8. **Value:** Hours saved per project, and better data quality (real names and photos instead of invented ones), which directly improves the look.
9. **Risk:** Extraction errors and private documents. Keep extraction local by default; cloud only with consent.
10. **Effort:** Medium.
11. **Priority:** Next.

### H4. Point-and-say change requests in the preview
1. **Experience:** Click an element in the preview and say what to change.
2. **Problem:** Follow-ups are typed in prose ("Two small fixes … change nothing else"), and the model guesses which element is meant, so changes leak into other screens.
3. **AI behaviour:**
   - Selecting an element captures its component, file, line, computed styles and a screenshot crop — the same data the dev tool gives Claude today.
   - Copilot drafts a scoped change request with "files allowed to change" and a guard ("no other files").
   - The change runs as a single-step follow-up.
4. **Trigger → response:** Click the badge and type "move the dot inside" → a draft request: "In ProjectCard.tsx, render the status dot inside the status badge; change nothing else. [Send to builder]".
5. **Inputs:** Preview instrumentation (React owner and source map), Copilot draft mode (exists).
6. **Human point:** The user sends the draft. Results show as a before/after diff.
7. **UI:** A "Pick" tool in the preview toolbar, a comment pin on the element, and a queue of pending tweaks.
8. **Value:** Much faster polish loops and fewer collateral changes. This is how the user already works with Claude in this repo.
9. **Risk:** Scope creep from small models. Enforce the allowed-files list at the tool layer.
10. **Effort:** Medium.
11. **Priority:** Next.

### H5. Run comparison and visual diff
1. **Experience:** "What changed between runs?"
2. **Problem:** The user judges redesigns from screenshots one at a time and cannot see if a follow-up made things better or worse ("same", "subpar").
3. **AI behaviour:**
   - Pair screenshots by route across two runs and show visual diffs.
   - Summarise the change: what improved, what regressed, and the design-QA score delta.
4. **Trigger → response:** On the Runs list, select 2 → "Find brands: new photo grid (+), contrast fixed. Detail page: unchanged. Settings: lost padding (−)."
5. **Inputs:** Screenshot store, design-QA findings, git diff per run.
6. **Human point:** Advisory only. The user can "revert this screen".
7. **UI:** Side-by-side slider per route with a summary rail.
8. **Value:** Faster, more confident design decisions and less re-asking.
9. **Risk:** Image diffs are noisy with animations. Use settled screenshots (the `settled()` wait already exists).
10. **Effort:** Medium.
11. **Priority:** Next.

### H6. Operations dashboard: cost, time, queue, health
1. **Experience:** Workload and spend at a glance.
2. **Problem:**
   - Credit ran out unexpectedly.
   - The user cannot see where time went (planning, model, tests, waiting for approval) or which builds need them.
3. **AI behaviour:**
   - Track per-run time by phase and spend by provider.
   - Alert at 80% of the budget, before the credit runs out.
   - A weekly summary: "Waiting on you cost 3.2 h this week; switching design to cloud would have saved 2 h".
4. **Trigger → response:** Continuous. Alerts arrive via the top bar and phone.
5. **Inputs:** Events, checks, provider usage headers, the approvals store.
6. **Human point:** The user sets budgets and alert thresholds.
7. **UI:** Replace the vanity tiles (steps checked, tool calls) with these:
   - Time to prototype (median);
   - Waiting on you (h);
   - Spend this month vs cap;
   - Builds needing help.
8. **Value:** Faster decisions and no surprise stops. The dashboard becomes actionable.
9. **Risk:** Provider usage APIs differ. Fall back to token counting.
10. **Effort:** Medium.
11. **Priority:** Next.

### H7. Audit trail and decision log
1. **Experience:** Who approved what, and why.
2. **Problem:**
   - A settings change silently reset hosted consent, which caused a cascade undo.
   - There is no timeline tying approvals, settings changes and model switches to outcomes.
3. **AI behaviour:**
   - Log every approval, settings patch (with a diff), model switch and rollback, with actor and reason.
   - Copilot can answer "why did step 12 get undone?" from the log.
4. **Trigger → response:** Automatic. A per-run "Decisions" tab.
5. **Inputs:** The approvals store, the settings route (now patch-only), the orchestrator events.
6. **Human point:** Read-only, with export for handoff.
7. **UI:** A timeline with filters (approvals, settings, recoveries), linked to the steps affected.
8. **Value:** Faster root-cause analysis and accountability for autonomous actions.
9. **Risk:** Log volume. Summarise per run and keep the raw data 90 days.
10. **Effort:** Low–Medium.
11. **Priority:** Next.

### H8. Guided mode for new and infrequent users
1. **Experience:** "First build" coach.
2. **Problem:** The concepts (autonomy levels, Launch readiness, prototype plan, local vs cloud) are dense. Infrequent users forget what Assisted means or where approvals live.
3. **AI behaviour:**
   - A contextual checklist that adapts to the user's state: no PRD → Create PRD; model slow → Q4; plan ready → explain what approving means.
   - Copilot "Show me" steps (they exist) chained into a guided tour.
4. **Trigger → response:** First visit, or 14+ days since the last build → a dismissible coach strip: "3 things changed since your last build…"
5. **Inputs:** Feature catalog (exists), usage history, release notes.
6. **Human point:** None. Dismissible.
7. **UI:** A slim coach bar under the hero, and a "?" on each concept that opens a Copilot explanation.
8. **Value:** Fewer misconfigured builds and faster time to first prototype.
9. **Risk:** Annoyance. Show once and respect dismissal.
10. **Effort:** Low–Medium.
11. **Priority:** Later.

### H9. Fix memory to suggested skills
1. **Experience:** "FlowCode learned this".
2. **Problem:** The same failures recur across projects (render loops, patch-context mismatch). Fixes are recorded, but promotion to a skill is manual and easy to miss.
3. **AI behaviour:**
   - When a fix signature recurs 3 or more times with success, propose promoting it to a skill, with an evidence count.
   - Track whether the skill reduces attempts afterwards; retire it if not.
4. **Trigger → response:** A Knowledge Hub card: "Render-loop fix worked 4/4 times. Promote to a coder skill? [Promote] [Ignore]."
5. **Inputs:** `fixMemory.ts` (exists), skill library, attempt stats.
6. **Human point:** The user promotes. Auto-retire is shown in the audit log.
7. **UI:** The existing "Fixes that worked" shelf, plus a suggestion badge and an effectiveness sparkline.
8. **Value:** Fewer retries over time, and therefore shorter builds.
9. **Risk:** Bad fixes generalised. Require multi-project evidence.
10. **Effort:** Low.
11. **Priority:** Next.

---

## 4. Group 3 — Longer-term agentic capabilities (multi-step, within approval rules)

### L1. Self-healing recovery agent
1. **Experience:** Blocked steps fix themselves within policy.
2. **Problem:** Blocked steps wait for a person even when the fix is known (a contradictory test, a missing file, the wrong npm script).
3. **AI behaviour:**
   - On a block, a debugger agent diagnoses the cause (logs, fix memory, diff) and picks a recovery from an allow-list: correct a contradictory test, rewrite a missing file, swap the model, split the step.
   - It applies the recovery, re-verifies and reports.
4. **Trigger → response:** A step blocks → within 2 minutes: "Recovered: the test expected 12 brands but the sim data has 10; the test was corrected (diff). Step verified."
5. **Inputs:** Recovery history, fix memory, test output, an allow-list policy.
6. **Human point:**
   - Policy-bounded: edits inside the workspace are automatic in Autonomous mode.
   - Changing acceptance criteria, using paid models or touching files outside the step's scope escalates to the user.
7. **UI:** A "Recovered automatically" chip with the diff in the step card. A weekly recovery report.
8. **Value:** Removes most "needs your help" stops and much of the wall-clock time.
9. **Risk:** Weakening tests to pass. Any test change must keep or raise the assertion count and is flagged for review.
10. **Effort:** High.
11. **Priority:** Next → Later.

### L2. Autonomous design-polish loop with references
1. **Experience:** "Polish until it's good".
2. **Problem:** Design improvement needs many manual rounds of screenshot → complaint → follow-up.
3. **AI behaviour:**
   - Loop per screen: research references (exists) → critique against a rubric (hierarchy, density, imagery, typography, brand fit, anti-slop list) → targeted edits → re-screenshot.
   - Stop when the score reaches the threshold, the budget is spent, or there is no improvement over 2 rounds.
4. **Trigger → response:** "Polish design" → after N rounds, a gallery of before/after per screen with scores and the changes made.
5. **Inputs:** Design research, design QA, visual critic (cloud), the anti-slop rules from memory (no thick accent bars, no nested cards, no glass modals).
6. **Human point:** The user sets the budget and rounds, and accepts or rejects per screen at the end.
7. **UI:** A polish run view with a score per screen over rounds, and an accept/revert per screen.
8. **Value:** Consistent design quality without user babysitting.
9. **Risk:**
   - Cost. Use a hard budget.
   - The critic and generator can share blind spots. Use reference images and a different model family as critic where possible.
10. **Effort:** High.
11. **Priority:** Next.

### L3. Night-shift queue with a morning digest
1. **Experience:** "Build while I sleep".
2. **Problem:** Local builds are slow, and the user waits during the day.
3. **AI behaviour:**
   - Queue follow-ups and enhancement approvals to run overnight within the autonomy policy.
   - Pre-approve only low-risk categories.
   - In the morning, a digest: what finished, what needs a decision, screenshots.
4. **Trigger → response:** "Run tonight" on any request → a digest at 8 am on phone and dashboard.
5. **Inputs:** Scheduler, approvals policy, screenshots, the cost cap.
6. **Human point:** Anything above low risk waits for the morning digest. No paid spend without a cap.
7. **UI:** A "Tonight" queue on the dashboard and a digest card.
8. **Value:** Uses idle GPU hours. Feels instant to the user.
9. **Risk:** Runaway jobs. Use time and cost limits and auto-pause on repeated failure.
10. **Effort:** Medium.
11. **Priority:** Later.

### L4. Launch-readiness agent
1. **Experience:** Handoff on autopilot.
2. **Problem:** Moving from prototype to real app means many checklist items: auth, backend, data model, deployment and docs.
3. **AI behaviour:**
   - Work through Launch readiness: choose a backend (the `skill.choose-backend` skill exists), draft the data schema from the sim data, write the handoff README, open a PR (GitHub MCP).
   - Each irreversible or outward-facing step is an approval.
4. **Trigger → response:** "Prepare handoff" → a checklist progressing live, then a PR link and a summary.
5. **Inputs:** Sim data, PRD, GitHub, Supabase or Firebase (connectors exist).
6. **Human point:** Creating repos or projects, migrations, pushes and anything costing money are always approvals.
7. **UI:** The Launch readiness page as a live checklist with agent status per item.
8. **Value:** Days of handoff work reduced to hours.
9. **Risk:**
   - Outward-facing actions; keep strict approvals.
   - Secrets; never handled by the agent.
10. **Effort:** High.
11. **Priority:** Later.

### L5. Portfolio agent
1. **Experience:** Improvements flow to every project.
2. **Problem:** A fix or design upgrade learned in one project (e.g. the photo-card pattern) is not reused in the others.
3. **AI behaviour:**
   - When a new skill or fix is promoted, scan the other projects for the same pattern.
   - Propose follow-up runs that apply it, with a preview.
4. **Trigger → response:** A promoted skill → "Calendar and Calculator have the same render-loop pattern. [Queue fixes for tonight]."
5. **Inputs:** Fix memory, skills, the workspaces.
6. **Human point:** Per-project approval.
7. **UI:** A suggestions list in the Knowledge Hub.
8. **Value:** Compounding quality across projects.
9. **Risk:** Unwanted changes to finished projects. Opt-in only.
10. **Effort:** Medium–High.
11. **Priority:** Later.

---

## 5. Coverage map

| Requested area | Recommendations |
|---|---|
| Predictive quick-fill | Q6 |
| Suggested field values | Q6, Q4, Q5 |
| Document extraction | H3 |
| Task creation, assignment, routing, monitoring | H2, Q2, L3 |
| Missing-data detection and validation | Q5, Q7 |
| Exception detection with next actions | Q8, Q2, L1 |
| Search, filtering, summarisation, comparison | Q1, H5 |
| Drafting support | H4, H3, L4 |
| Guidance for new or infrequent users | H8, Q1 |
| Approvals and audit trails | Q3, H7 |
| Dashboards, alerts, workload | H6, Q2 |
| Design quality (specific friction) | H1, Q7, L2, H5 |
| LLM build time (specific friction) | Q4, H2, Q2, L1, L3 |

---

## 6. Prioritised roadmap — the five highest-impact items

### 1. Grounded Copilot answers (Q1 + Q8)
- **Why first:** Copilot is how the user understands FlowCode. A confidently wrong answer ("you need to write the tests") causes wrong actions and erodes trust in everything else. Cheap to fix.
- **Validate first:** Measure how often answers name the wrong run or step. Replay the last ~50 Copilot questions against stored BACKGROUND snapshots.
- **First experiment:**
  - Move the structured run summary after history, drop other-run history turns, set temperature 0.1 for run questions, and add a name-grounding post-check.
  - Replay the 50 questions before and after, and target 0 wrong-run answers.
  - Ship the default address change ("Sir" → none) at the same time.

### 2. Design-spec step: cloud designs, local builds (H1)
- **Why:** Design quality is the user's top complaint, and local-only design keeps producing generic screens. Sonnet-for-design gets most of the gain at a fraction of full-cloud cost.
- **Validate first:** Whether a spec-driven local build scores close to a full-cloud build. Blind-compare 3 screens of No BIO & GMO (detail page, Find brands, Settings) built three ways: local only, spec plus local, and full cloud. Score with the design-QA rubric plus the user's ranking.
- **First experiment:** Generate specs for the 3 screens with Sonnet (needs about $1 of credit) and have qwen implement them. Compare screenshots side by side.

### 3. Model-fit preflight and step routing (Q4 → H2)
- **Why:** Build time is the second big complaint, and the root cause is measurable: a 30B model at 32k spilling to CPU. Fit and routing fixes are mostly configuration plus policy.
- **Validate first:** Tokens/s and verified-first-try rate for qwen3-coder:30b at 32k vs 16k, and for a 7–14B coder, on the same 5 steps.
- **First experiment:**
  - Re-run 5 completed steps from the Calculator plan under each setup.
  - If 16k with a smaller model for routine steps is at least 2× faster with the same pass rate, make it the default suggestion in New build.

### 4. Honest ETA and stall detector (Q2)
- **Why:** "Is it stuck?" came up repeatedly, and a 2-hour silent wait happened. Visibility turns waiting into informed decisions and feeds Copilot.
- **Validate first:** Whether the history-based ETA lands within ±30% on completed runs. Back-test against the event logs of the No BIO & GMO and Calendar runs.
- **First experiment:** Compute a per-step ETA range from history and show it on the project card. Add one stall rule (no edits, tests or tool calls for 3× the median step time) that raises a banner and phone push.

### 5. Approval inbox with explanations and escalation (Q3)
- **Why:** Approvals are the largest idle-time source in autonomous builds (6 pending now, one 2-hour block). They are also the main governance surface, so making them clear improves both speed and safety.
- **Validate first:** Approval wait times over the last 2 weeks, how many were low-risk, and how many were repeats of earlier approvals.
- **First experiment:**
  - Add a risk tier and a one-line explanation to each pending approval.
  - Send a phone push after 5 minutes.
  - Measure the median approval wait for one week against the baseline.

**Sequencing:** Items 1, 4 and 5 are quick wins buildable in days with no new spend. Items 2 and 3 need a small Anthropic budget and the model benchmark, and they unlock the bigger Group 2 and 3 work (H2 routing, L2 polish loop, L1 self-healing).
