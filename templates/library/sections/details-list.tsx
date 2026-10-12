/** @flowcode-library details-list · Details list (Cards)
 * Catalog ID: p.editable-details (pattern)
 * Function: The editable details pattern (p.editable-details): one record as label and value rows with a status badge in the header, a copy button on the reference, and inline editing with Save, Cancel, checking and a live status line.
 * Use it as: import { EditableDetails } from "./details-list"; <EditableDetails title badge?={{ label, tone? }} reference?={{ label, value }} fixed?={[{ label, value }]} fields={[{ key, label, value, type?, rule?, min?, max?, error? }]} onSave?={(key, value) => ...} emptyValue? messages? />
 * Built from: c.list-row.fact, c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status
 * Look: A card with the title and a status badge on top, striped label and value rows, a Copy button beside the mono reference, an Edit button beside each editable value, and a quiet status line along the bottom.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text-muted --color-danger --color-success --font-mono --space-2 --space-4 --space-6 --text-sm
 * Use cases: booking details; order details; account details; profile details; record view; reservation summary; customer record
 * Jobs to be done: check the details of my booking; fix one wrong detail; copy my reference number; update my contact information
 * Keywords: description list, details, record, inline edit, copy, booking, order
 */
/**
 * Editable details: one record (here a class booking) shown as label and value rows, each editable in place. Edit swaps
 * the value for a labeled field with Save and Cancel; the entry is checked before it is kept, and focus returns to the
 * Edit button afterwards. The reference has a copy button that says whether it worked. A status line under the card
 * announces each save and copy. Use it for a booking, order or account page where people fix one detail at a time.
 * Make it the app's own: pass the real fields and rules, and save each change to your own store through onSave.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Badge, type BadgeTone } from "./badges-status";
import { ListRow } from "./lists-rows";
import { TextField } from "./text-fields-states";

// ── p.editable-details: fact rows with inline editing. Built from c.list-row, c.text-field, c.button and c.badge. ──

export type DetailRule = "required" | "email" | "phone" | "number" | "optional";

export type DetailField = {
  key: string;
  label: string;
  value: string;
  /** The input type; "textarea" gives a multi-line field. Text when left out. */
  type?: "text" | "email" | "tel" | "number" | "textarea";
  /** How the entry is checked before it is kept; optional (anything goes) when left out. */
  rule?: DetailRule;
  /** For rule "number": the smallest and largest whole number allowed. */
  min?: number;
  max?: number;
  /** The message shown when the check fails; a plain default per rule when left out. */
  error?: string;
};

export type DetailsMessages = {
  saved?: string;
  copied?: string;
  copyFailed?: string;
};

export type EditableDetailsProps = {
  title: string;
  /** The status in the header: its words and tone. */
  badge?: { label: string; tone?: BadgeTone };
  /** A value people copy, drawn in mono type with a Copy button. */
  reference?: { label: string; value: string };
  /** Rows that cannot be edited. */
  fixed?: { label: string; value: string }[];
  /** Rows with an Edit button. */
  fields: DetailField[];
  /** Called with a field's key and its new value after it passes the check. */
  onSave?: (key: string, value: string) => void;
  /** Shown for an editable field that has no value. */
  emptyValue?: string;
  messages?: DetailsMessages;
  className?: string;
};

const DEFAULT_ERROR: Record<DetailRule, string> = {
  required: "Enter a value.",
  email: "Enter an email like name@example.com.",
  phone: "Enter a phone number with at least 7 digits.",
  number: "Enter a whole number.",
  optional: "",
};

function check(f: DetailField, v: string): string {
  const t = v.trim();
  const bad = f.error ?? DEFAULT_ERROR[f.rule ?? "optional"];
  if (f.rule === "required" && !t) return bad;
  if (f.rule === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return bad;
  if (f.rule === "phone" && t.replace(/\D/g, "").length < 7) return bad;
  if (f.rule === "number") {
    const n = Number(t);
    if (!t || !Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) return bad;
  }
  return "";
}

export function EditableDetails({ title, badge, reference, fixed = [], fields, onSave, emptyValue = "None", messages, className }: EditableDetailsProps) {
  const uid = useId();
  const say = { saved: "saved.", copied: "Reference copied.", copyFailed: "Couldn't copy. Select the reference and copy it yourself.", ...messages };
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.value])));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ text: "", bad: false });
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const returnTo = useRef<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const fieldId = (key: string) => `${uid}-field-${key}`;
  const editId = (key: string) => `${uid}-edit-${key}`;

  // Focus goes into the field when editing starts, and back to that row's Edit button when it ends.
  useEffect(() => {
    if (editing) document.getElementById(fieldId(editing))?.focus();
    else if (returnTo.current) {
      document.getElementById(editId(returnTo.current))?.focus();
      returnTo.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  function start(f: DetailField) {
    setEditing(f.key);
    setDraft(values[f.key]);
    setError("");
    setStatus({ text: "", bad: false });
  }
  function cancel() {
    returnTo.current = editing;
    setEditing(null);
    setError("");
  }
  function save(f: DetailField) {
    const msg = check(f, draft);
    if (msg) {
      setError(msg);
      document.getElementById(fieldId(f.key))?.focus();
      return;
    }
    setValues((v) => ({ ...v, [f.key]: draft.trim() }));
    onSave?.(f.key, draft.trim());
    setStatus({ text: `${f.label} ${say.saved}`, bad: false });
    returnTo.current = f.key;
    setEditing(null);
  }
  async function copyRef() {
    if (!reference) return;
    window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(reference.value);
      setCopied("ok");
      setStatus({ text: say.copied, bad: false });
    } catch {
      setCopied("fail");
      setStatus({ text: say.copyFailed, bad: true });
    }
    copyTimer.current = window.setTimeout(() => setCopied(""), 2000);
  }

  return (
    <article className={["fl-card", "fl-dsp-dl-card", className ?? ""].filter(Boolean).join(" ")} data-fl="p.editable-details" aria-labelledby={`${uid}-title`}>
      <header className="fl-dsp-dl-head">
        <h3 id={`${uid}-title`}>{title}</h3>
        {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
      </header>
      <dl className="fl-dsp-dl">
        {reference ? (
          <ListRow
            variant="fact"
            className="fl-dsp-dl__row"
            title={reference.label}
            actions={
              <span className="fl-dsp-dl__actions">
                <Button variant="tertiary" size={32} icon={copied === "ok" ? "check" : "copy"} onClick={copyRef}>
                  {copied === "ok" ? "Copied" : "Copy"}
                  <span className="fl-sr"> reference</span>
                </Button>
              </span>
            }
          >
            <span className="fl-dsp-ref">{reference.value}</span>
          </ListRow>
        ) : null}
        {fixed.map((f) => (
          <ListRow key={f.label} variant="fact" className="fl-dsp-dl__row" title={f.label}>
            {f.value}
          </ListRow>
        ))}
        {fields.map((f) => {
          const isEditing = editing === f.key;
          const errId = `${fieldId(f.key)}-error`;
          const shared = {
            id: fieldId(f.key),
            value: draft,
            invalid: !!error,
            "aria-describedby": error ? errId : undefined,
            onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
          };
          return (
            <ListRow
              key={f.key}
              variant="fact"
              className={`fl-dsp-dl__row${isEditing ? " fl-dsp-dl__row--editing" : ""}`}
              title={isEditing ? <label htmlFor={fieldId(f.key)}>{f.label}</label> : f.label}
              actions={
                isEditing ? undefined : (
                  <span className="fl-dsp-dl__actions">
                    <Button variant="tertiary" size={32} id={editId(f.key)} disabled={editing !== null} onClick={() => start(f)}>
                      Edit<span className="fl-sr"> {f.label.toLowerCase()}</span>
                    </Button>
                  </span>
                )
              }
            >
              {isEditing ? (
                <form
                  className="fl-dsp-dl__edit"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(f);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancel();
                  }}
                >
                  {f.type === "textarea" ? (
                    <TextField {...shared} multiline rows={3} />
                  ) : (
                    <TextField {...shared} type={f.type ?? "text"} min={f.type === "number" ? f.min : undefined} max={f.type === "number" ? f.max : undefined} />
                  )}
                  {error && (
                    <p id={errId} className="fl-dsp-err">
                      {error}
                    </p>
                  )}
                  <div className="fl-dsp-dl__actions" style={{ justifyContent: "flex-start" }}>
                    <Button variant="primary" size={32} type="submit">
                      Save
                    </Button>
                    <Button variant="secondary" size={32} onClick={cancel}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : values[f.key] ? (
                <span>{values[f.key]}</span>
              ) : (
                <span className="fl-meta">{emptyValue}</span>
              )}
            </ListRow>
          );
        })}
      </dl>
      <p className="fl-dsp-status fl-dsp-dl-foot" role="status" aria-live="polite">
        {status.text && <span className={status.bad ? "fl-dsp-err" : "fl-dsp-ok"}>{status.text}</span>}
      </p>
    </article>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Booking details",
  badge: { label: "Confirmed", tone: "success" as const },
  reference: { label: "Reference", value: "BK-24-08812" },
  fixed: [
    { label: "Class", value: "Wheel throwing for beginners" },
    { label: "When", value: "Thursday 14 November, 6–8pm" },
  ],
  fields: [
    { key: "name", label: "Guest name", value: "Priya Nair", type: "text" as const, rule: "required" as const, error: "Enter a name." },
    { key: "email", label: "Email", value: "priya.nair@example.com", type: "email" as const, rule: "email" as const },
    { key: "phone", label: "Phone", value: "07700 900412", type: "tel" as const, rule: "phone" as const },
    { key: "places", label: "Places", value: "2", type: "number" as const, rule: "number" as const, min: 1, max: 8, error: "Choose between 1 and 8 places." },
    { key: "notes", label: "Notes for the tutor", value: "Left-handed; first time on the wheel.", type: "textarea" as const, rule: "optional" as const },
  ],
  emptyValue: "None",
};

export default function DetailsList() {
  return (
    <section className="fl-section fl-section--tint">
      <div className="fl-wrap fl-wrap--narrow">
        <EditableDetails {...SAMPLE} />
      </div>
    </section>
  );
}
