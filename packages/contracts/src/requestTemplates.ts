/**
 * Saved prompts (from the agent prompt, skill and specification system): request templates for recurring kinds of
 * feature. Each collects the inputs that change per task (outcome, placement, interaction, limits, acceptance
 * criteria, non-goals) so FlowCode's planner gets a complete request, and names the skills it should use. Pick one in
 * New build or in a project's request form; fill in the [brackets].
 */

export interface RequestTemplate {
  id: string;
  label: string;
  /** One line: what it's for. */
  description: string;
  /** Skills the request will bring in (FlowCode also adds them from the request's wording). */
  skills: string[];
  body: string;
}

const plan = `## What I need from the plan
- The smallest version that works end to end, and what is left for later.
- The screens' loading, empty, error and success states.
- Which files change, and how each step is checked.
- Anything that needs my approval first: a new package, a schema or API change.`;

export const REQUEST_TEMPLATES: RequestTemplate[] = [
  {
    id: "plan-new-feature",
    label: "Plan a new feature",
    description: "Any substantial new capability: turn the idea into the smallest usable version first.",
    skills: ["skill.feature-discovery-mvp"],
    body: `# New feature: [NAME]

- Product area: [AREA]
- Who uses it: [USER]
- What they get done with it: [OUTCOME]
- Where it lives: [ROUTE OR PLACE IN THE APP]
- Related screens or components already in the app: [OPTIONAL]
- Data, assets or APIs it uses: [OPTIONAL]

## The idea
[DESCRIBE THE CONCEPT]

## Not in this build
- [WHAT TO LEAVE OUT]

${plan}`,
  },
  {
    id: "parallax-scroll",
    label: "Parallax or scroll experience",
    description: "Layered depth or scroll-linked motion that keeps native scrolling and works without motion.",
    skills: ["skill.scroll-motion-parallax", "skill.audit-accessibility", "skill.visual-qa-verification"],
    body: `# Parallax or scroll experience: [NAME]

- Page: [ROUTE]
- Section: [WHERE ON THE PAGE]
- What it should help people understand: [OUTCOME]
- Message or story: [MESSAGE]
- Assets: [IMAGES, ILLUSTRATIONS, VIDEO]
- Tone: [premium / editorial / playful / cinematic / technical]

## Interaction
- Trigger: [scroll / pointer / both]
- Layers and their depth: [e.g. sky far, hills middle, text near]
- Motion starts when: [CONDITION]; ends when: [CONDITION]
- Desktop: [BEHAVIOUR]
- Phone: [less movement, fewer layers]
- Reduced motion: a still composition with everything visible.

## Limits
- Keep native scrolling; no scroll hijacking or global smooth scrolling.
- React, TypeScript and CSS transforms; no new motion library unless the project already has one.
- No Three.js for parallax.
- Text stays readable and controls usable at every point of the motion.

## Done when
- [CRITERION]
- No layout shift while scrolling or while images load.
- Works with keyboard, on a phone, and with reduced motion.`,
  },
  {
    id: "scroll-story",
    label: "Scroll story or case study",
    description: "A narrative told in pinned or stepped sections as the page scrolls.",
    skills: ["skill.scroll-motion-parallax", "skill.interactive-ui-concept"],
    body: `# Scroll story: [NAME]

- Page: [ROUTE]
- Story in steps: 1. [STEP] 2. [STEP] 3. [STEP]
- What changes at each step: [IMAGE, NUMBER, HIGHLIGHT]
- Assets: [LIST]

## Interaction
- Sections pin or step as the page scrolls; a progress indicator shows where you are.
- Keyboard: the steps are reachable as ordinary headings and links.
- Phone: steps stack without pinning.
- Reduced motion: all steps visible as a normal page.

## Not in this build
- A tool for building new stories (that needs a feature spec).

${plan}`,
  },
  {
    id: "interactive-timeline",
    label: "Interactive timeline",
    description: "Events along a time axis that people can move through and open.",
    skills: ["skill.interactive-ui-concept"],
    body: `# Interactive timeline: [NAME]

- Where: [ROUTE]
- Events come from: [FILE / API / ENTERED BY USERS]
- Each event shows: [DATE, TITLE, SUMMARY, IMAGE]
- People can: [scroll / step / filter by category / open details]

## Interaction
- Arrow keys move between events; Enter opens the details.
- Phone: a vertical list.
- Empty: a message when there are no events; loading and error states for remote data.

## Not in this build
- Editing events in the app (that needs saved data and a feature spec).

${plan}`,
  },
  {
    id: "before-after-slider",
    label: "Before/after slider",
    description: "Compare two images or states with a draggable divider.",
    skills: ["skill.interactive-ui-concept"],
    body: `# Before/after comparison: [NAME]

- Where: [ROUTE AND SECTION]
- Before: [IMAGE OR STATE] · After: [IMAGE OR STATE]
- Labels: [BEFORE LABEL] / [AFTER LABEL]

## Interaction
- A divider people drag, built on a native range input so arrow keys and screen readers work.
- Touch: drag anywhere on the image.
- Reduced motion: no animated intro.
- Images reserve their space so nothing shifts while loading.

## Done when
- Works with mouse, touch and keyboard, with visible focus.
- Both images have alt text.`,
  },
  {
    id: "workflow-simulator",
    label: "Workflow simulator",
    description: "A process map people can run with different inputs to see what happens. Needs a feature spec.",
    skills: ["skill.svg-workflow-visualization", "skill.data-simulation-scenarios", "skill.database-backed-feature"],
    body: `# Workflow simulator: [NAME]

- Who uses it: [USER]
- The process: [STEPS, DECISIONS, HAND-OFFS]
- Inputs people change: [VOLUME, STAFFING, RULES]
- What it shows: [WAIT TIMES, BOTTLENECKS, COSTS]
- Assumptions shown on screen: [LIST]

## Interaction
- The workflow as an SVG map; each step is focusable and opens its details.
- A table of the same steps and results for people who can't use the map.
- Results are labelled as estimates.

## Not in this build
- [e.g. saving and sharing scenarios]

${plan}

Attach a feature spec (System Settings → PRD templates → Simulation or what-if tool) for the formulas, data and saved scenarios.`,
  },
  {
    id: "ai-review-queue",
    label: "AI review queue",
    description: "AI drafts or classifications that people review, edit, approve or reject. Needs a feature spec.",
    skills: ["skill.ai-assisted-workflow", "skill.database-backed-feature"],
    body: `# AI review queue: [NAME]

- Who reviews: [ROLE]
- What the AI produces: [SUMMARY / CLASSIFICATION / EXTRACTED FIELDS]
- Its output shape: [FIELDS AND TYPES]
- Model: [local / hosted, and what data may be sent to it]

## Flow
1. Items arrive in the queue with the AI's output marked as generated.
2. A reviewer edits, approves or rejects each one, with a reason for rejections.
3. Approved items move on; the history shows who decided what.

## States
- Loading, empty queue, AI failure (continue by hand), time-out, partial output.

## Not in this build
- [e.g. automatic approval]

${plan}

Attach a feature spec (System Settings → PRD templates → AI feature) for the schema, review rules and privacy.`,
  },
  {
    id: "3d-product-explainer",
    label: "3D product explainer",
    description: "A product model people can rotate and inspect, with a fallback when WebGL isn't available.",
    skills: ["skill.threejs-experience", "skill.audit-accessibility"],
    body: `# 3D product explainer: [NAME]

- Where: [ROUTE]
- Model: [FILE, FORMAT, SIZE]
- Why 3D: [WHAT PEOPLE NEED TO INSPECT THAT A PHOTO CAN'T SHOW]
- Hotspots: [PART → EXPLANATION]

## Interaction
- Drag or arrow keys rotate; buttons reset the view and step through the hotspots.
- The hotspot explanations are also listed as text beside the model.
- No automatic camera movement under reduced motion.
- Phone: a lighter model or a still image with the same list.
- WebGL unavailable: a still image and the list.

## Limits
- Installing three needs approval. Pause rendering off screen; clean up on leaving the page.

${plan}`,
  },
];

/** A template's text for the request box. */
export function requestTemplate(id: string): string {
  return (REQUEST_TEMPLATES.find((t) => t.id === id) ?? REQUEST_TEMPLATES[0]).body;
}
