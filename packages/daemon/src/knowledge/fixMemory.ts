/**
 * Fix memory: when a build step passes after failing, FlowCode keeps what went wrong and what fixed it (the passing
 * attempt's own changes), as a Knowledge Hub note tagged "fix-memory" that every project can look up. When a later step
 * fails in a similar way, its retry gets the closest past fixes in its prompt. Matching uses the local embedding model
 * (nomic-embed-text), falling back to shared words. Notes can be set aside or deleted in the Knowledge Hub, or promoted
 * to a skill.
 */
import fs from "node:fs";
import { createTwoFilesPatch } from "diff";
import type { KnowledgeItem, SkillSpec } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { KnowledgeService } from "./knowledge.js";
import type { SnapshotService } from "../workspace/snapshots.js";
import type { PathJail } from "../security/pathJail.js";

export const FIX_TAG = "fix-memory";
const MAX_DIFF = 1800;

/** An error message without what changes from one project to the next (paths, line numbers, ids, quoted values). */
export function errorSignature(text: string): string {
  return text
    .replace(/\(\d+,\d+\)|:\d+:\d+|line \d+/gi, "")
    .replace(/[A-Za-z]:[\\/][^\s"')]+|(?:src|app|lib|public)\/[\w./-]+/g, "<file>")
    .replace(/\b(run|task|apr|snap|cp|kn|art)_[a-z0-9]+\b/gi, "<id>")
    .replace(/#[0-9a-f]{3,8}\b/gi, "<colour>")
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/**
 * FlowCode's own process stops (reading without editing, out of turns, prose instead of tools, a limit relaxed) say
 * nothing about the app, so they aren't problems a fix can teach (No BIO & GMO colour fix: the only "problem" was
 * "9 reads in a row and no change made").
 */
const PROCESS_STOP = /no_action|budget_exhausted|reads in a row|turn budget|replied with prose|did not invoke a tool|no progress|FlowCode limit|attempt ended with|user requested retry/i;

/** The failure reasons recorded for a step, without the person's guidance (kept apart), process stops and duplicates. */
export function failuresOf(findings: string[]): { problems: string[]; guidance: string[] } {
  const guidance = findings.filter((f) => /^Guidance from the user/.test(f)).map((f) => f.replace(/^Guidance from the user \(follow this\):\s*/, ""));
  const problems = [...new Set(findings.filter((f) => !/^Guidance from the user/.test(f) && !PROCESS_STOP.test(f)).map((f) => f.trim()))];
  return { problems, guidance };
}

/**
 * A short diff of the step's net change (each file from before the step's first kept edit to now). The passing attempt
 * alone missed it: an attempt cut off by a restart had made the edit, and the next one only confirmed it.
 */
export function fixDiff(deps: { store: Store; snapshots: SnapshotService }, jail: PathJail, taskId: string): { files: string[]; diff: string } {
  const snaps = deps.store.snapshots.where("task_id = ? ORDER BY seq ASC", taskId).filter((s) => !s.restoredAt);
  const first = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) if (!first.has(s.relativePath)) first.set(s.relativePath, s);
  let diff = "";
  for (const [rel, s] of first) {
    if (diff.length >= MAX_DIFF) break;
    let before = "";
    try {
      before = deps.snapshots.priorContent(s) ?? "";
    } catch {
      before = "";
    }
    let after = "";
    try {
      after = fs.readFileSync(jail.resolve(rel).abs, "utf8");
    } catch {
      after = "";
    }
    if (before === after) continue;
    const patch = createTwoFilesPatch(rel, rel, before, after, "", "", { context: 1 })
      .split("\n")
      .slice(2)
      .join("\n");
    diff += `${patch}\n`;
  }
  return { files: [...first.keys()], diff: diff.slice(0, MAX_DIFF) + (diff.length > MAX_DIFF ? "\n[…]" : "") };
}

export interface FixRecord {
  projectId: string;
  runId: string;
  taskId: string;
  step: string;
  model?: string;
  attempts: number;
  problems: string[];
  guidance: string[];
  summary?: string;
  files: string[];
  diff: string;
}

/** Saves a fix as a global Knowledge Hub note. Returns undefined when there's nothing worth keeping. */
export function recordFix(knowledge: KnowledgeService, f: FixRecord): KnowledgeItem | undefined {
  if (!f.problems.length || (!f.diff.trim() && !f.guidance.length)) return undefined;
  const headline = f.problems[0].replace(/\s+/g, " ").slice(0, 90);
  const content = [
    `Problem (step "${f.step}", fixed on attempt ${f.attempts}${f.model ? ` by ${f.model}` : ""}):`,
    ...f.problems.slice(0, 4).map((p) => `- ${p.slice(0, 400)}`),
    `Signature: ${errorSignature(f.problems.join(" | "))}`,
    ...(f.guidance.length ? [`Guidance that helped:`, ...f.guidance.slice(0, 2).map((g) => `- ${g.slice(0, 600)}`)] : []),
    ...(f.summary ? [`What the step did: ${f.summary.slice(0, 400)}`] : []),
    ...(f.files.length ? [`Files: ${f.files.slice(0, 8).join(", ")}`] : []),
    ...(f.diff.trim() ? [`The fix:`, "```diff", f.diff.trim(), "```"] : []),
  ].join("\n");
  return knowledge.create({
    scope: "global",
    kind: "note",
    title: `Fix: ${headline}`,
    content,
    tags: [FIX_TAG],
    provenance: [{ kind: "run", ref: f.runId, title: `step ${f.taskId}` }],
    confidence: "medium",
    linkedEntityIds: [],
    durability: "durable",
    confirmedByUser: false,
  });
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []);

/** The past fixes closest to a failure: by embedding similarity when the local model is there, else shared words. */
export async function similarFixes(knowledge: KnowledgeService, problem: string, limit = 3): Promise<KnowledgeItem[]> {
  const all = knowledge.list().filter((k) => k.tags.includes(FIX_TAG) && !k.excluded);
  if (!all.length || !problem.trim()) return [];
  const sig = errorSignature(problem);
  const semantic = await knowledge.similarAmong(all, `${problem}\n${sig}`).catch(() => [] as Array<{ item: KnowledgeItem; similarity: number }>);
  if (semantic.length) return semantic.filter((x) => x.similarity >= 0.62).slice(0, limit).map((x) => x.item);
  const w = words(sig);
  return all
    .map((k) => ({ k, score: [...words(k.content)].filter((x) => w.has(x)).length }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.k);
}

/** What a retry gets: the past fixes, marked as from other builds. */
export function fixBrief(items: KnowledgeItem[]): string {
  if (!items.length) return "";
  return [
    `Fixes that worked before for similar problems (FlowCode's fix memory, from earlier builds; use what applies, don't copy blindly):`,
    ...items.map((k, i) => `${i + 1}. ${k.title.replace(/^Fix: /, "")}\n${k.content.replace(/^Problem[^\n]*\n/, "").slice(0, 1400)}`),
  ].join("\n\n");
}

/** A fix promoted to a skill: switched on, for coders and debuggers, picked up by the words of its problem. */
export function fixToSkill(k: KnowledgeItem): SkillSpec {
  const slug = k.title.replace(/^Fix: /, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "fix";
  const triggers = [...words(k.content.split("Signature:")[1]?.split("\n")[0] ?? k.title)].filter((w) => !["file", "colour"].includes(w)).slice(0, 6);
  return {
    id: `skill.fix-${slug}`,
    version: "1.0.0",
    roles: ["coder", "debugger"],
    triggers,
    enabled: true,
    source: "user",
    purpose: `Avoid and repair: ${k.title.replace(/^Fix: /, "").slice(0, 160)}`,
    instructions: `A fix that worked in an earlier build. When you see this problem, apply the same kind of change.\n${k.content.slice(0, 2400)}`,
    allowedTools: ["list_files", "read_file", "search_code", "apply_patch", "replace_file", "create_file", "run_script", "task_complete", "report_blocked"],
    inputSchema: "Task",
    outputSchema: "ChangedPaths",
    policies: { network: "denied", filesystem: "governed_write" },
    acceptance: [],
    tests: [],
    changelog: [{ version: "1.0.0", date: new Date().toISOString().slice(0, 10), note: `Promoted from fix memory (${k.id})` }],
  };
}
