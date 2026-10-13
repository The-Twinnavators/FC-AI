/**
 * The app model ("Complete app" builds): the PRD turned into the data and the navigation of a whole working app, before
 * any screen is written. One planner call; FlowCode checks it and writes the app's schema, store, shell and routes from
 * it without the model writing code (appFiles), so every page reads and writes the same records and every destination
 * exists, built in depth or clearly marked as not in this prototype.
 *
 * The shapes mirror the library's data layer (templates/library/sections/app-data.tsx).
 */
import type { Requirement } from "../quality/spec.js";

export type FieldType = "text" | "longtext" | "number" | "money" | "percent" | "date" | "select" | "boolean" | "email";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const FIELD_TYPES: FieldType[] = ["text", "longtext", "number", "money", "percent", "date", "select", "boolean", "email"];
const TONES: Tone[] = ["neutral", "info", "success", "warning", "danger"];

export interface ModelField { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; min?: number; max?: number; help?: string }
export interface ModelEntity {
  key: string;
  label: string;
  plural: string;
  titleField: string;
  subtitleField?: string;
  idPrefix?: string;
  fields: ModelField[];
  statusField?: string;
  statuses?: Array<{ key: string; label: string; tone: Tone }>;
  columns?: string[];
  filters?: string[];
  steps?: Array<{ key: string; label: string; fields: string[]; help?: string }>;
  transitions?: Array<{ key: string; label: string; from: string[]; to: string; needsReason?: boolean; roles?: string[]; tone?: "primary" | "danger" }>;
}

/** What a destination in the app is. The working kinds are built from the library's patterns. */
export type ViewKind = "list" | "create" | "detail" | "dashboard" | "queue" | "custom" | "placeholder";
export interface ModelView {
  id: string;
  label: string;
  kind: ViewKind;
  entity?: string;
  /** For dashboard, queue and custom: what the person does there, from the PRD. */
  purpose?: string;
  icon?: string;
}

export interface AppModel {
  product: string;
  roles: string[];
  entities: ModelEntity[];
  seed: Record<string, Array<Record<string, unknown>>>;
  nav: Array<{ label: string; items: ModelView[] }>;
}

export const appModelKey = (runId: string) => `appModel:${runId}`;

export const APP_MODEL_SYSTEM = `You design the data and navigation of a complete, working web app prototype from a PRD, the way an experienced product
designer and engineer would for an internal tool or SaaS product. Write:
- product: the product's name;
- roles: the kinds of user who use it (2 to 4), as the PRD names them;
- entities: the records the app manages (1 to 4). For each: key (camelCase), label, plural, the fields (key, label, type one of
  text, longtext, number, money, percent, date, select, boolean, email; options for select; required; min and max for numbers),
  titleField and subtitleField, an idPrefix (3 capital letters), the status field with 3 to 6 statuses (key, label, tone one of
  neutral, info, success, warning, danger) in the order a record moves through them, the list's columns (5 to 7 field keys) and
  filters (status and select fields), the create wizard's steps (2 to 6, each a few related fields, in the order a person fills
  them in), and the status changes people make (key, label, from statuses, to status, needsReason for refusals and endings,
  roles allowed);
- seed: for each entity, 20 to 30 realistic records in the PRD's domain (real-sounding names, amounts, dates in 2025-2027,
  a spread of statuses), using the field keys;
- nav: the app's whole navigation as groups of destinations, as the real product would have it (6 to 30 destinations). Each
  destination: id (kebab-case), label, kind and entity. Kinds: list (browse and act on many records of an entity), create (the
  entity's create wizard), detail (one record; reached from its list, so give it an id but it is hidden from the menu),
  dashboard (numbers that matter, from the entities), queue (records waiting for a decision), custom (another working page the
  PRD needs; say its purpose), placeholder (a real part of the product that this prototype doesn't build).
Build the PRD's focus area in depth (list, create, detail, queue and dashboard for its main entity); everything else is
placeholder. Use only what the PRD supports; don't invent unrelated features. Answer with JSON only.`;

export const APP_MODEL_SCHEMA = {
  type: "object",
  properties: {
    product: { type: "string" },
    roles: { type: "array", items: { type: "string" } },
    entities: { type: "array", items: { type: "object" } },
    seed: { type: "object" },
    nav: { type: "array", items: { type: "object", properties: { label: { type: "string" }, items: { type: "array", items: { type: "object" } } }, required: ["label", "items"] } },
  },
  required: ["product", "roles", "entities", "seed", "nav"],
};

export function appModelRequest(objective: string, prd: string, requirements: Requirement[], boundary: string): string {
  return [
    `Request: ${objective.slice(0, 800)}`,
    requirements.length ? `Requirements this build makes:\n${requirements.slice(0, 80).map((r) => `${r.id}: ${r.text.slice(0, 180)}`).join("\n")}` : "",
    boundary,
    `PRD:\n${prd.slice(0, 24_000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const str = (v: unknown, max = 80) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
const keyOf = (v: unknown) => str(v, 40).replace(/[^A-Za-z0-9_]/g, "");
const kebab = (v: unknown) => str(v, 50).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The model's answer, checked: fields, statuses, steps and status changes that refer to things that exist. */
export function parseAppModel(raw: unknown): { model?: AppModel; problems: string[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const roles = arr(r.roles).map((x) => str(x, 40)).filter(Boolean).slice(0, 4);
  const entities: ModelEntity[] = [];
  for (const e0 of arr(r.entities).slice(0, 4)) {
    const e = e0 as Record<string, unknown>;
    const key = keyOf(e.key);
    const fields: ModelField[] = [];
    for (const f0 of arr(e.fields).slice(0, 24)) {
      const f = f0 as Record<string, unknown>;
      const fk = keyOf(f.key);
      const type = FIELD_TYPES.includes(f.type as FieldType) ? (f.type as FieldType) : "text";
      if (!fk || fields.some((x) => x.key === fk)) continue;
      const options = type === "select" ? arr(f.options).map((o) => str(o, 40)).filter(Boolean).slice(0, 12) : undefined;
      fields.push({ key: fk, label: str(f.label, 60) || fk, type: type === "select" && !options?.length ? "text" : type, ...(options?.length ? { options } : {}), ...(f.required ? { required: true } : {}), ...(typeof f.min === "number" ? { min: f.min } : {}), ...(typeof f.max === "number" ? { max: f.max } : {}), ...(f.help ? { help: str(f.help, 140) } : {}) });
    }
    if (!key || !fields.length) {
      problems.push(`Entity "${str(e.label) || key}" has no usable fields`);
      continue;
    }
    const has = (k: unknown) => fields.some((f) => f.key === keyOf(k));
    const statusField = keyOf(e.statusField) || "status";
    const statuses = arr(e.statuses)
      .map((s0) => s0 as Record<string, unknown>)
      .map((s) => ({ key: keyOf(s.key), label: str(s.label, 40), tone: TONES.includes(s.tone as Tone) ? (s.tone as Tone) : "neutral" }))
      .filter((s) => s.key && s.label)
      .slice(0, 8);
    const statusKeys = new Set(statuses.map((s) => s.key));
    const titleField = has(e.titleField) ? keyOf(e.titleField) : fields.find((f) => f.type === "text")?.key ?? fields[0]!.key;
    const steps = arr(e.steps)
      .map((s0) => s0 as Record<string, unknown>)
      .map((s, i) => ({ key: keyOf(s.key) || `step${i + 1}`, label: str(s.label, 40), fields: arr(s.fields).map(keyOf).filter((k) => fields.some((f) => f.key === k)), ...(s.help ? { help: str(s.help, 140) } : {}) }))
      .filter((s) => s.label && s.fields.length)
      .slice(0, 6);
    const transitions = arr(e.transitions)
      .map((t0) => t0 as Record<string, unknown>)
      .map((t) => ({ key: keyOf(t.key), label: str(t.label, 40), from: arr(t.from).map(keyOf).filter((k) => statusKeys.has(k)), to: keyOf(t.to), ...(t.needsReason ? { needsReason: true } : {}), ...(arr(t.roles).length ? { roles: arr(t.roles).map((x) => str(x, 40)).filter((x) => roles.includes(x)) } : {}), ...(t.tone === "danger" || t.tone === "primary" ? { tone: t.tone as "primary" | "danger" } : {}) }))
      .filter((t) => t.key && t.label && t.from.length && statusKeys.has(t.to))
      .slice(0, 8);
    entities.push({
      key,
      label: str(e.label, 40) || key,
      plural: str(e.plural, 40) || `${str(e.label, 40) || key}s`,
      titleField,
      ...(has(e.subtitleField) ? { subtitleField: keyOf(e.subtitleField) } : {}),
      idPrefix: str(e.idPrefix, 4).toUpperCase().replace(/[^A-Z]/g, "") || key.slice(0, 3).toUpperCase(),
      fields,
      ...(statuses.length ? { statusField, statuses } : {}),
      columns: arr(e.columns).map(keyOf).filter((k) => has(k) || k === statusField).slice(0, 7),
      filters: arr(e.filters).map(keyOf).filter((k) => k === statusField || fields.some((f) => f.key === k && f.type === "select")).slice(0, 4),
      ...(steps.length ? { steps } : {}),
      ...(transitions.length ? { transitions } : {}),
    });
  }
  if (!entities.length) problems.push("No entities");
  const seed: AppModel["seed"] = {};
  const seedRaw = (r.seed ?? {}) as Record<string, unknown>;
  for (const e of entities) {
    const rows = arr(seedRaw[e.key]).filter((x) => x && typeof x === "object").slice(0, 40) as Array<Record<string, unknown>>;
    seed[e.key] = rows.map((row, i) => {
      const out: Record<string, unknown> = { id: `${e.idPrefix}-${1001 + i}` };
      for (const f of e.fields) if (row[f.key] !== undefined) out[f.key] = f.type === "money" || f.type === "number" || f.type === "percent" ? Number(row[f.key]) || 0 : f.type === "boolean" ? !!row[f.key] : row[f.key];
      if (e.statusField) out[e.statusField] = e.statuses?.some((s) => s.key === row[e.statusField!]) ? row[e.statusField] : e.statuses?.[i % e.statuses.length]?.key;
      return out;
    });
    if (seed[e.key]!.length < 12) problems.push(`Only ${seed[e.key]!.length} sample ${e.plural.toLowerCase()} (20 or more make the app feel real)`);
  }
  const entityKeys = new Set(entities.map((e) => e.key));
  const ids = new Set<string>();
  const nav: AppModel["nav"] = arr(r.nav)
    .map((g0) => g0 as Record<string, unknown>)
    .map((g) => ({
      label: str(g.label, 40),
      items: arr(g.items)
        .map((i0) => i0 as Record<string, unknown>)
        .map((i) => {
          const kind = (["list", "create", "detail", "dashboard", "queue", "custom", "placeholder"] as ViewKind[]).includes(i.kind as ViewKind) ? (i.kind as ViewKind) : "placeholder";
          const entity = entityKeys.has(keyOf(i.entity)) ? keyOf(i.entity) : undefined;
          // A working kind needs its entity; without one it is a placeholder, not a page built on nothing.
          const real = kind === "placeholder" || kind === "custom" || kind === "dashboard" || !!entity;
          return { id: kebab(i.id) || kebab(i.label), label: str(i.label, 40), kind: real ? kind : "placeholder", ...(entity ? { entity } : {}), ...(i.purpose ? { purpose: str(i.purpose, 200) } : {}), ...(i.icon ? { icon: str(i.icon, 20) } : {}) } as ModelView;
        })
        .filter((i) => i.id && i.label && !ids.has(i.id) && ids.add(i.id)),
    }))
    .filter((g) => g.label && g.items.length);
  // Every entity gets its working set even when the model forgot one: list, create and detail.
  for (const e of entities) {
    const all = nav.flatMap((g) => g.items);
    const need: ViewKind[] = ["list", "create", "detail"];
    for (const kind of need)
      if (!all.some((i) => i.kind === kind && i.entity === e.key)) {
        const id = kind === "list" ? kebab(e.plural) : `${kind === "create" ? "new" : ""}${kind === "create" ? "-" : ""}${kebab(e.label)}${kind === "detail" ? "-detail" : ""}`;
        (nav[0] ?? (nav.push({ label: str(r.product, 40) || "App", items: [] }), nav[0]!)).items.push({ id, label: kind === "list" ? e.plural : kind === "create" ? `New ${e.label.toLowerCase()}` : `${e.label} detail`, kind, entity: e.key });
      }
  }
  if (!nav.length) problems.push("No navigation");
  return { model: entities.length && nav.length ? { product: str(r.product, 60) || "App", roles: roles.length ? roles : ["User"], entities, seed, nav } : undefined, problems };
}

/** The model as the design and build steps read it. */
export function appModelNote(m: AppModel): string {
  return [
    `The app: ${m.product}. Roles: ${m.roles.join(", ")}. Its data, store and navigation are written by FlowCode in src/app/ (schema.ts, store.ts) and src/App.tsx: every page reads and writes the same records through the store (src/app/store.ts), never its own copy.`,
    ...m.entities.map((e) => `- ${e.plural} (${e.key}): ${e.fields.map((f) => `${f.label}${f.required ? "*" : ""}`).join(", ")}; statuses ${(e.statuses ?? []).map((s) => s.label).join(" → ")}; ${(m.seed[e.key] ?? []).length} sample records.`),
    `Navigation: ${m.nav.map((g) => `${g.label} (${g.items.map((i) => `${i.label}${i.kind === "placeholder" ? " [not in this prototype]" : ` [${i.kind}]`}`).join(", ")})`).join("; ")}.`,
  ].join("\n");
}
