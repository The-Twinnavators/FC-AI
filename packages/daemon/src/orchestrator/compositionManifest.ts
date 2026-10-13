/**
 * The composition manifest: per build, what each page is assembled from, as a record rather than a sentence in a
 * prompt. Each entry names the page and section, the exact catalog ID and its version, how it is reused (whole: the
 * part as it is; adapt: the part reshaped for this page; compose: a component put together with others into the
 * section), why it fits, what was adapted, what it depends on, who chose it and whether the app really uses it. A
 * section no catalog part fits is a gap, recorded as one, never dressed up as a selection.
 *
 * Seeded from the screen briefs at planning, added to when an agent puts a part in (add_library_piece), and checked
 * against the app's files (verifyManifest) so "selected" can be told from "used".
 */
import fs from "node:fs";
import path from "node:path";
import { levelOf } from "@flowcode/contracts";
import { resolveCatalogId } from "./catalogContract.js";
import type { CompositionIssue } from "./pageTypes.js";
import type { ScreenBrief } from "./screenBrief.js";
import { sectionFile } from "./sectionRecipes.js";

export type ReuseMode = "whole" | "adapt" | "compose";

export interface ManifestEntry {
  page: string;
  section: string;
  ref: string;
  /** "base", or the version after "@" (c.tabs@folder → "folder"). */
  version: string;
  mode: ReuseMode;
  why: string;
  adaptations: string[];
  /** Catalog IDs it is built from. */
  dependencies: string[];
  /** The library piece and its file in the app. */
  pieceId: string;
  appFile: string;
  by: "plan" | "flowcode" | "coder" | "debugger";
  /** Filled in by verifyManifest. */
  verification?: { inApp: boolean; usedBy: string[]; at: string };
}

export interface ManifestGap {
  page: string;
  section: string;
  reason: string;
}

/**
 * A change to the planned page structure, proposed by the agent building it (propose_layout_change) with its reason.
 * The layout lock lets a step leave a planned section out or swap its part only with one of these; each is shown to
 * the person at review.
 */
export interface LayoutChange {
  page: string;
  section: string;
  change: "remove" | "replace" | "add";
  /** The part it uses instead (replace, add). */
  ref?: string;
  why: string;
  by: string;
  at: string;
}

export interface CompositionManifest {
  entries: ManifestEntry[];
  gaps: ManifestGap[];
  changes?: LayoutChange[];
}

export const compositionKey = (runId: string) => `composition:${runId}`;

/** An entry for a catalog ID, or undefined when the ID isn't in the catalog. */
export function entryFor(ref: string, page: string, section: string, by: ManifestEntry["by"], extra: { mode?: ReuseMode; why?: string; adaptations?: string[] } = {}): ManifestEntry | undefined {
  const r = resolveCatalogId(ref);
  if (!r) return undefined;
  const level = levelOf(r.ref);
  // A page section, pattern or template placed as it is; a component is composed into its section.
  const mode = extra.mode ?? (level === "component" ? "compose" : r.piece.specimen ? "compose" : "whole");
  return {
    page,
    section,
    ref: r.ref,
    version: r.ref.includes("@") ? r.ref.split("@")[1]! : "base",
    mode,
    why: extra.why ?? "",
    adaptations: extra.adaptations ?? [],
    dependencies: r.piece.uses ?? [],
    pieceId: r.piece.id,
    appFile: sectionFile(r.piece.id),
    by,
  };
}

/**
 * The plan's manifest from the screen briefs: each section with a part is an entry (why = the section's purpose); a
 * section the brief's writer named a part for that isn't in the catalog is a gap.
 */
export function manifestFromBriefs(briefs: ScreenBrief[], dropped: Array<{ page: string; section: string; part: string }> = [], issues: CompositionIssue[] = []): CompositionManifest {
  const entries: ManifestEntry[] = [];
  for (const b of briefs)
    for (const x of b.sections) {
      if (!x.part) continue;
      const e = entryFor(x.part, b.screen, x.title, "plan", { why: x.purpose });
      if (e) entries.push(e);
    }
  const gaps = [
    ...dropped.map((d) => ({ page: d.page, section: d.section, reason: `No catalog part fits: "${d.part}" isn't in the catalog. Composed from core components until the catalog has one.` })),
    // The page type's checks (pageTypes.ts): parts that don't belong on the page, and jobs nothing on it does.
    ...issues.map((i) => ({ page: i.page, section: i.section, reason: i.reason })),
  ];
  return { entries, gaps, changes: [] };
}

/** Adds an agent's or FlowCode's choice, replacing an earlier entry for the same page, section and ID. */
export function recordEntry(m: CompositionManifest, e: ManifestEntry): CompositionManifest {
  const same = (x: ManifestEntry) => x.page === e.page && x.section === e.section && x.ref === e.ref;
  return { ...m, entries: [...m.entries.filter((x) => !same(x)), e] };
}

/**
 * Selected or used: for each entry, whether its piece is in the app and which source files import it. A part named in
 * the plan that no file uses is visible as such, instead of counting as a success.
 */
export function verifyManifest(root: string, m: CompositionManifest, at = new Date().toISOString()): CompositionManifest {
  const files: Array<{ rel: string; text: string }> = [];
  const walk = (dir: string, rel: string) => {
    let list: fs.Dirent[] = [];
    try {
      list = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of list) {
      if (d.isDirectory()) {
        if (d.name !== "node_modules" && !d.name.startsWith(".") && d.name !== "sections") walk(path.join(dir, d.name), `${rel}${d.name}/`);
      } else if (/\.(tsx|jsx|ts)$/.test(d.name) && !/\.(test|spec)\./.test(d.name)) files.push({ rel: `${rel}${d.name}`, text: fs.readFileSync(path.join(dir, d.name), "utf8") });
    }
  };
  walk(path.join(root, "src"), "src/");
  return {
    ...m,
    entries: m.entries.map((e) => {
      const name = path.basename(e.appFile, ".tsx");
      const inApp = fs.existsSync(path.join(root, e.appFile));
      const usedBy = files.filter((f) => new RegExp(`from ["'][./]*(?:\\.\\./)*sections/${name}["']`).test(f.text)).map((f) => f.rel);
      return { ...e, verification: { inApp, usedBy, at } };
    }),
  };
}

/** Records a layout change; a replacement part also becomes the section's entry (by the agent). */
export function recordChange(m: CompositionManifest, c: LayoutChange): CompositionManifest {
  const changes = [...(m.changes ?? []).filter((x) => !(x.page === c.page && x.section === c.section)), c];
  let next: CompositionManifest = { ...m, changes };
  if (c.ref) {
    const e = entryFor(c.ref, c.page, c.section, "coder", { why: c.why });
    if (e) next = recordEntry(next, e);
  }
  return next;
}

/**
 * The layout lock: the planned parts (by the plan) on the given pages that no screen uses and no recorded change
 * explains. A design step that leaves one of these is sent back: put the part in, or propose the change with a reason.
 */
export function lockedButMissing(m: CompositionManifest, pages: string[] | "all"): ManifestEntry[] {
  const changed = (e: ManifestEntry) => (m.changes ?? []).some((c) => c.page === e.page && c.section === e.section);
  // A section whose part the agent replaced has a newer entry by the coder; the plan's own entry then doesn't count.
  const replaced = (e: ManifestEntry) => m.entries.some((x) => x !== e && x.by !== "plan" && x.page === e.page && x.section === e.section && !!x.verification?.usedBy.length);
  return m.entries.filter((e) => e.by === "plan" && (pages === "all" || pages.includes(e.page)) && e.verification && !e.verification.usedBy.length && !changed(e) && !replaced(e));
}

/** The manifest as the design steps read it: what each page is made of, and the gaps. */
export function manifestNote(m: CompositionManifest): string {
  if (!m.entries.length && !m.gaps.length) return "";
  const pages = [...new Set([...m.entries.map((e) => e.page), ...m.gaps.map((g) => g.page)])];
  return [
    "Composition manifest (what each page is built from; keep it current: add a part with add_library_piece, naming its page and section):",
    ...pages.map((p) =>
      [
        `## ${p}`,
        ...m.entries.filter((e) => e.page === p).map((e) => `- ${e.section}: ${e.ref}${e.version !== "base" ? "" : ""} (${e.mode})${e.why ? `: ${e.why}` : ""}`),
        ...m.gaps.filter((g) => g.page === p).map((g) => `- ${g.section}: GAP. ${g.reason}`),
      ].join("\n"),
    ),
  ].join("\n");
}
