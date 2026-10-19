/**
 * Puts a temporary file in place of the target, as a write or a restore does. On Windows a rename can be refused for a
 * moment while another process has the target open (the project's dev server watching it, an indexer, antivirus):
 * EPERM, EBUSY or EACCES. It is tried again after short waits, then the content is copied over the target in place, which
 * those handles usually allow. The temporary file never stays behind.
 *
 * Frameproof: the Gallery step's Undo stopped half-way with "EPERM: operation not permitted, rename" while the project's
 * preview watched src/screens/GalleryScreen.tsx, leaving the step blocked and a .flowcode-restore.tmp file behind.
 */
import fs from "node:fs";

const TRANSIENT = new Set(["EPERM", "EBUSY", "EACCES"]);
const WAITS_MS = [25, 50, 100, 200, 400];
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function replaceWith(tmp: string, target: string, rename: (from: string, to: string) => void = fs.renameSync): void {
  let last: unknown;
  for (const wait of [0, ...WAITS_MS]) {
    if (wait) pause(wait);
    try {
      rename(tmp, target);
      return;
    } catch (err) {
      last = err;
      if (!TRANSIENT.has((err as NodeJS.ErrnoException).code ?? "")) break;
    }
  }
  try {
    if (!TRANSIENT.has((last as NodeJS.ErrnoException).code ?? "")) throw last;
    fs.copyFileSync(tmp, target);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
