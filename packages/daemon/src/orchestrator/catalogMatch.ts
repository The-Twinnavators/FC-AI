/**
 * The catalog matched to a PRD, once per run, deterministically: every catalog ID (a piece, a component's variant, a
 * version) is scored against the PRD's words and each planned screen's name and purpose, on the catalog's use cases,
 * jobs, tags, name and description (the same scoring the screen picks use). The result is the run's catalog list:
 * for each screen, the best ID of each kind with the next-best options of the same kind, and the IDs the PRD as a
 * whole calls for. The builders read this list instead of guessing from each step's wording, and when the visual
 * review sends a screen back it names the next option on the list rather than leaving the agent to restyle by hand.
 */
import { LIBRARY_SECTIONS, SECTION_CATEGORIES, type LibrarySection } from "@flowcode/contracts";
import { WEBSITE, evident, fit, intent } from "./screenPicks.js";
import type { PlannedScreen } from "./screenPlan.js";
import { briefLine, catalogBrief } from "./sectionRecipes.js";

export interface CatalogMatch {
  /** The catalog ID (c.tabs.pills, p.plan-comparison, c.tabs@folder). */
  ref: string;
  /** The library piece that implements it (what add_library_piece copies). */
  id: string;
  name: string;
  score: number;
  /** What it matched, in the catalog's words: a use case, a job, or tags. */
  why: string;
}
export interface ScreenMatch {
  screen: string;
  picks: CatalogMatch[];
  /** Next-best options, best first: the same kinds as the picks, for when a pick doesn't work out. */
  alternates: CatalogMatch[];
}
export interface CatalogManifest {
  screens: ScreenMatch[];
  /** IDs the PRD as a whole calls for (a use case or job it names), whichever screen ends up holding them. */
  shared: CatalogMatch[];
}

export const catalogManifestKey = (runId: string) => `catalogManifest:${runId}`;
/** The IDs the visual review has already offered as a next option, so it never offers one twice. */
export const catalogTriedKey = (runId: string) => `catalogTried:${runId}`;

interface Entry {
  ref: string;
  piece: LibrarySection;
  /** The fields scored: a variant reads as its piece with its own look as the description. */
  as: LibrarySection;
  kind: string;
}

/** Every catalog ID once: each piece's own ID, and each variant that has no piece of its own. Token sheets aren't parts. */
function entries(): Entry[] {
  const own = new Set(LIBRARY_SECTIONS.map((s) => s.ref).filter(Boolean));
  const out: Entry[] = [];
  for (const s of LIBRARY_SECTIONS) {
    if (!s.ref || s.ref.startsWith("tokens.")) continue;
    // A wrapper that only shows another piece's variant (sidebar-app is p.side-nav.app) is the same part: kept once.
    if (s.uses?.includes(s.ref)) continue;
    // Whole pages are one kind: a screen takes one, the others are its next-best options.
    const kind = s.ref.startsWith("t.") ? "t" : `${s.ref[0]}:${s.category}`;
    out.push({ ref: s.ref, piece: s, as: s, kind });
    for (const v of s.variants ?? []) {
      if (own.has(v.ref)) continue;
      const tail = v.ref.slice(s.ref.length + 1).replace(/-/g, " ");
      out.push({ ref: v.ref, piece: s, as: { ...s, name: `${s.name} ${tail}`, description: v.look, tags: [...s.tags, tail] }, kind });
    }
  }
  return out;
}

/** In the catalog's own words, what an entry matched in this text. */
function why(text: string, e: Entry): string {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const use = (e.as.useCases ?? []).find((u) => t.includes(` ${u.toLowerCase()} `));
  if (use) return `use case "${use}"`;
  const job = (e.as.jobs ?? []).find((j) => j.split(" ").filter((w) => w.length > 3 && t.includes(` ${w} `)).length >= Math.ceil(j.split(" ").filter((w) => w.length > 3).length * 0.75));
  if (job) return `job "${job}"`;
  const tags = e.as.tags.filter((g) => t.includes(` ${g.toLowerCase()} `)).slice(0, 3);
  return tags.length ? `tags ${tags.join(", ")}` : "its words";
}

const groupOf = new Map(SECTION_CATEGORIES.map((c) => [c.id, c.group]));
/** A whole website or landing page (not an app screen template): only for a screen of a website. */
const siteTemplate = (e: Entry) => groupOf.get(e.piece.category) === "template" && e.piece.category !== "apptemplates";

const toMatch = (e: Entry, score: number, text: string): CatalogMatch => ({ ref: e.ref, id: e.piece.id, name: e.as.name, score, why: why(text, e) });

/**
 * The run's catalog list. Per screen: up to four kinds, the best ID of each (a clear match only), then up to two next-best
 * IDs of each of those kinds. The PRD's own use cases and jobs add a bonus, so a part the whole spec asks for ranks
 * first on the screen that can hold it.
 */
export function matchCatalog(prd: string, screens: Pick<PlannedScreen, "label" | "purpose">[], min = 6): CatalogManifest {
  const all = entries();
  const spec = { label: "", purpose: prd.slice(0, 8000) };
  const prdIntent = new Map(all.map((e) => [e.ref, intent(spec, e.as)]));
  const shared = all
    .filter((e) => (prdIntent.get(e.ref) ?? 0) >= 7 && !e.ref.startsWith("t."))
    .sort((a, b) => prdIntent.get(b.ref)! - prdIntent.get(a.ref)!)
    .slice(0, 10)
    .map((e) => toMatch(e, prdIntent.get(e.ref)!, prd));
  const out: ScreenMatch[] = [];
  for (const screen of screens) {
    const text = `${screen.label} ${screen.purpose}`;
    const site = WEBSITE.test(text);
    const ranked = all
      .filter((e) => site || !siteTemplate(e))
      .map((e) => ({ e, score: fit(screen, e.as) + ((prdIntent.get(e.ref) ?? 0) >= 6 ? 2 : 0) }))
      .filter((r) => r.score >= min)
      .sort((a, b) => b.score - a.score || a.e.ref.localeCompare(b.e.ref));
    // A pick needs real evidence (evident); a next-best option, offered only once the review turns a pick down, needs
    // the same kind as a pick and a little intent (some of a use case or job), not the full bar.
    const picks: { e: Entry; score: number }[] = [];
    for (const r of ranked) if (picks.length < 4 && !picks.some((p) => p.e.kind === r.e.kind) && evident(screen, r.e.as, r.score, min)) picks.push(r);
    const alternates = picks.flatMap((p) => ranked.filter((r) => r.e.kind === p.e.kind && r !== p && (evident(screen, r.e.as, r.score, min) || intent(screen, r.e.as) >= 3)).slice(0, 2));
    out.push({ screen: screen.label, picks: picks.map((r) => toMatch(r.e, r.score, text)), alternates: alternates.map((r) => toMatch(r.e, r.score, text)) });
  }
  return { screens: out, shared };
}

const byRef = new Map<string, LibrarySection>();
const pieceOfRef = (m: CatalogMatch) => {
  if (!byRef.size) for (const s of LIBRARY_SECTIONS) if (s.ref && !byRef.has(s.ref)) byRef.set(s.ref, s);
  return byRef.get(m.ref) ?? LIBRARY_SECTIONS.find((s) => s.id === m.id);
};

/**
 * The catalog as a build step reads it: the core components, then this run's matched IDs for the screens the step names
 * (all screens when it names none), each with its next-best options, then the IDs the whole PRD calls for.
 */
export function manifestBrief(manifest: CatalogManifest, stepText: string, maxChars = 3800): string {
  const step = stepText.toLowerCase();
  const named = manifest.screens.filter((s) => step.includes(s.screen.toLowerCase()));
  const screens = named.length ? named : manifest.screens;
  const line = (m: CatalogMatch, max: number) => {
    const p = pieceOfRef(m);
    return p ? briefLine({ ...p, ref: m.ref }, max) : `- ${m.ref}: ${m.name}`;
  };
  const head = catalogBrief("", maxChars).replace("# FlowCode catalog", "# FlowCode catalog (matched to this PRD)");
  const body: string[] = ["", "## Matched to this build's screens (use these IDs; the next-best options are for when one doesn't fit)"];
  for (const s of screens) {
    if (!s.picks.length) continue;
    body.push(`### ${s.screen}`, ...s.picks.map((m) => line(m, 170)));
    const next = s.alternates.filter((a) => !s.picks.some((p) => p.ref === a.ref)).slice(0, 4);
    if (next.length) body.push(`  next best: ${next.map((a) => a.ref).join(", ")}`);
  }
  const extra = manifest.shared.filter((m) => !screens.some((s) => s.picks.some((p) => p.ref === m.ref))).slice(0, 6);
  if (extra.length) body.push("", "## The PRD also calls for", ...extra.map((m) => line(m, 150)));
  let out = [head, ...body].join("\n");
  while (out.length > maxChars && body.length > 2) {
    body.pop();
    out = [head, ...body].join("\n");
  }
  return out.slice(0, maxChars);
}

/**
 * The next catalog option for a screen the visual review sent back: the best alternate for it not offered before, or
 * nothing (the review's own words are then the prompt).
 */
export function nextBest(manifest: CatalogManifest, screen: string, tried: string[]): CatalogMatch | undefined {
  const s = manifest.screens.find((x) => x.screen.toLowerCase() === screen.toLowerCase()) ?? manifest.screens.find((x) => screen.toLowerCase().includes(x.screen.toLowerCase()));
  return s?.alternates.find((a) => !tried.includes(a.ref) && !s.picks.some((p) => p.ref === a.ref));
}

/** The manifest in a sentence, for the build's log. */
export function manifestSummary(manifest: CatalogManifest): string {
  const ids = new Set([...manifest.screens.flatMap((s) => s.picks.map((p) => p.ref)), ...manifest.shared.map((m) => m.ref)]);
  const alts = new Set(manifest.screens.flatMap((s) => s.alternates.map((a) => a.ref)));
  return `Matched the PRD to the catalog: ${ids.size} part${ids.size === 1 ? "" : "s"} for ${manifest.screens.length} screen${manifest.screens.length === 1 ? "" : "s"}, ${alts.size} next-best option${alts.size === 1 ? "" : "s"}${manifest.screens.length ? ` (${manifest.screens.map((s) => `${s.screen}: ${s.picks.map((p) => p.ref).join(", ") || "none"}`).join("; ")})` : ""}`;
}
