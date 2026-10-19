/**
 * A selection workflow FlowCode composes itself (with screenComposer.ts): the person picks a set number of records from
 * a collection, notes each, submits with a confirmation that locks the set, and can start over. One shared selection
 * for the whole app (src/app/selection.ts, kept in this browser under its own key), used by the list (pick and the
 * progress), the record's page (pick, the note, previous and next) and the selection page (the set, progress, submit,
 * the submitted state, start over).
 *
 * Found from the app model: a custom page whose purpose is a selection or shortlist, the list's kind of record, the
 * number to pick (the collection's own count field, or the PRD's "exactly N" / "maximum N") and the note's length (the
 * PRD's "up to N characters"). Frameproof's PRD: five photos, notes up to 300 characters, Draft or Submitted, a time.
 */
import type { AppModel, ModelEntity, ModelField, ModelView } from "./appModel.js";
import { builtViews, screenFileOf } from "./appFiles.js";

export interface SelectionSpec {
  /** The kind of record picked (photo). */
  entity: string;
  noun: string;
  nouns: string;
  count: number;
  noteMax: number;
  /** The selection page's view id (my-selection) and the list's and record page's. */
  page: string;
  list?: string;
  detail?: string;
  /** Where it is kept in the browser: one key for this app. */
  storageKey: string;
}

export const SELECTION_FILE = "src/app/selection.ts";
const COMPOSED = "Composed by FlowCode";
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const num = (s: string | undefined) => (s ? (WORDS[s.toLowerCase()] ?? (Number.isFinite(Number(s)) ? Number(s) : undefined)) : undefined);
const js = (v: unknown) => JSON.stringify(v);
export const imageFieldOf = (e: ModelEntity) => e.fields.find((f) => /image|photo|picture|thumbnail/i.test(f.key) && !/alt/i.test(f.key));
export const altFieldOf = (e: ModelEntity) => e.fields.find((f) => /^alt|alt(text)?$/i.test(f.key));

/** The selection workflow the app model and PRD describe, if any. */
export function detectSelection(m: AppModel, prd = ""): SelectionSpec | undefined {
  const views = builtViews(m);
  const page = views.find((v) => v.kind === "custom" && /\b(selection|shortlist|picks?|favou?rites|chosen)\b/i.test(`${v.label} ${v.purpose ?? ""}`));
  const list = views.find((v) => v.kind === "list" && v.entity);
  if (!page || !list) return undefined;
  const e = m.entities.find((x) => x.key === list.entity)!;
  // The number to pick: a count field on the one record of another kind (the gallery's requiredSelectionCount), or the PRD.
  let count: number | undefined;
  for (const other of m.entities.filter((x) => x.key !== e.key && (m.seed[x.key] ?? []).length === 1)) {
    const f = other.fields.find((x) => x.type === "number" && /(select|pick|choose|required|max).*(count|number)|count/i.test(x.key));
    const v = f ? Number(m.seed[other.key]![0]![f.key]) : NaN;
    if (Number.isFinite(v) && v > 0) count = v;
  }
  count ??= num(/\bexactly (\w+) (?:selected|chosen|picked)?/i.exec(prd)?.[1]) ?? num(/\bmaximum (?:of )?(\w+) (?:selected|chosen|picked)?/i.exec(prd)?.[1]);
  if (!count || count < 1 || count > 50) return undefined;
  const noteMax = num(/\bnote[^.\n]{0,80}?up to (\d+) characters/i.exec(prd)?.[1]) ?? 300;
  return {
    entity: e.key,
    noun: e.label.toLowerCase(),
    nouns: e.plural.toLowerCase(),
    count,
    noteMax,
    page: page.id,
    list: list.id,
    detail: views.find((v) => v.kind === "detail" && v.entity === e.key)?.id,
    storageKey: `fl-selection:${m.product.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
}

/** The one shared selection (src/app/selection.ts). */
export function selectionStoreFile(s: SelectionSpec): { path: string; content: string } {
  return {
    path: SELECTION_FILE,
    content: `/**
 * The selection: one shared source of truth for the whole app (which ${s.nouns} are chosen, a note per ${s.noun}, Draft
 * or Submitted, and when it was submitted). Kept in this browser under its own key; every screen reads and changes it
 * here, never a copy. ${COMPOSED} (selectionComposer.ts).
 */
import { useSyncExternalStore } from "react";

/** How many ${s.nouns} a selection holds: it is submitted with exactly this many. */
export const SELECTION_COUNT = ${s.count};
/** The longest note, in characters. */
export const NOTE_MAX = ${s.noteMax};
const KEY = ${js(s.storageKey)};

export type SelectionStatus = "draft" | "submitted";
export interface SelectionState {
  ids: string[];
  notes: Record<string, string>;
  status: SelectionStatus;
  submittedAt?: string;
  /** The saved selection couldn't be read, so it started again (shown once). */
  recovered?: boolean;
}

const empty = (): SelectionState => ({ ids: [], notes: {}, status: "draft" });

function load(): SelectionState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return empty();
  }
  if (!raw) return empty();
  try {
    const s = JSON.parse(raw) as Partial<SelectionState>;
    const ids = Array.isArray(s.ids) ? [...new Set(s.ids.filter((x): x is string => typeof x === "string"))].slice(0, SELECTION_COUNT) : undefined;
    const notes =
      s.notes && typeof s.notes === "object"
        ? Object.fromEntries(Object.entries(s.notes).flatMap(([k, v]) => (typeof v === "string" ? [[k, v.slice(0, NOTE_MAX)]] : [])))
        : undefined;
    const status = s.status === "submitted" || s.status === "draft" ? s.status : undefined;
    if (!ids || !notes || !status) throw new Error("unreadable");
    return { ids, notes, status, ...(status === "submitted" && typeof s.submittedAt === "string" ? { submittedAt: s.submittedAt } : {}) };
  } catch {
    return { ...empty(), recovered: true };
  }
}

let state: SelectionState = load();
const listeners = new Set<() => void>();

function commit(next: SelectionState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ids: next.ids, notes: next.notes, status: next.status, submittedAt: next.submittedAt }));
  } catch {
    /* not saved: the change still applies on this page */
  }
  listeners.forEach((l) => l());
}

export const selection = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  /** Adds or removes one; says why not when it can't (the selection is full, or submitted). */
  toggle(id: string): { ok: boolean; message: string } {
    if (state.status === "submitted") return { ok: false, message: "Your selection is submitted, so it can't change. Start over to choose again." };
    if (state.ids.includes(id)) {
      commit({ ...state, ids: state.ids.filter((x) => x !== id) });
      return { ok: true, message: "Removed from your selection (" + state.ids.length + " of " + SELECTION_COUNT + ")." };
    }
    if (state.ids.length >= SELECTION_COUNT) return { ok: false, message: "Your selection already has " + SELECTION_COUNT + " ${s.nouns}. Remove one to add another." };
    commit({ ...state, ids: [...state.ids, id] });
    return { ok: true, message: "Added to your selection (" + state.ids.length + " of " + SELECTION_COUNT + ")." };
  },
  /** The ${s.noun}'s note, saved as it is typed (kept when the ${s.noun} leaves the selection). */
  setNote(id: string, text: string) {
    if (state.status === "submitted") return;
    commit({ ...state, notes: { ...state.notes, [id]: text.slice(0, NOTE_MAX) } });
  },
  /** Submits the selection: only with exactly SELECTION_COUNT ${s.nouns}, once. */
  submit(): boolean {
    if (state.status === "submitted" || state.ids.length !== SELECTION_COUNT) return false;
    commit({ ...state, status: "submitted", submittedAt: new Date().toISOString() });
    return true;
  },
  /** Back to an empty draft: clears the ${s.nouns}, every note, the status and its time (this app's key only). */
  startOver() {
    commit(empty());
  },
  dismissRecovered() {
    if (state.recovered) commit({ ...state, recovered: false });
  },
};

export function useSelection(): SelectionState {
  return useSyncExternalStore(selection.subscribe, selection.get, selection.get);
}
`,
  };
}

/** The record's page: its picture, title and facts, the pick and the note (with a selection), previous and next. */
export function composeDetailScreen(m: AppModel, v: ModelView, s?: SelectionSpec): { files: Array<{ path: string; content: string }>; summary: string } | undefined {
  const e = m.entities.find((x) => x.key === v.entity);
  if (v.kind !== "detail" || !e) return undefined;
  const img = imageFieldOf(e);
  if (!img) return undefined;
  const alt = altFieldOf(e);
  const list = builtViews(m).find((x) => x.kind === "list" && x.entity === e.key);
  const facts = e.fields.filter((f: ModelField) => f.type === "select" && f.key !== e.titleField);
  const file = screenFileOf(v);
  const comp = file.replace(/^.*\//, "").replace(/\.tsx$/, "");
  const back = list ? `go(${js(list.id)})` : "window.history.back()";
  const backLabel = `Back to ${list?.label ?? "the list"}`;
  const tsx = `/**
 * ${v.label}
 * ${COMPOSED} (selectionComposer.ts): the ${e.label.toLowerCase()}'s picture, title and facts${s ? ", adding it to the selection and its note" : ""}, previous and next in the
 * collection's order (no wrapping), and a not-found state. It reads the app's one store (src/app/store.ts)${s ? " and the one selection (src/app/selection.ts)" : ""}.
 */
${s ? `import { useState } from "react";\n` : ""}import { useHashId, useRecords } from "../sections/AppData";
import { go } from "../app/routes";
import { store } from "../app/store";
${s ? `import { NOTE_MAX, selection, useSelection } from "../app/selection";\n` : ""}import "../styles/${v.id}.css";

const initials = (t: string) =>
  t
    .split(/\\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

export default function ${comp}() {
  const id = useHashId(${js(v.id)}) ?? "";
  const records = useRecords(store, ${js(e.key)});
${s ? `  const sel = useSelection();\n  // A message belongs to the record it was about: switching records doesn't carry it over.\n  const [notice, setNotice] = useState({ id: "", text: "" });\n` : ""}  const index = records.findIndex((r) => r.id === id);
  const r = index >= 0 ? records[index] : undefined;
  if (!r) {
    return (
      <div className="fl-wrap cmp-detail cmp-${v.id}">
        <div className="cmp-missing">
          <h1>${e.label} not found</h1>
          <p>{"There's no ${e.label.toLowerCase()} \\u201c" + id + "\\u201d here."}</p>
          <button type="button" className="fl-btn fl-btn--secondary" onClick={() => ${back}}>
            ${backLabel}
          </button>
        </div>
      </div>
    );
  }
  const title = String(r[${js(e.titleField)}] ?? r.id);
  const src = String(r[${js(img.key)}] ?? "");
  const prev = records[index - 1];
  const next = records[index + 1];
${s ? `  const on = sel.ids.includes(r.id);\n  const locked = sel.status === "submitted";\n  const note = sel.notes[r.id] ?? "";\n` : ""}  return (
    <div className="fl-wrap cmp-detail cmp-${v.id}">
      <p className="cmp-crumbs">
        <button type="button" className="cmp-back" onClick={() => ${back}}>
          ${backLabel}
        </button>
      </p>
      <div className="cmp-detail-body">
        <figure className="cmp-figure">
          {src ? <img className="cmp-photo" src={src} alt={String(r[${js(alt?.key ?? e.titleField)}] ?? title)} /> : <span className="cmp-photo cmp-photo--none" aria-hidden="true">{initials(title)}</span>}
        </figure>
        <div className="cmp-side">
          <h1>{title}</h1>
          <dl className="cmp-facts">
${facts
  .map(
    (f) => `            {r[${js(f.key)}] ? (
              <div>
                <dt>${f.label}</dt>
                <dd>{String(r[${js(f.key)}])}</dd>
              </div>
            ) : null}`,
  )
  .join("\n")}
          </dl>
${
  s
    ? `          <div className="cmp-pick-row">
            <button type="button" className={on ? "fl-btn fl-btn--secondary cmp-pick is-on" : "fl-btn fl-btn--primary cmp-pick"} aria-pressed={on} disabled={locked} onClick={() => setNotice({ id: r.id, text: selection.toggle(r.id).message })}>
              {on ? "Remove from selection" : "Add to selection"}
            </button>
            <span className="cmp-state">{locked ? "Submitted: locked" : on ? "In your selection" : "Not selected"}</span>
          </div>
          <p className="cmp-notice" role="status" aria-live="polite">
            {notice.id === r.id ? notice.text : ""}
          </p>
          <label className="cmp-note">
            <span>Editing note</span>
            <textarea value={note} maxLength={NOTE_MAX} rows={5} disabled={locked} onChange={(ev) => selection.setNote(r.id, ev.target.value)} placeholder="Retouching, crop or colour notes for the photographer" />
            <span className="cmp-chars" aria-live="polite">
              {note.length} / {NOTE_MAX} characters
            </span>
          </label>
`
    : ""
}          <div className="cmp-pager">
            <button type="button" className="fl-btn fl-btn--secondary" disabled={!prev} onClick={() => prev && go(${js(v.id)}, prev.id)}>
              Previous
            </button>
            <span className="cmp-pos">
              {index + 1} of {records.length}
            </span>
            <button type="button" className="fl-btn fl-btn--secondary" disabled={!next} onClick={() => next && go(${js(v.id)}, next.id)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  const css = `/* ${v.label}: ${COMPOSED.toLowerCase()} (selectionComposer.ts), styled only with the app's tokens. */
.cmp-${v.id} { display: grid; gap: var(--space-5); padding-block: var(--space-6); }
.cmp-${v.id} .cmp-crumbs { margin: 0; }
.cmp-${v.id} .cmp-back { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: var(--text-sm); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.cmp-${v.id} .cmp-back:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.cmp-${v.id} .cmp-detail-body { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 3fr) minmax(16rem, 2fr); align-items: start; }
.cmp-${v.id} .cmp-figure { margin: 0; background: var(--color-surface-sunken); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.cmp-${v.id} .cmp-photo { display: block; width: 100%; max-height: 78vh; object-fit: contain; }
.cmp-${v.id} .cmp-photo--none { display: grid; place-items: center; aspect-ratio: 4 / 5; font-family: var(--font-display); font-size: var(--text-3xl); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-side { display: grid; gap: var(--space-4); }
.cmp-${v.id} .cmp-side h1, .cmp-${v.id} .cmp-missing h1 { margin: 0; font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--heading-weight, var(--weight-bold)); line-height: var(--leading-tight); }
.cmp-${v.id} .cmp-facts { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-5); margin: 0; font-size: var(--text-sm); color: var(--color-text); }
.cmp-${v.id} .cmp-facts div { display: flex; gap: var(--space-2); }
.cmp-${v.id} .cmp-facts dd { margin: 0; color: var(--color-text); font-weight: var(--weight-semibold); }
.cmp-${v.id} .cmp-pick-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.cmp-${v.id} .cmp-state { font-size: var(--text-sm); color: var(--color-text); }
.cmp-${v.id} .cmp-notice { margin: 0; min-height: 1.25em; font-size: var(--text-sm); color: var(--color-text); }
.cmp-${v.id} .cmp-note { display: grid; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-text); }
.cmp-${v.id} .cmp-note textarea { min-height: 7rem; padding: var(--space-3); border: var(--control-border, var(--border-width, 1px) solid var(--color-border)); border-radius: var(--field-radius, var(--radius-sm)); background: var(--control-bg, var(--color-surface)); color: var(--color-text); font: inherit; font-size: var(--text-md); resize: vertical; }
.cmp-${v.id} .cmp-note textarea:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
.cmp-${v.id} .cmp-chars { justify-self: end; font-variant-numeric: tabular-nums; }
.cmp-${v.id} .cmp-pager { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding-top: var(--space-3); border-top: var(--border-width, 1px) solid var(--color-border); }
.cmp-${v.id} .cmp-pos { font-size: var(--text-sm); color: var(--color-text); font-variant-numeric: tabular-nums; }
.cmp-${v.id} .cmp-missing { display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-7) var(--space-5); border: var(--border-width, 1px) dashed var(--color-border); border-radius: var(--radius-md); }
@media (max-width: 48rem) { .cmp-${v.id} .cmp-detail-body { grid-template-columns: 1fr; } }
`;
  return { files: [{ path: file, content: tsx }, { path: `src/styles/${v.id}.css`, content: css }], summary: `${v.label}: the ${e.label.toLowerCase()}'s picture and facts${s ? ", adding it to the selection, its note with a character count" : ""}, previous and next without wrapping, a not-found state` };
}

/** The selection page: the chosen set in the collection's order, progress, submit with a confirmation, the submitted state, start over. */
export function composeSelectionScreen(m: AppModel, v: ModelView, s: SelectionSpec): { files: Array<{ path: string; content: string }>; summary: string } | undefined {
  const e = m.entities.find((x) => x.key === s.entity);
  if (v.kind !== "custom" || v.id !== s.page || !e) return undefined;
  const img = imageFieldOf(e)!;
  const alt = altFieldOf(e);
  const file = screenFileOf(v);
  const comp = file.replace(/^.*\//, "").replace(/\.tsx$/, "");
  const openDetail = s.detail ? `go(${js(s.detail)}, r.id)` : "undefined";
  const toList = s.list ? `go(${js(s.list)})` : "window.history.back()";
  const tsx = `/**
 * ${v.label}
 * ${COMPOSED} (selectionComposer.ts): the chosen ${s.nouns} in the collection's order with their notes, progress, submit
 * (only with exactly ${s.count}, after a confirmation that locks the selection), the submitted state with its time, and
 * start over (after a confirmation). It reads the app's one store (src/app/store.ts) and the one selection
 * (src/app/selection.ts).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRecords } from "../sections/AppData";
import { go } from "../app/routes";
import { store } from "../app/store";
import { SELECTION_COUNT, selection, useSelection } from "../app/selection";
import "../styles/${v.id}.css";

function Confirm({ title, confirm, onCancel, onConfirm, children }: { title: string; confirm: string; onCancel: () => void; onConfirm: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") cancel.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="cmp-scrim">
      <div ref={box} className="cmp-dialog" role="dialog" aria-modal="true" aria-labelledby="cmp-dialog-title">
        <h2 id="cmp-dialog-title">{title}</h2>
        {children}
        <div className="cmp-dialog-actions">
          <button type="button" className="fl-btn fl-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ${comp}() {
  const records = useRecords(store, ${js(e.key)});
  const sel = useSelection();
  const [asking, setAsking] = useState<"" | "submit" | "start-over">("");
  const [notice, setNotice] = useState("");
  const chosen = records.filter((r) => sel.ids.includes(r.id));
  const n = chosen.length;
  const need = SELECTION_COUNT - n;
  const locked = sel.status === "submitted";
  const titleOf = (r: (typeof records)[number]) => String(r[${js(e.titleField)}] ?? r.id);
  const list = (
    <ol className="cmp-chosen">
      {chosen.map((r) => {
        const src = String(r[${js(img.key)}] ?? "");
        const note = sel.notes[r.id] ?? "";
        return (
          <li key={r.id} className="cmp-chosen-item">
            {src ? <img className="cmp-thumb" src={src} alt={String(r[${js(alt?.key ?? e.titleField)}] ?? titleOf(r))} /> : <span className="cmp-thumb cmp-thumb--none" aria-hidden="true" />}
            <div className="cmp-chosen-text">
              <h3>{titleOf(r)}</h3>
              <p className={note ? "cmp-note-text" : "cmp-note-text is-empty"}>{note || "No note"}</p>
            </div>
            <div className="cmp-chosen-actions">
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => ${openDetail}}>
                Open
              </button>
              {!locked ? (
                <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setNotice(selection.toggle(r.id).message)} aria-label={"Remove " + titleOf(r)}>
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
  return (
    <div className="fl-wrap cmp-selection cmp-${v.id}">
      <header className="cmp-head">
        <h1>${v.label}</h1>
        <p className="cmp-progress" aria-live="polite">
          <span className={locked ? "cmp-status is-submitted" : "cmp-status"}>{locked ? "Submitted" : "Draft"}</span>
          <span>
            {n} of {SELECTION_COUNT} ${s.nouns} selected
          </span>
        </p>
      </header>
      {sel.recovered ? (
        <div className="cmp-recovered" role="status">
          <p>Your saved selection couldn&apos;t be read, so it starts empty.</p>
          <button type="button" className="fl-btn fl-btn--secondary" onClick={() => selection.dismissRecovered()}>
            Dismiss
          </button>
        </div>
      ) : null}
      <p className="cmp-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {locked ? (
        <section className="cmp-submitted" aria-labelledby="cmp-submitted-title">
          <h2 id="cmp-submitted-title">Selection submitted</h2>
          <p>
            {"Submitted " + (sel.submittedAt ? new Date(sel.submittedAt).toLocaleString() : "") + ". These " + SELECTION_COUNT + " ${s.nouns} and their notes are locked; you can still browse."}
          </p>
          {list}
          <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setAsking("start-over")}>
            Start over
          </button>
        </section>
      ) : n ? (
        <>
          {list}
          <div className="cmp-submit">
            <p>{need > 0 ? "Select " + need + " more ${s.noun}" + (need === 1 ? "" : "s") + " to submit." : "Your selection is complete."}</p>
            <button type="button" className="fl-btn fl-btn--primary" disabled={n !== SELECTION_COUNT} onClick={() => setAsking("submit")}>
              Submit selection
            </button>
          </div>
        </>
      ) : (
        <div className="cmp-empty">
          <p>No ${s.nouns} selected yet. Choose {SELECTION_COUNT} from the ${s.list ? builtViews(m).find((x) => x.id === s.list)?.label.toLowerCase() ?? "list" : "list"}.</p>
          <button type="button" className="fl-btn fl-btn--primary" onClick={() => ${toList}}>
            Return to ${s.list ? builtViews(m).find((x) => x.id === s.list)?.label ?? "the list" : "the list"}
          </button>
        </div>
      )}
      {asking === "submit" ? (
        <Confirm
          title="Submit your selection?"
          confirm="Submit selection"
          onCancel={() => setAsking("")}
          onConfirm={() => {
            if (selection.submit()) setNotice("Selection submitted.");
            setAsking("");
          }}
        >
          <p>Submitting locks these {SELECTION_COUNT} ${s.nouns} and their notes.</p>
          <ul className="cmp-summary">
            {chosen.map((r) => (
              <li key={r.id}>
                <strong>{titleOf(r)}</strong>
                <span>{sel.notes[r.id] || "No note"}</span>
              </li>
            ))}
          </ul>
        </Confirm>
      ) : null}
      {asking === "start-over" ? (
        <Confirm
          title="Start over?"
          confirm="Start over"
          onCancel={() => setAsking("")}
          onConfirm={() => {
            selection.startOver();
            setNotice("Your selection is empty again.");
            setAsking("");
          }}
        >
          <p>This clears your selected ${s.nouns}, all notes, the submission status and its time.</p>
        </Confirm>
      ) : null}
    </div>
  );
}
`;
  const css = `/* ${v.label}: ${COMPOSED.toLowerCase()} (selectionComposer.ts), styled only with the app's tokens. */
.cmp-${v.id} { display: grid; gap: var(--space-5); padding-block: var(--space-6); }
.cmp-${v.id} .cmp-head { display: grid; gap: var(--space-2); }
.cmp-${v.id} .cmp-head h1 { margin: 0; font-family: var(--font-display); font-size: var(--text-3xl); font-weight: var(--heading-weight, var(--weight-bold)); line-height: var(--leading-tight); }
.cmp-${v.id} .cmp-progress { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin: 0; font-variant-numeric: tabular-nums; color: var(--color-text-muted); }
.cmp-${v.id} .cmp-status { padding: var(--space-1) var(--space-3); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--pill-radius, 999px); font-size: var(--text-sm); color: var(--color-text); }
.cmp-${v.id} .cmp-status.is-submitted { border-color: var(--color-accent); color: var(--color-accent); }
.cmp-${v.id} .cmp-notice { margin: 0; min-height: 1.25em; font-size: var(--text-sm); }
.cmp-${v.id} .cmp-recovered { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: var(--border-width, 1px) solid var(--color-warning); border-radius: var(--radius-md); }
.cmp-${v.id} .cmp-recovered p { margin: 0; }
.cmp-${v.id} .cmp-chosen { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
.cmp-${v.id} .cmp-chosen-item { display: grid; grid-template-columns: 5rem minmax(0, 1fr) auto; align-items: center; gap: var(--space-4); padding: var(--space-3); background: var(--color-surface); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-md); }
.cmp-${v.id} .cmp-thumb { width: 5rem; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--radius-sm); background: var(--color-surface-sunken); }
.cmp-${v.id} .cmp-chosen-text h3 { margin: 0 0 var(--space-1); font-size: var(--text-md); font-weight: var(--weight-semibold); }
.cmp-${v.id} .cmp-note-text { margin: 0; font-size: var(--text-sm); color: var(--color-text); overflow-wrap: anywhere; }
.cmp-${v.id} .cmp-note-text.is-empty { color: var(--color-text-muted); }
.cmp-${v.id} .cmp-chosen-actions { display: flex; gap: var(--space-2); }
.cmp-${v.id} .cmp-submit { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding-top: var(--space-4); border-top: var(--border-width, 1px) solid var(--color-border); }
.cmp-${v.id} .cmp-submit p { margin: 0; color: var(--color-text-muted); }
.cmp-${v.id} .cmp-submitted { display: grid; gap: var(--space-4); justify-items: start; }
.cmp-${v.id} .cmp-submitted h2 { margin: 0; font-size: var(--text-xl); }
.cmp-${v.id} .cmp-submitted p { margin: 0; }
.cmp-${v.id} .cmp-empty { display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-7) var(--space-5); border: var(--border-width, 1px) dashed var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); }
.cmp-${v.id} .cmp-empty p { margin: 0; }
.cmp-${v.id} .cmp-scrim { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: var(--space-4); background: color-mix(in srgb, var(--color-text) 40%, transparent); }
.cmp-${v.id} .cmp-dialog { width: min(36rem, 100%); max-height: 85vh; overflow: auto; display: grid; gap: var(--space-4); padding: var(--space-6); background: var(--color-surface); border: var(--border-width, 1px) solid var(--color-border); border-radius: var(--radius-lg, var(--radius-md)); }
.cmp-${v.id} .cmp-dialog h2 { margin: 0; font-size: var(--text-xl); }
.cmp-${v.id} .cmp-dialog p { margin: 0; }
.cmp-${v.id} .cmp-summary { margin: 0; padding-left: var(--space-5); display: grid; gap: var(--space-2); font-size: var(--text-sm); }
.cmp-${v.id} .cmp-summary li { display: grid; }
.cmp-${v.id} .cmp-summary span { color: var(--color-text-muted); overflow-wrap: anywhere; }
.cmp-${v.id} .cmp-dialog-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
@media (max-width: 40rem) { .cmp-${v.id} .cmp-chosen-item { grid-template-columns: 4rem minmax(0, 1fr); } .cmp-${v.id} .cmp-chosen-actions { grid-column: 1 / -1; } }
`;
  return { files: [{ path: file, content: tsx }, { path: `src/styles/${v.id}.css`, content: css }], summary: `${v.label}: the chosen ${s.nouns} with their notes, progress, submit with a confirmation (exactly ${s.count}) that locks them, the submitted state with its time, start over` };
}
