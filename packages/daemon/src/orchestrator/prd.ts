/**
 * PRD intake: find the project's spec, index it by section, and hand each step only the sections it implements.
 * Reading a 30 KB PRD on every step was the largest avoidable context cost; the planner now works from a compact
 * section index and cites section ids per task, and coding steps receive just those sections' text.
 */
import fs from "node:fs";
import path from "node:path";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

export interface PrdSection {
  /** "3.4" from a numbered heading, otherwise "s<n>" in reading order. */
  id: string;
  title: string;
  level: number;
  start: number;
  end: number;
}

const SKIP = /(^|\/)(node_modules|dist|build|\.flowcode[^/]*|coverage|\.git)\//;

/** The primary PRD: an attached reference first, then spec/ or docs/prd/ Markdown, then any "*prd*.md"; largest wins. */
export function findPrd(jail: PathJail, referencePaths: string[] = []): string | undefined {
  const md = (p: string) => /\.(md|markdown)$/i.test(p);
  const size = (p: string) => {
    try {
      return fs.statSync(path.join(jail.root, p)).size;
    } catch {
      return 0;
    }
  };
  const byPriority = [
    referencePaths.filter(md),
    flattenFiles(jail, 4000).filter((f) => md(f) && !SKIP.test(`/${f}`) && /^(spec|docs\/prd|docs\/specs?)\//i.test(f) && !/attachments\//.test(f)),
    flattenFiles(jail, 4000).filter((f) => md(f) && !SKIP.test(`/${f}`) && /prd|requirements|spec/i.test(path.basename(f))),
  ];
  for (const group of byPriority) {
    const best = group.filter((p) => size(p) > 400).sort((a, b) => size(b) - size(a))[0];
    if (best) return best;
  }
  return undefined;
}

/** Headings (outside code fences) as sections; each section runs to the next heading of the same or higher level. */
export function parseSections(md: string): PrdSection[] {
  const heads: Array<{ id: string; title: string; level: number; start: number }> = [];
  let inCode = false;
  let offset = 0;
  let n = 0;
  for (const line of md.split(/\n/)) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    const m = !inCode && /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      n++;
      const text = m[2].replace(/[*_`]/g, "").trim();
      const num = /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/.exec(text);
      heads.push({ id: num ? num[1] : `s${n}`, title: num ? num[2] : text, level: m[1].length, start: offset });
    }
    offset += line.length + 1;
  }
  return heads.map((h, i) => {
    const next = heads.slice(i + 1).find((x) => x.level <= h.level);
    return { ...h, end: next ? next.start : md.length };
  });
}

const KEY_SECTIONS = /acceptance|non-?goals?|out of scope|permissions?|constraints?/i;

/**
 * A compact index for the planner: every section id, title and size, plus the full text of the sections every plan
 * should honour (acceptance criteria, non-goals, permissions, constraints), capped.
 */
export function sectionIndex(md: string, maxChars = 5000): string {
  const sections = parseSections(md);
  const lines = sections.map((s) => `${"  ".repeat(Math.max(0, s.level - 2))}${s.id} ${s.title} (${(s.end - s.start).toLocaleString("en-US")} chars)`);
  let out = lines.join("\n");
  let room = maxChars - out.length;
  for (const s of sections.filter((x) => KEY_SECTIONS.test(x.title) && x.level >= 2)) {
    if (room < 300) break;
    const body = md.slice(s.start, s.end).trim().slice(0, Math.min(1500, room - 50));
    out += `\n\n--- ${s.id} ${s.title} ---\n${body}`;
    room -= body.length + 20;
  }
  return out;
}

/** The text of the cited sections (each includes its subsections), within a budget. Unknown ids are ignored. */
export function sectionText(md: string, ids: string[], budget = 6000): { text: string; used: string[] } {
  const sections = parseSections(md);
  const used: string[] = [];
  let text = "";
  for (const id of [...new Set(ids.map((x) => x.trim().replace(/^§/, "")))]) {
    const s = sections.find((x) => x.id === id) ?? sections.find((x) => x.id.startsWith(`${id}.`));
    if (!s || used.some((u) => id.startsWith(`${u}.`))) continue;
    const body = md.slice(s.start, s.end).trim();
    const room = budget - text.length;
    if (room < 200) break;
    text += `${text ? "\n\n" : ""}${body.length > room ? `${body.slice(0, room - 20)}\n[section truncated]` : body}`;
    used.push(s.id);
  }
  return { text, used };
}

const STOP = new Set("that this with from have will your into than then when what each they them their there these those only also must should could would about after before every other some such more most very just make sure ensure implement handle build create add update screen step file app".split(" "));
/** Planning words and what PRDs say for them ("edge cases" are errors, zero, overflow…). Stems, as `words` makes them. */
const SYNONYMS: Array<[string, string[]]> = [
  ["edge", ["error", "zero", "overflow", "invalid", "infinity", "crash", "large", "negative"]],
  ["state", ["error", "empty", "loading", "offline", "success"]],
  ["accessibility", ["aria", "keyboard", "screen", "focu", "contrast", "label", "wcag"]],
];
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).map((w) => w.replace(/(?:ing|es|s)$/, "")).filter((w) => !STOP.has(w)));

/**
 * PRD sections a step's own words point at, for a step planned without citing any (Calculator test 1: a follow-up
 * build's "Implement states, accessibility, and edge cases" got no requirements, so the coder had nothing to build
 * and only read; the PRD's division-by-zero message and accessibility plan were never seen). Title words count
 * double; at most `max` sections, best first, and only ones that share real words with the step.
 */
export function matchSections(md: string, stepText: string, max = 4): string[] {
  // Each idea in the step ("states", "accessibility", "edge cases") with what PRDs say for it; the best section per
  // idea is cited, so one broad idea (accessibility words are everywhere) can't crowd out the others.
  const ideas = [...words(stepText)].map((w) => new Set([w, ...(SYNONYMS.find(([k]) => k === w)?.[1] ?? [])]));
  if (!ideas.length) return [];
  // Specific sections only: a part that has subsections (a whole "Product Description") is too broad to cite.
  const all = parseSections(md);
  const sections = all
    .filter((s) => s.level >= 2 && s.end - s.start < 6000 && !all.some((x) => x.start > s.start && x.start < s.end && x.level > s.level))
    .map((s) => ({ id: s.id, title: words(s.title), body: words(md.slice(s.start, s.end)) }));
  const scoreFor = (s: (typeof sections)[number], idea: Set<string>) => [...idea].reduce((n, w) => n + (s.title.has(w) ? 2 : 0) + (s.body.has(w) ? 1 : 0), 0);
  const picked: string[] = [];
  for (const idea of ideas) {
    const best = sections.map((s) => ({ id: s.id, score: scoreFor(s, idea) })).filter((x) => x.score >= 2 && !picked.includes(x.id)).sort((a, b) => b.score - a.score)[0];
    if (best) picked.push(best.id);
    if (picked.length >= max) break;
  }
  // The functional requirements are the app's core list (F5 order of operations, F7 the divide-by-zero message):
  // every step that builds part of the app works within them.
  const core = all.find((s) => /^functional requirements?$|^(?:core )?features?$|^requirements$/i.test(s.title.trim()) && s.end - s.start < 6000);
  if (core && !picked.includes(core.id)) picked.push(core.id);
  return picked;
}

/** Repository-level agent instructions, if the project has them (first part only). */
export function repoInstructions(jail: PathJail, maxChars = 1500): { file: string; text: string } | undefined {
  for (const f of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", "CONTRIBUTING.md"]) {
    try {
      const abs = path.join(jail.root, f);
      if (!fs.existsSync(abs)) continue;
      return { file: f, text: fs.readFileSync(abs, "utf8").slice(0, maxChars) };
    } catch {
      /* unreadable */
    }
  }
  return undefined;
}

/**
 * Whether a run is about the PRD at all. Only then does the planner get the section index and do steps get PRD text;
 * a small change ("make the accent darker") shouldn't carry spec sections it doesn't need.
 */
export function relatesToPrd(run: { objective: string; referencePaths?: string[]; strategy?: { kind?: string } }): boolean {
  if (run.referencePaths?.length) return true;
  if (run.strategy?.kind === "spec_build") return true;
  return /\b(prd|spec|specs|specification|requirements?|acceptance criteria|user stor(y|ies)|section\s+\d+(\.\d+)*)\b|§\s*\d/i.test(run.objective);
}
