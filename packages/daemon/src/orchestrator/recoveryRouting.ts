/**
 * Who takes a step after a failed attempt. Every attempt after the first used to run as the debugger, whatever failed:
 * a one-line type error got a thinking model, the same context and the same instructions under another name, the
 * biggest single cost in a build. Now the failure is classified first:
 *
 * - implementation: a precise, located error (a type error at a line, a failing test by name, a check's own message):
 *   the coder corrects it, with the exact diagnostic and the source and type contracts it names (up to
 *   `coderCorrections`, default 2), unless the correction made no progress (the same failure again);
 * - guard: a FlowCode guard or tool policy refused something: the coder gets the correction path, as a correction;
 * - task_contract: the step itself can't be done as written (no passable check, ambiguous): repaired or brought to the
 *   person elsewhere; here it is never sent to the debugger;
 * - provider / orphaned: infrastructure (handled before any attempt is judged; never the debugger's job);
 * - persistent: the same failure after a correction, or a failure with no located diagnostic (out of turns, stopped
 *   without finishing): the debugger, with an escalation record of what failed, what was tried, why it didn't resolve
 *   it, and what the debugger gets that the coder didn't.
 *
 * Bounded: corrections are counted, a correction that makes no progress ends them, and the step's attempt budget only
 * grows by the corrections actually used (at most `coderCorrections`).
 */
import fs from "node:fs";
import path from "node:path";
import type { Store } from "../db/store.js";

export type FailureClass = "implementation" | "guard" | "task_contract" | "provider" | "orphaned" | "persistent";

export interface Diagnostic {
  kind: "type" | "lint" | "test" | "check";
  text: string;
  file?: string;
  line?: number;
}

export interface FailureVerdict {
  cls: FailureClass;
  /** What it is, in a few words ("a type error", "2 failing tests"). */
  what: string;
  diagnostics: Diagnostic[];
}

export interface RecoveryAttempt {
  attempt: number;
  role: "coder" | "debugger";
  correction: boolean;
  cls: FailureClass;
  what: string;
  signature: string;
  summary: string;
  at: string;
}

export type EscalationCause = "no_progress" | "not_located" | "corrections_exhausted" | "corrections_off";

export interface Escalation {
  at: string;
  cause: EscalationCause;
  attempt: number;
  failed: string;
  attempted: string[];
  whyUnresolved: string;
  different: string[];
}

export interface RecoveryState {
  corrections: number;
  history: RecoveryAttempt[];
  escalation?: Escalation;
  /** The role and focus for the next attempt, decided when the last one failed. */
  next?: { role: "coder" | "debugger"; correction: boolean; label: string; reason: string; what?: string; diagnostics?: Diagnostic[] };
}

export const recoveryKey = (taskId: string) => `recovery:${taskId}`;
export const getRecovery = (store: Store, taskId: string): RecoveryState => store.getSetting<RecoveryState>(recoveryKey(taskId), { corrections: 0, history: [] });

const TS_ERROR = /((?:src|app|lib|tests?)\/[\w./-]+\.\w+)\((\d+),\d+\): error (TS\d+): ([^\n]+)/g;
const LINT_ERROR = /((?:src|app|lib|tests?)\/[\w./-]+\.\w+)[^\n]*\n?\s*(\d+):\d+\s+error\s+([^\n]+)/g;
const TEST_FAIL = /(?:these tests of this part fail:\n((?:- [^\n]+\n?)+))|(?:^|\n)\s*(?:×|✗|FAIL)\s+([^\n]+)/g;
const GUARD = /agent outcome: no_action \(No progress:|^Rejected \w+:|Denied: |outside the approved (plan )?scope|Invalid arguments for|Patch context mismatch|was not rerun: it already failed|identical \w+ call failed/i;
const CONTRACT = /no machine-checkable acceptance criteria|could ever match|^Ambiguous task:|^Missing information:|doesn't fit the coding context|can't be split further/i;
const PROVIDER = /model service|connection_refused|ECONNREFUSED|timed? ?out waiting for the model|out_of_memory|rate_limited|model_missing/i;
// Checks that name exactly what to change: the step's own tests, the type check, lint, deliverables, content, layout
// lock, look check, app guard, tokens.
const LOCATED_CHECK = /^(Look check|Design crit|Layout lock|Content check|Deliverables check|App guard|These tokens are still used|Library pieces the screens|Earlier steps' acceptance tests|This step's tests pass, but)/;

/** The located diagnostics in a failure's text: type errors with file and line, lint errors, failing tests. */
export function diagnosticsOf(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const m of text.matchAll(TS_ERROR)) out.push({ kind: "type", file: m[1], line: Number(m[2]), text: `${m[1]}:${m[2]} ${m[3]}: ${m[4]!.trim()}` });
  for (const m of text.matchAll(LINT_ERROR)) out.push({ kind: "lint", file: m[1], line: Number(m[2]), text: `${m[1]}:${m[2]} ${m[3]!.trim()}` });
  for (const m of text.matchAll(TEST_FAIL)) {
    const names = m[1] ? m[1].split("\n").map((l) => l.replace(/^- /, "").trim()).filter(Boolean) : [m[2]!.trim()];
    for (const n of names) out.push({ kind: "test", text: n.slice(0, 240) });
  }
  const seen = new Set<string>();
  return out.filter((d) => !seen.has(d.text) && seen.add(d.text)).slice(0, 12);
}

/** What kind of failure an attempt ended with (its outcome and the reasons it isn't verified). */
export function classifyFailure(outcomeKind: string, why: string[]): FailureVerdict {
  const text = why.join("\n");
  if (outcomeKind === "model_error" || why.some((w) => /^agent outcome: model_error/.test(w) && PROVIDER.test(w))) return { cls: "provider", what: "a model service problem", diagnostics: [] };
  if (why.some((w) => CONTRACT.test(w.replace(/^agent outcome: \w+ \(/, "")))) return { cls: "task_contract", what: "a step that can't be done as written", diagnostics: [] };
  const diagnostics = diagnosticsOf(text);
  const located = why.filter((w) => LOCATED_CHECK.test(w));
  for (const w of located) diagnostics.push({ kind: "check", text: w.split("\n")[0]!.slice(0, 300) });
  // A guard or tool refusal with nothing else wrong: the coder gets the way through it.
  if (!diagnostics.length && why.some((w) => GUARD.test(w))) return { cls: "guard", what: "a FlowCode guard or tool refusal", diagnostics: [{ kind: "check", text: (why.find((w) => GUARD.test(w)) ?? "").slice(0, 400) }] };
  if (diagnostics.length) {
    const types = diagnostics.filter((d) => d.kind === "type").length;
    const tests = diagnostics.filter((d) => d.kind === "test").length;
    const lint = diagnostics.filter((d) => d.kind === "lint").length;
    const what = types ? (types === 1 ? "a type error" : `${types} type errors`) : tests ? (tests === 1 ? "a failing test" : `${tests} failing tests`) : lint ? (lint === 1 ? "a lint error" : `${lint} lint errors`) : located[0] ? `the ${located[0].split(/[:(]/)[0]!.toLowerCase()} findings` : "a check";
    return { cls: "implementation", what, diagnostics };
  }
  // Out of turns, stopped without finishing, or a failure with nothing located: the debugger investigates.
  return { cls: "persistent", what: outcomeKind === "budget_exhausted" ? "an attempt that ran out of turns" : "a failure with no located error", diagnostics: [] };
}

export interface RoutingPolicy {
  /** Focused coder corrections before the debugger (default 2). */
  coderCorrections: number;
}

/**
 * Records the failed attempt and decides the next one. Returns the state with `next` set, and an escalation when the
 * debugger takes over (what failed, what was tried, why it didn't resolve it, what's different now).
 */
export function routeAfterFailure(
  state: RecoveryState,
  failed: { attempt: number; role: "coder" | "debugger"; outcomeKind: string; why: string[]; signature: string },
  policy: RoutingPolicy,
  different: (verdict: FailureVerdict) => string[],
): RecoveryState {
  const verdict = classifyFailure(failed.outcomeKind, failed.why);
  const last = state.next;
  const record: RecoveryAttempt = { attempt: failed.attempt, role: failed.role, correction: !!last?.correction, cls: verdict.cls, what: verdict.what, signature: failed.signature, summary: (failed.why[0] ?? "").slice(0, 300), at: new Date().toISOString() };
  const history = [...state.history, record].slice(-8);
  const prev = state.history.at(-1);
  // The correction made no progress: the same failure as before it.
  const noProgress = !!prev && prev.signature === failed.signature;
  const lead = verdict.diagnostics[0]?.text ?? record.summary;
  const base = { ...state, history };
  // Once the debugger has the step, it keeps it.
  if (state.escalation || failed.role === "debugger") return { ...base, next: { role: "debugger", correction: false, label: "Debugger investigating a persistent failure", reason: `${verdict.what}: ${lead}`.slice(0, 300) } };
  const correctable = (verdict.cls === "implementation" || verdict.cls === "guard") && !noProgress && state.corrections < policy.coderCorrections;
  if (correctable) {
    const label = verdict.cls === "guard" ? "Coder correcting a refused action" : `Coder correcting ${verdict.what}`;
    return { ...base, corrections: state.corrections + 1, next: { role: "coder", correction: true, label, reason: lead.slice(0, 300), what: verdict.what, diagnostics: verdict.diagnostics } };
  }
  // A step that can't be done as written isn't a code defect: the coder gets it again with the problem said (the task
  // packet and checks are repaired by the caller); it never goes to the debugger for it.
  if (verdict.cls === "task_contract") return { ...base, next: { role: "coder", correction: false, label: "Coder retrying with the step's packet repaired", reason: lead.slice(0, 300) } };
  const whyUnresolved = policy.coderCorrections === 0 && verdict.cls !== "persistent"
    ? "Coder corrections are turned off (Speed & recovery), so retries go to the debugger."
    : noProgress
    ? `The ${record.correction ? "correction" : "attempt"} (attempt ${record.attempt}) ended with the same failure as attempt ${prev!.attempt}: no progress.`
    : verdict.cls === "persistent"
      ? `It isn't a located error a correction can target (${verdict.what}).`
      : `${state.corrections} focused correction${state.corrections === 1 ? "" : "s"} didn't resolve it.`;
  const cause: EscalationCause = policy.coderCorrections === 0 && verdict.cls !== "persistent" ? "corrections_off" : noProgress ? "no_progress" : verdict.cls === "persistent" ? "not_located" : "corrections_exhausted";
  const escalation: Escalation = {
    at: record.at,
    cause,
    attempt: failed.attempt + 1,
    failed: `${verdict.what}: ${lead}`.slice(0, 400),
    attempted: history.map((h) => `Attempt ${h.attempt} (${h.role}${h.correction ? ", correction" : ""}): ${h.what}`),
    whyUnresolved,
    different: different(verdict),
  };
  return { ...base, escalation, next: { role: "debugger", correction: false, label: "Debugger investigating a persistent failure", reason: whyUnresolved, what: verdict.what, diagnostics: verdict.diagnostics } };
}

/** The correction brief: the exact diagnostics and the source around each, so the coder fixes without rediscovering. */
export function correctionBrief(verdict: { what: string; diagnostics: Diagnostic[] }, source: (file: string, line: number) => string | undefined, contracts: string[]): string {
  const lines = [`Focused correction: fix ${verdict.what} and nothing else. The step's other work is done and stays as it is.`];
  for (const d of verdict.diagnostics.slice(0, 6)) {
    lines.push(`- ${d.text}`);
    const near = d.file && d.line ? source(d.file, d.line) : undefined;
    if (near) lines.push(near);
  }
  if (contracts.length) lines.push("The types these errors refer to, as defined in this project:", ...contracts.slice(0, 4));
  lines.push("Patch the lines named above (apply_patch), run the check that failed, then call task_complete.");
  return lines.join("\n");
}

/** The escalation, for the debugger's packet and the activity: what it gets that the coder didn't. */
export function escalationBrief(e: Escalation): string {
  return [
    "Escalated to you (the debugger) after focused corrections didn't resolve this step:",
    `What failed: ${e.failed}`,
    `Already tried: ${e.attempted.join("; ")}`,
    `Why that didn't resolve it: ${e.whyUnresolved}`,
    `What you have that the coder didn't: ${e.different.join("; ")}`,
    "Find the root cause before editing: don't repeat the edits above.",
  ].join("\n");
}

/** Type names a type error refers to ("... type 'IntrinsicAttributes & HeroSplitProps'"), for their definitions. */
export function typeNamesIn(diagnostics: Diagnostic[]): string[] {
  const names = new Set<string>();
  for (const d of diagnostics.filter((x) => x.kind === "type")) for (const m of d.text.matchAll(/'([^']+)'/g)) for (const part of m[1]!.split(/[&|<>,\s]+/)) if (/^[A-Z][A-Za-z0-9]+(Props|Item|Record|Model|Type|Data|Options|Config|State)?$/.test(part) && !["IntrinsicAttributes", "Element", "ReactNode", "Record", "Partial", "Array", "Promise", "Readonly"].includes(part)) names.add(part);
  return [...names].slice(0, 4);
}

/** The lines around a diagnostic, numbered, for the correction brief. */
export function sourceNear(root: string, file: string, line: number, around = 3): string | undefined {
  try {
    const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
    const from = Math.max(0, line - 1 - around);
    return lines
      .slice(from, line + around)
      .map((l, i) => `${String(from + i + 1).padStart(5)}| ${l}`)
      .join("\n");
  } catch {
    return undefined;
  }
}

/** Where the project defines these types (an interface or a type alias), up to 25 lines each. */
export function typeDefinitions(root: string, names: string[], files: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    const re = new RegExp(`^\\s*(export\\s+)?(interface|type)\\s+${name}\\b`);
    for (const f of files) {
      let lines: string[];
      try {
        lines = fs.readFileSync(path.join(root, f), "utf8").split("\n");
      } catch {
        continue;
      }
      const at = lines.findIndex((l) => re.test(l));
      if (at < 0) continue;
      let end = at;
      let depth = 0;
      for (let i = at; i < Math.min(lines.length, at + 25); i++) {
        depth += (lines[i]!.match(/[{(]/g) ?? []).length - (lines[i]!.match(/[})]/g) ?? []).length;
        end = i;
        if (depth <= 0 && /[};]\s*$/.test(lines[i]!)) break;
      }
      out.push(`${f}:${at + 1}\n${lines.slice(at, end + 1).join("\n")}`);
      break;
    }
  }
  return out;
}

/** The project's installed packages (package.json dependencies and devDependencies), without type-only packages. */
export function installedPackages(root: string): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].filter((n) => !n.startsWith("@types/")).slice(0, 60);
  } catch {
    return [];
  }
}
