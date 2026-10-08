import fs from "node:fs";
/**
 * Governed tool dispatcher for real runs (§8 "Governed Runtime"). Every tool call is mediated here:
 * scope checks, file-operation policy, approvals, snapshots and command policy. Agents never touch
 * the filesystem or processes directly.
 */
import path from "node:path";
import type { Approval, PreflightRecord, Project, Run, Task, ToolName } from "@flowcode/contracts";
import type { PathJail } from "../security/pathJail.js";
import { PolicyError } from "../security/pathJail.js";
import type { FileOperations, OpResult } from "../workspace/operations.js";
import type { CommandRunner } from "../commands/runner.js";
import type { ApprovalService } from "../approvals/service.js";
import type { ToolExecution } from "./agentLoop.js";
import { listTree, readFile, searchWorkspace, type TreeNode } from "../workspace/fileService.js";
import { scriptArgv } from "../workspace/preflight.js";
import { untrusted } from "./prompts.js";
import { exporterFile, importFixes, nearestFile, typeErrorHints } from "../quality/typeHints.js";
import { isRootScratch } from "../quality/cleanupScan.js";
import { findOpenImage } from "../workspace/openImages.js";
import { errorFile } from "../quality/verification.js";
import { renderLoopNote } from "./renderLoops.js";
import { afterEdit, syntaxGuard, testFailureDigest, buildingBlockImports, coverUpEdit, editGuard, nativeInWebApp, toTsPath, removesTokenInUse, workspaceTokenUsage, unredactLines } from "./guards.js";

export interface DispatchContext {
  project: Project;
  run: Run;
  task: Task;
  jail: PathJail;
  ops: FileOperations;
  runner: CommandRunner;
  approvals: ApprovalService;
  preflight: () => PreflightRecord | undefined;
  refreshPreflight: () => PreflightRecord;
  signal: AbortSignal;
  onPathsChanged: (paths: string[]) => void;
  onAwaitingApproval: (waiting: boolean) => void;
  /** Runs the task's acceptance criteria now (used when the agent claims completion). */
  verifyClaim?: () => Promise<{ allMet: boolean; failures: string[] }>;
  /** True when `rel` was created (did not exist before) earlier in this run. */
  createdInRun?: (rel: string) => boolean;
  /** Type errors added since the run started, checked right after a code edit so the agent fixes them in the same turn. */
  typeErrorsAfterEdit?: (paths: string[]) => Promise<string[]>;
  /** Called when the edits stop making progress (the same errors keep coming back): the step moves to a stronger model. */
  onNoProgress?: (reason: string) => void;
  phase: string;
  /** The project as it is now (settings change mid-step: "allow external research" turned on during a design step). */
  currentProject?: () => Project;
  /** Checks a candidate photo shows what was searched for (a vision model); find_image skips the ones that don't. */
  imageCheck?: (image: Buffer, query: string) => Promise<{ ok: boolean; reason: string }>;
}

/**
 * Records one edit's type errors and says whether the edits are going round in a circle: an error set that comes back
 * after a different one, or the same set three times. Line numbers are ignored (an edit moves them).
 */
export function errorCycle(history: string[], errors: string[]): boolean {
  const set = [...new Set(errors.map((l) => l.replace(/\(\d+,\d+\)/, "").trim()))].sort().join("\n");
  const seenBefore = history.filter((s) => s === set).length;
  const cycle = seenBefore >= 2 || (seenBefore >= 1 && history[history.length - 1] !== set);
  history.push(set);
  return cycle;
}

/** True when `rel` falls within the task's approved scope (exact path or under an expected directory). */
export function inScope(task: Task, relInput: string): boolean {
  // Compare normalized paths so "src/../package.json" cannot pass as "src/…".
  const rel = path.posix.normalize(relInput.replace(/\\/g, "/")).replace(/^\.\//, "");
  if (rel.startsWith("../") || rel === "..") return false;
  const scopes = task.expectedPaths.map((p) => path.posix.normalize(p.replace(/\\/g, "/")).replace(/^\.\//, "").replace(/\/$/, ""));
  // A task without declared paths has no pre-approved write scope: every write asks.
  if (scopes.length === 0) return false;
  // A planned "src/…/Thing.js" covers Thing.tsx / Thing.ts too (the TypeScript file the step should really make).
  const stem = (p: string) => p.replace(/\.(jsx?|tsx?)$/, "");
  return scopes.some((s) => s === "." || s === "" || rel === s || rel.startsWith(`${s}/`) || (/^src\/.+\.(jsx?|tsx?)$/.test(s) && /\.(jsx?|tsx?)$/.test(rel) && stem(rel) === stem(s)) || (s.includes("*") && new RegExp(`^${s.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/(?<!\.)\*/g, "[^/]*")}$`).test(rel)));
}

export function renderTree(node: TreeNode, indent = ""): string {
  const lines: string[] = [];
  for (const c of node.children ?? []) {
    lines.push(`${indent}${c.name}${c.type === "dir" ? "/" : ""}${c.secret ? "  [secret: access denied]" : ""}`);
    if (c.type === "dir" && c.children?.length) lines.push(renderTree(c, indent + "  "));
  }
  return lines.filter(Boolean).join("\n");
}

/** Files up to this size may be rewritten whole when patches keep missing (a small model can still write them). */
const MAX_REWRITE_LINES = 400;

/** Shell file commands models reach for, and the tool that does the job here. */
const SHELL_FILE_TOOLS: Record<string, string> = {
  mkdir: "Folders don't need making: create_file creates any missing folders. Create the file you need directly.",
  ls: 'Use list_files (e.g. list_files "src") to see what exists.',
  dir: 'Use list_files (e.g. list_files "src") to see what exists.',
  tree: 'Use list_files (e.g. list_files "src") to see what exists.',
  find: "Use list_files to see folders, or search_code to find text in files.",
  cat: "Use read_file to read a file.",
  type: "Use read_file to read a file.",
  head: "Use read_file to read a file.",
  tail: "Use read_file to read a file.",
  grep: "Use search_code to find text in files.",
  touch: "Use create_file to make a file (with its real content).",
  echo: "Use create_file or apply_patch to write to a file.",
  rm: "Use delete_file to remove a file.",
  del: "Use delete_file to remove a file.",
  mv: "Use move_file to move or rename a file.",
  cp: "Use copy_file to copy a file.",
  pwd: 'You are in the project root; paths are relative to it (e.g. "src/App.tsx").',
  cd: 'You are in the project root; paths are relative to it (e.g. "src/App.tsx"). There is no changing directory.',
};

/** The app's own component files (not tests), for the render-loop check before a test run. */
function sourceFiles(root: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= 400) return;
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(path.join(dir, e.name), `${rel}${e.name}/`);
      } else if (/\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
        try {
          out.push({ path: `${rel}${e.name}`, text: fs.readFileSync(path.join(dir, e.name), "utf8") });
        } catch {
          /* unreadable: skip */
        }
      }
    }
  };
  walk(path.join(root, "src"), "src/");
  return out;
}

export function createDispatcher(ctx: DispatchContext) {
  const ev = { projectId: ctx.project.id, runId: ctx.run.id, taskId: ctx.task.id };

  const awaitApproval = async (approval: Approval): Promise<Approval> => {
    ctx.onAwaitingApproval(true);
    try {
      return await ctx.approvals.wait(approval.id, ctx.signal);
    } finally {
      ctx.onAwaitingApproval(false);
    }
  };

  /** apply_patch misses per file in this attempt (drives the replace_file recovery path). */
  const patchMisses = new Map<string, number>();
  /** The type errors after each edit in this attempt, to notice when they start repeating. */
  const errorSets: string[] = [];
  /** Edits refused for leaving a file unable to parse, per file in this attempt. */
  const syntaxRefusals = new Map<string, number>();
  const mutate = async (name: ToolName, args: Record<string, unknown>, toolCallId: string): Promise<ToolExecution> => {
    // Scratch files (test results, logs, dumps) don't belong in the project root.
    if (name === "create_file" && typeof args.path === "string" && isRootScratch(args.path))
      return { ok: false, content: `${args.path} looks like scratch output, which doesn't belong in the project. Read test results from run_script's result instead of saving them, and keep notes in your reply.` };
    // create_file on a file that exists is a request to write the whole file: do it as replace_file, with that tool's
    // checks (Calculator app: gpt-5.6-sol kept rewriting its test file with create_file and was refused each time).
    if (name === "create_file" && typeof args.path === "string" && fs.existsSync(ctx.jail.resolve(args.path).abs)) {
      name = "replace_file";
      args = { ...args, reason: "rewritten in full (asked with create_file on an existing file)" };
    }
    // Text copied from redacted notes ("= [REDACTED] () =>") is put back to the file's real lines before any guard runs.
    if ((name === "apply_patch" || name === "replace_file") && JSON.stringify(args).includes("[REDACTED]")) {
      let current = "";
      try {
        current = fs.readFileSync(ctx.jail.resolve(String(args.path)).abs, "utf8");
      } catch {
        /* new file: nothing to restore from */
      }
      if (current) {
        if (name === "replace_file") args = { ...args, content: unredactLines(String(args.content ?? ""), current) };
        else if (Array.isArray(args.edits)) args = { ...args, edits: (args.edits as Array<Record<string, unknown>>).map((e) => ({ ...e, find: unredactLines(String(e.find ?? ""), current), replace: unredactLines(String(e.replace ?? ""), current) })) };
      }
    }
    const targets: string[] = name === "move_file" ? [String(args.from), String(args.to)] : name === "copy_file" ? [String(args.to)] : name === "edit_package_manifest" ? ["package.json"] : [String(args.path)];
    // Scope check (FR-A2/§5.5 "agent changes only approved scope").
    // Canonical workspace-relative paths from the jail (also rejects traversal/aliasing before any check).
    const outOfScope = targets.map((t) => ctx.jail.resolve(t).rel).filter((t) => !inScope(ctx.task, t));
    let approved = false;
    if (outOfScope.length) {
      const a = ctx.approvals.request({
        projectId: ctx.project.id,
        runId: ctx.run.id,
        taskId: ctx.task.id,
        kind: "file_operation",
        action: `${name} on ${outOfScope.join(", ")} (outside the approved plan scope)`,
        reason: `Task "${ctx.task.title}" wants to modify files not listed in the approved plan`,
        affected: outOfScope,
        risk: "medium",
        consequencesOfDenial: "The change is not made; the agent must stay within the planned files or report a blocker.",
      });
      const res = await awaitApproval(a);
      if (res.status !== "approved") return { ok: false, content: `Denied: ${outOfScope.join(", ")} is outside the approved scope. Stay within: ${ctx.task.expectedPaths.join(", ")}` };
    }
    // Guards: no rewriting a large file to change a few lines, no second declaration of the same CSS token.
    if (name === "apply_patch" || name === "replace_file") {
      const rel = ctx.jail.resolve(String(args.path)).rel;
      let before: string | undefined;
      try {
        before = fs.readFileSync(ctx.jail.resolve(rel).abs, "utf8");
      } catch {
        before = undefined;
      }
      const refused = editGuard(name, rel, before, args, { patchMisses: patchMisses.get(rel) ?? 0 });
      if (refused) return { ok: false, content: refused };
      // Advice alone didn't stop it (Calendar test 6: misses on CalendarMonth.tsx kept coming): from the third miss on a
      // short file, apply_patch is refused and the file's real text is sent, so the rewrite starts from what's there.
      if (name === "apply_patch" && before !== undefined && (patchMisses.get(rel) ?? 0) >= 3 && before.split("\n").length <= MAX_REWRITE_LINES)
        return { ok: false, content: `Not applied: apply_patch has missed ${rel} ${patchMisses.get(rel)} times because the text you're matching isn't what the file says now. Use replace_file with the COMPLETE corrected file instead (no approval needed). This is the file as it is now:\n${untrusted(rel, before)}` };
      const after = before === undefined ? undefined : afterEdit(name, before, args);
      if (before !== undefined && after !== undefined && /\.(css|scss|pcss)$/i.test(rel)) {
        const inUse = removesTokenInUse(rel, before, after, workspaceTokenUsage(ctx.jail));
        if (inUse) return { ok: false, content: inUse };
      }
    }
    // Building-block imports must point at the one index file, from this file's folder (new files included).
    if ((name === "create_file" || name === "apply_patch" || name === "replace_file") && fs.existsSync(ctx.jail.resolve("src/components/ui/index.tsx").abs)) {
      const rel = ctx.jail.resolve(String(args.path)).rel;
      let current: string | undefined;
      try {
        current = fs.readFileSync(ctx.jail.resolve(rel).abs, "utf8");
      } catch {
        current = undefined;
      }
      const proposed = name === "create_file" || name === "replace_file" ? String(args.content ?? "") : current === undefined ? undefined : afterEdit(name, current, args);
      const wrongImport = proposed === undefined ? undefined : buildingBlockImports(rel, proposed);
      if (wrongImport) return { ok: false, content: wrongImport };
      const coverUp = proposed === undefined ? undefined : coverUpEdit(rel, current, proposed);
      if (coverUp) return { ok: false, content: coverUp };
      const native = proposed === undefined ? undefined : nativeInWebApp(rel, proposed);
      if (native) return { ok: false, content: native };
      // JSX in a .js/.jsx file of a TypeScript project: the linter can't parse it; the file should be .tsx.
      if (/\.jsx?$/.test(rel) && rel.startsWith("src/") && proposed && /<[A-Z][\w.]*[\s/>]|<\/?(div|span|button|main|section)\b/.test(proposed) && fs.existsSync(ctx.jail.resolve("tsconfig.json").abs))
        return { ok: false, content: `Not applied: ${rel} contains JSX, but this is a TypeScript project, so components live in .tsx files. Create ${toTsPath(rel)} instead (and import it without an extension, e.g. "./components/${(toTsPath(rel).split("/").pop() ?? "").replace(/\.tsx?$/, "")}").` };
    }
    // Rewriting a non-protected file that this run itself created puts no pre-existing content at risk,
    // so replace_file needs no approval card in that case (it is still snapshotted and diffed).
    if (name === "replace_file" && ctx.createdInRun?.(ctx.jail.resolve(String(args.path)).rel)) approved = true;
    // Recovery path: after two missed patches on the same small file, a whole-file rewrite is the reliable fix
    // (still in scope, snapshotted, diffed and reversible; protected files stay refused by the operation itself).
    if (name === "replace_file" && !approved) {
      const rel = ctx.jail.resolve(String(args.path)).rel;
      let lines = Infinity;
      try {
        lines = fs.readFileSync(ctx.jail.resolve(rel).abs, "utf8").split("\n").length;
      } catch {
        /* missing file: the operation reports it */
      }
      if ((patchMisses.get(rel) ?? 0) >= 2 && lines <= MAX_REWRITE_LINES) approved = true;
    }
    // An edit that leaves a TS/JS file unable to parse is not kept (see syntaxGuard); three in a row on one file end the
    // attempt, so a stronger model or the debugger takes the step instead of the same mistake coming back.
    if ((name === "apply_patch" || name === "replace_file" || name === "create_file") && typeof args.path === "string") {
      const target = ctx.jail.resolve(String(args.path));
      let before: string | undefined;
      try {
        before = fs.readFileSync(target.abs, "utf8");
      } catch {
        before = undefined;
      }
      const after = name === "create_file" ? String(args.content ?? "") : before === undefined && name === "apply_patch" ? undefined : afterEdit(name, before ?? "", args);
      const refusal = after === undefined ? undefined : syntaxGuard(target.rel, before, after);
      if (refusal) {
        const n = (syntaxRefusals.get(target.rel) ?? 0) + 1;
        syntaxRefusals.set(target.rel, n);
        if (n >= 3) {
          const reason = `No progress: ${n} edits in a row would have left ${target.rel} unable to parse. Stopping this attempt.`;
          ctx.onNoProgress?.(reason);
          return { ok: false, content: `ERROR: ${refusal}\n${reason}`, terminal: { kind: "no_action", reason } };
        }
        return { ok: false, content: `ERROR: ${refusal}` };
      }
      syntaxRefusals.delete(target.rel);
    }
    const opCtx = { jail: ctx.jail, projectId: ctx.project.id, runId: ctx.run.id, taskId: ctx.task.id, toolCallId, approved };
    const call = (c: typeof opCtx): OpResult => (ctx.ops as unknown as Record<string, (c: unknown, a: unknown) => OpResult>)[name].call(ctx.ops, c, args);
    let res = call(opCtx);
    if (res.status === "needs_approval") {
      const a = ctx.approvals.request({
        projectId: ctx.project.id,
        runId: ctx.run.id,
        taskId: ctx.task.id,
        kind: "file_operation",
        action: res.approvalReason ?? `${name} ${targets.join(", ")}`,
        reason: String(args.reason ?? `Required by task "${ctx.task.title}"`),
        affected: res.paths,
        risk: res.risk ?? "medium",
        detail: res.diff,
        consequencesOfDenial: "The file is left unchanged; the task may be blocked.",
      });
      const decided = await awaitApproval(a);
      if (decided.status !== "approved") return { ok: false, content: `Approval ${decided.status}: ${res.approvalReason}. The file was NOT changed.` };
      res = call({ ...opCtx, approved: true });
    }
    if (name === "apply_patch") {
      const rel = ctx.jail.resolve(String(args.path)).rel;
      if (!res.ok && /Patch context (mismatch|ambiguous)/.test(res.message)) {
        const misses = (patchMisses.get(rel) ?? 0) + 1;
        patchMisses.set(rel, misses);
        // Two misses on one file: stop patching. Models otherwise loop on the same failing patch.
        if (misses >= 2) {
          const lines = (() => {
            try {
              return readFile(ctx.jail, rel).content.split("\n").length;
            } catch {
              return 0;
            }
          })();
          res = {
            ...res,
            message:
              lines && lines <= MAX_REWRITE_LINES
                ? `${res.message}\nThis is the ${misses === 2 ? "second" : `${misses}th`} missed patch on ${rel}. Stop using apply_patch on it. Next: call replace_file with the COMPLETE corrected content of ${rel} (read it first if needed); it is applied without asking for approval.`
                : `${res.message}\nThis is the ${misses === 2 ? "second" : `${misses}th`} missed patch on ${rel}. It has ${lines} lines, too long to rewrite. Call read_file on ${rel}, then apply_patch again copying the find text exactly from what you read (same spaces and quotes), with one neighbouring line so it occurs once.`,
          };
        }
      } else if (res.ok) patchMisses.delete(rel);
    }
    if (res.ok) {
      ctx.onPathsChanged(res.paths);
      if (name === "edit_package_manifest") ctx.refreshPreflight();
    }
    let typeNote = "";
    let autoNote = "";
    if (res.ok && ctx.typeErrorsAfterEdit && ["apply_patch", "replace_file", "create_file"].includes(name) && res.paths.some((p) => /\.(tsx?|jsx?|mts|cts|py)$/i.test(p))) {
      let all = await ctx.typeErrorsAfterEdit(res.paths).catch(() => [] as string[]);
      // Errors in the file just edited are this edit's to fix; errors elsewhere (other steps' files) are only counted,
      // or the model goes off repairing other steps' screens (Calendar test 6).
      const edited = new Set(res.paths.map((p) => p.replace(/\\/g, "/")));
      // A name imported from the wrong module, with one file that exports it: FlowCode moves the import itself.
      const fixed = importFixes(ctx.jail, all, (f) => edited.has(f));
      for (const [file, text] of fixed) ctx.ops.replaceContent({ ...opCtx, approved: true }, file, text);
      if (fixed.size) {
        autoNote = `\n\nFlowCode fixed ${fixed.size === 1 ? "an import" : "imports"} in ${[...fixed.keys()].join(", ")} for you (a name came from a file that doesn't export it). Read the file again before your next patch.`;
        all = await ctx.typeErrorsAfterEdit(res.paths).catch(() => [] as string[]);
      }
      const added = all.filter((l) => !errorFile(l) || edited.has(errorFile(l)!));
      const elsewhere = [...new Set(all.filter((l) => !added.includes(l)).map((l) => errorFile(l)!))];
      const otherNote = elsewhere.length ? `\n(${all.length - added.length} type error${all.length - added.length === 1 ? "" : "s"} in other files, ${elsewhere.slice(0, 3).join(", ")}${elsewhere.length > 3 ? "…" : ""}, belong to other steps: leave them unless this step's own work caused them.)` : "";
      // Progress detector: the same errors coming back after different ones means the edits are going round in a circle
      // (Calendar test 7: DOM Event → undefined CalendarEvent → never[] → Event, for 15 minutes). The identical-failure
      // stop never fires on a cycle, so end the attempt here and let a stronger model take the step.
      if (added.length) {
        if (errorCycle(errorSets, added)) {
          const reason = `No progress: the edits to ${[...edited].join(", ")} keep going round the same type errors (this set came back after ${errorSets.length - 1} edits). Stopping this attempt.`;
          ctx.onNoProgress?.(reason);
          return { ok: false, content: `ERROR: ${reason}`, terminal: { kind: "no_action", reason } };
        }
      }
      if (added.length)
        typeNote = `\n\nType check after this edit: ${added.length} new error${added.length === 1 ? "" : "s"} in the file you edited. Fix ${added.length === 1 ? "it" : "them"} before anything else (an unused name: use it or remove it; a missing name: declare or import it):\n${added.slice(0, 8).join("\n")}${hintText(added)}${otherNote}`;
      else if (otherNote) typeNote = `\n\nType check after this edit: no errors in the file you edited.${otherNote}`;
    }
    // A component that would re-render forever is named straight away, before a test run hangs on it.
    const loops = res.ok
      ? renderLoopNote(
          res.paths
            .filter((p) => /\.(tsx|jsx)$/i.test(p))
            .flatMap((p) => {
              try {
                return [{ path: p, text: fs.readFileSync(ctx.jail.resolve(p).abs, "utf8") }];
              } catch {
                return [];
              }
            }),
        )
      : "";
    const loopNote = loops ? `\n\n${loops}\nFix this before running the tests.` : "";
    return { ok: res.ok, content: res.ok ? `${res.message}${res.diff ? `\n${res.diff.slice(0, 3000)}` : ""}${autoNote}${typeNote}${loopNote}` : `ERROR: ${res.message}` };
  };

  /** FlowCode's exact fixes for errors it can work out itself (wrong relative import, children on a component that takes none). */
  const hintText = (errors: string[]) => {
    const hints = typeErrorHints(ctx.jail, errors);
    return hints.length ? `\n\nHow to fix (worked out by FlowCode from your files):\n${hints.map((h) => `- ${h}`).join("\n")}` : "";
  };

  let completionChecks = 0;
  return async (name: ToolName, args: unknown, _call: unknown, toolCallId: string): Promise<ToolExecution> => {
    let a = args as Record<string, unknown>;
    // "npm run test -- file -t name" sent as a command is the test script: run it as one (no approval needed),
    // instead of a general command that waits for an OK (No BIO & GMO build: two hours waiting on one).
    if (name === "run_command" && Array.isArray(a.argv)) {
      const argv = (a.argv as unknown[]).map(String);
      const m = /^(npm|pnpm|yarn|bun)(\.cmd)?$/i.test(argv[0] ?? "") ? (argv[1] === "run" || argv[1] === "test" ? argv.slice(argv[1] === "run" ? 2 : 1) : undefined) : undefined;
      if (m?.length && (ctx.preflight() ?? ctx.refreshPreflight()).scripts.some((s) => s.name === m[0])) {
        const rest = m.slice(1).map((x) => (/\s/.test(x) ? `"${x.replace(/"/g, "")}"` : x));
        name = "run_script";
        a = { script: [m[0], ...rest].join(" "), reason: a.reason };
      }
    }
    try {
      switch (name) {
        case "list_files": {
          // A folder that doesn't exist yet is an answer, not a failure: say how it gets made (Calculator test 1: the
          // model went from "File not found: src/screens" to mkdir and ls, which don't exist here, then gave up).
          const dir = String(a.path ?? ".");
          if (dir !== "." && !fs.existsSync(ctx.jail.resolve(dir).abs))
            return { ok: true, content: `${dir} doesn't exist yet. You don't need to make folders: create_file creates any missing folders (e.g. create_file "${dir.replace(/\/$/, "")}/HomeScreen.tsx"). Use list_files "." or "src" to see what exists.` };
          return { ok: true, content: untrusted("file-tree", renderTree(listTree(ctx.jail, dir, Number(a.depth ?? 3))) || "(empty directory)") };
        }
        case "search_code": {
          const hits = searchWorkspace(ctx.jail, String(a.query), { glob: a.glob as string | undefined, maxHits: 80 });
          // A filtered search that finds nothing says what it searched, so "No matches" isn't read as "doesn't exist".
          const none = a.glob ? `No matches for "${String(a.query)}" in files matching "${String(a.glob)}". Search again without "glob" to look in the whole project before concluding it doesn't exist.` : "No matches.";
          return { ok: true, content: hits.length ? untrusted("search-results", hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n")) : none };
        }
        case "read_file": {
          // A guessed name that is one extension or "src/" away (index.ts for index.tsx): say which file exists.
          let f: ReturnType<typeof readFile>;
          try {
            f = readFile(ctx.jail, String(a.path));
          } catch (e) {
            const near = /not found/i.test((e as Error).message) ? nearestFile(ctx.jail, String(a.path)) : undefined;
            // Only the extension differs (authApi.js → authApi.ts): read it. Refusing made qwen3-coder ask for the .js
            // name four times running (Calendar test 8).
            const twin = near && near.replace(/\.(jsx?|tsx?)$/, "") === String(a.path).replace(/^\.\//, "").replace(/\.(jsx?|tsx?)$/, "") ? readFile(ctx.jail, near) : undefined;
            if (twin && !twin.binary) return { ok: true, content: `(${String(a.path)} doesn't exist; this is ${twin.path}. Use that name from now on.)\n${untrusted(twin.path, twin.content)}${twin.truncated ? "\n[file truncated]" : ""}` };
            // "src/components/ui/Button.tsx": the kit has no file per component; say which file exports it.
            const wanted = /([A-Z]\w*)\.(?:tsx?|jsx?)$/.exec(String(a.path))?.[1];
            const owner = !near && wanted ? exporterFile(ctx.jail, wanted) : undefined;
            if (owner) return { ok: false, content: `File not found: ${String(a.path)}. ${wanted} isn't a file of its own: it is exported from ${owner}. Read ${owner} (search_code "function ${wanted}" finds the line).` };
            if (near) return { ok: false, content: `File not found: ${String(a.path)}. Did you mean ${near}? Read that file instead.` };
            if (/not found/i.test((e as Error).message))
              return { ok: false, content: `File not found: ${String(a.path)}. It doesn't exist yet. If this step is meant to make it, create it with create_file${/\.jsx?$/.test(String(a.path)) && fs.existsSync(ctx.jail.resolve("tsconfig.json").abs) ? ` (as ${toTsPath(String(a.path).replace(/^\.\//, ""))}: this is a TypeScript project)` : ""}; don't try to read it again.` };
            throw e;
          }
          if (f.binary) return { ok: true, content: `${f.path} is a binary file (${f.size} bytes).` };
          // A line range, numbered: agents fell back to sed (missing on Windows), python or node one-liners, each
          // needing an approval, to see lines 90–205 of a screen (Calendar prototype).
          if (a.from !== undefined || a.to !== undefined) {
            const lines = f.content.split("\n");
            const from = Math.max(1, Number(a.from ?? 1));
            const to = Math.min(lines.length, Number(a.to ?? lines.length), from + 399);
            if (from > lines.length) return { ok: false, content: `${f.path} has ${lines.length} lines; line ${from} is past the end.` };
            const width = String(to).length;
            const body = lines.slice(from - 1, to).map((l, i) => `${String(from + i).padStart(width)}| ${l}`).join("\n");
            return { ok: true, content: `(${f.path}, lines ${from}–${to} of ${lines.length}${f.truncated ? "+" : ""}. The "N| " at the start of each line is its number, not part of the file: leave it out of apply_patch find text, and pass the number as "line" if the text occurs more than once.)\n${untrusted(f.path, body)}` };
          }
          return { ok: true, content: untrusted(f.path, f.content) + (f.truncated ? "\n[file truncated]" : "") };
        }
        case "find_image": {
          // A network call (Openverse), so it follows the project's "allow external research" setting.
          if (!(ctx.currentProject?.() ?? ctx.project).settings.allowExternalResearch) return { ok: false, content: "Searching for photos online is off for this project (Project settings → allow external research). Use an inline SVG illustration and lucide-react icons instead." };
          const res = await findOpenImage(ctx.jail, { query: String(a.query ?? ""), name: a.name ? String(a.name) : undefined, orientation: a.orientation as "landscape" | "portrait" | "square" | undefined }, ctx.signal, ctx.imageCheck);
          if (res.paths.length) ctx.onPathsChanged(res.paths);
          return { ok: res.ok, content: res.message };
        }
        case "create_file":
        case "apply_patch":
        case "edit_json":
        case "edit_yaml":
        case "edit_toml":
        case "edit_package_manifest":
        case "replace_file":
        case "copy_file":
        case "move_file":
        case "delete_file":
          return await mutate(name, a, toolCallId);
        case "run_command":
        case "run_script": {
          const pf = ctx.preflight() ?? ctx.refreshPreflight();
          let argv: string[];
          if (name === "run_script") {
            // "npm run typecheck" (or "pnpm typecheck") means the script "typecheck".
            // Reporter and watch flags change only how results print; FlowCode summarises failures itself, so they're
            // dropped rather than refused as an unknown script (qwen3-coder asked for --reporter=verbose again and again).
            const full = String(a.script ?? "")
              .trim()
              .replace(/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?/, "")
              .replace(/\s+--(?:reporter|run|watch=false|no-watch|silent|verbose)(?:[= ]\S+)?(?=\s|$)/g, "")
              .trim();
            // "test -- src/acceptance/calc.test.tsx" (or "test src/…"): the test script on one test file, so a step can
            // run its own acceptance tests (Calculator app: gpt-5.6-sol asked for this and was told it doesn't exist).
            // …or a folder of tests ("test -- src/acceptance/": every acceptance test so far).
            // …optionally one named test: `test -- src/acceptance/x.test.tsx -t "opens the brand list"` (No BIO & GMO build:
            // qwen3-coder asked for this to focus on one failing test and was told the script doesn't exist).
            // The test name may come without quotes (`-t clear the sort selection`): No BIO & GMO build, an unquoted
            // name fell through to run_command, which asks for approval, and the build waited two hours for an OK.
            const [, wanted, file, , quoted, bare] = /^(\S+)(?:\s+(?:--\s+)?(src\/[\w./-]+\.test\.tsx?|src\/[\w/-]+\/)(\s+(?:-t|--testNamePattern)[ =](?:["']([^"']{1,200})["']|([^"'\s-][^"']{0,199}?))\s*)?)?$/.exec(full) ?? [, full, undefined, undefined, undefined, undefined];
            const testName = quoted ?? bare?.trim();
            const script = pf.scripts.find((s) => s.name === wanted);
            if (!script) return { ok: false, content: `Script "${a.script}" does not exist. Available: ${pf.scripts.map((s) => s.name).join(", ") || "(none)"}${/\btest\b/.test(full) ? `. To run one test file: run_script "test -- src/acceptance/<file>.test.tsx".` : ""}` };
            if (file && script.classification !== "test") return { ok: false, content: `Only the test script takes a file: run_script "test -- ${file}".` };
            // A test file that isn't there fails in under a second with "No test files found", which reads like a broken
            // test (No BIO & GMO build: qwen3-coder ran src/screens/NonGMOBrandsScreen.test.tsx again and again).
            if (file && !file.endsWith("/") && !fs.existsSync(ctx.jail.resolve(file).abs)) {
              const step = ctx.task.acceptanceCriteria.map((c) => (c.check.type === "verification" ? /^tests:(.+)$/.exec(c.check.kind)?.[1] : undefined)).find(Boolean);
              return { ok: false, content: `${file} doesn't exist, so there is nothing to run.${step ? ` This step's acceptance tests are in ${step}: run_script "test -- ${step}".` : " Create it first, or run the folder: run_script \"test -- src/acceptance/\"."}` };
            }
            // A dev server never finishes: No BIO & GMO build, run_script "dev" waited five minutes for a time-out.
            if (script.classification === "dev" || script.classification === "start" || script.classification === "preview")
              return { ok: false, content: `"${script.name}" starts a server that keeps running, so it can't be run as a check. FlowCode starts the app itself to look at the screens after your edits. To check your work, use run_script "typecheck" or "test".` };
            // A screen that re-renders forever makes every test hang until the time limit (No BIO & GMO build: five
            // minutes per run, with only "timed out" to go on). Say where the loop is instead of running.
            if (script.classification === "test") {
              const loops = renderLoopNote(sourceFiles(ctx.jail.root));
              if (loops) return { ok: false, content: `Not run: the tests would hang. ${loops}\nFix the loop, then run the tests again.` };
            }
            argv = file ? [...scriptArgv(pf, script), "--", file, ...(testName ? ["-t", testName] : [])] : scriptArgv(pf, script);
          } else {
            argv = (a.argv as string[]).map(String);
            // Test results written to files pile up in the project (first Calendar build: core-results.json,
            // current-results.json, current-results-2.json, vitest-results.json); run_script already summarises failures.
            if (argv.some((x) => /^--(outputFile|output-file)(=|$)/.test(x)))
              return { ok: false, content: `Don't write test results to a file: run_script "test" (or "test -- src/acceptance/<file>.test.tsx") already puts the failing tests and their reasons at the top of its result.` };
            // Shell file commands do nothing here (no shell on Windows, and they'd need approval): name the tool that does.
            const shell = SHELL_FILE_TOOLS[argv[0]?.replace(/\.exe$/i, "").toLowerCase() ?? ""];
            if (shell) return { ok: false, content: `Not run: "${argv.join(" ")}" isn't available here. ${shell}` };
          }
          const res = await ctx.runner.run({
            jail: ctx.jail,
            projectId: ctx.project.id,
            runId: ctx.run.id,
            taskId: ctx.task.id,
            phase: ctx.phase,
            argv,
            reason: String(a.reason ?? "agent request"),
            preflight: pf,
            timeoutMs: ctx.project.settings.commandTimeoutMs,
            outputCapBytes: ctx.project.settings.outputCapBytes,
            maxSameFingerprint: ctx.project.settings.maxSameFingerprintAttempts,
            extraSecretPatterns: ctx.project.settings.extraSecretPatterns,
            signal: ctx.signal,
          });
          if (res.record.status === "awaiting_approval") ctx.onAwaitingApproval(true);
          const tail = res.output.slice(-6000);
          if (/install|add|ci\b/.test(argv.slice(1, 2).join(" ")) && res.record.status === "succeeded") ctx.refreshPreflight();
          const header = `Command ${res.record.argv.join(" ")} → ${res.record.status}${res.record.exitCode !== undefined ? ` (exit ${res.record.exitCode})` : ""}`;
          // Not rerun because it would fail the same way: say so plainly with the errors, so the agent fixes them
          // instead of reading a "policy" refusal and giving up.
          if (res.record.status === "blocked" && res.record.errorFingerprint)
            return { ok: false, content: `\`${res.record.argv.join(" ")}\` was not run again: it already failed the same way and no file has changed since. This is not a permission problem. Fix the errors below in the files they name; the check runs again once a file changes.\n${untrusted("last-errors", res.output || "(no output was kept)")}` };
          if (res.record.status === "blocked") return { ok: false, content: `${header}\nPolicy: ${res.record.policyReasons.join("; ")}\n${res.record.outputPreview ?? ""}` };
          // A failed test run starts with every failing test and why, since the tail only holds the last few.
          const digest = res.record.status === "succeeded" ? "" : testFailureDigest(res.output);
          return { ok: res.record.status === "succeeded", content: `${header}\n${digest}${untrusted("command-output", tail)}${res.record.status === "succeeded" ? "" : hintText(res.output.split(/\r?\n/))}` };
        }
        case "request_approval": {
          const ap = ctx.approvals.request({
            projectId: ctx.project.id,
            runId: ctx.run.id,
            taskId: ctx.task.id,
            kind: "command",
            action: String(a.action),
            reason: String(a.reason),
            affected: [],
            risk: (a.risk as "low") ?? "medium",
            consequencesOfDenial: "The agent will not perform the action and must find another path or report a blocker.",
          });
          const decided = await awaitApproval(ap);
          return {
            ok: decided.status === "approved",
            content:
              decided.status === "approved"
                ? `User approved: ${ap.action}. Note: approval does not perform the action; use the governed tool to carry it out.`
                : `User ${decided.status} the request: ${ap.action}. Do not perform it.`,
          };
        }
        case "report_blocked":
          return { ok: true, content: "Blocker recorded.", terminal: { kind: "blocked", reason: String(a.reason), nextAction: String(a.nextAction) } };
        case "task_complete": {
          const terminal = { kind: "complete" as const, summary: String(a.summary), changedPaths: (a.changedPaths as string[]) ?? [] };
          // §10.3: re-evaluate acceptance criteria now and hand failures straight back to the same agent
          // (bounded), so it can fix them with full context instead of losing the conversation.
          if (ctx.verifyClaim && completionChecks < 3) {
            completionChecks++;
            const v = await ctx.verifyClaim();
            if (!v.allMet)
              return {
                ok: false,
                content: `Runtime verification FAILED — the task is not complete (check ${completionChecks}/3):\n${v.failures.join("\n").slice(0, 5000)}\nFix these problems with the tools (read the file, then patch or rewrite it), then call task_complete again.`,
              };
            return { ok: true, content: "Runtime verification passed.", terminal };
          }
          return { ok: true, content: "Completion claim recorded; the runtime will verify acceptance criteria.", terminal };
        }
      }
    } catch (err) {
      if (err instanceof PolicyError) return { ok: false, content: `POLICY: ${err.message}` };
      throw err;
    }
    void ev;
    return { ok: false, content: `Unsupported tool ${name}` };
  };
}
