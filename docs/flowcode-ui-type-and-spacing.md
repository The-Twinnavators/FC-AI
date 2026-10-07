# FlowCode UI: type, spacing and content rules

These rules apply to FlowCode's own interface. The tokens live in `apps/ui/src/styles/tokens.css`. New UI uses the semantic roles below instead of raw pixel sizes.

## Type roles

| Token | Font (weight size/line-height) | Use |
|---|---|---|
| `--type-page` | 650 28/34 | Page title, one per page |
| `--type-section` | 650 20/28 (16/24 inside panels) | Section heading: "Where it stands", "Needs attention" |
| `--type-item` | 600 15/22 | The title of one thing: a step, finding, approval or proposal |
| `--type-body` | 400 14/22 | Body text, and **anything a person reads to decide or act**. Never smaller. |
| `--type-support` | 400 13/20, `--text-1` | Supporting explanation, secondary lines |
| `--type-meta` | 500 12/16, `--text-2` | Timestamps, counts, file names in lists. Only for metadata. |
| `--type-status` | 650 12/16, uppercase, +0.04em | Status chips and group labels |
| `--type-code` | 400 12.5/18, mono | Commands, paths, raw errors (technical output) |

Importance comes from size, weight and placement, not from making everything bold. Each block has one bold line: its title.

## Spacing roles

| Token | Value | Use |
|---|---|---|
| `--gap-in` | 8px | Between lines of one item, or between the items of one group |
| `--gap-group` | 24px | Between groups in a panel |
| `--gap-section` | 36px | Between page sections |
| `--read-width` | 65ch | Maximum width for explanations |

- Related things sit close together, and unrelated things are clearly apart.
- Lists of similar items are separated by 1px dividers, not boxed cards.
- At most one subtle surface per panel. No cards inside cards and no thick accent bars.

## Content pattern

Overview, plan steps, review findings, notifications, approvals and retrospectives all use the same order:

1. **Title**: what it is.
2. **One sentence**: what happened or what it's for.
3. **Status**: plain words, for example "Done, checked", "Stopped, needs you", or "Couldn't run".
4. **Key facts**.
5. **Evidence or steps**: links to the step, check, diff or event.
6. **Primary action**: one, only when needed.
7. **Technical details**: collapsed by default.

**Plan steps**
- Grouped as Stopped, Working, Done and Not started.
- How a step is checked, and how many tries it took, sit under "How it's checked".
- A stopped step leads with the plain explanation and "You decide: …". The agent's own note is under "Technical details".
- Agent instructions are never shown as something the person must do.

**Notifications**
- Name the build, say what happened, and say whether action is needed.
- Open the exact place: the run's Overview, the Approvals page, or the review.

## Builder areas

| Area | Question it answers |
|---|---|
| Overview | What is this build for, and where does it stand? Shown in order: goal, where it stands, needs you, plan and progress, latest review. |
| Preview | What does my app look like and do? |
| Design | How is my app styled, and is every screen designed? |
| Review | What changed, what was checked, and what needs attention? |
| Activity | What has FlowCode been doing? |
| Technical output | What happened at the command and runtime level? |
