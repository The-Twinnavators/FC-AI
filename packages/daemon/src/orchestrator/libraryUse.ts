/**
 * Which component library pieces a build used, and who chose them: FlowCode (by the spec's wording or the planned
 * screens) or an agent (copying a piece from the kept library). The report also says whether each piece ended up in a
 * screen, so the Performance tab can show whether the library is really used, not just added.
 */
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_SECTIONS, type LibrarySection } from "@flowcode/contracts";
import type { Store } from "../db/store.js";
import type { PathJail } from "../security/pathJail.js";
import { flattenFiles } from "../workspace/fileService.js";

export interface LibraryUse {
  id: string;
  name: string;
  /** "flowcode", or the agent role that copied it (coder, debugger…). */
  by: string;
  step: string;
  reason?: string;
  at: string;
}

export interface LibraryUseRow extends LibraryUse {
  /** The piece's file is still in src/sections/. */
  inApp: boolean;
  /** A screen or the app imports it. */
  inScreen: boolean;
  file?: string;
}

export const libraryUseKey = (runId: string) => `libraryUse:${runId}`;

const pascal = (id: string) => id.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");

/** The library piece a file in src/sections/ is: by its file name, or by its component's name when renamed. */
export function pieceOf(rel: string, text = ""): LibrarySection | undefined {
  const base = path.basename(rel).replace(/\.(tsx|jsx)$/, "");
  const fn = /export default function (\w+)/.exec(text)?.[1];
  return LIBRARY_SECTIONS.find((s) => pascal(s.id) === base) ?? (fn ? LIBRARY_SECTIONS.find((s) => pascal(s.id) === fn) : undefined);
}

/** Adds a use, once per piece and chooser. */
export function recordUse(store: Store, runId: string, use: Omit<LibraryUse, "at" | "name">): void {
  const piece = LIBRARY_SECTIONS.find((s) => s.id === use.id);
  if (!piece) return;
  const list = store.getSetting<LibraryUse[]>(libraryUseKey(runId), []);
  if (list.some((u) => u.id === use.id && u.by === use.by)) return;
  store.setSetting(libraryUseKey(runId), [...list, { ...use, name: piece.name, at: new Date().toISOString() }]);
}

/** The src/sections/ files (by name, e.g. ListStacked) that the rest of the app imports. */
export function importedSections(jail: PathJail): Set<string> {
  const importers = flattenFiles(jail, 3000).filter((f) => /^src\/.*\.(tsx|jsx|ts)$/.test(f) && !f.startsWith("src/sections/"));
  const imported = new Set<string>();
  for (const f of importers) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(jail.root, f), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/from\s+["'][./]*(?:[\w/]*\/)?sections\/([\w-]+)["']/g)) imported.add(m[1]!);
  }
  return imported;
}

/** Every recorded use, with where the piece is now. */
export function libraryReport(store: Store, jail: PathJail, runId: string): LibraryUseRow[] {
  const uses = store.getSetting<LibraryUse[]>(libraryUseKey(runId), []);
  const dir = path.join(jail.root, "src/sections");
  const sections = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(tsx|jsx)$/.test(f)).map((f) => {
        const rel = `src/sections/${f}`;
        let text = "";
        try {
          text = fs.readFileSync(path.join(dir, f), "utf8");
        } catch {
          text = "";
        }
        return { rel, id: pieceOf(rel, text)?.id };
      })
    : [];
  const imported = importedSections(jail);
  const usedIn = (file: string) => imported.has(path.basename(file).replace(/\.(tsx|jsx)$/, ""));
  const rows: LibraryUseRow[] = uses.map((u) => {
    const file = sections.find((s) => s.id === u.id)?.rel;
    return { ...u, inApp: !!file, inScreen: !!file && usedIn(file), ...(file ? { file } : {}) };
  });
  // Pieces in the app with no record (added before use was recorded): listed, chooser unknown.
  for (const s of sections) {
    const piece = s.id ? LIBRARY_SECTIONS.find((x) => x.id === s.id) : undefined;
    if (piece && !rows.some((r) => r.id === piece.id)) rows.push({ id: piece.id, name: piece.name, by: "unrecorded", step: "", at: "", inApp: true, inScreen: usedIn(s.rel), file: s.rel });
  }
  return rows;
}
