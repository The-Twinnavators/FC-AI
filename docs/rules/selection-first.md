# FlowCode Global Rule: Selection First, Typing Only When Necessary

## Scope

This standing rule applies to every prototype and application FlowCode builds, across industries, screens, roles, and device sizes. Apply it during requirements interpretation, workflow planning, component selection, implementation, and rendered validation.

## Core Principle

Minimize unnecessary user effort, especially on mobile. When the application already knows the information or can provide practical choices, let users select, reuse, confirm, or adjust instead of typing it again.

Use text entry when users need to create new information or when typing is faster and clearer than navigating choices. Optimize the complete task, not tap counts or text-field counts in isolation.

## Preferred Interaction Strategy

1. Reuse relevant saved information and preserve previous entries.
2. Offer direct actions for frequent tasks.
3. Present short sets of choices directly.
4. Use searchable selection for long lists.
5. Request free text for genuinely new or open-ended information.

This is guidance, not a mandatory sequence. Do not replace an efficient field with a cumbersome series of menus.

## Control Rules

### Existing Information

- Reuse saved details where appropriate and authorized.
- Offer recent items, favorites, previous selections, and reusable templates when relevant.
- Make defaults visible and editable.
- Do not reuse stale or inappropriate information.
- Never silently assume a consequential choice.

### Choices

- Use labeled buttons, chips, radio options, or segmented controls for manageable short lists.
- Use checkboxes or suitable multi-select controls when several choices are allowed.
- Use searchable pickers for long or variable lists.
- Do not hide a few important options in a dropdown unnecessarily.
- Provide Other, Enter manually, or Create new when the workflow permits options outside the list.
- Preserve search and paste when faster than browsing.

### Quantities and Numbers

- Offer steppers or presets for common bounded adjustments.
- Permit direct numeric entry when precision or large changes make it faster.
- Clearly display units, limits, and errors.
- Do not require a slider for precise values without an exact-entry alternative.

### Dates and Times

- Offer relevant shortcuts alongside exact selection.
- Show selected dates, times, and applicable timezones clearly.
- Avoid excessive calendar navigation for distant dates.
- Do not preselect an unconfirmed commitment.

### Optional and Conditional Inputs

- Keep optional notes optional.
- Reveal additional fields only when relevant.
- Do not hide essential information in the name of simplicity.
- Preserve entered information when changing selections unless clearing it is necessary and explained.

### Free Text

- Use typing for original names, messages, descriptions, searches, and other open-ended content.
- Request only what is needed at that point.
- Use clear visible labels, appropriate input types, paste support, and suitable autofill.
- Do not force inaccurate presets or impose arbitrary constraints.

## Mobile Requirements

- Make controls easy to tap without hover or precision gestures.
- Keep frequent actions close to the item they affect.
- Use appropriate keyboards when entry is necessary.
- Do not automatically open the keyboard unless text entry is the clear next action.
- Preserve progress through navigation, keyboard dismissal, and validation errors.
- Keep selections visible, reviewable, and easy to change.
- Prevent fixed interface elements from obscuring necessary controls.

## Accessibility and Safeguards

- Use semantic controls, accessible names, and clear states.
- Support keyboard and assistive technology.
- Do not communicate status through color or icons alone.
- Provide clear focus, visible labels, understandable errors, and correction paths.
- Offer fallback entry when scanning, cameras, or other device features are unavailable.
- Never fabricate data to avoid a necessary question.
- Do not preselect consent, sensitive permissions, or consequential commitments for convenience.
- Distinguish suggestions from confirmed decisions.
- Confirm irreversible or high-consequence actions appropriately; offer undo for suitable reversible actions.
- Do not sacrifice correctness, privacy, security, or required disclosures to reduce friction.

## General Examples

| Task | Avoid | Prefer where appropriate |
|---|---|---|
| Add an existing item | Retyping its name and category | Direct Add action; reuse known attributes |
| Repeat a task | Rebuilding the same configuration | Reuse previous settings with review and edit |
| Choose status | Typing a known label | Explicit status choices |
| Assign a person | Re-entering a known email | Searchable authorized-person picker |
| Adjust quantity | Mandatory keyboard entry | Stepper with direct-entry alternative |
| Choose a date | Calendar navigation for every task | Relevant shortcuts plus exact selection |
| Enter an address | Re-entering saved details | Select saved address or add a new one |
| Add context | Required notes for routine actions | Optional note unless essential |

Examples are patterns, not mandatory components. Choose the interaction that fits the task.

## Pipeline Responsibilities

### Planning

Identify required information, why it is needed, and whether it already exists. Plan a short, understandable workflow that preserves control.

### Resource Selection

Prefer components and patterns supporting efficient entry, reuse, accessibility, and mobile interaction. Adapt unsuitable template forms rather than inheriting unnecessary fields unchanged.

### Implementation

Connect selections, defaults, search, validation, and conditional fields to real application state. Static dropdowns and nonfunctional shortcuts do not satisfy this rule. Clearly label simulated integrations in prototypes and provide usable fallbacks.

### Validation

Test the rendered task, not only code. Include new and returning users, empty data, unavailable optional capabilities, correction, keyboard operation, and mobile behavior. Do not declare compliance merely because buttons or dropdowns exist.

## Acceptance Checklist

- [ ] Every required input has a clear purpose.
- [ ] Known information is reused rather than unnecessarily requested again.
- [ ] Suitable choices replace unnecessary typing.
- [ ] Long lists can be navigated efficiently.
- [ ] Typing remains available when necessary or faster.
- [ ] Defaults are relevant, visible, and editable.
- [ ] Optional details do not block completion.
- [ ] Conditional fields appear only when relevant.
- [ ] Users can correct choices without restarting.
- [ ] Mobile and keyboard interactions work.
- [ ] Accessibility, privacy, and consequential decisions are protected.
- [ ] Empty, invalid, unknown, and unavailable-capability states work.
- [ ] Controls perform their stated actions.

For each required text field, ask:

> Must the user create new information here, or can they select, reuse, confirm, scan, paste, or adjust it more easily?

Retain typing when it is the right answer. Record concise rationales for non-obvious exceptions without creating unnecessary documentation overhead.

## Success Criteria

Evaluate complete-task effort, completion time, repeated entry, error rate, correction effort, and mobile usability. Do not claim measured improvements without a baseline and supporting evidence.

## Standing Agent Instruction

Design selection-first workflows in every FlowCode prototype and application. Never make users type information the app already knows or can offer as a practical choice. Prefer direct actions, reusable data, editable defaults, appropriate selection controls, and searchable pickers. Use free text when genuinely necessary or faster. Optimize the complete task, especially on mobile, while preserving accessibility, accuracy, privacy, and user control. Verify the working rendered workflow before declaring compliance.
