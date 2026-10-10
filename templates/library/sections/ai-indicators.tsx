/** @flowcode-library ai-indicators · AI indicators: what a model made, what it is doing, and how sure it is (Small components)
 * Use cases: a generated draft; a suggestion in a field; a streaming answer; a citation; a confidence note
 * Jobs to be done: tell generated text from written text; see the model working; decide whether to trust it
 * Keywords: AI, generated, suggestion, streaming, confidence, provenance, citation, disclosure
 */
/**
 * The marks that say a machine was involved. They matter more than most components, because the thing they label is
 * text that looks exactly like text a person wrote.
 *
 * Every one of these says so in words as well as in color or a glow: a badge that reads "AI draft", a label on the
 * ghost text in a field, a sentence under a confidence bar. A sparkle on its own is decoration and tells a screen
 * reader nothing at all, which is why each is paired with real text here.
 *
 * The streaming answer runs, stops, and can be stopped partway, because a model you cannot interrupt is a model
 * people stop trusting.
 *
 * Make it the app's own: label the output, not the button. The person reading it later is the one who needs to know.
 */
import { useEffect, useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  answer:
    "Riverside has two covered spots if it rains: the orangery, which holds about forty, and the stable arch, which is darker but works well for portraits. Both need the ceremony moved thirty minutes earlier.",
  suggestion: "a relaxed, documentary-style wedding in early summer light",
  sources: [
    { id: "s1", title: "Riverside venue notes", when: "March 2026" },
    { id: "s2", title: "Your last three wet-weather shoots", when: "2024–2025" },
  ],
  sure: [
    { id: "high", label: "Confident", pct: 92, what: "Drawn straight from your own venue notes." },
    { id: "mid", label: "Fairly sure", pct: 64, what: "Pieced together from similar shoots, not this one." },
    { id: "low", label: "Guessing", pct: 28, what: "Nothing in your notes covers this. Check it before you send it." },
  ],
};

export default function AiIndicators() {
  const d = SAMPLE;
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [accepted, setAccepted] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setShown((n) => {
        if (n >= d.answer.length) {
          setRunning(false);
          return n;
        }
        return Math.min(d.answer.length, n + 3);
      });
    }, 40);
    return () => window.clearInterval(t);
  }, [running, d.answer.length]);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>What a model made</h3>
      <p className="fl-ctl-btn-what">A badge on the output itself. It survives being copied into a document, which is the whole point of putting it there and not on the button.</p>
      <div className="fl-ctl-ai-card">
        <div className="fl-ctl-ai-head">
          <span className="fl-ctl-ai-badge">
            <Icon name="sparkle" /> AI draft
          </span>
          <span className="fl-ctl-matrix-what">Written by a model from your venue notes. Check it before it goes out.</span>
        </div>
        <p>{d.answer}</p>
        <div className="fl-ctl-ai-foot">
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--32" onClick={() => setAccepted("Kept the draft")}>
            Keep it
          </button>
          <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setAccepted("Asked for another one")}>
            <Icon name="refresh" /> Try again
          </button>
          <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32" onClick={() => setAccepted("Discarded the draft")}>
            Discard
          </button>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>A suggestion inside a field</h3>
        <p className="fl-ctl-btn-what">
          Ghost text the person can take or ignore. It is marked as a suggestion in words, so it is never mistaken for
          something already typed, and Tab takes it.
        </p>
        <div className="fl-ctl-live-form">
          <p>
            <label htmlFor="ai-brief">How would you describe the day?</label>
            <span className="fl-ctl-ai-field">
              <input
                id="ai-brief"
                className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--40"
                value={draft}
                placeholder=" "
                aria-describedby="ai-brief-hint"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && !draft) {
                    e.preventDefault();
                    setDraft(d.suggestion);
                    setAccepted("Took the suggestion");
                  }
                }}
              />
              {draft ? null : <span className="fl-ctl-ai-ghost" aria-hidden="true">{d.suggestion}</span>}
            </span>
            <span className="fl-ctl-field-msg is-quiet" id="ai-brief-hint">
              {draft ? "Your own words." : "Suggested by a model from your past shoots. Press Tab to take it, or just type."}
            </span>
          </p>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>While it is working</h3>
        <p className="fl-ctl-btn-what">Text arriving a few letters at a time, and a way to stop it. The region is polite, so it does not interrupt a screen reader on every word.</p>
        <div className="fl-ctl-ai-stream">
          <div className="fl-ctl-ai-head">
            <span className="fl-ctl-ai-badge">
              <Icon name="sparkle" /> {running ? "Thinking" : shown ? "Finished" : "Ready"}
            </span>
            {running ? <span className="fl-ctl-ai-pulse" aria-hidden="true" /> : null}
          </div>
          <p aria-live="polite" aria-busy={running}>
            {d.answer.slice(0, shown)}
            {running ? <span className="fl-ctl-ai-caret" aria-hidden="true" /> : null}
            {!shown && !running ? <span className="fl-ctl-matrix-what">Nothing yet.</span> : null}
          </p>
          <div className="fl-ctl-ai-foot">
            {running ? (
              <button type="button" className="fl-btn fl-btn--secondary fl-ctl-btn--32" onClick={() => setRunning(false)}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="fl-btn fl-btn--primary fl-ctl-btn--32"
                onClick={() => {
                  setShown(0);
                  setRunning(true);
                }}
              >
                <Icon name="sparkle" /> {shown ? "Run it again" : "Ask it"}
              </button>
            )}
            <span className="fl-ctl-matrix-what">
              {shown ? `${Math.round((shown / d.answer.length) * 100)}% of the answer` : "Not started"}
            </span>
          </div>
        </div>
      </div>

      <div className="fl-ctl-sizes">
        <h3>How sure it is</h3>
        <p className="fl-ctl-btn-what">A bar is not enough. Each level says, in a sentence, what it is based on - which is the thing people actually need in order to decide.</p>
        <ul className="fl-ctl-ai-sure">
          {d.sure.map((s) => (
            <li key={s.id}>
              <span className="fl-ctl-ai-sure-top">
                <strong>{s.label}</strong>
                <span className="fl-ctl-matrix-what">{s.pct}%</span>
              </span>
              <span className={`fl-ctl-bar fl-ctl-bar--${s.id}`} role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.label}, ${s.pct} percent`}>
                <span style={{ width: `${s.pct}%` }} />
              </span>
              <span className="fl-ctl-matrix-what">{s.what}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Where it came from</h3>
        <p className="fl-ctl-btn-what">Named sources, pressable, under the answer. An answer with no sources should say that too, rather than saying nothing.</p>
        <ul className="fl-ctl-ai-src">
          {d.sources.map((s) => (
            <li key={s.id}>
              <button type="button" className="fl-ctl-ai-src-btn" onClick={() => setAccepted(`Opened: ${s.title}`)}>
                <Icon name="layers" />
                <span>
                  <strong>{s.title}</strong>
                  <span className="fl-ctl-matrix-what">{s.when}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {accepted || "Nothing accepted yet."}
      </p>
    </section>
  );
}
