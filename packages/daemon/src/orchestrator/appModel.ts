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

/**
 * What a destination in the app is. The working kinds are built from the library's patterns: list, create, detail,
 * dashboard and queue for apps people work in; landing, catalog, categories, entry, places, lists, list and saved for
 * look-up apps (find it and where to get it; mylist is one of the person's lists).
 */
export type ViewKind = "list" | "create" | "detail" | "dashboard" | "queue" | "custom" | "placeholder" | LookupKind;
export type LookupKind = "landing" | "catalog" | "categories" | "entry" | "places" | "lists" | "mylist" | "saved";
const LOOKUP_KINDS: LookupKind[] = ["landing", "catalog", "categories", "entry", "places", "lists", "mylist", "saved"];

/** A look-up app's extra model: what people look up, the places that carry it, and the sample ratings and lists. */
export interface LookupModel {
  entries: string;
  places: string;
  categoryField: string;
  /** The entries' list of the places that carry them (place ids), kept beside the fields. */
  placesField: string;
  areas: Array<{ zip: string; label: string; lat: number; lng: number }>;
  placeWord: string;
  carryWord: string;
  /** A short field shown as a badge on cards (a certification, an award). */
  badgeField?: string;
  /** The entries' fields shown as key details on the entry page. */
  detailFields: string[];
  /** Extra select fields offered as filters in the catalog. */
  facets: string[];
  /** A text field of themes or tags that search also matches. */
  tagsField?: string;
  ratings: Array<{ entryId: string; who: string; stars: number; text: string; at: string; helpful: number }>;
  lists: Array<{ id: string; name: string; placeId?: string; items: Array<{ entryId: string; qty: number; done: boolean }> }>;
  likes: Record<string, number>;
  saves: Record<string, number>;
}
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
  /** A look-up app (shape "lookup"): what is looked up and where it is found. */
  lookup?: LookupModel;
}

export const appModelKey = (runId: string) => `appModel:${runId}`;

export const APP_MODEL_SYSTEM = `You design the data and navigation of a complete, working web app prototype from a PRD, the way an experienced product
designer and engineer would for an internal tool or SaaS product. Write:
- shape: "app" when people work in it - they create, track and act on records that move through statuses (bookings,
  orders, cases, patients' readings, applications, tickets), whatever the industry; "lookup" when people use it to find
  things and where to get them (products and the stores near them that carry them, books and libraries, clinics and
  their services, restaurants and dishes): they search and browse entries by category, open one, see where it is near
  their ZIP code, like, save, rate and comment, and keep lists; "website" when it is mainly pages people read and a
  contact or sign-up form (a marketing site, a restaurant or clinic site, a portfolio, a landing page). For a website,
  give only shape and product. For a look-up app, also give "lookup" (below);
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
placeholder. Use only what the PRD supports; don't invent unrelated features.
For a look-up app (shape "lookup"):
- entities: exactly two, no statuses, steps or transitions: the entries people look up (a select field of categories,
  text fields for the details people check, a longtext about it, an optional text field of tags or themes, an optional
  short badge field such as a certification), and the places (name, address, zip, hours, phone, lat, lng as numbers);
- seed: 40 to 60 entries across the categories and 10 to 14 places in 2 or 3 ZIP code areas, with real coordinates.
  Records are numbered in the order you list them: the first entry is <its idPrefix>-1001, the second -1002, and the
  same for places. Each entry lists the places that carry it, by those ids, in the placesField (most places carry most
  entries, so availability differs by place);
- lookup: { entries, places (entity keys), categoryField, placesField (a key not among the fields, e.g. "carriedBy"),
  areas: [{ zip, label ("San Francisco, CA"), lat, lng }], placeWord ("store"), carryWord ("carries"), badgeField?,
  detailFields (3 to 6 entry field keys), facets (select field keys), tagsField?, ratings: 20 to 40 { entry (its id),
  who (first name and initial), stars 1-5, text, at (ISO date in 2026), helpful }, lists: 1 or 2 { name, place (its id),
  items: [{ entry, qty, done }] }, likes and saves: { <entry id>: count } for the popular ones };
- nav: a landing page (kind landing, the first destination: what the app is, a search and a ZIP code box, featured
  categories and entries), categories (kind categories), the catalog (kind catalog), an entry page (kind entry, hidden
  from the menu), the place finder (kind places), lists (kind lists) and one list (kind mylist, hidden), saved (kind
  saved); placeholders only for parts the PRD leaves for later. Use the PRD's own words for every label.
Answer with JSON only.`;

export const APP_MODEL_SCHEMA = {
  type: "object",
  properties: {
    shape: { type: "string", enum: ["app", "lookup", "website"] },
    lookup: { type: "object" },
    product: { type: "string" },
    roles: { type: "array", items: { type: "string" } },
    entities: { type: "array", items: { type: "object" } },
    seed: { type: "object" },
    nav: { type: "array", items: { type: "object", properties: { label: { type: "string" }, items: { type: "array", items: { type: "object" } } }, required: ["label", "items"] } },
  },
  required: ["shape", "product"],
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
export function parseAppModel(raw: unknown): { model?: AppModel; problems: string[]; website?: boolean } {
  const r = (raw ?? {}) as Record<string, unknown>;
  // A website isn't an app of records: it is built from the page sections, as a sketch build is.
  if (r.shape === "website") return { problems: [], website: true };
  const lookupShape = r.shape === "lookup";
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
      // A look-up app's places list (place ids, kept beside the fields) and coordinates come through as they are.
      if (lookupShape) for (const k of ["lat", "lng"]) if (typeof row[k] === "number") out[k] = row[k];
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
          const kinds: ViewKind[] = lookupShape ? ["custom", "placeholder", ...LOOKUP_KINDS] : ["list", "create", "detail", "dashboard", "queue", "custom", "placeholder"];
          const kind = kinds.includes(i.kind as ViewKind) ? (i.kind as ViewKind) : "placeholder";
          const entity = entityKeys.has(keyOf(i.entity)) ? keyOf(i.entity) : undefined;
          // A working kind needs its entity; without one it is a placeholder, not a page built on nothing.
          const real = kind === "placeholder" || kind === "custom" || kind === "dashboard" || LOOKUP_KINDS.includes(kind as LookupKind) || !!entity;
          return { id: kebab(i.id) || kebab(i.label), label: str(i.label, 40), kind: real ? kind : "placeholder", ...(entity ? { entity } : {}), ...(i.purpose ? { purpose: str(i.purpose, 200) } : {}), ...(i.icon ? { icon: str(i.icon, 20) } : {}) } as ModelView;
        })
        .filter((i) => i.id && i.label && !ids.has(i.id) && ids.add(i.id)),
    }))
    .filter((g) => g.label && g.items.length);
  if (lookupShape) {
    const lookup = parseLookup(r.lookup, entities, seed, seedRaw, problems);
    if (!lookup) return { problems: [...problems, "The look-up app's lookup section isn't usable"] };
    // Every look-up app has its working set even when the model forgot one.
    const all = () => nav.flatMap((g) => g.items);
    const group = nav[0] ?? (nav.push({ label: str(r.product, 40) || "App", items: [] }), nav[0]!);
    const ent = entities.find((e) => e.key === lookup.entries)!;
    const want: Array<[LookupKind, string, string]> = [
      ["landing", "home", "Home"],
      ["catalog", kebab(ent.plural), ent.plural],
      ["categories", "categories", "Categories"],
      ["entry", kebab(ent.label), ent.label],
      ["places", `find-${kebab(lookup.placeWord)}`, `Find a ${lookup.placeWord}`],
      ["lists", "lists", "Lists"],
      ["mylist", "list", "List"],
      ["saved", "saved", "Saved"],
    ];
    for (const [kind, id, label] of want) if (!all().some((i) => i.kind === kind)) (kind === "landing" ? group.items.unshift({ id, label, kind }) : group.items.push({ id, label, kind }));
    // The landing page comes first.
    const landing = all().find((i) => i.kind === "landing")!;
    for (const g of nav) g.items = g.items.filter((i) => i !== landing);
    nav[0]!.items.unshift(landing);
    return { model: { product: str(r.product, 60) || "App", roles: roles.length ? roles : ["Member"], entities, seed, nav: nav.filter((g) => g.items.length), lookup }, problems };
  }
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
    ...(m.lookup
      ? [`A look-up app: people find ${m.lookup.entries} by ${m.lookup.categoryField} and search, and see which ${m.lookup.placeWord}s near their ZIP code ${m.lookup.carryWord} them (${m.lookup.areas.map((a) => `${a.zip} ${a.label}`).join(", ")}). Likes, saves, ratings, comments and lists live in the look-up layer (src/app/lookup.ts, from src/sections/LookupData) beside the store.`]
      : []),
  ].join("\n");
}

/** A look-up app's lookup section, checked against its two entities and their seed (ids as the store numbers them). */
function parseLookup(raw: unknown, entities: ModelEntity[], seed: AppModel["seed"], seedRaw: Record<string, unknown>, problems: string[]): LookupModel | undefined {
  const l = (raw ?? {}) as Record<string, unknown>;
  const entries = entities.find((e) => e.key === keyOf(l.entries)) ?? entities[0];
  const places = entities.find((e) => e.key === keyOf(l.places) && e !== entries) ?? entities.find((e) => e !== entries);
  if (!entries || !places) {
    problems.push("A look-up app needs two entities: what people look up and the places that carry it");
    return undefined;
  }
  // Look-up records don't move through statuses.
  for (const e of [entries, places]) {
    delete e.statusField;
    delete e.statuses;
    delete e.transitions;
    for (const row of seed[e.key] ?? []) delete row.status;
  }
  // Places need only a handful per ZIP code area, not the twenty records an app of records wants.
  const placeCount = (seed[places.key] ?? []).length;
  for (let i = problems.length - 1; i >= 0; i--) if (problems[i]!.startsWith(`Only ${placeCount} sample ${places.plural.toLowerCase()}`)) problems.splice(i, 1);
  if (placeCount < 6) problems.push(`Only ${placeCount} sample ${places.plural.toLowerCase()} (6 or more, a few in each ZIP code area)`);
  const cat = entries.fields.find((f) => f.key === keyOf(l.categoryField) && f.type === "select") ?? entries.fields.find((f) => f.type === "select");
  if (!cat) {
    problems.push(`${entries.plural} have no category (a select field)`);
    return undefined;
  }
  const placesField = keyOf(l.placesField) || "carriedBy";
  const placeIds = new Set((seed[places.key] ?? []).map((p) => String(p.id)));
  const entryIds = new Set((seed[entries.key] ?? []).map((p) => String(p.id)));
  // Each entry's places, by the ids the store gives them; unknown ids are dropped.
  const rawEntries = arr(seedRaw[entries.key]);
  (seed[entries.key] ?? []).forEach((row, i) => {
    const given = arr((rawEntries[i] as Record<string, unknown> | undefined)?.[placesField]).map((x) => str(x, 20).toUpperCase());
    row[placesField] = given.filter((id) => placeIds.has(id));
  });
  const carried = (seed[entries.key] ?? []).filter((row) => (row[placesField] as string[]).length).length;
  if (carried < (seed[entries.key] ?? []).length / 2) problems.push(`Only ${carried} ${entries.plural.toLowerCase()} say which ${str(l.placeWord, 20) || "place"}s carry them`);
  const areas = arr(l.areas)
    .map((a0) => a0 as Record<string, unknown>)
    .map((a) => ({ zip: str(a.zip, 5), label: str(a.label, 40), lat: Number(a.lat), lng: Number(a.lng) }))
    .filter((a) => /^\d{5}$/.test(a.zip) && Number.isFinite(a.lat) && Number.isFinite(a.lng) && Math.abs(a.lat) <= 90 && Math.abs(a.lng) <= 180)
    .slice(0, 6);
  if (!areas.length) {
    problems.push("No usable ZIP code areas (five digits with coordinates)");
    return undefined;
  }
  // A place without coordinates sits at its area's centre, nudged so places don't stack.
  (seed[places.key] ?? []).forEach((row, i) => {
    if (typeof row.lat === "number" && typeof row.lng === "number") return;
    const a = areas.find((x) => x.zip === String(row.zip ?? "")) ?? areas[i % areas.length]!;
    row.lat = a.lat + (((i * 37) % 11) - 5) * 0.006;
    row.lng = a.lng + (((i * 53) % 11) - 5) * 0.006;
  });
  const entryField = (k: unknown, type?: FieldType) => entries.fields.find((f) => f.key === keyOf(k) && (!type || f.type === type))?.key;
  const idOf = (v: unknown) => str(v, 20).toUpperCase();
  const ratings = arr(l.ratings)
    .map((x0) => x0 as Record<string, unknown>)
    .map((x) => ({ entryId: idOf(x.entry ?? x.entryId), who: str(x.who, 30) || "A reader", stars: Math.min(5, Math.max(1, Math.round(Number(x.stars) || 0))), text: str(x.text, 600), at: /^\d{4}-\d{2}-\d{2}/.test(str(x.at)) ? str(x.at, 30) : "2026-09-01T12:00:00Z", helpful: Math.max(0, Math.round(Number(x.helpful) || 0)) }))
    .filter((x) => entryIds.has(x.entryId))
    .slice(0, 60);
  const lists = arr(l.lists)
    .map((x0) => x0 as Record<string, unknown>)
    .map((x, i) => ({
      id: `LST-${1001 + i}`,
      name: str(x.name, 60) || `List ${i + 1}`,
      ...(placeIds.has(idOf(x.place ?? x.placeId)) ? { placeId: idOf(x.place ?? x.placeId) } : {}),
      items: arr(x.items)
        .map((it0) => it0 as Record<string, unknown>)
        .map((it) => ({ entryId: idOf(it.entry ?? it.entryId), qty: Math.min(99, Math.max(1, Math.round(Number(it.qty) || 1))), done: !!it.done }))
        .filter((it) => entryIds.has(it.entryId))
        .slice(0, 30),
    }))
    .slice(0, 3);
  const counts = (v: unknown) => Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([k, n]) => [idOf(k), Math.max(0, Math.round(Number(n) || 0))]).filter(([k]) => entryIds.has(k as string)));
  const badge = entryField(l.badgeField);
  const tags = entryField(l.tagsField);
  return {
    entries: entries.key,
    places: places.key,
    categoryField: cat.key,
    placesField,
    areas,
    placeWord: str(l.placeWord, 20).toLowerCase() || "place",
    carryWord: str(l.carryWord, 20).toLowerCase() || "carries",
    ...(badge ? { badgeField: badge } : {}),
    detailFields: arr(l.detailFields).map((k) => entryField(k)).filter((k): k is string => !!k).slice(0, 6),
    facets: arr(l.facets).map((k) => entryField(k, "select")).filter((k): k is string => !!k && k !== cat.key).slice(0, 3),
    ...(tags ? { tagsField: tags } : {}),
    ratings,
    lists,
    likes: counts(l.likes),
    saves: counts(l.saves),
  };
}
