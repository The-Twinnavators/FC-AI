/**
 * Poll: one question, pick one answer and vote, then see the results as bars with percentages and the total number
 * of votes. Your own answer is marked, and you can change it. The vote is remembered on this device. Use it to ask
 * members what to run next. Make it the app's own: replace SAMPLE's question and counts, and send each vote to your
 * own store instead of local storage.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
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

function readVote(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeVote(key: string, id: string) {
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

export default function PollVote() {
  const d = SAMPLE;
  const [voted, setVoted] = useState<string | null>(() => readVote(d.storageKey));
  const [mode, setMode] = useState<"form" | "results">(() => (readVote(d.storageKey) ? "results" : "form"));
  const [choice, setChoice] = useState<string>(() => readVote(d.storageKey) ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [shown, setShown] = useState(false);
  const firstRadio = useRef<HTMLInputElement>(null);
  const changeBtn = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (mode !== "results") return;
    setShown(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const counts = d.options.map((o) => ({ ...o, votes: o.votes + (voted === o.id ? 1 : 0) }));
  const total = counts.reduce((s, o) => s + o.votes, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!choice) {
      setError(d.required);
      firstRadio.current?.focus();
      return;
    }
    setError("");
    setVoted(choice);
    writeVote(d.storageKey, choice);
    setMode("results");
    setStatus(d.thanks);
    window.setTimeout(() => changeBtn.current?.focus(), 0);
  }

  function change() {
    setMode("form");
    setStatus("");
    window.setTimeout(() => (formRef.current?.querySelector<HTMLInputElement>("input:checked") ?? firstRadio.current)?.focus(), 0);
  }

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="poll-vote-title">
      <div className="fl-wrap">
        <div className="fl-card fl-dsp-poll">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          {mode === "form" ? (
            <form ref={formRef} onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--space-5)" }}>
              <fieldset aria-describedby={error ? "poll-vote-error" : undefined}>
                <legend id="poll-vote-title">{d.question}</legend>
                {d.options.map((o, i) => (
                  <label key={o.id} className="fl-dsp-poll__opt">
                    <input ref={i === 0 ? firstRadio : undefined} type="radio" name="poll-vote" value={o.id} checked={choice === o.id} onChange={() => { setChoice(o.id); setError(""); }} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p id="poll-vote-error" className="fl-dsp-err" role="alert">
                  {error}
                </p>
              )}
              <div className="fl-dsp-poll__foot">
                <span className="fl-meta">{d.closes}</span>
                <button type="submit" className="fl-btn fl-btn--primary">
                  {d.vote}
                </button>
              </div>
            </form>
          ) : (
            <>
              <h3 id="poll-vote-title" style={{ margin: 0 }}>
                {d.question}
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
                  {total.toLocaleString()} votes · {d.closes}
                </span>
                <button ref={changeBtn} type="button" className="fl-dsp-btn" onClick={change}>
                  {d.change}
                </button>
              </div>
            </>
          )}
          <p className="fl-dsp-status" role="status" aria-live="polite">
            {status && <span className="fl-dsp-ok">{status}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
