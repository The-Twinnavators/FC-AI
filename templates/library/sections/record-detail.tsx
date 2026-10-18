/** @flowcode-library record-detail · Record detail: status, actions by role, edit, activity (Cards)
 * Catalog ID: p.record-detail (pattern)
 * Function: The record detail (p.record-detail): one record with its status changes for the current role (a reason asked where needed), editing in place with validation, the activity trail, delete with confirmation and a not-found state. Built on the app data layer: pass the app's store (createStore from ./app-data with the app's schema and seed) and an entity key.
 * Use it as: import { RecordDetail } from "./record-detail"; <RecordDetail store={store} entity="contract" id={routeId} onBack={() => go("contracts")} backLabel? onOpenDraft={(id) => go("new-contract", id)} />
 * Built from: c.button, c.tabs, c.text-field, c.select, c.modal, c.menu, p.activity-timeline
 * Look: One record's page: a back link, the title with its id, status chip and last update, the actions the current role may take (others disabled with the reason shown), a key facts strip, tabs for the overview (fields grouped by the wizard's steps, editable in place) and the activity trail, and a details column.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-danger --radius-md --radius-lg --focus-ring
 * Use cases: contract detail; treaty detail; order detail; case detail; customer record; application review; approval page
 * Jobs to be done: understand one record; approve or send it back; correct a detail; see what happened to it
 * Keywords: detail page, record page, approval, status, edit in place, activity, audit trail, actions by role
 */
/**
 * Record detail: the page for one record, built entirely from the app's schema. A header with the record's name, id,
 * status and when it last changed; a strip of its key facts; the status changes the person's role allows (the ones it
 * doesn't are shown switched off, with the reason in words); approval steps that ask for a reason in an in-page dialog;
 * Edit, which turns the overview into a form checked field by field; an Activity tab with who did what and why; and a
 * calm "we couldn't find it" page when the id isn't there. Every change goes through the app's store, so the list, the
 * wizard and this page always agree.
 *
 * Written for FlowCode.
 *
 * Make it the app's own: pass your store, the entity key and the id from the address (useHashId), wire onBack to your
 * list and onOpenDraft to your create wizard. Fields, groups, statuses, who may approve and which changes need a
 * reason all come from the schema, so there is nothing to change here when the schema changes.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Tabs } from "./tabs-variants";
import {
  StatusChip,
  Toaster,
  fieldOf,
  formatValue,
  stepsOf,
  statusOf,
  titleOf,
  toast,
  useActivity,
  useRecords,
  useRole,
  useStore,
  validate,
  type AppStore,
  type EntityDef,
  type FieldDef,
  type RecordData,
  type TransitionDef,
} from "./app-data";
import { sampleStore } from "./app-sample";

export type RecordDetailProps = {
  store: AppStore;
  /** The entity's key in the schema ("contract"). */
  entity: string;
  /** The record's id; a missing one shows the not-found page. */
  id: string;
  /** Back to the list. The back link and the not-found page's button call it; so does Delete, once done. */
  onBack?: () => void;
  /** The back link's words; "Back to <plural>" when left out. */
  backLabel?: string;
  /** A draft record shows "Continue draft" in place of its status changes; this opens it in the wizard. */
  onOpenDraft?: (id: string) => void;
};

// ── Small helpers ──

const NUMERIC = new Set(["number", "money", "percent"]);
const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;

/** "3 days ago", "in 4 months", "just now"; the date itself when the browser can't say it. */
function relative(iso: unknown): string {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  const s = (d.getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 45) return "just now";
  if (!rtf) return stamp(iso);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[3600, "minute"], [86400, "hour"], [86400 * 30, "day"], [86400 * 365, "month"], [Infinity, "year"]];
  const per: Record<string, number> = { minute: 60, hour: 3600, day: 86400, month: 86400 * 30, year: 86400 * 365 };
  const unit = steps.find(([lim]) => a < lim)![1];
  return rtf.format(Math.round(s / per[unit]!), unit);
}

/** The full date and time, for a title and a <time>. */
function stamp(iso: unknown): string {
  if (!iso) return "—";
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? String(iso) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** A typed number as the store keeps it: "12,000" reads as 12000. */
const toNumber = (v: unknown) => (v === "" || v === undefined || v === null ? "" : Number(String(v).replace(/[,\s]/g, "")));

/** The four facts worth a glance: money first, then dates, then choices. */
function keyFacts(e: EntityDef): FieldDef[] {
  const rank = (f: FieldDef) => (f.type === "money" ? 0 : f.type === "date" ? 1 : f.key === e.statusField ? 3 : f.type === "select" ? 2 : 9);
  return e.fields
    .filter((f) => f.key !== e.titleField && f.key !== e.subtitleField && f.key !== e.statusField && rank(f) < 9)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, 4)
    .map((x) => x.f);
}

/** Who the record belongs to: the text fields named like owner, assignee or lead. */
const ownerFields = (e: EntityDef) => e.fields.filter((f) => f.type === "text" && f.key !== e.titleField && /owner|assignee|manager|lead|contact|requester/i.test(`${f.key} ${f.label}`));

/** The schema's groups for the overview, plus any field no step mentions. The status is changed by its buttons, not here. */
function groupsOf(e: EntityDef) {
  const steps = stepsOf(e).map((s) => ({ key: s.key, label: s.label, fields: s.fields.filter((k) => k !== e.statusField && fieldOf(e, k)) }));
  const seen = new Set(steps.flatMap((s) => s.fields));
  const rest = e.fields.filter((f) => !seen.has(f.key) && f.key !== e.statusField).map((f) => f.key);
  return rest.length ? [...steps, { key: "other", label: "Other details", fields: rest }] : steps;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── An in-page dialog: modal, focus kept inside and handed back, Escape cancels ──

function Dialog({ title, lede, onClose, fallbackFocus, children }: { title: string; lede?: ReactNode; onClose: () => void; fallbackFocus?: RefObject<HTMLElement | null>; children: ReactNode }) {
  const uid = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => {
      // The button that opened it may be gone (Approve, once approved): then the page's heading takes focus.
      if (back && back !== document.body && back.isConnected) back.focus();
      else if (fallbackFocus?.current?.isConnected) fallbackFocus.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKey = (ev: ReactKeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      onClose();
      return;
    }
    if (ev.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="fl-rd-scrim" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div ref={panel} className="fl-rd-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={lede ? `${uid}-d` : undefined} tabIndex={-1} onKeyDown={onKey}>
        <h3 id={`${uid}-t`} className="fl-rd-dialog-title">
          {title}
        </h3>
        {lede ? (
          <p id={`${uid}-d`} className="fl-rd-dialog-lede">
            {lede}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// ── The "…" menu: Copy id, Delete ──

function MoreMenu({ items }: { items: { id: string; label: string; icon: string; danger?: boolean; run: () => void }[] }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const away = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (!menu.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const onKey = (ev: ReactKeyboardEvent) => {
    const list = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    let to = -1;
    if (ev.key === "ArrowDown") to = (i + 1) % list.length;
    else if (ev.key === "ArrowUp") to = (i - 1 + list.length) % list.length;
    else if (ev.key === "Home") to = 0;
    else if (ev.key === "End") to = list.length - 1;
    else if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    } else if (ev.key === "Tab") {
      close(false);
      return;
    }
    if (to < 0) return;
    ev.preventDefault();
    list[to]?.focus();
  };
  return (
    <div className="fl-rd-more">
      <Button
        ref={trigger}
        variant="secondary"
        size={40}
        icon="more"
        iconOnly
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${uid}-m` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown" && !open) {
            ev.preventDefault();
            setOpen(true);
          }
        }}
      >
        More actions
      </Button>
      {open ? (
        <div ref={menu} id={`${uid}-m`} className="fl-rd-menu" role="menu" aria-label="More actions" onKeyDown={onKey}>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`fl-rd-menu-item${it.danger ? " fl-rd-menu-item--danger" : ""}`}
              onClick={() => {
                // Hand focus back first, so a dialog this opens returns it to the "…" button.
                close();
                it.run();
              }}
            >
              <Icon name={it.icon} />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── One field as an input, by its type ──

function FieldInput({ f, id, value, error, onChange }: { f: FieldDef; id: string; value: unknown; error?: string; onChange: (v: unknown) => void }) {
  const describe = [f.help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describe, "aria-required": f.required || undefined };
  let control: ReactNode;
  if (f.type === "boolean") {
    return (
      <div className="fl-rd-field fl-rd-field--check">
        <label className="fl-rd-check" htmlFor={id}>
          <input {...common} type="checkbox" checked={!!value} onChange={(ev) => onChange(ev.target.checked)} />
          <span>{f.label}</span>
        </label>
        {f.help ? (
          <p id={`${id}-h`} className="fl-rd-help">
            {f.help}
          </p>
        ) : null}
      </div>
    );
  }
  if (f.type === "longtext") control = <textarea {...common} className="fl-rd-input fl-rd-input--area" rows={3} value={String(value ?? "")} onChange={(ev) => onChange(ev.target.value)} />;
  else if (f.type === "select")
    control = (
      <span className="fl-rd-select">
        <select {...common} className="fl-rd-input" value={String(value ?? "")} onChange={(ev) => onChange(ev.target.value)}>
          <option value="">{f.required ? "Choose one" : "None"}</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </span>
    );
  else if (NUMERIC.has(f.type))
    control = (
      <span className="fl-rd-affix">
        {f.type === "money" ? <span className="fl-rd-affix-text" aria-hidden="true">{f.currency ?? "USD"}</span> : null}
        <input {...common} className="fl-rd-input fl-rd-input--num" type="text" inputMode="decimal" autoComplete="off" value={String(value ?? "")} onChange={(ev) => onChange(ev.target.value)} />
        {f.type === "percent" ? <span className="fl-rd-affix-text" aria-hidden="true">%</span> : null}
      </span>
    );
  else control = <input {...common} className="fl-rd-input" type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"} value={String(value ?? "")} onChange={(ev) => onChange(ev.target.value)} />;
  return (
    <div className={`fl-rd-field${f.type === "longtext" ? " fl-rd-field--wide" : ""}`}>
      <label className="fl-rd-label" htmlFor={id}>
        {f.label}
        {f.required ? <span className="fl-rd-req" aria-hidden="true"> *</span> : null}
        {f.type === "money" ? <span className="fl-sr"> ({f.currency ?? "USD"})</span> : f.type === "percent" ? <span className="fl-sr"> (percent)</span> : null}
      </label>
      {control}
      {f.help ? (
        <p id={`${id}-h`} className="fl-rd-help">
          {f.help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-e`} className="fl-rd-error">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── The page ──

type Pending = { kind: "reason"; t: TransitionDef } | { kind: "delete" } | { kind: "discard" } | null;

export function RecordDetail({ store, entity, id, onBack, backLabel, onOpenDraft }: RecordDetailProps) {
  const records = useRecords(store, entity);
  const e = store.schema.entities.find((x) => x.key === entity);
  const rec = records.find((r) => r.id === id);
  if (!e || !rec) return <NotFound label={e?.label ?? entity} plural={e?.plural ?? "the list"} id={id} onBack={onBack} backLabel={backLabel} />;
  // Keyed by id: another record starts with its own tab, and nothing half-edited carries over.
  return <RecordView key={rec.id} store={store} e={e} rec={rec} onBack={onBack} backLabel={backLabel} onOpenDraft={onOpenDraft} />;
}

function NotFound({ label, plural, id, onBack, backLabel }: { label: string; plural: string; id: string; onBack?: () => void; backLabel?: string }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Arriving here after a delete leaves focus nowhere: put it on the heading so the next Tab starts from the page.
    if (!document.activeElement || document.activeElement === document.body) h.current?.focus();
  }, []);
  return (
    <div className="fl-rd-page" data-fl="p.record-detail">
      <div className="fl-rd-missing">
        <span className="fl-rd-missing-icon" aria-hidden="true">
          <Icon name="search" />
        </span>
        <h2 ref={h} tabIndex={-1} className="fl-rd-missing-title">
          We couldn't find {label.toLowerCase()} <span className="fl-rd-nowrap">{id || "(no id)"}</span>
        </h2>
        <p className="fl-rd-missing-text">It may have been deleted, or the link you followed is out of date.</p>
        {onBack ? (
          <Button variant="secondary" size={40} icon="arrow-left" onClick={onBack}>
            {backLabel ?? `Back to ${plural.toLowerCase()}`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RecordView({ store, e, rec, onBack, backLabel, onOpenDraft }: { store: AppStore; e: EntityDef; rec: RecordData; onBack?: () => void; backLabel?: string; onOpenDraft?: (id: string) => void }) {
  const uid = useId();
  const [role] = useRole(store);
  const { user } = useStore(store);
  const activity = useActivity(store, e.key, rec.id);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const title = titleOf(e, rec);
  const status = statusOf(e, rec);
  const groups = useMemo(() => groupsOf(e), [e]);
  const editable = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
  const facts = useMemo(() => keyFacts(e), [e]);
  const owners = useMemo(() => ownerFields(e), [e]);
  const subtitle = e.subtitleField ? rec[e.subtitleField] : undefined;

  // ── Status changes ──
  const transitions = (e.transitions ?? []).filter((t) => e.statusField && t.from.includes(String(rec[e.statusField])));
  const blocked = (t: TransitionDef) => (t.roles?.length && !t.roles.includes(role) ? `Only ${t.roles.join(" or ")} can ${t.label.toLowerCase()}.` : "");
  const run = (t: TransitionDef, why?: string) => {
    const r = store.transition(e.key, rec.id, t.key, why);
    toast(r.message, r.ok ? "success" : "danger");
    return r.ok;
  };
  const start = (t: TransitionDef) => {
    if (blocked(t)) return;
    if (t.needsReason) {
      setReason("");
      setPending({ kind: "reason", t });
    } else {
      run(t);
      // The button is gone once the status moves on: keep focus on the page rather than losing it.
      window.setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) heading.current?.focus();
      });
    }
  };

  // ── Editing ──
  // What the form starts from; taken when editing starts, so a change made elsewhere doesn't overwrite what is typed.
  const fromRecord = () => {
    const out: Record<string, unknown> = {};
    for (const k of editable) {
      const v = rec[k];
      out[k] = fieldOf(e, k)!.type === "boolean" ? !!v : v === undefined || v === null ? "" : String(v);
    }
    return out;
  };
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [tried, setTried] = useState(false);
  const normal = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const k of editable) out[k] = NUMERIC.has(fieldOf(e, k)!.type) ? toNumber(draft[k]) : draft[k];
    return out;
  }, [draft, editable, e]);
  const changed = useMemo(
    () =>
      editable.filter((k) => {
        const before = rec[k];
        const after = normal[k];
        if (fieldOf(e, k)!.type === "boolean") return !!before !== !!after;
        return String(before ?? "") !== String(after ?? "");
      }),
    [editable, normal, rec, e],
  );
  const errors = useMemo(() => (tried ? validate(e, normal, editable) : {}), [tried, e, normal, editable]);
  const errorCount = Object.keys(errors).length;
  const fieldId = (k: string) => `${uid}-f-${k}`;

  const beginEdit = () => {
    setDraft(fromRecord());
    setTried(false);
    setTab("overview");
    setEditing(true);
  };
  useEffect(() => {
    if (editing) {
      // The first field, so typing can start at once.
      document.getElementById(fieldId(editable[0] ?? ""))?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  const save = () => {
    const errs = validate(e, normal, editable);
    setTried(true);
    const bad = editable.find((k) => errs[k]);
    if (bad) {
      document.getElementById(fieldId(bad))?.focus();
      return;
    }
    if (!changed.length) {
      setEditing(false);
      toast("Nothing changed, so nothing to save.", "neutral");
      return;
    }
    const patch: Partial<RecordData> = {};
    for (const k of changed) patch[k] = normal[k];
    store.update(e.key, rec.id, patch);
    toast("Saved");
    setEditing(false);
    window.setTimeout(() => heading.current?.focus());
  };
  const cancel = () => {
    if (changed.length) setPending({ kind: "discard" });
    else {
      setEditing(false);
      window.setTimeout(() => heading.current?.focus());
    }
  };

  // ── Header pieces ──
  const back = backLabel ?? `Back to ${e.plural.toLowerCase()}`;
  const notes = transitions.map((t) => ({ t, why: blocked(t) })).filter((x) => x.why);

  const overview = editing ? (
    <form
      className="fl-rd-form"
      noValidate
      aria-label={`Edit ${title}`}
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
    >
      {errorCount ? (
        <p className="fl-rd-summary" role="alert">
          <Icon name="alert" />
          {errorCount === 1 ? "One field needs a look before this can be saved." : `${errorCount} fields need a look before this can be saved.`}
        </p>
      ) : null}
      {groups.map((g) => (
        <fieldset key={g.key} className="fl-rd-group">
          <legend className="fl-rd-group-title">{g.label}</legend>
          <div className="fl-rd-fields">
            {g.fields.map((k) => (
              <FieldInput key={k} f={fieldOf(e, k)!} id={fieldId(k)} value={draft[k]} error={errors[k]} onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))} />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="fl-rd-formbar">
        <span className="fl-rd-dirty" aria-live="polite">
          {changed.length ? `${changed.length} ${changed.length === 1 ? "change" : "changes"} not saved yet` : "No changes yet"}
        </span>
        <Button type="button" variant="secondary" size={40} onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size={40} icon="check">
          Save
        </Button>
      </div>
    </form>
  ) : (
    <div className="fl-rd-overview">
      {groups.map((g) => (
        <section key={g.key} className="fl-rd-group" aria-labelledby={`${uid}-g-${g.key}`}>
          <h3 id={`${uid}-g-${g.key}`} className="fl-rd-group-title">
            {g.label}
          </h3>
          <dl className="fl-rd-dl">
            {g.fields.map((k) => {
              const f = fieldOf(e, k)!;
              const v = rec[k];
              const empty = v === undefined || v === null || v === "";
              return (
                <div key={k} className={`fl-rd-pair${f.type === "longtext" ? " fl-rd-pair--wide" : ""}`}>
                  <dt>{f.label}</dt>
                  <dd className={empty ? "fl-rd-empty" : f.type === "longtext" ? "fl-rd-long" : undefined}>{empty ? "Not given" : formatValue(f, v)}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );

  const feed = activity.length ? (
    <ol className="fl-rd-feed" aria-label={`What has happened to ${title}, newest first`}>
      {[...activity]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => (
          <li key={a.id} className="fl-rd-event">
            <span className="fl-rd-event-dot" aria-hidden="true" />
            <p className="fl-rd-event-what">
              <strong>{a.who === user ? `${a.who} (you)` : a.who}</strong> {a.text}
            </p>
            <time className="fl-rd-event-when" dateTime={a.at} title={stamp(a.at)}>
              {relative(a.at)}
            </time>
            {a.reason ? (
              <blockquote className="fl-rd-reason">
                <span className="fl-sr">Reason: </span>
                {a.reason}
              </blockquote>
            ) : null}
          </li>
        ))}
    </ol>
  ) : (
    <div className="fl-rd-none">
      <Icon name="clock" />
      <p>Nothing has happened to this record yet. Edits, approvals and notes will show here.</p>
    </div>
  );

  return (
    <div className="fl-rd-page" data-fl="p.record-detail">
      <header className="fl-rd-head">
        {onBack ? (
          <button type="button" className="fl-rd-back" onClick={onBack}>
            <Icon name="arrow-left" />
            {back}
          </button>
        ) : null}
        <div className="fl-rd-titlerow">
          <div className="fl-rd-titles">
            <h2 ref={heading} tabIndex={-1} className="fl-rd-title">
              {title}
            </h2>
            <p className="fl-rd-meta">
              <span className="fl-rd-id">{rec.id}</span>
              <StatusChip entity={e} record={rec} />
              {subtitle !== undefined && subtitle !== "" ? <span>{formatValue(e.subtitleField ? fieldOf(e, e.subtitleField) : undefined, subtitle)}</span> : null}
              <span className="fl-rd-updated">
                Updated{" "}
                <time dateTime={String(rec.updatedAt ?? "")} title={stamp(rec.updatedAt)}>
                  {relative(rec.updatedAt)}
                </time>
              </span>
            </p>
          </div>
          <div className="fl-rd-actions" role="group" aria-label={`Actions for ${title}`}>
            {rec.draft ? (
              <Button variant="primary" size={40} icon="pencil" onClick={() => (onOpenDraft ? onOpenDraft(rec.id) : toast("Open this draft in the create wizard to finish it.", "info"))}>
                Continue draft
              </Button>
            ) : (
              transitions.map((t) => {
                const why = blocked(t);
                return (
                  <Button
                    key={t.key}
                    variant={why ? "secondary" : t.tone === "danger" ? "destructive" : t.tone === "primary" ? "primary" : "secondary"}
                    size={40}
                    className={why ? "fl-rd-act-off" : undefined}
                    aria-disabled={why ? true : undefined}
                    aria-describedby={why ? `${uid}-why-${t.key}` : undefined}
                    onClick={() => start(t)}
                  >
                    {t.label}
                  </Button>
                );
              })
            )}
            {!editing ? (
              <Button variant="secondary" size={40} icon="pencil" onClick={beginEdit}>
                Edit
              </Button>
            ) : null}
            <MoreMenu
              items={[
                {
                  id: "copy",
                  label: "Copy record id",
                  icon: "copy",
                  run: () => {
                    // No clipboard (an insecure page, an older browser): the id is shown to copy by hand.
                    if (!navigator.clipboard) {
                      toast(`The id is ${rec.id}.`, "neutral");
                      return;
                    }
                    navigator.clipboard.writeText(rec.id).then(
                      () => toast(`Copied ${rec.id}.`, "neutral"),
                      () => toast(`Couldn't copy. The id is ${rec.id}.`, "warning"),
                    );
                  },
                },
                { id: "delete", label: `Delete ${e.label.toLowerCase()}`, icon: "trash", danger: true, run: () => setPending({ kind: "delete" }) },
              ]}
            />
          </div>
        </div>
        {notes.length && !rec.draft ? (
          <ul className="fl-rd-why">
            {notes.map(({ t, why }) => (
              <li key={t.key} id={`${uid}-why-${t.key}`}>
                <Icon name="lock" />
                {why} You are acting as {role || "a guest"}.
              </li>
            ))}
          </ul>
        ) : null}
        {facts.length ? (
          <dl className="fl-rd-facts">
            {facts.map((f) => (
              <div key={f.key} className={`fl-rd-fact fl-rd-fact--${f.type}`}>
                <dt>{f.label}</dt>
                <dd>
                  {formatValue(f, rec[f.key])}
                  {f.type === "date" && rec[f.key] ? <span className="fl-rd-fact-note">{relative(rec[f.key])}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <div className="fl-rd-body">
        <div className="fl-rd-main">
          <Tabs
            label={`${title}: sections`}
            value={tab}
            onChange={(t) => setTab(t)}
            tabs={[
              { id: "overview", label: editing ? "Overview (editing)" : "Overview", panel: overview },
              { id: "activity", label: "Activity", count: activity.length, panel: feed },
            ]}
          />
        </div>
        <aside className="fl-rd-side" aria-labelledby={`${uid}-side`}>
          <h3 id={`${uid}-side`} className="fl-rd-side-title">
            Details
          </h3>
          <dl className="fl-rd-side-dl">
            <div>
              <dt>{e.label} id</dt>
              <dd className="fl-rd-id">{rec.id}</dd>
            </div>
            {status ? (
              <div>
                <dt>Status</dt>
                <dd>{status.label}</dd>
              </div>
            ) : null}
            {owners.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{formatValue(f, rec[f.key])}</dd>
              </div>
            ))}
            <div>
              <dt>Created</dt>
              <dd>{rec.createdAt ? <time dateTime={String(rec.createdAt)}>{stamp(rec.createdAt)}</time> : "Before records were tracked"}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{rec.updatedAt ? <time dateTime={String(rec.updatedAt)}>{stamp(rec.updatedAt)}</time> : "—"}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {pending?.kind === "reason" ? (
        <Dialog title={`${pending.t.label}: ${title}`} lede={`The reason goes into the activity trail, so whoever picks this up next can see why.`} onClose={() => setPending(null)} fallbackFocus={heading}>
          <form
            className="fl-rd-dialog-form"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!reason.trim()) return;
              if (run(pending.t, reason.trim())) setPending(null);
            }}
          >
            <label className="fl-rd-label" htmlFor={`${uid}-reason`}>
              Reason
            </label>
            <textarea id={`${uid}-reason`} data-autofocus className="fl-rd-input fl-rd-input--area" rows={4} required value={reason} onChange={(ev) => setReason(ev.target.value)} aria-describedby={`${uid}-reason-h`} />
            <p id={`${uid}-reason-h`} className="fl-rd-help">
              {reason.trim() ? "Ready when you are." : "Write a line or two to continue."}
            </p>
            <div className="fl-rd-dialog-bar">
              <Button type="button" variant="secondary" size={40} onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={pending.t.tone === "danger" ? "destructive" : "primary"} size={40} disabled={!reason.trim()}>
                {pending.t.label}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {pending?.kind === "delete" ? (
        <Dialog title={`Delete ${title}?`} lede={`${e.label} ${rec.id} goes for everyone, with its details. The activity trail keeps a note that it was deleted.`} onClose={() => setPending(null)} fallbackFocus={heading}>
          <div className="fl-rd-dialog-bar">
            <Button type="button" variant="secondary" size={40} data-autofocus onClick={() => setPending(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              size={40}
              icon="trash"
              onClick={() => {
                setPending(null);
                store.remove(e.key, rec.id);
                toast(`Deleted ${e.label.toLowerCase()} ${title}.`, "neutral");
                onBack?.();
              }}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      ) : null}
      {pending?.kind === "discard" ? (
        <Dialog title="Discard your changes?" lede={`${changed.length} ${changed.length === 1 ? "change" : "changes"} to ${title} will be lost.`} onClose={() => setPending(null)} fallbackFocus={heading}>
          <div className="fl-rd-dialog-bar">
            <Button type="button" variant="secondary" size={40} data-autofocus onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size={40}
              onClick={() => {
                setPending(null);
                setEditing(false);
                setTried(false);
                window.setTimeout(() => heading.current?.focus());
              }}
            >
              Discard
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  entity: "contract",
  heading: "Record detail",
  what: "One contract's page: status changes your role allows, a reason when one is needed, inline editing with checks, and the activity trail. Changes are kept in this browser.",
  missing: "CTR-9999",
  back: "Back to the list",
  draft: "This draft would open in the create wizard.",
};

export default function RecordDetailSheet() {
  const s = SAMPLE;
  const uid = useId();
  const e = sampleStore.entity(s.entity);
  const records = useRecords(sampleStore, s.entity);
  const [role, setRole] = useRole(sampleStore);
  const [id, setId] = useState(() => records.find((r) => r.status === "review" && !r.draft)?.id ?? records[0]?.id ?? s.missing);
  const known = records.some((r) => r.id === id);
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>{s.heading}</h3>
        <p className="fl-ctl-btn-what">{s.what}</p>
        <div className="fl-rd-demo">
          <div className="fl-rd-demo-field">
            <label className="fl-rd-label" htmlFor={`${uid}-rec`}>
              Record
            </label>
            <span className="fl-rd-select">
              <select id={`${uid}-rec`} className="fl-rd-input" value={id} onChange={(ev) => setId(ev.target.value)}>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {titleOf(e, r)} ({statusOf(e, r)?.label ?? "No status"})
                  </option>
                ))}
                {!known && id !== s.missing ? <option value={id}>{id} (deleted)</option> : null}
                <option value={s.missing}>{s.missing} (doesn't exist)</option>
              </select>
            </span>
          </div>
          <div className="fl-rd-demo-field">
            <label className="fl-rd-label" htmlFor={`${uid}-role`}>
              Acting as
            </label>
            <span className="fl-rd-select">
              <select id={`${uid}-role`} className="fl-rd-input" value={role} onChange={(ev) => setRole(ev.target.value)}>
                {(sampleStore.schema.roles ?? []).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <Button
            variant="tertiary"
            size={40}
            icon="refresh"
            onClick={() => {
              sampleStore.reset();
              toast("Sample data is back to how it started.", "neutral");
            }}
          >
            Reset sample data
          </Button>
        </div>
        <RecordDetail store={sampleStore} entity={s.entity} id={id} onBack={() => toast(s.back, "neutral")} onOpenDraft={() => toast(s.draft, "info")} />
        <Toaster />
      </div>
    </section>
  );
}
