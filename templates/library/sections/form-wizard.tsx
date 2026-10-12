/** @flowcode-library form-wizard · Multi-step form (Forms)
 * Catalog ID: p.form-wizard (pattern)
 * Function: The multi-step form (p.form-wizard): steps of data-driven fields, per-step validation, a review step with edit links and a confirm, built on the numbered stepper.
 * Use it as: import { FormWizard } from "./form-wizard"; <FormWizard title eyebrow? lede? steps={[{ id, label, what, fields: [{ id, type: "text"|"email"|"number"|"select"|"radio"|"checks"|"textarea", label, reviewLabel?, required?: "message", invalid?, hint?, min?, max?, initial?, half?, placeholder?, options? }] }]} review={{ label, what, text }} confirm="Confirm booking" success={{ title, text: "... {email}", action }} onSubmit?={(values) => ...} />
 * Built from: p.stepper.numbered, c.text-field.outlined, c.select.outlined, c.radio, c.checkbox, c.button.primary, c.button.secondary, c.card.surface
 * Look: A wide card with a numbered step indicator on top, one step of fields at a time, a review list with an Edit link per answer, and Back and Next buttons; finished steps in the indicator can be pressed to go back.
 * Tokens: --color-accent --color-border --color-danger --color-success --color-surface --color-text-muted --space-4 --space-5 --space-6 --space-7 --radius-md --radius-lg --focus-ring
 * Use cases: onboarding flow; checkout steps; booking flow; application form; setup wizard; registration steps; quote request; survey
 * Jobs to be done: complete a long form step by step; review my answers before submitting; set up my account; apply without getting lost
 * Keywords: form, wizard, steps, multi-step, review
 */
/**
 * Form: three-step wizard. Details, then preferences, then a review of everything with an edit link per answer and a
 * final confirm. A step indicator shows where you are; Next checks only the current step and Back keeps what you
 * typed. The booking is kept in memory; nothing is sent. Use it when one long form would put people off: a booking,
 * an order, an onboarding. Make it the app's own: replace SAMPLE's steps, fields and choices, and keep three to five
 * steps.
 */
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Checkbox, Radio } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Stepper } from "./steppers-wizards";
import { TextField } from "./text-fields-states";

// ── p.form-wizard: a long form in steps (fields as data), then a review with an edit link per answer and a confirm. ──

type WizardBase = {
  id: string;
  label: string;
  /** The word used for this answer on the review screen; the label when left out. */
  reviewLabel?: string;
  /** Said when the step is checked and this is empty. Leave out for an optional answer. */
  required?: string;
};
export type WizardField =
  | (WizardBase & {
      type: "text" | "email" | "number";
      autoComplete?: string;
      hint?: string;
      /** Number: lowest and highest allowed. */
      min?: number;
      max?: number;
      /** Email and number: said when the answer is not an address or is out of range. */
      invalid?: string;
      initial?: string;
      /** Sit side by side with the next half-width field. */
      half?: boolean;
    })
  | (WizardBase & { type: "select"; placeholder?: string; options: { value: string; label: string }[] })
  | (WizardBase & { type: "radio"; options: { value: string; label: string; hint?: string }[] })
  | (WizardBase & { type: "checks"; options: { value: string; label: string }[] })
  | (WizardBase & { type: "textarea" });

export type WizardStepData = {
  id: string;
  /** Shown in the step indicator and as the step's heading. */
  label: string;
  /** A few words under the label in the step indicator. */
  what: string;
  fields: WizardField[];
};

export type FormWizardProps = {
  eyebrow?: string;
  title: string;
  lede?: string;
  steps: WizardStepData[];
  /** The last step: the review of every answer. */
  review: { label: string; what: string; text: string };
  /** The final button ("Confirm booking"). */
  confirm: string;
  /** The panel that replaces the form. {id} in the text is replaced by that answer, in bold. */
  success: { title: string; text: string; action: string };
  /** Called with all the answers when the booking is confirmed. */
  onSubmit?: (values: Record<string, string | string[]>) => void;
  className?: string;
};

type Values = Record<string, string | string[]>;

function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="fl-frm-error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      {children}
    </p>
  );
}

export function FormWizard({ eyebrow, title, lede, steps, review, confirm, success, onSubmit, className }: FormWizardProps) {
  const uid = useId();
  const fid = (id: string) => `${uid}-${id}`;
  const empty = (): Values => Object.fromEntries(steps.flatMap((s) => s.fields).map((f) => [f.id, f.type === "checks" ? [] : "initial" in f && f.initial ? f.initial : ""]));
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const last = steps.length; // the review

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, done]);

  const str = (id: string) => String(data[id] ?? "");
  const set = (id: string, v: string | string[]) => {
    setData((s) => ({ ...s, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: undefined }));
  };

  const check = (at: number): Record<string, string> => {
    const e: Record<string, string> = {};
    for (const f of steps[at].fields) {
      const v = data[f.id];
      const text = Array.isArray(v) ? v.join("") : v;
      if (f.type === "number") {
        const n = Number(text);
        if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) e[f.id] = f.invalid ?? f.required ?? "";
      } else if (f.required && !text.trim()) e[f.id] = f.required;
      else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) e[f.id] = f.invalid ?? f.required ?? "";
      if (!e[f.id]) delete e[f.id];
    }
    return e;
  };

  const next = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === last) {
      onSubmit?.(data);
      setDone(true);
      return;
    }
    const found = check(step);
    setErrors(found);
    const bad = Object.keys(found)[0];
    if (bad) {
      const el = document.getElementById(fid(bad)) ?? document.querySelector<HTMLElement>(`[name="${fid(bad)}"]`);
      el?.focus();
      return;
    }
    setStep((s) => s + 1);
  };
  const goBack = (to: number) => {
    setErrors({});
    setStep(Math.max(0, to));
  };
  const restart = () => {
    setData(empty());
    setErrors({});
    setStep(0);
    setDone(false);
  };

  const fields = steps.flatMap((s, i) => s.fields.map((f) => ({ f, step: i })));
  const shown = (f: WizardField): string => {
    const v = data[f.id];
    if (f.type === "checks") return f.options.filter((o) => (v as string[]).includes(o.value)).map((o) => o.label).join(", ") || "None";
    if (f.type === "select" || f.type === "radio") return f.options.find((o) => o.value === v)?.label ?? "";
    if (f.type === "textarea") return String(v).trim() || "None";
    return String(v);
  };
  const display = Object.fromEntries(fields.map(({ f }) => [f.id, shown(f)]));
  const fill = (text: string): ReactNode[] =>
    text.split(/\{(\w+)\}/).map((part, i) =>
      i % 2 ? (
        <strong key={i} style={{ color: "var(--color-text)" }}>
          {display[part] ?? ""}
        </strong>
      ) : (
        part
      ),
    );
  const errCount = Object.values(errors).filter(Boolean).length;
  const indicator = [...steps.map((s) => ({ id: s.id, label: s.label, what: s.what })), { id: "review", label: review.label, what: review.what }];

  const render = (f: WizardField): ReactNode => {
    const err = errors[f.id];
    const errId = `${fid(f.id)}-error`;
    if (f.type === "radio") {
      return (
        <fieldset key={f.id} className="fl-frm-choices" aria-describedby={err ? errId : undefined}>
          <legend>{f.label}</legend>
          {f.options.map((x, i) => (
            <label key={x.value} className="fl-frm-option">
              <Radio id={i === 0 ? fid(f.id) : undefined} name={fid(f.id)} value={x.value} checked={data[f.id] === x.value} onChange={() => set(f.id, x.value)} aria-invalid={err ? true : undefined} />
              <span>
                <strong>{x.label}</strong>
                {x.hint ? <span>{x.hint}</span> : null}
              </span>
            </label>
          ))}
          <ErrorText id={errId}>{err}</ErrorText>
        </fieldset>
      );
    }
    if (f.type === "checks") {
      const picked = data[f.id] as string[];
      return (
        <fieldset key={f.id} className="fl-frm-choices">
          <legend>
            {f.label}
            {!f.required ? (
              <>
                {" "}
                <span className="fl-meta">(optional)</span>
              </>
            ) : null}
          </legend>
          {f.options.map((x) => (
            <label key={x.value} className="fl-frm-check">
              <Checkbox checked={picked.includes(x.value)} onChange={(e) => set(f.id, e.target.checked ? [...picked, x.value] : picked.filter((v) => v !== x.value))} />
              <span>{x.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    return (
      <div className="fl-field" key={f.id}>
        <label htmlFor={fid(f.id)}>
          {f.label}
          {f.type === "textarea" && !f.required ? (
            <>
              {" "}
              <span className="fl-meta">(optional)</span>
            </>
          ) : null}
        </label>
        {f.type === "select" ? (
          <Select id={fid(f.id)} options={f.options} placeholder={f.placeholder} value={str(f.id)} onChange={(e) => set(f.id, e.target.value)} invalid={!!err} aria-describedby={err ? errId : undefined} />
        ) : f.type === "textarea" ? (
          <TextField multiline id={fid(f.id)} style={{ minHeight: "5rem" }} value={str(f.id)} onChange={(e) => set(f.id, e.target.value)} />
        ) : (
          <TextField
            id={fid(f.id)}
            type={f.type}
            inputMode={f.type === "number" ? "numeric" : undefined}
            min={f.min}
            max={f.max}
            autoComplete={f.autoComplete}
            value={str(f.id)}
            onChange={(e) => set(f.id, e.target.value)}
            invalid={!!err}
            aria-describedby={err ? errId : f.hint ? `${fid(f.id)}-hint` : undefined}
          />
        )}
        {err ? (
          <ErrorText id={errId}>{err}</ErrorText>
        ) : "hint" in f && f.hint ? (
          <p id={`${fid(f.id)}-hint`} className="fl-frm-hint">
            {f.hint}
          </p>
        ) : null}
      </div>
    );
  };

  // Consecutive half-width fields share a row.
  const rows = (list: WizardField[]): ReactNode[] => {
    const out: ReactNode[] = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (a.type !== "radio" && "half" in a && a.half && b && "half" in b && b.half) {
        out.push(
          <div key={a.id} className="fl-grid fl-grid--2" style={{ gap: "var(--space-4)" }}>
            {render(a)}
            {render(b)}
          </div>,
        );
        i++;
      } else out.push(render(a));
    }
    return out;
  };

  return (
    <section className={["fl-section fl-section--tint", className ?? ""].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`} data-fl="p.form-wizard">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${uid}-title`} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>

        <Card variant="surface" className="fl-frm-card fl-frm-card--wide" style={{ padding: "var(--space-7)" }}>
          {done ? (
            <div className="fl-frm-success" role="status">
              <span className="fl-icon">
                <Icon name="check" />
              </span>
              <h3 ref={headingRef} tabIndex={-1}>
                {success.title}
              </h3>
              <p className="fl-text">{fill(success.text)}</p>
              <Button variant="secondary" onClick={restart}>
                {success.action}
              </Button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "var(--space-6)" }}>
                <Stepper steps={indicator} current={step} onStep={(n) => n < step && goBack(n)} />
              </div>

              <form className="fl-form" onSubmit={next} noValidate style={{ gap: "var(--space-5)" }}>
                <div className="fl-frm-pane">
                  <h3 ref={headingRef} tabIndex={-1}>
                    <span className="fl-sr">
                      Step {step + 1} of {indicator.length}:{" "}
                    </span>
                    {indicator[step].label}
                  </h3>
                  {errCount > 0 && (
                    <p className="fl-frm-summary" role="alert">
                      {errCount === 1 ? "One answer needs a look before you continue." : `${errCount} answers need a look before you continue.`}
                    </p>
                  )}

                  {step < last ? (
                    rows(steps[step].fields).map((row, i) => <Fragment key={i}>{row}</Fragment>)
                  ) : (
                    <>
                      <p className="fl-text">{review.text}</p>
                      <dl className="fl-frm-review">
                        {fields.map(({ f, step: at }) => (
                          <div key={f.id}>
                            <dt>{f.reviewLabel ?? f.label}</dt>
                            <dd>{display[f.id]}</dd>
                            <button type="button" className="fl-frm-edit" onClick={() => goBack(at)}>
                              Edit<span className="fl-sr"> {(f.reviewLabel ?? f.label).toLowerCase()}</span>
                            </button>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>

                <div className="fl-frm-nav">
                  {step > 0 && (
                    <Button variant="secondary" onClick={() => goBack(step - 1)}>
                      Back
                    </Button>
                  )}
                  <Button type="submit">{step === last ? confirm : `Next: ${indicator[step + 1].label}`}</Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FormWizardProps = {
  eyebrow: "Book a workshop",
  title: "Weekend pottery workshop",
  lede: "Three quick steps. We hold your place while you finish.",
  steps: [
    {
      id: "details",
      label: "Your details",
      what: "Name and contact",
      fields: [
        { id: "name", type: "text", label: "Full name", reviewLabel: "Name", autoComplete: "name", required: "Add the name the booking is under." },
        {
          id: "email",
          type: "email",
          label: "Email",
          autoComplete: "email",
          half: true,
          required: "Enter a full email address so we can confirm.",
          invalid: "Enter a full email address so we can confirm.",
        },
        { id: "guests", type: "number", label: "People", hint: "Up to 6", min: 1, max: 6, initial: "1", half: true, invalid: "Between 1 and 6 people per booking." },
      ],
    },
    {
      id: "preferences",
      label: "Preferences",
      what: "Date and experience",
      fields: [
        {
          id: "date",
          type: "select",
          label: "Date",
          placeholder: "Choose a date",
          required: "Pick a date that suits you.",
          options: [
            { value: "sat-14", label: "Saturday 14 June, 10:00 – 13:00" },
            { value: "sun-15", label: "Sunday 15 June, 14:00 – 17:00" },
            { value: "sat-21", label: "Saturday 21 June, 10:00 – 13:00" },
          ],
        },
        {
          id: "level",
          type: "radio",
          label: "Your experience",
          reviewLabel: "Experience",
          required: "Choose your experience so we can plan the session.",
          options: [
            { value: "new", label: "New to clay", hint: "We start with hand-building and center the wheel together." },
            { value: "some", label: "Done a class or two", hint: "Straight onto the wheel with a little guidance." },
            { value: "regular", label: "Regular potter", hint: "Bring a project; the teacher helps where you need it." },
          ],
        },
        {
          id: "extras",
          type: "checks",
          label: "Extras",
          options: [
            { value: "glaze", label: "Glazing session (+$15)" },
            { value: "apron", label: "Borrow an apron (free)" },
          ],
        },
        { id: "notes", type: "textarea", label: "Anything we should know?", reviewLabel: "Notes" },
      ],
    },
  ],
  review: { label: "Review", what: "Check and confirm", text: "Check the details below. You can change anything before you confirm." },
  confirm: "Confirm booking",
  success: { title: "Your place is booked", text: "{date}, for {guests} in total. A confirmation is on its way to {email}.", action: "Book another" },
};

export default function FormWizardPreview() {
  return <FormWizard {...SAMPLE} />;
}
