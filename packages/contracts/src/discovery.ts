/**
 * "Let's solve a problem": Light Research and Deep Research discovery (docs/discovery-modes-spec.md).
 * Both modes turn a problem into a focused first version and a product requirements document (PRD), keeping the
 * user's original problem central and separating facts, user input, sources, AI hypotheses, simulated feedback and
 * open questions. Steps are declared here once; the daemon generates their AI parts and the UI renders them.
 */

export type ResearchMode = "light" | "deep";

/** Where a finding came from. Every finding shows one; AI output is never presented as verified evidence. */
export type EvidenceLabel = "user" | "sourced" | "real" | "ai_hypothesis" | "ai_perspective" | "open_question" | "needs_testing";
export const EVIDENCE_LABELS: Record<EvidenceLabel, { label: string; meaning: string }> = {
  user: { label: "User-provided insight", meaning: "Information you entered or confirmed" },
  sourced: { label: "Sourced public finding", meaning: "A claim supported by a visible public source and date" },
  real: { label: "Real research finding", meaning: "Evidence from an actual interview, survey, usability session, experiment or observed behavior" },
  ai_hypothesis: { label: "AI-generated hypothesis", meaning: "A possible explanation or assumption created by AI that still needs testing" },
  ai_perspective: { label: "AI-generated perspective", meaning: "A simulated viewpoint, not a real person or interview" },
  open_question: { label: "Open question", meaning: "Information that is currently unknown" },
  needs_testing: { label: "Needs real-world testing", meaning: "A high-impact assumption that should be tested with real people or data" },
};
export const EVIDENCE_ORDER = Object.keys(EVIDENCE_LABELS) as EvidenceLabel[];

/** Shown wherever virtual experts or users, simulated tests, market summaries or assessments appear. */
export const AI_DISCLOSURE =
  "This is AI-generated guidance based on the information available. It can help identify questions and risks, but it is not real customer research or proof that an idea will succeed.";

export const PRD_EXPLAINER = "A product requirements document (PRD) is a clear plan for what the first version of your product should do.";

export const LIGHT_READINESS = ["Ready to shape a prototype", "Needs a few real conversations", "Needs a clearer problem or target user"] as const;
export const DEEP_READINESS = ["Needs clearer problem framing", "Needs stronger user evidence", "Ready for prototype planning", "Ready for MVP planning", "Requires expert review before build/release"] as const;

export interface DiscoveryField {
  id: string;
  label: string;
  type: "text" | "textarea" | "list" | "choice" | "multichoice";
  required?: boolean;
  placeholder?: string;
  helper?: string;
  /** Example answers shown as tap-to-add suggestions or hints. */
  examples?: string[];
  options?: string[];
  /** For multichoice: how many to pick. */
  min?: number;
  max?: number;
}

export interface DiscoveryColumn {
  id: string;
  label: string;
  /** A fixed set of values (shown as a select when editing). */
  options?: string[];
  /** Wider cell for longer text. */
  wide?: boolean;
}

export interface DiscoveryBlock {
  id: string;
  label: string;
  kind: "text" | "list" | "table" | "fields";
  hint?: string;
  columns?: DiscoveryColumn[];
  /** For "fields": named values shown as a definition list. */
  keys?: Array<{ id: string; label: string }>;
  /** Each row carries an evidence label. */
  labelled?: boolean;
  /** The label every generated row gets when the model leaves it out. */
  defaultLabel?: EvidenceLabel;
  /** Rows the user adds (real findings, alternatives); the AI never writes these. */
  userRows?: boolean;
  /** The AI doesn't generate this block (the user fills it, or FlowCode fills it from earlier steps). */
  manual?: boolean;
  minRows?: number;
  maxRows?: number;
  /** Show the AI disclosure next to this block. */
  disclosure?: boolean;
  /** A label shown on the block (e.g. "Positioning hypothesis: needs real-world testing"). */
  badge?: string;
}

export interface DiscoveryStep {
  id: string;
  mode: ResearchMode;
  /** Short name in the progress list. */
  name: string;
  /** Screen title: one main question. */
  title: string;
  copy: string;
  fields: DiscoveryField[];
  blocks: DiscoveryBlock[];
  /** What the model is asked to do (plain instructions; context from earlier steps is added by FlowCode). */
  prompt?: string;
  /** The user must approve this step before later steps (the problem-to-solution map). */
  gate?: boolean;
  /** Primary action label for generating this step's AI part. */
  generateLabel?: string;
  /** Approve / review actions for a gate: label → step to open (undefined = approve). */
  gateActions?: Array<{ label: string; goTo?: string }>;
  /** Show the AI disclosure at the top of the step. */
  disclosure?: boolean;
  /** Special steps assembled by FlowCode. */
  special?: "summary" | "report" | "prd" | "build";
  /** Text shown above generated content when the user should check it ("Is this accurate?"). */
  confirm?: string;
  /** After the open answer, FlowCode reasons about the problem and asks follow-ups with suggested answers. */
  followUps?: boolean;
}

/** A follow-up FlowCode asked after reasoning about the problem, with answers the person can tap. */
export interface FollowUpQuestion {
  question: string;
  /** One plain sentence: why this question matters for the plan. */
  why: string;
  suggestions: string[];
  answer?: string;
  skipped?: boolean;
  askedAt: string;
}
export const FOLLOW_UP_MAX = 3;

const knownStatus = ["Known", "Partly known", "Unknown"];
const importance3 = ["High", "Medium", "Low"];

// ───────────────────────── Light Research ─────────────────────────

/**
 * Light Research is AI-first: the person describes the problem once and FlowCode drafts the rest for them to review.
 * Optional answers refine a draft; they are never required to get one.
 */
const PROBLEM_FIELDS: DiscoveryField[] = [
  { id: "problem", label: "Describe the problem", type: "textarea", required: true, placeholder: "Example: New freelancers struggle to keep track of invoices, payments, and which clients need a follow-up.", helper: "Describe the problem before describing the app or feature you want to build." },
  { id: "painPoints", label: "What makes this problem difficult?", type: "list", helper: "Optional. Leave it empty and FlowCode suggests the difficulties.", examples: ["It takes too much time.", "Information is spread across too many places.", "People are not sure what to do next.", "The current process is confusing.", "People make avoidable mistakes.", "Existing tools are too expensive or complicated."] },
];
const PROBLEM_BLOCKS: DiscoveryBlock[] = [
  { id: "summary", label: "Here is how I understand the problem", kind: "text" },
  { id: "difficulties", label: "The main difficulties appear to be", kind: "list", maxRows: 6, hint: "Any you didn't write yourself are FlowCode's suggestions to check." },
  { id: "redirect", label: "Before we plan it", kind: "text", hint: "Filled only when the answer describes a solution instead of a problem." },
];
const PROBLEM_PROMPT =
  "Restate the user's problem in plain language in two or three sentences, without adding facts they didn't give. List the main difficulties (at most 6): use the user's pain points when given, merged and clarified; when they gave none, suggest the likely difficulties from the problem. If the problem text only describes an app, feature or product instead of a difficulty people have, set redirect to: \"It sounds like you have a solution in mind. That is a useful start. Before we plan it, let's clarify what problem it should solve. What is difficult for people today before they use your idea?\" Otherwise leave redirect empty.";

export const LIGHT_STEPS: DiscoveryStep[] = [
  {
    id: "l_problem",
    mode: "light",
    name: "Your problem",
    title: "What problem do you want to solve?",
    copy: "Describe something that is difficult, slow, expensive, confusing, stressful or frustrating for people today. FlowCode asks a few follow-up questions with suggested answers, then drafts the plan for you to review.",
    fields: [{ ...PROBLEM_FIELDS[0], label: "What problem do you want to solve?", helper: "Use your own words. Describe what is hard for people today, before describing the app you want to build." }],
    followUps: true,
    blocks: [
      ...PROBLEM_BLOCKS,
      { id: "profile", label: "Who has this problem", kind: "fields", keys: [{ id: "primaryUser", label: "Primary user" }, { id: "situation", label: "When it happens" }, { id: "challenge", label: "Main challenge" }, { id: "impact", label: "What happens if it isn't solved" }] },
      { id: "stillToLearn", label: "What we still need to learn", kind: "list", maxRows: 5 },
    ],
    prompt: `${PROBLEM_PROMPT} Then describe one main group of people who have it (from the user's answer, or the most likely group when they gave none): when it happens, the main challenge, and what happens if it isn't solved. Roles and situations only, no demographic stereotypes. List 3 to 5 things still to learn (for example how often it happens, how people solve it today, whether it is painful enough to change behavior).`,
    generateLabel: "Draft my plan",
    confirm: "Is this accurate?",
  },
  {
    id: "l_draft",
    mode: "light",
    name: "First-version draft",
    title: "Your first-version draft",
    copy: "FlowCode drafted this from your problem: the assumptions it depends on and the smallest useful first version. Edit anything that's off, or add detail below and write it again.",
    fields: [
      { id: "today", label: "How do people handle this today?", type: "textarea", helper: "Optional. They may use a spreadsheet, notes, email, another tool, a service, or simply avoid the task." },
      { id: "idea", label: "Your solution idea, if you have one", type: "textarea", helper: "Optional. FlowCode keeps it focused on the problem." },
    ],
    blocks: [
      { id: "assumptions", label: "Early assumptions", kind: "table", maxRows: 5, labelled: true, defaultLabel: "ai_hypothesis", disclosure: true, hint: "These are early assumptions. They are useful to test, not facts to treat as proven.", columns: [{ id: "assumption", label: "Assumption", wide: true }, { id: "whyItMatters", label: "Why it matters", wide: true }, { id: "knownNow", label: "What we know now", options: knownStatus }, { id: "nextStep", label: "Best next step", wide: true }] },
      { id: "concept", label: "Proposed first version", kind: "text" },
      { id: "benefit", label: "Main user benefit", kind: "text" },
      { id: "journey", label: "Core user journey", kind: "list", maxRows: 6 },
      { id: "mustHave", label: "Must-have capabilities", kind: "table", minRows: 3, maxRows: 5, columns: [{ id: "capability", label: "Capability", wide: true }, { id: "addresses", label: "Pain point or goal it addresses", wide: true }] },
      { id: "later", label: "Later, not now", kind: "list", maxRows: 6 },
      { id: "nonGoals", label: "Not in this version", kind: "list", maxRows: 6 },
    ],
    prompt:
      "First, list no more than 5 high-impact assumptions behind this idea: things that must be true for a solution to be useful (for example how often the problem happens, whether people would change how they work). For each: why it matters, what is known now (Known only if the user stated it; usually Unknown or Partly known), and the simplest next test with real people (prefer asking about the last time it happened). Then propose the smallest useful first version: a one-sentence concept, the main user benefit, the core user journey (3 to 6 steps), 3 to 5 must-have capabilities (each tied to a documented pain point or goal; nothing added just because it is technically possible), a 'later, not now' list, and explicit non-goals. Use the user's own solution idea when they gave one, kept focused on the problem. Do not add accounts, databases, AI features, payments or integrations unless the problem needs them.",
    generateLabel: "Draft the first version",
  },
  {
    id: "l_fit",
    mode: "light",
    name: "How it helps",
    title: "How this solution helps",
    copy: "A useful product connects back to the problem it is trying to solve. Review how each part of this first version could help the people you want to serve.",
    fields: [],
    gate: true,
    blocks: [
      { id: "original", label: "Original problem", kind: "text", manual: true },
      { id: "refined", label: "Refined problem", kind: "text" },
      { id: "solution", label: "Proposed solution", kind: "text" },
      { id: "map", label: "Problem-to-solution map", kind: "table", minRows: 2, maxRows: 8, columns: [{ id: "pain", label: "Problem or pain point", wide: true }, { id: "does", label: "What the solution does", wide: true }, { id: "whyHelps", label: "Why that may help", wide: true }, { id: "toTest", label: "What still needs testing", wide: true }] },
      { id: "before", label: "Before", kind: "text" },
      { id: "after", label: "After", kind: "text" },
      { id: "current", label: "Current approach", kind: "text" },
      { id: "better", label: "What may be better about this solution", kind: "text" },
      { id: "tradeoffs", label: "Tradeoffs or concerns", kind: "text" },
      { id: "assumptions", label: "Assumptions to test", kind: "table", maxRows: 5, labelled: true, defaultLabel: "needs_testing", columns: [{ id: "assumption", label: "Assumption", wide: true }, { id: "importance", label: "Importance", options: importance3 }, { id: "evidence", label: "Evidence", options: knownStatus }, { id: "nextTest", label: "Best next test", wide: true }] },
    ],
    prompt: "Explain how the proposed first version addresses the user's ORIGINAL problem and pain points. Write a refined problem statement and the one-sentence solution. In the map, give every pain point a row: what the solution does, why that may help (say 'may', never claim it will), and what still needs testing. Describe the workflow before and after, compare with the current workaround (what may be better, tradeoffs or concerns), and list at most 5 assumptions to test with importance and evidence.",
    generateLabel: "Explain how it helps",
    gateActions: [{ label: "This matches my problem" }, { label: "Edit the solution", goTo: "l_draft" }, { label: "Change the problem", goTo: "l_problem" }],
  },
  {
    id: "l_summary",
    mode: "light",
    name: "Review and summary",
    title: "What looks strong, and what should you test next?",
    copy: "An early assessment and your idea summary in one place. It is not a prediction of success; use it to focus your next steps.",
    special: "summary",
    disclosure: true,
    fields: [],
    blocks: [
      { id: "assessment", label: "Early assessment", kind: "table", minRows: 5, maxRows: 5, columns: [{ id: "category", label: "Category" }, { id: "rating", label: "Rating", options: ["Early", "Developing", "Strong"] }, { id: "why", label: "Why", wide: true }, { id: "improve", label: "How to improve", wide: true }] },
      { id: "critique", label: "AI-generated idea review", kind: "fields", disclosure: true, keys: [{ id: "strongest", label: "Strongest part of the concept" }, { id: "biggestRisk", label: "Biggest risk" }, { id: "scopeConcern", label: "Scope concern" }, { id: "objection", label: "Potential user objection" }, { id: "nextTest", label: "Suggested next test" }] },
      { id: "readiness", label: "Build readiness", kind: "fields", keys: [{ id: "status", label: "Status" }, { id: "explanation", label: "What this means" }, { id: "nextStep", label: "Recommended next step" }] },
    ],
    prompt: `Assess exactly these 5 categories, in this order: Problem clarity (is the problem described clearly?), User focus (is there a clear first group of users?), Pain importance (does the problem appear meaningful enough to solve?), Evidence (how much is known versus assumed? Without real conversations this is Early), First-version focus (is the first version narrow and practical?). Rate each Early, Developing or Strong, say why, and how to improve. Never give an overall score or predict success. Then write a short review: strongest part, biggest risk, scope concern, a potential user objection, and the suggested next test. Finally choose the build readiness status, exactly one of: ${LIGHT_READINESS.map((s) => `"${s}"`).join(", ")}; explain it in two or three plain sentences and give one recommended next step.`,
    generateLabel: "Review my idea",
  },
  {
    id: "l_prd",
    mode: "light",
    name: "Starter PRD",
    title: "Your starter product requirements document (PRD)",
    copy: `${PRD_EXPLAINER} It is made from your approved summary and keeps the first version narrow.`,
    special: "prd",
    fields: [],
    blocks: [],
    generateLabel: "Generate starter PRD",
  },
  {
    id: "l_build",
    mode: "light",
    name: "Start a prototype",
    title: "Build a clickable prototype",
    copy: "FlowCode turns your PRD into a prototype plan. Every planned step traces back to a pain point, goal or necessary dependency, and anything that doesn't is flagged as possible scope creep.",
    special: "build",
    fields: [],
    blocks: [],
  },
];

/** Light steps FlowCode drafts one after another from the problem ("Draft my plan"). */
export const LIGHT_AUTODRAFT = ["l_problem", "l_draft", "l_fit"];

// ───────────────────────── Deep Research ─────────────────────────


export const DEEP_STEPS: DiscoveryStep[] = [
  {
    id: "d_problem",
    mode: "deep",
    name: "Problem and outcome",
    followUps: true,
    title: "What problem do you want to solve?",
    copy: "Describe the difficulty first, then what would be better for people if it were solved.",
    fields: [
      ...PROBLEM_FIELDS,
      { id: "included", label: "What is included in this problem?", type: "textarea" },
      { id: "excluded", label: "What is outside this problem for now?", type: "textarea" },
      { id: "outcome", label: "What would be better for the user if this problem were solved?", type: "textarea", helper: "Optional. FlowCode suggests one from your problem." },
      { id: "frequency", label: "How often do you think this problem happens?", type: "choice", options: ["Rarely", "Sometimes", "Often", "Very often", "Not sure yet"] },
      { id: "severity", label: "How serious do you think the impact is?", type: "choice", options: ["Small inconvenience", "Noticeable frustration", "Costly or time-consuming", "High-stakes or harmful", "Not sure yet"] },
    ],
    blocks: [
      ...PROBLEM_BLOCKS,
      { id: "estimates", label: "Your estimates", kind: "text", hint: "These are estimates until research supports them." },
    ],
    prompt: `${PROBLEM_PROMPT} In estimates, restate the user's frequency and severity guesses and the desired outcome, labelled as estimates that research should confirm.`,
    generateLabel: "Summarize my problem",
    confirm: "Is this accurate?",
  },
  {
    id: "d_brief",
    mode: "deep",
    name: "Research plan",
    title: "Set up your research plan",
    copy: "A clear research goal helps you focus on the most important questions before you build.",
    fields: [
      { id: "goal", label: "What do you need to learn before building?", type: "textarea", helper: "Optional. FlowCode suggests a research goal from your problem.", examples: ["I need to know whether freelance designers struggle enough with invoice follow-ups to use a new tool.", "I need to understand which part of the school pickup process frustrates parents most.", "I need to compare two solution approaches before investing in development."] },
      { id: "decision", label: "What decision should this research help you make?", type: "choice", options: ["Build a prototype", "Narrow the target user", "Change the solution approach", "Run real interviews first", "Pause the idea"] },
      { id: "constraints", label: "What limits should we consider?", type: "list", examples: ["Time available", "Budget", "Team skills", "Required launch date", "Existing audience", "Privacy or compliance concerns"] },
    ],
    blocks: [{ id: "questions", label: "Most important questions", kind: "list", minRows: 3, maxRows: 6 }],
    prompt: "If the user gave no research goal, assume it is to learn whether this problem is worth solving and what the first version should focus on. From the research goal, the decision and the constraints, list the 3 to 6 most important questions this research should answer, most important first. Plain language, one question each.",
    generateLabel: "Write the research questions",
  },
  {
    id: "d_users",
    mode: "deep",
    name: "People and context",
    title: "Understand the people and situations involved",
    copy: "Describe roles and situations, not demographics. Profiles stay hypotheses until real research confirms them.",
    fields: [
      { id: "primaryUser", label: "Who is most affected?", type: "text", helper: "Optional. FlowCode suggests the main group from your problem." },
      { id: "others", label: "Who else is involved?", type: "list", helper: "A secondary user, the buyer or decision-maker, an administrator, or someone affected who never uses the product.", examples: ["The person who pays", "An administrator", "A client who receives the result"] },
    ],
    blocks: [
      { id: "profiles", label: "Profiles", kind: "table", minRows: 1, maxRows: 5, labelled: true, defaultLabel: "ai_hypothesis", columns: [{ id: "role", label: "Role" }, { id: "kind", label: "Type", options: ["Primary user", "Secondary user", "Buyer or decision-maker", "Administrator or operator", "Affected non-user"] }, { id: "goal", label: "Goal", wide: true }, { id: "trigger", label: "Trigger", wide: true }, { id: "context", label: "Context", wide: true }, { id: "currentProcess", label: "Current process", wide: true }, { id: "frustrations", label: "Frustrations", wide: true }, { id: "workarounds", label: "Workarounds", wide: true }, { id: "barriers", label: "Barriers to change", wide: true }, { id: "success", label: "Success looks like", wide: true }, { id: "accessibility", label: "Accessibility needs", wide: true }] },
    ],
    prompt: "Create one profile per role (primary user first, then secondary user, buyer, administrator or affected non-user when relevant). For each: goal, trigger, context (where and when), current process, frustrations, workarounds, barriers to change, what success looks like, and accessibility needs (conditions, environments, devices, limitations). Roles, context and behavior only: no demographic stereotypes.",
    generateLabel: "Draft the profiles",
  },
  {
    id: "d_journey",
    mode: "deep",
    name: "Current journey",
    title: "Map what happens today",
    copy: "Break the current process into steps. This helps you see where people lose time, make mistakes, feel stuck or need help.",
    fields: [],
    blocks: [
      { id: "steps", label: "Current journey", kind: "table", minRows: 3, maxRows: 10, labelled: true, defaultLabel: "ai_hypothesis", columns: [{ id: "step", label: "Step" }, { id: "action", label: "What the person does today", wide: true }, { id: "tools", label: "Tools or people involved" }, { id: "difficulty", label: "Difficulty", options: ["Low", "Medium", "High"] }, { id: "emotion", label: "Emotion" }, { id: "pain", label: "Pain point", wide: true }, { id: "opportunity", label: "Opportunity", wide: true }] },
      { id: "highlights", label: "Where it matters most", kind: "fields", keys: [{ id: "friction", label: "Highest-friction moments" }, { id: "risky", label: "Most expensive or risky moments" }, { id: "frequent", label: "Most frequent moments" }, { id: "abandon", label: "Where people give up" }, { id: "smallWins", label: "Where a small improvement could matter" }] },
    ],
    prompt: "Map the current journey of the primary user as 3 to 10 steps: what they do, tools or people involved, difficulty, emotion, the pain point and an opportunity. Then name the highest-friction, most expensive or risky, most frequent moments, where people give up, and where a small improvement could create meaningful value.",
    generateLabel: "Map the journey",
  },
  {
    id: "d_ledger",
    mode: "deep",
    name: "Evidence and assumptions",
    title: "Separate what you know from what you need to test",
    copy: "One place for every claim this idea depends on, where it came from, and what to do next. Add your own rows as you learn more.",
    fields: [],
    blocks: [
      { id: "entries", label: "Evidence and assumption ledger", kind: "table", maxRows: 30, labelled: true, defaultLabel: "ai_hypothesis", userRows: true, columns: [{ id: "statement", label: "Statement", wide: true }, { id: "category", label: "Category", options: ["Problem", "User behavior", "Audience", "Market", "Alternative/competitor", "Value proposition", "Adoption", "Pricing/business model", "Feasibility", "Accessibility", "Privacy/trust", "Safety/compliance", "Delivery/operations"] }, { id: "evidenceLevel", label: "Evidence level", options: ["Unknown", "Early signal", "Partly supported", "Well supported"] }, { id: "importance", label: "Importance", options: ["Low", "Medium", "High", "Critical"] }, { id: "source", label: "Source or notes", wide: true }, { id: "nextAction", label: "Best next action", wide: true }] },
    ],
    prompt: "List the statements this idea depends on (8 to 15), across problem, user behavior, audience, market, alternatives, value, adoption, pricing, feasibility, accessibility, privacy, safety and delivery. Evidence level is Unknown or Early signal unless the user supplied evidence. Mark importance honestly and give the best next action for each. Never call anything validated.",
    generateLabel: "Draft the ledger",
  },
  {
    id: "d_market",
    mode: "deep",
    name: "Alternatives",
    title: "Explore the alternatives people already have",
    copy: "A competitor is not only another app. It can be a spreadsheet, a manual process, a service, advice from another person, or doing nothing.",
    fields: [{ id: "known", label: "Alternatives you know about", type: "list", helper: "Products, spreadsheets, services, people, or doing nothing." }],
    blocks: [
      { id: "notice", label: "About this step", kind: "text", manual: true },
      { id: "alternatives", label: "Alternative map", kind: "table", maxRows: 12, labelled: true, defaultLabel: "ai_hypothesis", userRows: true, columns: [{ id: "name", label: "Alternative" }, { id: "type", label: "Type", options: ["Direct product/service", "Indirect product/service", "Manual workaround", "Human service", "Internal process", "No-action alternative"] }, { id: "audience", label: "Who it appears to serve" }, { id: "helps", label: "What it helps with", wide: true }, { id: "tradeoff", label: "Potential tradeoff", wide: true }, { id: "verify", label: "What needs verification", wide: true }] },
      { id: "positioning", label: "Positioning", kind: "text", badge: "Positioning hypothesis: needs real-world testing" },
    ],
    prompt: "Build an alternative map from the user's known alternatives plus the obvious types (manual workaround, a spreadsheet or general tool, a human service, doing nothing). Do NOT name specific companies or claim anything about their pricing, quality, adoption or market share: FlowCode has no verified market data here. For each: who it serves, what it helps with, a potential tradeoff, and what needs verification. Then write one positioning hypothesis: 'For [target user] who struggle with [problem], [product concept] may help them [desired outcome] by [distinct approach], unlike [current alternative], which [tradeoff to verify].'",
    generateLabel: "Map the alternatives",
  },
  {
    id: "d_perspectives",
    mode: "deep",
    name: "Viewpoints",
    title: "Explore different viewpoints",
    copy: "FlowCode can simulate viewpoints to help you discover questions, risks and opportunities. These are AI-generated perspectives, not real interviews.",
    disclosure: true,
    fields: [{ id: "chosen", label: "Which viewpoints do you want to explore?", type: "multichoice", helper: "Optional. FlowCode picks a potential user, a skeptical buyer, a subject-matter expert and an accessibility reviewer if you don't choose.", min: 3, max: 6, options: ["Potential user", "Skeptical buyer", "Subject-matter expert", "Operations lead", "Customer-support lead", "Accessibility reviewer", "Privacy and trust reviewer", "Security reviewer", "Designer", "Engineer", "Marketing strategist", "Business owner", "Administrator"] }],
    blocks: [
      { id: "perspectives", label: "Perspectives", kind: "table", minRows: 3, maxRows: 6, labelled: true, defaultLabel: "ai_perspective", disclosure: true, columns: [{ id: "role", label: "Perspective" }, { id: "goals", label: "Likely goals", wide: true }, { id: "concerns", label: "Likely concerns", wide: true }, { id: "questions", label: "Questions they may ask", wide: true }, { id: "objection", label: "Potential objection", wide: true }, { id: "recommendation", label: "What could make it more useful", wide: true }, { id: "assumptions", label: "Assumptions to test with real people", wide: true }, { id: "interviewQuestions", label: "Suggested real interview questions", wide: true }] },
    ],
    prompt: "For each chosen viewpoint, simulate how that role might see the idea: likely goals, concerns, questions they may ask, a potential objection, what could make the product more useful, assumptions to test with real people, and real interview questions to ask them. These are simulations: never present them as representative of a real population, and never give authoritative legal, medical, financial, safety or security advice; say when qualified review is needed.",
    generateLabel: "Explore the viewpoints",
  },
  {
    id: "d_interviews",
    mode: "deep",
    name: "Real conversations",
    title: "Plan real conversations",
    copy: "Turn unknowns into real learning. Ask about what people did, not whether they like your idea.",
    fields: [],
    blocks: [
      { id: "plan", label: "Research plan", kind: "fields", keys: [{ id: "objective", label: "Research objective" }, { id: "who", label: "Who to talk to" }, { id: "count", label: "Suggested number of participants (a starting point)" }, { id: "recruit", label: "Recruitment ideas" }, { id: "signals", label: "Signals to look for" }, { id: "privacy", label: "Consent and privacy reminder" }] },
      { id: "screening", label: "Screening questions", kind: "list", maxRows: 5 },
      { id: "questions", label: "Interview questions", kind: "list", minRows: 5, maxRows: 10, hint: "Open-ended questions about past behavior." },
      { id: "followUps", label: "Follow-up prompts", kind: "list", maxRows: 6 },
      { id: "findings", label: "Real research findings", kind: "table", userRows: true, manual: true, labelled: true, defaultLabel: "real", hint: "Add notes from real conversations. Remove names, account details, health or financial details unless they are necessary and properly handled.", columns: [{ id: "participant", label: "Participant or context", wide: false }, { id: "observation", label: "Quote or observation", wide: true }, { id: "question", label: "Research question", wide: true }, { id: "theme", label: "Theme" }, { id: "strength", label: "Strength of evidence", options: ["Weak signal", "Moderate", "Strong"] }, { id: "assumption", label: "Related assumption", wide: true }, { id: "implication", label: "Product implication", wide: true }, { id: "followUp", label: "Follow-up action", wide: true }] },
    ],
    prompt: "Write a plan for real conversations that test the priority assumptions: objective, who to talk to, a suggested starting number of participants (not a guarantee), recruitment ideas, signals to look for, and a consent and privacy reminder. Add up to 5 screening questions, 5 to 10 open-ended interview questions about past behavior (for example 'Tell me about the last time you had this problem'), and follow-up prompts. Avoid leading or hypothetical questions like 'Would you use my app?'.",
    generateLabel: "Plan the conversations",
  },
  {
    id: "d_options",
    mode: "deep",
    name: "Solution options",
    title: "Explore solution options",
    copy: "Avoid locking into the first idea too early. Compare a few distinct approaches, then choose a direction.",
    fields: [{ id: "idea", label: "Your solution idea, if you have one", type: "textarea" }],
    blocks: [
      { id: "options", label: "Solution options", kind: "table", minRows: 2, maxRows: 4, columns: [{ id: "title", label: "Option" }, { id: "approach", label: "Core approach", wide: true }, { id: "pains", label: "Pain points addressed", wide: true }, { id: "benefit", label: "Main benefit", wide: true }, { id: "risk", label: "Main risk", wide: true }, { id: "complexity", label: "Build complexity", options: ["Lower concern", "Needs attention", "Higher risk"] }, { id: "firstTest", label: "Best first test", wide: true }] },
      { id: "comparison", label: "Comparison", kind: "table", columns: [{ id: "criterion", label: "Criterion" }, { id: "notes", label: "How the options compare", wide: true }] },
      { id: "selected", label: "Chosen direction", kind: "text", manual: true, hint: "Pick an option above, or write your own direction." },
    ],
    prompt: "Generate 2 to 4 genuinely distinct solution approaches (for example guided workflow, dashboard, education experience, automation assistant, template or toolkit, human-supported service). For each: core approach, pain points addressed, main benefit, main risk, build complexity (Lower concern, Needs attention or Higher risk), and the best first test. Then compare them qualitatively on: problem fit, evidence quality, user value, ease of adoption, feasibility for a first version, accessibility and inclusion, privacy and trust, cost and time to test. Do not claim one is objectively best.",
    generateLabel: "Explore options",
  },
  {
    id: "d_fit",
    mode: "deep",
    name: "Problem-to-solution fit",
    title: "How does the solution solve the problem?",
    copy: "A strong product idea clearly connects each important user problem to a useful part of the solution. Review this map before moving forward.",
    gate: true,
    fields: [],
    blocks: [
      { id: "original", label: "Original problem", kind: "text", manual: true },
      { id: "refined", label: "Refined problem", kind: "text" },
      { id: "outcome", label: "Desired user outcome", kind: "text" },
      { id: "solution", label: "Proposed solution", kind: "text" },
      { id: "promise", label: "Product promise", kind: "text" },
      { id: "map", label: "Traceability map", kind: "table", minRows: 2, maxRows: 12, columns: [{ id: "pain", label: "User problem or pain point", wide: true }, { id: "evidence", label: "Evidence" }, { id: "capability", label: "Solution capability", wide: true }, { id: "whyHelps", label: "Why it may help", wide: true }, { id: "behavior", label: "User-facing behavior", wide: true }, { id: "signal", label: "Success signal", wide: true }, { id: "risk", label: "Assumption or risk to test", wide: true }] },
      { id: "beforeAfter", label: "Before and after", kind: "table", columns: [{ id: "before", label: "Before", wide: true }, { id: "after", label: "After", wide: true }] },
      { id: "workaround", label: "Workaround comparison", kind: "fields", keys: [{ id: "current", label: "Current approach" }, { id: "better", label: "What may be better" }, { id: "tradeoffs", label: "Tradeoffs or adoption barriers" }, { id: "confirm", label: "What needs real-world confirmation" }] },
      { id: "included", label: "Included in the first version because it directly addresses", kind: "list" },
      { id: "excluded", label: "Not included yet because", kind: "list" },
    ],
    prompt: "Connect the chosen solution to the original problem. Refined problem, desired user outcome, one-sentence solution and a concrete product promise. In the traceability map, every high-priority pain point gets a row (or an explicit 'not in this version' with a reason); every must-have capability maps to a pain point, goal, accessibility need, compliance need or technical dependency; explain user outcomes, not feature names; say 'may help', never 'will'. Add before/after rows, a workaround comparison, and the scope filter: what is included (and which pain it addresses) and what is not included yet (and why).",
    generateLabel: "Build the traceability map",
    gateActions: [{ label: "Approve problem-to-solution map" }, { label: "Edit the solution", goTo: "d_options" }, { label: "Edit the problem", goTo: "d_problem" }, { label: "Review assumptions", goTo: "d_ledger" }],
  },
  {
    id: "d_risks",
    mode: "deep",
    name: "Risks",
    title: "Check what could make this harder to deliver or use",
    copy: "A helpful idea also needs to be practical, trustworthy and usable for the people it is meant to serve.",
    fields: [],
    blocks: [
      { id: "risks", label: "Risks", kind: "table", minRows: 4, maxRows: 12, columns: [{ id: "area", label: "Area", options: ["Product scope", "Technical feasibility", "Accessibility", "Privacy", "Security", "Trust", "Compliance", "Operations", "Business sustainability"] }, { id: "description", label: "Risk", wide: true }, { id: "why", label: "Why it matters", wide: true }, { id: "likelihood", label: "Likelihood", options: ["Low", "Medium", "High", "Unknown"] }, { id: "impact", label: "Impact", options: ["Low", "Medium", "High", "Critical"] }, { id: "evidence", label: "Evidence so far", wide: true }, { id: "mitigation", label: "Mitigation or next action", wide: true }, { id: "expertReview", label: "Qualified review needed?", options: ["No", "Yes"] }] },
    ],
    prompt: "Review the first version for risks in: product scope, technical feasibility, accessibility (keyboard, mobile, assistive technology, reduced motion), privacy (what is collected, stored, shared), security, trust, compliance, operations and business sustainability. For each high-priority risk: why it matters, likelihood, impact, evidence so far, mitigation or next action, and whether qualified professional review is needed. Health, finance, legal, safety, children, employment, housing, insurance and education records always need qualified review.",
    generateLabel: "Review the risks",
  },
  {
    id: "d_tests",
    mode: "deep",
    name: "Test the idea",
    title: "Test the idea before you build",
    copy: "Test the most important assumptions with the smallest credible experiment you can run. FlowCode can help you plan and simulate a first review, but real-user testing provides stronger evidence.",
    fields: [],
    blocks: [
      { id: "concept", label: "Concept test plan", kind: "fields", keys: [{ id: "concept", label: "Core concept to test" }, { id: "participants", label: "Who to test with" }, { id: "understand", label: "What they should understand" }, { id: "reactions", label: "Decisions or reactions that matter" }, { id: "script", label: "Test script" }, { id: "success", label: "Success signals" }, { id: "warnings", label: "Warning signs" }, { id: "record", label: "How to record findings" }] },
      { id: "tasks", label: "Prototype test tasks", kind: "table", maxRows: 6, columns: [{ id: "task", label: "Task", wide: true }, { id: "expected", label: "Expected outcome", wide: true }, { id: "observe", label: "What to observe", wide: true }, { id: "followUp", label: "Follow-up questions", wide: true }] },
      { id: "virtual", label: "Simulated review", kind: "table", maxRows: 5, labelled: true, defaultLabel: "ai_perspective", disclosure: true, badge: "AI-generated simulated review: not real usability testing", columns: [{ id: "perspective", label: "Test perspective" }, { id: "clear", label: "What appears clear", wide: true }, { id: "confusing", label: "What may be confusing", wide: true }, { id: "nextAction", label: "Expected next action", wide: true }, { id: "objection", label: "Potential objection", wide: true }, { id: "failure", label: "Likely failure point", wide: true }, { id: "improvement", label: "Suggested improvement", wide: true }, { id: "limitation", label: "Confidence and limitation", wide: true }] },
      { id: "nextExperiment", label: "Recommended next experiment", kind: "text" },
    ],
    prompt: "Write a concept test plan, 3 to 6 task-based prototype test tasks (task, expected outcome, what to observe, follow-up questions), and a simulated first review from 3 to 5 context-based perspectives (never demographic stereotypes), each with what appears clear, what may be confusing, the expected next action, a potential objection, a likely failure point, a suggested improvement and its confidence and limitation. End with the recommended next experiment.",
    generateLabel: "Plan the tests",
  },
  {
    id: "d_experiments",
    mode: "deep",
    name: "What to test next",
    title: "Choose what to test next",
    copy: "Turn research into a practical action plan. FlowCode won't make a go or no-go decision for you; it shows the tradeoffs.",
    fields: [],
    blocks: [
      { id: "backlog", label: "Experiment backlog", kind: "table", minRows: 3, maxRows: 10, userRows: true, columns: [{ id: "question", label: "Assumption or question", wide: true }, { id: "importance", label: "Importance", options: ["Low", "Medium", "High", "Critical"] }, { id: "evidence", label: "Current evidence", wide: true }, { id: "method", label: "Proposed experiment", options: ["Customer interview", "Contextual observation", "Prototype usability test", "Landing-page or message test", "Concierge/manual service test", "Smoke test", "Content test", "Small internal pilot", "Technical spike", "Accessibility review", "Security/privacy review", "Pricing or willingness-to-pay research"] }, { id: "effort", label: "Cost/effort", options: ["Low", "Medium", "High"] }, { id: "decision", label: "If we learn… then we should…", wide: true }, { id: "priority", label: "Priority", options: ["Now", "Next", "Later"] }] },
    ],
    prompt: "Build an experiment backlog from the priority assumptions (high or critical importance with little evidence). For each: current evidence, a proposed experiment type, cost or effort, and a decision rule in the form 'If we learn [signal], then we should [continue/change/narrow/pause].' Prioritize as Now, Next or Later.",
    generateLabel: "Build the backlog",
  },
  {
    id: "d_report",
    mode: "deep",
    name: "Discovery report",
    title: "Your complete discovery report",
    copy: "Review what you learned, what remains uncertain, and what the first version should focus on before creating a product plan.",
    special: "report",
    fields: [],
    blocks: [
      { id: "executive", label: "Executive summary", kind: "fields", keys: [{ id: "problem", label: "Problem" }, { id: "user", label: "Primary user" }, { id: "solution", label: "Proposed solution" }, { id: "promise", label: "Product promise" }, { id: "unknown", label: "Most important unknown" }, { id: "nextAction", label: "Recommended next action" }] },
      { id: "readiness", label: "Build readiness", kind: "fields", keys: [{ id: "status", label: "Status" }, { id: "explanation", label: "What this means" }] },
      { id: "mvp", label: "Recommended first version", kind: "fields", keys: [{ id: "job", label: "Core job to be done (the main thing people need to get done)" }, { id: "journey", label: "Main user journey" }, { id: "capabilities", label: "Required capabilities" }, { id: "later", label: "Later capabilities" }, { id: "nonGoals", label: "Explicit non-goals" }, { id: "measures", label: "Success measures" }] },
      { id: "nextSteps", label: "Next steps", kind: "list", minRows: 3, maxRows: 5 },
    ],
    prompt: `Summarize the research for a decision. Executive summary (problem, primary user, proposed solution, product promise, most important unknown, recommended next action). Build readiness, exactly one of: ${DEEP_READINESS.map((s) => `"${s}"`).join(", ")}, explained in plain words. The recommended first version (core job, main journey, required capabilities, later capabilities, non-goals, success measures). 3 to 5 prioritized next steps. Never claim the idea is validated.`,
    generateLabel: "Write the report summary",
  },
  {
    id: "d_prd",
    mode: "deep",
    name: "Full PRD",
    title: "Create your product requirements document?",
    copy: `${PRD_EXPLAINER} This turns your approved research into a detailed plan for the first version of your product. You can review and edit it before you start a prototype.`,
    special: "prd",
    fields: [],
    blocks: [],
    generateLabel: "Generate full PRD",
  },
  {
    id: "d_build",
    mode: "deep",
    name: "Start a prototype",
    title: "Your product plan is ready",
    copy: "FlowCode can now turn this plan into a clickable prototype. It starts with the most important user flow and keeps it focused. When the design is right, Launch readiness lists what the real product needs.",
    special: "build",
    fields: [],
    blocks: [],
  },
];

export const stepsFor = (mode: ResearchMode): DiscoveryStep[] => (mode === "deep" ? DEEP_STEPS : LIGHT_STEPS);

/**
 * Stages group steps on one page so people move quickly: a stage's sections are drafted together, and the first
 * stage's main action drafts several stages in a row (stopping before anything that needs the user's approval).
 */
export interface DiscoveryStage {
  id: string;
  name: string;
  steps: string[];
  /** Steps drafted, in order, by the stage's main action. */
  draft?: string[];
  draftLabel?: string;
  /** Where to go when that draft finishes. */
  then?: string;
}

export const LIGHT_STAGES: DiscoveryStage[] = [
  { id: "l_problem", name: "Your problem", steps: ["l_problem"], draft: LIGHT_AUTODRAFT, draftLabel: "Draft my plan", then: "l_draft" },
  { id: "l_draft", name: "First-version draft", steps: ["l_draft"] },
  { id: "l_fit", name: "How it helps", steps: ["l_fit"] },
  { id: "l_summary", name: "Review and summary", steps: ["l_summary"] },
  { id: "l_prd", name: "Starter PRD", steps: ["l_prd"] },
  { id: "l_build", name: "Start a prototype", steps: ["l_build"] },
];

export const DEEP_STAGES: DiscoveryStage[] = [
  { id: "d_problem", name: "Problem and goal", steps: ["d_problem", "d_brief"], draft: ["d_problem", "d_brief", "d_users", "d_journey", "d_ledger", "d_market", "d_perspectives", "d_options", "d_fit"], draftLabel: "Draft my research", then: "d_options" },
  { id: "d_users", name: "Users and evidence", steps: ["d_users", "d_journey", "d_ledger", "d_market", "d_perspectives"], draft: ["d_users", "d_journey", "d_ledger", "d_market", "d_perspectives"], draftLabel: "Draft this stage" },
  { id: "d_options", name: "Solution and fit", steps: ["d_options", "d_fit"], draft: ["d_options", "d_fit"], draftLabel: "Draft this stage" },
  { id: "d_risks", name: "Risks and testing", steps: ["d_risks", "d_interviews", "d_tests", "d_experiments"], draft: ["d_risks", "d_interviews", "d_tests", "d_experiments"], draftLabel: "Draft this stage" },
  { id: "d_report", name: "Report and PRD", steps: ["d_report", "d_prd"] },
  { id: "d_build", name: "Start a prototype", steps: ["d_build"] },
];

export const stagesFor = (mode: ResearchMode): DiscoveryStage[] => (mode === "deep" ? DEEP_STAGES : LIGHT_STAGES);

/**
 * One flow: every project runs the core sections (problem, brief, solution and fit, report, PRD, build); these research
 * sections are added per stage when the idea needs them. A project without a research list (made before the single
 * flow) has them all.
 */
export const OPTIONAL_STEPS = ["d_users", "d_journey", "d_ledger", "d_market", "d_perspectives", "d_risks", "d_interviews", "d_tests", "d_experiments"];
type ResearchScope = Pick<DiscoveryProject, "mode" | "research">;
export const isActiveStep = (p: ResearchScope, stepId: string): boolean => p.mode !== "deep" || !OPTIONAL_STEPS.includes(stepId) || !p.research || p.research.includes(stepId);
export const activeSteps = (p: ResearchScope): DiscoveryStep[] => stepsFor(p.mode).filter((s) => isActiveStep(p, s.id));
/** A stage as the project shows it: only its active sections, plus the research that can still be added to it. */
export interface ProjectStage extends DiscoveryStage {
  /** Optional research sections in this stage not added yet. */
  addable: string[];
}
export const projectStages = (p: ResearchScope): ProjectStage[] =>
  stagesFor(p.mode).map((st) => ({
    ...st,
    steps: st.steps.filter((s) => isActiveStep(p, s)),
    draft: st.draft?.filter((s) => isActiveStep(p, s)),
    addable: st.steps.filter((s) => !isActiveStep(p, s)),
  }));
export const stageOf = (mode: ResearchMode, stepId: string): DiscoveryStage => stagesFor(mode).find((st) => st.steps.includes(stepId)) ?? stagesFor(mode)[0];
export const discoveryStep = (id: string): DiscoveryStep | undefined => [...LIGHT_STEPS, ...DEEP_STEPS].find((s) => s.id === id);

// ───────────────────────── Stored project ─────────────────────────

export type Row = Record<string, string> & { _label?: EvidenceLabel; _user?: "1" };
export type BlockValue = string | string[] | Row[] | Record<string, string>;

export interface StepOutput {
  data: Record<string, BlockValue>;
  generatedAt?: string;
  /** The user changed generated content. */
  edited?: boolean;
  approvedAt?: string;
  /** An earlier answer changed after this was made; it may need a review. */
  stale?: boolean;
}

export interface DocVersion {
  version: number;
  markdown: string;
  status: "draft" | "approved" | "superseded";
  createdAt: string;
  approvedAt?: string;
}

export type DiscoveryStatus = "draft" | "in_progress" | "report_ready" | "prd_draft" | "prd_approved" | "handed_off";

export interface DiscoveryProject {
  id: string;
  title: string;
  mode: ResearchMode;
  status: DiscoveryStatus;
  createdAt: string;
  updatedAt: string;
  currentStep: string;
  version: number;
  inputs: Record<string, Record<string, string | string[]>>;
  outputs: Record<string, StepOutput>;
  prds: DocVersion[];
  reports: DocVersion[];
  /** Set when a Light project was taken deeper. */
  upgradedAt?: string;
  /** The FlowCode build started from this project. */
  handoff?: { at: string; projectName?: string };
  /** Follow-up questions and answers per step. */
  followups?: Record<string, FollowUpQuestion[]>;
  /** Optional research sections this project has added (see OPTIONAL_STEPS). Missing: all of them (older projects). */
  research?: string[];
  /** AI-simulated interviews run with the interview plan's questions. Never real research. */
  virtualInterviews?: VirtualInterviews;
  /** AI-simulated participants trying the prototype test tasks. Never real usability testing. */
  virtualTests?: VirtualTests;
}

export const VIRTUAL_TEST_NOTE =
  "Virtual user testing uses AI-simulated people walking through your test tasks from the description of the idea. It can show where the concept is unclear before you test with real people; it is not real usability testing and never counts as evidence.";
export type VirtualTaskOutcome = "Completed" | "Struggled" | "Gave up";
export const VIRTUAL_TASK_OUTCOMES: VirtualTaskOutcome[] = ["Completed", "Struggled", "Gave up"];

export interface VirtualTestParticipant {
  id: string;
  name: string;
  profile: string;
  angle: string;
  results: Array<{ task: string; outcome: VirtualTaskOutcome; whatTheyDid: string; hesitation: string; quote: string; confidence: number }>;
  done: boolean;
}

export interface VirtualTests {
  startedAt: string;
  /** The test tasks when the session ran (to spot a changed plan). */
  tasks: string[];
  participants: VirtualTestParticipant[];
  synthesis?: {
    at: string;
    tasks: Array<{ task: string; completed: number; struggled: number; gaveUp: number; issue: string }>;
    issues: string[];
    valueSignals: string[];
    toVerify: string[];
  };
}

/** How many virtual participants FlowCode interviews. */
export const VIRTUAL_INTERVIEW_COUNT = 4;
export const VIRTUAL_INTERVIEW_NOTE =
  "Virtual participants are AI-simulated people, not real interviews. Use their answers to sharpen your questions and spot risks before you talk to real people. They never count as evidence.";

export interface VirtualParticipant {
  id: string;
  /** A made-up first name and role, e.g. "Maya, a parent shopping on a lunch break". */
  name: string;
  /** Who they are and their situation, in one or two sentences. */
  profile: string;
  /** What makes them different from the others: typical, sceptical, rushed, edge case. */
  angle: string;
  screening: Array<{ question: string; answer: string }>;
  answers: Array<{ question: string; answer: string }>;
  /** False until this participant has been interviewed. */
  done: boolean;
}

export interface VirtualInterviews {
  startedAt: string;
  /** The interview plan's questions when the interviews ran (to spot a changed plan). */
  questions: string[];
  participants: VirtualParticipant[];
  synthesis?: {
    at: string;
    themes: Array<{ theme: string; detail: string; mentions: number }>;
    disagreements: string[];
    /** What to check with real people, because simulated answers can't settle it. */
    toVerify: string[];
    /** Questions that drew vague or leading answers and could be rewritten. */
    questionFixes: string[];
  };
}

export interface DiscoverySummary {
  id: string;
  title: string;
  mode: ResearchMode;
  status: DiscoveryStatus;
  updatedAt: string;
  currentStep: string;
  stepsDone: number;
  stepsTotal: number;
}

export const STATUS_LABEL: Record<DiscoveryStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  report_ready: "Report ready",
  prd_draft: "PRD draft",
  prd_approved: "PRD approved",
  handed_off: "Build started",
};

/** Phrases that claim more than discovery can show, with cautious replacements (spec: prohibited claims). */
export const CAUTIOUS_REWRITES: Array<[RegExp, string]> = [
  [/\b(your|the|this) idea (is|has been) (validated|proven)\b/gi, "this idea has early signals to test"],
  [/\b(is|are|has been|have been) validated\b/gi, "needs real-world testing"],
  [/\bcustomers will (buy|pay for|love|use) (this|it)\b/gi, "customers may $1 $2 if the assumptions hold"],
  [/\bthis will succeed\b/gi, "this may help if the assumptions are correct"],
  [/\bwill (definitely|certainly|surely) succeed\b/gi, "may succeed if the assumptions are correct"],
  [/\bguaranteed (market|success|demand)\b/gi, "possible $1, still to test"],
  [/\b(your )?market is guaranteed\b/gi, "the market still needs testing"],
  [/\bvirtual users confirmed\b/gi, "simulated perspectives suggested"],
  [/\b(this|the) score predicts success\b/gi, "this score highlights strengths, risks and next learning steps"],
  [/\bproves? (that )?competitors are weak\b/gi, "suggests competitor tradeoffs to verify"],
];
export function cautious(text: string): string {
  return CAUTIOUS_REWRITES.reduce(
    (t, [re, to]) =>
      t.replace(re, (match: string, ...groups: unknown[]) => {
        const caps = groups.filter((g): g is string => typeof g === "string");
        const out = to.replace(/\$(\d)/g, (_s, n: string) => caps[Number(n) - 1] ?? "");
        // Keep the sentence's capital letter.
        return /^[A-Z]/.test(match) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
      }),
    text,
  );
}
