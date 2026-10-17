/**
 * The records a complete app actually ships with, read from the source FlowCode generated (src/app/schema.ts: the
 * `schema` and `seed` exports, written as JSON), and checked there: every record the PRD names is present, every kind
 * of record has records, and a look-up app's entries are carried by places that exist. This is the data check for a
 * complete app; the older createCollection count (taskContract data-seeded) only fits apps that seed collections.
 */
import fs from "node:fs";
import path from "node:path";

export interface GeneratedData {
  entities: Array<{ key: string; plural?: string; titleField?: string; idPrefix?: string }>;
  seed: Record<string, Array<Record<string, unknown>>>;
}

/** The JSON value of `export const <name>… = <value>;` in a source file, or undefined when it isn't plain JSON. */
export function exportedJson(src: string, name: string): unknown {
  const m = new RegExp(`export\\s+const\\s+${name}\\b[^=]*=\\s*`).exec(src);
  if (!m) return undefined;
  const start = m.index + m[0].length;
  const open = src[start];
  if (open !== "{" && open !== "[") return undefined;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return ch === close ? JSON.parse(src.slice(start, i + 1)) : undefined;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/** The generated schema and seed of a complete app, or undefined when the app has none (not a complete app). */
export function readGeneratedData(root: string): GeneratedData | undefined {
  let src = "";
  try {
    src = fs.readFileSync(path.join(root, "src/app/schema.ts"), "utf8");
  } catch {
    return undefined;
  }
  const schema = exportedJson(src, "schema") as { entities?: GeneratedData["entities"] } | undefined;
  const seed = exportedJson(src, "seed") as GeneratedData["seed"] | undefined;
  if (!schema?.entities || !seed) return undefined;
  return { entities: schema.entities, seed };
}

/**
 * What the generated data lacks: a kind with no records, a record the PRD names that isn't there (by its entity's
 * title field), a look-up entry the PRD names that no existing place carries. `lookup`: the app model's look-up
 * settings (which entity is looked up, which holds the places, and the field listing them).
 */
export function dataSourceProblems(data: GeneratedData, requiredTitles: string[], lookup?: { entries: string; places: string; placesField: string }): string[] {
  const out: string[] = [];
  for (const e of data.entities) if (!(data.seed[e.key] ?? []).length) out.push(`no ${(e.plural ?? e.key).toLowerCase()} in src/app/schema.ts`);
  const titleOf = (r: Record<string, unknown>, e: GeneratedData["entities"][number]) => String(r[e.titleField ?? "name"] ?? r.name ?? r.title ?? "").trim().toLowerCase();
  const found = new Map<string, { entity: string; record: Record<string, unknown> }>();
  for (const e of data.entities) for (const r of data.seed[e.key] ?? []) if (!found.has(titleOf(r, e))) found.set(titleOf(r, e), { entity: e.key, record: r });
  const placeIds = lookup ? new Set((data.seed[lookup.places] ?? []).map((p) => String(p.id))) : new Set<string>();
  for (const t of requiredTitles) {
    const hit = found.get(t.trim().toLowerCase());
    if (!hit) {
      out.push(`the PRD's record "${t}" isn't in src/app/schema.ts`);
      continue;
    }
    if (lookup && hit.entity === lookup.entries && placeIds.size) {
      const carried = Array.isArray(hit.record[lookup.placesField]) ? (hit.record[lookup.placesField] as unknown[]).map(String).filter((id) => placeIds.has(id)) : [];
      if (!carried.length) out.push(`"${t}" isn't carried by any place in the data (${lookup.placesField} names none that exists)`);
    }
  }
  return out;
}
