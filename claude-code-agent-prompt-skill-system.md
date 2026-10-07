# Agent Prompt, Skill, and Specification System

## Purpose

Use this document to organize reusable prompts, skills, project instructions, reference material, and feature specifications for this repository. The goal is to let Claude Code implement ambitious interactive product concepts—such as parallax, scroll storytelling, workflow visualization, simulations, AI-assisted workflows, and purposeful 3D—without losing scope, quality, accessibility, or architectural consistency.

This system separates **what is being requested** from **how recurring work is performed** and from **what rules always apply**.

> Core rule: A prompt requests a specific outcome. A skill provides a reusable method. Project instructions establish permanent repository rules. A feature specification is the source of truth for a significant product capability. Reference documents supply standards, examples, assets, and detailed guidance.

---

## Classification Model

Before starting work, classify every incoming request. A request may use more than one classification.

| Classification | Definition | Use it when | Typical location |
|---|---|---|---|
| Project instruction | A standing repository rule | It should apply to nearly all work in this repository | `AGENTS.md` or repository instructions |
| Saved prompt | A reusable feature-request template | The task is a specific page, component, screen, or deliverable with variable inputs | Prompt library or `.agent/prompts/` |
| Saved skill | A reusable procedure for a recurring class of work | Multiple features need the same planning, implementation, QA, or technical method | `.agent/skills/<skill-name>/SKILL.md` |
| Feature specification | Durable source of truth for a substantial capability | The work has multiple phases, workflows, state models, data requirements, business rules, or product decisions | `docs/features/<feature>.md` |
| Product specification | Durable source of truth for an application area or product initiative | The work contains several related features, users, permissions, domain rules, and roadmap decisions | `docs/product/<initiative>.md` |
| Reference document | Supporting material selectively loaded when useful | The agent needs standards, examples, assets, schemas, or detailed technical guidance | `docs/` or skill resources |
| Task note | Temporary implementation context | The information matters only to the current task and should not become permanent guidance | Current conversation or issue/task record |

### Classification decision tree

1. **Would this instruction apply to nearly every task in the repository?**
   - Yes: classify it as a **project instruction**.

2. **Is the request a concrete feature, page, component, or implementation with unique inputs?**
   - Yes: start with a **saved prompt** or task note.

3. **Will the same method be useful for multiple features, routes, or projects?**
   - Yes: use or create a **saved skill**.

4. **Does the work need durable user flows, data models, rules, states, architecture, MVP boundaries, or phased delivery?**
   - Yes: create or update a **feature specification**.

5. **Is this a broad product area with several features and a longer roadmap?**
   - Yes: create or update a **product specification**.

6. **Is the content detailed guidance, examples, tokens, visual samples, or a technical contract?**
   - Yes: classify it as a **reference document**.

Do not put all material into one long skill. Keep instructions small, specific, discoverable, and relevant to the work being done.

---

## Repository Layout

Use the following structure when the repository supports it. Adapt file paths only when an existing repository convention already serves the same purpose.

```text
/
├── AGENTS.md
├── .agent/
│   ├── prompts/
│   │   ├── plan-new-feature.md
│   │   ├── implement-approved-plan.md
│   │   ├── build-parallax-hero.md
│   │   ├── build-scroll-story.md
│   │   ├── build-interactive-timeline.md
│   │   ├── build-before-after-slider.md
│   │   ├── plan-workflow-simulator.md
│   │   ├── plan-ai-review-queue.md
│   │   └── build-3d-product-explainer.md
│   └── skills/
│       ├── feature-discovery-and-mvp/
│       │   └── SKILL.md
│       ├── scroll-motion-and-parallax/
│       │   └── SKILL.md
│       ├── interactive-ui-concept/
│       │   └── SKILL.md
│       ├── svg-workflow-visualization/
│       │   └── SKILL.md
│       ├── data-simulation-and-scenarios/
│       │   └── SKILL.md
│       ├── threejs-experience/
│       │   └── SKILL.md
│       ├── database-backed-feature/
│       │   └── SKILL.md
│       ├── ai-assisted-workflow/
│       │   └── SKILL.md
│       ├── accessibility-responsive-qa/
│       │   └── SKILL.md
│       └── visual-qa-and-feature-verification/
│           └── SKILL.md
└── docs/
    ├── product-principles.md
    ├── engineering-guardrails.md
    ├── visual-language.md
    ├── motion-principles.md
    ├── accessibility-standard.md
    ├── data-and-api-conventions.md
    ├── product/
    │   └── <product-initiative>.md
    └── features/
        └── <feature-name>.md
```

### File ownership

- Keep `AGENTS.md` concise. It contains high-priority, repository-wide rules.
- Keep each skill focused on one repeatable capability.
- Keep prompts parameterized so they can be reused without rewriting their structure.
- Keep feature specs as the stable record of product decisions and scope.
- Keep reference documents detailed but selective; load only what is relevant.

---

## Required Operating Procedure

For every non-trivial request, follow this order.

### 1. Inspect before changing code

Before editing, inspect:

- Repository layout and package/tool configuration
- Existing agent instructions and relevant skills
- Existing feature specs and reference docs
- Relevant route, components, styling system, design tokens, data layer, and test setup
- Existing dependencies and patterns that should be reused

Do not invent architecture, styling conventions, data models, route names, commands, or dependencies if the repository can answer the question.

### 2. Classify the request

State internally or in the response:

- The primary classification
- Supporting classifications, if any
- Which skills and documents are relevant
- Whether a feature or product spec needs to be created or updated

Example:

```text
Primary: Saved prompt / feature task
Supporting: scroll-motion-and-parallax skill; accessibility-responsive-qa skill
References: motion-principles.md; visual-language.md
Feature specification: not required for a one-off hero enhancement
```

### 3. Plan significant work before implementation

For new product capabilities, multi-file changes, data work, AI workflows, simulations, visualizations, or 3D work, do not code immediately.

Return a concise plan that includes:

1. User outcome and primary flow
2. MVP scope and explicit non-goals
3. Relevant files to modify or create
4. Component and state/data architecture
5. Accessibility and responsive behavior
6. Loading, empty, error, permission, and success states where applicable
7. Testing and verification plan
8. Assumptions, risks, and decisions needing approval

Wait for approval when the scope is materially ambiguous, the work is large, a new dependency is needed, data is persisted, a schema/API changes, or the request affects multiple routes or shared systems.

### 4. Implement only approved scope

- Reuse the repository’s established components, tokens, patterns, utilities, and dependencies.
- Keep edits limited to approved files unless a newly discovered dependency makes expansion necessary.
- Do not silently redesign unrelated UI or refactor unrelated code.
- Do not install packages, alter schemas, or change APIs without explaining the need and obtaining approval.
- Keep the smallest usable version coherent before adding polish or future-phase functionality.

### 5. Verify and report honestly

After implementation:

1. Run the repository’s applicable type check, lint, tests, and production build.
2. Inspect the affected route(s) in preview when available.
3. Test desktop and small-screen layouts.
4. Test keyboard use, visible focus, and reduced-motion behavior when the feature is interactive or animated.
5. Test loading, empty, error, success, and permission states when relevant.
6. Report changed files, checks run, results, unresolved limitations, and deferred work.

Never claim a visual behavior, runtime condition, or test result was verified unless it was actually checked.

---

## Permanent Project Instructions

Apply these rules to all work unless a feature specification explicitly and intentionally overrides one of them.

### Engineering

- Write new application code in TypeScript when the application uses TypeScript.
- Prefer existing application patterns, design tokens, shared components, and utilities.
- Do not add packages without explaining why existing dependencies are insufficient and obtaining approval.
- Do not expose secrets, privileged credentials, or private server logic in browser code.
- Keep browser, server, database, and job responsibilities clearly separated.
- Use typed boundaries for APIs, state, data validation, and external integrations.
- Do not refactor unrelated code while implementing a scoped feature.
- Preserve backwards compatibility unless a deliberate migration is approved.

### UX and visual quality

- Build interactions that help users understand, decide, create, compare, navigate, or complete work. Do not add motion solely as decoration.
- Preserve native scrolling unless the product explicitly requires a different interaction model.
- Maintain clear hierarchy, legible content, adequate contrast, and predictable controls.
- Reuse established visual language rather than creating an unrelated design direction.
- Do not rely only on color, hover, motion, or a pointer device to communicate essential information.

### Accessibility and responsiveness

- Use semantic HTML and native controls where appropriate.
- Ensure keyboard navigation, visible focus indicators, and logical focus order.
- Support touch input and small screens.
- Respect `prefers-reduced-motion`; provide stable alternatives for meaningful animated content.
- Ensure essential content and controls remain available without animation, hover, or WebGL.
- Provide labels, names, descriptions, status messaging, and error guidance appropriate to the component type.

### Motion and performance

- Prefer `transform` and `opacity` for UI animation.
- Avoid animating layout-affecting properties such as `top`, `left`, `width`, `height`, or margins unless there is a demonstrated need.
- Do not hijack scrolling or add global smooth-scrolling behavior without approval.
- Pause or reduce expensive animation when it is offscreen, inactive, or not useful.
- Reduce visual complexity and movement on small devices when needed.
- Treat animation, Canvas, and WebGL as performance-sensitive work requiring an explicit fallback and visual review.

### Completion and reporting

- Run relevant type checks, linting, tests, and builds before declaring work complete.
- Report exact changed files and concise outcomes.
- Explicitly identify assumptions, limitations, skipped checks, and deferred enhancements.
- Never represent a simulated result as factual advice in regulated or high-stakes domains.

---

## Saved Prompt Rules

A saved prompt is a reusable request template. It should describe a concrete feature outcome and collect the inputs that change per task.

### Saved prompt requirements

Every implementation prompt should contain:

- Feature name
- User outcome
- Page, route, or placement
- User interaction and expected behavior
- Visual direction and constraints
- Technical boundaries
- Responsive and accessibility expectations
- Acceptance criteria
- Explicit non-goals
- Required planning and verification steps

### Prompt template: plan a new feature

```md
# Plan a New Feature

Feature or concept: [NAME]

## Context
- Product area: [AREA]
- Target user: [USER]
- User outcome: [OUTCOME]
- Route or placement: [LOCATION]
- Existing related components or features: [OPTIONAL]
- Known assets, data, or APIs: [OPTIONAL]

## Request
Translate this concept into the smallest coherent MVP:
[CONCEPT DESCRIPTION]

## Constraints
- Follow repository instructions and existing project conventions.
- Reuse existing dependencies before proposing new ones.
- Do not write code yet.

## Required response
1. Classify the request and name the skills/docs to load.
2. Inspect the relevant repository files.
3. Describe the primary user flow.
4. Define MVP scope and explicit non-goals.
5. Recommend the appropriate rendering and architecture approach.
6. Define component, state, data, and persistence needs.
7. Define responsive, accessibility, loading, empty, error, success, and permission states as applicable.
8. List files expected to change or be created.
9. Provide acceptance criteria, verification steps, risks, and assumptions.
10. Wait for approval before editing source code.
```

### Prompt template: implement an approved plan

```md
# Implement an Approved Feature Plan

Feature: [FEATURE NAME]

## Approved scope
[PASTE THE APPROVED PLAN OR LINK TO THE FEATURE SPEC]

## Non-goals
[LIST EXPLICITLY]

## Rules
- Follow `AGENTS.md` and relevant feature/reference documents.
- Use the relevant skills for this task.
- Do not add dependencies, alter public APIs, or modify schemas without approval.
- Keep changes scoped to the agreed files and behavior.
- Do not refactor unrelated code.

## Before editing
- Reconfirm the files to change, relevant skills, and verification commands.
- State any new blocking assumption before changing code.

## After editing
- Run relevant type checks, linting, tests, and production build.
- Preview and inspect changed visual routes when available.
- Report changed files, behavior implemented, verification results, limitations, and deferred work.
```

### Prompt template: parallax or scroll experience

```md
# Build a Parallax or Scroll Experience

- Route/page: [ROUTE]
- Target section/component: [TARGET]
- User outcome: [OUTCOME]
- Narrative/message: [MESSAGE]
- Available assets: [ASSETS]
- Tone: [PREMIUM / EDITORIAL / PLAYFUL / CINEMATIC / TECHNICAL]

## Required interaction
- Trigger: [SCROLL / POINTER / BOTH]
- Layers and their intended depth: [LIST]
- Motion begins: [CONDITION]
- Motion ends: [CONDITION]
- Desktop behavior: [DETAIL]
- Mobile behavior: [DETAIL]
- Reduced-motion behavior: render a stable static composition.

## Boundaries
- Preserve native scrolling.
- Prefer React, TypeScript, and CSS transforms.
- Do not add a motion library unless the repository already uses one or approval is given.
- Do not use Three.js unless genuine 3D inspection or spatial navigation is required.
- Avoid layout-affecting animation.
- Keep text readable and controls usable at every motion state.

## Acceptance criteria
- [CRITERION]
- [CRITERION]
- No visible layout shift during the interaction.
- No console errors or warnings.
- Keyboard, mobile, and reduced-motion behavior are supported.

Use the `scroll-motion-and-parallax` skill. Plan first if this changes architecture or is more than a small isolated enhancement.
```

---

## Saved Skill Rules

A skill is a reusable capability package. Each skill must have a narrow trigger, a repeatable procedure, clear constraints, and a verification method.

### Required skill format

```md
---
name: <kebab-case-name>
description: >
  Use for [specific triggers and task types].
---

# <Human-readable skill name>

## When to use

## Do not use when

## Inputs to inspect

## Procedure

## Constraints and guardrails

## Accessibility and responsive requirements

## Required states

## Verification

## Completion report

## Supporting references
```

### Skill selection rules

Load only the skills relevant to the task. Do not load every skill by default.

| Work type | Skills to use |
|---|---|
| New substantial feature | `feature-discovery-and-mvp` |
| Parallax, pinned scroll, scroll storytelling | `scroll-motion-and-parallax`, `accessibility-responsive-qa`, `visual-qa-and-feature-verification` |
| Timeline, comparison, decision tree, onboarding, draggable/direct-manipulation UI | `interactive-ui-concept`, `accessibility-responsive-qa` |
| Workflow maps, dependency graphs, process diagrams | `svg-workflow-visualization`, `interactive-ui-concept` |
| What-if tools, replay, forecasting, scenario comparison | `data-simulation-and-scenarios`, often `database-backed-feature` |
| Durable user records, saved settings, permissions, audit trails | `database-backed-feature` |
| AI generation, extraction, classification, review, recommendation, agent monitoring | `ai-assisted-workflow`, often `database-backed-feature` |
| Real 3D objects, scenes, spatial navigation, WebGL | `threejs-experience`, `accessibility-responsive-qa`, `visual-qa-and-feature-verification` |
| Any new or materially changed user-facing UI | `accessibility-responsive-qa`, `visual-qa-and-feature-verification` |

### Required skills

#### 1. `feature-discovery-and-mvp`

Use when planning a substantial new feature.

```md
---
name: feature-discovery-and-mvp
description: >
  Use before implementing a significant product feature, interaction concept,
  visualization, simulator, AI workflow, dashboard, or multi-file UI capability.
---

# Feature Discovery and MVP

## Procedure
1. Inspect repository instructions, existing architecture, related features, design system, data layer, and tests.
2. State the target user, problem, outcome, and primary flow.
3. Define the smallest usable MVP.
4. Separate MVP scope from later enhancements.
5. Define user-visible states: default, loading, empty, error, success, permission denied, and offline/stale when relevant.
6. Recommend technical approach and explain why it fits.
7. Define data/persistence requirements and security/privacy implications.
8. List files to create/modify and testing strategy.
9. Identify risks, assumptions, and decisions requiring approval.
10. Stop and wait for approval before editing code.

## Output
Return a concise implementation plan, acceptance criteria, and explicit non-goals.
```

#### 2. `scroll-motion-and-parallax`

Use for scroll-linked motion and layered depth.

```md
---
name: scroll-motion-and-parallax
description: >
  Use for parallax, scroll-linked animation, sticky/pinned storytelling,
  layered scroll depth, scroll progress, and horizontal narrative sections.
---

# Scroll Motion and Parallax

## Default approach
- Prefer existing motion utilities, React, TypeScript, CSS transforms, and opacity.
- Reuse an installed motion library when available.
- Do not add a large dependency for a small visual effect.
- Use Three.js only when real 3D interaction is necessary.

## Rules
- Preserve native scrolling; never hijack it without explicit approval.
- Avoid global smooth scrolling by default.
- Tie motion to meaningful content hierarchy, depth, progress, or narrative.
- Stop or reduce work when the relevant section is offscreen.
- Maintain readable text and usable controls throughout all motion states.
- Use stable layout; avoid animation of width, height, top, left, and margins.

## Required fallbacks
- Reduced-motion: static composition with all essential information visible.
- Mobile: reduce movement, distance, and complexity; do not rely on hover.
- Asset loading: prevent layout shift and show a stable composition while assets load.

## Verification
- Verify normal scrolling, mobile layout, keyboard access, reduced-motion behavior, and absence of layout shift.
```

#### 3. `interactive-ui-concept`

Use for purposeful interactive UI patterns.

```md
---
name: interactive-ui-concept
description: >
  Use for interactive timelines, before/after controls, scenario comparisons,
  decision trees, onboarding, card interactions, configuration tools, and direct-manipulation UI.
---

# Interactive UI Concept

## Procedure
1. Define the user decision, task, or understanding the interaction supports.
2. Define the primary action and all interaction states.
3. Specify keyboard and touch behavior before styling.
4. Use semantic controls and clear affordances.
5. Build the smallest working interaction before visual enhancement.

## Required states
- Default
- Hover/focus where applicable
- Active/selected
- Disabled where applicable
- Loading
- Empty
- Error
- Success or completed
- Small-screen/touch equivalent

## Guardrails
- Do not make essential functionality hover-only or color-only.
- Avoid hidden gestures without visible instruction or discoverable controls.
- Preserve user state predictably.
- Make destructive or consequential actions explicit.
```

#### 4. `svg-workflow-visualization`

Use for workflows, process maps, dependency graphs, and node-edge diagrams.

```md
---
name: svg-workflow-visualization
description: >
  Use for process diagrams, workflow maps, dependency graphs, node-edge interfaces,
  timeline maps, and explorable system visualizations.
---

# SVG Workflow Visualization

## Default approach
- Prefer SVG for accessible, scalable, inspectable workflow visuals.
- Use Canvas only when volume/performance requires it.
- Use Three.js only when genuine spatial navigation materially improves comprehension.

## Procedure
1. Define node types, edge types, layout direction, and interaction model.
2. Define selection, focus, keyboard navigation, zoom/pan, filtering, and detail presentation.
3. Make the data model explicit before rendering.
4. Use a readable non-visual list/table/detail fallback for critical content.
5. Test dense, sparse, empty, and malformed data.

## Guardrails
- Do not rely on position or color alone to convey status.
- Maintain legibility at supported zoom levels.
- Avoid infinite canvas behavior unless the product requires it.
```

#### 5. `data-simulation-and-scenarios`

Use for what-if tools, simulations, replays, calculations, and model comparison.

```md
---
name: data-simulation-and-scenarios
description: >
  Use for simulations, what-if analysis, scenario comparison, event replay,
  backtesting, projections, operational modeling, and calculation-driven UI.
---

# Data Simulation and Scenarios

## Procedure
1. Define inputs, assumptions, formulas/rules, outputs, and units.
2. Clearly distinguish user-entered values, derived values, estimates, and historical data.
3. Make model assumptions visible in the UI.
4. Validate inputs and handle invalid, missing, and extreme values.
5. Persist scenarios only when the feature requires saved work.
6. Make results reproducible: store configuration/version context where necessary.

## Guardrails
- Do not present simulated or historical results as guarantees.
- For financial, legal, health, or other high-stakes domains, include appropriate product language and avoid personalized professional advice.
- Use deterministic calculations where possible and test known cases.

## Verification
- Test baseline, boundary, invalid, empty, and comparison cases.
- Verify formatting, units, rounding, and chart/visual consistency.
```

#### 6. `threejs-experience`

Use only for genuine 3D work.

```md
---
name: threejs-experience
description: >
  Use for true 3D scenes, inspectable product models, spatial learning modules,
  virtual galleries, 3D data scenes, and WebGL-based navigation.
---

# Three.js Experience

## Use only when
- Users need to inspect, rotate, navigate, compare, or learn from real 3D space.
- Spatial representation improves understanding beyond CSS, SVG, or Canvas.

## Do not use for
- Ordinary parallax
- Basic charts or dashboards
- Decorative hero effects
- Standard hover/mouse movement
- UI that can be communicated more clearly in 2D

## Required planning
1. Explain why 3D is needed.
2. Define scene objective, assets, camera, controls, user states, and performance budget.
3. Define a static or non-WebGL fallback.
4. Define mobile behavior and reduced-motion behavior.

## Implementation rules
- Keep geometry, texture sizes, lights, shadows, and effects restrained.
- Avoid autoplay camera movement that can cause discomfort.
- Pause rendering when offscreen or inactive.
- Clean up animation frames, listeners, textures, materials, and geometry on unmount.
- Do not trap keyboard focus in the canvas.
- Provide equivalent critical information outside the 3D scene.

## Verification
- Test low-performance conditions where feasible, mobile layout, WebGL failure fallback, keyboard flow, and normal navigation.
```

#### 7. `database-backed-feature`

Use when a feature has durable data or permissions.

```md
---
name: database-backed-feature
description: >
  Use for features requiring persistence, saved scenarios, user records, permissions,
  audit trails, structured content, search, or durable application state.
---

# Database-Backed Feature

## Procedure
1. Identify entities, ownership, lifecycle, and relationships.
2. Define read/write permissions and authorization boundaries.
3. Define validation at client and server boundaries.
4. Define migrations, indexes, constraints, and rollback implications before schema changes.
5. Define API contracts, failure modes, loading behavior, and optimistic/conservative update behavior.
6. Define audit trail requirements for consequential edits.

## Guardrails
- Do not expose database credentials or direct privileged access to the browser.
- Do not make irreversible data changes without confirmation and recovery considerations.
- Do not change schemas or migrations without approval.
- Design for empty, stale, missing, unauthorized, and partial data.
```

#### 8. `ai-assisted-workflow`

Use for product features that invoke AI.

```md
---
name: ai-assisted-workflow
description: >
  Use for AI generation, extraction, classification, summarization, evaluation,
  recommendation, conversational assistance, review queues, and agent monitoring.
---

# AI-Assisted Workflow

## Procedure
1. Define the user value, model role, allowed inputs, expected output schema, and human control points.
2. Prefer structured outputs and typed validation over free-form text when output drives product behavior.
3. Define loading, retry, failure, timeout, partial-result, and fallback behavior.
4. Make AI-generated content distinguishable from user-authored or verified content.
5. Define review, edit, approve, reject, and feedback flows where outputs are consequential.
6. Define data handling, retention, privacy, and permission boundaries.
7. Log operational metadata appropriate to debugging and auditing without exposing sensitive content unnecessarily.

## Guardrails
- Do not imply certainty where the model produces inference.
- Do not make irreversible external changes without explicit user approval.
- Do not send sensitive data to external systems without a documented policy and authorization.
- Provide user override and correction paths.
```

#### 9. `accessibility-responsive-qa`

Use for all new or materially changed user-facing UI.

```md
---
name: accessibility-responsive-qa
description: >
  Use for accessibility and responsive review of new or changed user-facing UI,
  including forms, interactions, visualizations, motion, and navigation.
---

# Accessibility and Responsive QA

## Check
- Semantic structure and appropriate native elements
- Keyboard reachability and logical focus order
- Visible focus indicators
- Labels, instructions, errors, and status messaging
- Color contrast and non-color status cues
- Touch target usability
- Small-screen layout and absence of unexpected horizontal scrolling
- Hover alternatives for touch devices
- Reduced-motion behavior for animation
- Text scaling and content resilience

## Required report
State what was checked, the viewports/modes used, issues fixed, and limitations.
```

#### 10. `visual-qa-and-feature-verification`

Use at the end of visual or user-facing work.

```md
---
name: visual-qa-and-feature-verification
description: >
  Use after implementing visual, interactive, responsive, animated, data-driven,
  or user-facing features.
---

# Visual QA and Feature Verification

## Verification sequence
1. Run type check.
2. Run lint.
3. Run applicable tests.
4. Run production build.
5. Preview affected route(s) when available.
6. Inspect desktop and small-screen layouts.
7. Test keyboard navigation and focus.
8. Test reduced-motion behavior when relevant.
9. Test default, loading, empty, error, success, and permission states as applicable.
10. Check console output for new warnings or errors.

## Visual review
- Hierarchy and legibility are clear.
- Layout does not clip, overlap, shift unexpectedly, or overflow horizontally.
- Controls are discoverable and usable.
- Motion is purposeful and non-disruptive.
- The feature matches existing visual language.

## Completion report
- Files changed
- Behavior implemented
- Commands/checks run and results
- Routes and viewports reviewed
- Limitations and deferred work
```

---

## Feature and Product Specifications

Create a feature specification when work needs persistent product decisions beyond a single prompt.

### Create or update a feature spec when

- The work spans multiple implementation phases.
- It introduces database entities, APIs, permissions, data retention, or audit requirements.
- It has multiple user flows, roles, or approval states.
- It contains business rules, simulations, calculations, or domain assumptions.
- It uses AI with structured output, review, safety, privacy, or evaluation requirements.
- It is a substantial dashboard, workflow tool, visualizer, 3D experience, or interactive application section.

### Feature spec template

```md
# [Feature Name]

## Summary
One concise description of the feature and the user outcome.

## Problem and users
- Primary user:
- User problem:
- Intended outcome:
- Success signals:

## Scope
### MVP
- [Requirement]

### Non-goals
- [Explicitly excluded requirement]

### Future phases
- [Later enhancement]

## User flows
1. [Flow]
2. [Flow]

## Functional requirements
- [Requirement]

## States and edge cases
- Default:
- Loading:
- Empty:
- Error:
- Success:
- Permission denied:
- Offline/stale data, if relevant:

## Data and permissions
- Entities:
- Ownership:
- Read/write roles:
- Validation:
- Audit/history requirements:

## Experience requirements
- Responsive behavior:
- Accessibility:
- Reduced motion:
- Performance:

## Technical approach
- UI:
- API/server:
- Data storage:
- Jobs/AI/simulation, if applicable:
- Relevant skills:

## Acceptance criteria
- [Observable criterion]

## Testing and verification
- [Test cases]

## Open decisions and risks
- [Decision or risk]
```

### Product spec template

Use a product spec for a broad initiative such as an interactive story world, financial strategy laboratory, roadmap platform, or knowledge explorer. It should include the product vision, target users, product principles, major modules, information architecture, domain constraints, milestones, and links to feature specifications.

---

## Technology Selection Guide

Choose the simplest technology that meets the user outcome.

| Need | Default recommendation | Escalate only when |
|---|---|---|
| Common UI, forms, stateful screens, normal interactions | React + TypeScript + CSS | Existing architecture requires another established approach |
| Parallax, reveal, sticky sections, hover depth, card motion | CSS transforms + React state/scroll handling | Existing motion library is already used or the choreography genuinely requires it |
| Diagrams, timelines, workflow maps, node-edge UI | SVG + React | Data volume/performance makes Canvas necessary |
| Dense/high-frequency 2D rendering, particles, drawing | Canvas | SVG is insufficient for the required scale/performance |
| True spatial/object interaction | Three.js | The experience can be understood effectively in 2D |
| API orchestration, auth, realtime, uploads, background jobs | Node.js / existing server stack | A specialized service is already established or approved |
| Durable structured application state | PostgreSQL / existing data layer | Another storage model is explicitly justified |
| Simulation, analytics, processing, model workflows | Typed server logic first; Python when data-science/specialized processing warrants it | The existing project’s architecture calls for a different compute layer |

### Mandatory selection questions

Before using Canvas, Three.js, Python, a new database technology, or a new package, answer:

1. What user problem does it solve that a simpler option cannot?
2. What is the fallback if it fails or is unavailable?
3. What is the accessibility equivalent for essential content?
4. What is the performance impact on mobile and lower-powered devices?
5. What existing project pattern or dependency can be reused instead?

---

## Concept-to-Classification Map

Use this as a default classification map. Confirm the actual scope before acting.

| Concept | Primary classification | Supporting skill(s) | When a feature spec is required |
|---|---|---|---|
| Parallax hero | Saved prompt | `scroll-motion-and-parallax`, `accessibility-responsive-qa` | Usually not required unless part of a broader redesign |
| Scroll case-study narrative | Saved prompt | `scroll-motion-and-parallax`, `interactive-ui-concept` | Required if it becomes a reusable case-study builder |
| Before/after slider | Saved prompt | `interactive-ui-concept` | Usually not required |
| Interactive timeline | Saved prompt | `interactive-ui-concept` | Required if backed by durable data or editing workflows |
| Card stack / horizontal narrative | Saved prompt | `scroll-motion-and-parallax` | Usually not required |
| Mouse-reactive hero | Saved prompt | `interactive-ui-concept`, `accessibility-responsive-qa` | Usually not required |
| Command palette | Saved prompt | `interactive-ui-concept` | Required when commands, permissions, global search, and analytics are substantial |
| Product onboarding | Saved prompt | `interactive-ui-concept`, `database-backed-feature` | Required when progress, user segmentation, or experimentation is persisted |
| Dashboard builder | Feature specification | `feature-discovery-and-mvp`, `interactive-ui-concept`, `database-backed-feature` | Required |
| Workflow simulator | Feature specification | `svg-workflow-visualization`, `data-simulation-and-scenarios`, `database-backed-feature` | Required |
| Scenario comparison tool | Feature specification | `data-simulation-and-scenarios`, `database-backed-feature` | Required |
| Financial strategy laboratory | Product specification | `data-simulation-and-scenarios`, `database-backed-feature`, `visual-qa-and-feature-verification` | Required |
| Interactive story world | Product specification | `interactive-ui-concept`, possibly `threejs-experience`, `database-backed-feature`, `ai-assisted-workflow` | Required |
| Living roadmap | Product specification | `svg-workflow-visualization`, `database-backed-feature` | Required |
| 3D product explainer | Saved prompt | `threejs-experience`, `accessibility-responsive-qa` | Required when it is a durable platform capability |
| 3D portfolio gallery | Saved prompt | `threejs-experience` | Required if users manage and publish galleries |
| Spatial learning module | Saved prompt or feature spec | `threejs-experience`, `interactive-ui-concept` | Required for a reusable learning system |
| Interactive map/globe | Saved prompt | `interactive-ui-concept`, possibly `threejs-experience` | Required if data, filters, saved layers, or permissions are central |
| AI co-pilot | Feature specification | `ai-assisted-workflow`, `database-backed-feature` | Required |
| AI review queue | Feature specification | `ai-assisted-workflow`, `database-backed-feature` | Required |
| Document-to-structured-data | Feature specification | `ai-assisted-workflow`, `database-backed-feature` | Required |
| Knowledge explorer | Product/feature specification | `ai-assisted-workflow`, `database-backed-feature` | Required |
| Agent-run monitor | Feature specification | `ai-assisted-workflow`, `database-backed-feature` | Required |

---

## Content Maintenance Rules

When a recurring correction or preference appears, store it in the correct layer.

| New learning | Store it in |
|---|---|
| “Always use the existing Button component.” | Project instructions or design-system reference |
| “Scroll motion must support reduced motion.” | Project instructions and `scroll-motion-and-parallax` skill |
| “This simulator rounds values to two decimal places.” | Feature specification |
| “This hero uses these assets and these exact layer speeds.” | Saved prompt or feature specification |
| “The app’s visual language uses these tokens and card styles.” | Visual-language reference |
| “This database entity has these permissions and lifecycle rules.” | Feature specification plus data/API reference |
| “When building 3D scenes, pause rendering offscreen.” | `threejs-experience` skill |

Do not solve a permanent process problem by repeating the same correction in chat. Update the relevant project instruction, skill, feature spec, or reference document.

---

## Definition of Done

Do not mark a task complete until all applicable items are true:

- [ ] The request was correctly classified.
- [ ] Relevant repository instructions, skills, specs, and references were reviewed.
- [ ] The implementation matches approved scope and non-goals.
- [ ] Accessibility, keyboard behavior, mobile behavior, and reduced-motion handling were addressed for interactive UI.
- [ ] Default, loading, empty, error, success, and permission states were addressed when relevant.
- [ ] No unnecessary dependencies, unrelated refactors, schema changes, or API changes were introduced.
- [ ] Applicable type checks, linting, tests, and builds were run.
- [ ] Visual routes were reviewed where preview capability is available.
- [ ] The final report lists files changed, behavior delivered, validation results, limitations, and deferred work.

---

## Final Instruction to Claude Code

Treat this system as an operating model, not as a request to load every file or invoke every skill.

For each task:

1. Classify the work.
2. Load only the relevant instructions, skills, specifications, and references.
3. Inspect the repository before assumptions are made.
4. Plan before coding when the task is substantial or ambiguous.
5. Implement the smallest approved scope.
6. Validate the result rigorously.
7. Record durable decisions in the correct layer so future work becomes more consistent.
