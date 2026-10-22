/**
 * The owner's decision on a piece waiting on the Component library's approval shelf (contracts sectionLibrary.ts
 * PROPOSED_SECTIONS). Accept moves its catalog entry into LIBRARY_SECTIONS (dated in ADDED_ON, so it shows as new);
 * Decline removes the entry, the piece's file and its catalog relations (git keeps them). The catalog lives in
 * FlowCode's own source, so this works where FlowCode runs from its repository; the contracts are rebuilt after, and the
 * daemon restarts so builds read the new library.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export interface LibraryDecision {
  id: string;
  decision: "accept" | "decline";
  /** What changed, in plain words. */
  done: string;
}

export function decideProposed(repoRoot: string, id: string, decision: "accept" | "decline", today = new Date().toISOString().slice(0, 10), rebuild = true): LibraryDecision {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Not a piece id");
  const catalog = path.join(repoRoot, "packages/contracts/src/sectionLibrary.ts");
  if (!fs.existsSync(catalog)) throw new Error("FlowCode's source isn't here, so the library can't be changed from this copy.");
  const lines = fs.readFileSync(catalog, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("export const PROPOSED_SECTIONS"));
  const end = lines.findIndex((l, i) => i > start && l.startsWith("];"));
  const at = lines.findIndex((l, i) => i > start && i < end && l.startsWith(`  { id: "${id}",`));
  if (start < 0 || at < 0) throw new Error("That piece isn't waiting for approval.");
  const entry = lines[at]!;
  const ref = /ref: "([^"]+)"/.exec(entry)?.[1];
  lines.splice(at, 1);

  if (decision === "accept") {
    const lib = lines.findIndex((l) => l.startsWith("export const LIBRARY_SECTIONS"));
    const libEnd = lines.findIndex((l, i) => i > lib && l.startsWith("];"));
    lines.splice(libEnd, 0, entry);
    const added = lines.findIndex((l) => l.startsWith("export const ADDED_ON"));
    if (added >= 0) lines.splice(added + 1, 0, `  ${JSON.stringify(id)}: ${JSON.stringify(today)},`);
    fs.writeFileSync(catalog, lines.join("\n"));
  } else {
    fs.writeFileSync(catalog, lines.join("\n"));
    fs.rmSync(path.join(repoRoot, "templates/library/sections", `${id}.tsx`), { force: true });
    // Its relations go too: a declined piece is never offered to a build.
    const relPath = path.join(repoRoot, "packages/contracts/src/catalogRelations.ts");
    if (ref && fs.existsSync(relPath)) {
      const rel = fs.readFileSync(relPath, "utf8").split(/\r?\n/);
      const i = rel.findIndex((l) => l.startsWith(`  ${JSON.stringify(ref)}: {`) && l.trimEnd().endsWith("},"));
      if (i >= 0) {
        rel.splice(i, 1);
        fs.writeFileSync(relPath, rel.join("\n"));
      }
    }
  }
  const done = decision === "accept" ? `Added ${id} to the library.` : `Removed ${id} from the shelf and deleted its file.`;
  // The contracts are what the daemon and the UI read: rebuild them. A build can collide with the one the restart after
  // the previous decision starts (two Accepts in a row): try again after a moment, and if it still fails the decision
  // stands (the catalog is already changed) and the restart that follows builds it.
  if (rebuild) {
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync(process.execPath, [path.join(repoRoot, "node_modules/typescript/bin/tsc"), "-b"], { cwd: path.join(repoRoot, "packages/contracts"), stdio: "ignore", timeout: 180_000 });
        break;
      } catch {
        if (attempt >= 2) return { id, decision, done: `${done} The library finishes updating when FlowCode restarts.` };
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
      }
    }
  }
  return { id, decision, done };
}
