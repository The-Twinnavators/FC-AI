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

export interface MergeResult {
  rows: Row[];
  /** Exact repeats left out. */
  repeats: string[];
  /** Records left out because they clash with one already kept (same identity, different values; one identifier on two records; one record under two identifiers). */
  conflicts: string[];
}

/** Adds a batch to the records so far: each new record once, every left-out one said with why. */
export function mergeRecords(e: ModelEntity, kept: Row[], incoming: Row[]): MergeResult {
  const rows = [...kept];
  const repeats: string[] = [];
  const conflicts: string[] = [];
  const idField = identifierField(e);
  for (const row of incoming) {
    const id = idField ? norm(row[idField]) : "";
    const key = compositeKey(e, row);
    const sameId = id ? rows.find((r) => norm(r[idField!]) === id) : undefined;
    const sameKey = rows.find((r) => compositeKey(e, r) === key);
    const other = sameId ?? sameKey;
    if (!other) {
      rows.push(row);
      continue;
    }
    if (values(e, other) === values(e, row)) repeats.push(title(e, row));
    else if (sameId && compositeKey(e, sameId) !== key) conflicts.push(`${idField} ${String(row[idField!])} is used by "${title(e, sameId)}" and "${title(e, row)}"; kept the first`);
    else if (idField && sameKey && norm(sameKey[idField]) && id && norm(sameKey[idField]) !== id) conflicts.push(`"${title(e, row)}" appears under two ${idField}s (${String(sameKey[idField])}, ${String(row[idField])}); kept the first`);
    else conflicts.push(`"${title(e, row)}" appears twice with different values (${compositeFields(e).join(", ")} the same); kept the first`);
  }
  return { rows, repeats, conflicts };
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
