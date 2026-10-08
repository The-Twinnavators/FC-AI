/**
 * Two ways a run keeps moving when one step gets stuck:
 *
 *  1. Split a step that is too big. When the coder runs out of actions (its turn budget) on a step twice, the step is
 *     replaced by two to four smaller steps, each changing one or two files, chained in order. The planner model
 *     proposes the parts; if it can't, the step's own sentences become the parts.
 *  2. Don't hold back independent steps. Planners often chain steps one after another ("1 → 2 → 3") even when they
 *     change different files. When a step is stuck, a later step that touches none of its files (and doesn't name
 *     them) no longer waits on it and runs anyway.
 */
import type { Task } from "@flowcode/contracts";

/** How many attempts of a step ended with the coder out of actions (from the step's recorded findings). */
export function budgetOuts(findings: string[]): number {
  return findings.filter((f) => /budget_exhausted|turn budget of \d+ exhausted/i.test(f)).length;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");
const overlaps = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (x === "." || y === "." || x === "" || y === "") return true;
  if (x === y) return true;
  const dirX = x.endsWith("/") ? x : `${x}/`;
  const dirY = y.endsWith("/") ? y : `${y}/`;
  return y.startsWith(dirX) || x.startsWith(dirY);
};

/** Files a step touches or plans to touch, including the paths its checks read. */
function pathsOf(t: Task): string[] {
  const checks = t.acceptanceCriteria.map((c) => ("path" in c.check ? (c.check as { path?: string }).path : undefined)).filter((p): p is string => !!p);
  return [...new Set([...t.expectedPaths, ...t.actualPaths, ...checks])];
}

/**
 * True when `later` doesn't need `stuck`: no shared files (either way, directories included) and `later` doesn't name
 * any of `stuck`'s files. Conservative: anything unclear keeps the dependency.
 */
export function independentOf(later: Task, stuck: Task, exists?: (path: string) => boolean): boolean {
  const mine = pathsOf(later);
  const theirs = pathsOf(stuck);
  if (!mine.length || !theirs.length) return false;
  // A stuck step that was to create files: later steps may import them without naming them.
  if (exists && theirs.some((p) => !p.endsWith("/") && /\.\w+$/.test(p) && !exists(p))) return false;
  // Steps that put earlier work together (assemble, wire, connect, integrate) need it, whatever files they list.
  if (/\b(assembl|wir(e|ing)|connect|integrat|hook up|combine)\w*/i.test(`${later.title} ${later.objective}`)) return false;
  if (mine.some((a) => theirs.some((b) => overlaps(a, b)))) return false;
  const text = `${later.title}\n${later.objective}`.toLowerCase();
  for (const p of theirs) {
    const file = norm(p).split("/").pop() ?? "";
    if (file && file.includes(".") && text.includes(file.toLowerCase())) return false;
  }
  return true;
}

/**
 * Lets steps go ahead when the only thing holding them is a stuck step they don't need. Returns the updated steps
 * (to save) and a plain note for each.
 */
export function releaseIndependent(tasks: Task[], exists?: (path: string) => boolean): { updates: Task[]; notes: string[] } {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  const stuck = (t: Task | undefined) => !!t && (t.status === "blocked" || t.status === "failed");
  const updates = new Map<string, Task>();
  const notes: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of byId.values()) {
      if (!["pending", "attempted", "invalidated"].includes(t.status)) continue;
      // Replace each stuck prerequisite this step doesn't need with that prerequisite's own prerequisites.
      let deps = t.dependsOn;
      for (const d of t.dependsOn) {
        const dep = byId.get(d);
        if (!stuck(dep) || !independentOf(t, dep!, exists)) continue;
        deps = [...new Set([...deps.filter((x) => x !== d), ...dep!.dependsOn])].filter((x) => x !== t.id);
        notes.push(`"${t.title}" doesn't need "${dep!.title}" (they change different files), so it goes ahead.`);
      }
      // A step paused only because of an earlier step goes back to waiting once nothing it needs is stuck.
      const reopen = t.status === "invalidated" && t.blocker?.category === "prerequisite" && !deps.some((d) => stuck(byId.get(d)) || byId.get(d)?.status === "invalidated");
      if (deps !== t.dependsOn || reopen) {
        const next: Task = { ...t, dependsOn: deps, ...(reopen ? { status: "pending" as const, blocker: undefined } : {}) };
        byId.set(t.id, next);
        updates.set(t.id, next);
        changed = true;
      }
    }
  }
  return { updates: [...updates.values()], notes: [...new Set(notes)] };
}

export interface SplitPart {
  title: string;
  objective: string;
  files: string[];
  /** Titles of the step's acceptance tests this part makes pass (see partTestsKind). */
  tests?: string[];
}

/** Validates the planner's proposed parts against the project's files. */
export function parseSplit(raw: unknown, task: Task, files: string[], titles: string[] = []): SplitPart[] | undefined {
  const steps = (raw as { steps?: unknown })?.steps;
  if (!Array.isArray(steps)) return undefined;
  const known = new Set(files.map(norm));
  const parts = steps
    .map((s) => s as { title?: unknown; objective?: unknown; files?: unknown; tests?: unknown })
    .filter((s) => typeof s.title === "string" && typeof s.objective === "string" && Array.isArray(s.files))
    .map((s) => ({
      title: String(s.title).trim().slice(0, 140),
      objective: String(s.objective).trim().slice(0, 1500),
      // Existing files, or new files under src/ (a part may add a component).
      files: (s.files as unknown[]).map((f) => norm(String(f))).filter((f) => known.has(f) || /^src\/[\w./-]+\.\w+$/.test(f)).slice(0, 2),
      // Only titles that are really in the step's test file.
      tests: Array.isArray(s.tests) ? (s.tests as unknown[]).map((t) => String(t).trim()).filter((t) => titles.includes(t)) : [],
    }))
    .filter((s) => s.title && s.objective.length >= 15 && s.files.length)
    // The starter kit's building blocks already use the design tokens and aren't edited by steps: a part that would
    // only change them has nothing to do (Calendar test 8: "Style components with design tokens" read the kit 90 times).
    .filter((s) => !s.files.every((f) => /^src\/components\/ui\//.test(f)));
  if (parts.length < 2 || parts.length > 4) return undefined;
  if (parts.every((p) => p.objective === task.objective)) return undefined;
  return parts;
}

/** Fallback when the planner can't split: one part per sentence of the step (the last sentence often applies to all). */
export function sentenceSplit(task: Task): SplitPart[] | undefined {
  const sentences = task.objective
    .split(/(?<=[.;])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
  if (sentences.length < 2) return undefined;
  const general = /^(keep|make sure|do not|don't|never|always|use only|take every)\b/i;
  const rules = sentences.filter((s) => general.test(s));
  const work = sentences.filter((s) => !general.test(s)).slice(0, 4);
  if (work.length < 2) return undefined;
  return work.map((s) => ({ title: s.replace(/[.;]$/, "").slice(0, 120), objective: [s, ...rules].join(" "), files: task.expectedPaths.filter((p) => !p.endsWith("/")).slice(0, 2) }));
}

/**
 * The smaller steps that replace `task`, chained in order. The step's file checks go to the part that changes that
 * file (else the last part); every part keeps the type check.
 */
export function buildSplit(task: Task, parts: SplitPart[], newId: () => string): Task[] {
  const ids = parts.map(() => newId());
  const fileChecks = task.acceptanceCriteria.filter((c) => c.check.type !== "manual" && "path" in c.check);
  // The step's own checks that aren't about one file (its acceptance tests passing, a build) belong to the last part:
  // the split step is done only when they pass. Calculator app: the parts kept only the type check, so "…then verify"
  // passed without running the step's acceptance tests.
  const wholeStep = task.acceptanceCriteria.filter((c) => c.check.type === "verification" && c.check.kind !== "typecheck");
  return parts.map((p, i) => {
    const last = i === parts.length - 1;
    const mine = [...fileChecks.filter((c) => p.files.includes(norm((c.check as { path: string }).path)) || (last && !parts.some((q) => q.files.includes(norm((c.check as { path: string }).path))))), ...(last ? wholeStep : [])];
    // An earlier part is done when its own share of the step's acceptance tests passes.
    const testFile = wholeStep.map((c) => (c.check as { kind: string }).kind).find((k) => k.startsWith("tests:"))?.slice("tests:".length);
    if (!last && testFile && p.tests?.length) mine.push({ id: `${task.id}-tests`, description: `This part's acceptance tests pass (${p.tests.length} of the step's tests)`, check: { type: "verification", kind: partTestsKind(testFile, p.tests) } } as (typeof mine)[number]);
    return {
      id: ids[i],
      runId: task.runId,
      title: p.title,
      objective: `${p.objective}\n\nThis is part ${i + 1} of ${parts.length} of the step "${task.title}". Work on ${p.files.join(" and ")} in this part; the other parts handle the rest of: ${task.objective}

If this part's checks can't pass because of the step's acceptance test file or a file an earlier part made (a test that can't load, a token that is missing), fix that file too: it is part of this step. Don't weaken what a test checks.`,
      status: "pending" as const,
      dependsOn: i === 0 ? task.dependsOn : [ids[i - 1]],
      expectedPaths: p.files,
      actualPaths: [],
      acceptanceCriteria: [
        ...mine.map((c) => ({ ...c, id: `${c.id}-p${i + 1}`, evidenceRefs: [] })),
        { id: `${task.id}-p${i + 1}-tc`, description: "The project still type-checks after this part", check: { type: "verification" as const, kind: "typecheck" }, evidenceRefs: [] },
      ],
      validationPlan: task.validationPlan,
      role: task.role,
      specSections: task.specSections,
      ordinal: task.ordinal + i + 1,
      attempts: 0,
    } as Task;
  });
}

/**
 * A coder that reports itself blocked for something that is part of its own job: a file the step should create,
 * failing checks it should fix, or a check that wasn't rerun because nothing changed. Returns what to tell it on the
 * next attempt, or undefined when the block looks genuine (a decision only the user can make, a missing secret…).
 */
export function selfBlockIsWork(reason: string): string | undefined {
  const r = reason.toLowerCase();
  // The building blocks always exist in a FlowCode starter; "not found" means the search looked in the wrong place
  // (Calendar test 5: a folder used as a search glob). Creating them again would duplicate the kit.
  if (/\b(appshell|pageheader|building blocks?|components\/ui|ui components?)\b/.test(r) && /\b(not (be )?found|could not find|couldn't find|not present|missing|do(es)? not exist|don't exist)\b/.test(r))
    return "You stopped because the building blocks seemed missing. They exist: src/components/ui/index.tsx exports AppShell, PageHeader, Section, Card, Button, Field, EmptyState and the rest (screen parts come from src/components/ui/screen-parts.tsx through the same index). Read src/components/ui/index.tsx with read_file, import them from \"./components/ui\" in src/App.tsx (\"../components/ui\" from src/screens/), and continue. Don't create them again.";
  if (/\b(does not exist|doesn't exist|not found|no such file|missing)\b/.test(r) && /\b(create|created|needs? to be|should be|add)\b/.test(r))
    return "You stopped because a file doesn't exist yet. Creating it is part of this step: use create_file to make it, then continue.";
  if (/\b(not (be )?(run|rerun)|was not run again|no progress|policy|permission|not allowed|restriction)/.test(r) && /\b(typecheck|type-check|type check|lint|test|build|check)\b/.test(r))
    return "You stopped because a check wasn't rerun. That isn't a permission problem: it only reruns after a file changes. Read the errors it reported, fix them in the files they name, then run the check again.";
  // "It's already done" is not a block: finishing lets the step's checks decide (Calendar test 3, the layout step).
  // Calendar test 7 ("Add Today Control"): "the patch … is already correct. No further changes needed" while the
  // step's type check still failed in another file.
  if (/\balready (been )?(implemented|done|built|exists?|in place|complete|present|set up|there|correct|fixed|applied|working)\b|nothing (left |more )?to (do|change|fix)|no (further |more |other )?(changes?|work|edits?|fix(es)?) (is |are )?(needed|required|necessary)/.test(r))
    return "You stopped because you think this step is already done. That isn't a block: read the files the step names, add anything the step asks for that is still missing (for example screen components), then call task_complete so the step's checks run. If a check fails, fix what it names.";
  // Components from another UI library (shadcn's DialogContent…) refused: the kit's own one is the fix (Calendar
  // test 7, Event Creation Dialog: refused three times, then reported its own refused components as the blocker).
  if (/\b(dialogcontent|dialogheader|dialogtitle|dialogfooter|shadcn|radix)\b|another ui library|(aren'?t|are not|isn'?t|is not|not) (building blocks?|a building block|available|part of (the|this) (kit|project))/.test(r))
    return "You stopped because the components you used aren't in this project. Use the kit's own instead, imported from \"../components/ui\" (from src/screens/ or src/components/): the Dialog is ONE component, <Dialog open={open} title=\"New event\" onClose={close} actions={<><Button onClick={close}>Cancel</Button><Button variant=\"primary\" type=\"submit\" form=\"event-form\">Save</Button></>}><form id=\"event-form\" onSubmit={save}><Field label=\"Title\">{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />}</Field></form></Dialog>. No DialogContent, DialogHeader, DialogTitle or DialogFooter. Rewrite the file with replace_file, then run the checks.";
  // "The file has duplicate code that needs removing" is the fix itself (Calendar test 7, layout step).
  if (/\bduplicat\w*\b/.test(r) && /\b(code|block|declar\w*|definition|function|import|component|copy|copies)\b/.test(r))
    return "You stopped because a file has its code in twice. Removing the copy is part of this step: read the file, then write it once with replace_file (one import block, one copy of each function and component, one export default) and say \"remove the duplicate\" in the reason. Then run the checks again.";
  // "Rename them to .tsx" is the fix itself, not a reason to stop (Calendar test 6, month view step).
  if (/\brename\w*\b/.test(r) && /\.(jsx?|tsx)\b/.test(r))
    return "You stopped because files need renaming. That isn't a block: rename each one with move_file (from \"src/…/Name.js\" to \"src/…/Name.tsx\"), then run the checks again. Imports without an extension keep working.";
  // Edits that change nothing (No GMO App, Home screen step): the model resent the code that was already there.
  // "…is not making changes because the find and replace text are identical" (Calendar test 7, URL state step).
  if (/\b(no changes?|not (producing|making|changing) (any ?)?(thing|changes?)|produced no change|changed nothing|didn'?t change|does(n'?t| not) change|(find|replace) (and|text) .*identical|identical (find|text))\b/.test(r) && /\b(patch|edit|apply|file|find|replace)\w*\b/.test(r))
    return "You stopped because your patches changed nothing: the replace text was the same as the code already in the file. That isn't a block. Read the error you are fixing again (run the check if needed), then put the corrected code in \"replace\": for example the right import path (\"./lib/…\" from src/App.tsx, \"../lib/…\" from src/screens/) or the right prop type. If that file is already correct, fix the file the error names instead.";
  // Edits that keep missing the file: the fix is to re-read it, not to stop.
  if (/\b(patch|edit|find text|apply)\w*\b.*\b(fail|failed|failure|miss|mismatch|cannot|can't|not found)\b|\b(cannot|can't|unable to) (apply|patch|edit)\b|re-?read the file|has not been re-?read|adjust (the |my )?approach|different approach/.test(r))
    return "You stopped because your edits kept missing. Read the file again with read_file. If it is short, write the whole corrected file with replace_file; otherwise copy the find text exactly from what you just read, with a neighbouring line so it is unique. Then continue.";
  if (/\b(typecheck|type-check|type check|compile|ts\d{4}|lint|test)s?\b.*\b(fail|error)/.test(r))
    return "You stopped because checks fail. Fixing them is part of this step: read the errors, fix them in the files they name, and run the check again.";
  // Only something the user has to settle is a real block: a decision, a missing secret or account, outside access.
  // Everything else a coder reports ("the patch inserts instead of replacing", "the file is wrong") is still the
  // step's work, and the next attempt can go to the stronger model (Calendar test 7: four blockers in one evening,
  // each a new wording of "my edit didn't work").
  if (needsUser(r)) return undefined;
  return "You stopped, but that is something this step can still do. Read the files involved again with read_file, then fix the code directly: write the whole file with replace_file if your patches keep missing. Fix the errors the checks name, in the files they name, and run the checks again.";
}

/** A block only the user can clear: a choice the spec doesn't make, a key or account, access FlowCode doesn't have. */
export function needsUser(reason: string): boolean {
  return /\b(api[ -]?keys?|secrets?|credentials?|passwords?|access tokens?|accounts?|sign[ -]?(up|in) (to|with|for)|payments?|billing|licen[cs]e|which (one|option|approach)|(user|you) (to )?(decide|choose|confirm)|needs? (a |your )?decision|decide (whether|which|how)|unclear|ambiguous|clarif\w*|doesn'?t say (whether|which|how)|not specified|ask the user|user'?s? (input|decision|approval)|permission from|network access|internet access|outside (the )?(workspace|project)|hardware|physical device)\b/.test(reason.toLowerCase());
}

/**
 * FlowCode's own guards (reading without changing anything, the same failing call again and again) end an attempt
 * with "No progress: …". When they stop the same step twice, the guard may be what's wrong rather than the app
 * (Calendar prototype: searches all counted as one file, so the layout step was stopped three times while it
 * explored the PRD). Then the step gets one attempt with the guard relaxed, and the incident is recorded so the
 * person can report it.
 */
export const GUARD_STOP = /agent outcome: no_action \(No progress:/;
export const guardStops = (findings: string[]) => findings.filter((f) => GUARD_STOP.test(f)).length;
/** The guard's own words, for the notice: "18 reads in a row and no change made" and the like. */
export const guardOf = (findings: string[]) => (findings.filter((f) => GUARD_STOP.test(f)).pop() ?? "").replace(/^agent outcome: no_action \(No progress: /, "").replace(/\)$/, "").replace(/\. Either the step.*$/, "").slice(0, 160);

/** Where FlowCode keeps the times its own limits stopped a step (System Health → Stuck steps). */
export const FLOWCODE_LIMITS_KEY = "flowcodeLimits";
export interface FlowCodeLimitHit {
  at: string;
  runId: string;
  projectId: string;
  taskId: string;
  step: string;
  guard: string;
  model?: string;
}

/** The test titles in an acceptance test file (`it("…")` and `test("…")`), in order. */
export function testTitles(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/\b(?:it|test)(?:\.(?:only|skip))?\(\s*(["'`])((?:\\.|(?!\1).)+?)\1/g)) {
    const t = m[2].replace(/\\(["'`\\])/g, "$1").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * A split part's own acceptance tests: the check kind "tests:<file>::<title>||<title>" runs the step's whole test
 * file and passes when none of these titles failed. Earlier parts used to have no test check at all, so they were
 * marked done with their work unfinished and the last part inherited every failing test (Calendar prototype: the
 * last of four parts faced 26 of 35 failing tests).
 */
export const partTestsKind = (file: string, titles: string[]) => `tests:${file}::${titles.join("||")}`;
export function parsePartTests(kind: string): { file: string; titles?: string[] } {
  const body = kind.slice("tests:".length);
  const at = body.indexOf("::");
  return at < 0 ? { file: body } : { file: body.slice(0, at), titles: body.slice(at + 2).split("||").filter(Boolean) };
}

/**
 * A step whose latest test run nearly all passed is close, not wrong: its work is kept when it stops so a retry carries
 * on from there (Calendar design rebuild: 28 of 29 passing, and undoing it threw away 16 file changes).
 */
export function nearlyPassing(t: { failed: number; passed: number }): boolean {
  return t.failed > 0 && t.failed <= 3 && t.passed / (t.passed + t.failed) >= 0.85;
}

/** What a repair step adds for each missing state, and the text that proves it is there. */
const STATE_MARKERS: Record<string, { text: string; how: string }> = {
  error: { text: `role="alert"`, how: `an error state: a message that says what went wrong in plain words, in an element with role="alert", and a Try again button` },
  loading: { text: "aria-busy", how: `a loading state: the Skeleton from src/components/ui shaped like the content, in a container with aria-busy="true" while it loads` },
  empty: { text: "EmptyState", how: "an empty state: the EmptyState from src/components/ui with what to do first" },
};

/**
 * A screen state the final design check requires but no step planned (Kids cash app: every step passed, then the build
 * stopped at the very end because no screen had an error state, with nothing left to retry). FlowCode adds one step
 * that adds the missing states to the screen that shows data, checked by the exact text the design check looks for.
 */
export function stateRepairTask(
  screens: Array<{ path: string; text: string }>,
  missing: string[],
  run: { id: string },
  after: Task | undefined,
  ordinal: number,
  newId: () => string,
): Task | undefined {
  const states = missing.filter((s) => STATE_MARKERS[s]);
  if (!states.length || !screens.length) return undefined;
  // The screen that already has the other states (it shows data), else the one with the most code.
  const target = [...screens].sort((a, b) => (/aria-busy|Skeleton|EmptyState|length === 0/.test(b.text) ? 1 : 0) - (/aria-busy|Skeleton|EmptyState|length === 0/.test(a.text) ? 1 : 0) || b.text.length - a.text.length)[0]!;
  const id = newId();
  return {
    id,
    runId: run.id,
    title: "Add the missing screen states",
    objective: `The final design check found no designed ${states.join(" or ")} state in the app's screens. In ${target.path}, add ${states.map((s) => STATE_MARKERS[s]!.how).join("; and ")}. Show each state only when it applies (for example, the error state when the data can't be shown), keep the screen's real content, and use the design tokens.`,
    status: "pending",
    dependsOn: after ? [after.id] : [],
    expectedPaths: [target.path],
    actualPaths: [],
    acceptanceCriteria: [
      ...states.map((s, i) => ({ id: `${id}-s${i}`, description: `${target.path} has a designed ${s} state`, check: { type: "file_contains" as const, path: target.path, text: STATE_MARKERS[s]!.text }, evidenceRefs: [] })),
      { id: `${id}-tc`, description: "The project still type-checks after this step", check: { type: "verification" as const, kind: "typecheck" }, evidenceRefs: [] },
    ],
    validationPlan: after?.validationPlan ?? ({ checks: [] } as unknown as Task["validationPlan"]),
    role: "coder",
    ordinal,
    attempts: 0,
  } as Task;
}
