/** @flowcode-library ai-indicators · AI indicators: what a model made, what it is doing, and how sure it is (Small components)
 * Catalog ID: c.ai-indicator (component)
 * Function: The AI indicator (c.ai-indicator), the words-and-color marks for generated, in-progress and confidence; the reference sheet also shows a draft card, a field suggestion, a streaming answer and sources as specimen markup.
 * Use it as: import { AiIndicator } from "./ai-indicators"; <AiIndicator variant?="generated"|"working"|"confidence" label="AI draft" level?="high"|"mid"|"low" percent?={64}>what it is based on</AiIndicator>
 * Variants: c.ai-indicator.generated - mark text a model wrote: a small accent pill with a sparkle and words like AI draft, placed on the output itself; c.ai-indicator.working - show the model is busy: the same pill reading Thinking with a pulsing dot beside it; c.ai-indicator.confidence - say how sure the model is: a bold level, a percentage, a colored bar and one sentence on its basis (use as an <li> inside <ul className="fl-ctl-ai-sure">)
 * Look: A rounded accent-tinted pill with a sparkle icon and a short bold label; the confidence form is a labeled bar with a sentence.
 * Tokens: --color-accent --color-text-muted --color-surface --color-border --radius-md --space-1 --space-2 --space-3 --text-xs --text-sm --focus-ring
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
/**
 * How to try it
 * - Press Tab in the empty brief field to take the suggestion, or just type over it.
 * - Press "Ask it": the answer arrives a few letters at a time and can be stopped partway.
 * - Press a source to open it. Every mark says what it is in words as well as in color.
 *
 * Dependencies: React (useEffect, useState), and the library's own inline icon set ("./icons"), which is a table of SVG
 * paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are
 * the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built
 * app exactly as it runs here.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.ai-indicator: the marks that say a model was involved, always in words as well as color. ──

export type AiIndicatorVariant = "generated" | "working" | "confidence";
export type AiConfidenceLevel = "high" | "mid" | "low";

// Written out in full (not built from the level name) so a build finds every class the meter needs.
const BAR: Record<AiConfidenceLevel, string> = { high: "fl-ctl-bar--high", mid: "fl-ctl-bar--mid", low: "fl-ctl-bar--low" };

export function AiIndicator({ variant = "generated", label, level = "mid", percent = 0, className, children }: {
  variant?: AiIndicatorVariant;
  /** The words on the badge: "AI draft", "Thinking". For confidence, the level in words: "Fairly sure". */
  label: string;
  /** Confidence only: which bar color. */
  level?: AiConfidenceLevel;
  /** Confidence only: 0 to 100. */
  percent?: number;
  className?: string;
  /** Confidence only: one sentence on what the answer is based on. */
  children?: ReactNode;
}) {
  const fl = `c.ai-indicator.${variant}`;
  const badge = (
    <span className={["fl-ctl-ai-badge", variant === "generated" ? (className ?? "") : ""].filter(Boolean).join(" ")} {...(variant === "generated" ? { "data-fl": fl } : {})}>
      <Icon name="sparkle" /> {label}
    </span>
  );
  if (variant === "generated") return badge;
  if (variant === "working") {
    return (
      <span className={["fl-ctl-ai-head", className ?? ""].filter(Boolean).join(" ")} data-fl={fl}>
        {badge}
        <span className="fl-ctl-ai-pulse" aria-hidden="true" />
      </span>
    );
  }
  return (
    <li className={className} data-fl={fl}>
      <span className="fl-ctl-ai-sure-top">
        <strong>{label}</strong>
        <span className="fl-ctl-matrix-what">{percent}%</span>
      </span>
      <span className={`fl-ctl-bar ${BAR[level]}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}, ${percent} percent`}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="fl-ctl-matrix-what">{children}</span>
    </li>
  );
}

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
    { id: "high" as const, label: "Confident", pct: 92, what: "Drawn straight from your own venue notes." },
    { id: "mid" as const, label: "Fairly sure", pct: 64, what: "Pieced together from similar shoots, not this one." },
    { id: "low" as const, label: "Guessing", pct: 28, what: "Nothing in your notes covers this. Check it before you send it." },
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
          <AiIndicator label="AI draft" />
          <span className="fl-ctl-matrix-what">Written by a model from your venue notes. Check it before it goes out.</span>
        </div>
        <p>{d.answer}</p>
        <div className="fl-ctl-ai-foot">
          <Button size={32} onClick={() => setAccepted("Kept the draft")}>
            Keep it
          </Button>
          <Button variant="secondary" size={32} icon="refresh" onClick={() => setAccepted("Asked for another one")}>
            Try again
          </Button>
          <Button variant="tertiary" size={32} onClick={() => setAccepted("Discarded the draft")}>
            Discard
          </Button>
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
            {running ? <AiIndicator variant="working" label="Thinking" /> : <AiIndicator label={shown ? "Finished" : "Ready"} />}
          </div>
          <p aria-live="polite" aria-busy={running}>
            {d.answer.slice(0, shown)}
            {running ? <span className="fl-ctl-ai-caret" aria-hidden="true" /> : null}
            {!shown && !running ? <span className="fl-ctl-matrix-what">Nothing yet.</span> : null}
          </p>
          <div className="fl-ctl-ai-foot">
            {running ? (
              <Button variant="secondary" size={32} onClick={() => setRunning(false)}>
                Stop
              </Button>
            ) : (
              <Button
                size={32}
                icon="sparkle"
                onClick={() => {
                  setShown(0);
                  setRunning(true);
                }}
              >
                {shown ? "Run it again" : "Ask it"}
              </Button>
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
            <AiIndicator key={s.id} variant="confidence" label={s.label} level={s.id} percent={s.pct}>
              {s.what}
            </AiIndicator>
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
