/**
 * A complete app's design step, split by screen when it doesn't fit the coding context: one part per page the app
 * model built, then one for the frame and shared styles. Made by FlowCode from its own plan (no model proposes it, no
 * person writes it): each part owns its screen file and gets the PRD's requirements FlowCode's prototype plan already
 * maps to that screen, the PRD's composition for it first.
 *
 * Frameproof main build: the whole design step overflowed qwen3:8b's context (the whole src/styles folder attached as
 * its own files), the model-proposed split was refused, and the step's rule ("keep those pages, never rebuild them")
 * forbade the photo grid the PRD asks for. A part may recompose its page when the PRD's composition asks for it, on the
 * same store; behaviour that needs state later steps own is left a place, never faked.
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

export function designScreenParts(m: AppModel, requirements: PlanRequirement[], coverage: PlannedCoverage[], prdFile?: string): SplitPart[] | undefined {
  if (m.lookup) return undefined;
  const views = builtViews(m);
  if (!views.length) return undefined;
  const byId = new Map(requirements.map((r) => [r.id, r]));
  // A functional requirement section the plan also maps to a custom page (the page that owns the app's state, e.g.
  // My Selection) is that state's behaviour: a list or detail page leaves it a place for the later steps that build it.
  const customFiles = views.filter((v) => v.kind === "custom").map(screenFileOf);
  const stateSections = new Set(coverage.filter((c) => c.files.some((f) => customFiles.includes(f))).flatMap((c) => c.covers).map((id) => byId.get(id)?.section).filter((x): x is string => !!x && /^(R\d+\b|journey\b)/i.test(x)));
  const images = missingImages(m);
  const parts: SplitPart[] = [];
  for (const v of views) {
    const file = screenFileOf(v);
    const ids = new Set(coverage.filter((c) => c.files.includes(file)).flatMap((c) => c.covers));
    // The PRD's own words about this screen first (its composition, its requirement sections), then the rest.
    const label = v.label.toLowerCase();
    const named = (r: PlanRequirement) => r.section.toLowerCase().includes(label);
    const reqs = [...ids].map((id) => byId.get(id)).filter((r): r is PlanRequirement => !!r);
    for (const r of requirements) if (named(r) && !ids.has(r.id)) reqs.push(r);
    reqs.sort((a, b) => Number(named(b)) - Number(named(a)));
    const later = (r: PlanRequirement) => v.kind !== "custom" && stateSections.has(r.section);
    const now = reqs.filter((r) => !later(r)).slice(0, MAX_LINES);
    const leave = reqs.filter(later).slice(0, 8);
    const line = (r: PlanRequirement) => `- ${r.id} (${r.section}): ${r.text.length > 220 ? `${r.text.slice(0, 217)}…` : r.text}`;
    const imageNote =
      images && v.kind === "list" && v.entity === images.entity
        ? `\nThe records have no pictures yet (${images.entity}.${images.field} is empty): give each record a distinct local image in public/images (find_image when it can, else a simple local SVG showing the record's title, shaped to the record), set ${images.field} in src/app/schema.ts for each record (change nothing else there), and never use a remote image address at runtime.`
        : "";
    const files = [file, ...(imageNote ? ["src/app/schema.ts", "public/images/"] : [])];
    parts.push({
      title: `Design the ${v.label} screen`,
      objective: [
        `Design the ${v.label} screen in ${file} as a finished page of ${m.product}, ${DATA_LINE}.`,
        "Build it to the PRD's requirements for this screen below (its composition first). When the PRD's composition differs from the page FlowCode wrote (for example a photo grid in place of a table), recompose the page in this file on the same store; keep working behaviour working (search, filters, opening a record, going back).",
        "Look: the applied Look's tokens (src/styles/tokens.css) and the classes in src/styles/components.css; never invent colour values or add a font. Read other files with read_file when you need them.",
        now.length ? `The PRD's requirements for this screen${prdFile ? ` (the PRD is ${prdFile})` : ""}:\n${now.map(line).join("\n")}` : "",
        leave.length ? `Later steps add the shared state these need; leave them a place, with no fake data or dead controls:\n${leave.map(line).join("\n")}` : "",
        imageNote,
        `Run the app and look at the ${v.label} screen at desktop and phone width before you finish.`,
      ]
        .filter(Boolean)
        .join("\n"),
      files,
    });
  }
  parts.push({
    title: "Design the frame and shared styles",
    objective: [
      `Give the app frame (its fl-af-* rules) and the shared classes in src/styles/components.css ${m.product}'s look, from the applied Look's tokens only: quiet chrome around the content, the screens consistent with each other.`,
      "Never invent colour values or add a font; change no screen's behaviour or data. Read the screens with read_file to check them.",
      "Run the app and look at every screen at desktop and phone width before you finish.",
    ].join("\n"),
    files: ["src/styles/components.css"],
  });
  return parts;
}
