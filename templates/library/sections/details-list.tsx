/**
 * Details list: one record (here a class booking) shown as label and value rows, each editable in place with Save
 * and Cancel, checked before saving. The reference has a copy button. Use it for a booking, order or account page
 * where people fix one detail at a time. Make it the app's own: replace SAMPLE's fields and rules; save each change
 * to your own store instead of page memory.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Booking details",
  badge: "Confirmed",
  reference: { label: "Reference", value: "BK-24-08812" },
  fields: [
    { key: "name", label: "Guest name", value: "Priya Nair", type: "text", rule: "required" },
    { key: "email", label: "Email", value: "priya.nair@example.com", type: "email", rule: "email" },
    { key: "phone", label: "Phone", value: "07700 900412", type: "tel", rule: "phone" },
    { key: "places", label: "Places", value: "2", type: "number", rule: "places" },
    { key: "notes", label: "Notes for the tutor", value: "Left-handed; first time on the wheel.", type: "textarea", rule: "optional" },
  ],
  fixed: [
    { label: "Class", value: "Wheel throwing for beginners" },
    { label: "When", value: "Thursday 14 November, 6–8pm" },
  ],
  messages: {
    required: "Enter a name.",
    email: "Enter an email like name@example.com.",
    phone: "Enter a phone number with at least 7 digits.",
    places: "Choose between 1 and 8 places.",
    saved: "saved.",
    copied: "Reference copied.",
    copyFailed: "Couldn't copy. Select the reference and copy it yourself.",
    notesEmpty: "None",
  },
};

type Field = (typeof SAMPLE.fields)[number];

function check(f: Field, v: string): string {
  const m = SAMPLE.messages;
  const t = v.trim();
  if (f.rule === "required" && !t) return m.required;
  if (f.rule === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return m.email;
  if (f.rule === "phone" && t.replace(/\D/g, "").length < 7) return m.phone;
  if (f.rule === "places") {
    const n = Number(t);
    if (!Number.isInteger(n) || n < 1 || n > 8) return m.places;
  }
  return "";
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 9h11v11H9zM5 15H4V4h11v1" />
  </svg>
);
const DoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export default function DetailsList() {
  const d = SAMPLE;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(d.fields.map((f) => [f.key, f.value])));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ text: "", bad: false });
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const editBtns = useRef<Record<string, HTMLButtonElement | null>>({});
  const returnTo = useRef<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (returnTo.current) {
      editBtns.current[returnTo.current]?.focus();
      returnTo.current = null;
    }
  }, [editing]);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  function start(f: Field) {
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
  function save(f: Field) {
    const msg = check(f, draft);
    if (msg) {
      setError(msg);
      inputRef.current?.focus();
      return;
    }
    setValues((v) => ({ ...v, [f.key]: draft.trim() }));
    setStatus({ text: `${f.label} ${d.messages.saved}`, bad: false });
    returnTo.current = f.key;
    setEditing(null);
  }
  async function copyRef() {
    window.clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(d.reference.value);
      setCopied("ok");
      setStatus({ text: d.messages.copied, bad: false });
    } catch {
      setCopied("fail");
      setStatus({ text: d.messages.copyFailed, bad: true });
    }
    copyTimer.current = window.setTimeout(() => setCopied(""), 2000);
  }

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="details-list-title">
      <div className="fl-wrap fl-wrap--narrow">
        <article className="fl-card fl-dsp-dl-card">
          <header className="fl-dsp-dl-head">
            <h3 id="details-list-title">{d.title}</h3>
            <span className="fl-badge">{d.badge}</span>
          </header>
          <dl className="fl-dsp-dl">
            <div className="fl-dsp-dl__row">
              <dt>{d.reference.label}</dt>
              <dd>
                <span className="fl-dsp-ref">{d.reference.value}</span>
                <span className="fl-dsp-dl__actions">
                <button type="button" className="fl-dsp-btn fl-dsp-btn--ghost" onClick={copyRef}>
                  {copied === "ok" ? <DoneIcon /> : <CopyIcon />}
                  {copied === "ok" ? "Copied" : "Copy"}
                  <span className="fl-sr"> reference</span>
                </button>
                </span>
              </dd>
            </div>
            {d.fixed.map((f) => (
              <div key={f.label} className="fl-dsp-dl__row">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            {d.fields.map((f) => {
              const isEditing = editing === f.key;
              const id = `details-${f.key}`;
              const errId = `${id}-error`;
              return (
                <div key={f.key} className={`fl-dsp-dl__row${isEditing ? " fl-dsp-dl__row--editing" : ""}`}>
                  <dt>{isEditing ? <label htmlFor={id}>{f.label}</label> : f.label}</dt>
                  <dd>
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
                          <textarea id={id} ref={inputRef} className="fl-input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!!error} aria-describedby={error ? errId : undefined} />
                        ) : (
                          <input
                            id={id}
                            ref={inputRef}
                            className="fl-input"
                            type={f.type}
                            min={f.type === "number" ? 1 : undefined}
                            max={f.type === "number" ? 8 : undefined}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            aria-invalid={!!error}
                            aria-describedby={error ? errId : undefined}
                          />
                        )}
                        {error && (
                          <p id={errId} className="fl-dsp-err">
                            {error}
                          </p>
                        )}
                        <div className="fl-dsp-dl__actions" style={{ justifyContent: "flex-start" }}>
                          <button type="submit" className="fl-dsp-btn fl-dsp-btn--primary">
                            Save
                          </button>
                          <button type="button" className="fl-dsp-btn" onClick={cancel}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : values[f.key] ? (
                      <span>{values[f.key]}</span>
                    ) : (
                      <span className="fl-meta">{d.messages.notesEmpty}</span>
                    )}
                    {!isEditing && (
                      <span className="fl-dsp-dl__actions">
                      <button
                        type="button"
                        className="fl-dsp-btn fl-dsp-btn--ghost"
                        ref={(el) => {
                          editBtns.current[f.key] = el;
                        }}
                        onClick={() => start(f)}
                        disabled={editing !== null}
                      >
                        Edit<span className="fl-sr"> {f.label.toLowerCase()}</span>
                      </button>
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="fl-dsp-status fl-dsp-dl-foot" role="status" aria-live="polite">
            {status.text && <span className={status.bad ? "fl-dsp-err" : "fl-dsp-ok"}>{status.text}</span>}
          </p>
        </article>
      </div>
    </section>
  );
}
