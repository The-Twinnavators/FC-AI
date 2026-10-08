/**
 * Request classification (from the agent prompt, skill and specification system). Every request is classified when
 * it's planned, without a model: what kind of work it is, which concepts it names, which skills apply to every step,
 * and whether it's big enough to deserve a feature or product specification. The result goes in the plan (shown to
 * the user), into the planner's prompt, and decides which skills the coding steps get.
 */
import type { PlanClassification } from "@flowcode/contracts";
import { REQUEST_TEMPLATES } from "@flowcode/contracts";

interface Concept {
  name: string;
  match: RegExp;
  primary: PlanClassification["primary"];
  skills: string[];
  /** When the concept alone calls for a spec; otherwise only the request's size and data needs decide. */
  spec: "always" | "if-data" | "never";
  /** The build prompt (request template) whose guidance the planner gets when this concept is found. */
  prompt?: string;
  /** Loose words (AI, summarise, timeline…) that a long PRD uses in passing: only matched in the request itself. */
  requestOnly?: boolean;
}

// The concept-to-classification map, most specific first.
const CONCEPTS: Concept[] = [
  { name: "Financial strategy lab", match: /\b(financial|investment|portfolio|budget(ing)?|retirement)\b.*\b(lab|laborator|strateg|planner|simulat)/i, primary: "product_spec", skills: ["skill.data-simulation-scenarios", "skill.database-backed-feature"], spec: "always" },
  { name: "Interactive story world", match: /\b(story ?world|interactive (story|fiction|narrative world))\b/i, primary: "product_spec", skills: ["skill.interactive-ui-concept"], spec: "always" },
  { name: "Living roadmap", match: /\b(living |interactive )?roadmap (platform|tool|app)\b|\bliving roadmap\b/i, primary: "product_spec", skills: ["skill.svg-workflow-visualization", "skill.database-backed-feature"], spec: "always" },
  { name: "Knowledge explorer", match: /\bknowledge (explorer|base explorer|graph explorer)\b/i, primary: "product_spec", skills: ["skill.ai-assisted-workflow", "skill.database-backed-feature"], spec: "always" },
  { name: "Dashboard builder", match: /\bdashboard (builder|editor|designer)\b/i, primary: "feature_spec", skills: ["skill.interactive-ui-concept", "skill.database-backed-feature"], spec: "always" },
  { name: "Workflow simulator", prompt: "workflow-simulator", match: /\b(workflow|process) (simulat|sandbox)\w*/i, primary: "feature_spec", skills: ["skill.svg-workflow-visualization", "skill.data-simulation-scenarios"], spec: "always" },
  { name: "Scenario comparison", match: /\b(scenario|what-?if)\b.*\b(compar|tool|planner|analysis)|\bcompare scenarios\b/i, primary: "feature_spec", skills: ["skill.data-simulation-scenarios"], spec: "always" },
  { name: "AI review queue", prompt: "ai-review-queue", match: /\b(ai|model)\b.*\breview queue\b|\breview queue\b.*\b(ai|model)\b/i, primary: "feature_spec", skills: ["skill.ai-assisted-workflow", "skill.database-backed-feature"], spec: "always" },
  { name: "Document to structured data", match: /\b(extract|parse|convert)\w*\b.*\b(documents?|pdfs?|invoices?|receipts?)\b.*\b(structured|fields|data)\b/i, primary: "feature_spec", skills: ["skill.ai-assisted-workflow", "skill.database-backed-feature"], spec: "always" },
  { name: "Agent-run monitor", match: /\bagent[- ]run monitor\b|\bmonitor\w*\b.*\bagents?\b.*\bruns?\b/i, primary: "feature_spec", skills: ["skill.ai-assisted-workflow", "skill.database-backed-feature"], spec: "always" },
  { name: "AI co-pilot", match: /\b(ai )?co-?pilot\b|\bai assistant\b|\bchat ?bot\b/i, primary: "feature_spec", skills: ["skill.ai-assisted-workflow"], spec: "always" },
  { name: "Workflow map", match: /\b(workflow map|process map|flow ?chart|dependency graph|node graph|org chart|mind map)\b/i, primary: "saved_prompt", skills: ["skill.svg-workflow-visualization", "skill.interactive-ui-concept"], spec: "if-data" },
  { name: "Simulation", requestOnly: true, match: /\b(simulat\w*|forecast\w*|projection|backtest\w*|what-?if)\b/i, primary: "saved_prompt", skills: ["skill.data-simulation-scenarios"], spec: "if-data" },
  { name: "3D experience", prompt: "3d-product-explainer", match: /\b(three\.?js|webgl|3d (model|scene|product|viewer|gallery|explainer)|virtual gallery|spatial (learning|navigation)|interactive globe)\b/i, primary: "saved_prompt", skills: ["skill.threejs-experience"], spec: "if-data" },
  { name: "Scroll story", prompt: "scroll-story", match: /\b(scroll(-| )?(story|storytelling|narrative)|scrollytelling|case[- ]study (narrative|page|story))\b/i, primary: "saved_prompt", skills: ["skill.scroll-motion-parallax", "skill.interactive-ui-concept"], spec: "never" },
  { name: "Parallax or scroll story", prompt: "parallax-scroll", match: /\b(parallax|scroll(-| )?(story|storytelling|driven|linked|narrative)|scrollytelling|sticky (section|scroll)|pinned (section|scroll)|horizontal (scroll|narrative))\b/i, primary: "saved_prompt", skills: ["skill.scroll-motion-parallax"], spec: "never" },
  { name: "Interactive timeline", prompt: "interactive-timeline", match: /\binteractive timeline\b|\btimeline (view|component|of events)\b/i, primary: "saved_prompt", skills: ["skill.interactive-ui-concept"], spec: "if-data" },
  { name: "Before/after slider", prompt: "before-after-slider", match: /\bbefore[ /-]?(and[ /-])?after\b|\bcomparison slider\b/i, primary: "saved_prompt", skills: ["skill.interactive-ui-concept"], spec: "never" },
  { name: "Interactive control", requestOnly: true, match: /\b(timeline|before[ /-]and[ /-]after|before\/after|comparison slider|decision tree|onboarding|wizard|stepper|command palette|card stack|configurator|drag(gable)?)\b/i, primary: "saved_prompt", skills: ["skill.interactive-ui-concept"], spec: "if-data" },
  { name: "AI feature", requestOnly: true, match: /\b(ai|llm|gpt|claude|summari[sz]\w*|classif\w+|recommend\w*)\b/i, primary: "saved_prompt", skills: ["skill.ai-assisted-workflow"], spec: "if-data" },
];

const DATA = /\b(sign[ -]?in|log[ -]?in|accounts?|users? (can|should)|permissions?|roles?|audit|saved?|persist\w*|database|history|multi-user|share[ds]?)\b/i;
const VISUAL = /\b(page|screen|layout|hero|landing|component|button|form|modal|dialog|card|animation|animated|style|css|ui|ux|design)\b/i;

/** Classifies a request for planning. Pure and deterministic. */
export function classifyRequest(objective: string, opts: { referenceRoles?: string[]; specBuild?: boolean; /** The PRD's text, when one is attached. */ prd?: string } = {}): PlanClassification {
  const text = objective.replace(/\s+/g, " ");
  const prd = (opts.prd ?? "").replace(/\s+/g, " ").slice(0, 60_000);
  // The request is read for every concept; the PRD only for the specific ones, since a long PRD mentions loose words
  // like "AI" or "timeline" in passing.
  let hits = CONCEPTS.filter((c) => c.match.test(text) || (!c.requestOnly && prd && c.match.test(prd)));
  // A scroll story already covers its scroll motion; keep the parallax prompt only when parallax itself is named.
  if (hits.some((c) => c.name === "Scroll story") && !/parallax/i.test(text + prd)) hits = hits.filter((c) => c.name !== "Parallax or scroll story");
  const hasPrd = (opts.referenceRoles ?? []).some((r) => r === "prd" || r === "text");
  const needsData = DATA.test(text) || (!!prd && /\b(sign[ -]?in|log[ -]?in|accounts?|permissions?|roles?|audit (log|trail))\b/i.test(prd));
  const words = text.split(" ").length;

  const rank: Record<PlanClassification["primary"], number> = { task_note: 0, saved_prompt: 1, feature_spec: 2, product_spec: 3 };
  let primary: PlanClassification["primary"] = hits.reduce<PlanClassification["primary"]>((p, c) => (rank[c.primary] > rank[p] ? c.primary : p), hits.length ? "saved_prompt" : "task_note");
  // Several capabilities with lasting data, or a long request for a whole app, is a feature spec's worth of decisions.
  if (primary === "saved_prompt" && needsData && hits.length > 1) primary = "feature_spec";
  if (opts.specBuild && primary !== "product_spec") primary = hits.length > 2 ? "product_spec" : "feature_spec";

  const specNeeded = primary === "feature_spec" || primary === "product_spec" || hits.some((c) => c.spec === "always" || (c.spec === "if-data" && needsData));
  const skills = [...new Set(hits.flatMap((c) => c.skills).concat(needsData && hits.length ? ["skill.database-backed-feature"] : []))];
  if (VISUAL.test(text) || hits.length || opts.specBuild) skills.push("skill.audit-accessibility", "skill.ux-design-principles");
  if (opts.specBuild) skills.push("skill.app-layout-navigation");
  if (hits.some((c) => /Parallax|3D|Interactive control|Workflow map/.test(c.name))) skills.push("skill.visual-qa-verification");

  const label = { task_note: "Small change", saved_prompt: "Feature task", feature_spec: "Feature that needs a spec", product_spec: "Product area that needs a spec" }[primary];
  const note = !specNeeded
    ? undefined
    : hasPrd
      ? "Built to the attached spec."
      : `${primary === "product_spec" ? "A product spec" : "A feature spec"} would keep its decisions in one place (users, flows, data, states, what's out of scope). Settings → PRD templates has one; attach it to the next build of this feature.`;
  // Build prompts: the guidance for each kind of feature found, plus the new-feature prompt for anything spec-sized.
  const prompts = [...new Set([...(primary === "feature_spec" || primary === "product_spec" ? ["plan-new-feature"] : []), ...hits.flatMap((c) => (c.prompt ? [c.prompt] : []))])];
  return { primary, label, concepts: hits.map((c) => c.name), skills: [...new Set(skills)], prompts, specNeeded, specAttached: hasPrd, note, words };
}

/**
 * Build guidance from the build prompts the classification found (parallax, timeline, workflow simulator…): their
 * interaction rules, limits and done-when checks, without the [placeholders] meant for a person filling them in.
 */
export function buildGuidance(ids: string[]): string {
  const KEEP = /^## (Interaction|Limits|Done when|States|Flow|Not in this build|What I need from the plan)$/;
  const parts = ids.flatMap((id) => {
    const t = REQUEST_TEMPLATES.find((x) => x.id === id);
    if (!t) return [];
    const lines: string[] = [];
    let keep = false;
    for (const line of t.body.split("\n")) {
      if (line.startsWith("## ")) {
        keep = KEEP.test(line.trim());
        if (keep) lines.push(line.replace(/^## /, "").concat(":"));
        continue;
      }
      if (keep && line.trim() && !/\[[A-Z]/.test(line)) lines.push(line);
    }
    return lines.length ? [`${t.label}:\n${lines.join("\n")}`] : [];
  });
  return parts.length ? `Build guidance for what this request describes (plan to it; the coder gets the matching skills):\n${parts.join("\n\n")}` : "";
}
