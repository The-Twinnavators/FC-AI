# FlowCode: action items from the virtual user simulation

_7 October 2026 · Source: [flowcode-virtual-user-simulation.md](flowcode-virtual-user-simulation.md)_

The source report is an AI persona simulation. No real users took part, and nothing was run for it. The persona reactions are hypotheses, not evidence of demand. This list keeps only findings that point to a concrete change.

**Code check, 7 Oct.** Each item says whether its claim was re-checked against the current source:

- **Confirmed:** the code does what the report says.
- **Changed:** the code has moved on since the report.
- **Open:** needs a live run to settle.

Nothing here is approved yet. Every item needs your go-ahead before it is built.

---

## Already resolved or outdated

| Report item | Status now |
|---|---|
| Design critique always needs the cloud ("either way") | **Changed.** `critiqueWithFallback` (`packages/daemon/src/quality/critique.ts`) now falls back to the local vision model when the cloud critic is unavailable. The Models page copy still says "either way": see A5. |
| The Plain/Technical switch isn't noticed (Alex) | **Changed.** The switch was removed from the builder header on 7 Oct. Failures and approvals now show in plain words by default. |
| The Improvements page feels like admin work (Alex) | **Changed.** Improvements has been folded into System Health → Model problems, with a daily solver and plain-language text. |

---

## Fix now: trust and accuracy (small, low-risk)

### A1. "Local" can still send design work to the cloud ★ highest priority
- **Finding.** On New build, Local reads "code stays here". But when the global Design model setting is Cloud (the default) and a cloud key is ready, the new project gets `allowHostedModels: true`, and the design steps run on the cloud model.
- **Evidence.** **Confirmed in code.** `packages/daemon/src/api/server.ts:690–692` (`designOnCloud`). The user gets no prompt or notice.
- **Action**
  1. On New build, show the design model next to "Who writes the code", e.g. "Design steps: Cloud (claude-sonnet-5-5) · Change". Make the Local option's copy true: "Code is written on this computer. Design steps use the cloud unless you switch them to local."
  2. Choose one rule and apply it everywhere: either picking Local also keeps design steps local for this build, or the user ticks an explicit consent box.
  3. Record which model ran each step, and show that per run (see B1).
- **Files.** `apps/ui/src/components/NewBuild.tsx`, `packages/daemon/src/api/server.ts`.
- **Done when.** A test project built with Local and a ready cloud key either makes no hosted calls in its events, or shows the consent the user gave.
- **Decision needed.** Which of the two rules in step 2.

### A2. The Local option names a hard-coded model
- **Evidence.** **Confirmed.** `NewBuild.tsx:384` always says `qwen3-coder:30b`. The coder actually assigned is `qwen3:14b` (`GET /models/roles`).
- **Action.** Show the configured coder from `/models/roles`.
- **Done when.** The label matches the Models page after changing the coder there.

### A3. "Faster" for Cloud isn't measured
- **Evidence.** **Confirmed.** `NewBuild.tsx:388`. Nothing in `/models/performance` covers the cloud coder.
- **Action.** Use neutral copy: "Runs on {provider}; this project's code is sent there, and the provider charges per use." Bring back a speed claim only once it's measured.

### A4. Skipped steps are counted as Done
- **Evidence.** **Confirmed.** `WorkspaceView.tsx:650`: `done: ["verified", "skipped"]`.
- **Action.** Add a separate "Skipped (replaced or not needed)" group, and leave skipped steps out of the "N of M done" counts.
- **Done when.** A run with a skipped step shows it apart from Done, and its progress figure drops by one.

### A5. Copy that no longer matches the app
- **Evidence (Confirmed).**
  - `WorkspaceView.tsx:1181` says "…in the Approvals tab", but that tab is gone.
  - `ModelsView.tsx:264` says the design crit uses the cloud "either way", which is no longer true.
- **Action.** Fix both. Then run a copy audit for retired names: Approvals tab, Terminal, Changes, Reports tab, Improvements, Plain/Technical.
- **Also.** Rewrite the outdated README quick start, which still describes Terminal / Changes / Reports and the old flow.
- **Done when.** A search for the retired names returns only intentional hits.

### A6. Copilot knowledge drifts from the real UI
- **Evidence.** This was seen live on 7 Oct, not just in the report: the Copilot invented a Ctrl+K search and said to attach a PRD in the builder chat. Part of this was fixed the same day: a fixed PRD walkthrough, corrected guide entries and a shortcut rule.
- **Action.** Write a set of 20 fixture questions about the current tabs, buttons, shortcuts and flows. Run them against `/copilot/ask` after each UI change, and flag answers that name controls the feature catalog doesn't have.
- **Files.** `packages/contracts/src/featureCatalog.ts`, `packages/daemon/src/api/copilot.ts`, plus a new test.

---

## Next: clearer choices for non-technical users (copy and small UI)

### B1. Per-run "Models and data" panel
- **Need.** Sam wants to know which model did what, and what left the machine. It also completes A1.
- **Action.** Add a panel to the builder Overview or Review listing:
  - each role and its model;
  - local or cloud for each;
  - each step that used a hosted model;
  - what was sent (code, screenshots).
- **Build on.** Run events and `modelAssignments`, which are already recorded.

### B2. "Help me choose" for local vs cloud
- **Need.** Jordan picked from fear of charges, not from knowing the trade-off.
- **Action.** Add a short explainer beside the choice:
  - **Privacy:** what's sent, and to whom.
  - **Cost:** the provider bills per use, and FlowCode doesn't track spend yet.
  - **Quality:** measured local results from the Models page.
  - **Speed:** unmeasured.
- **Later.** Add a spend counter and daily cap (H6) once usage data exists.

### B3. Autonomy levels in plain words
- **Need.** Jordan didn't understand terms like "Out-of-scope edits", "Unverified scripts" and "Hosted models".
- **Action.** Give each level 2–3 "what this means for you" examples, e.g. "FlowCode may download free building blocks into this project folder without asking". Keep the exact policy lists under a "Details" toggle.
- **File.** `apps/ui/src/components/AutonomyPicker` / `autonomy.ts`.

### B4. Package-install approvals in personal terms
- **Action.** Add one plain sentence to install approvals: "Downloads free building blocks this project needs. Normal for every build. Nothing outside the project folder changes." Keep the exact command visible.

### B5. "What this prototype can and can't do" card
- **Need.** Jordan learned too late that requests don't reach anyone.
- **Action.**
  - Add a short card to New build step 1: "Works on this computer. Data is pretend. Nothing is sent to customers. Launch readiness lists what a real app needs."
  - Add a dismissible one-line banner to Preview.

### B6. "Does this need me?" on stall warnings
- **Action.** Under "possibly stalled", say either "No action needed yet: FlowCode is retrying (attempt 2 of 3)" or "Needs you: …". Base it on the run's state, not on a guess.

---

## Next: review and iteration

### C1. Device frames in the live Preview
- **Evidence.** **Confirmed** there is no switcher in the builder Preview. Verification screenshots already cover mobile, tablet and desktop.
- **Action.** Add a Phone (390) / Tablet (768) / Desktop toggle that resizes the preview frame. Keep the user's choice per project.

### C2. Changes summarised by screen
- **Need.** Maya couldn't tell whether a spacing change was global.
- **Action.**
  - At the top of Review, show "This change affects: Lesson card (3 screens) · Tokens: --space-4", with before and after screenshots from verification.
  - Keep the per-file diffs below.
- **Prerequisite** for point-and-say (D1).

### C3. Live "where the time is going"
- **Need.** Long runs, and users learn the cause only afterwards (F9).
- **Action.** Add a one-line breakdown to the Overview while the build runs: model thinking / commands / retries / restores / waiting for you. It should come from `/runs/:id/performance`.
- **Paired with.** Investigating the top three repeat-failure fingerprints in recorded runs.

### C4. Recommended next action at a blocker
- **Action.** Mark one supported action as "Suggested", and say why, only when the run's history gives a basis, e.g. "Same failure 3 times; a retry with guidance cleared similar stops in 4 of 6 earlier runs". Otherwise say "No basis to recommend one". Never pre-select it.

### C5. External-edit detection before Retry
- **Action.** Before a retry, compare the workspace with the last snapshot. If files changed outside FlowCode, show "You changed `src/data/invoices.json`; the retry will use your version".

---

## Later: bigger capabilities (need a spec first)

| ID | Item | Personas | Notes |
|---|---|---|---|
| D1 | Point-and-say edits in Preview (H4) | Maya, Alex | Builds on C2. Click an element, describe the change, see its scope before sending |
| D2 | Run comparison (H5): side-by-side diff, checks, time, model | Sam, Maya | Enables honest local vs cloud evaluation |
| D3 | "Same settings as last build" (Q6) | Alex, Maya | Look, autonomy, coder and starter |
| D4 | Small-change fast path: cosmetic changes run only the affected checks | Alex | Must still run the design and contrast checks. Risk of skipping a needed check |
| D5 | Split a batched request into independent items | Alex | One failure shouldn't block the rest |
| D6 | Suggest switching the model when a step is stuck (H2) | Alex | Only with measured evidence that switching helps |
| D7 | Per-change model choice ("use cloud for this design step") | Maya | Follows A1 and B1 |
| D8 | Earlier rough first preview (skeleton screens first) | Alex | Planner change. Validate that early rough output doesn't disappoint |
| D9 | Reference-to-token mapping ("from image 2: accent #… and radius 12") | Maya | Small extension of style capture |
| D10 | Per-screen states (loading, empty, error) in the plan | Maya | Part of the screen specs |
| D11 | Non-developer "Turn this into a real app" guide | Jordan | New content next to Launch readiness |
| D12 | Shareable prototype link or export | Maya, Alex | Needs a privacy decision |
| D13 | Patch or commit export per step | Sam | — |

---

## Preserve (don't change these)

- The completion gate and honest check states: "Ready, not fully checked" and "Couldn't run". An unrun check is never shown as passed.
- Design before build: style capture, the Design tab, and plan plus design approval. Also screen coverage and specs.
- The Overview's fixed order and "Needs you". Exact-action approvals and the decision log.
- The grounded Copilot with its facts card. Question-vs-change detection in chat.
- Undo per step and per file. Queued changes.
- Statement labels in the Journal. Optional improvements, never applied automatically.

---

## Suggested order

| Order | Items | Why first |
|---|---|---|
| 1 | **A1**, then A2–A5 | A1 is a confirmed consent gap against the "local by default" principle. The others are quick accuracy fixes |
| 2 | A6, B1 | Keeps the Copilot and the data-flow claims truthful as the UI changes |
| 3 | B2–B6 | Mostly copy. Biggest effect for first-time, non-technical users |
| 4 | C1–C5 | Review and iteration quality |
| 5 | D-items | Each needs a short spec and real-user validation first |

## Validate with real users before building the D-items
- What do people believe "Local" means for their code, screenshots and design steps?
- What does "prototype" mean to non-technical users, and when do they discover its limits?
- Which facts (cost, privacy, speed, quality) actually change a local vs cloud choice?
- Does a device frame or point-and-say reduce revision rounds?
- Do novices want a suggested action at blockers, and do they over-trust it?
