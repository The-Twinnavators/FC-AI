/**
 * Structured recovery for investigation that isn't going anywhere (reliability phase 3). Reading is how a step
 * learns; it only becomes a problem when it stops producing anything new. Two things are counted separately since the
 * last edit:
 *
 * - new investigation: a file (or search) read for the first time, or read again after its content changed;
 * - repeats: the same unchanged content read again.
 *
 * When either passes its budget, the attempt isn't ended: the agent is paused once and must answer one structured
 * check (ready to implement / missing specific information / ambiguous task / broken baseline / split required). Each
 * answer has a bounded route; none asks for a dummy edit. A second budget overrun in the same attempt ends it.
 *
 * Clean Cart step 14: 1,147 of the build's 1,348 reads were repeats of unchanged content; the step was stopped by
 * read limits and retried with nothing learned from why it was reading.
 */
import { createHash } from "node:crypto";

export interface InvestigationLimits {
  /** Reads of new content since the last edit. */
  newReads: number;
  /** Reads of unchanged content since the last edit. */
  repeats: number;
  /** Turns in a row that only re-read unchanged content (turns that learned something new don't count). */
  readTurns: number;
}

/**
 * The budget: a local model loops sooner and cheaper reads are worth less to it than to a cloud model, which reads many
 * files per turn as normal work. `budget` (runtime option) sets the new-reads budget; repeats and read-only turns scale
 * with it. `relax` (FlowCode's guards stopped this step twice) gives three times the room.
 */
export function investigationLimits(cloud: boolean, relax = false, budget?: number): InvestigationLimits {
  const room = relax ? 3 : 1;
  const newReads = budget && budget > 0 ? budget : cloud ? 120 : 40;
  return { newReads: newReads * room, repeats: Math.max(4, Math.round(newReads / (cloud ? 8 : 6))) * room, readTurns: Math.max(6, Math.round(newReads / (cloud ? 5 : 4))) * room };
}

export type ReadKind = "new" | "repeat";
export type Overrun = "repeats" | "new_reads" | "read_turns";

export class InvestigationTracker {
  private seen = new Map<string, string>();
  private repeatCount = new Map<string, number>();
  newSinceEdit = 0;
  repeatsSinceEdit = 0;
  readTurns = 0;
  constructor(readonly limits: InvestigationLimits) {}

  /** A read and what it returned: new if this key never returned this content before. */
  read(key: string, content: string): { kind: ReadKind; times: number } {
    const hash = createHash("sha1").update(content).digest("hex");
    if (this.seen.get(key) === hash) {
      this.repeatsSinceEdit++;
      const times = (this.repeatCount.get(key) ?? 1) + 1;
      this.repeatCount.set(key, times);
      return { kind: "repeat", times };
    }
    this.seen.set(key, hash);
    this.repeatCount.set(key, 1);
    this.newSinceEdit++;
    return { kind: "new", times: 1 };
  }

  /** An edit: the counts start again (the content it changed reads as new next time by its hash). */
  edited() {
    this.newSinceEdit = 0;
    this.repeatsSinceEdit = 0;
    this.readTurns = 0;
    this.repeatCount.clear();
  }

  /** A failed edit of this file: reading it again re-syncs, it isn't a repeat. */
  forget(path: string) {
    for (const k of [...this.seen.keys()]) if (k === path || k.startsWith(`${path}#`)) this.seen.delete(k);
  }

  /** A turn ended: it changed something, read something new, or only re-read what it had. */
  turn(read: boolean, edited: boolean, sawNew: boolean) {
    if (edited || sawNew) this.readTurns = 0;
    else if (read) this.readTurns++;
  }

  /** After a structured answer the agent gets a fresh budget; what it has seen still counts as seen. */
  fresh() {
    this.newSinceEdit = 0;
    this.repeatsSinceEdit = 0;
    this.readTurns = 0;
  }

  over(): Overrun | undefined {
    if (this.repeatsSinceEdit >= this.limits.repeats) return "repeats";
    if (this.newSinceEdit >= this.limits.newReads) return "new_reads";
    if (this.readTurns >= this.limits.readTurns) return "read_turns";
    return undefined;
  }
}

export const INVESTIGATION_STATUSES = ["ready_to_implement", "missing_information", "ambiguous_task", "broken_baseline", "split_required"] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export interface InvestigationAnswer {
  status: InvestigationStatus;
  detail: string;
  /** For missing_information: the files (paths) or facts needed. */
  needs: string[];
}

/** The pause: what was counted and the one answer expected. */
export function investigationPrompt(why: Overrun, t: InvestigationTracker): string {
  const what = why === "repeats" ? `${t.repeatsSinceEdit} reads of files you had already read, unchanged` : why === "new_reads" ? `${t.newSinceEdit} reads with no change made` : `${t.readTurns} turns in a row that only re-read files you had`;
  return [
    `Runtime check: ${what}. Before reading more, say where this step stands. Reply with only this JSON (no tool call):`,
    `{"status": "ready_to_implement" | "missing_information" | "ambiguous_task" | "broken_baseline" | "split_required", "detail": "…", "needs": ["…"]}`,
    "- ready_to_implement: you know the change; detail says what you'll change in which file. Then make it.",
    "- missing_information: a specific fact you can't find; needs lists the files (paths) or facts. FlowCode supplies what it can, once.",
    "- ambiguous_task: the step can be read two ways that change the work; detail names both readings.",
    "- broken_baseline: the code you start from is broken (it doesn't build or a test fails before your change); detail names the error.",
    "- split_required: the step is too big for one go; detail names the parts.",
    "Nothing else is needed: don't make an edit just to show progress.",
  ].join("\n");
}

/** The structured answer in a reply (JSON, possibly fenced or with a sentence around it). */
export function parseInvestigationAnswer(text: string): InvestigationAnswer | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as { status?: unknown; detail?: unknown; needs?: unknown };
    const status = String(raw.status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_") as InvestigationStatus;
    if (!INVESTIGATION_STATUSES.includes(status)) return undefined;
    const needs = Array.isArray(raw.needs) ? raw.needs.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
    return { status, detail: String(raw.detail ?? "").trim().slice(0, 600), needs };
  } catch {
    return undefined;
  }
}
