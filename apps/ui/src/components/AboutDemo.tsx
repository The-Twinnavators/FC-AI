/**
 * The About page's hero as a short, looping product demo (about 14 seconds), built from the same tokens as the rest of
 * FlowCode: a request waits for your OK and a cursor approves it; the build's two steps finish; the final checks come
 * in one by one, the last one "couldn't run"; the build ends "Ready, not fully checked". Then it starts again.
 * With reduced motion it shows the finished state and doesn't move. Off-screen, it pauses.
 */
import { useEffect, useRef, useState } from "react";

const TICK = 850;
const LAST = 16; // phases 0..LAST, then the loop restarts

const CHECKS: Array<[string, "ok" | "warn"]> = [
  ["Automatic tests", "ok"],
  ["App packaging", "ok"],
  ["Accessibility", "ok"],
  ["Design check", "ok"],
  ["Design review", "warn"],
];

function useDemoPhase(ref: React.RefObject<HTMLElement | null>): number {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState(reduce ? LAST : 0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  useEffect(() => {
    if (reduce || !visible) return;
    const t = setInterval(() => setPhase((p) => (p >= LAST ? 0 : p + 1)), TICK);
    return () => clearInterval(t);
  }, [reduce, visible]);
  return phase;
}

type StepState = "waiting" | "working" | "checked";

export function AboutDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useDemoPhase(ref);
  // The story, phase by phase.
  const approved = p >= 4;
  const cursorIn = p >= 2 && p < 6;
  const pressing = p === 3 || p === 4;
  const step1: StepState = p < 5 ? (approved ? "working" : "waiting") : "checked";
  const step2: StepState = p < 5 ? "waiting" : p < 7 ? "working" : "checked";
  const checksShown = Math.max(0, Math.min(CHECKS.length, p - 7));
  const finished = p >= 13;
  const status = finished ? { tone: "warn", text: "Ready, not fully checked" } : p >= 7 ? { tone: "run", text: "Running final checks" } : approved ? { tone: "run", text: "Building" } : { tone: "run", text: "Waiting for your OK" };

  return (
    <div className="ab2__collage ab2__demo" ref={ref} aria-hidden="true">
      <div className="ab2__c ab2__c--1">
        <div className="abf abf--overview">
          <div className="abf__row">
            <span className={`abf-chip abf-chip--${status.tone} demo-swap`} key={status.text}>
              {status.text}
            </span>
            <span className="abf__meta">12:48</span>
          </div>
          <p className="abf__title">Two small fixes to the No BIO &amp; GMO app</p>
          <div className="abf__label">Where it stands</div>
          <p className="abf__text demo-swap" key={finished ? "done" : "now"}>
            {finished ? "A check couldn't run, so part of the work isn't verified." : approved ? "Building step by step; each step is checked before the next." : "Waiting for you to approve a package install."}
          </p>
          <div className="abf__label">Plan and progress</div>
          <ul className="abf__steps">
            {[
              ["Update backdrop colour tokens", step1],
              ["Give Pacific Foods its own photo", step2],
            ].map(([t, s]) => (
              <li key={t}>
                <span className={`abf__dot ${s === "checked" ? "abf__dot--ok" : s === "working" ? "abf__dot--run" : ""}`} /> {t}
                <span className={`abf-chip demo-swap ${s === "checked" ? "abf-chip--ok" : s === "working" ? "abf-chip--run" : "abf-chip--off"}`} key={s}>
                  {s === "checked" ? "Checked" : s === "working" ? "Working" : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ab2__c ab2__c--2">
        <div className="abf abf--checks">
          <p className="abf__text abf__text--strong">{checksShown === 0 ? "Final checks run when the steps are done." : finished ? "12 of 13 checks passed, 1 couldn't run." : `Checking… ${checksShown} of ${CHECKS.length}`}</p>
          <ul className="abf__checks">
            {CHECKS.map(([n, t], i) => (
              <li key={n} className={i < checksShown ? "is-in" : "is-pending"}>
                <span>{n}</span>
                <span className={`abf__state ${i < checksShown ? `abf__state--${t}` : ""}`}>{i < checksShown ? (t === "ok" ? "Passed" : "Couldn't run") : "…"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ab2__c ab2__c--3">
        <div className={`abf abf--approval${approved ? " is-decided" : " is-waiting"}`}>
          <div className="abf__row">
            <span className={`abf-chip demo-swap ${approved ? "abf-chip--ok" : "abf-chip--run"}`} key={approved ? "a" : "w"}>
              {approved ? "Approved" : "Needs your OK"}
            </span>
            <span className="abf__meta">Medium risk</span>
          </div>
          <p className="abf__text">Install packages for the date picker</p>
          <code className="abf__code">npm install date-fns</code>
          <div className="abf__buttons">
            <span className={`abf__btn abf__btn--primary${pressing ? " is-pressed" : ""}`}>{approved ? "Approved once" : "Approve once"}</span>
            {!approved ? <span className="abf__btn">Deny</span> : null}
          </div>
          <span className={`demo-cursor${cursorIn ? " is-in" : ""}${pressing ? " is-pressing" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M5 3l14 8-6.5 1.5L10 19z" fill="var(--text-0)" stroke="var(--bg-1)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
