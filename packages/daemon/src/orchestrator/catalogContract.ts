/**
 * The catalog as agents query it: search by goal, page responsibility or behaviour; resolve an ID strictly (an unknown
 * variant is an error, not its base component); and read a part's full contract - what it is for, how to use it, its
 * variants and versions with their looks, what it is built from and what uses it, the tokens that style it, the file
 * that implements it and its import line. Before this, agents only saw one usage line pushed into their prompt and
 * could add a part, never look one up (the planner, designer and critic had no way in at all).
 */
import path from "node:path";
import { LIBRARY_SECTIONS, levelOf, usedBy, versionsOf, type LibraryLevel, type LibrarySection } from "@flowcode/contracts";
import { fit, intent } from "./screenPicks.js";
import { pieceImport, sectionFile } from "./sectionRecipes.js";

export interface ResolvedId {
  /** The catalog ID asked for, exactly. */
  ref: string;
  /** The library piece that implements it. */
  piece: LibrarySection;
  /** A piece's own ID, one of its variants, a version (its own entry), or another component its file also exports. */
  kind: "piece" | "variant" | "version" | "also";
  /** For a variant or "also" ID: its look, in the catalog's words. */
  look?: string;
}

/**
 * A catalog ID or piece id, exactly. The component a wrapper only shows (sidebar-app is p.side-nav.app) is preferred
 * to the wrapper, as add_library_piece does. Nothing is guessed: "c.button.huge" is not c.button.
 */
export function resolveCatalogId(id: string): ResolvedId | undefined {
  const want = id.trim().replace(/^["'`]|["'`]$/g, "");
  const own = LIBRARY_SECTIONS.find((s) => s.ref === want && !s.uses?.includes(want)) ?? LIBRARY_SECTIONS.find((s) => s.ref === want);
  if (own) return { ref: want, piece: own, kind: own.versionOf ? "version" : "piece" };
  for (const s of LIBRARY_SECTIONS) {
    const v = (s.variants ?? []).find((x) => x.ref === want);
    if (v && s.ref && !s.uses?.includes(want)) return { ref: want, piece: s, kind: "variant", look: v.look };
    for (const a of s.also ?? []) {
      if (a.ref === want) return { ref: want, piece: s, kind: "also", look: a.look };
      const av = (a.variants ?? []).find((x) => x.ref === want);
      if (av) return { ref: want, piece: s, kind: "variant", look: av.look };
    }
  }
  const byId = LIBRARY_SECTIONS.find((s) => s.id === want);
  return byId ? { ref: byId.ref ?? byId.id, piece: byId, kind: byId.versionOf ? "version" : "piece" } : undefined;
}

/** IDs close to an unknown one (the same base's variants and versions, then name matches), for the error message. */
export function nearIds(id: string, max = 8): string[] {
  const base = id.split("@")[0]!.split(".").slice(0, 2).join(".");
  const same = LIBRARY_SECTIONS.filter((s) => s.ref === base || s.versionOf === base).flatMap((s) => [s.ref!, ...(s.variants ?? []).map((v) => v.ref)]);
  return [...new Set(same)].slice(0, max);
}

export interface CatalogContract {
  id: string;
  level: LibraryLevel | "unknown";
  kind: ResolvedId["kind"];
  name: string;
  /** What it does and where to use it. */
  function: string;
  /** How to call it: the props and slots, in the catalog's words. */
  usage: string;
  importLine: string;
  /** The library file that implements it, and the app file add_library_piece puts it in. */
  libraryFile: string;
  appFile: string;
  look: string;
  variants: Array<{ id: string; look: string }>;
  versions: Array<{ id: string; look: string }>;
  versionOf?: string;
  /** Catalog IDs it is built from (add_library_piece brings them too). */
  builtFrom: string[];
  usedBy: string[];
  tokens: string[];
  useCases: string[];
  jobs: string[];
  /** A reference sheet showing every state: browse it, never place it as a screen. */
  referenceSheet: boolean;
  /** What the catalog does not record for this part yet (states, required content, composition rules): say so, don't invent it. */
  notRecorded: string[];
}

export function catalogContract(id: string): CatalogContract | undefined {
  const r = resolveCatalogId(id);
  if (!r) return undefined;
  const p = r.piece;
  const also = r.kind === "also" ? (p.also ?? []).find((a) => a.ref === r.ref) : undefined;
  const base = r.kind === "variant" ? r.ref.split(".").slice(0, 2).join(".") : r.ref;
  return {
    id: r.ref,
    level: levelOf(r.ref) ?? "unknown",
    kind: r.kind,
    name: p.name,
    function: p.description,
    usage: (also?.usage ?? p.usage ?? "").replace(/^import \{[^}]*\} from "[^"]+";\s*/, ""),
    importLine: pieceImport(p),
    libraryFile: `templates/library/sections/${p.id}.tsx`,
    appFile: sectionFile(p.id),
    look: r.look ?? also?.look ?? p.look ?? "",
    variants: (also?.variants ?? p.variants ?? []).map((v) => ({ id: v.ref, look: v.look })),
    versions: versionsOf(base).map((v) => ({ id: v.ref!, look: v.look ?? v.description })),
    versionOf: p.versionOf,
    builtFrom: p.uses ?? [],
    usedBy: usedBy(base).map((u) => u.ref ?? u.id).slice(0, 12),
    tokens: also?.tokens ?? p.tokens ?? [],
    useCases: p.useCases ?? [],
    jobs: p.jobs ?? [],
    referenceSheet: !!p.specimen,
    notRecorded: ["typed props beyond the usage line", "states (see look)", "required content", "composition rules beyond builtFrom"],
  };
}

/** The contract as an agent reads it in a tool result. */
export function contractText(c: CatalogContract): string {
  return [
    `${c.id} (${c.level}${c.kind !== "piece" ? `, ${c.kind}` : ""}): ${c.name}`,
    `Function: ${c.function}`,
    c.usage ? `Use it as: ${c.usage}` : "",
    `Import (after add_library_piece): ${c.importLine}`,
    `Implementation: ${c.libraryFile} → ${c.appFile} in the app`,
    c.look ? `Look: ${c.look}` : "",
    c.variants.length ? `Variants (a prop picks one):\n${c.variants.map((v) => `- ${v.id}: ${v.look}`).join("\n")}` : "",
    c.versions.length ? `Versions (built differently, chosen with version=):\n${c.versions.map((v) => `- ${v.id}: ${v.look}`).join("\n")}` : "",
    c.versionOf ? `Version of: ${c.versionOf}` : "",
    c.builtFrom.length ? `Built from: ${c.builtFrom.join(", ")}` : "",
    c.usedBy.length ? `Used by: ${c.usedBy.join(", ")}` : "",
    c.tokens.length ? `Styled by tokens: ${c.tokens.join(" ")} (change the look through these, never by restyling the part)` : "",
    c.useCases.length ? `Use cases: ${c.useCases.join("; ")}` : "",
    c.jobs.length ? `Jobs: ${c.jobs.join("; ")}` : "",
    c.referenceSheet ? "This entry's file is a reference sheet of every state: use the component it exports (see Use it as), never the sheet itself as a screen." : "",
    `Not recorded in the catalog: ${c.notRecorded.join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface CatalogHit {
  id: string;
  level: LibraryLevel | "unknown";
  name: string;
  score: number;
  /** One line: what it is for. */
  what: string;
}

/**
 * The catalog ranked for a goal, a page's responsibility or a behaviour ("compare plans before choosing", "a list
 * people filter by category"): the same scoring the build's catalog match uses (use cases, jobs, tags, name,
 * description), over every ID including variants and versions. Token sheets aren't parts.
 */
export function searchCatalog(query: string, opts: { level?: LibraryLevel; limit?: number } = {}): CatalogHit[] {
  const screen = { label: "", purpose: query };
  const hits: CatalogHit[] = [];
  for (const s of LIBRARY_SECTIONS) {
    if (!s.ref || s.ref.startsWith("tokens.") || s.uses?.includes(s.ref)) continue;
    const ids = [{ id: s.ref, as: s }, ...(s.variants ?? []).filter((v) => !LIBRARY_SECTIONS.some((x) => x.ref === v.ref)).map((v) => ({ id: v.ref, as: { ...s, name: `${s.name} ${v.ref.slice(s.ref!.length + 1)}`, description: v.look } }))];
    for (const { id, as } of ids) {
      const level = levelOf(id) ?? "unknown";
      if (opts.level && level !== opts.level) continue;
      const score = fit(screen, as) + intent(screen, as);
      if (score > 0) hits.push({ id, level, name: as.name, score, what: (as.description.split(/(?<=\.)\s/)[0] ?? as.description).slice(0, 180) });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, opts.limit ?? 8);
}

export const searchText = (query: string, hits: CatalogHit[]) =>
  hits.length
    ? `Catalog parts for "${query}", best first (call get_catalog_contract with an ID for its full contract):\n${hits.map((h) => `- ${h.id} (${h.level}): ${h.name}. ${h.what}`).join("\n")}`
    : `Nothing in the catalog matches "${query}". Try the job in other words, or a broader level. If nothing fits, say so: that is a catalog gap to record, not a reason to invent a part.`;

/** The piece file name (for checks). */
export const pieceComponent = (p: LibrarySection) => path.basename(sectionFile(p.id), ".tsx");
