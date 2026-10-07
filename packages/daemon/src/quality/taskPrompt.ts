/**
 * The AI prompt standard (launch-readiness-checklist-rebuild-guide.md, sections 5 and 7). Every prompt has the same
 * anatomy: Goal, Context, Steps, Constraints, Acceptance criteria, Report back, plus Human sign-off for privacy, legal,
 * account and payment work. The prototype plan's steps are built from these prompts; the Launch readiness checklist's
 * generated prompts are for a coding agent building the real app on top of the prototype.
 *
 * Project-specific text (the stack note and the checks that prove a change) comes from PromptConfig, never from the
 * generator itself.
 */

export type Priority = "low" | "medium" | "high" | "critical";
export type ExecutionType = "code" | "manual" | "review" | "task";

export const PROMPT_HEADINGS = ["## Goal", "## Context", "## Steps", "## Constraints", "## Acceptance criteria", "## Report back"] as const;
export const ALWAYS_CONSTRAINT = "Do not touch unrelated code, data or settings.";
export const MAX_PROMPT = 8000;

/** Categories whose items an automatic check can never complete on its own: a person signs off. */
export const SENSITIVE_CATEGORIES = new Set(["privacy", "auth", "payments"]);

export interface PromptConfig {
  /** The stack and the conventions the agent must keep. */
  repoNote: string;
  /** The same for Launch readiness prompts (building the real app, where a new dependency can be the right call). */
  realRepoNote?: string;
  /** Checks that must still pass after any change, with the command or check name that proves each. */
  verifyLines: string[];
}

/** What every Launch readiness prompt tells the agent: the prototype exists, and this task builds the real thing. */
export const PROTOTYPE_NOTE =
  "A clickable prototype of this app already exists in this repo: its screens are in src/screens, its simulated data in src/sim and its design tokens in src/styles/tokens.css. This task is for the real application: implement the real version of what this item needs (a real backend, data store, sign-in or service where it needs one) instead of the simulation. Keep the prototype's screens, flows and design.";
export const REAL_APP_CONSTRAINT = "Keep the prototype's screens and design; replace simulated data from src/sim only where this item needs real data.";

export interface PromptParts {
  title: string;
  goal: string;
  context: string;
  steps: string[];
  constraints?: string[];
  acceptance: string[];
  report?: string;
  safety?: boolean;
}

/** One prompt from structured parts, so every prompt has the same shape. */
export function buildTaskPrompt(p: PromptParts): string {
  const list = (a: string[]) => a.map((x, i) => `${i + 1}. ${x}`).join("\n");
  const bullets = (a: string[]) => a.map((x) => `- ${x}`).join("\n");
  const constraints = [...(p.constraints ?? []).filter((c) => c !== ALWAYS_CONSTRAINT), ALWAYS_CONSTRAINT];
  return [
    `# ${p.title}`,
    `## Goal\n${p.goal}`,
    `## Context\n${p.context}`,
    `## Steps\n${list(p.steps.length ? p.steps : ["Do what the goal says, in the files the context names."])}`,
    `## Constraints\n${bullets(constraints)}`,
    `## Acceptance criteria\n${bullets(p.acceptance.length ? p.acceptance : [`${p.title}: verifiably true`])}`,
    `## Report back\n${p.report ?? "Files changed, evidence for each acceptance criterion (check names, command output or file and line), and anything you did not do."}`,
    ...(p.safety ? ["## Human sign-off\nThis task touches privacy, legal, accounts or payments. Do not mark it complete from code or documents alone: report your findings and stop so a person can review and sign off."] : []),
  ].join("\n\n") + "\n";
}

/** The fields a generated prompt is made from: any checklist item has them. */
export interface PromptSource {
  title: string;
  detail: string;
  kind: ExecutionType;
  gate?: boolean;
  categoryId: string;
  categoryTitle: string;
  evidence?: string;
  /** What proves it: a FlowCode check name, or a code pattern the source must contain. */
  autoCheck?: string;
  /** Ordered steps for a person, or test steps FlowCode wrote. */
  manualSteps?: string[];
  /** Files that matter for this item (from a review, a check or the plan). */
  files?: string[];
}

const CHECK_NAMES: Record<string, string> = {
  install: "the install check",
  typecheck: "the typecheck check (npm run typecheck)",
  lint: "the lint check (npm run lint)",
  tests: "the tests check (npm test)",
  build: "the build check (npm run build)",
  accessibility: "the accessibility audit (axe on the running preview)",
  design_qa: "the design QA check (contrast and design tokens)",
  preview_health: "the preview health check",
  screenshots: "the screenshots check",
  visual_critique: "the visual critique check",
  security_scan: "the security scan",
  compliance_triage: "the compliance triage check",
  seo: "the SEO check",
  spec_fidelity: "the spec fidelity check",
  app_wiring: "the app wiring check",
  code_cleanup: "the clean-up scan",
  final_report: "the final evidence report",
  server_start: "the server start check",
};
export const checkName = (k: string) => CHECK_NAMES[k] ?? `the ${k.replace(/_/g, " ")} check`;

/** A safe, lint-clean prompt from an item's own fields, so every item has one even when nobody wrote it. */
export function generatedTaskPrompt(s: PromptSource, cfg: PromptConfig): string {
  const sensitive = SENSITIVE_CATEGORIES.has(s.categoryId);
  const check = s.autoCheck && CHECK_NAMES[s.autoCheck] ? s.autoCheck : undefined;
  const files = (s.files ?? []).filter(Boolean).slice(0, 6);
  const context = [
    s.detail && s.detail !== s.title ? s.detail : "",
    PROTOTYPE_NOTE,
    `Checklist category: ${s.categoryTitle}.${s.gate ? " This is a launch gate: the app is not ready to launch while it is open." : ""}`,
    s.evidence ? `Last check: ${s.evidence}` : "",
    files.length ? `Files involved: ${files.join(", ")}.` : "",
    cfg.realRepoNote ?? cfg.repoNote,
  ].filter(Boolean).join("\n");

  let steps: string[];
  const constraints = ["Follow the existing conventions; add a dependency only when the real version needs one, and say why.", REAL_APP_CONSTRAINT];
  const acceptance: string[] = [];
  if (s.kind === "manual" || s.kind === "review") {
    // People do these. The agent prepares, checks what it can and reports; it never claims the human step is done.
    steps = s.manualSteps?.length
      ? [...s.manualSteps.map((m) => `Prepare this step for a person: ${m}`), "Check what you can from the code and record what you found for each step."]
      : [
          `Find the screens, files and flows that "${s.title}" is about and list them.`,
          "Check what you can from the code and record what you found, with file and line.",
          "Write short steps a person can follow to confirm the rest, each with what should happen.",
        ];
    constraints.push("Report only; do not change code in this task.", "Do not mark this item complete: a person signs it off.");
    acceptance.push("Every step has a finding (confirmed, problem found with file and line, or needs a person).", "The steps for a person name real buttons, fields and screens from the code.");
  } else if (check) {
    steps = [`Run ${checkName(check)} and record its result.`, "Fix each failure in the files it names, starting with the first one.", `Run ${checkName(check)} again and record the result.`];
    constraints.push("Do not edit a test or a check to make it pass.");
    acceptance.push(`${checkName(check)[0].toUpperCase()}${checkName(check).slice(1)} passes.`);
  } else {
    steps = [
      files.length ? `Read ${files.join(", ")} and find how the prototype does "${s.title}" (its screen in src/screens, any simulated data in src/sim).` : `Find how the prototype does "${s.title}": its screen in src/screens and any simulated data in src/sim.`,
      `Implement the real version so this is true in the real app: ${s.detail || s.title}`,
      "Connect the prototype's screen to it, replacing the simulation for this item only.",
      "Run the checks below and fix anything you broke.",
    ];
    acceptance.push(`${s.title}: true in the real app (not simulated), shown by the file and line that does it.`);
  }
  return buildTaskPrompt({
    title: s.title,
    goal: `${s.detail && s.detail.length <= 220 && s.detail !== s.title ? s.detail.replace(/\.?$/, ".") : `${s.title.replace(/\.?$/, "")} is verifiably true.`}${s.gate ? " (Launch gate.)" : ""}`,
    context,
    steps,
    constraints,
    acceptance: [...acceptance, ...(s.kind === "code" || s.kind === "task" ? cfg.verifyLines : [])],
    safety: sensitive,
  });
}

/** Stored prompt when there is one, otherwise the generated one. */
export function taskPromptFor(stored: string | undefined, s: PromptSource, cfg: PromptConfig): { prompt: string; authored: boolean } {
  return stored?.trim() ? { prompt: stored, authored: true } : { prompt: generatedTaskPrompt(s, cfg), authored: false };
}

/** Problems with a stored prompt; empty means valid. Empty text is valid (the generated prompt is used). */
export function lintAiPrompt(text: string | undefined, item?: { categoryId?: string }): string[] {
  const s = String(text ?? "").trim();
  if (!s) return [];
  const problems: string[] = [];
  for (const h of PROMPT_HEADINGS) if (!new RegExp(`^${h}\\s*$`, "m").test(s)) problems.push(`missing the "${h.slice(3)}" section`);
  if (s.length > MAX_PROMPT) problems.push(`longer than ${MAX_PROMPT} characters`);
  if (/eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_|service_role\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}/.test(s)) problems.push("contains something shaped like a secret");
  if (item?.categoryId && SENSITIVE_CATEGORIES.has(item.categoryId) && !/(person|human|people)[^.\n]*(review|sign[- ]?off|signs? (it )?off)/i.test(s)) problems.push("privacy, legal, account and payment tasks must say a person reviews and signs off");
  return problems;
}

/** The project's stack note and proof lines, from what the workspace actually has. */
export function promptConfigFor(input: { stack?: string; scripts: string[] }): PromptConfig {
  const has = (k: string) => input.scripts.includes(k);
  const verifyLines = [
    has("typecheck") ? "npm run typecheck passes" : "",
    has("lint") ? "npm run lint passes" : "",
    has("test") ? "npm test passes" : "",
    has("build") ? "npm run build passes" : "",
  ].filter(Boolean);
  return {
    repoNote: `${input.stack ? `Stack: ${input.stack}. ` : ""}Read the existing code and conventions before changing anything. Use the design tokens in src/styles/tokens.css and the building blocks in src/components/ui where they exist; add no new dependencies and do not restyle unrelated code.`,
    realRepoNote: `${input.stack ? `Stack: ${input.stack}. ` : ""}Read the existing code and conventions before changing anything. Keep using the design tokens in src/styles/tokens.css and the building blocks in src/components/ui; do not restyle unrelated code.`,
    verifyLines: verifyLines.length ? verifyLines : ["The app still starts and its preview loads without errors"],
  };
}
