/**
 * The Copilot's first drafts: from the person's rough idea, a local model writes the text for a FlowCode form (a new
 * build's description, the problem for Create PRD, an About-you note, a skill, a prompt, a decision or note, a research
 * topic). The UI types it into the real form and waits for the person to review it; nothing is saved or sent here.
 */
import { z } from "zod";
import type { App } from "../app.js";

export const DraftKind = z.enum(["build", "prd", "about", "skill", "prompt", "note", "topic"]);
export type DraftKind = z.infer<typeof DraftKind>;

const str = { type: "string" } as const;
/** Per kind: what to write and the fields the form has. Plain words, no invented facts about the person. */
const KINDS: Record<DraftKind, { brief: string; fields: Record<string, string> }> = {
  build: {
    brief: "Describe an app for FlowCode to build as a clickable prototype: who uses it, what they must be able to do first, the main screens, and anything to leave out. 3–6 sentences, everyday words.",
    fields: { description: "the description" },
  },
  prd: {
    brief: "State the problem to research and write a PRD for: who has it, what goes wrong today, why it matters. 2–4 sentences. Describe the problem, not a solution.",
    fields: { problem: "the problem statement" },
  },
  about: {
    brief: "Write one short note, in the first person, that tells an assistant about the user so its answers fit them (who they are, what they work on, or how they like answers). One idea, 1–2 sentences. Use only what the user said; don't invent details.",
    fields: { note: "the note" },
  },
  skill: {
    brief: "Write a reusable skill for coding agents that build web prototypes: a short kebab-case name, one line on what it achieves, step-by-step instructions (numbered, concrete, checkable), and comma-separated trigger words.",
    fields: { name: "kebab-case name", purpose: "one line", instructions: "numbered steps", triggers: "comma-separated words" },
  },
  prompt: {
    brief: "Write a prompt for an agent: a short title, one line on what it's for, and the prompt text itself (the instructions the agent is given, second person, specific).",
    fields: { title: "short title", purpose: "one line", template: "the prompt text" },
  },
  note: {
    brief: "Write a knowledge note: a short title and the content. For a decision, say what was decided, why, and what was ruled out. Keep it under 120 words.",
    fields: { title: "short title", content: "the note" },
  },
  topic: {
    brief: "Turn the idea into a research topic to follow on the web: one clear subject, 3–8 words.",
    fields: { q: "the topic" },
  },
};

export async function copilotDraft(app: App, kind: DraftKind, idea: string): Promise<{ kind: DraftKind; fields: Record<string, string>; model: string }> {
  const spec = KINDS[kind];
  const assignment = app.router.assignmentFor("documenter");
  const res = await app.router.chat({ role: "documenter" }, { ...assignment, temperature: 0.5 }, {
    messages: [
      {
        role: "system",
        content: `You write first drafts for FlowCode forms. The user will review and edit everything before it's saved.\n${spec.brief}\nWork only from the user's idea: keep their meaning, fill obvious gaps sensibly, and never claim facts about them they didn't give.\nReturn JSON with these fields: ${Object.entries(spec.fields).map(([k, v]) => `"${k}" (${v})`).join(", ")}.`,
      },
      { role: "user", content: idea.slice(0, 4000) },
    ],
    format: { type: "object", properties: Object.fromEntries(Object.keys(spec.fields).map((k) => [k, str])), required: Object.keys(spec.fields) },
    timeoutMs: 120_000,
  });
  const parsed = JSON.parse(res.content) as Record<string, unknown>;
  const fields = Object.fromEntries(Object.keys(spec.fields).map((k) => [k, String(parsed[k] ?? "").trim().slice(0, 6000)]));
  return { kind, fields, model: assignment.model };
}
