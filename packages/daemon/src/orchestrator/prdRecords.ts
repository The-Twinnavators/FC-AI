/**
 * The records a PRD gives explicitly, wherever they are: every Markdown table that holds records (a table of rows, or
 * one record as a Field | Value table), found by what it holds rather than by its heading's exact words (Frameproof
 * planning: the heading "Data model and sample content" wasn't recognised, so the 12 photos the PRD lists as "these
 * exact records" never reached the sample-record step, and the app model got 14 invented ones).
 *
 *  - A table is matched to a kind of record by its heading and its columns; its columns to fields by label or key.
 *  - "Exact" tables (the PRD says to use these records, or gives one record field by field) are the records: their
 *    IDs, titles, values, order and count survive into the app model (enforceRecords), and nothing is added to them.
 *  - Other tables are sample records that come first, with others added after them (the earlier behaviour).
 *  - recordProblems checks an assembled app model against them, for the plan's compliance findings.
 */
import type { AppModel, ModelEntity } from "./appModel.js";

type Row = Record<string, unknown>;

export interface PrdRecordTable {
  /** The heading the table sits under, and the headings above it. */
  heading: string;
  path: string[];
  /** "rows": one record per row; "fields": one record, a field per row (| Field | Value |). */
  shape: "rows" | "fields";
  columns: string[];
  /** Each record as the PRD writes it: column (or field) label → value. */
  records: Array<Record<string, string>>;
  /** The PRD asks for exactly these records ("use these exact records"), or gives one record field by field. */
  exact: boolean;
  /** The table as the PRD writes it, for a model that fills the fields the PRD leaves out. */
  markdown: string;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const clean = (c: string) => c.trim().replace(/[*_`]/g, "");
const cellsOf = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(clean);
const isSeparator = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");
/** Tables about something other than records: screens, people and roles, navigation, plans, decisions. */
const NOT_RECORDS = /\b(screens?|pages?|views?|navigation|people|personas?|roles?|users?|who|stories|milestones?|sprints?|timeline|risks?|decisions?|questions?|glossary|metrics?|kpis?|requirements?|acceptance|states?)\b/i;
const RECORDS = /\b(records?|data|sample|seed|fixtures?|catalog(ue)?|inventory|content|entries|items?)\b/i;
const EXACT = /\b(use (these|the following) (exact )?(records|rows|items|data)|these exact records|exactly these|only these records|the following records exactly)\b/i;
const ID_COLUMN = /^(id|identifier|key|code|sku|slug)$/i;

/** Every table in the PRD that holds records. */
export function prdRecordTables(md: string): PrdRecordTable[] {
  const lines = md.split(/\r?\n/);
  const out: PrdRecordTable[] = [];
  const headings: Array<{ level: number; text: string }> = [];
  let prose = "";
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]!);
    if (h) {
      while (headings.length && headings.at(-1)!.level >= h[1]!.length) headings.pop();
      headings.push({ level: h[1]!.length, text: h[2]!.replace(/^\d+(\.\d+)*[.)]?\s*/, "").trim() });
      prose = "";
      continue;
    }
    if (!/^\s*\|/.test(lines[i]!) || !isSeparator(lines[i + 1] ?? "")) {
      if (lines[i]!.trim()) prose += `${lines[i]}\n`;
      continue;
    }
    const start = i;
    const columns = cellsOf(lines[i]!);
    const body: string[][] = [];
    for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]!); i++) body.push(cellsOf(lines[i]!));
    const markdown = lines.slice(start, i).join("\n");
    i--;
    const heading = headings.at(-1)?.text ?? "";
    const path = headings.map((x) => x.text);
    const where = path.join(" / ");
    // Records by where they are (a data or records heading, or prose that says so) or by what they hold (an ID column).
    const hasId = columns.some((c) => ID_COLUMN.test(c));
    const fieldsTable = columns.length === 2 && /^(field|attribute|property|name)$/i.test(columns[0]!) && /^(value|example|sample)$/i.test(columns[1]!);
    if (NOT_RECORDS.test(heading) && !RECORDS.test(heading) && !hasId) continue;
    if (!RECORDS.test(where) && !RECORDS.test(prose) && !hasId && !fieldsTable) continue;
    if (!body.length) continue;
    if (fieldsTable) {
      const rec: Record<string, string> = {};
      for (const [k, v] of body) if (k && v !== undefined) rec[k] = v;
      out.push({ heading, path, shape: "fields", columns: body.map((r) => r[0]!).filter(Boolean), records: [rec], exact: true, markdown });
    } else {
      out.push({ heading, path, shape: "rows", columns, records: body.map((r) => Object.fromEntries(columns.map((c, j) => [c, r[j] ?? ""]))), exact: EXACT.test(prose), markdown });
    }
    prose = "";
  }
  return out;
}

/** The field a column holds: by label or key, the title field for a title or name column, "id" for an ID column. */
function fieldOf(e: ModelEntity, column: string, first: boolean): string | undefined {
  const n = norm(column);
  const direct = e.fields.find((f) => norm(f.label) === n || norm(f.key) === n || norm(f.key.replace(/([a-z])([A-Z])/g, "$1 $2")) === n);
  if (direct) return direct.key;
  if (ID_COLUMN.test(column)) return "id";
  if (/^(title|name)$/i.test(column) || (first && (norm(e.label) === n || norm(e.plural) === n))) return e.titleField;
  return undefined;
}

/** How well a table fits a kind of record: its heading names the kind, and its columns are the kind's fields. */
function fit(e: ModelEntity, t: PrdRecordTable): number {
  const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
  const names = new Set([...words(e.label), ...words(e.plural), ...words(e.key)]);
  const singular = (w: string) => w.replace(/(ies)$/, "y").replace(/s$/, "");
  const heading = [...words(t.heading)].some((w) => names.has(w) || names.has(singular(w))) ? 3 : 0;
  const cols = t.columns.filter((c, j) => fieldOf(e, c, j === 0)).length;
  return cols >= 2 ? heading + cols : 0;
}

/** The PRD's table for this kind of record, if one fits it better than any other kind. */
export function tableFor(e: ModelEntity, entities: ModelEntity[], tables: PrdRecordTable[]): PrdRecordTable | undefined {
  let best: { t: PrdRecordTable; score: number } | undefined;
  for (const t of tables) {
    const score = fit(e, t);
    if (!score) continue;
    if (entities.some((o) => o !== e && fit(o, t) > score)) continue;
    if (!best || score > best.score) best = { t, score };
  }
  return best?.t;
}

/** The table's records as this kind's rows (field key → value), the PRD's ID kept as `id`. */
export function tableRows(e: ModelEntity, t: PrdRecordTable): Row[] {
  return t.records.map((rec) => {
    const row: Row = {};
    Object.entries(rec).forEach(([col, v], j) => {
      const key = fieldOf(e, col, t.shape === "rows" && j === 0);
      if (key && v !== "") row[key] = v;
    });
    if (typeof row.id === "string") row.__prdId = row.id;
    return row;
  });
}

/**
 * The PRD's records made the kind's records: each in the PRD's order with the PRD's values (the model's version of it,
 * matched by ID or title, fills only the fields the PRD leaves out); for an exact table nothing else is kept. Returns
 * what was done, for the build log.
 */
export function enforceRecords(e: ModelEntity, rows: Row[], prd: Row[], exact: boolean): { rows: Row[]; notes: string[] } {
  const notes: string[] = [];
  const used = new Set<Row>();
  const out = prd.map((p) => {
    const match = rows.find((r) => !used.has(r) && ((p.__prdId && norm(r.id) === norm(p.__prdId)) || norm(r[e.titleField]) === norm(p[e.titleField])));
    if (match) used.add(match);
    else notes.push(`${e.label} "${String(p[e.titleField] ?? p.__prdId)}" written from the PRD alone (the model's records didn't include it)`);
    const changed = match ? Object.keys(p).filter((k) => k !== "__prdId" && norm(match[k]) !== norm(p[k])) : [];
    if (changed.length) notes.push(`${e.label} "${String(p[e.titleField])}": the PRD's ${changed.join(", ")} kept over the model's`);
    return { ...(match ?? {}), ...p };
  });
  const extra = rows.filter((r) => !used.has(r));
  if (exact && extra.length) notes.push(`${extra.length} ${e.plural.toLowerCase()} the PRD doesn't list left out (it lists exactly these): ${extra.map((r) => String(r[e.titleField])).slice(0, 8).join(", ")}`);
  return { rows: exact ? out : [...out, ...extra], notes };
}

/** An app model checked against the PRD's records: every kind the PRD gives exactly has those records, in order. */
export function recordProblems(m: AppModel, tables: PrdRecordTable[]): string[] {
  const problems: string[] = [];
  for (const t of tables.filter((x) => x.exact)) {
    const e = m.entities.find((x) => tableFor(x, m.entities, [t]) === t);
    if (!e) {
      problems.push(`The PRD's ${t.heading || "records"} table (${t.records.length} record${t.records.length === 1 ? "" : "s"}) matches no kind of record in the app model`);
      continue;
    }
    const want = tableRows(e, t);
    const have = m.seed[e.key] ?? [];
    if (have.length !== want.length) problems.push(`${e.plural}: ${have.length} records; the PRD gives exactly ${want.length}`);
    want.forEach((w, i) => {
      const h = have[i];
      const label = String(w[e.titleField] ?? w.__prdId);
      if (!h) return;
      if (w.__prdId && String(h.id) !== String(w.__prdId)) problems.push(`${e.plural} #${i + 1}: id ${String(h.id)}, the PRD's is ${String(w.__prdId)}`);
      for (const [k, v] of Object.entries(w)) if (k !== "__prdId" && k !== "id" && norm(h[k]) !== norm(v)) problems.push(`${e.plural} #${i + 1} (${label}): ${k} is "${String(h[k] ?? "")}", the PRD says "${String(v)}"`);
    });
  }
  return problems;
}
