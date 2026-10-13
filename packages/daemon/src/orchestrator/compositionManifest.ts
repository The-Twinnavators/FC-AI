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
  /**
   * Filled in by verifyManifest. usedBy: files that import the part's file. onPage: whether the page's own screen file
   * uses the part (imports its file or renders one of its components); undefined when the page's file isn't known.
   */
  verification?: { inApp: boolean; usedBy: string[]; onPage?: boolean; at: string };
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

/** The components a part exports, from its usage line (import { Button, ButtonGroup } from "./buttons-variants"). */
export function componentNames(ref: string): string[] {
  const r = resolveCatalogId(ref);
  const usage = [r?.piece.usage ?? "", ...(r?.piece.also ?? []).map((a) => a.usage ?? "")].join(" ");
  return [...new Set([...usage.matchAll(/import \{([^}]*)\}/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/)[0]!.trim())).filter((x) => /^[A-Z]\w*$/.test(x)))];
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
export function verifyManifest(root: string, m: CompositionManifest, at = new Date().toISOString(), pageFiles: Record<string, string> = {}): CompositionManifest {
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
      const importsIt = (text: string) => new RegExp(`from ["'][./]*(?:\\.\\./)*sections/${name}["']`).test(text);
      const usedBy = files.filter((f) => importsIt(f.text)).map((f) => f.rel);
      // On the page: its screen file imports the part, or renders one of the part's components (the starter kit
      // re-exports some, so <EmptyState> from "../components/ui" counts; the kit importing it doesn't).
      const pageFile = pageFiles[e.page];
      const pageText = pageFile ? files.find((f) => f.rel === pageFile)?.text ?? "" : undefined;
      const names = componentNames(e.ref);
      // A part App.tsx renders around every page (the app frame) is on every page (Clean Cart: the look-up frame was
      // planned as Home's top bar and could never be found in HomeScreen).
      const onPage = pageText === undefined ? undefined : importsIt(pageText) || names.some((n) => new RegExp(`<${n}[\\s/>.]`).test(pageText)) || usedBy.includes("src/App.tsx");
      return { ...e, verification: { inApp, usedBy, onPage, at } };
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
  const used = (e: ManifestEntry) => (e.verification?.onPage ?? e.verification?.usedBy.length ?? 0) ? true : false;
  const replaced = (e: ManifestEntry) => m.entries.some((x) => x !== e && x.by !== "plan" && x.page === e.page && x.section === e.section && used(x));
  return m.entries.filter((e) => e.by === "plan" && (pages === "all" || pages.includes(e.page)) && e.verification && !used(e) && !changed(e) && !replaced(e));
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
