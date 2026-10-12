/** @flowcode-library poll-vote · Poll (Forms)
 * Catalog ID: p.poll (pattern)
 * Function: The poll (p.poll): one question, a validated vote, then results with percentages and total votes, remembered on this device and changeable.
 * Use it as: import { Poll } from "./poll-vote"; <Poll question options={[{ id, label, votes }]} vote="Vote" change="Change my vote" required="..." thanks="..." eyebrow? closes? storageKey? onVote?={(id) => ...} />
 * Built from: c.card.surface, c.radio, c.button.primary, c.button.tertiary, c.alert.danger
 * Look: A card with one question and radio answers and a Vote button; after voting the answers become animated percentage bars with your own choice ticked and a button to change it.
 * Tokens: --color-accent --color-border --color-surface --color-surface-sunken --color-text-muted --space-4 --space-5 --radius-md --duration-base --easing
 * Use cases: poll; community vote; survey question; feature voting; member feedback; quick survey; event voting
 * Jobs to be done: vote on what happens next; see what others think; change my vote; share my opinion quickly
 * Keywords: poll, vote, survey, results, radio, feedback
 */
/**
 * Poll: one question, pick one answer and vote, then see the results as bars with percentages and the total number
 * of votes. Your own answer is marked, and you can change it. The vote is remembered on this device. Use it to ask
 * members what to run next. Make it the app's own: replace SAMPLE's question and counts, and send each vote to your
 * own store instead of local storage.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "./alerts-states";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Radio } from "./checkboxes-radios";

// ── p.poll: one question, pick one answer, then results as bars with percentages; the vote is remembered and can be changed. ──

export type PollOption = { id: string; label: string; /** Votes already counted, not including this person's. */ votes: number };

export type PollProps = {
  eyebrow?: string;
  question: string;
  options: PollOption[];
  /** The vote button's words. */
  vote: string;
  /** The results screen's button for changing the vote. */
  change: string;
  /** When it ends ("Poll closes Friday 29 November"). */
  closes?: string;
  /** Said when Vote is pressed with nothing chosen. */
  required: string;
  /** Announced after voting. */
  thanks: string;
  /** Where this device remembers the vote in local storage; leave out to forget it on reload. */
  storageKey?: string;
  /** Called with the chosen option's id when a vote is cast. */
  onVote?: (id: string) => void;
  className?: string;
};

function readVote(key?: string): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeVote(key: string | undefined, id: string) {
  if (!key) return;
  try {
    localStorage.setItem(key, id);
  } catch {
    /* storage blocked: the vote lasts for this visit only */
  }
}

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export function Poll({ eyebrow, question, options, vote, change, closes, required, thanks, storageKey, onVote, className }: PollProps) {
  const uid = useId();
  const [voted, setVoted] = useState<string | null>(() => readVote(storageKey));
  const [mode, setMode] = useState<"form" | "results">(() => (readVote(storageKey) ? "results" : "form"));
  const [choice, setChoice] = useState<string>(() => readVote(storageKey) ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [shown, setShown] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode !== "results") return;
    setShown(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const counts = options.map((o) => ({ ...o, votes: o.votes + (voted === o.id ? 1 : 0) }));
  const total = counts.reduce((s, o) => s + o.votes, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!choice) {
      setError(required);
      formRef.current?.querySelector<HTMLInputElement>("input[type=radio]")?.focus();
      return;
    }
    setError("");
    setVoted(choice);
    writeVote(storageKey, choice);
    onVote?.(choice);
    setMode("results");
    setStatus(thanks);
    window.setTimeout(() => document.getElementById(`${uid}-change`)?.focus(), 0);
  }

  function back() {
    setMode("form");
    setStatus("");
    window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>("input:checked, input[type=radio]")?.focus(), 0);
  }

  return (
    <section className={["fl-section fl-section--tint", className ?? ""].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`} data-fl="p.poll">
      <div className="fl-wrap">
        <Card variant="surface" className="fl-dsp-poll">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          {mode === "form" ? (
            <form ref={formRef} onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--space-5)" }}>
              <fieldset aria-describedby={error ? `${uid}-error` : undefined}>
                <legend id={`${uid}-title`}>{question}</legend>
                {options.map((o) => (
                  <label key={o.id} className="fl-dsp-poll__opt">
                    <Radio
                      name={`${uid}-poll`}
                      value={o.id}
                      checked={choice === o.id}
                      onChange={() => {
                        setChoice(o.id);
                        setError("");
                      }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </fieldset>
              {error && <Alert variant="danger" id={`${uid}-error`} title={error} />}
              <div className="fl-dsp-poll__foot">
                {closes ? <span className="fl-meta">{closes}</span> : <span />}
                <Button type="submit">{vote}</Button>
              </div>
            </form>
          ) : (
            <>
              <h3 id={`${uid}-title`} style={{ margin: 0 }}>
                {question}
              </h3>
              <ul className="fl-dsp-poll__results">
                {counts.map((o) => {
                  const pct = total ? Math.round((o.votes / total) * 100) : 0;
                  const mine = voted === o.id;
                  return (
                    <li key={o.id} className={`fl-dsp-poll__res${mine ? " fl-dsp-poll__res--mine" : ""}`}>
                      <i aria-hidden="true" style={{ width: shown ? `${pct}%` : "0%" }} />
                      <span>
                        {o.label}
                        {mine && (
                          <>
                            <Check />
                            <span className="fl-sr">(your vote)</span>
                          </>
                        )}
                      </span>
                      <b>
                        {pct}%<span className="fl-sr">, {o.votes} votes</span>
                      </b>
                    </li>
                  );
                })}
              </ul>
              <div className="fl-dsp-poll__foot">
                <span className="fl-meta">
                  {total.toLocaleString()} votes{closes ? ` · ${closes}` : ""}
                </span>
                <Button id={`${uid}-change`} variant="tertiary" size={40} onClick={back}>
                  {change}
                </Button>
              </div>
            </>
          )}
          <p className="fl-dsp-status" role="status" aria-live="polite">
            {status && <span className="fl-dsp-ok">{status}</span>}
          </p>
        </Card>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: PollProps = {
  storageKey: "poll-evening-class-v1",
  eyebrow: "Members' poll",
  question: "Which evening class should we add in the new year?",
  options: [
    { id: "raku", label: "Raku firing", votes: 46 },
    { id: "glaze", label: "Glaze chemistry", votes: 31 },
    { id: "sculpt", label: "Hand-built sculpture", votes: 58 },
    { id: "lettering", label: "Brush lettering on pots", votes: 19 },
  ],
  vote: "Vote",
  change: "Change my vote",
  closes: "Poll closes Friday 29 November",
  required: "Choose one answer before voting.",
  thanks: "Thanks, your vote is in.",
};

export default function PollVote() {
  return <Poll {...SAMPLE} />;
}
