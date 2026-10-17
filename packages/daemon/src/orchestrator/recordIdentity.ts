/**
 * Which sample records are the same record, so batches of them merge without duplicates and without silently losing
 * the PRD's own records (Clean Cart slice eval 1: the PRD's six products were asked for in every batch of ten, so the
 * catalog showed each of them twice).
 *
 * A record's identity comes from the domain model: an explicit identifier field when the kind of record has one (sku,
 * code, a field named …Id or …Number), and always a composite of its title and its required short fields (text,
 * select, email; not long text or descriptions), so two products of the same name from different brands are both kept.
 * Nothing is dropped without a recorded reason, and nothing is invented to replace what's missing.
 */
import type { ModelEntity } from "./appModel.js";

type Row = Record<string, unknown>;

const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const IDENTIFIER = /^(sku|upc|ean|gtin|isbn|code|ref|reference|slug)$|(Id|ID|Code|Number|Sku|SKU)$/;
const DESCRIPTIVE = /desc|note|summary|ingredient|comment|bio|about|detail|instruction|text|body|content/i;

/** The kind of record's explicit identifier field, if its model has one. */
export function identifierField(e: ModelEntity): string | undefined {
  return e.fields.find((f) => (f.type === "text" || f.type === "number") && IDENTIFIER.test(f.key) && f.key !== e.titleField)?.key;
}

/** The fields whose values together say which record it is: the title, the subtitle and the required short fields. */
export function compositeFields(e: ModelEntity): string[] {
  const id = identifierField(e);
  const short = e.fields.filter((f) => f.key !== e.titleField && f.key !== id && f.required && (f.type === "text" || f.type === "select" || f.type === "email") && !DESCRIPTIVE.test(f.key) && f.key !== e.statusField).map((f) => f.key);
  return [...new Set([e.titleField, ...(e.subtitleField && !DESCRIPTIVE.test(e.subtitleField) ? [e.subtitleField] : []), ...short])];
}

export const compositeKey = (e: ModelEntity, row: Row) => compositeFields(e).map((k) => norm(row[k])).join(" | ");
const title = (e: ModelEntity, row: Row) => String(row[e.titleField] ?? "").trim() || "(untitled)";
/** The values that describe the record (not its status or the places carrying it), to tell a repeat from a conflict. */
const values = (e: ModelEntity, row: Row) => e.fields.filter((f) => f.key !== e.statusField).map((f) => norm(row[f.key])).join(" | ");

/**
 * The PRD's sample-data table rows as records of this kind: each column matched to a field by its label or key (the
 * first column is the title), so a clash involving one of the PRD's records is settled by the PRD's own values.
 */
export function prdFixtureRows(e: ModelEntity, section: string): Row[] {
  const lines = section.split(/\r?\n/).filter((l) => /^\s*\|/.test(l));
  const cells = (l: string) => l.split("|").slice(1, -1).map((c) => c.trim().replace(/[*_`]/g, ""));
  const out: Row[] = [];
  let header: Array<string | undefined> | undefined;
  for (let i = 0; i < lines.length; i++) {
    if (/^[\s|:-]+$/.test(lines[i]!)) continue;
    if (/^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      header = cells(lines[i]!).map((h, j) => (j === 0 ? e.titleField : e.fields.find((f) => norm(f.label) === norm(h) || norm(f.key) === norm(h))?.key));
      continue;
    }
    if (!header) continue;
    const row: Row = {};
    cells(lines[i]!).forEach((c, j) => header![j] && (row[header![j]!] = c));
    out.push(row);
  }
  return out;
}

/** Whether a record carries the PRD row's values (every column the PRD gives that maps to a field). */
const agrees = (row: Row, prd: Row) => Object.entries(prd).every(([k, v]) => norm(row[k]) === norm(v));

export interface MergeResult {
  rows: Row[];
  /** Identities held out: records that clash and can't be settled; any later record with that identity is held out too. */
  held: string[];
  /** Exact repeats collapsed into one. */
  repeats: string[];
  /** Clashes and how each was settled (by the PRD's values, or by holding both versions out). */
  conflicts: string[];
}

/**
 * Adds a batch to the records so far. An exact repeat is collapsed (said). A clash (the same identity with different
 * values, one identifier on two records, one record under two identifiers, or no identity at all) is never settled by
 * keeping whichever came first: when it is one of the PRD's records, the version with the PRD's values is kept;
 * otherwise neither version is kept, both are held out (said), and the batches that follow fill the place with other
 * records. Records that differ in any identity field (another brand, another certification) are separate records.
 */
export function mergeRecords(e: ModelEntity, kept: Row[], incoming: Row[], opts: { held?: string[]; prdRows?: Row[] } = {}): MergeResult {
  let rows = [...kept];
  const held = new Set(opts.held ?? []);
  const repeats: string[] = [];
  const conflicts: string[] = [];
  const idField = identifierField(e);
  const prdFor = (row: Row) => (opts.prdRows ?? []).find((p) => norm(p[e.titleField]) === norm(row[e.titleField]));
  for (const row of incoming) {
    const key = compositeKey(e, row);
    if (!norm(row[e.titleField])) {
      conflicts.push(`a record with no ${e.titleField} can't be identified; held out`);
      continue;
    }
    const own = prdFor(row);
    if (held.has(key) && !(own && agrees(row, own))) {
      conflicts.push(`"${title(e, row)}" again, an identity already held out for clashing; held out`);
      continue;
    }
    const id = idField ? norm(row[idField]) : "";
    const sameId = id ? rows.find((r) => norm(r[idField!]) === id) : undefined;
    const sameKey = rows.find((r) => compositeKey(e, r) === key);
    const other = sameId ?? sameKey;
    if (!other) {
      rows.push(row);
      continue;
    }
    if (values(e, other) === values(e, row) && (!idField || norm(other[idField]) === id)) {
      repeats.push(title(e, row));
      continue;
    }
    const what =
      sameId && compositeKey(e, sameId) !== key
        ? `${idField} ${String(row[idField!])} is used by "${title(e, sameId)}" and "${title(e, row)}"`
        : idField && norm(other[idField]) && id && norm(other[idField]) !== id
          ? `"${title(e, row)}" appears under two ${idField}s (${String(other[idField])}, ${String(row[idField])})`
          : `"${title(e, row)}" appears twice with different values (${compositeFields(e).join(", ")} the same)`;
    const prd = prdFor(other) ?? prdFor(row);
    if (prd && agrees(other, prd) !== agrees(row, prd)) {
      if (agrees(row, prd)) rows = rows.map((r) => (r === other ? row : r));
      conflicts.push(`${what}; kept the version with the PRD's values`);
      continue;
    }
    // Both carry every value the PRD gives: it is the PRD's record; they differ only in what the PRD doesn't say.
    if (prd && agrees(other, prd) && agrees(row, prd)) {
      const differ = e.fields.filter((f) => norm(other[f.key]) !== norm(row[f.key])).map((f) => f.key);
      conflicts.push(`${what}: both have the PRD's values and differ only in ${differ.join(", ")}, which the PRD doesn't give; kept one`);
      continue;
    }
    rows = rows.filter((r) => r !== other);
    held.add(compositeKey(e, other)).add(key);
    conflicts.push(`${what}; neither version is kept (held out)${prd ? ", and neither has the PRD's values" : ""}`);
  }
  return { rows, held: [...held], repeats, conflicts };
}

/** The PRD's named records not among these records (by title). */
export function missingFixtures(e: ModelEntity, rows: Row[], fixtures: string[]): string[] {
  const titles = new Set(rows.map((r) => norm(r[e.titleField])));
  return fixtures.filter((f) => !titles.has(norm(f)));
}

/** Whether the PRD's named records are of this kind (some of them came back as this kind's records). */
export const holdsFixtures = (e: ModelEntity, rows: Row[], fixtures: string[]) => fixtures.length > 0 && missingFixtures(e, rows, fixtures).length < fixtures.length;

/** The PRD's named records first, in the PRD's order (so they get the first, stable ids), then the rest as they came. */
export function fixturesFirst(e: ModelEntity, rows: Row[], fixtures: string[]): Row[] {
  const at = (r: Row) => fixtures.findIndex((f) => norm(f) === norm(r[e.titleField]));
  return [...rows.filter((r) => at(r) >= 0).sort((a, b) => at(a) - at(b)), ...rows.filter((r) => at(r) < 0)];
}

/**
 * What a batch of records is asked for besides the fields: the PRD's sample records only while some are still missing
 * (and, after the first batch, only for the kind of record they turned out to be), and the records already written so
 * it doesn't repeat them.
 */
export function batchNote(e: ModelEntity, rows: Row[], from: number, count: number, sampleSection: string, fixtures: string[]): string {
  const written = rows.map((r) => title(e, r));
  const notYet = missingFixtures(e, rows, fixtures);
  const parts: string[] = [];
  if (from) parts.push(`These are records ${from + 1} to ${from + count}. Already written (don't repeat any of them): ${written.slice(0, 30).join(", ")}.`);
  const ofThisKind = !from || holdsFixtures(e, rows, fixtures);
  if (sampleSection && ofThisKind && (notYet.length || !fixtures.length) && !(from && !fixtures.length))
    parts.push(fixtures.length ? `${from ? "Still missing from" : "Include"} the PRD's sample records${from ? "" : " (if they are this kind of record)"}, exactly as given (names and values), once each: ${notYet.join(", ")}. Then add others like them.` : "Start with the records the PRD's sample data lists for these, exactly as given (names and values), then add others like them.");
  return parts.join("\n");
}
