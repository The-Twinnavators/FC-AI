/**
 * Typed, governed file operations (FR-F1). Every mutation: path-jail → protected-file policy →
 * parse/validate → snapshot → atomic write → post-validate → record. Nothing is written if any step fails.
 */
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { createTwoFilesPatch } from "diff";
import type { ToolArgs } from "@flowcode/contracts";
import type { z } from "zod";
import { PathJail, PolicyError } from "../security/pathJail.js";
import { protectedPolicyFor, stripJsonComments, validatePackageManifest } from "./protectedFiles.js";
import { classifyScript } from "./preflight.js";
import type { SnapshotService, SnapshotRow } from "./snapshots.js";
import { ABSENT } from "./snapshots.js";
import { newId } from "../util/ids.js";
import { redact } from "../security/redaction.js";

export interface OpContext {
  jail: PathJail;
  projectId: string;
  runId: string;
  taskId?: string;
  toolCallId?: string;
  /** True when the user explicitly approved this exact operation. */
  approved?: boolean;
}

export interface OpResult {
  ok: boolean;
  status: "applied" | "needs_approval" | "rejected";
  paths: string[];
  diff?: string;
  snapshotIds: string[];
  message: string;
  approvalReason?: string;
  risk?: "low" | "medium" | "high";
}

type Args<K extends keyof typeof ToolArgs> = z.infer<(typeof ToolArgs)[K]>;

const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|tiff?|woff2?|ttf|otf|eot|mp3|mp4|webm|wav|ogg|pdf|zip|gz)$/i;
/** True for files that must be copied as bytes, not text. */
export function isBinary(rel: string, bytes: Buffer): boolean {
  if (BINARY_EXT.test(rel)) return true;
  if (bytes.subarray(0, 8000).includes(0)) return true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return false;
  } catch {
    return true;
  }
}

export class FileOperations {
  constructor(private snapshots: SnapshotService) {}

  private readText(abs: string): string {
    return fs.readFileSync(abs, "utf8");
  }

  private atomicWrite(abs: string, content: string | Buffer) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.flowcode-${process.pid}.tmp`;
    if (typeof content === "string") fs.writeFileSync(tmp, content, "utf8");
    else fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, abs);
  }

  /** Common guarded write path shared by every mutating op. */
  private commit(ctx: OpContext, rel: string, tool: string, before: string | undefined, after: string): OpResult {
    const { abs } = ctx.jail.resolve(rel);
    const policy = protectedPolicyFor(rel);
    if (policy) {
      if (!policy.allowedTools.includes(tool)) {
        return reject(`${rel} is protected (${policy.description}); ${tool} is not an allowed operation for it`);
      }
      if (before !== undefined && policy.validate) {
        const preErrors = policy.validate(before, rel);
        // A file that is already invalid may only be repaired, never made worse: allow if after is valid.
        if (preErrors.length && policy.validate(after, rel).length) return reject(`Protected file ${rel} is invalid before and after change: ${preErrors.join("; ")}`);
      }
      if (policy.validate) {
        const postErrors = policy.validate(after, rel);
        if (postErrors.length) return reject(`Change rejected before write — ${rel} would be invalid: ${postErrors.join("; ")}`);
      }
      if (policy.requiresApproval && !ctx.approved) {
        return needsApproval(rel, `Modify protected file ${rel} (${policy.description})`, "medium", diffOf(rel, before, after));
      }
    }
    // A data file must stay valid JSON (No BIO & GMO: an edit to image-credits.json left a half-deleted entry and a
    // trailing comma, and the app stopped building). Files that allow comments (tsconfig, .vscode) are left alone, as
    // is a file that wasn't valid JSON to begin with.
    if (/\.json$/i.test(rel) && !/(^|\/)(tsconfig[^/]*|jsconfig[^/]*|\.vscode\/[^/]*)\.json$/i.test(rel)) {
      const valid = (t: string) => {
        try {
          JSON.parse(t);
          return true;
        } catch {
          return false;
        }
      };
      if (!valid(after) && (before === undefined || valid(before))) {
        let detail = "";
        try {
          JSON.parse(after);
        } catch (e) {
          detail = (e as Error).message;
        }
        return reject(`Change rejected before write: ${rel} would no longer be valid JSON (${detail}). Keep every entry complete, with no trailing commas; read the file again and make the edit so the whole file still parses.`);
      }
    }
    const opId = newId("op");
    const snap = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel, operationId: opId, operation: tool, toolCallId: ctx.toolCallId });
    this.atomicWrite(abs, after);
    this.snapshots.recordPost(snap, ctx.jail);
    return { ok: true, status: "applied", paths: [rel], diff: diffOf(rel, before, after), snapshotIds: [snap.id], message: `${tool} applied to ${rel}` };
  }

  /** Replaces a file's text through the same guarded path (protected-file policy, snapshot, diff). Used by the Styles editor. */
  replaceContent(ctx: OpContext, relPath: string, after: string): OpResult {
    const { abs, rel } = ctx.jail.resolve(relPath);
    if (!fs.existsSync(abs)) return reject(`${rel} does not exist`);
    const before = this.readText(abs);
    if (after === before) return reject(`No change to ${rel}`);
    return this.commit(ctx, rel, "apply_patch", before, after);
  }

  create_file(ctx: OpContext, a: Args<"create_file">): OpResult {
    const { abs, rel } = ctx.jail.resolve(a.path);
    if (fs.existsSync(abs)) return reject(`create_file refused: ${rel} already exists. Read it and use apply_patch instead.`);
    return this.commit(ctx, rel, "create_file", undefined, a.content);
  }

  apply_patch(ctx: OpContext, a: Args<"apply_patch">): OpResult {
    const { abs, rel } = ctx.jail.resolve(a.path);
    if (!fs.existsSync(abs)) return reject(`apply_patch refused: ${rel} does not exist. Use create_file for new files.`);
    const before = this.readText(abs);
    // Normalize line endings for matching but preserve the file's style.
    const crlf = before.includes("\r\n");
    let working = crlf ? before.replace(/\r\n/g, "\n") : before;
    for (const [i, e] of a.edits.entries()) {
      const find = e.find.replace(/\r\n/g, "\n");
      const okBefore = i > 0 ? ` Edits 1-${i} matched and would apply: resend the patch with only those edits (or fix edit ${i + 1}).` : "";
      const hit = locatePatch(working, find, e.line);
      if ("missing" in hit) return reject(`Patch context mismatch in ${rel} (edit ${i + 1} of ${a.edits.length}): find text not found (find is literal text, not a regex). No changes were written.${okBefore}${nearestBlock(working, find)}`);
      if ("ambiguous" in hit) return reject(`Patch context ambiguous in ${rel} (edit ${i + 1} of ${a.edits.length}): find text occurs ${hit.ambiguous.length} times (lines ${hit.ambiguous.join(", ")}). Resend the same edit with "line" set to the one you mean (e.g. "line": ${hit.ambiguous[hit.ambiguous.length - 1]}). No changes were written.${okBefore}`);
      working = working.slice(0, hit.start) + e.replace.replace(/\r\n/g, "\n") + working.slice(hit.end);
    }
    const after = crlf ? working.replace(/\n/g, "\r\n") : working;
    if (after === before) {
      // Small models resend the same edit; say why it did nothing and what would move the work forward.
      const same = a.edits.map((e, i) => (e.find.replace(/\r\n/g, "\n") === e.replace.replace(/\r\n/g, "\n") ? i + 1 : 0)).filter(Boolean);
      return reject(
        `Patch produced no change in ${rel}: ${same.length === a.edits.length ? "the replace text is identical to the find text" : `edit${same.length === 1 ? "" : "s"} ${same.join(", ")} replace${same.length === 1 ? "s" : ""} text with the same text, and the rest put back what was there`}, so the file already reads exactly like this. ` +
          `Don't send this patch again. If you are fixing an error, put the corrected code in "replace" (for example the right import path or prop type from the error message). If the file is already correct, the problem is elsewhere: read the error again and patch the file it names, or call task_complete if the checks pass.`,
      );
    }
    return this.commit(ctx, rel, "apply_patch", before, after);
  }

  edit_json(ctx: OpContext, a: Args<"edit_json">): OpResult {
    return this.structured(ctx, a.path, "edit_json", a.operations, (s) => JSON.parse(stripJsonComments(s)), (v) => JSON.stringify(v, null, 2) + "\n");
  }

  edit_yaml(ctx: OpContext, a: Args<"edit_yaml">): OpResult {
    return this.structured(ctx, a.path, "edit_yaml", a.operations, (s) => YAML.parse(s) ?? {}, (v) => YAML.stringify(v));
  }

  edit_toml(ctx: OpContext, a: Args<"edit_toml">): OpResult {
    return this.structured(ctx, a.path, "edit_toml", a.operations, (s) => parseToml(s), (v) => stringifyToml(v as Record<string, unknown>) + "\n");
  }

  private structured(
    ctx: OpContext,
    p: string,
    tool: string,
    ops: Array<{ op: "set" | "delete"; pointer: string; value?: unknown }>,
    parse: (s: string) => unknown,
    serialize: (v: unknown) => string,
  ): OpResult {
    const { abs, rel } = ctx.jail.resolve(p);
    if (!fs.existsSync(abs)) return reject(`${tool} refused: ${rel} does not exist`);
    if (/(^|\/)package\.json$/.test(rel)) return reject(`package.json must be edited with edit_package_manifest`);
    const before = this.readText(abs);
    let doc: unknown;
    try {
      doc = parse(before);
    } catch (e) {
      return reject(`${rel} could not be parsed: ${(e as Error).message}`);
    }
    try {
      for (const o of ops) applyPointer(doc, o.pointer, o.op, o.value);
    } catch (e) {
      return reject(`${tool} failed: ${(e as Error).message}`);
    }
    const after = serialize(doc);
    try {
      parse(after);
    } catch (e) {
      return reject(`${tool} result does not parse: ${(e as Error).message}`);
    }
    return this.commit(ctx, rel, tool, before, after);
  }

  edit_package_manifest(ctx: OpContext, a: Args<"edit_package_manifest">): OpResult {
    const { abs, rel } = ctx.jail.resolve("package.json");
    if (!fs.existsSync(abs)) return reject("No package.json in workspace root");
    const before = this.readText(abs);
    const preErrors = validatePackageManifest(before);
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(before) as Record<string, unknown>;
    } catch {
      return reject(`package.json is not parseable; repair requires replace_file with approval. Errors: ${preErrors.join("; ")}`);
    }
    const section = (k: string) => ((pkg[k] ??= {}) as Record<string, string>);
    // FlowCode's React starter switches screens itself (useScreen + AppShell); a router is unneeded, and models invent
    // router packages that don't exist (Calendar test 6: "@react-router/react-router": "1.0.0").
    // A project file added as a package ("src/lib/screens": "1.0.0", Calendar test 6): the import path is what's wrong.
    const local = a.operations.find((o) => o.op === "add_dependency" && (/^(\.{1,2}\/|\/|src\/|@\/|~\/)/.test(o.name) || (!o.name.startsWith("@") && o.name.includes("/"))));
    if (local && local.op === "add_dependency")
      return reject(`Not added: "${local.name}" is a file in this project, not an npm package, so it can't be installed. Import it with a path relative to the importing file instead (from src/App.tsx: "./lib/screens", from src/screens/: "../lib/screens"). The type check's "How to fix" note gives the exact path.`);
    const router = a.operations.find((o) => o.op === "add_dependency" && /^(react-router(-dom)?|@react-router\/|@tanstack\/(react-)?router|wouter$|next$)/.test(o.name));
    if (router && router.op === "add_dependency" && fs.existsSync(ctx.jail.resolve("src/lib/screens.ts").abs))
      return reject(`Not added: ${router.name}. This app is built on FlowCode's starter, which already switches screens without a router: const [screen, go] = useScreen(["home", "events"]) from "./lib/screens", then <AppShell screens={...} current={screen} onNavigate={go}> and render the screen that matches. Use that instead of a router or Outlet.`);
    for (const op of a.operations) {
      switch (op.op) {
        case "add_dependency": {
          const target = op.dev ? "devDependencies" : "dependencies";
          const other = op.dev ? "dependencies" : "devDependencies";
          if (pkg[other] && (pkg[other] as Record<string, string>)[op.name]) delete (pkg[other] as Record<string, string>)[op.name];
          section(target)[op.name] = op.version;
          pkg[target] = sortKeys(section(target));
          break;
        }
        case "remove_dependency":
          for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) if (pkg[k]) delete (pkg[k] as Record<string, string>)[op.name];
          break;
        case "set_script":
          section("scripts")[op.name] = op.command;
          break;
        case "remove_script":
          if (pkg.scripts) delete (pkg.scripts as Record<string, string>)[op.name];
          break;
        case "set_field":
          pkg[op.field] = op.value;
          break;
      }
    }
    const indent = /^\{\r?\n(\s+)"/.exec(before)?.[1] ?? "  ";
    const after = JSON.stringify(pkg, null, indent) + "\n";
    const errors = validatePackageManifest(after);
    if (errors.length) return reject(`Manifest edit rejected before write: ${errors.join("; ")}`);
    const depsChanged = a.operations.some((o) => o.op === "add_dependency" || o.op === "remove_dependency");
    // A script body that is not verified-safe becomes runnable code; require explicit approval to add it.
    const risky = a.operations.flatMap((o) => (o.op === "set_script" && classifyScript(o.name, o.command).policy !== "auto" ? [`"${o.name}": "${o.command}"`] : []));
    if (risky.length && !ctx.approved) return needsApproval(rel, `Add or change script(s) ${risky.join(", ")} (not on the verified-safe list)`, "medium", diffOf(rel, before, after));
    const res = this.commit(ctx, rel, "edit_package_manifest", before, after);
    if (res.ok && depsChanged) res.message += " (dependencies changed: an approved install is required before they are usable)";
    return res;
  }

  replace_file(ctx: OpContext, a: Args<"replace_file">): OpResult {
    const { abs, rel } = ctx.jail.resolve(a.path);
    if (!fs.existsSync(abs)) return reject(`replace_file refused: ${rel} does not exist; use create_file`);
    const before = this.readText(abs);
    const policy = protectedPolicyFor(rel);
    const isManifestRepair = /(^|\/)package\.json$/.test(rel) && validatePackageManifest(before).length > 0;
    if (policy && !isManifestRepair) return reject(`replace_file is never allowed on protected file ${rel}; use ${policy.allowedTools.join("/") || "an approved package-manager command"}`);
    if (isManifestRepair) {
      const errs = validatePackageManifest(a.content);
      if (errs.length) return reject(`Replacement manifest is invalid: ${errs.join("; ")}`);
    }
    // A rewrite that drops a large part of the file without saying so is almost always the model running out of room
    // mid-file. Refuse it before anyone is asked to approve it.
    const beforeLines = before.split("\n").length;
    const afterLines = a.content.split("\n").length;
    // A file with its code in twice (a second App, repeated imports) gets much shorter when it's fixed: that's the
    // repair, not a cut-off (Calendar test 7: the clean 16-line App.tsx was refused, then the step gave up).
    const dupes = duplicateDeclarations(before);
    // A file that doesn't even parse (an unclosed comment, a cut-off tag) is fixed by rewriting it; shorter is fine
    // (Calendar test 8: the clean CalendarScreen was refused, so the coder asked to delete the file instead).
    const broken = /\.(tsx?|jsx?|mts|cts)$/i.test(rel) && parseErrors(rel, before) > 0;
    // A file this run made itself (written or copied in, e.g. a ready-made layout) can be rewritten at any length: the
    // cut-off protection is for files that were there before (Calendar test 8: the settings layout copied over
    // CalendarScreen couldn't be replaced with the real 17-line screen, so the coder asked to delete it).
    const madeThisRun = this.snapshots.forRun(ctx.runId).some((s) => s.relativePath === rel && s.contentHash === ABSENT);
    if (before.length > 1500 && a.content.length < before.length * 0.6 && !dupes && !broken && !madeThisRun && !/\b(remove|removing|delete|deleting|drop|shorten|trim|strip|split|simplif|duplicat)/i.test(a.reason)) {
      return reject(
        `replace_file refused: the new ${rel} is ${Math.round((1 - a.content.length / before.length) * 100)}% shorter (${beforeLines} → ${afterLines} lines) and looks cut off. Write the COMPLETE file, use apply_patch for small edits, or copy_file if the content comes from an attached file. If you really mean to remove that much, say so in the reason.`,
      );
    }
    if (!ctx.approved) return needsApproval(rel, `Replace entire file ${rel}: ${a.reason}`, "high", diffOf(rel, before, a.content));
    // Explicit approval given: bypass protected tool list only for the manifest-repair case.
    const opId = newId("op");
    const snap = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel, operationId: opId, operation: "replace_file", toolCallId: ctx.toolCallId });
    this.atomicWrite(abs, a.content);
    this.snapshots.recordPost(snap, ctx.jail);
    return { ok: true, status: "applied", paths: [rel], diff: diffOf(rel, before, a.content), snapshotIds: [snap.id], message: `replace_file applied to ${rel}` };
  }

  /** Copies a file's content to another path (new or existing) — e.g. an attached stylesheet into src/ — without the model retyping it. */
  copy_file(ctx: OpContext, a: Args<"copy_file">): OpResult {
    const from = ctx.jail.resolve(a.from, { mustExist: true });
    const to = ctx.jail.resolve(a.to);
    if (!fs.statSync(from.abs).isFile()) return reject(`copy_file only copies single files; ${from.rel} is a directory`);
    if (from.rel === to.rel) return reject("copy_file refused: source and destination are the same file");
    // Pictures, fonts and other binary files are copied byte for byte. Read as text, every byte that isn't valid UTF-8
    // became U+FFFD and the copy was ruined (No BIO & GMO: Pacific Foods' photo was a broken .jpg).
    const bytes = fs.readFileSync(from.abs);
    if (isBinary(from.rel, bytes)) return this.copyBinary(ctx, from.rel, to.rel, to.abs, bytes);
    const after = this.readText(from.abs);
    const before = fs.existsSync(to.abs) ? this.readText(to.abs) : undefined;
    if (before === after) return reject(`No change: ${to.rel} already has the same content as ${from.rel}`);
    fs.mkdirSync(path.dirname(to.abs), { recursive: true });
    const res = this.commit(ctx, to.rel, "copy_file", before, after);
    if (res.ok) res.message = `Copied ${from.rel} → ${to.rel}${before === undefined ? " (new file)" : " (replaced its content)"}`;
    return res;
  }

  /** copy_file for a binary file: the same protected-file rule and snapshot (so it can be undone), written as bytes. */
  private copyBinary(ctx: OpContext, fromRel: string, toRel: string, toAbs: string, bytes: Buffer): OpResult {
    if (protectedPolicyFor(toRel)) return reject(`${toRel} is protected; copy_file can't put a binary file there`);
    if (fs.existsSync(toAbs) && fs.readFileSync(toAbs).equals(bytes)) return reject(`No change: ${toRel} already has the same content as ${fromRel}`);
    const existed = fs.existsSync(toAbs);
    const opId = newId("op");
    const snap = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel: toRel, operationId: opId, operation: "copy_file", toolCallId: ctx.toolCallId });
    this.atomicWrite(toAbs, bytes);
    this.snapshots.recordPost(snap, ctx.jail);
    const message = `Copied ${fromRel} → ${toRel} (${bytes.length.toLocaleString()} bytes, binary)${existed ? " (replaced its content)" : " (new file)"}`;
    return { ok: true, status: "applied", paths: [toRel], diff: `Binary file ${toRel}: ${bytes.length} bytes`, snapshotIds: [snap.id], message };
  }

  move_file(ctx: OpContext, a: Args<"move_file">): OpResult {
    const from = ctx.jail.resolve(a.from, { mustExist: true });
    const to = ctx.jail.resolve(a.to);
    if (fs.existsSync(to.abs)) return reject(`move_file refused: destination ${to.rel} exists`);
    if (protectedPolicyFor(from.rel) || protectedPolicyFor(to.rel)) {
      if (!ctx.approved) return needsApproval(from.rel, `Move protected file ${from.rel} → ${to.rel}`, "medium");
    }
    const opId = newId("op");
    const s1 = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel: from.rel, operationId: opId, operation: "move_file", toolCallId: ctx.toolCallId });
    const s2 = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel: to.rel, operationId: opId, operation: "move_file", toolCallId: ctx.toolCallId });
    fs.mkdirSync(path.dirname(to.abs), { recursive: true });
    fs.renameSync(from.abs, to.abs);
    this.snapshots.recordPost(s1, ctx.jail);
    this.snapshots.recordPost(s2, ctx.jail);
    return { ok: true, status: "applied", paths: [from.rel, to.rel], snapshotIds: [s1.id, s2.id], message: `Moved ${from.rel} → ${to.rel}` };
  }

  delete_file(ctx: OpContext, a: Args<"delete_file">): OpResult {
    const { abs, rel } = ctx.jail.resolve(a.path, { mustExist: true });
    if (!fs.statSync(abs).isFile()) return reject(`delete_file only deletes single files; ${rel} is a directory`);
    if (!ctx.approved) return needsApproval(rel, `Delete ${rel}: ${a.reason}`, protectedPolicyFor(rel) ? "high" : "medium");
    const before = this.readText(abs);
    const opId = newId("op");
    const snap = this.snapshots.capture({ jail: ctx.jail, projectId: ctx.projectId, runId: ctx.runId, taskId: ctx.taskId, rel, operationId: opId, operation: "delete_file", toolCallId: ctx.toolCallId });
    fs.rmSync(abs);
    this.snapshots.recordPost(snap, ctx.jail);
    return { ok: true, status: "applied", paths: [rel], diff: diffOf(rel, before, ""), snapshotIds: [snap.id], message: `Deleted ${rel} (snapshot kept)` };
  }
}

export function diffOf(rel: string, before: string | undefined, after: string): string {
  return redact(createTwoFilesPatch(before === undefined ? "/dev/null" : `a/${rel}`, `b/${rel}`, before ?? "", after, undefined, undefined, { context: 3 }));
}

/** How many syntax errors TypeScript finds parsing this file (0 for a file that parses). */
export function parseErrors(rel: string, text: string): number {
  const kind = /\.tsx$/i.test(rel) ? ts.ScriptKind.TSX : /\.jsx$/i.test(rel) ? ts.ScriptKind.JSX : /\.m?jsx?$|\.cjs$/i.test(rel) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, false, kind) as ts.SourceFile & { parseDiagnostics?: unknown[] };
  return sf.parseDiagnostics?.length ?? 0;
}

/** A top-level declaration or import line that appears twice in the file (a pasted second copy), if any. */
export function duplicateDeclarations(text: string): string | undefined {
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const key =
      /^export default\b/.test(line) ? "export default" :
      /^import\s.+\sfrom\s/.test(line) ? line.replace(/\s+/g, " ") :
      /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type)\s+(\w+)/.exec(line)?.[1];
    if (!key) continue;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return undefined;
}

function reject(message: string): OpResult {
  return { ok: false, status: "rejected", paths: [], snapshotIds: [], message };
}

function needsApproval(rel: string, reason: string, risk: "low" | "medium" | "high", diff?: string): OpResult {
  return { ok: false, status: "needs_approval", paths: [rel], snapshotIds: [], message: `Approval required: ${reason}`, approvalReason: reason, risk, diff };
}

/**
 * Where an edit's find text is: an exact unique match; the occurrence at (or nearest) the given line when it occurs more
 * than once; or, when there's no exact match, the one place that matches line for line apart from indentation and
 * trailing spaces (the most common copy mistake).
 */
export function locatePatch(hay: string, find: string, line?: number): { start: number; end: number; how: "exact" | "line" | "indent" } | { missing: true } | { ambiguous: number[] } {
  const starts: number[] = [];
  for (let at = hay.indexOf(find); at !== -1; at = hay.indexOf(find, at + Math.max(1, find.length))) starts.push(at);
  const lineOf = (offset: number) => hay.slice(0, offset).split("\n").length;
  if (starts.length === 1) return { start: starts[0], end: starts[0] + find.length, how: "exact" };
  if (starts.length > 1) {
    if (!line) return { ambiguous: starts.map(lineOf) };
    const best = [...starts].sort((a, b) => Math.abs(lineOf(a) - line) - Math.abs(lineOf(b) - line))[0];
    return { start: best, end: best + find.length, how: "line" };
  }
  // Indentation-tolerant: compare trimmed lines; accept only a single match.
  const want = find.replace(/\n+$/, "").split("\n").map((l) => l.trim());
  if (!want.some((l) => l.length >= 3)) return { missing: true };
  const lines = hay.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1;
  }
  const matches: number[] = [];
  for (let i = 0; i + want.length <= lines.length; i++) {
    if (want.every((w, k) => lines[i + k].trim() === w)) matches.push(i);
  }
  const pick = matches.length === 1 ? matches[0] : matches.length > 1 && line ? [...matches].sort((a, b) => Math.abs(a + 1 - line) - Math.abs(b + 1 - line))[0] : undefined;
  if (pick === undefined) return matches.length > 1 ? { ambiguous: matches.map((m) => m + 1) } : { missing: true };
  const last = pick + want.length - 1;
  const end = offsets[last] + lines[last].length + (find.endsWith("\n") && last + 1 < lines.length ? 1 : 0);
  return { start: offsets[pick], end, how: "indent" };
}

/** The block of lines most like the find text, with line numbers, so the next patch can copy it exactly. */
function nearestBlock(hay: string, find: string): string {
  const want = find.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!want.length) return "";
  const words = new Set(want.join(" ").split(/\W+/).filter((w) => w.length > 2));
  const lines = hay.split("\n");
  const span = Math.min(Math.max(want.length, 1), 12);
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i + span <= lines.length; i++) {
    const score = lines.slice(i, i + span).join(" ").split(/\W+/).filter((w) => words.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) return "";
  const from = Math.max(0, best - 1);
  const block = lines.slice(from, Math.min(lines.length, best + span + 1)).map((l, k) => `${from + k + 1}: ${l}`).join("\n");
  return ` The closest part of the file is below (with line numbers). Copy your find text from it exactly, without the numbers:\n${block}`;
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

/** RFC 6901 JSON pointer set/delete; creates intermediate objects on set. */
export function applyPointer(doc: unknown, pointer: string, op: "set" | "delete", value?: unknown) {
  if (pointer === "" || pointer === "/") throw new Error("Cannot replace the document root");
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON pointer: ${pointer}`);
  const parts = pointer
    .slice(1)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) throw new Error("Forbidden pointer segment");
  let cur = doc as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === undefined || cur[k] === null) {
      if (op === "delete") return;
      cur[k] = {};
    }
    if (typeof cur[k] !== "object") throw new Error(`Pointer segment ${k} is not an object`);
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) {
    const idx = last === "-" ? cur.length : Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx > cur.length) throw new Error(`Invalid array index ${last}`);
    if (op === "delete") cur.splice(idx, 1);
    else cur[idx] = value;
    return;
  }
  if (op === "delete") delete cur[last];
  else cur[last] = value;
}

export { PolicyError };
export type { SnapshotRow };
