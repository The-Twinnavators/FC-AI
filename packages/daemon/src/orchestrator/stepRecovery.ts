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
import { deliverableChecks, type DeliverableContext, genericOnly } from "./taskContract.js";

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
    .filter((s) => s.title && s.objective.length >= 15 && !partProblems(s, task.objective).length)
    // The starter kit's building blocks already use the design tokens and aren't edited by steps: a part that would
    // only change them has nothing to do (Calendar test 8: "Style components with design tokens" read the kit 90 times).
    .filter((s) => !s.files.every((f) => /^src\/components\/ui\//.test(f)));
  if (parts.length < 2 || parts.length > 4) return undefined;
  if (parts.every((p) => p.objective === task.objective)) return undefined;
  return parts;
}

/** Fallback when the planner can't split: one part per sentence of the step (the last sentence often applies to all). */
/**
 * Why a proposed part can't be run as a step of its own (empty when it can): it has no files to change, or its
 * objective is only text copied from the step it came from, naming none of its files (Clean Cart slice eval 1: a part
 * with no files whose objective was the step's first sentence ran out of turns twice and blocked the build).
 */
/** A file this long gets a part of its own when a step is split. */
export const LONG_FILE_LINES = 200;

export function partProblems(p: SplitPart, parentObjective: string, linesOf?: (file: string) => number): string[] {
  const out: string[] = [];
  // A part works on what fits one request whole: two long files together are the too-broad step again (the slice's
  // design step: tokens.css and components.css, 284 and 283 lines, didn't fit with the rest; a part isn't split again).
  const long = linesOf ? p.files.filter((f) => linesOf(f) > LONG_FILE_LINES) : [];
  if (long.length > 1) out.push(`"${p.title}" has more than one long file (${long.join(", ")}); give each its own part`);
  if (!p.files.length) out.push(`"${p.title}" has no files to change`);
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const namesAFile = p.files.some((f) => p.objective.toLowerCase().includes(f.toLowerCase()) || p.objective.toLowerCase().includes(f.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase()));
  // The step's own summary (its first sentence) isn't a part's work; a later, specific sentence of it can be.
  const firstOf = (s: string) => flat(s.split(/(?<=[.;:])\s+(?=[A-Z])|\n/)[0] ?? "");
  if (!namesAFile && firstOf(p.objective) === firstOf(parentObjective)) out.push(`"${p.title}" only repeats the step's own summary and names none of its files`);
  return out;
}

export function sentenceSplit(task: Task, targets: string[] = task.expectedPaths.filter((p) => !p.endsWith("/"))): SplitPart[] | undefined {
  const sentences = task.objective
    .split(/(?<=[.;])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
  if (sentences.length < 2) return undefined;
  const general = /^(keep|make sure|do not|don't|never|always|use only|take every)\b/i;
  const rules = sentences.filter((s) => general.test(s));
  const work = sentences.filter((s) => !general.test(s)).slice(0, 4);
  if (work.length < 2) return undefined;
  // Each sentence gets the step's files it names; one that names none has nothing concrete to do on its own.
  const named = (s: string) => targets.filter((f) => s.toLowerCase().includes(f.toLowerCase()) || s.toLowerCase().includes(f.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase())).slice(0, 2);
  // A sentence naming none gets the step's own files when there are one or two of them (a sub-task on the same file).
  const parts = work.map((s) => ({ title: s.replace(/[.;]$/, "").slice(0, 120), objective: [s, ...rules].join(" "), files: named(s).length ? named(s) : targets.length <= 2 ? targets : [] })).filter((p) => p.files.length);
  return parts.length >= 2 ? parts : undefined;
}

/**
 * The smaller steps that replace `task`, chained in order. The step's file checks go to the part that changes that
 * file (else the last part); every part keeps the type check.
 */
/** The files that can satisfy the frame check: the app's resolved frame and the stylesheet its rules live in. */
const frameFiles = (ctx: DeliverableContext) => [...(ctx.frame ? [norm(ctx.frame.file)] : []), "src/styles/components.css"];

/** Workspace paths an objective names outright (src/…/File.ext). */
const namedPaths = (text: string) => [...new Set([...text.matchAll(/\bsrc\/[\w./-]+\.(?:tsx?|jsx?|css|scss|json)\b/g)].map((m) => norm(m[0])))];

/** Whether a part's objective is the parent step's own text (copied whole, or its opening), not a part's work. */
export function copiesParent(objective: string, parent: string): boolean {
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const o = flat(objective);
  const p = flat(parent);
  return p.length > 0 && (o.includes(p.slice(0, Math.min(150, p.length))) || o.length >= p.length * 0.8);
}

/**
 * A part's own objective from the parent step's text: the clauses that name its files (Clean Cart slice eval 2: part 1
 * carried the whole step's objective, pages and frame included, and worked on two screens of it).
 */
export function ownObjective(parent: string, files: string[]): string {
  const stems = files.map((f) => f.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase());
  const clauses = parent
    .split(/\n+|(?<=[.;:])\s+|,\s+(?=[A-Z])/)
    .map((c) => c.trim().replace(/^[-•]\s*/, ""))
    .filter((c) => c.length >= 8 && (files.some((f) => c.includes(f)) || stems.some((st) => c.toLowerCase().includes(st))));
  const unique = [...new Set(clauses.map((c) => c.replace(/[.;:,]+$/, "")))].slice(0, 8);
  return `Work on ${files.join(" and ")}${unique.length ? `: ${unique.join("; ")}` : ", as the step asks for them"}.`;
}

/** `asWritten`: parts FlowCode wrote from its own plan (designParts.ts) keep their objective and exact files. */
export function buildSplit(task: Task, input: SplitPart[], newId: () => string, ctx: DeliverableContext = {}, opts: { asWritten?: boolean } = {}): Task[] {
  // Each part's files include the ones its objective names outright, and its objective is its own, not the step's.
  let parts = input.map((p) => {
    if (opts.asWritten) return { ...p, files: p.files.map(norm) };
    const objective = copiesParent(p.objective, task.objective) ? ownObjective(task.objective, p.files) : p.objective;
    return { ...p, objective, files: [...new Set([...p.files.map(norm), ...namedPaths(objective)])] };
  });
  // The frame check goes to the part that can pass it: the one holding the frame or its stylesheet; else the part about
  // the look gets the stylesheet (Clean Cart slice eval 2: a screens-only part held it and couldn't finish).
  const frameCheck = task.acceptanceCriteria.some((c) => c.check.type === "verification" && c.check.kind === "frame-designed");
  let frameAt = parts.findIndex((p) => p.files.some((f) => frameFiles(ctx).includes(f)));
  if (frameCheck && frameAt < 0) {
    const look = parts.findIndex((p) => /\b(frame|navigation|top bar|look|styles?|tokens?|colou?rs?|theme)\b/i.test(`${p.title} ${p.objective}`));
    frameAt = look >= 0 ? look : parts.length - 1;
    parts = parts.map((p, i) => (i === frameAt ? { ...p, files: [...p.files, "src/styles/components.css"] } : p));
  }
  // The records check goes to the part with the app's data file, else the last part.
  const dataAt = (() => {
    const i = parts.findIndex((p) => p.files.includes("src/app/schema.ts"));
    return i >= 0 ? i : parts.length - 1;
  })();
  const ids = parts.map(() => newId());
  const fileChecks = task.acceptanceCriteria.filter((c) => c.check.type !== "manual" && "path" in c.check);
  // The step's own checks that aren't about one file (its acceptance tests passing, a build) belong to the last part:
  // the split step is done only when they pass. Calculator app: the parts kept only the type check, so "…then verify"
  // passed without running the step's acceptance tests. The frame and records checks go where they can pass.
  const kindOf = (c: (typeof task.acceptanceCriteria)[number]) => (c.check as { kind?: string }).kind ?? "";
  const wholeStep = task.acceptanceCriteria.filter((c) => c.check.type === "verification" && c.check.kind !== "typecheck");
  return parts.map((p, i) => {
    const last = i === parts.length - 1;
    const placed = wholeStep.filter((c) => (kindOf(c) === "frame-designed" ? i === frameAt : kindOf(c) === "data-source" ? i === dataAt : last));
    const mine = [...fileChecks.filter((c) => p.files.includes(norm((c.check as { path: string }).path)) || (last && !parts.some((q) => q.files.includes(norm((c.check as { path: string }).path))))), ...placed];
    // An earlier part is done when its own share of the step's acceptance tests passes.
    const testFile = wholeStep.map((c) => (c.check as { kind: string }).kind).find((k) => k.startsWith("tests:"))?.slice("tests:".length);
    if (!last && testFile && p.tests?.length) mine.push({ id: `${task.id}-tests`, description: `This part's acceptance tests pass (${p.tests.length} of the step's tests)`, check: { type: "verification", kind: partTestsKind(testFile, p.tests) } } as (typeof mine)[number]);
    const criteria = [
      ...mine.map((c) => ({ ...c, id: `${c.id}-p${i + 1}`, evidenceRefs: [] })),
      { id: `${task.id}-p${i + 1}-tc`, description: "The project still type-checks after this part", check: { type: "verification" as const, kind: "typecheck" }, evidenceRefs: [] },
    ] as Task["acceptanceCriteria"];
    // A part with only the type check would pass whether or not it did its work: it gets its own deliverable's checks.
    const own = { id: ids[i]!, title: p.title, objective: p.objective, expectedPaths: p.files };
    // Never the frame check on a part that can't pass it (it has its place above).
    if (genericOnly({ acceptanceCriteria: criteria })) criteria.push(...deliverableChecks(own, ctx).filter((c) => (c.check as { kind?: string }).kind !== "frame-designed" || i === frameAt));
    return {
      id: ids[i],
      runId: task.runId,
      title: p.title,
      // The part's own work, then a short summary of the step it belongs to and what the other parts do: the full step
      // text (6,000 characters in Clean Cart) crowded out the part's files and requirements.
      objective: [
        p.objective,
        `This is part ${i + 1} of ${parts.length} of the step "${task.title}" (${parentSummary(task.objective)}). Work on ${p.files.join(" and ")} in this part; the other parts: ${parts.filter((q) => q !== p).map((q) => `"${q.title}"`).join(", ")}.`,
        testFile
          ? "If this part's checks can't pass because of the step's test file or a file an earlier part made (a test that can't load, a token that is missing), fix that file too: it is part of this step. Don't weaken what a test checks."
          : "If this part's checks can't pass because of a file an earlier part made (a token that is missing), fix that file too: it is part of this step.",
      ].join("\n\n"),
      status: "pending" as const,
      dependsOn: i === 0 ? task.dependsOn : [ids[i - 1]],
      expectedPaths: p.files,
      actualPaths: [],
      acceptanceCriteria: criteria,
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

/**
 * One attempt's failure, reduced to what makes it that failure. Counts, line numbers, paths and quoted snippets change
 * between attempts without the failure being any different ("renders <X> 5 times" then "7 times"), so they are dropped,
 * and the order of several failures is ignored.
 */
export function failureSignature(why: string[]): string {
  return why
    .map((w) =>
      w
        .toLowerCase()
        .replace(/["'`][^"'`]*["'`]/g, "-")
        .replace(/\b[\w./\\-]+\.(tsx?|jsx?|css|scss|json|html)\b/g, "-")
        .replace(/\d+/g, "#")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160),
    )
    .filter(Boolean)
    .sort()
    .join(" | ");
}

/**
 * Two attempts in a row that ended the same way. Every attempt after the first runs as the debugger, which is the
 * largest single cost in a build, so a retry that produces the identical complaint is paying that cost for nothing:
 * the step stops and asks instead of spending the rest of its budget on the same wall.
 */
/**
 * Whether to stop a step at a wall it has already hit twice. A guard stop that has just earned the step one attempt
 * with that guard relaxed is not such a wall: that attempt is the whole point of the relaxation, and stopping first
 * means it never runs (Money Tapp: "App layout and navigation" ended at 9 reads in a row with its relaxed retry
 * unspent).
 */
export function stopAtSameWall(attempts: number, signatures: string[], guardHits: number): boolean {
  return attempts >= 2 && guardHits !== 2 && sameFailureTwice(signatures);
}
export function sameFailureTwice(signatures: string[]): boolean {
  const n = signatures.length;
  if (n < 2) return false;
  const last = signatures[n - 1];
  return !!last && last === signatures[n - 2];
}
/** Where FlowCode keeps the times its own limits stopped a step (System → Stuck steps). */
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

const SKIP_WORDS = new Set(["the", "and", "with", "this", "that", "from", "your", "into", "for", "its", "page", "section", "step", "home"]);
const titleWords = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 2 && !SKIP_WORDS.has(w)).map((w) => w.replace(/ies$/, "y").replace(/s$/, ""));

/**
 * Leaves out parts a finished step already did: every word of the part's title is in that step's title (Clean Cart:
 * "Landing page" was split and one part was "Add How it works to Home", after "Add How it works and Why you can trust
 * it to Home" had passed). A part that owns acceptance tests stays, and at least one part always does.
 */
export function dropDoneParts(parts: SplitPart[], doneTitles: string[]): SplitPart[] {
  const done = doneTitles.map((t) => new Set(titleWords(t)));
  const repeats = (p: SplitPart) => {
    const w = titleWords(p.title);
    return !p.tests?.length && w.length >= 2 && done.some((d) => w.every((x) => d.has(x)));
  };
  const kept = parts.filter((p) => !repeats(p));
  return kept.length ? kept : parts.slice(-1);
}

/**
 * How many turns a step's agent gets. A step that writes an acceptance-test file reads the sample data and screens,
 * then writes many tests at once: 30 turns ran out four times on Clean Cart's 24 Home tests (twice on a cloud model)
 * before the file was written. Every other step keeps 30.
 */
export function turnBudget(task: Pick<Task, "acceptanceCriteria">): number {
  const writesTests = task.acceptanceCriteria.some((c) => {
    const check = c.check as { type?: string; kind?: string; path?: string };
    return (check.kind ?? "").startsWith("tests:") || (check.type === "file_exists" && /(^|\/)(acceptance|__tests__|tests?)\/.*\.(test|spec)\.[jt]sx?$/.test(check.path ?? ""));
  });
  return writesTests ? 50 : 30;
}

/** A step's objective in one short sentence (its first), for the parts it was split into. */
export function parentSummary(objective: string, max = 240): string {
  const first = objective.split(/\n/)[0]!.split(/(?<=[.!?])\s+/)[0]!.trim();
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/**
 * A part written before parts carried a short summary: "…the other parts handle the rest of: <the whole step>" becomes
 * the part's own work plus one sentence of the step. Other objectives are returned as they are.
 */
export function compactPartObjective(objective: string, files: string[] = []): string {
  const m = /^([\s\S]*?This is part \d+ of \d+ of the step "[^"]+")\. (Work on [^;]+); the other parts handle the rest of: ([\s\S]*)$/.exec(objective);
  if (!m) return objective;
  const tail = m[3]!.split(/\n\nIf this part's checks can't pass/)[0]!;
  const rule = /\n\n(If this part's checks can't pass[\s\S]*)$/.exec(m[3]!)?.[1];
  // The step's sections about this part's own screens stay (its brief: "## Home (landing page)", sections top to bottom).
  const stems = files.filter((f) => /src\/screens\//.test(f)).map((f) => f.replace(/^.*\//, "").replace(/(Screen|Page)?\.\w+$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(" ")[0]!).filter((s) => s.length > 2);
  const blocks = stems.length ? [...tail.matchAll(/^## (.+)\n[\s\S]*?(?=^## |(?![\s\S]))/gm)].filter((b) => stems.some((s) => b[1]!.toLowerCase().startsWith(s))).map((b) => b[0].trim().slice(0, 1500)) : [];
  return `${m[1]} (${parentSummary(tail)}). ${m[2]}.${blocks.length ? `\n\nFrom that step, about this part's screen${blocks.length === 1 ? "" : "s"}:\n${blocks.join("\n\n")}` : ""}${rule ? `\n\n${rule}` : ""}`;
}
