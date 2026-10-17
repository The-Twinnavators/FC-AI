/**
 * What an attempt has seen of each file, for the partial-view rewrite guard: replace_file over an existing file needs
 * the agent to have seen all of its current version, or the lines it never saw are lost. Seen means: a whole read_file,
 * ranged reads that together cover every line of the same version, or a packet attachment sent whole (one shortened to
 * fit, or cut at the line cap, covers only its lines). A version is the file's content hash: when the file changes, what
 * was seen of it is stale, except that the agent's own applied edit to a file it had fully seen carries the view
 * forward (it knows what it wrote). Patches don't need any of this: apply_patch checks its find text against the file
 * as it is when it runs.
 */
import { createHash } from "node:crypto";

const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

interface View {
  hash: string;
  lines: number;
  /** Seen line ranges, 1-based and inclusive. */
  ranges: Array<[number, number]>;
}

export class FileViews {
  private views = new Map<string, View>();

  /** Lines `from`..`to` of `content` were shown (the whole file when omitted). */
  saw(rel: string, content: string, from = 1, to?: number) {
    const hash = hashOf(content);
    const lines = content.split("\n").length;
    const v = this.views.get(rel);
    const ranges = v && v.hash === hash ? v.ranges : [];
    this.views.set(rel, { hash, lines, ranges: [...ranges, [Math.max(1, from), Math.min(lines, to ?? lines)]] });
  }

  /** The agent's own edit was applied: a complete view of the version before carries to the version after. */
  edited(rel: string, before: string | undefined, after: string) {
    const complete = before !== undefined && this.missing(rel, before) === undefined;
    if (complete || before === undefined) this.saw(rel, after);
    else this.views.delete(rel);
  }

  /** Undefined when all of `current` has been seen; else what is missing or stale, in words. */
  missing(rel: string, current: string): string | undefined {
    const lines = current.split("\n").length;
    const v = this.views.get(rel);
    if (!v) return `this attempt hasn't seen ${rel} (${lines} lines)`;
    if (v.hash !== hashOf(current)) return `${rel} has changed since this attempt last saw it, so what was seen is stale`;
    const gaps: Array<[number, number]> = [];
    let next = 1;
    for (const [a, b] of [...v.ranges].sort((x, y) => x[0] - y[0])) {
      if (a > next) gaps.push([next, a - 1]);
      next = Math.max(next, b + 1);
    }
    if (next <= lines) gaps.push([next, lines]);
    return gaps.length ? `this attempt has seen only part of ${rel}: lines ${gaps.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ")} of ${lines} are unseen` : undefined;
  }

  /** The hash of what was seen of a file (to recheck after an approval wait). */
  versionOf(rel: string): string | undefined {
    return this.views.get(rel)?.hash;
  }
}

export const contentHash = hashOf;
