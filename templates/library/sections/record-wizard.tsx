/** @flowcode-library record-wizard · Record wizard: steps, readiness, drafts and review (Forms)
 * Catalog ID: p.record-wizard (pattern)
 * Function: The record wizard (p.record-wizard): creating or continuing one record in the schema's steps, with per-step progress, validation on leave and on Next, a readiness panel of blockers, save draft and discard with confirmation, a review step and submit that can send the record on (e.g. for review). Built on the app data layer: pass the app's store (createStore from ./app-data with the app's schema and seed) and an entity key.
 * Use it as: import { RecordWizard } from "./record-wizard"; <RecordWizard store={store} entity="contract" draftId? title? submitTransition?="submit" onDone={(id) => go("contract-detail", id)} onCancel={() => go("contracts")} />  // steps come from the entity's schema
 * Built from: c.button, c.text-field, c.select, c.switch, p.stepper, c.modal
 * Look: A create flow: a header with save state, Save draft and Discard; a stepper where each step shows its % complete and whether it has problems; the step's fields with inline errors; a readiness panel listing what still blocks submission, each jumping to its field; and a review step with an Edit link per step before Submit.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-danger --field-radius --control-md --radius-md --focus-ring
 * Use cases: new contract; treaty onboarding; new application; new order; account setup; new case; claim submission
 * Jobs to be done: create a record step by step; see what is still missing; save and come back later; check everything before submitting
 * Keywords: wizard, multi-step form, onboarding, create flow, stepper, draft, validation, review and submit
 */
/**
 * Record wizard: the create (or continue-a-draft) flow for one kind of record, built entirely from the app's schema.
 * The entity's steps become a numbered stepper, each step showing how much of it is filled in and whether it still has
 * problems; the last step is always a review of everything entered. A readiness panel beside the form lists what still
 * blocks submission across every step, each item a button that jumps to the field. The header says whether there are
 * unsaved changes, and offers Save draft and Discard; Discard and leaving with unsaved changes ask first, in the page.
 *
 * Errors appear when a person leaves a field or presses Next, never while they type; Next on a step with problems shows
 * them, moves focus to the first one and stays put. Back always works, and any step can be opened from the stepper.
 * Enter in a one-line field moves to the next field instead of submitting.
 *
 * Written for FlowCode.
 *
 * Make it the app's own: pass the app's store and an entity key; the steps, labels, help, required fields, limits and
 * the status change applied on submit all come from the schema in app-data, so a new kind of record needs no code here.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { completion, fieldOf, formatValue, stepsOf, toast, Toaster, validate, type AppStore, type FieldDef, type RecordData } from "./app-data";
import { sampleStore } from "./app-sample";

export interface RecordWizardProps {
  store: AppStore;
  /** The entity key in the store's schema ("contract"). */
  entity: string;
  /** Continue this draft: its values load in and saving updates it. */
  draftId?: string;
  /** The heading; "New <entity>" or "Continue draft: <name>" when left out. */
  title?: string;
  /** Called with the record's id once it is submitted. */
  onDone?: (id: string) => void;
  /** Called when the person discards or cancels (after confirming, when there was something to lose). */
  onCancel?: () => void;
  /** A transition key applied right after the record is created (e.g. "submit" to send it for review). */
  submitTransition?: string;
}

type Values = Record<string, unknown>;
type Ask = null | "discard" | "cancel";

/** A bare yyyy-mm-dd is read as UTC midnight (a day early west of Greenwich); give it a local time before formatting. */
const readable = (f: FieldDef | undefined, v: unknown) => (f?.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

function since(at: Date, now: number): string {
  const s = Math.round((now - at.getTime()) / 1000);
  if (s < 45) return "Saved just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Saved ${m} minute${m === 1 ? "" : "s"} ago`;
  return `Saved at ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at)}`;
}

export function RecordWizard({ store, entity, draftId, title, onDone, onCancel, submitTransition }: RecordWizardProps) {
  const e = store.entity(entity);
  const steps = useMemo(() => stepsOf(e), [e]);
  const allKeys = useMemo(() => steps.flatMap((s) => s.fields), [steps]);
  const uid = useId().replace(/:/g, "");
  const fid = (k: string) => `wz-${uid}-${k}`;

  // A draft's own values (only the schema's fields: not its id, dates or status).
  const [initial] = useState<{ values: Values; title?: string }>(() => {
    const rec = draftId ? (store.get().records[entity] ?? []).find((r) => r.id === draftId) : undefined;
    // A switch always has a value: off until turned on.
    const values: Values = Object.fromEntries(e.fields.filter((f) => f.type === "boolean").map((f) => [f.key, false]));
    if (!rec) return { values };
    for (const f of e.fields) if (!isEmpty(rec[f.key])) values[f.key] = rec[f.key];
    return { values, title: String(rec[e.titleField] ?? rec.id) };
  });
  const [values, setValues] = useState<Values>(initial.values);
  const [recordId, setRecordId] = useState<string | undefined>(draftId && initial.title !== undefined ? draftId : undefined);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  /** Steps the person has left (or pressed Next on): their problems are shown. */
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const mounted = useRef(false);

  const isReview = index === steps.length;
  const errors = useMemo(() => validate(e, values, allKeys), [e, values, allKeys]);
  const overall = useMemo(() => completion(e, values, allKeys), [e, values, allKeys]);
  const blockers = useMemo(
    () => steps.map((s, i) => ({ step: s, index: i, items: s.fields.filter((k) => errors[k]).map((k) => ({ key: k, text: errors[k]! })) })).filter((g) => g.items.length),
    [steps, errors],
  );
  const blockerCount = blockers.reduce((n, g) => n + g.items.length, 0);

  // The "Saved n minutes ago" line keeps itself current.
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, [savedAt]);

  // A new step: focus its heading (or the field a readiness item asked for). Not on first render: the page keeps focus.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const target = pendingFocus.current ? document.getElementById(pendingFocus.current) : headingRef.current;
    pendingFocus.current = null;
    target?.focus();
  }, [index]);

  const set = (k: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };
  const touch = (k: string) => setTouched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  const showError = (k: string, stepKey: string) => !!errors[k] && (touched.has(k) || checked.has(stepKey));

  const goTo = (i: number, focusKey?: string) => {
    if (!isReview && i !== index) setChecked((prev) => new Set(prev).add(steps[index]!.key));
    if (focusKey) touch(focusKey);
    setVisited((prev) => new Set(prev).add(i));
    if (i === index) {
      if (focusKey) document.getElementById(fid(focusKey))?.focus();
      else headingRef.current?.focus();
      return;
    }
    pendingFocus.current = focusKey ? fid(focusKey) : null;
    setIndex(i);
  };

  const next = () => {
    const step = steps[index]!;
    setChecked((prev) => new Set(prev).add(step.key));
    const bad = step.fields.find((k) => errors[k]);
    if (bad) {
      // Stay; the errors render now, then focus the first one so it is read with its message.
      requestAnimationFrame(() => document.getElementById(fid(bad))?.focus());
      return;
    }
    goTo(index + 1);
  };

  const saveDraft = () => {
    // Stays enabled (disabling it under focus would drop keyboard focus); with nothing new it just says so.
    if (!dirty) {
      toast(recordId ? "No changes since the last save." : "Nothing to save yet.", "neutral");
      return;
    }
    if (recordId) store.update(entity, recordId, { ...values, draft: true } as Partial<RecordData>, "Saved the draft");
    else setRecordId(store.create(entity, values as Partial<RecordData>, { draft: true }).id);
    setDirty(false);
    setSavedAt(new Date());
    setNow(Date.now());
    toast("Draft saved");
  };

  const submit = () => {
    if (blockerCount) return;
    setBusy(true);
    let id = recordId;
    if (id) store.update(entity, id, { ...values, draft: false } as Partial<RecordData>, `Completed the ${e.label.toLowerCase()}`);
    else id = store.create(entity, values as Partial<RecordData>).id;
    const name = String(values[e.titleField] ?? id);
    if (submitTransition) {
      const r = store.transition(entity, id, submitTransition);
      toast(r.ok ? r.message : `${e.label} ${name} was saved, but: ${r.message}`, r.ok ? "success" : "warning");
    } else toast(`${e.label} ${name} created.`);
    setDirty(false);
    setBusy(false);
    onDone?.(id);
  };

  const cancel = () => (dirty ? setAsk("cancel") : onCancel?.());

  // Enter in a one-line field moves on to the next field (or to Next) instead of submitting the form.
  const onFormKey = (ev: KeyboardEvent<HTMLFormElement>) => {
    const t = ev.target as HTMLElement;
    if (ev.key !== "Enter" || !(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
    ev.preventDefault();
    const list = [...ev.currentTarget.querySelectorAll<HTMLElement>("input, select, textarea")].filter((x) => !(x as HTMLInputElement).disabled);
    const after = list[list.indexOf(t) + 1];
    (after ?? nextRef.current)?.focus();
  };

  const heading = title ?? (initial.title !== undefined ? `Continue draft: ${initial.title}` : `New ${e.label.toLowerCase()}`);
  const stepState = (i: number) => {
    if (i === index) return "current";
    if (i === steps.length) return blockerCount ? "todo" : visited.has(i) ? "done" : "todo";
    const s = steps[i]!;
    const bad = s.fields.some((k) => errors[k]);
    if (bad && checked.has(s.key)) return "problems";
    if (!bad && visited.has(i)) return "done";
    return "todo";
  };
  const statusText: Record<string, string> = { current: "current step", done: "complete", problems: "has problems", todo: "not started" };

  return (
    <div className="fl-wz-root">
      <header className="fl-wz-head">
        <div className="fl-wz-head-text">
          <h2 className="fl-wz-title">{heading}</h2>
          <p className="fl-wz-meta">
            {recordId ? <span className="fl-wz-id">{recordId}</span> : <span>Not saved yet</span>}
            <span className={`fl-wz-save${dirty ? " fl-wz-save--dirty" : ""}`} aria-live="polite">
              {dirty ? (
                <>
                  <span className="fl-wz-dot" aria-hidden="true" />
                  Unsaved changes
                </>
              ) : savedAt ? (
                since(savedAt, now)
              ) : null}
            </span>
          </p>
        </div>
        <div className="fl-wz-head-actions">
          <Button variant="tertiary" size={32} onClick={() => setAsk("discard")}>
            Discard
          </Button>
          <Button variant="secondary" size={32} icon="download" onClick={saveDraft}>
            Save draft
          </Button>
        </div>
      </header>

      <nav className="fl-wz-nav" aria-label={`${e.label} steps`}>
        <ol className="fl-wz-steps">
          {[...steps, { key: "review", label: "Review", fields: [] as string[] }].map((s, i) => {
            const st = stepState(i);
            const pct = i === steps.length ? overall : completion(e, values, s.fields);
            const extra = i === steps.length ? (blockerCount ? `${blockerCount} to fix` : "Ready") : `${pct}% complete`;
            return (
              <li key={s.key} className={`fl-wz-step fl-wz-step--${st}`}>
                <button type="button" className="fl-wz-step-btn" aria-current={i === index ? "step" : undefined} onClick={() => goTo(i)}>
                  <span className="fl-wz-step-mark" aria-hidden="true">
                    {st === "done" ? <Icon name="check" /> : st === "problems" ? <Icon name="alert" /> : i + 1}
                  </span>
                  <span className="fl-wz-step-text">
                    <span className="fl-wz-step-label">{s.label}</span>
                    <span className="fl-wz-step-pct">{extra}</span>
                    <span className="fl-sr">, {statusText[st]}</span>
                  </span>
                  <span className="fl-wz-step-bar" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="fl-wz-body">
        <form className="fl-wz-form" noValidate onKeyDown={onFormKey} onSubmit={(ev) => { ev.preventDefault(); if (isReview) submit(); else next(); }}>
          <div className="fl-wz-step-head">
            <p className="fl-wz-count">
              Step {index + 1} of {steps.length + 1}
            </p>
            <h3 className="fl-wz-step-title" tabIndex={-1} ref={headingRef}>
              {isReview ? "Review and submit" : steps[index]!.label}
            </h3>
            {isReview ? <p className="fl-wz-help">Check what will be saved. Edit any part before submitting.</p> : steps[index]!.help ? <p className="fl-wz-help">{steps[index]!.help}</p> : null}
          </div>

          {isReview ? (
            <div className="fl-wz-review">
              {steps.map((s, i) => (
                <section key={s.key} className="fl-wz-review-group" aria-labelledby={`${uid}-rv-${s.key}`}>
                  <div className="fl-wz-review-head">
                    <h4 id={`${uid}-rv-${s.key}`}>{s.label}</h4>
                    <button type="button" className="fl-wz-link" onClick={() => goTo(i)}>
                      Edit<span className="fl-sr"> {s.label}</span>
                    </button>
                  </div>
                  <dl className="fl-wz-dl">
                    {s.fields.map((k) => {
                      const f = fieldOf(e, k);
                      return (
                        <div key={k} className={`fl-wz-dl-row${errors[k] ? " fl-wz-dl-row--bad" : ""}`}>
                          <dt>{f?.label ?? k}</dt>
                          <dd>
                            {formatValue(f, readable(f, values[k]))}
                            {errors[k] ? <span className="fl-wz-dl-err"> {errors[k]}</span> : null}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}
              {blockerCount ? (
                <p className="fl-wz-reason" id={`${uid}-why`}>
                  <Icon name="alert" />
                  {blockerCount === 1 ? "One thing" : `${blockerCount} things`} to fix before this can be submitted. They are listed under Readiness.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="fl-wz-fields">
              {steps[index]!.fields.map((k) => {
                const f = fieldOf(e, k);
                if (!f) return null;
                return (
                  <WizardField
                    key={k}
                    f={f}
                    id={fid(k)}
                    value={values[k]}
                    error={showError(k, steps[index]!.key) ? errors[k] : undefined}
                    onChange={(v) => set(k, v)}
                    onBlur={() => touch(k)}
                  />
                );
              })}
            </div>
          )}

          <div className="fl-wz-foot">
            <Button variant="tertiary" size={40} onClick={cancel}>
              Cancel
            </Button>
            <span className="fl-wz-foot-gap" />
            {index > 0 ? (
              <Button variant="secondary" size={40} icon="chevron-left" onClick={() => goTo(index - 1)}>
                Back
              </Button>
            ) : null}
            {isReview ? (
              <Button type="submit" size={40} icon="send" busy={busy} disabled={!!blockerCount} aria-describedby={blockerCount ? `${uid}-why` : undefined} ref={nextRef}>
                {submitTransition ? (e.transitions?.find((t) => t.key === submitTransition)?.label ?? "Submit") : `Create ${e.label.toLowerCase()}`}
              </Button>
            ) : (
              <Button type="submit" size={40} icon="chevron-right" iconAt="end" ref={nextRef}>
                {index === steps.length - 1 ? "Review" : "Next"}
              </Button>
            )}
          </div>
        </form>

        <aside className="fl-wz-ready" aria-labelledby={`${uid}-ready`}>
          <h3 id={`${uid}-ready`} className="fl-wz-ready-title">
            Readiness
          </h3>
          <div className="fl-wz-overall">
            <span className="fl-wz-overall-num">{overall}%</span>
            <span className="fl-wz-overall-what">filled in</span>
          </div>
          <span className="fl-wz-bar" aria-hidden="true">
            <span style={{ width: `${overall}%` }} />
          </span>
          {blockerCount ? (
            <>
              <p className="fl-wz-ready-sum">
                {blockerCount} {blockerCount === 1 ? "thing blocks" : "things block"} submission
              </p>
              {blockers.map((g) => (
                <div key={g.step.key} className="fl-wz-block-group">
                  <h4>{g.step.label}</h4>
                  <ul>
                    {g.items.map((b) => (
                      <li key={b.key}>
                        <button type="button" className="fl-wz-blocker" onClick={() => goTo(g.index, b.key)}>
                          {b.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <p className="fl-wz-ok">
              <Icon name="check" />
              Ready to submit
            </p>
          )}
        </aside>
      </div>

      {ask ? (
        <ConfirmDialog
          title={ask === "discard" ? `Discard this ${e.label.toLowerCase()}?` : "Leave without saving?"}
          body={
            ask === "discard"
              ? recordId
                ? `Changes since the last save are lost. The saved draft ${recordId} stays in the list.`
                : `Everything entered here is lost. Nothing has been saved yet.`
              : `You have unsaved changes. Save a draft first to keep them.`
          }
          confirmLabel={ask === "discard" ? "Discard" : "Leave without saving"}
          onConfirm={() => {
            setAsk(null);
            setDirty(false);
            onCancel?.();
          }}
          onClose={() => setAsk(null)}
        />
      ) : null}
    </div>
  );
}

/** One field, drawn for its type: label, required mark, help, the control, and its error under it. */
function WizardField({ f, id, value, error, onChange, onBlur }: { f: FieldDef; id: string; value: unknown; error?: string; onChange: (v: unknown) => void; onBlur: () => void }) {
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const described = [f.help ? helpId : "", error ? errId : ""].filter(Boolean).join(" ") || undefined;
  const cls = `fl-ctl-field fl-ctl-field--outlined fl-wz-control${error ? " is-invalid" : ""}`;
  const common = { id, onBlur, "aria-invalid": error ? true : undefined, "aria-describedby": described, required: f.required };
  const str = value === undefined || value === null ? "" : String(value);

  let control: ReactNode;
  switch (f.type) {
    case "longtext":
      control = <textarea {...common} className={`${cls} fl-wz-textarea`} rows={4} value={str} onChange={(ev) => onChange(ev.target.value)} />;
      break;
    case "number":
    case "money":
    case "percent": {
      const adorn = f.type === "money" ? (f.currency ?? "USD") : f.type === "percent" ? "%" : null;
      control = (
        <span className={`fl-wz-affix${f.type === "money" ? " fl-wz-affix--pre" : f.type === "percent" ? " fl-wz-affix--post" : ""}`}>
          {adorn ? (
            <span className="fl-wz-adorn" aria-hidden="true">
              {adorn}
            </span>
          ) : null}
          <input
            {...common}
            className={cls}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={str}
            aria-label={adorn ? `${f.label}${f.type === "money" ? `, in ${adorn}` : ", percent"}` : undefined}
            onChange={(ev) => {
              const raw = ev.target.value.replace(/[,\s]/g, "");
              onChange(raw === "" ? undefined : Number.isNaN(Number(raw)) ? ev.target.value : Number(raw));
            }}
          />
        </span>
      );
      break;
    }
    case "date":
      control = <input {...common} className={cls} type="date" value={str} onChange={(ev) => onChange(ev.target.value || undefined)} />;
      break;
    case "select":
      control = (
        <span className="fl-ctl-select">
          <select {...common} className={cls} value={str} onChange={(ev) => onChange(ev.target.value || undefined)}>
            <option value="">Choose {f.label.toLowerCase()}</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" />
        </span>
      );
      break;
    case "boolean":
      return (
        <div className="fl-wz-field fl-wz-field--switch">
          <label className="fl-wz-switch-row" htmlFor={id}>
            <span className="fl-ctl-switch fl-ctl-switch--24">
              <input {...common} required={undefined} type="checkbox" role="switch" checked={!!value} onChange={(ev) => onChange(ev.target.checked)} />
              <span className="fl-ctl-switch-track">
                <span className="fl-ctl-switch-thumb" />
              </span>
            </span>
            <span className="fl-wz-label">{f.label}</span>
          </label>
          {f.help ? (
            <p className="fl-wz-field-help" id={helpId}>
              {f.help}
            </p>
          ) : null}
        </div>
      );
    default:
      control = <input {...common} className={cls} type={f.type === "email" ? "email" : "text"} autoComplete="off" value={str} onChange={(ev) => onChange(ev.target.value)} />;
  }

  return (
    <div className={`fl-wz-field${f.type === "longtext" ? " fl-wz-field--wide" : ""}`}>
      <label className="fl-wz-label" htmlFor={id}>
        {f.label}
        {f.required ? (
          <span className="fl-wz-req" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="fl-wz-opt"> (optional)</span>
        )}
      </label>
      {control}
      {f.help ? (
        <p className="fl-wz-field-help" id={helpId}>
          {f.help}
        </p>
      ) : null}
      {error ? (
        <p className="fl-wz-error" id={errId}>
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The in-page confirm: modal, focus kept inside and returned to the opener, Escape closes. */
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-wz-first]")?.focus();
    return () => {
      // After a confirm the opener may be gone (the wizard left); only return focus when it is still on the page.
      const o = opener.current;
      if (o && o.isConnected) requestAnimationFrame(() => o.focus());
    };
  }, []);

  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      onClose();
      return;
    }
    if (ev.key !== "Tab") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
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
    <div className="fl-wz-backdrop" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="fl-wz-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={`${id}-b`} ref={ref} onKeyDown={onKey}>
        <h2 id={`${id}-t`} className="fl-wz-dialog-title">
          {title}
        </h2>
        <p id={`${id}-b`} className="fl-wz-dialog-body">
          {body}
        </p>
        <div className="fl-wz-dialog-actions">
          <Button variant="secondary" size={40} onClick={onClose} data-wz-first="">
            Keep editing
          </Button>
          <Button variant="destructive" size={40} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = { entity: "contract", submitTransition: "submit" };

export default function RecordWizardSheet() {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<null | { kind: "done"; id: string } | { kind: "cancel" }>(null);
  const againRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  useEffect(() => {
    if (result) againRef.current?.focus();
  }, [result]);
  const again = () => {
    setResult(null);
    setRun((n) => n + 1);
  };
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Record wizard</h3>
        <p className="fl-ctl-btn-what">A new contract in three steps and a review: try Next with nothing filled in, then save a draft and submit it for review.</p>
        {result ? (
          <div className="fl-wz-result" role="status">
            <p>
              {result.kind === "done" ? (
                <>
                  <Icon name="check" /> Contract <strong>{result.id}</strong> was created and sent for review.
                </>
              ) : (
                "The wizard was closed without submitting."
              )}
            </p>
            <Button variant="secondary" size={40} icon="plus" onClick={again} ref={againRef}>
              Start another
            </Button>
          </div>
        ) : (
          <RecordWizard
            key={run}
            store={sampleStore}
            entity={SAMPLE.entity}
            submitTransition={SAMPLE.submitTransition}
            onDone={(id) => setResult({ kind: "done", id })}
            onCancel={() => setResult({ kind: "cancel" })}
          />
        )}
      </div>
      <Toaster />
    </section>
  );
}
