/**
 * The conversation-led builder (V2.1): the person describes the product, FlowCode clarifies only what matters in the
 * chat (quick choices, each skippable), states what it will build, and plans and builds. There is no Look step, no
 * design concepts to pick and no plan to approve: the plan is described in the chat, the Look is the project's chosen
 * one or read from the description, and later messages become changes. A message sent while a change is running is
 * queued and started when it ends (said so in the chat, never silently).
 *
 * The conversation is kept with the project (setting conversation:<projectId>), so a reload shows it as it was.
 */
import { randomUUID } from "node:crypto";
import { BASE_APPEARANCE, interpretDirection, TERMINAL_RUN_STATUSES } from "@flowcode/contracts";
import type { App } from "../app.js";
import { untrusted } from "../orchestrator/prompts.js";
import { getDesignState, saveDraft, selectDraft } from "../workspace/designState.js";

export interface ConvQuestion {
  id: string;
  question: string;
  why: string;
  options: string[];
  answer?: string;
  /** "Choose for me": FlowCode decides, and says so in what it builds. */
  skipped?: boolean;
}
export interface ConvMessage {
  id: string;
  at: string;
  role: "user" | "assistant";
  /** text: words; interpretation: what FlowCode will build; questions: quick choices; build: a run's live status card. */
  kind: "text" | "interpretation" | "questions" | "build";
  text?: string;
  questions?: ConvQuestion[];
  runId?: string;
  /** For a change request: started now, or queued behind the running one. */
  state?: "started" | "queued";
}
export interface Conversation {
  projectId: string;
  stage: "clarifying" | "building";
  messages: ConvMessage[];
  /** Change requests waiting for the running build or change to end, oldest first. */
  queue: Array<{ id: string; text: string; at: string }>;
}

const KEY = (projectId: string) => `conversation:${projectId}`;
const now = () => new Date().toISOString();
const id = () => randomUUID().slice(0, 12);

export function getConversation(app: Pick<App, "store">, projectId: string, description?: string): Conversation {
  const saved = app.store.getSetting<Conversation | null>(KEY(projectId), null);
  if (saved) return saved;
  return { projectId, stage: "clarifying", messages: description ? [{ id: id(), at: now(), role: "user", kind: "text", text: description }] : [], queue: [] };
}
const save = (app: Pick<App, "store">, c: Conversation) => (app.store.setSetting(KEY(c.projectId), c), c);
const push = (c: Conversation, m: Omit<ConvMessage, "id" | "at">) => (c.messages.push({ id: id(), at: now(), ...m }), c);

const SYSTEM =
  "You are FlowCode's product designer, starting a prototype from a person's description. You read the description, decide what to build first, and ask only the questions whose answers would change what gets built (who uses it most, the central journey, a must-have the description leaves open). Never ask what the description already says, never ask about colors, fonts, corners or other visual details (the person changes those directly), and never ask more than three questions. If the description is clear enough, ask none.";
const PROMPT =
  'Reply as JSON: { "interpretation": one or two plain sentences in the first person saying what you will build first, for whom, and the central journey (for example "I\'ll start with the product-search-to-shopping-list journey for shoppers, then add comparisons and saved regulars."), "assumptions": up to three short assumptions you are making, "questions": 0 to 3 items { "question", "why" (one short line on what it changes), "options": 2 to 4 short answers } }.';
const SCHEMA = {
  type: "object",
  properties: {
    interpretation: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, why: { type: "string" }, options: { type: "array", items: { type: "string" } } }, required: ["question", "options"] } },
  },
  required: ["interpretation", "questions"],
};
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * FlowCode's first reply: what it will build, and up to three quick-choice questions. When the model can't answer, it
 * says what it will build from the description and asks nothing (the person can still add detail in the chat).
 */
export async function clarify(app: App, projectId: string, description: string): Promise<Conversation> {
  const c = getConversation(app, projectId, description);
  if (c.messages.some((m) => m.kind === "interpretation")) return c;
  let raw: Record<string, unknown> = {};
  try {
    const assignment = app.router.assignmentFor("planner");
    const res = await app.router.chat({ role: "planner" }, { ...assignment, temperature: 0.3 }, { messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `${untrusted("description", description)}\n\n${PROMPT}` }], format: SCHEMA, timeoutMs: 180_000 });
    raw = JSON.parse(res.content.replace(/^[^{]*/, "").replace(/[^}]*$/, "")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const assumptions = (Array.isArray(raw.assumptions) ? raw.assumptions : []).map((a) => str(a, 160)).filter(Boolean).slice(0, 3);
  const interpretation = str(raw.interpretation, 500) || "I'll build the central journey from your description first, then the screens around it.";
  push(c, { role: "assistant", kind: "interpretation", text: assumptions.length ? `${interpretation}\n\nAssuming: ${assumptions.join("; ")}.` : interpretation });
  const questions: ConvQuestion[] = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q) => q as Record<string, unknown>)
    .map((q) => ({ id: id(), question: str(q.question, 200), why: str(q.why, 200), options: (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 80)).filter(Boolean).filter((o, i, a) => a.indexOf(o) === i).slice(0, 4) }))
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, 3);
  if (questions.length) push(c, { role: "assistant", kind: "questions", questions });
  return save(app, c);
}

/** An answer to one quick-choice question, or null for "Choose for me". */
export function answer(app: Pick<App, "store">, projectId: string, questionId: string, value: string | null): Conversation {
  const c = getConversation(app, projectId);
  const q = c.messages.flatMap((m) => m.questions ?? []).find((x) => x.id === questionId);
  if (!q) throw new Error("That question isn't in this conversation.");
  if (c.stage !== "clarifying") throw new Error("The build has started; send a message to change it.");
  if (value === null) {
    delete q.answer;
    q.skipped = true;
  } else {
    q.answer = value.trim().slice(0, 500);
    q.skipped = false;
  }
  return save(app, c);
}

/** The description the build starts from: the person's words, what they added, and their answers (or that FlowCode chose). */
export function buildBrief(c: Conversation): string {
  const said = c.messages.filter((m) => m.role === "user" && m.kind === "text").map((m) => m.text ?? "");
  const qa = c.messages
    .flatMap((m) => m.questions ?? [])
    .map((q) => `- ${q.question} ${q.answer ? q.answer : "(FlowCode chooses a sensible default and says so)"}`);
  return [said[0] ?? "", said.length > 1 ? `Added in the chat:\n${said.slice(1).map((s) => `- ${s}`).join("\n")}` : "", qa.length ? `Clarified in the chat:\n${qa.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

/**
 * The Look a conversation build starts from: the project's chosen one when there is one, otherwise read from the
 * description's own words (a dark, warm or serif request is followed); the person refines it in the preview.
 */
export function ensureLook(app: Pick<App, "store">, projectId: string, description: string) {
  const s = getDesignState(app.store, projectId);
  if (s.selected || s.applied) return;
  const reading = interpretDirection(description, BASE_APPEARANCE);
  saveDraft(app.store, projectId, reading.appearance, {});
  selectDraft(app.store, projectId);
}

/** Starts the build: the clarifying stage ends and the build's status card joins the conversation. */
export function recordBuild(app: Pick<App, "store">, projectId: string, runId: string): Conversation {
  const c = getConversation(app, projectId);
  for (const q of c.messages.flatMap((m) => m.questions ?? [])) if (!q.answer && !q.skipped) q.skipped = true;
  c.stage = "building";
  push(c, { role: "assistant", kind: "build", runId, state: "started" });
  return save(app, c);
}

const activeRun = (app: Pick<App, "store">, projectId: string) => app.store.runs.where("project_id = ?", projectId).find((r) => !TERMINAL_RUN_STATUSES.includes(r.status) && r.status !== "draft");

/**
 * A message in the chat. Before the build it adds to what will be built. Afterwards it is a change: started now, or
 * queued behind the running build or change (and the chat says which).
 */
export function message(app: Pick<App, "store">, projectId: string, text: string, startChange: (text: string) => string, guide?: (runId: string, text: string) => string | undefined): Conversation {
  const c = getConversation(app, projectId);
  push(c, { role: "user", kind: "text", text: text.trim().slice(0, 4000) });
  if (c.stage === "clarifying") return save(app, c);
  const running = activeRun(app, projectId);
  // Stuck on a step that needs the person: the message is their guidance, and the step is tried again with it.
  const retried = running && running.status === "blocked" && guide ? guide(running.id, text.trim()) : undefined;
  if (retried) {
    push(c, { role: "assistant", kind: "text", text: `Got it. Trying "${retried}" again with your guidance.` });
    return save(app, c);
  }
  if (running) {
    c.queue.push({ id: id(), text: text.trim().slice(0, 4000), at: now() });
    push(c, { role: "assistant", kind: "text", text: "Queued: I'll make this change when the current update finishes.", state: "queued" });
    return save(app, c);
  }
  const runId = startChange(text.trim());
  push(c, { role: "assistant", kind: "build", runId, state: "started" });
  return save(app, c);
}

/** When a build or change ends, the next queued request starts. */
export function watchConversationQueue(app: App, startChange: (projectId: string, text: string) => string) {
  return app.bus.subscribe((e) => {
    if (e.type !== "run.status_changed" || !e.projectId) return;
    const to = (e.data as { to?: string } | undefined)?.to;
    if (!to || !TERMINAL_RUN_STATUSES.includes(to as never)) return;
    const c = app.store.getSetting<Conversation | null>(KEY(e.projectId), null);
    if (!c?.queue.length || activeRun(app, e.projectId)) return;
    const next = c.queue.shift()!;
    try {
      const runId = startChange(e.projectId, next.text);
      push(c, { role: "assistant", kind: "build", runId, state: "started", text: next.text });
    } catch (err) {
      push(c, { role: "assistant", kind: "text", text: `I couldn't start the queued change "${next.text.slice(0, 80)}": ${(err as Error).message}` });
    }
    save(app, c);
  });
}
