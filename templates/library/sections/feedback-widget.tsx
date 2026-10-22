/** @flowcode-library feedback-widget · Feedback widget (Forms)
 * Catalog ID: p.feedback-widget (pattern)
 * Function: Feedback widget (p.feedback-widget): a Feedback button that opens a small panel to rate the experience on five faces, pick what kind of note it is (Idea, Problem, Praise), write a message with a live character count, attach a screenshot of the screen (a stand-in capture with Remove), and choose whether the team may reply; it checks there's a rating or a message (and a real description for a problem), sends with a busy state, shows a thank-you with Send another, keeps a send error with the note intact, keeps the draft when closed (the button shows a dot), and Discard asks first; Escape closes and focus returns to the button.
 * Use it as: import { FeedbackWidget } from "./feedback-widget"; <FeedbackWidget title? categories?={[{ value, label }]} email?="jamie@example.com" maxLength?={500} capture?={async () => { label, src? }} send={async ({ rating, category, message, screenshot, contact }) => void} labels? />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.button.destructive, c.text-field.outlined, c.checkbox
 * Look: A pill Feedback button with a chat icon (and an accent dot while a draft waits); the panel is a white card (22rem) that rises above it: a title and close, five round outline faces from frowning to smiling (the chosen one fills with accent and pops), a three-way switch with a sliding thumb, a text box with a count, a dashed Add screenshot tile that becomes a small page thumbnail, a checkbox, and Send; after sending, a green tick that pops above a short thanks.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-hover --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: feedback widget; in-app feedback; bug report button; product feedback; satisfaction rating; feature request; beta feedback
 * Jobs to be done: tell the team something is broken without leaving the page; suggest an idea while it's fresh; rate how a feature feels; show the team what I'm looking at
 * Keywords: feedback, rating, bug report, feature request, screenshot, satisfaction, survey, CSAT, popover, form
 */
/**
 * Feedback widget: a button and a non-modal panel. The faces are a native radio group (arrow keys); the kind of note
 * is a radio group with a sliding thumb. Opening focuses the first face; Escape or the close button closes and focus
 * returns to the button; the draft stays until it's sent or discarded (Discard asks first). Validation runs on Send:
 * the first problem is focused and announced. capture() stands in for taking a screenshot (by default it draws a
 * labeled thumbnail of the page); send() gets everything. The panel rises in, the thumb slides, the chosen face and
 * the done tick pop, the counter turns amber near the limit, the screenshot tile swaps in; with motion off it all
 * simply changes.
 * Adapted from Meraki UI (MIT, Copyright (c) 2021 Khatab Wedaa): its contact and modal form components, and HyperUI
 * (MIT, Copyright (c) Mark Mead): its textarea, radio group and toast components.
 */
/**
 * How to try it
 * - Press Feedback: the panel rises with focus on the faces. Press Send: it asks for a rating or a message.
 * - Use the arrow keys on the faces, choose Problem, type "Bad" and Send: it asks for a little more.
 * - Write a longer note, press Add screenshot (it takes a moment), then Remove and add it again.
 * - Press Escape: the panel closes, the button shows a dot, and opening again keeps your note. Discard asks first.
 * - In this preview, a message containing "offline" fails to send: the note stays and Send tries again.
 * - Send a normal note: the tick pops; Send another starts fresh.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button, TextField and
 * Checkbox ("./buttons-variants", "./text-fields-states", "./checkboxes-radios") and its inline icon set ("./icons").
 * Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r6b-feedback-widget.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── p.feedback-widget: rate, categorize, describe, attach and send feedback from anywhere in an app. ──

export type FeedbackShot = { label: string; src?: string };
export type FeedbackData = { rating: number | null; category: string; message: string; screenshot: FeedbackShot | null; contact: boolean };

export type FeedbackWidgetLabels = Partial<{
  button: string;
  draft: string;
  rate: string;
  faces: string[];
  kind: string;
  message: string;
  placeholder: string;
  count: string;
  addShot: string;
  capturing: string;
  removeShot: string;
  shotFailed: string;
  contact: string;
  contactNoEmail: string;
  send: string;
  sending: string;
  close: string;
  discard: string;
  discardAsk: string;
  keep: string;
  discarded: string;
  needSomething: string;
  needDetail: string;
  tooLong: string;
  failed: string;
  thanks: string;
  thanksText: string;
  another: string;
}>;

export type FeedbackWidgetProps = {
  title?: string;
  categories?: { value: string; label: string }[];
  /** Shown beside "You can reply"; the box is hidden when left out and contact is false. */
  email?: string;
  maxLength?: number;
  /** Takes the screenshot; a labeled stand-in when left out. A rejection says it couldn't. */
  capture?: () => Promise<FeedbackShot>;
  send: (data: FeedbackData) => Promise<void>;
  labels?: FeedbackWidgetLabels;
};

const EMPTY = (cat: string) => ({ rating: null as number | null, category: cat, message: "", screenshot: null as FeedbackShot | null, contact: true });

function Face({ level }: { level: number }) {
  // level 0..4: the mouth goes from a frown to a smile.
  const curve = (level - 2) * 2.2;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="fl-fdbk-face-svg">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10" r="1.1" className="fl-fdbk-eye" />
      <circle cx="15" cy="10" r="1.1" className="fl-fdbk-eye" />
      <path d={`M8 ${15.5 - curve / 3} Q12 ${15.5 + curve} 16 ${15.5 - curve / 3}`} />
    </svg>
  );
}

export function FeedbackWidget({ title = "Send feedback", categories = [
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "praise", label: "Praise" },
], email, maxLength = 500, capture, send, labels = {} }: FeedbackWidgetProps) {
  const l = {
    button: "Feedback",
    draft: "draft saved",
    rate: "How's it going?",
    faces: ["Very bad", "Bad", "Okay", "Good", "Great"],
    kind: "What's it about?",
    message: "Your note",
    placeholder: "What should we know?",
    count: "{n} of {max}",
    addShot: "Add screenshot",
    capturing: "Capturing…",
    removeShot: "Remove screenshot",
    shotFailed: "Couldn't take a screenshot.",
    contact: "You can reply to {email}",
    contactNoEmail: "You can reply to me",
    send: "Send",
    sending: "Sending…",
    close: "Close",
    discard: "Discard",
    discardAsk: "Discard this note?",
    keep: "Keep",
    discarded: "Note discarded.",
    needSomething: "Pick a face or write a note.",
    needDetail: "Tell us a bit more about the problem (at least 10 characters).",
    tooLong: "Keep it under {max} characters.",
    failed: "Couldn't send. Your note is still here; try again.",
    thanks: "Thanks for the note",
    thanksText: "We read every one. If you said we can reply, watch your inbox.",
    another: "Send another",
    ...labels,
  };
  const id = useId();
  const first = categories[0]?.value ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY(first));
  const [error, setError] = useState<{ field: "rating" | "message" | "send"; text: string } | null>(null);
  const [phase, setPhase] = useState<"edit" | "sending" | "sent">("edit");
  const [shooting, setShooting] = useState(false);
  const [shotErr, setShotErr] = useState(false);
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState("");
  const [ind, setInd] = useState({ x: 0, w: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const seg = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms = 0) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const dirty = form.rating !== null || form.message.trim() !== "" || form.screenshot !== null;

  const focusFirst = () => {
    const box = wrap.current;
    if (!box) return;
    const target = phase === "sent" ? box.querySelector<HTMLElement>(`#${CSS.escape(`${id}-thanks`)}`) : box.querySelector<HTMLElement>('.fl-fdbk-faces input:checked') ?? box.querySelector<HTMLElement>(".fl-fdbk-faces input");
    target?.focus();
  };
  useEffect(() => {
    if (!open) return;
    later(focusFirst, 20);
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = seg.current?.querySelector<HTMLElement>("label:has(input:checked)");
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [form.category, open, phase]);

  const close = () => {
    setOpen(false);
    setAsking(false);
    later(() => trigger.current?.focus());
  };
  const update = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (error && error.field !== "send") setError(null);
  };

  const takeShot = () => {
    setShooting(true);
    setShotErr(false);
    const run =
      capture ??
      (() =>
        new Promise<FeedbackShot>((r) =>
          window.setTimeout(() => r({ label: `Screenshot of ${document.title || "this page"}, ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` }), 600),
        ));
    run()
      .then((shot) => {
        update({ screenshot: shot });
        setSaid(shot.label);
        later(() => document.getElementById(`${id}-shot-remove`)?.focus(), 30);
      })
      .catch(() => {
        setShotErr(true);
        setSaid(l.shotFailed);
      })
      .finally(() => setShooting(false));
  };

  const submit = () => {
    if (phase === "sending") return;
    const msg = form.message.trim();
    let problem: typeof error = null;
    if (form.rating === null && !msg) problem = { field: "rating", text: l.needSomething };
    else if (form.category === "problem" && msg.length < 10) problem = { field: "message", text: l.needDetail };
    else if (msg.length > maxLength) problem = { field: "message", text: l.tooLong.replace("{max}", String(maxLength)) };
    if (problem) {
      setError(problem);
      setSaid(problem.text);
      later(() => (problem!.field === "rating" ? wrap.current?.querySelector<HTMLElement>(".fl-fdbk-faces input") : document.getElementById(`${id}-msg`))?.focus(), 20);
      return;
    }
    setError(null);
    setPhase("sending");
    send({ ...form, message: msg })
      .then(() => {
        setPhase("sent");
        setForm(EMPTY(first));
        setSaid(l.thanks);
        later(() => document.getElementById(`${id}-thanks`)?.focus(), 30);
      })
      .catch(() => {
        setPhase("edit");
        setError({ field: "send", text: l.failed });
        setSaid(l.failed);
        later(() => document.getElementById(`${id}-send`)?.focus(), 30);
      });
  };

  const discard = () => {
    setForm(EMPTY(first));
    setError(null);
    setAsking(false);
    setShotErr(false);
    setSaid(l.discarded);
    later(() => wrap.current?.querySelector<HTMLElement>(".fl-fdbk-faces input")?.focus(), 30);
  };

  const len = form.message.length;
  const busy = phase === "sending";

  return (
    <div className="fl-fdbk" ref={wrap} data-fl="p.feedback-widget" onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), close())}>
      {open ? (
        <div className="fl-fdbk-panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
          <header className="fl-fdbk-head">
            <h2 id={`${id}-title`}>{title}</h2>
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={close}>
              {l.close}
            </Button>
          </header>

          {phase === "sent" ? (
            <div className="fl-fdbk-done">
              <span className="fl-fdbk-tick" aria-hidden="true">
                <Icon name="check" />
              </span>
              <p id={`${id}-thanks`} className="fl-fdbk-done-title" tabIndex={-1}>
                {l.thanks}
              </p>
              <p>{l.thanksText}</p>
              <div className="fl-fdbk-row">
                <Button variant="secondary" size={32} onClick={close}>
                  {l.close}
                </Button>
                <Button
                  size={32}
                  icon="plus"
                  onClick={() => {
                    setPhase("edit");
                    later(() => wrap.current?.querySelector<HTMLElement>(".fl-fdbk-faces input")?.focus(), 30);
                  }}
                >
                  {l.another}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="fl-fdbk-form"
              noValidate
              aria-busy={busy || undefined}
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <fieldset className="fl-fdbk-set" disabled={busy}>
                <legend>{l.rate}</legend>
                <div className="fl-fdbk-faces" role="radiogroup" aria-label={l.rate} aria-describedby={error?.field === "rating" ? `${id}-err` : undefined}>
                  {l.faces.slice(0, 5).map((name, i) => (
                    <label key={name} className="fl-fdbk-face" title={name}>
                      <input type="radio" name={`${id}-rating`} value={i + 1} checked={form.rating === i + 1} aria-label={name} onChange={() => update({ rating: i + 1 })} />
                      <Face level={i} />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="fl-fdbk-set" disabled={busy}>
                <legend>{l.kind}</legend>
                <div className="fl-fdbk-seg" ref={seg} style={{ ["--ind-x" as string]: `${ind.x}px`, ["--ind-w" as string]: `${ind.w}px` }}>
                  <i aria-hidden="true" />
                  {categories.map((c) => (
                    <label key={c.value}>
                      <input type="radio" name={`${id}-cat`} value={c.value} checked={form.category === c.value} onChange={() => update({ category: c.value })} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="fl-fdbk-field">
                <label htmlFor={`${id}-msg`}>{l.message}</label>
                <TextField
                  multiline
                  autoGrow
                  id={`${id}-msg`}
                  rows={3}
                  placeholder={l.placeholder}
                  value={form.message}
                  disabled={busy}
                  invalid={error?.field === "message"}
                  aria-describedby={[`${id}-count`, error?.field === "message" ? `${id}-err` : ""].filter(Boolean).join(" ")}
                  onChange={(e) => update({ message: e.currentTarget.value })}
                />
                <span id={`${id}-count`} className={["fl-fdbk-count", len > maxLength ? "is-over" : len > maxLength * 0.9 ? "is-near" : ""].filter(Boolean).join(" ")}>
                  {l.count.replace("{n}", String(len)).replace("{max}", String(maxLength))}
                </span>
              </div>

              {form.screenshot ? (
                <div className="fl-fdbk-shot" key="shot">
                  {form.screenshot.src ? (
                    <img src={form.screenshot.src} alt={form.screenshot.label} />
                  ) : (
                    <span className="fl-fdbk-thumb" role="img" aria-label={form.screenshot.label}>
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  <span className="fl-fdbk-shot-name">{form.screenshot.label}</span>
                  <Button id={`${id}-shot-remove`} variant="tertiary" size={32} icon="trash" iconOnly disabled={busy} onClick={() => {
                      update({ screenshot: null });
                      later(() => document.getElementById(`${id}-shot-add`)?.focus(), 30);
                    }}>
                    {l.removeShot}
                  </Button>
                </div>
              ) : (
                <button id={`${id}-shot-add`} type="button" className="fl-fdbk-addshot" disabled={busy || shooting} aria-busy={shooting || undefined} onClick={takeShot}>
                  {shooting ? <span className="fl-ctl-spinner" aria-hidden="true" /> : <Icon name="image" />}
                  {shooting ? l.capturing : l.addShot}
                </button>
              )}
              {shotErr ? <p className="fl-fdbk-error">{l.shotFailed}</p> : null}

              <Checkbox label={email ? l.contact.replace("{email}", email) : l.contactNoEmail} checked={form.contact} disabled={busy} onChange={(e) => update({ contact: e.currentTarget.checked })} />

              {error ? (
                <p id={`${id}-err`} className="fl-fdbk-error" role="alert">
                  <Icon name="alert" />
                  {error.text}
                </p>
              ) : null}

              <div className={["fl-fdbk-ask", asking ? "is-open" : ""].filter(Boolean).join(" ")} inert={!asking || undefined}>
                <div>
                  <p>{l.discardAsk}</p>
                  <Button id={`${id}-keep`} variant="secondary" size={32} onClick={() => {
                      setAsking(false);
                      later(() => document.getElementById(`${id}-discard`)?.focus(), 30);
                    }}>
                    {l.keep}
                  </Button>
                  <Button variant="destructive" size={32} icon="trash" onClick={discard}>
                    {l.discard}
                  </Button>
                </div>
              </div>

              <div className="fl-fdbk-row">
                {dirty && !asking ? (
                  <Button id={`${id}-discard`} variant="tertiary" size={32} disabled={busy} onClick={() => {
                      setAsking(true);
                      later(() => document.getElementById(`${id}-keep`)?.focus(), 30);
                    }}>
                    {l.discard}
                  </Button>
                ) : (
                  <span />
                )}
                <Button id={`${id}-send`} type="submit" size={40} icon="send" busy={busy}>
                  {busy ? l.sending : l.send}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <button
        ref={trigger}
        type="button"
        className="fl-fdbk-trigger"
        aria-expanded={open}
        aria-label={dirty && !open ? `${l.button}, ${l.draft}` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="mail" />
        {l.button}
        {dirty && !open ? <span className="fl-fdbk-dot" aria-hidden="true" /> : null}
      </button>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  page: "Invoices",
  rows: ["INV-2041 · Harbor Studio · $1,240", "INV-2040 · Pine & Co · $860", "INV-2039 · Northwind Foods · $3,115"],
  email: "jamie@northwind.example",
};

export default function FeedbackWidgetSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label="Feedback widget">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-fdbk-demo">
          <h2>{SAMPLE.page}</h2>
          <ul>
            {SAMPLE.rows.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <FeedbackWidget
            email={SAMPLE.email}
            send={(data) => new Promise((resolve, reject) => window.setTimeout(() => (data.message.toLowerCase().includes("offline") ? reject(new Error("offline")) : resolve()), 800))}
          />
        </div>
      </div>
    </section>
  );
}
