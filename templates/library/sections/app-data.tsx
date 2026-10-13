/**
 * App data: the one data layer every working pattern reads and writes (the resource index, the record wizard, the record
 * detail, the app frame). An app describes its records once, as a schema (fields, statuses, the wizard's steps, the
 * status changes and who may make them), and seeds a few dozen records; the store keeps them in the browser, so what one
 * page changes every other page shows, and it survives a reload. It also keeps the activity trail, drafts and the toasts.
 *
 * Not a screen: the patterns bring it with them. Written for FlowCode.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

// ── The schema ──

export type FieldType = "text" | "longtext" | "number" | "money" | "percent" | "date" | "select" | "boolean" | "email";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  /** One line under the field. */
  help?: string;
  /** money: the currency code (USD when left out). */
  currency?: string;
}

export interface StatusDef {
  key: string;
  label: string;
  tone: Tone;
}

export interface StepDef {
  key: string;
  label: string;
  fields: string[];
  help?: string;
}

/** A status change people make: Submit for approval, Approve, Decline. */
export interface TransitionDef {
  key: string;
  label: string;
  from: string[];
  to: string;
  /** Asks for a reason, kept in the activity trail. */
  needsReason?: boolean;
  /** Only these roles may make it (all when left out). */
  roles?: string[];
  tone?: "primary" | "danger";
}

export interface EntityDef {
  key: string;
  label: string;
  plural: string;
  /** The field shown as the record's name. */
  titleField: string;
  subtitleField?: string;
  /** New records get ids like TRT-1042. */
  idPrefix?: string;
  fields: FieldDef[];
  statusField?: string;
  statuses?: StatusDef[];
  /** The list's columns (field keys), in order. All fields when left out (up to six). */
  columns?: string[];
  /** The list's filters (select or status field keys). */
  filters?: string[];
  /** The create wizard's steps. One step with every field when left out. */
  steps?: StepDef[];
  transitions?: TransitionDef[];
}

export interface RecordData {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  /** A record saved part-way through the wizard. */
  draft?: boolean;
  [key: string]: unknown;
}

export interface ActivityItem {
  id: string;
  entity: string;
  recordId: string;
  at: string;
  who: string;
  text: string;
  reason?: string;
}

export interface AppSchema {
  /** Where the data is kept in the browser (one key per app). */
  appKey: string;
  entities: EntityDef[];
  roles?: string[];
}

// ── The store ──

interface State {
  records: Record<string, RecordData[]>;
  activity: ActivityItem[];
  role: string;
  user: string;
}

type Listener = () => void;

export interface AppStore {
  schema: AppSchema;
  get(): State;
  subscribe(l: Listener): () => void;
  entity(key: string): EntityDef;
  create(entity: string, data: Partial<RecordData>, opts?: { draft?: boolean }): RecordData;
  update(entity: string, id: string, patch: Partial<RecordData>, note?: string): void;
  remove(entity: string, id: string): void;
  transition(entity: string, id: string, transition: string, reason?: string): { ok: boolean; message: string };
  setRole(role: string): void;
  reset(): void;
}

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * The app's store: seeded records (kept in the browser after the first visit), changes every page sees at once, and
 * the activity trail. Make one per app and pass it to the patterns.
 */
export function createStore(schema: AppSchema, seed: Record<string, RecordData[]>, opts: { user?: string; role?: string } = {}): AppStore {
  const storageKey = `fl-app:${schema.appKey}`;
  const fresh = (): State => ({ records: JSON.parse(JSON.stringify(seed)), activity: [], role: opts.role ?? schema.roles?.[0] ?? "", user: opts.user ?? "You" });
  let state: State = fresh();
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) state = { ...fresh(), ...(JSON.parse(saved) as State) };
  } catch {
    /* no storage here: the data lives for this visit */
  }
  const listeners = new Set<Listener>();
  const commit = (next: State) => {
    state = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* not saved; the change still applies on this page */
    }
    listeners.forEach((l) => l());
  };
  const entityOf = (key: string) => {
    const e = schema.entities.find((x) => x.key === key);
    if (!e) throw new Error(`No "${key}" in the app's schema`);
    return e;
  };
  const log = (entity: string, recordId: string, text: string, reason?: string): ActivityItem => ({ id: uid(), entity, recordId, at: now(), who: state.user, text, reason });
  const nextId = (e: EntityDef) => {
    // One past the highest number in use, so an id is never handed out twice (after a delete, count + 1 would be).
    const n = Math.max(1000, ...(state.records[e.key] ?? []).map((r) => Number(/(\d+)$/.exec(r.id)?.[1] ?? 0))) + 1;
    return `${e.idPrefix ?? e.key.slice(0, 3).toUpperCase()}-${n}`;
  };

  return {
    schema,
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    entity: entityOf,
    create(entity, data, o = {}) {
      const e = entityOf(entity);
      const first = e.statuses?.[0]?.key;
      const rec: RecordData = { ...(e.statusField && first ? { [e.statusField]: first } : {}), ...data, id: String(data.id ?? nextId(e)), createdAt: now(), updatedAt: now(), draft: !!o.draft };
      const title = String(rec[e.titleField] ?? rec.id);
      commit({ ...state, records: { ...state.records, [entity]: [rec, ...(state.records[entity] ?? [])] }, activity: [log(entity, rec.id, o.draft ? `Saved a draft: ${title}` : `Created ${e.label.toLowerCase()} ${title}`), ...state.activity] });
      return rec;
    },
    update(entity, id, patch, note) {
      const list = state.records[entity] ?? [];
      const e = entityOf(entity);
      const changed = Object.keys(patch).filter((k) => k !== "updatedAt").map((k) => e.fields.find((f) => f.key === k)?.label ?? k);
      commit({
        ...state,
        records: { ...state.records, [entity]: list.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r)) },
        activity: [log(entity, id, note ?? `Changed ${changed.slice(0, 3).join(", ") || "details"}`), ...state.activity],
      });
    },
    remove(entity, id) {
      const e = entityOf(entity);
      const rec = (state.records[entity] ?? []).find((r) => r.id === id);
      commit({ ...state, records: { ...state.records, [entity]: (state.records[entity] ?? []).filter((r) => r.id !== id) }, activity: [log(entity, id, `Deleted ${e.label.toLowerCase()} ${String(rec?.[e.titleField] ?? id)}`), ...state.activity] });
    },
    transition(entity, id, key, reason) {
      const e = entityOf(entity);
      const t = e.transitions?.find((x) => x.key === key);
      const rec = (state.records[entity] ?? []).find((r) => r.id === id);
      if (!t || !rec || !e.statusField) return { ok: false, message: "That change isn't available." };
      if (!t.from.includes(String(rec[e.statusField]))) return { ok: false, message: `It can't be done while the ${e.label.toLowerCase()} is ${statusOf(e, rec)?.label ?? rec[e.statusField]}.` };
      if (t.roles?.length && !t.roles.includes(state.role)) return { ok: false, message: `Only ${t.roles.join(" or ")} can ${t.label.toLowerCase()}.` };
      if (t.needsReason && !reason?.trim()) return { ok: false, message: "Give a reason first." };
      const to = e.statuses?.find((s) => s.key === t.to)?.label ?? t.to;
      commit({
        ...state,
        records: { ...state.records, [entity]: (state.records[entity] ?? []).map((r) => (r.id === id ? { ...r, [e.statusField!]: t.to, draft: false, updatedAt: now() } : r)) },
        activity: [log(entity, id, `${t.label}: ${String(rec[e.titleField] ?? id)} is now ${to}`, reason), ...state.activity],
      });
      return { ok: true, message: `${t.label}: ${String(rec[e.titleField] ?? id)} is now ${to}.` };
    },
    setRole(role) {
      commit({ ...state, role });
    },
    reset() {
      commit(fresh());
    },
  };
}

/** The store's state, re-rendering when anything changes. */
export function useStore(store: AppStore): State {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useRecords(store: AppStore, entity: string): RecordData[] {
  return useStore(store).records[entity] ?? [];
}

// ── Shared helpers ──

export const fieldOf = (e: EntityDef, key: string) => e.fields.find((f) => f.key === key);
export const statusOf = (e: EntityDef, rec: RecordData) => (e.statusField ? e.statuses?.find((s) => s.key === rec[e.statusField!]) : undefined);
export const titleOf = (e: EntityDef, rec: RecordData) => String(rec[e.titleField] ?? rec.id);

/** A value as people read it: money with its currency, dates in their own format, yes/no for booleans. */
export function formatValue(f: FieldDef | undefined, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (!f) return String(v);
  switch (f.type) {
    case "money":
      return new Intl.NumberFormat(undefined, { style: "currency", currency: f.currency ?? "USD", maximumFractionDigits: 0 }).format(Number(v));
    case "number":
      return new Intl.NumberFormat().format(Number(v));
    case "percent":
      return `${Number(v)}%`;
    case "date": {
      // A bare 2026-04-22 is a calendar day, not a UTC instant: read it in local time, or it shows a day early.
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
      const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(d);
    }
    case "boolean":
      return v ? "Yes" : "No";
    default:
      return String(v);
  }
}

/** What is wrong with these fields, by field key, in words a person can act on. */
export function validate(e: EntityDef, data: Partial<RecordData>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const f = fieldOf(e, k);
    if (!f) continue;
    const v = data[k];
    const empty = v === undefined || v === null || v === "";
    if (f.required && empty) out[k] = `${f.label} is needed.`;
    else if (!empty && (f.type === "number" || f.type === "money" || f.type === "percent")) {
      const n = Number(v);
      if (Number.isNaN(n)) out[k] = `${f.label} must be a number.`;
      else if (f.min !== undefined && n < f.min) out[k] = `${f.label} can't be below ${formatValue(f, f.min)}.`;
      else if (f.max !== undefined && n > f.max) out[k] = `${f.label} can't be above ${formatValue(f, f.max)}.`;
    } else if (!empty && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) out[k] = `${f.label} doesn't look like an email address.`;
  }
  return out;
}

/** How much of a step is filled in, 0 to 100 (required fields count double). */
export function completion(e: EntityDef, data: Partial<RecordData>, keys: string[]): number {
  let have = 0;
  let total = 0;
  for (const k of keys) {
    const w = fieldOf(e, k)?.required ? 2 : 1;
    total += w;
    const v = data[k];
    if (v !== undefined && v !== null && v !== "") have += w;
  }
  return total ? Math.round((have / total) * 100) : 100;
}

/** The wizard's steps: the entity's own, or one step with every field. */
export const stepsOf = (e: EntityDef): StepDef[] => e.steps?.length ? e.steps : [{ key: "all", label: `${e.label} details`, fields: e.fields.map((f) => f.key) }];

/** Who did what to one record, newest first. */
export function useActivity(store: AppStore, entity: string, id?: string): ActivityItem[] {
  const s = useStore(store);
  return useMemo(() => s.activity.filter((a) => a.entity === entity && (!id || a.recordId === id)), [s.activity, entity, id]);
}

/** A record's status as a coloured chip (the same everywhere the record appears). */
export function StatusChip({ entity, record }: { entity: EntityDef; record: RecordData }) {
  const s = statusOf(entity, record);
  if (!s) return null;
  return <span className={`fl-data-status fl-data-status--${s.tone}`}>{record.draft && s.key !== "draft" ? `${s.label} (draft)` : s.label}</span>;
}

// ── Toasts ──

type Toast = { id: string; text: string; tone: Tone };
let toasts: Toast[] = [];
const toastListeners = new Set<Listener>();
const emitToasts = () => toastListeners.forEach((l) => l());

/** A short confirmation ("Saved.") that fades on its own and is read out by screen readers. */
export function toast(text: string, tone: Tone = "success") {
  const t = { id: uid(), text, tone };
  toasts = [...toasts, t].slice(-3);
  emitToasts();
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emitToasts();
  }, 4200);
}

/** Put once in the app (the app frame does): where toasts appear. */
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className="fl-data-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <p key={t.id} className={`fl-data-toast fl-data-toast--${t.tone}`}>
          {t.text}
        </p>
      ))}
    </div>
  );
}

/** A value that follows the store's role (for role-aware buttons). */
export function useRole(store: AppStore): [string, (r: string) => void] {
  const s = useStore(store);
  return [s.role, store.setRole];
}

/** The id in the address (#/screen/<id>), kept in sync as it changes. */
export function useHashId(screen: string): string | undefined {
  const read = () => {
    const m = new RegExp(`^#/${screen}/([^/?]+)`).exec(window.location.hash);
    return m ? decodeURIComponent(m[1]!) : undefined;
  };
  const [id, setId] = useState(read);
  useEffect(() => {
    const on = () => setId(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  return id;
}
