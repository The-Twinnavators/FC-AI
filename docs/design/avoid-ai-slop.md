# Avoid Design AI-Slop Engine

Design guidance for the FlowCode Builder. A condensed version is the built-in skill `skill.avoid-ai-slop`, which the planner, coder, designer and critic agents receive for interface work.

## Purpose

Use this skill whenever designing, generating, reviewing, or refining a user interface.

The goal is to prevent generic, over-polished, template-like “AI slop” and produce interfaces that feel intentional, product-specific, accessible, coherent, and professionally art-directed.

This skill applies to:

- Web applications
- Marketing sites
- SaaS dashboards
- Mobile-responsive interfaces
- Landing pages
- Product onboarding
- Admin tools
- Design systems
- UI components
- Empty, loading, error, and success states

---

## Core Principle

Do not generate a visually acceptable interface by default.

Generate an interface with a clear point of view that reflects:

1. The product’s purpose
2. The target user’s context
3. The brand personality
4. The information hierarchy
5. The actual actions users need to complete
6. Accessibility and responsive behavior
7. A deliberate visual system

Every design decision should answer:

> Why does this interface need to look and behave this way for this product and this user?

If there is no answer, simplify or remove the decision.

---

## Definition: AI Slop

Avoid interfaces that look like generic AI-generated SaaS templates.

Common signs of AI slop include:

- Excessive rounded cards everywhere
- Random gradients used only to make the page “look modern”
- Large glowing blobs, blurred backgrounds, or decorative mesh gradients with no brand purpose
- Purple/blue gradient defaults with no connection to the product
- Generic hero copy such as “Transform your workflow” or “Everything you need in one place”
- Too many badges, pills, tags, and status chips
- Every section placed inside a card
- Overuse of shadows, borders, glassmorphism, and floating panels
- Oversized headings with weak information hierarchy
- Generic icon grids with no meaningful content or interaction
- Fake product metrics, fake testimonials, fake customer logos, or invented social proof
- Copy that sounds inflated, vague, overly confident, or repetitive
- Decorative illustrations that do not explain the product
- Dashboard layouts with every metric, chart, and component competing for attention
- UI controls that look interactive but do nothing
- Excessive use of emoji as interface iconography
- Dense interfaces with no visual breathing room
- Empty interfaces with no useful guidance
- A “premium” look that sacrifices readability, clarity, speed, or accessibility

---

## Required Design Thinking Before Implementation

Before generating a page or component, determine the following.

### 1. Product Context

Identify:

- What the product does
- Who the user is
- What the user is trying to accomplish on this screen
- What action matters most
- What information is essential now
- What information can be deferred, hidden, or moved to another screen
- Whether the user is new, returning, stressed, expert, or time-constrained

Do not create generic layouts before understanding the product context.

### 2. Screen Intent

Every screen must have one primary purpose.

Examples:

- Help a user begin a project
- Show the next required action
- Help a user compare options
- Let a user review and resolve risks
- Help an admin manage content
- Confirm a completed action
- Explain an error and provide recovery
- Guide a user through onboarding

Do not give a screen multiple competing primary goals.

### 3. Hierarchy

Define:

- Primary action
- Primary information
- Secondary information
- Supporting actions
- Optional actions
- Destructive actions

Use hierarchy through layout, spacing, typography, contrast, grouping, and sequence.

Do not rely only on color or bold text to establish importance.

### 4. Brand Direction

Before selecting visual styling, define 3–5 brand attributes.

Examples:

- Calm, trustworthy, practical, and human
- Technical, precise, and credible
- Playful, curious, and encouraging
- Editorial, premium, and understated
- Bold, direct, and energetic

Translate the attributes into visual choices:

| Brand Attribute | Possible UI Expression |
|---|---|
| Trustworthy | Restrained color use, clear hierarchy, readable type, honest language, low visual noise |
| Technical | Structured grids, useful metadata, monospace only where meaningful, concise labels |
| Premium | Strong typography, intentional whitespace, subtle details, few decorative elements |
| Playful | Warm colors, expressive illustration, conversational copy, gentle motion |
| Calm | Generous spacing, limited palette, predictable patterns, low contrast noise |
| Editorial | Strong type scale, content-led layouts, intentional asymmetry, minimal card dependence |

Do not add visual trends unless they support the intended brand direction.

---

## Layout Rules

### Use Layout With Purpose

- Start with content structure, not decoration.
- Use a grid appropriate to the product and viewport.
- Establish consistent page gutters, content widths, and spacing relationships.
- Make primary actions easy to locate without making every action visually dominant.
- Use sections only when they represent a meaningful change in topic, task, or priority.
- Let content determine component height when possible.
- Use whitespace to clarify relationships and reduce cognitive load.
- Create clear alignment lines across headings, labels, controls, tables, and cards.

### Avoid Card Soup

Do not place every content group inside a rounded card.

Use cards only when they do at least one of the following:

- Represent a discrete object
- Support comparison between peer objects
- Create a meaningful interactive boundary
- Group content that may be reordered, selected, or moved
- Separate a distinct workflow step
- Improve scanning in a dense interface

Prefer other grouping methods when appropriate:

- Headings and spacing
- Subtle dividers
- Background shifts
- A shared grid
- Typography changes
- A semantic section
- A table
- An inline disclosure pattern

### Avoid Arbitrary Symmetry

Do not force every page into a centered hero followed by three equal cards.

Use asymmetry when it improves emphasis, storytelling, or task focus.

Examples:

- A large task panel beside a compact context sidebar
- An editorial content column with a narrow metadata rail
- A single strong action area above a structured checklist
- A dashboard with one primary work queue and smaller supporting metrics

Symmetry should be intentional, not automatic.

---

## Typography Rules

Typography should carry hierarchy before decoration does.

### Requirements

- Use a deliberate type scale.
- Limit heading sizes to what the page actually needs.
- Use line length appropriate for reading.
- Use sentence case for most interface labels and buttons.
- Use uppercase sparingly, mainly for short metadata labels or compact category markers.
- Ensure body text is readable at normal zoom levels.
- Avoid tiny gray text for important content.
- Use font weights intentionally; do not make everything semibold.
- Use monospace only for code, technical values, IDs, file names, commands, or structured data.
- Avoid excessive letter spacing.
- Avoid giant headings that consume the viewport without communicating useful information.

### Writing Hierarchy

Prefer:

```text
Review your launch readiness
Resolve the remaining high-priority items before publishing your application.
```

Avoid:

```text
Launch smarter. Build safer. Scale with confidence.
The all-in-one platform for everything you need to succeed.
```

The first version is specific, useful, and oriented around a real task.

---

## Color Rules

### Use Color Semantically

Use color to communicate:

- Brand
- Status
- Priority
- Interactivity
- Progress
- Category
- Data meaning

Do not use color only as decoration.

### Requirements

- Define a neutral scale first.
- Choose one primary brand color and a limited set of supporting accents.
- Ensure sufficient contrast for text, controls, focus states, and critical information.
- Do not communicate meaning through color alone.
- Reserve destructive colors for destructive or high-risk actions.
- Reserve success colors for confirmed success, not general decoration.
- Use muted backgrounds and low-emphasis fills carefully.
- Keep charts and status systems consistent across the product.

### Avoid

- A rainbow of unrelated accent colors
- Gradients applied to every button, badge, border, heading, and background
- Low-contrast gray text on tinted surfaces
- Pale status colors with unreadable labels
- Red text used solely for visual excitement
- Green used to imply “safe” when a nuanced risk status is required

---

## Visual Styling Rules

### Prefer Restraint

A polished interface does not need many effects.

Use:

- Clear type hierarchy
- Consistent spacing
- Strong alignment
- Intentional contrast
- Thoughtful component states
- Limited, meaningful color
- Useful iconography
- Subtle borders or shadows where needed

Avoid:

- Excessive shadows
- Heavy blur
- Unnecessary glass effects
- Large gradient glows
- Floating decorative shapes
- Random texture overlays
- Multiple visual styles on one page
- Excessive border radius
- Decorative animations that slow understanding

### Border Radius

Use a coherent radius scale.

Example:

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
```

Do not make every object extremely rounded.

Use sharper corners when the brand should feel technical, editorial, structured, or precise. Use softer corners only when the brand benefits from warmth, friendliness, or approachability.

### Shadows

Shadows should communicate elevation or interaction hierarchy.

Use subtle shadows for:

- Modals
- Popovers
- Sticky panels
- Selectable cards
- Floating controls

Do not use shadows on every container.

---

## Content Rules

### Write Real Product Copy

Use specific, understandable, human language.

Good:

```text
3 launch blockers need attention
Your app is collecting customer emails, but no privacy notice has been added yet.
```

Bad:

```text
Unlock your potential with intelligent compliance solutions.
Experience next-level peace of mind.
```

### Never Invent Evidence

Do not generate:

- Fake customer testimonials
- Fake review ratings
- Fake company logos
- Fake user counts
- Fake security certifications
- Fake compliance badges
- Fake performance metrics
- Fake client names
- Fake case studies
- Fake before-and-after results

If content is unavailable, use:

- A neutral placeholder clearly marked as placeholder
- A realistic empty state
- A request for the user to provide content
- A content management field
- A “No data yet” state with a helpful action

### Avoid Generic Marketing Phrases

Avoid phrases such as:

- “Elevate your workflow”
- “Unlock your potential”
- “Next-generation”
- “Seamlessly”
- “Revolutionize”
- “All-in-one”
- “Game-changing”
- “Built for the future”
- “Empower your team”
- “Everything you need”
- “Transform the way you work”

Replace them with concrete statements about the user’s outcome.

### Copy Style Rules

These rules apply to every piece of interface copy: headings, labels, buttons, help text, empty states and errors.

- Don't use the word ensure or enable in any variation.
- Don’t use the word foster in any variation.
- Don’t use the word comprehensive in any variation.
- Don't use the em dashes
- Don't start a sentence with the word BY.
- Don't use any fluffy adjectives.
- Don’t use “A & B" sentence structures.
- Don't use bullets without setting up the context first.

---

## Component Rules

### Buttons

- Use clear verbs.
- Make the primary button describe the next action.
- Avoid vague labels such as “Submit,” “Continue,” “Click here,” or “Get started” when a more specific label is possible.
- Maintain clear primary, secondary, tertiary, destructive, disabled, loading, hover, focus, and pressed states.
- Do not make multiple buttons look equally primary.
- Do not use gradients or excessive shine by default.

Good:

```text
Review 3 blockers
Create project checklist
Export launch report
Save and continue later
```

### Forms

- Ask only for information needed at the current step.
- Group related fields.
- Use labels, not placeholder-only inputs.
- Explain unfamiliar terms near the field.
- Mark optional fields clearly.
- Show validation close to the field and explain how to fix it.
- Preserve user input after validation errors.
- Use helpful examples when appropriate.
- Do not make long forms look shorter by hiding essential complexity without explanation.

### Tables

Use tables for comparison, status, structured records, or repeatable data.

- Keep columns purposeful.
- Allow long content to wrap clearly.
- Use sticky headers only when helpful.
- Avoid turning all data into cards on desktop.
- Ensure mobile behavior is intentional: horizontal scroll, priority columns, details view, or responsive row expansion.
- Include empty, loading, and error states.

### Status Systems

Every status must have:

- A clear label
- A non-color indicator
- Consistent meaning
- A defined action or next step

Example:

| Status | Meaning | Next Action |
|---|---|---|
| Blocked | Cannot launch until resolved | Fix or formally escalate |
| Needs review | Evidence or owner is missing | Assign and review |
| In progress | Work has started | Complete required evidence |
| Complete | Requirement is satisfied | Recheck on next review date |
| Not applicable | Does not apply to this project | Record the reason |

Avoid ambiguous labels such as “Good,” “Fine,” “Looks great,” or “Almost done.”

---

## Accessibility Requirements

Accessibility is a baseline quality requirement, not an optional enhancement.

Design and implement with a practical WCAG 2.2 AA-oriented baseline.

### Required

- Use semantic HTML elements.
- Provide accessible names for interactive controls.
- Ensure all functionality works with a keyboard.
- Ensure focus is visible and not obscured.
- Do not trap keyboard users inside components.
- Maintain adequate text and control contrast.
- Do not rely on color alone to communicate status or error.
- Use visible labels for form controls.
- Associate form errors with the affected fields.
- Use descriptive link and button text.
- Ensure modal dialogs receive and manage focus correctly.
- Respect `prefers-reduced-motion`.
- Support browser zoom and text resizing.
- Ensure touch targets are practical on mobile.
- Provide alternative text for meaningful images.
- Hide decorative images from assistive technologies.
- Use headings in logical order.
- Use ARIA only when semantic HTML cannot communicate the required behavior.
- Test key flows with keyboard navigation before marking the interface complete.

### Avoid

- Clickable `div` elements when buttons or links are appropriate
- Placeholder-only forms
- Icons without accessible labels
- Tooltips that only appear on hover
- Color-only success/error states
- Autoplaying motion or video without user control
- Focus outlines removed without an accessible replacement
- Text embedded in images when live text is possible

---

## Responsive Design Rules

Design for actual device constraints, not merely a compressed desktop view.

### Mobile Requirements

- Reassess hierarchy on small screens.
- Keep the primary action visible and easy to reach.
- Avoid dense multi-column forms.
- Avoid horizontal overflow except where intentionally necessary, such as a data table.
- Ensure touch targets are sufficiently large and separated.
- Preserve context when opening drawers, menus, and dialogs.
- Do not hide critical information simply to make the layout cleaner.
- Convert navigation intentionally; do not automatically collapse everything into an unclear hamburger menu.
- Test the most important flows at small viewport widths.

### Desktop Requirements

- Do not stretch content across the entire screen without a reading or workflow reason.
- Use wider layouts for comparison, dashboards, and data-heavy workflows.
- Use constrained widths for reading, writing, forms, and sequential tasks.
- Keep related actions near the content they affect.

---

## States Are Required

Every meaningful feature must include more than the ideal state.

Design and implement:

- Default state
- Empty state
- Loading state
- Error state
- Success state
- Disabled state
- Partial-completion state
- Permission-denied state where relevant
- Mobile state
- Keyboard-focus state
- Long-content state
- No-results state for search or filters
- Offline or retry state where relevant

### Empty-State Pattern

A useful empty state should explain:

1. What this area is for
2. Why it is empty
3. What the user can do next

Example:

```text
No projects yet

Create a project to generate a tailored launch-readiness checklist for a website or web app.

[Create project]
```

Avoid:

```text
Nothing here.
```

---

## Dashboard Rules

Dashboards should help users decide what to do next.

### Requirements

- Lead with the most important decision, risk, task, or change.
- Prioritize action over decorative metrics.
- Use a clear information hierarchy.
- Limit the number of charts.
- Explain what each chart means and what a user should do with the information.
- Show trend context when a metric is presented as meaningful.
- Use lists and work queues when the user needs to act.
- Put secondary analytics behind lower-emphasis sections or filters.
- Make urgent issues obvious without using constant red visual noise.

### Avoid

- A dashboard with every metric in a card
- Charts with no user decision attached
- Fake growth charts or placeholder business performance data
- More than one primary focal area
- Color-heavy widgets competing for attention
- Overloaded sidebars and redundant navigation

For a launch-readiness product, the central dashboard should likely prioritize:

1. Launch blockers
2. Items needing evidence
3. Items assigned to the user
4. Recent changes
5. Readiness progress by category

Not generic “total users,” “engagement,” or “revenue” cards unless those are central to the user’s immediate job.

---

## AI-Generated UI Review Checklist

Before finalizing any interface, review it against this checklist.

### Product Fit

- Does the screen clearly support a real user task?
- Is the primary action obvious?
- Does the layout reflect the product’s actual workflow?
- Is the content specific to this product rather than reusable generic SaaS copy?
- Does the interface provide useful context before asking users to act?

### Visual Quality

- Is there a clear visual hierarchy?
- Is spacing consistent?
- Is typography doing most of the organizational work?
- Are cards used only where they add structure?
- Is the color system restrained and meaningful?
- Are effects subtle and purposeful?
- Does the design have a recognizable point of view without becoming decorative noise?

### Content Quality

- Is all copy specific, clear, and useful?
- Are there any vague marketing phrases?
- Are any numbers, testimonials, logos, achievements, or certifications fabricated?
- Are empty states helpful?
- Are errors understandable and actionable?
- Are labels written in language users will understand?

### Accessibility

- Can all important functions be used with a keyboard?
- Is focus visible?
- Is contrast sufficient?
- Are form fields labeled?
- Are icons accessible?
- Are errors communicated beyond color?
- Does the page remain usable when zoomed?
- Is motion optional or reduced when requested?

### Responsiveness

- Does the design work intentionally on mobile?
- Are tables, forms, and dense layouts handled thoughtfully?
- Are key actions reachable on a small screen?
- Is content preserved rather than hidden unnecessarily?

### Integrity

- Does the UI avoid making unsupported claims?
- Does it distinguish “completed review” from “guaranteed compliance” or “guaranteed security”?
- Does it make limitations and unresolved work visible?
- Does it avoid presenting an automated score as an authoritative certification when human or expert review is required?

---

## Specific Rules for Launch-Readiness Products

If building a product that evaluates websites or apps before launch:

- Never claim that an application is fully secure.
- Never claim legal compliance without a jurisdiction-specific, appropriately qualified review.
- Never portray a self-service checklist as a penetration test, security audit, legal opinion, or accessibility conformance evaluation.
- Use language such as:
  - “Launch Readiness Review”
  - “Applicable checks completed”
  - “Known risks and follow-ups”
  - “Evidence submitted”
  - “Requires expert review”
  - “Not assessed”
  - “Not applicable”
- Include a clear scope statement in any report.
- Record the review date, product version, domain/environment, framework version, and unresolved items.
- Use a risk register rather than hiding exceptions.
- Require named ownership for waived, deferred, or high-risk items.
- Ensure the product clearly distinguishes automated checks, user-attested checks, and expert-reviewed checks.
- Make user-facing reports look credible through clarity, specificity, evidence, and restraint—not through fake seals, shield icons, or exaggerated compliance language.

---

## Implementation Guidance

When generating code:

- Prefer semantic, accessible HTML.
- Build reusable components only after identifying real repetition.
- Avoid premature abstraction.
- Use design tokens for color, spacing, typography, radius, elevation, and state.
- Keep component APIs understandable.
- Include all interaction states.
- Use meaningful component names.
- Avoid giant components that contain unrelated concerns.
- Do not use arbitrary pixel values repeatedly when a token should exist.
- Do not hard-code content that should be data-driven.
- Do not use animation as a substitute for hierarchy.
- Do not add a visual effect unless it supports comprehension, feedback, hierarchy, or brand character.

Example token direction:

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f7f7f8;
  --color-text: #17171a;
  --color-text-muted: #62636b;
  --color-border: #dedee3;

  --color-primary: #1d6b5f;
  --color-primary-hover: #15564c;
  --color-danger: #b42318;
  --color-warning: #a15c00;
  --color-success: #167a4c;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;

  --shadow-floating: 0 12px 32px rgba(23, 23, 26, 0.12);
}
```

Use this only as a starting structure. Adapt the visual system to the actual brand direction.

---

## Final Instruction

Do not generate a generic “beautiful SaaS UI.”

Generate a useful, accessible, product-specific interface with deliberate hierarchy, credible content, restrained visual styling, and clear next actions.

When uncertain, choose:

- Clarity over decoration
- Specificity over generic marketing language
- Evidence over visual theater
- Accessibility over fashionable friction
- User tasks over dashboard ornamentation
- Honest scope over exaggerated claims
- Fewer, stronger design decisions over more effects
