/**
 * A complete app's design step, split by screen when it doesn't fit the coding context: the records' pictures (when
 * the sample records have none), one part per page the app model built, then the frame. Made by FlowCode from its own
 * plan (no model proposes it, no person writes it). Each part works on small files of its own: its screen file and its
 * own stylesheet (the frame: frame.css), never the shared stylesheets, so its later turns fit the window too. Each gets
 * the PRD's requirements FlowCode's prototype plan maps to its screen, the PRD's composition for it first.
 *
 * Frameproof main build: the whole design step overflowed qwen3:8b's context (the whole src/styles folder attached as
 * its own files), the model-proposed split was refused, and the step's rule ("keep those pages, never rebuild them")
 * forbade the photo grid the PRD asks for. A part may recompose its page when the PRD's composition asks for it, on the
 * same store. The app's shared state stays with the later functional steps: a design part leaves it a place.
 */
import type { AppModel } from "./appModel.js";
import { builtViews, screenFileOf } from "./appFiles.js";
import type { SplitPart } from "./stepRecovery.js";

export interface PlannedCoverage {
  files: string[];
  covers: string[];
}
export interface PlanRequirement {
  id: string;
  text: string;
  section: string;
}

const DATA_LINE = "on the same records (store from src/app/store, useRecords and formatValue from src/sections/AppData, go() from src/app/routes to open a record): never a copy of the data in the page";
const MAX_LINES = 36;
const NL = "\n";

/** The record field that holds a picture, when the sample records leave it empty (the screens then need images). */
export function missingImages(m: AppModel): { entity: string; field: string } | undefined {
  for (const e of m.entities) {
    const f = (e as { fields?: Array<{ key: string }> }).fields?.find((x) => /image|photo|picture|thumbnail/i.test(x.key));
    if (!f) continue;
    const rows = m.seed[e.key] ?? [];
    if (rows.length && rows.every((r) => !String(r[f.key] ?? "").trim())) return { entity: e.key, field: f.key };
  }
  return undefined;
}

/** The screen files of the pages that own state (custom pages): they show no records' pictures until that state exists. */
export const customScreenFiles = (m: AppModel) => builtViews(m).filter((v) => v.kind === "custom").map(screenFileOf);

/** The requirement sections that are the app's shared state (the functional sections the plan maps to a state page). */
export function stateSectionsOf(m: AppModel, requirements: PlanRequirement[], coverage: PlannedCoverage[]): Set<string> {
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const customFiles = customScreenFiles(m);
  return new Set(
    coverage
      .filter((c) => c.files.some((f) => customFiles.includes(f)))
      .flatMap((c) => c.covers)
      .map((id) => byId.get(id)?.section)
      .filter((x): x is string => !!x && /^(R\d+\b|journey\b)|\bstate\b/i.test(x)),
  );
}

export function designScreenParts(m: AppModel, requirements: PlanRequirement[], coverage: PlannedCoverage[], prdFile?: string): SplitPart[] | undefined {
  if (m.lookup) return undefined;
  const views = builtViews(m);
  if (!views.length) return undefined;
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const stateSections = stateSectionsOf(m, requirements, coverage);
  const images = missingImages(m);
  const parts: SplitPart[] = [];
  // The records' pictures first, on their own: the data file is the only long file there, and the screens use them.
  if (images)
    parts.push({
      title: "Give the records their pictures",
      objective: [
        `The ${images.entity} records have no pictures yet (${images.field} is empty in src/app/schema.ts). Give each record a distinct local image in public/images (find_image when it can, else a simple local SVG that shows the record's title, shaped to the record), and set ${images.field} in src/app/schema.ts for each record to its file.`,
        "Change nothing else in the records (ids, titles, order and every other value stay exactly as they are), and never use a remote image address at runtime.",
      ].join(NL),
      files: ["src/app/schema.ts", "public/images/"],
    });
  // Pages in a fixed order: lists, then record pages, then the rest (the state page last of the screens).
  const rank = (k: string) => (k === "list" ? 0 : k === "detail" ? 1 : k === "custom" ? 3 : 2);
  for (const v of [...views].sort((a, b) => rank(a.kind) - rank(b.kind))) {
    const file = screenFileOf(v);
    const sheet = `src/styles/${v.id}.css`;
    const ids = new Set(coverage.filter((c) => c.files.includes(file)).flatMap((c) => c.covers));
    // The PRD's own words about this screen first (its composition, its requirement sections), then the rest.
    const label = v.label.toLowerCase();
    const named = (r: PlanRequirement) => r.section.toLowerCase().includes(label);
    const reqs = [...ids].map((id) => byId.get(id)).filter((r): r is PlanRequirement => !!r);
    for (const r of requirements) if (named(r) && !ids.has(r.id)) reqs.push(r);
    reqs.sort((a, b) => Number(named(b)) - Number(named(a)));
    // The app's shared state is built by the later functional steps, on every page including the state page itself:
    // a design part composes the page and leaves that behaviour a place.
    const later = (r: PlanRequirement) => stateSections.has(r.section);
    const now = reqs.filter((r) => !later(r)).slice(0, MAX_LINES);
    // Named by section (all of them, compactly): the page leaves each a place.
    const leave = [...new Set(reqs.filter(later).map((r) => r.section))];
    const line = (r: PlanRequirement) => `- ${r.id} (${r.section}): ${r.text.length > 220 ? `${r.text.slice(0, 217)}…` : r.text}`;
    parts.push({
      title: `Design the ${v.label} screen`,
      objective: [
        `Design the ${v.label} screen in ${file} as a finished page of ${m.product}, ${DATA_LINE}.`,
        "Build it to the PRD's requirements for this screen below (its composition first). When the PRD's composition differs from the page FlowCode wrote (for example a photo grid in place of a table), recompose the page in this file on the same store; keep working behaviour working (search, filters, opening a record, going back).",
        `Its styles go in ${sheet} (import it in ${file}), from the applied Look's tokens (src/styles/tokens.css): never invent colour values or add a font, and leave the shared stylesheets as they are. Read other files with read_file when you need them.`,
        images && v.entity === images.entity ? `Each record's picture is the file named in its ${images.field} (public/images): show it with the record's alt text.` : "",
        now.length ? `The PRD's requirements for this screen${prdFile ? ` (the PRD is ${prdFile})` : ""}:${NL}${now.map(line).join(NL)}` : "",
        leave.length ? `The app's shared state and these behaviours are built by later steps, not in this page: leave them a place, with no fake data, no copy of the state and no dead controls: ${leave.join("; ")}.` : "",
        `Run the app and look at the ${v.label} screen at desktop and phone width before you finish.`,
      ]
        .filter(Boolean)
        .join(NL),
      files: [file, sheet],
    });
  }
  parts.push({
    title: "Design the frame",
    objective: [
      `Give the app frame ${m.product}'s look in src/styles/frame.css (import it in src/App.tsx, after its other imports): restyle the frame's own fl-af-* rules (rail, top bar, navigation) from the applied Look's tokens, as quiet chrome around the content.`,
      "Never invent colour values or add a font; change no screen's behaviour, routes or data, and leave the shared stylesheets as they are. Read the screens with read_file to check them.",
      "Run the app and look at every screen at desktop and phone width before you finish.",
    ].join(NL),
    files: ["src/styles/frame.css", "src/App.tsx"],
  });
  return parts;
}
