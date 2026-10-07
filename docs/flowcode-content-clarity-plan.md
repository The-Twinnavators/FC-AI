# FlowCode: content clarity, Builder UX and visual communication — plan

_7 October 2026. This is the plan only. Navigation and shared design are unchanged until it is approved._

## 1. Current UX findings (from the code and the running app)

| Area | What it actually is today | Problem |
|---|---|---|
| **Changes** tab | A table of file snapshots (`ChangesPanel`): each file FlowCode saved before editing, with a diff and undo. | The label suggests "what changed in my app", but it's an undo history by file. There is no summary of what a run changed, and no link to the step that changed each file. |
| **Diagnostics** tab | Raw events (`model.failed`, `policy.rejected`, `process.cleanup`, `tool.rejected`) with event type names, plus "command fingerprints" (`RunDiagnostics`). | Written for developers ("command fingerprints", event ids). It overlaps with the checks bar, Troubleshoot and the new Run Review, and doesn't say what the user should do. |
| **Details** (left panel) | One column stacking the request, coder line, plan toggle, run activity (new), stop report, run review (new), steps, and Troubleshoot buttons. | No fixed order or hierarchy. The newest additions (activity, review) make it longer, and the status appears in several places in different words. |
| **Plan steps** | A step list with a status pill, "STEP n · ATTEMPT n", Roll back, and expandable criteria. | Internal words ("attempt", "invalidated", agent outcomes). "Done" and "verified" are not distinguished visually, and there is no plain "what you get" line per step. |
| **Notifications** | Toasts, bell sounds and phone push. | Not linked to the step, approval or review that caused them, so you can't trace a toast back to the build. |
| **Approvals** | Builder tab plus the new Approvals page (Phase 3). | Still a separate tab inside the builder. They don't appear in chat. |
| **Activity** | An event feed. | Mixes progress, retries and decisions with the same weight. No links to steps or findings. |
| **Terminal** | Command output. | Fine as technical output. It shouldn't be the place users learn status. |
| **Styles** | The palette, type and look controls, plus the new Screens list. | Now holds more than styles (direction, screens, specs), so "Design" fits better. |

**Typography (measured from the CSS)**
- Tokens exist in `tokens.css`: `--fs-micro` 10 / xs 11.5 / sm 12.5 / md 14 / lg 17 / xl 32 / display 60, spacing `--s-1…8` (4–80px), radius 4–10px.
- `responsive.css` hard-codes 556 font sizes instead of using them. The most common are 12.5px (107×), 12px (103×), 13px (101×), 11.5px (45×) and 11px (44×).
- Much text users act on (blocker reasons, review findings, approval explanations) is 12–13px.
- The scale jumps from 17px straight to 32px, so section headings have no step of their own and are styled ad hoc.

## 2. Reference analysis: Supernova Enterprise and Documentation

**How I looked:** both pages were rendered in the browser at desktop width (2188px viewport) and the enterprise page at mobile width (375px). Computed styles were read with script, and screenshots were taken of the first screens. I did not click the cookie banner, so lower sections were measured from computed styles rather than seen in full. The animated sections were not inspected frame by frame.

**Measured (computed styles)**
| Element | Desktop | Mobile (375px) |
|---|---|---|
| H1 | 64–72px, weight 300, line-height 1.0–1.05, tracking −0.01em | 32px, line-height 1.0 |
| Section H2 | 52px, weight 300–400, line-height 1.1, tracking −0.02em; the hero-style closing H2 is 64px | 32px |
| Feature H3 | 20px, weight 600, line-height 28px | 18px |
| Lede | 18px / 28px | — |
| Body | 16px / 22–24px, muted grey (`#5d6270`) | 14px / 21px |
| Text column width | 410–631px (about 55–70 characters) | — |
| Heading → its paragraph | H2 → lede 16–20px; H3 → paragraph 12px | — |
| Section padding | 64–144px vertical | 56–84px |
| Feature cells | 32px padding; set apart by 1px dividers, not boxed cards (radius 0) | 28px padding |
| Font | One family (Manrope) for everything; hierarchy from size and weight alone | — |

**Observed (screenshots)**
- Each section introduces one idea: a short H2, one sentence of lede, then three columns of "bold lead sentence + one sentence + a small real UI fragment".
- The visuals are the product itself, not illustrations: a docs page with an agent prompt, a team list, a checklist with status chips.
- Sections run 25–150 words (counted per section). The page never shows a long paragraph.

**Inferred (not measured)**
- Large, light headings carry the sequence; small, bold H3s carry scanning.
- Generous space between sections and tight space inside a group (12–16px) is what makes grouping readable without boxes.
- Primary actions are single, high-contrast buttons, with the secondary as plain text.

**Principles to adopt in FlowCode** (adapted to an app, not a marketing page)
1. One idea per block. A title, one plain sentence, then facts.
2. Tight inside a group (8–12px), clearly apart between groups (24–36px).
3. Dividers instead of nested cards for lists of similar items.
4. Hierarchy from size and weight in one family. FlowCode already uses Manrope.
5. Show the product: real screenshots and real UI fragments explain capabilities better than paragraphs.
6. Reading width of about 65 characters for explanations.

## 3. Proposed Builder information architecture

| Area (new label) | Answers | Contents | Primary action | Form |
|---|---|---|---|---|
| **Overview** (replaces Details) | "What is this build for, and where does it stand?" | Goal → status line (Run activity) → what needs you → plan and progress → latest review summary → limitations. Always in this order. | The one decision needed, if any | Left panel, fixed order |
| **Preview** | "What does my app look like and do?" | Live preview, device sizes, preview status, design findings for the visible screen | Open in a new window / change device | Tab |
| **Design** (renamed Styles) | "How is my app styled, and is every screen designed?" | Direction, tokens, type and colour, Screens and specs | Draft or save a screen spec | Tab |
| **Review** (merges Changes and Diagnostics) | "What changed, what was checked, what needs attention?" | Five sections, kept distinct: 1 Changes made (files grouped by step, undo per file); 2 Checks and results; 3 Needs attention; 4 Couldn't run or skipped; 5 Suggested next actions. Each leads with a plain summary; diffs, fingerprints and raw events are behind "Technical details". | The top suggested action | Tab |
| **Activity** | "What has FlowCode been doing?" | A timeline grouped by step: progress, retries, decisions. Each entry links to its step or finding. | — | Tab (record only) |
| **Technical output** (renamed Terminal) | "What happened at the command level?" | Commands, logs, provider events (moved from Diagnostics) | Copy / filter | Tab, last |
| **Approvals** | — | Removed as a builder tab. Approvals appear as cards in chat and in Overview → "Needs you", with the Approvals page as the full list. Same records everywhere. | Approve / Deny | Chat card + page |

**Notifications:** each toast or push carries `{projectId, runId, target: step | approval | finding | review}` and opens that exact place. A toast always says what happened, which build, whether action is needed, and where to look.

## 4. Content and typography system

**Shared content pattern** (Overview, steps, findings, notifications, approvals, reviews)
1. Title.
2. One-sentence summary.
3. Status.
4. Key facts.
5. Evidence or steps.
6. Primary action.
7. Technical details (collapsed).

**Plan-step pattern**
- **Shown:** the plain name; the outcome for the user ("You can search brands by name"); a status of *Not started*, *Working*, *Done — checked*, *Done — not checked*, or *Stopped — needs you*; what FlowCode is doing now; the result of the checks; and an action only when needed.
- **Hidden behind "How it went":** attempts and agent outcomes.
- **Grouping:** steps are grouped as Verified, Working, Stopped and Not started.

**Semantic type tokens**
These would be added to `tokens.css`, then used in place of hard-coded sizes, starting with the Builder.
| Token | Size / line-height / weight | Use |
|---|---|---|
| `--type-page` | 28 / 34 / 650 | Page title |
| `--type-section` | 20 / 28 / 650 | Section heading (the missing step between 17 and 32) |
| `--type-item` | 15 / 22 / 600 | Item title (step, finding, approval) |
| `--type-body` | 14 / 22 / 400 | Body, and anything a user acts on (never below 14) |
| `--type-support` | 13 / 20 / 400, `--text-1` | Supporting text |
| `--type-meta` | 12 / 16 / 500, `--text-2` | Timestamps, counts, labels (metadata only) |
| `--type-status` | 12 / 16 / 650, +0.02em uppercase | Status chips |
| `--type-code` | 12.5 / 18, mono | Technical output |

- **Spacing:** keep `--s-*`. Use 8–12px inside a group, 24px between groups and 36px between sections.
- **Width:** explanations get `max-width: 65ch`.
- **Surfaces:** one subtle surface per panel; lists use dividers, not nested cards. This matches the saved preference: no nested cards and no thick accent bars.

The rules would be written to `docs/flowcode-ui-type-and-spacing.md`, so FlowCode's own design guidance can reuse them.

## 5. Guided and Technical modes

- **Labels:** "Plain language" and "Technical details". The setting is in Settings → Display, plus a toggle in the builder header. It is saved locally per user (the existing settings pattern) and doesn't depend on who the user is.
- **Both modes use the same facts** (`runFacts`, `plainBlocker`, check states). Only the wording and which details are expanded change.
- **Plain language** shows what is happening, why it matters, what FlowCode handles, what you decide, and what happens next. Technical sections start collapsed.
- **Technical details** adds commands, file paths, tool outcomes, model and runtime, test output and error text, with sections open by default.
- **Never hidden in either mode:** failures, risks, spending, checks that were skipped or couldn't run, and pending approvals. A test enforces this: the same run must produce the same set of warnings in both modes.
- **Permissions and safety don't change with the mode.**

## 6. Project Journal

**Name:** "Project Journal", described as "See what FlowCode did, what worked, what needs improvement, and what to try next." An "Agent Blog" would read like commentary rather than evidence.

**Built from existing records:** Run Review (per run), the decision log, the improvement backlog, run activity and performance measurements, fix memory, PRD versions and user feedback. It never generates a competing set of facts.

**Per run**
- Asked for.
- What each role contributed: the planner, coder, designer and critic steps attributed from `modelAssignments` and the step roles. Only recorded contributions are shown.
- What worked, what went wrong, what was repaired (fix memory, recoveries), what's incomplete, and what was and wasn't checked.
- Time by phase.
- PRD clarity: steps that stopped on a missing or ambiguous requirement, quoting the PRD line.
- Next steps and proposals.

Each statement is tagged *Observed*, *Suspected cause*, *AI interpretation*, *Verified improvement* or *Open question*, and links to its evidence (event, diff, test, screenshot).

**Chat:** reuses the grounded Copilot path, scoped to the selected project and run. Questions like "why did this take so long?" are answered from the performance and activity data. History is scoped as in Phase 1.

**Actions** (all approval-gated): improve the PRD (a drafted diff), open the unresolved issue, create a follow-up change, or propose a skill update (into Improvements).

## 7. About page storyboard

1. **What FlowCode does:** one sentence, with a real screenshot of a finished prototype in the builder.
2. **Who it's for:** three short audience lines.
3. **How it works:** a Problem → PRD → Plan → Build → Review diagram drawn from the real stages, each step linked to the page that does it.
4. **You stay in charge:** an annotated real approval card and the Overview "Needs you" block.
5. **Quality you can check:** a real Run Review excerpt showing passed checks and one "Couldn't run", which shows that limitations are visible.
6. **It learns from outcomes:** the Improvements lifecycle with a real proposal. Planned items are labelled "Planned".
7. **Design that's specified:** a screen spec next to the built screen (before/after).
8. **Get started:** "Let's build something" / "Let's solve something".

- **Visuals:** screenshots from a demo project with no sensitive content, Lucide icons, and unDraw only for empty states.
- **Rules:** no promises about speed or production readiness. Mockups are labelled.

## 8. Files expected to change

- **Phase 2 (Builder):**
  - `views/WorkspaceView.tsx`, split into `Overview.tsx`, `ReviewPanel.tsx` (Changes + Diagnostics) and `ActivityTimeline.tsx`;
  - `components/SignalStrip.tsx`;
  - the toast and notification helpers;
  - `styles/tokens.css` (semantic type tokens) and a new `styles/builder.css`;
  - `docs/flowcode-ui-type-and-spacing.md`.
- **Phase 3 (modes and approvals):**
  - the `Copilot.tsx` approval card;
  - `ApprovalCard.tsx` (structured states);
  - Settings → Display;
  - a `useDisplayMode` hook;
  - the daemon `GET /approvals/:id` (for pending, approved, denied, expired and superseded states).
- **Phase 4 (Journal):**
  - `views/JournalView.tsx`;
  - daemon `quality/journal.ts` (assembles the existing records);
  - a scoped Copilot entry.
- **Phase 5:** `views/GuideView.tsx` (About) plus screenshot assets from a demo project.

## 9. Phases and approval needs

| Phase | Scope | Needs your approval before starting |
|---|---|---|
| 1 Audit and structure | This document | — (done) |
| 2 Builder clarity | Overview, Review, Activity, Design rename, linked notifications, type tokens in the Builder | **Yes:** renaming and merging Builder tabs is a navigation change |
| 3 Modes and approvals | Plain / Technical modes, approval cards in chat, persistent indicator (exists) | Yes for the chat approval cards (a governance surface) |
| 4 Project Journal | Evidence-backed retrospectives and scoped chat | No new data. Proceeds after Phase 2 |
| 5 About | Visual product story | Yes: it uses screenshots of a demo project, so choose which project |

**Questions**
1. May Approvals leave the builder's tab bar (staying in chat, Overview and the Approvals page)?
2. Do you prefer "Overview" or "Project overview" for the renamed Details?
3. Which project can appear in About-page screenshots? No BIO & GMO is the most complete.

---

## Results (7 October 2026)

**Your decisions:** Approvals leave the builder's tab bar, Details is renamed "Overview", and the About screenshots use No BIO & GMO.

**Phase 2: Builder clarity**
- **Tabs:** Preview · Design (was Styles) · Review (Changes and Diagnostics combined) · Activity · Technical output (Terminal, with the runtime events folded beneath it). Old tab names still lead to their new places, so Copilot "Show me" steps and chat buttons keep working.
- **Overview, always in this order:**
  1. goal;
  2. **Where it stands** (live state, or the outcome for a finished build);
  3. **Needs you** (the plan approval and other blocking approvals, with links to the Approvals page and the phone page; optional ideas get a one-line pointer);
  4. **Plan and progress**, with steps grouped as Stopped, Working, Done and Not started;
  5. **Latest review**, with a link to the Project Journal.
- **Steps:**
  - plain statuses ("Done, checked", "Stopped, needs you", "Waiting on an earlier step");
  - "How it's checked · N of M met · tries" folded away;
  - a stopped step leads with the plain explanation and "You decide: …", with the agent's note under "Technical details".
- **Review:** a one-sentence summary, then Needs attention (stopped steps, failed checks with "Run it again"), Couldn't run or skipped, Checks and results, and Changes made by step (every file, diff and undo folded beneath).
- **Notifications:** each names the build and opens the exact place:
  - inside a build, its Overview;
  - for other builds, the Approvals page or that build's Overview.

  They are buttons, so they can be reached with the keyboard.
- **Type and spacing:** semantic tokens added to `tokens.css` (`--type-*`, `--gap-*`, `--read-width`). Rules are in [flowcode-ui-type-and-spacing.md](flowcode-ui-type-and-spacing.md). The new Builder pieces use them. The rest of the 556 hard-coded sizes are left for a later pass.

**Phase 3: Plain language / Technical details**
- **Where to switch:** Settings → Explanations (with examples of each), and a switch in the Overview header ("Plain" / "Technical"). The choice is saved on this computer.
- **What changes:** in Technical mode, the technical sections open by default and checks show their full output instead of the first line.
- **What doesn't change:** the same sections and facts render in both modes, so failures, couldn't-run checks and approvals are never hidden.
- **Approvals in chat:** pending blocking approvals appear as structured cards at the top of the Copilot and in the project chat. Each card shows the project, "Needs your OK", the exact action, risk, consequences, and Approve once / for the project / Deny. Recent decisions are shown with their state.
  - Chat text never approves anything.
  - Cards use the same approval records as the Overview, the Approvals page and the phone page, and send back the exact action (Phase 3 of the improvement plan).

**Phase 4: Project Journal** (`/journal/:project/:run`, also in the project ⋯ menu and in the Overview's Latest review)
- **Built from existing records only:** run reviews, the decision log, improvements, run performance and the plan's PRD brief (`quality/journal.ts`).
- **Sections:** who did what (model calls and steps per role, as recorded), what worked, what went wrong, what was repaired, still incomplete, not checked, checked, where the time went, how clear the PRD was, and what to try next.
- **Labels:** each line is Observed, Suspected cause, FlowCode's reading, Verified or Open question.
- **"Ask about this run":**
  - answers come from that run's journal only, worded by a local model at low temperature;
  - an answer quoting anything not in the records falls back to the records themselves;
  - switching project or run clears the conversation.

**Phase 5: About** (About FlowCode, above the feature catalog)
- **Structure:** a story in eight short sections: what it does, who it's for, how a build works (Problem → PRD → Plan → Build → Review, each linked), see where the build stands, you stay in charge, quality you can check, every screen gets a design, it learns from what happened, and how to get started.
- **Pictures:** small UI fragments built from FlowCode's own colour and type tokens (they follow light and dark mode), drawn from what FlowCode shows for No BIO & GMO. Replaced the earlier screenshots, which clashed with the page and both themes.
- **No over-promising:** the page states that FlowCode builds prototypes, not production apps.
- **Layout:** stacks to one column on narrow screens, and reduced motion is respected.

**Checks**
- `tsc` for contracts, daemon and UI: clean.
- Full test suite: 103 files, 1,146 passed. New: `journal.test.ts` (4).
- UI production build: OK.

**In the browser**
- Builder Overview and Review, the Journal, and the About page at desktop width.
- About at a narrow width: no horizontal overflow, one column.
- Notification links were checked in code; not exercised by a live event this session.

**Not done or limits**
- Keyboard and focus were reviewed in code (native buttons, details and summary, focus-visible styles), not with a screen reader.
- Hard-coded font sizes outside the new Builder pieces are unchanged.
- "Superseded" isn't an approval state yet. A replaced request shows as expired or decided.
