# FlowCode Virtual User Experience Simulation

_7 October 2026 · AI-generated experience simulation. This is not usability testing or customer research. No real users took part, and FlowCode was not launched, built or tested for this report._

**How to read this report.** Every statement carries one of these labels:

| Label | Meaning |
|---|---|
| **[Doc]** | Described as current in FlowCode's repository documents (plans with "Results" sections, README, guide copy) |
| **[Code]** | Seen by reading the source code. Not run, so actual behaviour still needs to be confirmed |
| **[Reported]** | A problem recorded in FlowCode's own analysis documents, from earlier builds on this computer |
| **[Planned]** | Proposed or deferred. **Not available** in the described version |
| **[Assumption]** | A gap in the materials, filled with a stated guess |
| **[Unknown]** | The materials don't say. Nothing is assumed beyond what the text states |
| **[Simulated]** | An imagined persona reaction, experience or preference |

---

## Executive summary

**What was simulated.** Four fictional people each use FlowCode over three imagined sessions (12 in total):

| Persona | Role | Project |
|---|---|---|
| **Maya** | Product designer | Personal-finance learning app |
| **Jordan** | Non-technical small-business owner | Appointment-request app |
| **Alex** | Vibe coder | Weekly planner |
| **Sam** | Full-stack developer | Invoice follow-up dashboard |

Their experiences are built from FlowCode's documents and code as of 7 October 2026: package version 0.1.0, no git commits yet.

**Main strengths (likely, from the materials)**
- **Honest status.** "Ready, not fully checked", "Couldn't run" vs "Skipped", and ETA ranges that admit their uncertainty. In the simulation, this earns the most trust from Sam and Jordan.
- **One place for decisions.** "Needs you" in the Overview, approval cards in chat, an Approvals page and a phone page, all backed by the same records.
- **Design-first set-up.** Style capture from images or a URL, a Design tab that can be edited before the build, screen coverage and screen specs. This is Maya's strongest reason to stay.
- **Evidence after a run.** Run Review, the Project Journal with labelled statements, and a decision log. Sam values these. Alex mostly ignores them.
- **Grounded Copilot status answers**, with a facts card, now that the wrong-run problem is fixed.

**Main friction themes**
1. **What the local/cloud choice actually means is unclear.** The New build screen says the local option keeps "code stays here". The code suggests design steps and the design crit can still use the cloud model when it is set up, through a separate global setting [Code]. There is also no cost or speed information at the point of choice.
2. **Long, opaque builds.** The recorded data includes a 14.8-hour run where most of the time went to failed commands and restores [Reported]. ETA ranges are honest, but on past builds they were right only about 6 in 10 times [Doc].
3. **Design quality from local models** may read as generic [Reported]. The visual review depends on a cloud model that can run out of credit.
4. **Precise revisions are typed by hand.** There is no point-and-say in the preview [Planned], and no device-size control in the live preview [Code].
5. **Prototype-only scope surprises non-technical users.** Jordan's "real" appointment requests don't go anywhere, and the Launch readiness hand-off assumes access to a coding agent.
6. **Leftover terminology and naming drift.** Examples are route names, a stale "Approvals tab" message and an outdated README quick start [Code].

**Most important opportunities**
1. Make the model and data-flow choice explicit at New build: which steps use which model, and what leaves the machine.
2. Reduce wasted build time and show where the time went while the build runs.
3. Add point-and-say revisions with a per-change scope and diff summary.
4. Add a preview device switcher.
5. Add a plain-language "what this prototype can't do yet" card for novices.

**Limits.** These are imagined reactions from four AI personas. They don't predict what real users will do, how often a problem occurs, or how many users will come back. Every opportunity listed needs real-user validation.

---

## 1. Simulation basis and assumptions

### 1.1 Materials reviewed
| Source | Used for |
|---|---|
| `README.md` | Purpose, principles, first-run steps (partly outdated, see §1.4) |
| `docs/PRD.md` (section headings), `docs/architecture.md`, `docs/traceability.md`, `docs/open-questions.md` | Product promise, run lifecycle, MVP scope, defaults |
| `docs/prototype-builder-plan.md` (5 Oct) | Prototype-only builds, style capture, Launch readiness |
| `docs/flowcode-ai-opportunities.md` (6 Oct) | Primary user, friction table, proposed features Q1–Q8, H1–H9, L1–L5 |
| `docs/flowcode-improvement-plan.md` (7 Oct, Phases 1–5 results) | Verified findings F1–F9, Copilot grounding, check states, run activity, ETA back-test, approvals, decision log, Improvements, model performance, screen coverage |
| `docs/flowcode-content-clarity-plan.md` (7 Oct, results) | Builder layout (Overview + 5 tabs), Plain/Technical modes, Project Journal, About page |
| `docs/plans/ai-provider-plan.md` | Bring-your-own-provider proposal (**not approved**) |
| UI source: `NewBuild.tsx`, `AutonomyPicker`/`autonomy.ts`, `WorkspaceView.tsx`, `ModelsView.tsx`, `HowItWorks.tsx`, `router.ts`, `ScreenshotViewer.tsx` | Actual labels, options and copy |
| Daemon source: `api/server.ts`, `models/cloud.ts`, `orchestrator.ts` (grep only) | How the cloud model is used for design steps |

No screenshots were reviewed. The two image files in the repository root were not opened.

### 1.2 Current capabilities used in the simulation
- **Purpose [Doc].** FlowCode is a local-first desktop app that turns a PRD or idea into a **clickable prototype**: simulated data, no backend, real navigation. The Launch readiness checklist (Markdown) is the hand-off for building the real app.
- **Starting a build [Code/Doc]**
  - "What do you want to make?" with an everyday-language example.
  - A request quality indicator ("Not scored yet").
  - PRD and support files: `.md`, `.html`, `.css`, `.json`, `.txt` and images; up to 1.5 MB per file and 6 MB in total.
  - Look and feel, with an optional "Take the style from a website".
  - The folder.
  - "Who writes the code": Local or Cloud.
  - Autonomy: Supervised, Assisted or Autonomous, each with lists of what it auto-approves and what it always asks.
  - Create PRD (Discover) helps write a PRD with research.
- **Before the build [Doc].** Under Supervised and Assisted, the user reviews the Prototype plan and the design. "Nothing is built before you do."
- **Builder [Code/Doc]**
  - The left **Overview** is always in this order: goal → Where it stands → Needs you → Plan and progress → Latest review.
  - Tabs: **Preview · Design · Review · Activity · Technical output**.
  - A Plain/Technical switch. Failures, couldn't-run checks and approvals are shown in both modes.
- **Status [Doc]**
  - Run activity states include "waiting for your approval", "waiting for the model service", "retrying", "possibly stalled" and "finished but not fully checked".
  - Time left is shown as a range or "Not enough data yet". It is labelled "on past builds about 6 in 10 finished inside it".
  - Stall warnings are advisory only.
- **Approvals [Doc]**
  - Shown as chat cards, in Overview "Needs you", on the Approvals page and on the phone page.
  - Options: Approve once / for the project / Deny.
  - Each decision is bound to the exact action shown, and recorded in the decision log.
  - The top-bar counter turns red after 5 minutes.
- **Copilot [Doc]**
  - Answers status questions from structured run facts, with a facts card.
  - History is scoped to the project and run.
  - A question typed in project chat is answered, not turned into a build, with a "Build this as a change instead" button.
- **After a build [Doc]**
  - Run Review.
  - Project Journal, with each statement labelled Observed / Suspected cause / FlowCode's reading / Verified / Open question, and "Ask about this run".
  - An Improvements page where proposals need approval. Confirming one requires testing first.
- **Iteration [Doc].** Users can queue a change while a step runs. Follow-ups "plan only the difference and keep the look". There is undo per step and per file, retry with guidance, pause, switching the coder, and editing the request.
- **Design [Doc]**
  - Style capture from images, HTML/CSS, a URL or the PRD.
  - Design tab: palette, type, corners, surface and motion.
  - Screens list, with uncovered screens and possible duplicates flagged.
  - Screen specs drafted by a local model and saved only on user request.
  - Mobile, tablet and desktop screenshots from verification [Code].
- **Models [Doc/Code]**
  - The Models page shows measured local-model results: qwen3:14b 56% first-try passes over 32 steps; qwen3-coder:30b 45% over 22; qwen3:8b 38% over 21. It recommends qwen3:14b, with a caveat that the projects differed.
  - A "Design model" setting (Cloud by default) decides which model designs the main screens. The design crit uses the cloud model "either way".
  - Cloud providers: OpenAI-compatible and Anthropic, with keys stored in the Windows user environment [Code].

### 1.3 Reported problems used as plausible situations
- **Fixed on 7 Oct; the personas don't hit these, but the history matters:**
  - Copilot answered about the wrong run and passed agent-facing text to the user as a chore (F1, F2).
  - A question started a new build (F8).
  - The credit-exhausted advice named the wrong provider (F6).
- **Still open or only partly addressed:**
  - Long builds dominated by failed commands, restores and approval waiting (F9).
  - An inaccurate ETA (P1). Ranges are now shown, but were right about 61% of the time in the back-test.
  - Local models produce generic design (P2), and the design check found nothing while the user judged the screens "subpar".
  - Duplicate screens.
  - Choices re-entered on every build.
  - No cost or speed preview for the model choice.
  - One approval sat unnoticed for 2 hours.
  - Change requests typed by hand.
  - 556 hard-coded font sizes outside the Builder.

### 1.4 Things seen in the code that the documents don't mention (unverified)
- **C1. Local choice and cloud design.** On New build, the Local option reads "qwen3-coder:30b on this computer; code stays here" (`NewBuild.tsx`). Two things may contradict it:
  - When the global Design model setting is Cloud (the default) and a cloud key is ready, `server.ts` turns on `allowHostedModels` for the new project "even when the coder is local". `orchestrator.ts` then uses the cloud model for design steps.
  - The Models page says the design crit uses the cloud "either way".

  If the code behaves as read, a user who picks Local may still send code or screenshots to a cloud provider. Separately, `ai-provider-plan.md` notes that the `hosted_model` approval kind "exists but nothing uses it", while the autonomy levels list "Hosted models" under *always asks*. **This needs a live check before anyone acts on it.**
- **C2. Hard-coded model name.** The Local label always names `qwen3-coder:30b`, but the Models page recommends `qwen3:14b`.
- **C3. "Faster" without data.** The Cloud option is described as "faster", but nothing in the materials measures this.
- **C4. "Done" includes skipped steps.** The step group "Done" includes `skipped` steps (`WorkspaceView.tsx` `STEP_GROUPS`).
- **C5. Stale message.** The git commit flow still says "in the Approvals tab", but that tab was removed.
- **C6. Inconsistent page names.** Route names include `projects` → "workspace" and `quality` → "My Projects".
- **C7. No live preview device switcher was found.** The guide says to try the preview "on a narrow window too".
- **C8. Outdated README quick start.** It still describes Terminal / Changes / Reports and the old flow.
- **C9. No cost or spend information** was found in New build or on the Models page.

### 1.5 Planned or proposed (treated as not available)
- **Proposed (Q, H and L items):**
  - point-and-say change requests in the preview (H4);
  - run comparison and visual diff (H5);
  - an operations dashboard with cost (H6);
  - step-level model routing (H2);
  - predictive quick-fill in New build (Q6);
  - a PRD missing-data linter (Q5);
  - a night-shift queue with a morning digest (L3);
  - a self-healing recovery agent (L1).
- **Deferred:** batch approvals.
- **Not approved:** the guided bring-your-own-provider set-up (`ai-provider-plan.md`).
- **Not built:**
  - a fixed-task benchmark harness;
  - a "Superseded" approval state;
  - the Calculator rebuild under the prototype rules.

### 1.6 Assumptions
- **A1.** Each persona has a working local model (the recommended qwen3:14b, or qwen3-coder:30b as the New build label suggests). Each has a cloud key that is set up and has credit, except where a session says otherwise.
- **A2.** The UI matches the 7 October "Results" sections. Copy is as found in the source.
- **A3.** Build durations are unknown. They are described only as "short", "long" or "overnight", and grounded only in the recorded range above.
- **A4.** The personas start with no FlowCode history, except what earlier sessions in this simulation imply.
- **A5.** Sam's "validation" means client-side form validation in a prototype. Prototypes have no backend.

---

## 2. Persona profiles

| | **Maya** | **Jordan** | **Alex** | **Sam** |
|---|---|---|---|---|
| Role | Product designer / designer-founder | Owner of a small home-cleaning business (first app) | Founder who builds through chat | Full-stack developer |
| Project | "Pennywise": personal-finance learning scenarios with choices, progress and feedback | "BookNest": customers request a cleaning slot; the owner reviews requests | "Weekly": weekly planner with tasks, priorities and done states | "Chaser": invoice follow-up dashboard with sample data, filters and validation |
| Starting material | Short PRD, three Dribbble-style reference images, a type scale | Two paragraphs in everyday words | One sentence | PRD with numbered acceptance criteria, JSON sample data |
| Cares most about | Hierarchy, type, spacing, consistency, mobile, precise edits | Clear guidance, knowing what is happening, safe decisions | Speed, momentum, scoped changes | Accurate status, diffs, evidence, no weakened requirements |
| Tolerance for technical detail | Low, but reads design tokens | Very low | Medium (skims) | High |
| Default model stance | Local for routine work, cloud for design critique | Undecided; needs an explanation | Local, cloud when stuck | Local, cloud selectively, with evidence |
| Default autonomy | Supervised (wants to approve the design) | Supervised at first (feels safer) | Autonomous | Assisted |
| Stays consistent on | Judging by what she sees | Plain words, worry about mistakes | Impatience with ceremony | Distrust of claims without evidence |

---

## 3. Twelve imagined sessions

Everything in this section is **[Simulated]** unless it is labelled otherwise. The labels in the "FlowCode provides" column say where each described behaviour comes from. "Hypothetical" marks a situation invented for the narrative that the materials don't specifically predict.

### 3.1 Maya, product designer

#### Maya · Session 1: First use

**Goal:** turn the Pennywise brief and three reference images into a prototype plan and a starting design she agrees with.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| To give her look before anything is built | A place for references | New build accepts images and a website URL; colours are taken from the pixels, and fonts and corners from a vision model when one is set up [Doc] | Encouraged: references are treated as an input, not decoration | Attaches 3 images and her PRD | "Tell me what you took from each image" |
| To lock the design before the build | A design review step | Under Supervised, she approves the Prototype plan and the design; the Design tab can be edited first [Doc] | This matches how she works | Adjusts the type scale and corner radius on the Design tab | Would like to see the captured palette next to each source image |
| To choose a model | A simple trade-off | "Local model · qwen3-coder:30b on this computer; code stays here" vs "Cloud model · faster, and this project's code is sent to that provider" [Code] | Picks Local, believing the design steps will be local too | Starts the build | Doesn't know the Design model setting exists (C1) |

**Simulated experience.** Maya finds New build calm and well ordered. Style capture is the moment she leans in. On the Design tab, the captured palette is close but flattens her accent colour, and she fixes it in a minute. The Prototype plan lists screens, and she is pleased to see "Scenario", "Choice feedback" and "Progress". She notices nothing in the plan about loading or empty states for the progress screen, and adds a note through Edit request. During the build she opens Preview once, sees a half-built shell, and decides to come back later.

**What worked**
- References as a first-class input.
- Design approved before the build.
- Editable tokens.

**What did not work**
- She couldn't tell how each reference was used.
- The plan doesn't show per-screen states (loading, empty, error) unless a screen spec exists.

**What was unclear**
- "Who writes the code" sounds like a coding detail, not a design-quality decision.
- Whether the design steps follow that choice.

**What the user expected instead**
- A "Where your style came from" panel that maps each source to the tokens it produced.
- A model choice described by its effect on design quality.

**Local/cloud reaction.** She chose Local for routine work. She assumed she would be asked before cloud critique was used. Hypothetical: if C1 holds, she would be uneasy to learn the cloud did the design work without her knowing. She wouldn't object to the cloud being used, only to not being told.

**Wish list**
1. A reference-to-token mapping.
2. Per-screen state checklists in the plan.
3. A design model choice shown on New build.

**Simulated user comment** — _AI-generated persona comment:_ "Capturing the style first is the right instinct. Now show me what you actually took from each image."

#### Maya · Session 2: Review and iteration

**Goal:** judge the generated screens on desktop and mobile, and make two precise revisions without collateral redesign.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| To see mobile | A device switcher in Preview | Mobile, tablet and desktop screenshots from verification; the live preview has no switcher, and the guide says "on a narrow window too" [Code/Doc] | Screenshots help but are static; resizing the whole app window feels clumsy | Uses the screenshots, then resizes the window | "Give me a phone frame" |
| To know if every screen got real design attention | A coverage view | Design → Screens: "N of M screens haven't had a design step of their own"; possible duplicates flagged [Doc] | Very useful: confirms her hunch that "Lesson detail" only got a broad polish pass | Drafts a screen spec for Lesson detail (local model), edits and saves it | Wants the spec to show a wireframe, not just text |
| To change just the primary button label and the card spacing | Point at the element | Follow-ups typed in chat; "plans only the difference and keeps the look" [Doc]. Point-and-say is [Planned] | Has to describe the element in words ("the green button under the scenario text") | Types the request, then checks Review → Changes made by step | Unsure whether the spacing change was global (a token) or local |

**Simulated experience.** The first screens are tidy but feel generic. Card shadows and icon choices look like a default kit. This matches the reported "same AI slop" feedback [Reported]. The checks bar says "Design review: Couldn't run" for one screen. Hypothetical: the cloud critic is out of credit. The run shows "Ready, not fully checked". Maya appreciates that it doesn't claim a review that didn't happen. The screen coverage list becomes her map. Her spacing change lands, but Review shows edits in three files, and she can't tell from the summary whether other screens changed.

**What worked**
- Honest "Couldn't run".
- Screen coverage and the duplicate check.
- Screen specs that later design steps build to.

**What did not work**
- No live device frame.
- Revisions need verbal descriptions of elements.
- The change summary is by file, not by screen.

**What was unclear**
- Whether "keeps the look" means tokens are frozen.
- Whether a spacing tweak is applied globally or locally.

**What the user expected instead**
- "This change affects: Lesson card (3 screens)", with before/after thumbnails.

**Local/cloud reaction.** She wants to use the cloud for critique and is frustrated when credit runs out. She would accept local design for small fixes if the critique still runs. The local vision critic (qwen2.5vl) is mentioned as optional in the README, and Phase 1 raised a proposal to fall back to it [Doc]. She would welcome that.

**Wish list**
1. A live device switcher.
2. Point-and-say edits.
3. Before/after per screen.
4. A local critique fallback.

**Simulated user comment** — _AI-generated persona comment:_ "The coverage list told me more about quality than the design check did."

#### Maya · Session 3: Repeat use and reflection

**Goal:** add a "Goal tracker" screen in the same style, compare local and cloud for the design step, and decide whether the prototype is ready to show investors.

**Simulated experience.** She writes a screen spec first, then asks for the new screen. This time the result is closer to her intent, which she attributes to the spec, not to the model. She switches the Design model to "Each build's own coder" (local) for this one change to see the difference. Hypothetical: the local output follows the spec's structure but is visually plainer. She switches back for the polish step. The Project Journal's "How clear the PRD was" section points out that two steps stopped on vague copy requirements. She finds that useful for her next brief. Before sharing, she wants a "presentation mode" with clean demo data and no FlowCode chrome. "Reset demo data" exists in the simulated app [Doc], but there's no shareable link or export of the clickable prototype in the materials [Assumption: not available].

**What worked**
- Specs measurably steer the result: she judges this by eye, with no metric.
- The Journal's PRD-clarity section.
- "Reset demo data".

**What did not work**
- Comparing local and cloud needs a global setting change and two runs, with no side-by-side view.
- No way to share the prototype.

**What was unclear**
- Which steps used which model. The Journal's "who did what" section helps, but only after the run.

**What the user expected instead**
- A per-change model choice: "Use cloud for this design step".
- A side-by-side visual diff. Run comparison (H5) is [Planned].

**Local/cloud reaction.** She settles on: local for structural changes, cloud for polish and critique, decided per change and not as a global setting.

**Wish list**
1. Per-change model choice.
2. Visual run comparison.
3. A shareable prototype link.
4. Specs with sketches.

**Simulated user comment** — _AI-generated persona comment:_ "I trust FlowCode most when I've written the spec. That's fine, but say so up front."

### 3.2 Jordan, non-technical novice

#### Jordan · Session 1: First use

**Goal:** get an app where customers can ask for a cleaning slot.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| To start without jargon | A friendly prompt | "What do you want to make? … Everyday words are fine." with a gym booking example [Code] | Reassured | Writes two plain paragraphs | Likes the example |
| To understand "prototype" | A plain explanation | New build says "FlowCode builds a clickable prototype" and that the Launch readiness checklist is for the real app [Doc] | Reads "prototype" as "first version I can use" | Continues | Doesn't take in that requests won't actually reach anyone |
| To choose local or cloud | Advice | Two radio options with one-line notes [Code]; no cost, speed or privacy explainer [Code C9] | Anxious: "Will this cost me money? What is 'code sent to that provider'?" | Asks the Copilot | Wants a recommendation in plain words |
| To choose how hands-on | Simple choice | Supervised / Assisted / Autonomous with "auto-approves" and "always asks" lists [Code] | The lists contain "Installs", "Out-of-scope edits", "Unverified scripts" | Picks Supervised because it sounds safest | Would like "What this means for you" examples |

**Simulated experience.** Jordan asks the Copilot "Which one should I pick, local or cloud?" There's nothing in the materials about how the Copilot handles general advice questions [Unknown]. Assume it gives a reasonable answer, but can't say what the cloud would cost, because FlowCode doesn't track that. Jordan picks Local "to be safe". The Prototype plan card is long. Jordan reads the step names, understands most of them ("Request form", "Owner inbox"), skips the criteria, and presses Approve plan. Then a card appears: "Needs your OK" to install packages [Doc]. Jordan hesitates: is this downloading something onto the computer? The card shows the risk and consequences, which helps, but "npm" means nothing to Jordan.

**What worked**
- The everyday-language prompt.
- Plain step names.
- Approval cards that state consequences.

**What did not work**
- The model choice has no plain explanation of cost or privacy.
- Autonomy lists are written in technical terms.
- "Prototype" isn't explained in terms of what it can't do.

**What was unclear**
- "Out-of-scope edits", "Unverified scripts and programs", "Hosted models".
- What "install" means for the user's own computer.

**What the user expected instead**
- A short "Recommended for you" with a reason.
- An approval that says "FlowCode wants to download free building blocks it needs. This is normal for every build. Nothing outside this project folder changes."

**Local/cloud reaction.** Without cost or privacy facts, Jordan defaults to Local out of fear of surprise charges, not because they prefer it.

**Wish list**
1. A plain model-choice explainer with typical cost.
2. Autonomy described with examples.
3. A "What this prototype will and won't do" card.

**Simulated user comment** — _AI-generated persona comment:_ "I picked the safest-sounding options because I didn't know what the others would do to my computer or my wallet."

#### Jordan · Session 2: Review and iteration

**Goal:** see the app, understand a hold-up, and change the form so it asks for the address.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| To know what happened while away | A summary | Overview "Where it stands", then "Needs you" [Doc]; the phone page can show approvals [Doc] | Clear: "Stopped, needs you" | Reads the stopped step | Likes the fixed order |
| To understand the blocker | Plain words | Blocker translator: separates "FlowCode does this" from "You decide: …", with only supported actions offered [Doc] | Hypothetical: "A check on the request form keeps failing. FlowCode tried 3 times. You decide: try again with guidance, undo this step, or stop." | Asks the Copilot "what does that mean, what should I do?" | Wants FlowCode to recommend one option |
| To change the form | Type a request | Project chat; "Build this as a change instead" if it's taken as a question [Doc] | Types "Can you add an address field?" which is treated as a change [Doc] | Watches the activity line | Pleased it understood |

**Simulated experience.** The grounded Copilot answers from the run's facts and shows a facts card [Doc]. Jordan finds the facts card a bit technical (step names, check names) but reassuring: "it isn't guessing". The Copilot can't choose for Jordan. Jordan picks "Retry with guidance" and types "make it simpler". Hypothetical: the step passes on the next try. Jordan then opens Preview and fills in a request, then looks for the "owner inbox" to see it arrive. The inbox shows it, which delights Jordan, until they ask the Copilot how customers will get the link. The answer, consistent with the docs, is that this is a prototype with simulated data. Requests are stored in the browser on this computer, and the real app is planned with Launch readiness. Jordan feels a little misled. FlowCode had said "prototype", but that word didn't carry that meaning for Jordan.

**What worked**
- The fixed Overview order.
- Plain blocker text with "You decide".
- Question vs change detection.
- The grounded Copilot.

**What did not work**
- No recommended option at decision points.
- The prototype's limits only became clear after investment.

**What was unclear**
- "Retry with guidance": what kind of guidance?
- The facts-card vocabulary.

**What the user expected instead**
- "We suggest: Retry. Most similar stops cleared on retry." Only if that is backed by data. Otherwise say there's no basis for a recommendation.
- A prototype-limits banner in Preview.

**Local/cloud reaction.** Not revisited. Jordan wonders whether the cloud "would have got it right first time", but has nothing to base that on.

**Wish list**
1. A recommended next action with its reason.
2. A "this is a demo" banner in Preview with the next steps.
3. Guidance examples for retries.

**Simulated user comment** — _AI-generated persona comment:_ "It explained the problem well. I just wanted it to tell me which button it would press."

#### Jordan · Session 3: Repeat use and reflection

**Goal:** add a "choose a cleaner" option, try the cloud once, and find out how to get a real app.

**Simulated experience.** Jordan tries Cloud this time. Hypothetical: the Copilot or the Models page explains the provider charges per use, but FlowCode shows no spend so far or estimate [Code C9]. Jordan watches the build more nervously because of the unknown cost. The change lands. Then Jordan opens Launch readiness, a checklist where "each item has a ready prompt" for "a coding agent" [Doc]. Jordan doesn't have one and doesn't know what one is. The Project Journal is interesting but long. Jordan reads "What worked" and "What to try next", and skips the rest. Plain mode helps, but terms like "verification" still appear.

**What worked**
- The change landed without breaking the look.
- The Journal's "What to try next".
- Plain mode reduced the noise.

**What did not work**
- Cloud use with no cost visibility.
- Launch readiness assumes developer tooling.

**What was unclear**
- Whether Jordan can publish this app at all, and what the next real step is: hire someone, or use another tool?

**What the user expected instead**
- A "Turn this into a real app" guide written for non-developers: options, rough effort, what to hand to a developer.

**Local/cloud reaction.** Jordan would use the cloud again only with a visible spend counter and cap.

**Wish list**
1. A spend counter and cap.
2. A non-developer Launch guide.
3. A shorter Journal summary.

**Simulated user comment** — _AI-generated persona comment:_ "I've got something I can show my customers. I just don't know how to make it real."

### 3.3 Alex, vibe coder

#### Alex · Session 1: First use

**Goal:** go from "weekly planner with priorities" to a clickable thing as fast as possible.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| To start in one line | Accepts a one-liner | Accepted; quality indicator shown; Create PRD offered as an alternative [Code/Doc] | Ignores the indicator | Picks Autonomous, Local | "Don't make me write a PRD" |
| To skip plan review | Autonomous skips it | Autonomous auto-approves all plans [Code] | Happy | Waits | — |
| A fast first result | Minutes | The ETA range or "Not enough data yet" [Doc]; on past builds about 6 in 10 finished inside the range [Doc] | Hypothetical: the range is wide, e.g. "40 min – 2 h" | Leaves, checks the phone later | "A range this wide doesn't help me plan" |

**Simulated experience.** Autonomous mode gives Alex the momentum they wanted. No cards, apart from the always-asked items. Alex queues "make done tasks strike through" while step 4 runs, and likes that it waits its turn [Doc]. The build is longer than Alex hoped. The run activity shows "retrying" several times, and once "possibly stalled", offering Pause / Retry / Cancel [Doc]. Alex ignores it and it recovers. Alex doesn't open Review or Activity at all.

**What worked**
- A one-line start.
- Autonomous mode.
- Queued changes.
- Advisory, not intrusive, stall warnings.

**What did not work**
- Total time. FlowCode's own data shows retries and restores dominate long runs [Reported F9].
- An ETA range too wide to plan around.

**What was unclear**
- Whether "possibly stalled" needs action, or will sort itself out.

**What the user expected instead**
- A first rough preview early: a skeleton of the screens, then refinements.

**Local/cloud reaction.** Local by default. Alex would switch to cloud if told "the cloud usually finishes this step type in X". No such data exists today.

**Wish list**
1. An earlier first preview.
2. A narrower, task-type-based ETA.
3. "Does this need me?" on stall warnings.

**Simulated user comment** — _AI-generated persona comment:_ "Autonomous felt right. I just wanted to see something on screen sooner."

#### Alex · Session 2: Review and iteration

**Goal:** five quick tweaks: colours, a priority badge, drag to reorder, a weekly summary and an empty state.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| Rapid tweaks | Each one quick | Each follow-up is a new run linked to the parent, planned "only the difference" [Doc] | The overhead per change (plan, checks) feels heavy for a colour tweak | Batches the five into one message | Wants a "quick edit" lane |
| Recover from a bad change | Undo | Undo a step; undo per file in Review [Doc] | Hypothetical: drag-to-reorder breaks the list and Alex undoes it | Undoes it | Relieved that undo works per step |
| To ask "why is it slow?" | A straight answer | The Journal and Copilot answer from performance data; Run Review lists retries, restores and failed command time [Doc] | Learns most of the time went to retries | Asks the Copilot whether cloud would help | Wants the answer while the run is going, not after |

**Simulated experience.** Batching five changes into one run is efficient, but one failing item (drag) holds up the others. Alex learns to split risky items from safe ones. The Plain/Technical toggle is invisible to Alex. Alex never noticed it in the Overview header.

**What worked**
- Undo per step.
- Question vs change detection.
- Follow-ups that keep the look.

**What did not work**
- Fixed overhead per change.
- Batched changes fail together.

**What was unclear**
- Whether a queued change will re-run earlier checks.

**What the user expected instead**
- A "small change" fast path that runs just the affected checks.
- Batched requests split into independent items automatically.

**Local/cloud reaction.** After learning that retries dominate, Alex tries switching the coder mid-run [Doc: `/runs/:id/coder`]. Hypothetical outcome: the stuck step passes. Alex can't tell whether the cloud fixed it or the retry did.

**Wish list**
1. A small-change fast path.
2. Automatic splitting of batched requests.
3. Live "where the time is going".

**Simulated user comment** — _AI-generated persona comment:_ "Undo saved me. The ceremony around a colour change didn't."

#### Alex · Session 3: Repeat use and reflection

**Goal:** start a second app (a habit tracker) quickly, reusing what worked.

**Simulated experience.** On New build, Alex re-enters the look, folder pattern, model and autonomy. This matches the reported "same choices re-entered every build" [Reported]. Predictive quick-fill is [Planned]. Alex skims the Improvements page and sees a proposal "Run the visual review on a local vision model…", but doesn't understand why it needs Alex's approval. Alex opens the Journal once, reads "where the time went", and closes it.

**What worked**
- The second build starts with less confusion.
- Alex now uses Assisted for risky features and Autonomous for cosmetic ones.

**What did not work**
- No "start from last build's settings".
- The Improvements page feels like admin work.

**What was unclear**
- What approving an "improvement" changes, and for which projects.

**What the user expected instead**
- "Use the same settings as Weekly", plus a short list of improvements with one-tap Try.

**Local/cloud reaction.** Local for most work, cloud when a step has failed twice. Alex wishes FlowCode would suggest this. Step-level routing (H2) is [Planned].

**Wish list**
1. Reuse settings.
2. A suggestion to switch model when stuck.
3. A lighter Improvements experience.

**Simulated user comment** — _AI-generated persona comment:_ "Second time round I knew what to ignore. That's a skill I shouldn't need."

### 3.4 Sam, developer

#### Sam · Session 1: First use

**Goal:** build Chaser from a PRD with explicit acceptance criteria and JSON sample data, and see whether FlowCode respects them.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| Criteria respected | The plan quotes them | The Prototype plan shows steps, their requirements and their tests; "content comes from the PRD or an attached JSON file first" [Doc] | Good: the plan maps to the PRD headings | Checks that each acceptance criterion appears | Wants an explicit criteria → step trace |
| To know which model does what | A config summary | The coder line in the run header; capability-lab pass required for Coder [Doc]; the New build label names qwen3-coder:30b [Code C2] | Notices the Models page recommends qwen3:14b and asks which one is used | Opens Models | "The label and the recommendation disagree" |
| No hidden cloud use | Local means local | Hypothetical, if C1 holds: the design steps use the cloud because the Design model setting is Cloud | Sam would treat this as a trust breach, even though it was a setting | Checks project policy | Wants a per-run data-flow summary |
| Inspect commands | Terminal | Technical output tab; commands policy-checked; output redacted [Doc] | Satisfied | — | — |

**Simulated experience.** Sam picks Assisted and reads the auto-approve list carefully. "Edits inside src/ beyond the task's scope" are auto-approved under Assisted [Code], which Sam notes as a scope risk. Sam reads the plan in Technical mode and is pleased that each step carries checks. Sam can't edit code in FlowCode: the file view is read-only [Doc, open question 7], so Sam opens VS Code alongside.

**What worked**
- The plan tied to the PRD.
- Redacted, policy-checked commands.
- The capability-lab gate.

**What did not work**
- The model label mismatch.
- The cloud boundary for design steps may be unclear (C1).
- Read-only editor.

**What was unclear**
- Exactly what "out-of-scope edits" covers under each autonomy level.

**What the user expected instead**
- A "Run configuration" panel: model per role, where data goes, and policy level.

**Local/cloud reaction.** Local by default. Would allow cloud for design only if it is shown on the run.

**Wish list**
1. A run configuration and data-flow panel.
2. A criteria trace.
3. An accurate model label.

**Simulated user comment** — _AI-generated persona comment:_ "Show me which model touched which step and whether anything left this machine. Then we can talk."

#### Sam · Session 2: Review and iteration

**Goal:** verify the result against the criteria, investigate a blocker, and make a targeted change to the filter logic.

**Key moments**
| Wants | Expects | FlowCode provides | Interpretation | Next | Feedback |
|---|---|---|---|---|---|
| Status he can trust | Done means checked | "Done, checked" vs "Stopped, needs you"; "Ready, not fully checked" when a check couldn't run [Doc]; the "Done" group also holds skipped steps [Code C4] | Approves of the gate; flags the skipped-in-Done grouping | Expands "How it's checked · N of M met" | "Skipped isn't done" |
| Understand a blocker | The real error | Technical mode opens agent notes and full check output [Doc]; Review → Needs attention | Hypothetical: a validation step stopped after 3 tries with the same failure fingerprint | Reads the output and spots a wrong date format in the sample data | Wants to fix the data himself, then Retry |
| No weakened requirements | Criteria unchanged | Automatic changes to acceptance criteria are deferred (not done) [Doc]; repair is bounded to 3 attempts [Doc] | Reassured by the design intent | Edits the JSON in VS Code, then Retry | Wants FlowCode to flag edits it didn't make |
| See what changed | A diff | Review → Changes made by step, with diffs and undo [Doc] | Good | Reviews diffs | Wants to export a patch or commit per step |

**Simulated experience.** Review is where Sam spends the session. Changes grouped by step is the right model for him. He tries the git commit action. It asks for approval, but the message says to look "in the Approvals tab", which no longer exists [Code C5]. He finds the card in "Needs you" instead. A small thing, but it dents his confidence in the copy. He asks the Copilot "which criteria are unmet?" and gets a grounded answer with a facts card [Doc]. He would still check the output himself.

**What worked**
- Review grouped by step.
- The honest gate states.
- Technical mode.
- Bounded repair.

**What did not work**
- Skipped steps grouped with done.
- A stale "Approvals tab" message.
- No patch export.

**What was unclear**
- Whether FlowCode picks up edits made outside it before the retry.

**What the user expected instead**
- An "External changes detected" notice before Retry.

**Local/cloud reaction.** Sees from the Models page that qwen3:14b passes 56% first try [Doc]. He reads this as "expect retries", not as good or bad.

**Wish list**
1. Show skipped separately.
2. Detect external edits.
3. Patch or commit per step.
4. Copy audit.

**Simulated user comment** — _AI-generated persona comment:_ "The completion gate is the best thing here. Small copy errors make me wonder what else is out of date."

#### Sam · Session 3: Repeat use and reflection

**Goal:** add an "overdue > 30 days" filter, compare cloud and local on it, and judge readiness to hand off.

**Simulated experience.** Sam runs the same change twice: cloud first, then local, from the same checkpoint via undo. FlowCode has no side-by-side run comparison (H5 is [Planned]). The Models page compares local models only, and "never recommends a cloud model" [Doc]. Sam compares by hand: diffs, tries per step and Journal timings. Sam doesn't generalise from one change. The Run Review and Journal give per-run "where the time went" and checks. Sam trusts these because they come from recorded events. He reads Launch readiness and finds it useful as a backlog for the real build. He would rewrite the security items himself.

**What worked**
- Records-based Journal.
- Decision log.
- Launch readiness as a backlog.

**What did not work**
- No controlled comparison between runs.
- No cost figure for the cloud run.

**What was unclear**
- Whether the Improvements proposals apply to all projects or just this one.

**What the user expected instead**
- A "compare these two runs" view: diff, checks, time and model.

**Local/cloud reaction.** Settles on local for logic, and cloud for design critique only, shown on the run.

**Wish list**
1. Run comparison.
2. A cost column.
3. Improvement scope shown clearly.

**Simulated user comment** — _AI-generated persona comment:_ "I'd use it for prototypes with acceptance criteria. I'd want a comparison view before I believe any claim that one model is better."

---

## 4. Open-ended questionnaire responses

All answers are **[Simulated]**, given after each persona's three sessions.

| # | Question | Maya | Jordan | Alex | Sam |
|---|---|---|---|---|---|
| 1 | What were you trying to accomplish? | A prototype that looks like my references and holds up on mobile | Something customers can use to request a cleaning | A working planner, fast | A dashboard that meets every acceptance criterion, built by a governed agent |
| 2 | What helped you get started? | Style capture and the Design tab before building | The "everyday words are fine" prompt and its example | One-line start plus Autonomous | Plan steps mapped to my PRD headings |
| 3 | What was difficult to understand? | Which model did the design work | Autonomy lists, "install", local vs cloud | Whether "possibly stalled" needed me | Assisted's "beyond scope" edits; the model label vs the recommendation |
| 4 | What did you expect FlowCode to handle? | Faithful layout and type from the spec | Everything technical, including going live | Iterating without me babysitting | Tests, checks and honest status |
| 5 | What did you expect to remain under your control? | Every visual decision and the design approval | Anything that costs money or touches my computer | Nothing beyond the request | Scope, criteria, what leaves the machine |
| 6 | How did you choose between local and cloud? | Local for structure, cloud for polish and critique | Local, because I feared costs | Local until stuck | Local, plus cloud design critique if it's shown |
| 7 | What information was missing from that choice? | Effect on design quality; which steps each covers | Cost, privacy in plain words, a recommendation | Typical time per option | Data flow per step, cost, measured comparison |
| 8 | How did you interpret the build status? | "Ready, not fully checked" meant "look again" | "Stopped, needs you" was clear; the facts card less so | Mostly ignored it unless it was red | Trusted the gate; distrusted "Done" holding skipped steps |
| 9 | What would make you think the build needed attention? | A design review that couldn't run | A red counter or a phone alert | The same step retrying repeatedly | Identical failure fingerprints, or edits outside scope |
| 10 | What did the approval request mean to you? | A formality, except the design approval | A safety question I wasn't qualified to answer | An interruption | A bound record of a specific action, which I value |
| 11 | How useful was Copilot's explanation? | Fine for status, not for design judgement | Helpful; wish it recommended | Good for "why slow?" | Good, and the facts card makes it checkable |
| 12 | What would make you trust or question its answer? | Trust: it cites the screen. Question: generic praise | Trust: it matches what I see. Question: jargon | Question: it's slower than looking myself | Trust: facts card. Question: anything not in the records |
| 13 | Where would you look to understand what changed? | Preview, then Review | Ask the Copilot | Preview only | Review → changes by step |
| 14 | What would you expect Changes and Diagnostics to contain? | Screens affected, before and after | "What's different now" in one line | Don't care | Diffs, commands, errors, and which model made them |
| 15 | How would you judge the generated design? | Against references and the spec: hierarchy, spacing, states | "Does it look professional?" | "Good enough to show?" | Consistency and code-level reuse of components |
| 16 | What would help you request a precise revision? | Pointing at an element; a scope preview | Examples of good requests | A quick-edit lane | Referencing a file, component or criterion |
| 17 | What would you need before considering the result ready to share? | All screens covered, critique passed, shareable link | To know what it can't do | A link to send | All criteria met with evidence; no unchecked items |
| 18 | What would you want a project retrospective to explain? | Which references and specs shaped which screens | What to do next, short | Where the time went | Model per step, failures and repairs, criteria status |
| 19 | What would you change in your next PRD or request? | Specs per screen with states | Say who uses each part | Split risky features | Clearer data formats in the sample JSON |
| 20 | What worked well enough to preserve? | Design-before-build and screen coverage | The Overview's fixed order; plain blockers | Undo; queued changes | The completion gate; the decision log; exact-action approvals |
| 21 | What would you improve first? | Device preview and point-and-say | Model-choice explanation with cost | Faster first result | Run data-flow and configuration panel |
| 22 | What is on your wish list? | §5.1 | §5.2 | §5.3 | §5.4 |
| 23 | What would make you use FlowCode again? | Reliable design fidelity with specs | Someone or something to take it live | Shorter builds | Honest evidence staying honest |
| 24 | What would make you stop using it? | Repeated generic designs | Surprise charges | Repeated multi-hour builds | Any hidden data leaving the machine, or a false "done" |

---

## 5. Individual user summaries

### 5.1 Maya, product designer
- **Profile and project:** a designer-founder building Pennywise, a finance-learning prototype.
- **Initial expectations:** a design tool that writes code, and respects references.
- **How expectations changed:** she learned that screen specs, not model choice, are her main lever on quality, and that FlowCode is honest when the critique can't run.
- **Most useful capabilities:** style capture; the Design tab before build; screen coverage and duplicate flags; screen specs; "Couldn't run".
- **Biggest frustrations:** generic visual output from local models; no live device frame; describing elements in words; file-based change summaries.
- **Communication needs:** visual, per screen, with before and after.
- **Design/output expectations:** hierarchy and spacing that follow tokens; complete states; consistent secondary screens.
- **Local/cloud preferences:** local for structure; cloud for polish and critique, chosen per change.
- **Trust concerns:** not knowing which model designed what; critique that silently depends on cloud credit.
- **Top three improvement requests:**
  1. A live device switcher.
  2. Point-and-say revisions.
  3. A reference-to-token mapping.
- **Simulated willingness to return:** likely, if design fidelity with specs holds up and mobile review gets easier. _Not a retention forecast._

| Wish | Underlying problem | Desired outcome | Clearer presentation enough? | New capability? | Real-user validation |
|---|---|---|---|---|---|
| Live device switcher | Mobile review needs window resizing | Phone/tablet frames in Preview | No | Yes (small) | Do designers review mobile in-tool or elsewhere? |
| Point-and-say edits | Verbal element descriptions are imprecise | Click an element, describe the change, see the scope | No | Yes ([Planned] H4) | Does it reduce revision rounds? |
| Reference-to-token mapping | Unclear how references were used | "From image 2: accent #… and radius 12" | Partly (the review step already says where the style came from) | Small extension | Do designers trust capture more with it? |
| Before/after per screen | File diffs aren't design diffs | Thumbnails of affected screens | Partly | Yes ([Planned] H5) | — |
| Per-change model choice | Global design-model setting | "Use cloud for this step" | No | Yes | Do users want this control or a good default? |
| Shareable prototype | No way to present | A link or export | No | Yes | Need and privacy expectations |

### 5.2 Jordan, non-technical novice
- **Profile and project:** a small-business owner building BookNest.
- **Initial expectations:** a usable app at the end.
- **How expectations changed:** learned "prototype" means a demo with simulated data. Became more comfortable with approvals once the consequences were explained.
- **Most useful capabilities:** the everyday-language start; the Overview order; plain blocker text; question vs change detection; Plain mode.
- **Biggest frustrations:** the model choice without cost or privacy explanation; technical autonomy terms; finding out the scope limit late; Launch readiness written for developers.
- **Communication needs:** recommendations with reasons; consequences in personal terms (money, computer, customers).
- **Design/output expectations:** "looks professional"; works on a phone.
- **Local/cloud preferences:** local by default, out of fear; cloud only with a spend cap.
- **Trust concerns:** unexpected charges; approving something harmful by mistake.
- **Top three improvement requests:**
  1. A plain model-choice explainer with cost.
  2. A "what this prototype can and can't do" card.
  3. Recommended next actions.
- **Simulated willingness to return:** uncertain. It depends on a credible path to a real app. _Not a retention forecast._

| Wish | Underlying problem | Desired outcome | Clearer presentation enough? | New capability? | Real-user validation |
|---|---|---|---|---|---|
| Model-choice explainer | Choice made from fear | Confident, informed choice | Mostly yes (copy plus help) | Cost estimates need new data | What do novices need to know to choose? |
| Prototype-limits card | Misread "prototype" | No late surprise | Yes | No | Does the card prevent the misunderstanding? |
| Recommended next action | Decision paralysis at a blocker | One suggested option, with its reason | Partly | Needs evidence-based ranking | Would novices accept a recommendation? Risk of over-trust |
| Autonomy in plain terms | Technical lists | Examples of what will and won't happen | Yes | No | Which wording works |
| Spend counter and cap | Cost anxiety | Visible spend; hard cap | No | Yes ([Planned] H6; the provider plan's daily cap is [Planned]) | Accuracy of cost data per provider |
| Non-developer Launch guide | Hand-off assumes a coding agent | A path to a real app | Partly | New content | What novices actually do next |

### 5.3 Alex, vibe coder
- **Profile and project:** a founder building Weekly through chat.
- **Initial expectations:** minutes to a working app.
- **How expectations changed:** accepted longer builds. Learned to split risky changes, use Assisted for risky features, and switch coder when stuck.
- **Most useful capabilities:** one-line start; Autonomous; queued changes; undo per step; question vs change detection.
- **Biggest frustrations:** total build time; fixed overhead for tiny changes; re-entering settings; wide ETA ranges.
- **Communication needs:** short, only when needed; "does this need me?"
- **Design/output expectations:** good enough to demo.
- **Local/cloud preferences:** local, switch to cloud when stuck. Wants FlowCode to suggest the switch.
- **Trust concerns:** low. Mainly whether FlowCode will finish.
- **Top three improvement requests:**
  1. An earlier first preview.
  2. A small-change fast path.
  3. Reuse settings from the last build.
- **Simulated willingness to return:** likely for quick prototypes if build time drops. _Not a retention forecast._

| Wish | Underlying problem | Desired outcome | Clearer presentation enough? | New capability? | Real-user validation |
|---|---|---|---|---|---|
| Earlier first preview | Long wait to see anything | A skeleton early, then refinement | No | Planner change | Does early rough output help or disappoint? |
| Small-change fast path | Same ceremony for every change | Quick edits with only the affected checks | No | Yes | Risk of skipping needed checks |
| Reuse settings | Re-entry on every build | "Same as last build" | No | Yes ([Planned] Q6) | — |
| Suggest model switch when stuck | User guesses | A data-backed suggestion | No | Yes ([Planned] H2) | Does switching actually help? Needs measurement |
| Split batched requests | One failure blocks all | Independent items | No | Yes | — |
| Live "where time goes" | Learned only after the run | A live breakdown | Partly (performance data exists) | UI | — |

### 5.4 Sam, developer
- **Profile and project:** a full-stack developer building Chaser.
- **Initial expectations:** a governed coding agent with evidence.
- **How expectations changed:** grew to trust the completion gate and decision log. Became more alert to copy and labels that don't match behaviour.
- **Most useful capabilities:** the completion gate and honest states; Review grouped by step; Technical mode; bounded repair; exact-action approvals; decision log; records-based Journal.
- **Biggest frustrations:**
  - the unclear cloud boundary for design steps (C1);
  - the model label mismatch (C2);
  - skipped steps shown as Done (C4);
  - stale copy (C5);
  - a read-only editor;
  - no run comparison.
- **Communication needs:** exact facts, sources, configuration.
- **Design/output expectations:** consistent component reuse and maintainable structure.
- **Local/cloud preferences:** local by default; cloud for design critique only, shown on the run.
- **Trust concerns:** hidden data egress; false completion; silently weakened criteria.
- **Top three improvement requests:**
  1. A run configuration and data-flow panel.
  2. Separate the skipped state from Done.
  3. Run comparison.
- **Simulated willingness to return:** likely for criteria-driven prototypes, if boundaries are explicit. _Not a retention forecast._

| Wish | Underlying problem | Desired outcome | Clearer presentation enough? | New capability? | Real-user validation |
|---|---|---|---|---|---|
| Run config and data-flow panel | Unclear which model did what and where data went | Per-role model and egress list on every run | Partly (Journal "who did what" exists after the run) | Small | Do developers check it? |
| Skipped not in Done | Inflated progress | Distinct group | Yes | No | — |
| External-edit detection | Retry after a manual fix | "We see you changed X" | No | Yes | — |
| Criteria trace | Proving coverage | Criterion → step → evidence | Partly | Small | — |
| Run comparison | No controlled comparison | Side-by-side diff, checks, time | No | Yes ([Planned] H5) | — |
| Patch or commit per step | Hand-off to own repo | Export | No | Yes | — |

---

## 6. Consolidated report

### 6.1 What appears to work
| Strength | Why it likely works | Personas who value it most | Basis |
|---|---|---|---|
| Honest verification states ("Ready, not fully checked", "Couldn't run" vs "Skipped") | Prevents the most damaging failure: a false "done" | Sam, Maya | [Doc] Phase 1 and open-question-1 results |
| Design-before-build (style capture, Design tab, plan and design approval) | Matches how designers work; catches direction problems early | Maya | [Doc] prototype-builder plan |
| Screen coverage and screen specs | Turns a vague "it feels generic" into specific gaps | Maya, Sam | [Doc] Phase 5 |
| Overview in a fixed order, with "Needs you" | Answers "where does it stand / what do I do" in one place | Jordan, Alex | [Doc] content-clarity results |
| Plain blocker translation that separates FlowCode's work from the user's decision | Removes the reported "write the tests yourself" confusion | Jordan | [Doc] F2 fix |
| Grounded Copilot with facts card and scoped history | Answers can be checked | Sam, Jordan | [Doc] F1/F3 fix |
| Question vs change detection in chat | Prevents accidental builds | Jordan, Alex | [Doc] F8 fix |
| Undo per step and per file; queued changes | Recovery without restarting | Alex | [Doc] |
| Exact-action approvals plus decision log | Approvals are auditable and can't be misapplied | Sam | [Doc] Phase 3 |
| Records-based Run Review and Journal, with statement labels | Retrospectives that separate fact from interpretation | Sam, Maya | [Doc] |

### 6.2 What may not work
These are hypotheses grounded in the materials, not observed user behaviour.

| Friction | Why it may happen | Personas most affected | Basis |
|---|---|---|---|
| The local/cloud choice doesn't explain cost, speed, quality or data flow | Two radio options with one-line notes; no cost data; "faster" unmeasured | Jordan, Maya, Sam | [Code] C3, C9; [Reported] "no cost or speed preview" |
| The "code stays here" copy may not match design-step cloud use | Global Design model = Cloud by default; the project allows hosted models even with a local coder | Sam, Jordan, Maya | [Code] C1. **Unverified.** |
| Long builds; wide ETA ranges | Failed commands and restores dominate recorded runs; ETA was right about 61% of the time in the back-test | Alex, Jordan | [Reported] F9; [Doc] back-test |
| Generic design from local models; critique depends on cloud credit | Reported user feedback; the design crit uses the cloud either way | Maya | [Reported] P2; [Doc] |
| Revisions are imprecise | No element picking; summaries by file, not by screen | Maya, Alex | [Planned] H4; [Doc] |
| Mobile review is awkward | No device switcher in the live preview | Maya, Jordan | [Code] C7 |
| Prototype scope misunderstood | "Prototype" carries no meaning for novices; Launch hand-off assumes a coding agent | Jordan | [Doc] plus [Simulated] |
| Same overhead for every change | Every follow-up is a planned, checked run | Alex | [Doc] lifecycle; [Assumption] about the overhead |
| Repeated set-up | No settings reuse | Alex, Maya | [Reported]; [Planned] Q6 |
| Label and copy drift erodes trust | Hard-coded model name, stale "Approvals tab", skipped shown as Done, route names | Sam | [Code] C2, C4, C5, C6, C8 |
| Technical vocabulary in autonomy lists and the facts card | Lists written in policy terms | Jordan | [Code] |

### 6.3 Persona comparison
| Area | Designer (Maya) | Novice (Jordan) | Vibe coder (Alex) | Developer (Sam) |
|---|---|---|---|---|
| Main goal | A faithful, polished prototype | A usable app for customers | Fast working result | A criteria-verified build with evidence |
| Most useful capability | Style capture plus screen coverage and specs | Overview "Needs you" plus plain blockers | Autonomous plus undo plus queued changes | Completion gate plus Review by step plus decision log |
| Biggest concern | Generic visuals; imprecise edits | Cost and making a harmful choice | Build time | Hidden egress; false done |
| Communication preference | Visual, per screen | Plain, with a recommendation | Brief, only when needed | Exact, sourced, technical |
| Local/cloud considerations | Cloud for polish and critique, per change | Needs cost and privacy explained; defaults local | Local until stuck; wants a suggestion | Local by default; cloud only if shown on the run |
| Top improvement | Device preview plus point-and-say | Model-choice explainer plus prototype-limits card | Earlier first preview / fast path | Run configuration and data-flow panel |

### 6.4 Wish-list themes
- **Communication and guidance**
  - Model-choice explainer (Jordan, Maya).
  - Prototype-limits card (Jordan).
  - Autonomy described with examples (Jordan).
  - Recommended next action with its reason (Jordan).
  - A non-developer Launch guide (Jordan).
- **Builder navigation**
  - A live device switcher (Maya, Jordan).
  - A more visible Plain/Technical switch (Alex didn't notice it).
  - Consistent page names (Sam).
- **Design quality**
  - Reference-to-token mapping (Maya).
  - Per-screen state checklist in the plan (Maya).
  - Specs with sketches (Maya).
  - A local critique fallback (Maya; a proposal already exists).
- **Iteration and change control**
  - Point-and-say (Maya, Alex).
  - Changes summarised by screen, with before and after (Maya).
  - A small-change fast path (Alex).
  - Splitting batched requests (Alex).
  - External-edit detection (Sam).
  - Patch or commit export (Sam).
- **Progress and recovery**
  - An earlier first preview (Alex).
  - Narrower, task-type ETAs (Alex).
  - "Does this need me?" on stall warnings (Alex).
  - Live time breakdown (Alex).
- **Model choice**
  - Per-change model choice (Maya).
  - A suggestion to switch when stuck (Alex).
  - Run comparison (Sam, Maya).
  - An accurate model label (Sam).
  - A spend counter and cap (Jordan).
- **Approvals and trust**
  - A run data-flow panel (Sam).
  - Approval language in personal terms (Jordan).
  - Skipped not grouped with Done (Sam).
  - Copy audit (Sam).
- **Retrospectives and continuous improvement**
  - A short Journal summary (Jordan).
  - Clear improvement scope: project vs global (Sam, Alex).
  - One-tap "try this improvement" (Alex).
  - "Which references and specs shaped which screens" (Maya).

### 6.5 Prioritized opportunities

Ordered by potential consequence, fit with FlowCode's principles ("local by default, external by consent", "evidence over narration") and strength of supporting context. This is not based on frequency.

| # | Opportunity | Underlying problem | Relevant personas | Proposed response | Basis/assumption | Real-world validation needed |
|---|---|---|---|---|---|---|
| 1 | **Make model use and data flow explicit per build** | Local choice may not cover design steps; the "code stays here" copy may be inaccurate | Sam, Jordan, Maya | First confirm C1 live. Then, on New build, show "Design steps: Cloud (change)" next to the coder choice, and use a hosted-model approval or clear consent. Add a per-run "Models and data" panel | [Code] C1 (unverified); a core principle | Do users notice and understand the panel? Would they have chosen differently? |
| 2 | **Explain the local/cloud choice in user terms** | Choices made from fear or guesswork; no cost data; "faster" unmeasured | Jordan, Maya, Alex | Replace "faster" with measured or neutral wording. Add a "Help me choose" explainer: privacy, cost model, quality notes. Fix the hard-coded model name | [Code] C2, C3, C9; [Reported] | Which facts change novices' choices? |
| 3 | **Reduce and expose wasted build time** | Retries, restores and failed commands dominate recorded runs | Alex, Jordan | Show a live "where the time is going" summary in Overview. Investigate the top repeat-failure fingerprints | [Reported] F9 | Do users intervene earlier or better with it? |
| 4 | **Prototype-limits card for novices** | "Prototype" misread | Jordan | A plain card on New build and in Preview: "works on this computer, data is pretend, here's how to make it real" | [Simulated]; copy exists but is brief | Does it prevent the misunderstanding without discouraging users? |
| 5 | **Live preview device switcher** | Mobile review is awkward | Maya, Jordan | Phone, tablet and desktop frames in Preview | [Code] C7 | Usage frequency vs screenshots |
| 6 | **Precise revisions** | Verbal element descriptions; file-level summaries | Maya, Alex | Point-and-say (H4); "This change affects: screens…" with before/after thumbnails | [Planned] H4/H5 | Do revision rounds drop? |
| 7 | **Truthful labels and copy** | Copy drift dents trust | Sam | Show skipped separately; fix the "Approvals tab" message; consistent page names; update the README quick start | [Code] C4–C6, C8 | Low risk. Verify with a copy audit |
| 8 | **Recommended next action at blockers** | Decision paralysis | Jordan | Rank the supported actions only when there's an evidence basis; otherwise say none exists | [Doc] blocker translator; [Assumption] | Over-trust risk; acceptance |
| 9 | **Settings reuse and a small-change path** | Repetition and ceremony | Alex, Maya | "Same as last build"; a fast path for cosmetic changes that still runs the affected checks | [Reported]; [Planned] Q6 | Whether fast-path changes cause regressions |
| 10 | **Run comparison** | No controlled local/cloud evaluation | Sam, Maya | Side-by-side diff, checks, time and model | [Planned] H5 | Whether users make model decisions with it |

### 6.6 Recommendations

**Clarify now** (copy and presentation, low risk)
- Confirm or rule out C1 (cloud design steps when Local is chosen). If confirmed, correct the "code stays here" copy at once.
- Replace the hard-coded `qwen3-coder:30b` label with the actual configured coder. Remove "faster" unless it is measured.
- Show skipped steps separately from "Done". Fix the "Approvals tab" message. Align page names. Update the README quick start.
- Add plain examples to the autonomy levels and approval cards ("what this means for you").
- Add a prototype-limits card.

**Improve next**
- A per-run "Models and data" panel, plus a hosted-model consent that matches the autonomy lists.
- A "Help me choose" model explainer. Show cost data once the provider usage data supports it.
- A live time breakdown in Overview, and work on the leading repeat-failure causes.
- A live preview device switcher.
- Changes summarised by screen, with before and after.

**Explore later**
- Point-and-say (H4), run comparison (H5), step-level routing and switch suggestions (H2), settings reuse (Q6).
- Small-change fast path; splitting batched requests; per-change model choice; a non-developer Launch guide; a shareable prototype link.

**Preserve**
- The completion gate and honest check states. Never show an unrun check as passed.
- Design-before-build. Screen coverage and specs.
- The Overview's fixed order and "Needs you". Exact-action approvals. The decision log.
- Grounded Copilot with its facts card. Question vs change detection.
- Undo per step and per file. Queued changes.
- Statement labels in the Journal (Observed / Suspected cause / …).
- Optional improvements, never auto-applied.

### 6.7 Questions for real users
1. When people pick "Local", what do they believe happens to their code, screenshots and design steps? Would they object to cloud design use they weren't told about?
2. What do non-technical users understand "prototype" to mean? When do they realise its limits?
3. Which facts (cost, privacy, speed, quality) actually change a local/cloud decision?
4. Would people act on a wide ETA range, or does it reduce trust? Would an earlier rough preview be better?
5. Do designers review mobile inside FlowCode, or move to other tools? Would a device frame change that?
6. Does point-and-say reduce revision rounds compared with typed requests?
7. Do novices want a recommended action at blockers, and do they over-trust it?
8. Do developers open a per-run configuration and data-flow panel, and does it change their trust?
9. Is the Plain/Technical switch discovered and used?
10. Are the Journal and Improvements pages used by anyone other than developers, and what length works?
11. Does generic local design remain a problem once screen specs are used?
12. How much per-change overhead do vibe coders tolerate before leaving?

---

## 7. Proposed continuous-improvement records

These are proposals for the FlowCode Improvements backlog. **None is applied automatically.** None is verified because personas reacted to it. Each needs approval before any change is made.

| ID | Hypothesis or reported issue | Supporting context | Expected user benefit | Proposed change | Destination | Validation method | Approval | Status |
|---|---|---|---|---|---|---|---|---|
| VUS-01 | Choosing "Local" may still let design steps and the critique use the cloud, contradicting "code stays here" | [Code] `server.ts` sets `allowHostedModels` when Design model = Cloud; `orchestrator.ts` design-cloud path; Models page copy | Accurate consent; trust | (1) A live test with a cloud key set and Local chosen, checking the provider calls in events. (2) If confirmed: show the design model on New build, correct the copy, and apply the hosted-model consent | Code + specification | An event log check on a test project; copy review | Required (consent and policy change) | Needs validation |
| VUS-02 | The Local label names a hard-coded model | [Code] `NewBuild.tsx` | Accurate configuration | Render the configured coder model | Code | UI check against the Models page | Required (code) | Ready to verify |
| VUS-03 | "Faster" for Cloud is unmeasured | [Code] C3; no supporting data | Honest choice | Neutral wording or measured data | Code (copy) | Copy review | Required | Needs validation |
| VUS-04 | Skipped steps are grouped under "Done" | [Code] `STEP_GROUPS` | Accurate progress | Separate "Skipped (not needed)" group | Code | UI test on a run with skipped steps | Required | Ready to verify |
| VUS-05 | Stale "Approvals tab" message; outdated README quick start; inconsistent route names | [Code] C5, C6, C8 | Fewer trust-eroding inconsistencies | Copy audit and fixes | Code + reference doc | Copy audit checklist | Required | Ready to verify |
| VUS-06 | Novices misread "prototype" | [Simulated] Jordan; brief existing copy | Fewer late surprises | Prototype-limits card on New build and in Preview | Code + specification | Moderated test with 5+ novices: comprehension before building | Required | Needs validation |
| VUS-07 | The model choice lacks plain cost, privacy and quality context | [Reported]; [Code] C9 | Informed, confident choices | A "Help me choose" explainer; cost data later | Code + reference (Copilot knowledge) | Choice comprehension test | Required | Needs validation |
| VUS-08 | Autonomy lists use policy vocabulary | [Code] `autonomy.ts` | Novices understand what they're approving | Add plain examples per level; keep the exact lists under Technical | Code (copy) + specification | Comprehension test | Required | Needs validation |
| VUS-09 | Mobile review needs window resizing | [Code] C7; guide copy | Easier mobile review | Preview device frames | Code | Designer task test | Required | Needs validation |
| VUS-10 | Users learn where the time went only after the run | [Reported] F9; performance API exists | Earlier, better interventions | Live time breakdown in Overview | Code | Compare intervention timing on later runs | Required | Needs validation |
| VUS-11 | Revision requests are imprecise and change summaries are by file | [Planned] H4; [Doc] Review | Fewer revision rounds | Per-screen change summary first, then point-and-say | Specification, then code | Count revision rounds before and after on matched tasks | Required | Needs validation |
| VUS-12 | Copilot knowledge may describe outdated tabs and flows | [Code] C5/C8 drift suggests risk | Accurate Copilot help | Review the Copilot feature knowledge against the current Builder | Reference doc / prompt | Fixture questions about the tabs | Required (prompt change) | Needs validation |

**Rollback for every record:** revert the copy or code change. Prompt and reference changes roll back through the existing versioned prompt and skill tables. No record changes acceptance criteria, models, dependencies, tests or project instructions.

---

_End of report. FlowCode was not launched. No builds, browser tests or model calls were made, and no application code was changed for this simulation._
