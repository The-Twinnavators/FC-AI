/**
 * Subjective visual critique (FR-Q2, Phase 8 visual critique loop). Routed only to a vision-capable
 * critic model; otherwise the limitation is reported. Findings are labeled as critique, separate from
 * deterministic checks.
 */
import type { Finding, ModelAssignment } from "@flowcode/contracts";
import type { ModelRouter } from "../models/router.js";
import { promptById } from "../orchestrator/prompts.js";

/**
 * A model's JSON reply, tolerating what small local vision models do: wrap it in prose or a code fence. An empty or
 * cut-off reply throws, so the caller can retry.
 */
export function parseLooseJson<T>(content: string): T {
  const text = content.trim();
  if (!text) throw new Error("the model sent an empty reply");
  try {
    return JSON.parse(text) as T;
  } catch {
    const block = /\{[\s\S]*\}/.exec(text)?.[0];
    if (!block) throw new Error("the model's reply wasn't JSON");
    return JSON.parse(block) as T;
  }
}

export async function visionCritique(
  router: ModelRouter,
  assignment: ModelAssignment | undefined,
  screenshots: Array<{ name: string; png: Buffer }>,
  brief: string,
  ctx: { projectId?: string; runId?: string; signal?: AbortSignal; guidance?: string },
): Promise<{ status: "passed" | "passed_with_warnings" | "skipped"; findings: Finding[]; limitation?: string }> {
  if (!assignment) return { status: "skipped", findings: [], limitation: "No critic model is configured" };
  let vision = false;
  try {
    const info = await router.provider(assignment.providerId).describe(assignment.model);
    vision = !!info?.capabilities?.includes("vision");
  } catch {
    vision = false;
  }
  if (!vision) return { status: "skipped", findings: [], limitation: `Critic model ${assignment.model} is not vision-capable; visual critique not performed` };
  const findings: Finding[] = [];
  // One screenshot the model can't answer for (an empty or cut-off reply, even after a retry) doesn't sink the others:
  // the review covers the ones it could, and says so (Pacific Foods fix: a single empty reply skipped the whole review).
  const missed: string[] = [];
  let lastError = "";
  for (const shot of screenshots) {
    let parsed: { findings?: Array<{ severity?: string; message?: string; recommendation?: string }> } | undefined;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    try {
      const res = await router.chat({ role: "critic", projectId: ctx.projectId, runId: ctx.runId }, assignment, {
        messages: [
          { role: "system", content: promptById("role.critic").template + (ctx.guidance ?? "") },
          { role: "user", content: `Design brief: ${brief}\nScreenshot: ${shot.name}. Return JSON {"findings":[...]} only.`, images: [shot.png.toString("base64")] },
        ],
        format: {
          type: "object",
          properties: { findings: { type: "array", items: { type: "object", properties: { severity: { type: "string" }, message: { type: "string" }, recommendation: { type: "string" } }, required: ["severity", "message"] } } },
          required: ["findings"],
        },
        signal: ctx.signal,
        timeoutMs: 240_000,
      });
      parsed = parseLooseJson(res.content);
    } catch (err) {
      lastError = (err as Error).message;
      // A cloud critic that's out of credit or unreachable: stop here, so the local fallback can take over.
      if (CLOUD_CRITIC_UNAVAILABLE.test(lastError) || ctx.signal?.aborted) return { status: "skipped", findings, limitation: `Critique failed: ${lastError}` };
    }
    }
    if (!parsed) {
      missed.push(shot.name);
      continue;
    }
    for (const [i, x] of (parsed.findings ?? []).slice(0, 6).entries()) {
      if (!x.message) continue;
      const sev = (["serious", "moderate", "minor"].includes(String(x.severity)) ? x.severity : "minor") as Finding["severity"];
      findings.push({ id: `critique_${shot.name}_${i}`, category: "design", rule: "visual-critique", severity: sev, confidence: "low", message: `[${shot.name}] ${x.message}`.slice(0, 400), recommendation: x.recommendation?.slice(0, 300), manualValidationRequired: true, source: "critique" });
    }
  }
  if (missed.length === screenshots.length) return { status: "skipped", findings, limitation: `Critique failed: ${lastError || "no screenshot could be reviewed"}` };
  const partial = missed.length ? `Reviewed ${screenshots.length - missed.length} of ${screenshots.length} screenshots; ${assignment.model} couldn't answer for ${missed.join(", ")} (${lastError}).` : undefined;
  return { status: findings.length || partial ? "passed_with_warnings" : "passed", findings, ...(partial ? { limitation: partial } : {}) };
}

/** A cloud critic failure that a local model can stand in for: out of credit, over quota, or unreachable. */
export const CLOUD_CRITIC_UNAVAILABLE = /credit|quota|billing|insufficient|429|rate.?limit|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|connect|network|timed? ?out|abort/i;

/**
 * The visual critique with a fallback: when the first critic (usually a cloud model) can't run because it's out of
 * credit, over quota or unreachable, the second (the local vision model) reviews instead, so a finished build gets a
 * visual review rather than "couldn't run". Says which critic ran, and why it fell back.
 */
export async function critiqueWithFallback(
  router: ModelRouter,
  primary: ModelAssignment | undefined,
  fallback: ModelAssignment | undefined,
  screenshots: Array<{ name: string; png: Buffer }>,
  brief: string,
  ctx: { projectId?: string; runId?: string; signal?: AbortSignal; guidance?: string },
): Promise<{ crit: Awaited<ReturnType<typeof visionCritique>>; ran?: ModelAssignment; fellBack?: string }> {
  const first = await visionCritique(router, primary, screenshots, brief, ctx);
  const failedReason = first.status === "skipped" ? first.limitation ?? "" : "";
  const canFallBack = !!fallback && !!primary && (fallback.providerId !== primary.providerId || fallback.model !== primary.model);
  if (!failedReason.startsWith("Critique failed") || !CLOUD_CRITIC_UNAVAILABLE.test(failedReason) || !canFallBack || ctx.signal?.aborted) return { crit: first, ran: primary };
  const second = await visionCritique(router, fallback, screenshots, brief, ctx);
  return { crit: second, ran: fallback, fellBack: `${primary!.model} couldn't run (${failedReason.replace(/^Critique failed:\s*/, "").slice(0, 160)})` };
}

/** The look review's rubric: each rule is a way a screen looks broken to a person, not a matter of taste. */
export const LOOK_RUBRIC = [
  ["repeated-controls", "the same button, link or label repeated on every item (a \"Create\" in every day cell) where one control or clicking the item would do"],
  ["filler-text", "text that only narrates or helps a test (\"Calendar ready.\", \"0 events\" in every cell, \"Move event here\") rather than telling the user something they need"],
  ["contradictory-controls", "controls that contradict each other on one screen (\"Sign in\" and \"Sign out\" both shown)"],
  ["empty-despite-data", "lists, grids or calendars that look empty although the app is a prototype with sample data"],
  ["weak-hierarchy", "no clear title, primary action and main content; headings, dates and actions crammed together or competing"],
  ["wrong-control", "a control that doesn't look like what it does (view switches as full-width buttons instead of a segmented control or tabs, a list of buttons as navigation)"],
  ["cluttered", "too many controls or sections at once for the screen's job; settings or filters a user rarely needs shown up front"],
  ["template-look", "looks like a generic template with the blanks filled in rather than designed for this product: a marketing headline and feature checklist beside a sign-in form, stock sections the app doesn't need, a nav tab for Sign in"],
] as const;

export interface LookReviewFinding {
  screen: string;
  rule: string;
  serious: boolean;
  message: string;
}

/**
 * Look review: a vision model looks at each screen a step changed and judges it against LOOK_RUBRIC. The coder's model
 * is used when it reads images (the cloud model), else the critic. Calendar prototype: the deterministic look check
 * said "looks right" to a month grid with "Create" and "0 events" in every cell, because nothing looked at it.
 */
export async function lookReview(
  router: ModelRouter,
  assignments: Array<ModelAssignment | undefined>,
  screens: Array<{ name: string; png: Buffer }>,
  brief: string,
  ctx: { projectId?: string; runId?: string; signal?: AbortSignal },
): Promise<{ model?: string; findings: LookReviewFinding[]; limitation?: string }> {
  // A small local vision model's judgement is advice, not a reason to fail a step (No BIO & GMO build: qwen2.5vl:3b
  // blocked a step with three findings, one plainly wrong, that FlowCode's own checks didn't share).
  const advisory = (a: ModelAssignment) => !a.providerId.startsWith("hosted");
  let pick: ModelAssignment | undefined;
  for (const a of assignments) {
    if (!a) continue;
    try {
      if ((await router.provider(a.providerId).describe(a.model))?.capabilities?.includes("vision")) {
        pick = a;
        break;
      }
    } catch {
      /* next */
    }
  }
  if (!pick) return { findings: [], limitation: "No model that reads images is set up, so only the automatic look check ran" };
  const rules = LOOK_RUBRIC.map(([id, text]) => `- ${id}: ${text}`).join("\n");
  const findings: LookReviewFinding[] = [];
  for (const shot of screens.slice(0, 3)) {
    try {
      const res = await router.chat({ role: "critic", projectId: ctx.projectId, runId: ctx.runId }, { ...pick, temperature: 0 }, {
        messages: [
          {
            role: "system",
            content: `You review one screen of a clickable app prototype the way a demanding product designer would. Judge only against these rules:\n${rules}\nReport a rule only when the screenshot clearly breaks it, naming what you see (the element and its text). "serious": true when a person would call the screen badly designed because of it; false for small issues. Don't comment on colours or fonts you merely dislike. Return JSON {"findings":[{"rule","serious","message"}]} only; an empty list when the screen is well designed.`,
          },
          { role: "user", content: `What the app is for: ${brief.slice(0, 1200)}\nScreen: ${shot.name}.`, images: [shot.png.toString("base64")] },
        ],
        format: {
          type: "object",
          properties: { findings: { type: "array", items: { type: "object", properties: { rule: { type: "string" }, serious: { type: "boolean" }, message: { type: "string" } }, required: ["rule", "serious", "message"] } } },
          required: ["findings"],
        },
        signal: ctx.signal,
        timeoutMs: 180_000,
      });
      const parsed = JSON.parse(res.content) as { findings?: Array<{ rule?: string; serious?: boolean; message?: string }> };
      for (const x of (parsed.findings ?? []).slice(0, 6)) {
        if (!x.message || !LOOK_RUBRIC.some(([id]) => id === x.rule)) continue;
        findings.push({ screen: shot.name, rule: String(x.rule), serious: x.serious === true, message: x.message.slice(0, 300) });
      }
    } catch (err) {
      if (ctx.signal?.aborted) throw err;
      if (advisory(pick)) for (const f of findings) f.serious = false;
      return { model: pick.model, findings, limitation: `The look review stopped: ${(err as Error).message.slice(0, 160)}` };
    }
  }
  if (advisory(pick)) for (const f of findings) f.serious = false;
  return { model: pick.model, findings };
}

export interface DesignCrit {
  /** portfolio: ready to show · good: solid but not yet aspirational · ordinary: generic. */
  level: "portfolio" | "good" | "ordinary";
  improvements: string[];
  model?: string;
}

/**
 * Design crit: a design lead's review of the screens a design step made, against the art-direction bar (one concept,
 * focal point, type contrast, composition, signature moment, craft). Below "portfolio" it returns the three changes
 * that would raise the design most; the step makes one revision pass on them. Usability stays the look check's job.
 */
export async function designCrit(
  router: ModelRouter,
  assignments: Array<ModelAssignment | undefined>,
  screens: Array<{ name: string; png: Buffer }>,
  brief: string,
  ctx: { projectId?: string; runId?: string; signal?: AbortSignal },
): Promise<DesignCrit | undefined> {
  let pick: ModelAssignment | undefined;
  for (const a of assignments) {
    if (!a) continue;
    try {
      if ((await router.provider(a.providerId).describe(a.model))?.capabilities?.includes("vision")) {
        pick = a;
        break;
      }
    } catch {
      /* next */
    }
  }
  if (!pick || !screens.length) return undefined;
  const res = await router.chat({ role: "critic", projectId: ctx.projectId, runId: ctx.runId }, { ...pick, temperature: 0 }, {
    messages: [
      {
        role: "system",
        content:
          "You are a design lead reviewing a product designer's screens before they go in the studio portfolio (the level of the best work on Dribbble and Behance), for a real, usable product. Judge the craft: one clear concept, a focal point, strong type scale contrast, deliberate composition (not stacked boxes), generous rhythm, a signature moment, considered details and states, and how specific to this product it feels. Rate it: \"portfolio\" (ready to show), \"good\" (solid but not aspirational yet) or \"ordinary\" (generic). Unless it's portfolio, give exactly 3 improvements, the ones that would raise it most, each a concrete instruction naming the element and the change (e.g. \"Make today's date the focal point: set it at display size in the brand colour and give the week strip more space\"). Never suggest anything that would hurt usability or accessibility. Return JSON {\"level\",\"improvements\"} only.",
      },
      { role: "user", content: `The product and this step: ${brief.slice(0, 4000)}\nScreens: ${screens.map((s) => s.name).join(", ")}.`, images: screens.slice(0, 3).map((s) => s.png.toString("base64")) },
    ],
    format: { type: "object", properties: { level: { type: "string", enum: ["portfolio", "good", "ordinary"] }, improvements: { type: "array", items: { type: "string" } } }, required: ["level", "improvements"] },
    signal: ctx.signal,
    timeoutMs: 180_000,
  });
  const j = JSON.parse(res.content) as { level?: string; improvements?: unknown[] };
  const level = j.level === "portfolio" || j.level === "good" ? j.level : "ordinary";
  return { level, improvements: level === "portfolio" ? [] : (j.improvements ?? []).filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 3).map((x) => x.slice(0, 300)), model: pick.model };
}
