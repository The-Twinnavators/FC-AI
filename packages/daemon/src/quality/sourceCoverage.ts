/**
 * Source-to-plan coverage: every substantive passage of the PRD (each paragraph line, list item and table row) traced
 * to the requirements extracted from it and to where the plan puts them (a build step, a person's check, "not in this
 * release", or the app model's records). A passage that maps to nothing is reported, so coverage can't look complete
 * merely because every extracted requirement was assigned somewhere (Frameproof evaluation 2: 51 PRD sentences were
 * never extracted, and the plan's coverage still read "all 140 requirements placed").
 */
import type { PlanItem } from "./lrcPlan.js";
import { logicalLines, type Requirement } from "./spec.js";

export type PassageStatus = "in a build step" | "for a person to check" | "not in this release" | "supporting data" | "lead-in" | "unmapped";
export interface SourcePassage {
  line: number;
  path: string[];
  text: string;
  kind: "paragraph" | "item" | "row" | "lead-in";
  requirements: string[];
  status: PassageStatus;
  /** The build steps that carry it (their titles). */
  steps: string[];
}
export interface SourceCoverage {
  passages: SourcePassage[];
  unmapped: SourcePassage[];
  counts: Record<PassageStatus, number>;
}

const SUPPORTING = "spec.supporting-data";
export const sourceCoverageKey = (runId: string) => `sourceCoverage:${runId}`;

/**
 * `recordLines`: table rows the app model holds as records (prdRecords.ts): supporting data even when a row is too
 * short to be a requirement of its own. `stepTitle`: a step's title by its key.
 */
export function sourceCoverage(md: string, requirements: Requirement[], items: PlanItem[], opts: { recordLines?: Set<number>; stepTitle?: (key: string) => string | undefined } = {}): SourceCoverage {
  const byLine = new Map<number, Requirement[]>();
  for (const r of requirements) if (r.source) byLine.set(r.source.line, [...(byLine.get(r.source.line) ?? []), r]);
  const passages: SourcePassage[] = [];
  const path: Array<{ level: number; text: string }> = [];
  let inCode = false;
  let header = false;
  for (const { raw, line: n } of logicalLines(md)) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (!line) {
      header = false;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      while (path.length && path.at(-1)!.level >= h[1]!.length) path.pop();
      path.push({ level: h[1]!.length, text: h[2]!.trim() });
      continue;
    }
    if (line.startsWith("|")) {
      if (/^\|?[\s:|-]+\|?$/.test(line)) continue;
      if (!header) {
        header = true;
        continue;
      }
    }
    const kind: SourcePassage["kind"] = line.startsWith("|") ? "row" : /^(?:[-*+]|\d+[.)])\s+/.test(line) ? "item" : /:\s*$/.test(line) && !byLine.has(n) ? "lead-in" : "paragraph";
    const reqs = byLine.get(n) ?? [];
    const its = items.filter((x) => x.covers.some((c) => reqs.some((r) => r.id === c)));
    const code = its.filter((x) => x.executionType === "code" && !x.later);
    const status: PassageStatus =
      kind === "lead-in"
        ? "lead-in"
        : code.length
          ? "in a build step"
          : its.some((x) => x.categoryId === SUPPORTING) || (kind === "row" && opts.recordLines?.has(n))
            ? "supporting data"
            : its.some((x) => x.later)
              ? "not in this release"
              : its.length
                ? "for a person to check"
                : "unmapped";
    passages.push({ line: n, path: path.map((p) => p.text), text: line.replace(/^(?:[-*+]|\d+[.)])\s+/, ""), kind, requirements: reqs.map((r) => r.id), status, steps: [...new Set(code.map((x) => (x.stepKey && opts.stepTitle?.(x.stepKey)) || x.title))] });
  }
  const counts = Object.fromEntries((["in a build step", "for a person to check", "not in this release", "supporting data", "lead-in", "unmapped"] as PassageStatus[]).map((s) => [s, passages.filter((p) => p.status === s).length])) as Record<PassageStatus, number>;
  return { passages, unmapped: passages.filter((p) => p.status === "unmapped"), counts };
}

/** The table rows of a PRD's record tables, by line (their markdown found in the PRD). */
export function recordTableLines(md: string, tableMarkdown: string[]): Set<number> {
  const lines = md.split(/\r?\n/);
  const out = new Set<number>();
  for (const t of tableMarkdown) {
    const rows = t.split(/\r?\n/);
    const at = lines.findIndex((l, i) => rows.every((r, j) => (lines[i + j] ?? "").trim() === r.trim()));
    if (at >= 0) rows.forEach((_, j) => out.add(at + j + 1));
  }
  return out;
}

/** The coverage as a Markdown report: counts, then every passage with its line, requirements and place. */
export function sourceCoverageReport(c: SourceCoverage): string {
  return [
    `Substantive PRD passages: ${c.passages.filter((p) => p.status !== "lead-in").length}; ${Object.entries(c.counts).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    "",
    "| Line | Section | Passage | Requirements | Where in the plan |",
    "|---|---|---|---|---|",
    ...c.passages.map((p) => `| ${p.line} | ${p.path.slice(1).join(" › ").replace(/\|/g, "/")} | ${p.text.replace(/\|/g, "/").slice(0, 160)} | ${p.requirements.join(", ")} | ${p.status === "in a build step" ? `step: ${p.steps.join("; ").replace(/\|/g, "/")}` : p.status} |`),
  ].join("\n");
}
