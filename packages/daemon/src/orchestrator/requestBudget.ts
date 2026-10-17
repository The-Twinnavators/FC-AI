/**
 * The budget for a step's whole first request to the model: system prompt, skills, tool definitions, brief, source
 * files, contracts, room for the tool results it will read, and the reply. Measured in tokens, converted with the
 * characters-per-token this model actually showed on earlier calls (FlowCode records prompt characters and prompt
 * tokens for every call).
 *
 * Clean Cart controlled build, "Implement Real Imagery": the brief was fitted against a characters-only budget that
 * ignored the system prompt (33,102 characters, 24,835 of them five skills) and the 12,603 characters of tool
 * definitions. The budget went negative, its 6,000-character floor let the request run to 18,153 of a 24,576-token
 * window, and the fitting dropped the two files the step edits while keeping an 11,200-character list of every file
 * every earlier step touched.
 */
import type { SkillSpec } from "@flowcode/contracts";
import type { Store } from "../db/store.js";

export interface RequestBudget {
  windowTokens: number;
  replyTokens: number;
  /** Tokens kept free for what the step reads and the turns it takes. */
  workingTokens: number;
  charsPerToken: number;
  /** Characters the opening request may use in all (system, skills, tools, brief). */
  inputChars: number;
  /** Characters the skills may use. */
  skillChars: number;
}

/** Characters per token for a model from its recent calls (median), or a cautious default. */
export function charsPerToken(store: Store, model: string, fallback = 3.6): number {
  const rows = store.db.all<{ data: string }>("SELECT data FROM events WHERE type = 'model.completed' ORDER BY seq DESC LIMIT 400");
  const ratios: number[] = [];
  for (const r of rows) {
    try {
      const d = (JSON.parse(r.data) as { data?: { model?: string; promptChars?: number; usage?: { promptTokens?: number } } }).data;
      if (d?.model === model && d.promptChars && d.usage?.promptTokens && d.usage.promptTokens > 1000) ratios.push(d.promptChars / d.usage.promptTokens);
    } catch {
      /* skip */
    }
    if (ratios.length >= 40) break;
  }
  if (ratios.length < 3) return fallback;
  const sorted = ratios.sort((a, b) => a - b);
  return Math.max(2.5, Math.min(5, sorted[Math.floor(sorted.length / 2)]!));
}

export function requestBudget(opts: { windowTokens: number; replyTokens: number; charsPerToken: number; hosted: boolean }): RequestBudget {
  const { windowTokens, replyTokens, charsPerToken: cpt, hosted } = opts;
  // Room to work: what it reads and the turns it takes. A quarter of the window, never under 3,500 tokens.
  const workingTokens = Math.max(3500, Math.floor(windowTokens * 0.25));
  const inputChars = Math.max(0, Math.floor((windowTokens - replyTokens - workingTokens) * cpt));
  // Skills are guidance, not the work: a local model gets about a sixth of the request for them, a cloud one more.
  const skillChars = hosted ? Math.min(24_000, Math.floor(inputChars * 0.2)) : Math.min(9_000, Math.floor(inputChars / 6));
  return { windowTokens, replyTokens, workingTokens, charsPerToken: cpt, inputChars, skillChars };
}

/**
 * Whether a later turn still fits the window: the opening request, plus a full read of the step's largest own file,
 * a diagnostic and the calls around them, counted at 80% of the measured characters a token (CSS and code tokenize
 * denser than prose: Clean Cart slice eval 1 measured 3.97 on the opening and 3.21 on stylesheet-heavy turns), with
 * the reply reserved. An opening that only just fits isn't enough: a step that can't read its own files and get its
 * check results back within the window is too broad for it and is split before it runs.
 */
export function laterTurnFits(b: RequestBudget, openingChars: number, largestReadChars: number, diagnosticChars = 2000): { fits: boolean; tokens: number } {
  const chars = openingChars + largestReadChars + diagnosticChars + 1400;
  const tokens = Math.ceil(chars / (b.charsPerToken * 0.8)) + b.replyTokens;
  return { fits: tokens <= b.windowTokens, tokens };
}

/**
 * Skills within their budget, in the order given (the step's workflow skill first, then design skills by fit): whole
 * skills while they fit; the first one always, shortened to the budget if it alone is larger. Returns what was left out.
 */
export function budgetSkills(skills: SkillSpec[], maxChars: number, render: (s: SkillSpec[]) => string): { kept: SkillSpec[]; dropped: string[]; text: string } {
  const kept: SkillSpec[] = [];
  const dropped: string[] = [];
  for (const s of skills) {
    if (!kept.length || render([...kept, s]).length <= maxChars) kept.push(s);
    else dropped.push(s.id);
  }
  let text = render(kept);
  if (text.length > maxChars && kept.length === 1) text = `${text.slice(0, maxChars)}\n… (the rest of ${kept[0]!.id} is left out to leave room for the task's own files)`;
  return { kept, dropped, text };
}
