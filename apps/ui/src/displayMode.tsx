/**
 * How FlowCode explains things: "Plain language" (what's happening, why it matters, what you decide; technical details
 * stay folded) or "Technical details" (commands, files, model and runtime, raw errors, shown open). Both show the same
 * facts, and neither hides failures, risks, spending, checks that couldn't run, or approvals. The mode changes
 * presentation only, never permissions or safety. Saved on this computer; switch any time.
 */
import { useEffect, useState } from "react";

export type DisplayMode = "plain" | "technical";
const KEY = "fc.displayMode";
const EVENT = "fc:display-mode";

export function getDisplayMode(): DisplayMode {
  try {
    return localStorage.getItem(KEY) === "technical" ? "technical" : "plain";
  } catch {
    return "plain";
  }
}

export function setDisplayMode(m: DisplayMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* storage unavailable: the choice lasts for this session */
  }
  document.documentElement.dataset.display = m;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: m }));
}

export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>(getDisplayMode);
  useEffect(() => {
    const on = (e: Event) => setMode((e as CustomEvent<DisplayMode>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return mode;
}

/** A compact switch for headers: Plain language / Technical details. */
export function DisplayModeSwitch({ className }: { className?: string }) {
  const mode = useDisplayMode();
  return (
    <div className={`seg seg--sm display-switch${className ? ` ${className}` : ""}`} role="radiogroup" aria-label="How FlowCode explains things">
      <button type="button" role="radio" aria-checked={mode === "plain"} aria-label="Plain language" onClick={() => setDisplayMode("plain")} title="Plain language: explanations first, technical details folded away">
        Plain
      </button>
      <button type="button" role="radio" aria-checked={mode === "technical"} aria-label="Technical details" onClick={() => setDisplayMode("technical")} title="Technical details: commands, files, model and runtime details shown open">
        Technical
      </button>
    </div>
  );
}

/** Settings → Explanations. */
export function DisplayModeSettings() {
  const mode = useDisplayMode();
  return (
    <section className="section display-settings" aria-labelledby="display-title">
      <div className="section__head">
        <h2 className="section__title" id="display-title">
          How FlowCode explains things
        </h2>
      </div>
      <div className="display-settings__body">
        <p className="lib__lede">Choose how much detail you see. Both show the same facts: failures, risks, spending, checks that couldn't run and approvals are never hidden. The choice changes how things are shown, not what FlowCode is allowed to do.</p>
        <fieldset className="display-settings__choices">
          <legend className="sr-only">Explanation style</legend>
          <label className={`display-choice${mode === "plain" ? " is-on" : ""}`}>
            <input type="radio" name="display-mode" checked={mode === "plain"} onChange={() => setDisplayMode("plain")} />
            <strong>Plain language</strong>
            <span>What's happening, why it matters, what FlowCode handles and what you decide. Technical details are one click away.</span>
            <em>“Your app couldn't start because a required package is missing. FlowCode can add it and try again.”</em>
          </label>
          <label className={`display-choice${mode === "technical" ? " is-on" : ""}`}>
            <input type="radio" name="display-mode" checked={mode === "technical"} onChange={() => setDisplayMode("technical")} />
            <strong>Technical details</strong>
            <span>Commands, file paths, tool results, model and runtime details, and full error text, shown open.</span>
            <em>“The preview failed: package X is missing from dependencies. Proposed: add X, then re-run the preview command.”</em>
          </label>
        </fieldset>
      </div>
    </section>
  );
}

// Apply the saved mode as soon as the app loads (CSS can use :root[data-display]).
if (typeof document !== "undefined") document.documentElement.dataset.display = getDisplayMode();
